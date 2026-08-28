/**
 * Scheduling Workflow Orchestrator
 * Implements the complete scheduling workflow from payment to work order closure
 * 
 * WORKFLOW:
 * Payment Completed / Eligible → Assign Vendor to Each Service → Property moves to Pending Scheduling
 * → Manager receives notification → Manager opens Property → System loads Service + Vendor + Frequency + Visits
 * → System checks Vendor + Zone + Existing Calendar → Recommended Dates Generated
 * → Manager accepts or changes dates → Confirm Schedule → Recurring Schedule Occurrences Created
 * → 7 Days Before Each Visit → Work Order Auto-Created → Vendor Notified
 * → Vendor Completes Service → Manager / FP Verifies → Work Order Closed
 * 
 * CRITICAL RULES:
 * 1. Frequency calculated from FIRST scheduled visit, not fixed calendar months
 * 2. Vendor recommendation considers: service + vendor + zone + availability + existing jobs
 * 3. Series + Individual Occurrences architecture
 * 4. Rescheduling ONE occurrence does NOT move future visits by default
 * 5. Cancellation uses 'cancelled' status, NOT database deletion
 * 6. Work orders generated 7 days before each service date
 * 7. Managers can ALWAYS override recommended dates
 * 8. Every reschedule/cancellation maintains audit trail
 * 9. Vendor availability checked before recommendations
 * 10. Each service scheduled INDEPENDENTLY (different vendors/frequencies per property)
 */

const { pool } = require('../config/database');

// ID Generators
const generateId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Frequency configuration - days between visits
const FREQUENCY_CONFIG = {
  'daily': { days: 1, label: 'Daily' },
  'weekly': { days: 7, label: 'Weekly' },
  'bi_weekly': { days: 14, label: 'Bi-Weekly' },
  'monthly': { days: 30, label: 'Monthly' },
  'every_2_months': { days: 60, label: 'Every 2 Months' },
  'quarterly': { days: 90, label: 'Quarterly' },
  'half_yearly': { days: 180, label: 'Half Yearly' },
  'yearly': { days: 365, label: 'Yearly' },
  'one_time': { days: 0, label: 'One Time' }
};

// ============================================
// STEP 1: MARK PROPERTY AS PAYMENT COMPLETED
// ============================================
async function markPaymentCompleted({ propertyId, estimateId, invoiceId, paidAmount, paidBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get estimate services to prepare for vendor assignment
    const [estimate] = await connection.execute(
      `SELECT service_rows, franchise_partner_id FROM estimates WHERE id = ?`,
      [estimateId]
    );

    if (estimate.length === 0) {
      throw new Error('Estimate not found');
    }

    const services = JSON.parse(estimate[0].service_rows || '[]');
    const franchisePartnerId = estimate[0].franchise_partner_id;

    // Create pending schedule entry for each service
    for (const service of services) {
      await connection.execute(`
        INSERT INTO pending_property_schedules (
          property_id, estimate_id, invoice_id, service_name, service_category,
          frequency, total_visits, status, franchise_partner_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_vendor', ?, NOW())
        ON DUPLICATE KEY UPDATE 
          status = 'pending_vendor',
          updated_at = NOW()
      `, [
        propertyId, estimateId, invoiceId,
        service.serviceName || service.name,
        service.category || service.serviceCategory,
        service.frequencyType || service.frequency || 'monthly',
        service.visits || service.totalVisits || 1,
        franchisePartnerId
      ]);
    }

    // Notify Manager about pending scheduling
    await createNotification({
      connection,
      type: 'scheduling_pending',
      title: 'New Property Ready for Scheduling',
      message: `Property payment completed. ${services.length} service(s) need vendor assignment and scheduling.`,
      referenceType: 'property',
      referenceId: propertyId,
      franchisePartnerId,
      recipientRoles: ['manager', 'franchise_partner']
    });

    await connection.commit();
    return { success: true, servicesCount: services.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 2: ASSIGN VENDOR TO SERVICE
// ============================================
async function assignVendorToService({
  propertyId,
  serviceId,
  serviceName,
  serviceCategory,
  vendorId,
  frequency,
  totalVisits,
  estimateId,
  invoiceId,
  packageId,
  assignedBy,
  franchisePartnerId
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get vendor and property details
    const [vendor] = await connection.execute(
      `SELECT id, COALESCE(company_name, owner_name) as name, zone, area_name 
       FROM onboarded_vendors WHERE id = ?`,
      [vendorId]
    );
    if (vendor.length === 0) throw new Error('Vendor not found');

    const [property] = await connection.execute(
      `SELECT zone, area_name FROM onboarded_properties WHERE id = ?`,
      [propertyId]
    );

    const vendorName = vendor[0].name;
    const zoneName = property[0]?.zone || vendor[0].zone;
    const seriesId = generateId('SER');

    // Create Schedule Series (service scheduled independently)
    await connection.execute(`
      INSERT INTO schedule_series (
        series_id, property_id, estimate_id, invoice_id, package_id, service_id,
        service_name, service_category, vendor_id, vendor_name, vendor_assigned_at,
        vendor_assigned_by, frequency, total_visits, zone_name,
        status, franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, 'pending_schedule', ?, ?)
    `, [
      seriesId, propertyId, estimateId, invoiceId, packageId, serviceId,
      serviceName, serviceCategory, vendorId, vendorName,
      assignedBy, frequency, totalVisits, zoneName,
      franchisePartnerId, assignedBy
    ]);

    // Update pending schedule status
    await connection.execute(`
      UPDATE pending_property_schedules 
      SET status = 'pending_schedule', vendor_id = ?, updated_at = NOW()
      WHERE property_id = ? AND service_name = ?
    `, [vendorId, propertyId, serviceName]);

    // Log history
    await logSeriesHistory(connection, seriesId, 'vendor_assigned', null, { vendorId, vendorName }, assignedBy);

    // Notify about scheduling needed
    await createNotification({
      connection,
      type: 'vendor_assigned',
      title: 'Vendor Assigned - Schedule Required',
      message: `${vendorName} assigned to ${serviceName}. Please schedule the service visits.`,
      referenceType: 'schedule_series',
      referenceId: seriesId,
      franchisePartnerId,
      recipientRoles: ['manager', 'franchise_partner']
    });

    await connection.commit();
    return { success: true, seriesId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 3: GET RECOMMENDED DATES FOR SCHEDULING
// ============================================
async function getRecommendedDates({
  seriesId,
  vendorId,
  zoneName,
  frequency,
  totalVisits,
  firstServiceDate,
  preferredDayOfWeek
}) {
  const connection = await pool.getConnection();
  try {
    const recommendations = [];
    const frequencyDays = FREQUENCY_CONFIG[frequency]?.days || 30;
    
    // CRITICAL: Calculate from first scheduled visit, not calendar months
    let targetDate = new Date(firstServiceDate);

    for (let visitNum = 1; visitNum <= totalVisits; visitNum++) {
      // Get vendor's existing jobs in the zone for this target month
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const [existingJobs] = await connection.execute(`
        SELECT 
          so.scheduled_date,
          COUNT(*) as job_count,
          GROUP_CONCAT(DISTINCT ss.service_name) as services
        FROM schedule_occurrences so
        JOIN schedule_series ss ON so.series_id = ss.id
        WHERE so.vendor_id = ?
          AND ss.zone_name = ?
          AND so.scheduled_date BETWEEN ? AND ?
          AND so.status NOT IN ('cancelled', 'completed')
        GROUP BY so.scheduled_date
        ORDER BY job_count DESC
      `, [vendorId, zoneName, formatDate(monthStart), formatDate(monthEnd)]);

      // Get vendor's total daily capacity
      const [vendorCapacity] = await connection.execute(`
        SELECT max_daily_visits FROM onboarded_vendors WHERE id = ?
      `, [vendorId]);
      const maxDaily = vendorCapacity[0]?.max_daily_visits || 8;

      // Find best date: prioritize days with existing jobs in same zone (trip consolidation)
      let recommendedDate = targetDate;
      let reason = 'Target date based on frequency';
      let score = 50;

      if (existingJobs.length > 0) {
        // Check each existing job date
        for (const job of existingJobs) {
          const jobDate = new Date(job.scheduled_date);
          const daysDiff = Math.abs((jobDate - targetDate) / (1000 * 60 * 60 * 24));
          
          // Only consider if within 7 days of target
          if (daysDiff <= 7 && job.job_count < maxDaily) {
            recommendedDate = jobDate;
            reason = `Recommended: Vendor has ${job.job_count} job(s) in ${zoneName} - consolidate trips!`;
            score = 90 - (daysDiff * 2); // Higher score for closer dates
            break;
          }
        }
      }

      // Check if target date is available
      const [targetLoad] = await connection.execute(`
        SELECT COUNT(*) as jobs FROM schedule_occurrences
        WHERE vendor_id = ? AND scheduled_date = ? AND status NOT IN ('cancelled')
      `, [vendorId, formatDate(targetDate)]);

      if (targetLoad[0].jobs >= maxDaily && recommendedDate.getTime() === targetDate.getTime()) {
        // Target date full, find next available
        let checkDate = new Date(targetDate);
        for (let i = 1; i <= 14; i++) {
          checkDate.setDate(checkDate.getDate() + 1);
          const [load] = await connection.execute(`
            SELECT COUNT(*) as jobs FROM schedule_occurrences
            WHERE vendor_id = ? AND scheduled_date = ? AND status NOT IN ('cancelled')
          `, [vendorId, formatDate(checkDate)]);
          if (load[0].jobs < maxDaily) {
            recommendedDate = checkDate;
            reason = `Next available date (target was fully booked)`;
            score = 40;
            break;
          }
        }
      }

      recommendations.push({
        visitNumber: visitNum,
        targetDate: formatDate(targetDate),
        recommendedDate: formatDate(recommendedDate),
        reason,
        score,
        existingJobsInZone: existingJobs.filter(j => 
          new Date(j.scheduled_date).toDateString() === recommendedDate.toDateString()
        )[0]?.job_count || 0,
        canOverride: true // Manager can ALWAYS override
      });

      // Move to next target date based on frequency FROM FIRST VISIT
      targetDate = new Date(firstServiceDate);
      targetDate.setDate(targetDate.getDate() + (frequencyDays * visitNum));
    }

    return { success: true, recommendations };
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 4: CONFIRM SCHEDULE & CREATE OCCURRENCES
// ============================================
async function confirmSchedule({
  seriesId,
  scheduledDates, // Array of { visitNumber, date, timeStart, timeEnd }
  confirmedBy
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get series details
    const [series] = await connection.execute(
      `SELECT * FROM schedule_series WHERE id = ?`,
      [seriesId]
    );
    if (series.length === 0) throw new Error('Schedule series not found');

    const seriesData = series[0];
    const seriesPrefix = seriesData.series_id;

    // Get contract start/end from first and last dates
    const sortedDates = scheduledDates.sort((a, b) => new Date(a.date) - new Date(b.date));
    const contractStart = sortedDates[0].date;
    const contractEnd = sortedDates[sortedDates.length - 1].date;

    // Create each occurrence
    for (const schedule of scheduledDates) {
      const occurrenceId = `${seriesPrefix}-${String(schedule.visitNumber).padStart(2, '0')}`;
      
      await connection.execute(`
        INSERT INTO schedule_occurrences (
          occurrence_id, series_id, visit_number, target_date, scheduled_date,
          scheduled_time_start, scheduled_time_end, vendor_id, vendor_name,
          zone_name, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NOW())
      `, [
        occurrenceId, seriesId, schedule.visitNumber,
        schedule.targetDate || schedule.date, // Target = original calculated date
        schedule.date, // Scheduled = confirmed date (may differ if manager changed it)
        schedule.timeStart || '09:00:00',
        schedule.timeEnd || '11:00:00',
        seriesData.vendor_id, seriesData.vendor_name,
        seriesData.zone_name
      ]);
    }

    // Update series status and contract dates
    await connection.execute(`
      UPDATE schedule_series 
      SET status = 'active', 
          contract_start_date = ?, 
          contract_end_date = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [contractStart, contractEnd, seriesId]);

    // Log history
    await logSeriesHistory(connection, seriesId, 'status_changed', 
      { status: 'pending_schedule' }, 
      { status: 'active', occurrences: scheduledDates.length },
      confirmedBy
    );

    // Notify vendor
    await createNotification({
      connection,
      type: 'schedule_confirmed',
      title: 'New Schedule Assigned',
      message: `You have been assigned ${scheduledDates.length} visits for ${seriesData.service_name}. First visit: ${formatDisplayDate(contractStart)}`,
      referenceType: 'schedule_series',
      referenceId: seriesId,
      recipientVendorId: seriesData.vendor_id
    });

    await connection.commit();
    return { success: true, occurrencesCreated: scheduledDates.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 5: GENERATE WORK ORDERS (7 DAYS BEFORE)
// ============================================
async function generateWorkOrdersForUpcomingVisits() {
  const connection = await pool.getConnection();
  try {
    // Find occurrences 7 days from now without work orders
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);

    const [upcomingOccurrences] = await connection.execute(`
      SELECT 
        so.*,
        ss.service_name, ss.service_category, ss.property_id,
        ss.franchise_partner_id,
        op.property_name, op.property_address, op.customer_name, op.customer_phone,
        ov.owner_name as vendor_contact, ov.owner_mobile as vendor_phone
      FROM schedule_occurrences so
      JOIN schedule_series ss ON so.series_id = ss.id
      LEFT JOIN onboarded_properties op ON ss.property_id = op.id
      LEFT JOIN onboarded_vendors ov ON so.vendor_id = ov.id
      WHERE so.scheduled_date = ?
        AND so.work_order_id IS NULL
        AND so.status IN ('scheduled', 'confirmed')
    `, [formatDate(targetDate)]);

    const workOrdersCreated = [];

    for (const occurrence of upcomingOccurrences) {
      await connection.beginTransaction();
      try {
        const workOrderId = generateId('WO');

        // Create work order
        await connection.execute(`
          INSERT INTO work_orders (
            work_order_id, property_id, schedule_occurrence_id, vendor_id,
            service_type, title, description, status, priority,
            scheduled_date, scheduled_time, franchise_partner_id,
            visit_number, total_visits, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', 'normal', ?, ?, ?, ?, ?, NOW())
        `, [
          workOrderId, occurrence.property_id, occurrence.id, occurrence.vendor_id,
          occurrence.service_category, occurrence.service_name,
          `Visit ${occurrence.visit_number} - ${occurrence.service_name} at ${occurrence.property_name}`,
          occurrence.scheduled_date, occurrence.scheduled_time_start,
          occurrence.franchise_partner_id,
          occurrence.visit_number, occurrence.total_visits || 1
        ]);

        // Update occurrence with work order reference
        await connection.execute(`
          UPDATE schedule_occurrences 
          SET work_order_id = (SELECT id FROM work_orders WHERE work_order_id = ?),
              work_order_generated_at = NOW(),
              status = 'work_order_created'
          WHERE id = ?
        `, [workOrderId, occurrence.id]);

        // Notify vendor
        await createNotification({
          connection,
          type: 'work_order_created',
          title: 'New Work Order',
          message: `Work order for ${occurrence.service_name} at ${occurrence.property_name} on ${formatDisplayDate(occurrence.scheduled_date)}`,
          referenceType: 'work_order',
          referenceId: workOrderId,
          recipientVendorId: occurrence.vendor_id
        });

        await connection.commit();
        workOrdersCreated.push(workOrderId);
      } catch (err) {
        await connection.rollback();
        console.error(`Failed to create work order for occurrence ${occurrence.id}:`, err);
      }
    }

    return { success: true, workOrdersCreated: workOrdersCreated.length, ids: workOrdersCreated };
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 6: RESCHEDULE OCCURRENCE
// CRITICAL: Does NOT move future visits by default
// ============================================
async function rescheduleOccurrence({
  occurrenceId,
  newDate,
  newTimeStart,
  newTimeEnd,
  reason,
  scope = 'this_visit_only', // Default: only this visit
  rescheduledBy
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [occurrence] = await connection.execute(
      `SELECT * FROM schedule_occurrences WHERE id = ?`,
      [occurrenceId]
    );
    if (occurrence.length === 0) throw new Error('Occurrence not found');

    const current = occurrence[0];

    // CRITICAL: By default, only reschedule this occurrence
    if (scope === 'this_visit_only') {
      await connection.execute(`
        UPDATE schedule_occurrences SET
          scheduled_date = ?,
          scheduled_time_start = ?,
          scheduled_time_end = ?,
          rescheduled_from_date = ?,
          rescheduled_from_time = ?,
          rescheduled_by = ?,
          rescheduled_at = NOW(),
          reschedule_reason = ?,
          reschedule_scope = 'this_visit_only',
          status = 'rescheduled'
        WHERE id = ?
      `, [
        newDate, newTimeStart || current.scheduled_time_start, 
        newTimeEnd || current.scheduled_time_end,
        current.scheduled_date, current.scheduled_time_start,
        rescheduledBy, reason, occurrenceId
      ]);

      // Log audit trail
      await logOccurrenceHistory(connection, occurrenceId, 'rescheduled',
        { date: current.scheduled_date, time: current.scheduled_time_start },
        { date: newDate, time: newTimeStart },
        reason, rescheduledBy
      );
    } else if (scope === 'this_and_future') {
      // Only when explicitly requested: reschedule this and future
      const daysDiff = Math.floor((new Date(newDate) - new Date(current.scheduled_date)) / (1000 * 60 * 60 * 24));

      const [futureOccurrences] = await connection.execute(`
        SELECT id, scheduled_date FROM schedule_occurrences
        WHERE series_id = ? AND visit_number >= ? AND status NOT IN ('completed', 'cancelled', 'verified')
      `, [current.series_id, current.visit_number]);

      for (const occ of futureOccurrences) {
        const newOccDate = new Date(occ.scheduled_date);
        newOccDate.setDate(newOccDate.getDate() + daysDiff);

        await connection.execute(`
          UPDATE schedule_occurrences SET
            scheduled_date = ?,
            rescheduled_from_date = scheduled_date,
            rescheduled_by = ?,
            rescheduled_at = NOW(),
            reschedule_reason = ?,
            reschedule_scope = 'this_and_future'
          WHERE id = ?
        `, [formatDate(newOccDate), rescheduledBy, reason, occ.id]);

        await logOccurrenceHistory(connection, occ.id, 'rescheduled',
          { date: occ.scheduled_date }, { date: formatDate(newOccDate) },
          `Bulk reschedule: ${reason}`, rescheduledBy
        );
      }
    }

    await connection.commit();
    return { success: true, scope };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 7: CANCEL OCCURRENCE (Status, NOT delete)
// ============================================
async function cancelOccurrence({ occurrenceId, reason, cancelledBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // CRITICAL: Use status change, NOT deletion
    await connection.execute(`
      UPDATE schedule_occurrences SET
        status = 'cancelled',
        cancelled_by = ?,
        cancelled_at = NOW(),
        cancellation_reason = ?
      WHERE id = ?
    `, [cancelledBy, reason, occurrenceId]);

    // Log audit trail
    await logOccurrenceHistory(connection, occurrenceId, 'cancelled',
      null, { status: 'cancelled' }, reason, cancelledBy
    );

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// STEP 8: COMPLETE & VERIFY WORK ORDER
// ============================================
async function completeWorkOrder({ workOrderId, completedBy, notes, photos }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE work_orders SET
        status = 'work_completed',
        completed_at = NOW(),
        completed_by = ?,
        completion_notes = ?
      WHERE id = ?
    `, [completedBy, notes, workOrderId]);

    // Update occurrence
    await connection.execute(`
      UPDATE schedule_occurrences SET
        status = 'completed',
        completed_at = NOW(),
        completed_by = ?,
        completion_notes = ?
      WHERE work_order_id = ?
    `, [completedBy, notes, workOrderId]);

    // Notify Manager/FP for verification
    const [wo] = await connection.execute(
      `SELECT franchise_partner_id, title FROM work_orders WHERE id = ?`,
      [workOrderId]
    );
    if (wo.length > 0) {
      await createNotification({
        connection,
        type: 'verification_required',
        title: 'Work Order Needs Verification',
        message: `${wo[0].title} has been completed. Please verify and close.`,
        referenceType: 'work_order',
        referenceId: workOrderId,
        franchisePartnerId: wo[0].franchise_partner_id,
        recipientRoles: ['manager', 'franchise_partner']
      });
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function verifyAndCloseWorkOrder({ workOrderId, verifiedBy, notes }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(`
      UPDATE work_orders SET
        status = 'closed',
        verified_at = NOW(),
        verified_by = ?,
        verification_notes = ?
      WHERE id = ?
    `, [verifiedBy, notes, workOrderId]);

    await connection.execute(`
      UPDATE schedule_occurrences SET
        status = 'verified',
        verified_at = NOW(),
        verified_by = ?,
        verification_notes = ?
      WHERE work_order_id = ?
    `, [verifiedBy, notes, workOrderId]);

    // Update series completed count
    await connection.execute(`
      UPDATE schedule_series ss SET
        completed_visits = (
          SELECT COUNT(*) FROM schedule_occurrences 
          WHERE series_id = ss.id AND status = 'verified'
        )
      WHERE id = (SELECT series_id FROM schedule_occurrences WHERE work_order_id = ?)
    `, [workOrderId]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(date) {
  return new Date(date).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });
}

async function logSeriesHistory(connection, seriesId, action, oldValue, newValue, changedBy) {
  await connection.execute(`
    INSERT INTO schedule_series_history (series_id, action, old_value, new_value, changed_by)
    VALUES ((SELECT id FROM schedule_series WHERE series_id = ? OR id = ?), ?, ?, ?, ?)
  `, [seriesId, seriesId, action, JSON.stringify(oldValue), JSON.stringify(newValue), changedBy]);
}

async function logOccurrenceHistory(connection, occurrenceId, action, oldValue, newValue, reason, changedBy) {
  await connection.execute(`
    INSERT INTO schedule_occurrence_history (occurrence_id, action, old_value, new_value, change_reason, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [occurrenceId, action, JSON.stringify(oldValue), JSON.stringify(newValue), reason, changedBy]);
}

async function createNotification({ connection, type, title, message, referenceType, referenceId, franchisePartnerId, recipientRoles, recipientVendorId }) {
  const notificationId = generateId('NTF');
  await connection.execute(`
    INSERT INTO portal_notifications (
      notification_id, type, title, message, reference_type, reference_id,
      franchise_partner_id, recipient_roles, vendor_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `, [
    notificationId, type, title, message, referenceType, referenceId,
    franchisePartnerId, recipientRoles ? JSON.stringify(recipientRoles) : null,
    recipientVendorId
  ]);
}

module.exports = {
  // Workflow Steps
  markPaymentCompleted,
  assignVendorToService,
  getRecommendedDates,
  confirmSchedule,
  generateWorkOrdersForUpcomingVisits,
  rescheduleOccurrence,
  cancelOccurrence,
  completeWorkOrder,
  verifyAndCloseWorkOrder,
  
  // Config
  FREQUENCY_CONFIG
};
