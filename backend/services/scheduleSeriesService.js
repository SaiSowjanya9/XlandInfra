/**
 * Schedule Series & Occurrences Service
 * Implements the proper scheduling hierarchy:
 * Property → Estimate → Invoice → Payment → Property Service → Vendor Assignment → Schedule Series → Schedule Occurrences → Work Orders
 */

const { pool } = require('../config/database');

// Generate unique IDs
const generateSeriesId = () => `SER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
const generateOccurrenceId = (seriesPrefix, visitNumber) => `${seriesPrefix}-${String(visitNumber).padStart(2, '0')}`;
const generateWorkOrderId = () => `WO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Frequency to days mapping
const FREQUENCY_DAYS = {
  'daily': 1,
  'weekly': 7,
  'bi_weekly': 14,
  'monthly': 30,
  'every_2_months': 60,
  'quarterly': 90,
  'half_yearly': 180,
  'yearly': 365,
  'one_time': 0
};

/**
 * Create a new Schedule Series
 */
async function createScheduleSeries({
  propertyId,
  estimateId,
  invoiceId,
  packageId,
  serviceId,
  serviceName,
  serviceCategory,
  vendorId,
  frequency,
  frequencyDetails,
  totalVisits,
  contractStartDate,
  contractEndDate,
  preferredDayOfWeek,
  preferredTimeSlot,
  scheduleNotes,
  zoneId,
  zoneName,
  franchisePartnerId,
  createdBy
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const seriesId = generateSeriesId();

    // Get vendor details
    let vendorName = null;
    if (vendorId) {
      const [vendor] = await connection.execute(
        `SELECT COALESCE(company_name, owner_name) as name FROM onboarded_vendors WHERE id = ?`,
        [vendorId]
      );
      if (vendor.length > 0) vendorName = vendor[0].name;
    }

    // Insert Schedule Series
    const [result] = await connection.execute(`
      INSERT INTO schedule_series (
        series_id, property_id, estimate_id, invoice_id, package_id, service_id,
        service_name, service_category, vendor_id, vendor_name, vendor_assigned_at,
        vendor_assigned_by, frequency, frequency_details, total_visits,
        contract_start_date, contract_end_date, preferred_day_of_week,
        preferred_time_slot, schedule_notes, zone_id, zone_name,
        status, franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      seriesId, propertyId, estimateId, invoiceId, packageId, serviceId,
      serviceName, serviceCategory, vendorId, vendorName, vendorId ? new Date() : null,
      vendorId ? createdBy : null, frequency, JSON.stringify(frequencyDetails), totalVisits,
      contractStartDate, contractEndDate, preferredDayOfWeek,
      preferredTimeSlot, scheduleNotes, zoneId, zoneName,
      vendorId ? 'pending_schedule' : 'pending_vendor', franchisePartnerId, createdBy
    ]);

    // Log history
    await connection.execute(`
      INSERT INTO schedule_series_history (series_id, action, new_value, changed_by)
      VALUES (?, 'created', ?, ?)
    `, [result.insertId, JSON.stringify({ series_id: seriesId, service_name: serviceName }), createdBy]);

    await connection.commit();
    return { success: true, seriesId, id: result.insertId };
  } catch (error) {
    await connection.rollback();
    console.error('Error creating schedule series:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Generate Schedule Occurrences for a Series
 * Uses smart date recommendations based on vendor zone availability
 */
async function generateScheduleOccurrences({
  seriesId,
  startDate,
  frequency,
  totalVisits,
  vendorId,
  zoneId,
  zoneName,
  preferredDayOfWeek,
  preferredTimeSlot,
  createdBy
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
    const frequencyDays = FREQUENCY_DAYS[frequency] || 30;

    const occurrences = [];
    let currentDate = new Date(startDate);

    for (let visitNum = 1; visitNum <= totalVisits; visitNum++) {
      // Get recommended date based on vendor zone availability
      const recommendedDate = await getRecommendedDate({
        connection,
        vendorId: vendorId || seriesData.vendor_id,
        zoneId: zoneId || seriesData.zone_id,
        zoneName: zoneName || seriesData.zone_name,
        targetDate: currentDate,
        preferredDayOfWeek
      });

      const occurrenceId = generateOccurrenceId(seriesPrefix, visitNum);
      
      // Parse time slot
      let startTime = '09:00:00';
      let endTime = '11:00:00';
      if (preferredTimeSlot) {
        const [start, end] = preferredTimeSlot.split('-').map(t => t.trim());
        if (start) startTime = convertTo24Hour(start);
        if (end) endTime = convertTo24Hour(end);
      }

      // Insert occurrence
      await connection.execute(`
        INSERT INTO schedule_occurrences (
          occurrence_id, series_id, visit_number, target_date, scheduled_date,
          scheduled_time_start, scheduled_time_end, vendor_id, vendor_name,
          zone_id, zone_name, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
      `, [
        occurrenceId, seriesId, visitNum,
        formatDate(currentDate), formatDate(recommendedDate.date),
        startTime, endTime,
        vendorId || seriesData.vendor_id, seriesData.vendor_name,
        zoneId || seriesData.zone_id, zoneName || seriesData.zone_name
      ]);

      occurrences.push({
        occurrenceId,
        visitNumber: visitNum,
        targetDate: currentDate.toISOString().split('T')[0],
        scheduledDate: recommendedDate.date.toISOString().split('T')[0],
        recommendation: recommendedDate.reason
      });

      // Update vendor zone schedule count
      await updateVendorZoneSchedule(connection, vendorId || seriesData.vendor_id, zoneId, zoneName, recommendedDate.date);

      // Move to next target date
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + frequencyDays);
    }

    // Update series status
    await connection.execute(
      `UPDATE schedule_series SET status = 'active', completed_visits = 0 WHERE id = ?`,
      [seriesId]
    );

    await connection.commit();
    return { success: true, occurrences };
  } catch (error) {
    await connection.rollback();
    console.error('Error generating schedule occurrences:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get Recommended Date based on vendor zone availability
 * Prioritizes dates where vendor already has jobs in the same zone
 */
async function getRecommendedDate({ connection, vendorId, zoneId, zoneName, targetDate, preferredDayOfWeek }) {
  const target = new Date(targetDate);
  const searchStart = new Date(target);
  searchStart.setDate(searchStart.getDate() - 7); // Look 7 days before
  const searchEnd = new Date(target);
  searchEnd.setDate(searchEnd.getDate() + 14); // Look 14 days after

  try {
    // Get vendor's existing jobs in the zone during the search window
    const [existingJobs] = await connection.execute(`
      SELECT 
        so.scheduled_date,
        COUNT(*) as job_count
      FROM schedule_occurrences so
      JOIN schedule_series ss ON so.series_id = ss.id
      WHERE so.vendor_id = ?
        AND (ss.zone_id = ? OR ss.zone_name = ?)
        AND so.scheduled_date BETWEEN ? AND ?
        AND so.status IN ('scheduled', 'confirmed', 'work_order_created')
      GROUP BY so.scheduled_date
      ORDER BY job_count DESC, so.scheduled_date ASC
    `, [vendorId, zoneId, zoneName, formatDate(searchStart), formatDate(searchEnd)]);

    // If vendor has existing jobs in zone, recommend the busiest day (consolidation)
    if (existingJobs.length > 0) {
      const bestDate = new Date(existingJobs[0].scheduled_date);
      return {
        date: bestDate,
        reason: `Recommended: Vendor already has ${existingJobs[0].job_count} job(s) in ${zoneName || 'this zone'} on this date`
      };
    }

    // Check vendor's overall availability on target date
    const [vendorLoad] = await connection.execute(`
      SELECT COUNT(*) as total_jobs
      FROM schedule_occurrences so
      WHERE so.vendor_id = ?
        AND so.scheduled_date = ?
        AND so.status IN ('scheduled', 'confirmed', 'work_order_created')
    `, [vendorId, formatDate(target)]);

    // If vendor has capacity, use target date
    const maxDailyJobs = 8; // Default max jobs per day
    if (vendorLoad[0].total_jobs < maxDailyJobs) {
      return {
        date: target,
        reason: `Target date available: Vendor has ${vendorLoad[0].total_jobs} job(s) scheduled`
      };
    }

    // Find next available date
    let checkDate = new Date(target);
    for (let i = 0; i < 14; i++) {
      checkDate.setDate(checkDate.getDate() + 1);
      const [load] = await connection.execute(`
        SELECT COUNT(*) as total_jobs
        FROM schedule_occurrences so
        WHERE so.vendor_id = ?
          AND so.scheduled_date = ?
          AND so.status IN ('scheduled', 'confirmed', 'work_order_created')
      `, [vendorId, formatDate(checkDate)]);

      if (load[0].total_jobs < maxDailyJobs) {
        return {
          date: checkDate,
          reason: `Next available date: ${formatDate(checkDate)}`
        };
      }
    }

    // Fallback to target date
    return { date: target, reason: 'Default target date (vendor fully booked)' };
  } catch (error) {
    console.error('Error getting recommended date:', error);
    return { date: target, reason: 'Default target date' };
  }
}

/**
 * Update vendor zone schedule count
 */
async function updateVendorZoneSchedule(connection, vendorId, zoneId, zoneName, date) {
  try {
    await connection.execute(`
      INSERT INTO vendor_zone_schedule (vendor_id, zone_id, zone_name, scheduled_date, job_count)
      VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE job_count = job_count + 1, updated_at = NOW()
    `, [vendorId, zoneId, zoneName, formatDate(date)]);
  } catch (error) {
    // Table might not exist yet, ignore error
    console.warn('Could not update vendor_zone_schedule:', error.message);
  }
}

/**
 * Reschedule a single occurrence
 */
async function rescheduleOccurrence({
  occurrenceId,
  newDate,
  newTimeStart,
  newTimeEnd,
  reason,
  scope = 'this_visit_only',
  rescheduledBy
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get current occurrence
    const [occurrence] = await connection.execute(
      `SELECT * FROM schedule_occurrences WHERE id = ?`,
      [occurrenceId]
    );
    if (occurrence.length === 0) throw new Error('Occurrence not found');

    const current = occurrence[0];
    const oldDate = current.scheduled_date;
    const oldTimeStart = current.scheduled_time_start;

    if (scope === 'this_visit_only') {
      // Reschedule only this occurrence
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
      `, [newDate, newTimeStart, newTimeEnd, oldDate, oldTimeStart, rescheduledBy, reason, occurrenceId]);

      // Log history
      await connection.execute(`
        INSERT INTO schedule_occurrence_history (occurrence_id, action, old_value, new_value, change_reason, changed_by)
        VALUES (?, 'rescheduled', ?, ?, ?, ?)
      `, [
        occurrenceId, 
        JSON.stringify({ date: oldDate, time: oldTimeStart }),
        JSON.stringify({ date: newDate, time: newTimeStart }),
        reason, rescheduledBy
      ]);
    } else {
      // Reschedule this and all future occurrences
      const daysDiff = Math.floor((new Date(newDate) - new Date(oldDate)) / (1000 * 60 * 60 * 24));

      // Get all future occurrences in this series
      const [futureOccurrences] = await connection.execute(`
        SELECT id, scheduled_date FROM schedule_occurrences
        WHERE series_id = ? AND visit_number >= ? AND status NOT IN ('completed', 'cancelled')
        ORDER BY visit_number
      `, [current.series_id, current.visit_number]);

      for (const occ of futureOccurrences) {
        const newOccDate = new Date(occ.scheduled_date);
        newOccDate.setDate(newOccDate.getDate() + daysDiff);

        await connection.execute(`
          UPDATE schedule_occurrences SET
            scheduled_date = ?,
            scheduled_time_start = ?,
            scheduled_time_end = ?,
            rescheduled_from_date = scheduled_date,
            rescheduled_by = ?,
            rescheduled_at = NOW(),
            reschedule_reason = ?,
            reschedule_scope = 'this_and_future',
            status = CASE WHEN status = 'scheduled' THEN 'rescheduled' ELSE status END
          WHERE id = ?
        `, [formatDate(newOccDate), newTimeStart, newTimeEnd, rescheduledBy, reason, occ.id]);
      }
    }

    await connection.commit();
    return { success: true, message: scope === 'this_visit_only' ? 'Visit rescheduled' : 'This and future visits rescheduled' };
  } catch (error) {
    await connection.rollback();
    console.error('Error rescheduling occurrence:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Cancel an occurrence
 */
async function cancelOccurrence({ occurrenceId, reason, cancelledBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      UPDATE schedule_occurrences SET
        status = 'cancelled',
        cancelled_by = ?,
        cancelled_at = NOW(),
        cancellation_reason = ?
      WHERE id = ?
    `, [cancelledBy, reason, occurrenceId]);

    await connection.execute(`
      INSERT INTO schedule_occurrence_history (occurrence_id, action, change_reason, changed_by)
      VALUES (?, 'cancelled', ?, ?)
    `, [occurrenceId, reason, cancelledBy]);

    return { success: true };
  } finally {
    connection.release();
  }
}

/**
 * Get upcoming occurrences for a vendor with zone grouping
 */
async function getVendorOccurrences({ vendorId, startDate, endDate, zoneId }) {
  let query = `
    SELECT 
      so.*,
      ss.service_name,
      ss.service_category,
      ss.frequency,
      ss.total_visits AS series_total_visits,
      op.property_name,
      op.property_address,
      op.customer_name,
      op.customer_phone
    FROM schedule_occurrences so
    JOIN schedule_series ss ON so.series_id = ss.id
    LEFT JOIN onboarded_properties op ON ss.property_id = op.id
    WHERE so.vendor_id = ?
      AND so.scheduled_date BETWEEN ? AND ?
      AND so.status IN ('scheduled', 'confirmed', 'work_order_created', 'in_progress')
  `;
  const params = [vendorId, startDate, endDate];

  if (zoneId) {
    query += ` AND so.zone_id = ?`;
    params.push(zoneId);
  }

  query += ` ORDER BY so.scheduled_date, so.scheduled_time_start`;

  const [occurrences] = await pool.execute(query, params);
  return occurrences;
}

/**
 * Get schedule recommendations for smart scheduling
 */
async function getScheduleRecommendations({ propertyId, serviceId, vendorId, zoneName, targetMonth }) {
  const [recommendations] = await pool.execute(`
    SELECT 
      so.scheduled_date,
      COUNT(*) as existing_jobs,
      GROUP_CONCAT(DISTINCT ss.service_name ORDER BY ss.service_name SEPARATOR ', ') as services
    FROM schedule_occurrences so
    JOIN schedule_series ss ON so.series_id = ss.id
    WHERE so.vendor_id = ?
      AND ss.zone_name = ?
      AND MONTH(so.scheduled_date) = MONTH(?)
      AND YEAR(so.scheduled_date) = YEAR(?)
      AND so.status IN ('scheduled', 'confirmed', 'work_order_created')
    GROUP BY so.scheduled_date
    ORDER BY existing_jobs DESC
  `, [vendorId, zoneName, targetMonth, targetMonth]);

  return recommendations.map(r => ({
    date: r.scheduled_date,
    existingJobs: r.existing_jobs,
    services: r.services,
    recommended: r.existing_jobs > 0,
    reason: r.existing_jobs > 0 
      ? `Vendor has ${r.existing_jobs} existing job(s) in ${zoneName}. Consolidate trips!`
      : 'No existing jobs in zone'
  }));
}

// Helper functions
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function convertTo24Hour(time12h) {
  if (!time12h) return '09:00:00';
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  hours = parseInt(hours);
  if (modifier?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (modifier?.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes || '00'}:00`;
}

module.exports = {
  createScheduleSeries,
  generateScheduleOccurrences,
  getRecommendedDate,
  rescheduleOccurrence,
  cancelOccurrence,
  getVendorOccurrences,
  getScheduleRecommendations,
  generateSeriesId,
  generateOccurrenceId
};
