/**
 * Property Scheduling Service
 * Handles vendor assignment, schedule creation, and work order generation
 */

const { pool } = require('../config/database');

// Generate unique IDs
const generateScheduleId = () => `PSS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
const generateVisitId = () => `VST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
const generateNotificationId = () => `NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

/**
 * Get vendors filtered by service capability, zone, and status
 */
async function getEligibleVendors({ serviceCategory, zone, propertyId }) {
  try {
    let query = `
      SELECT 
        ov.id,
        ov.vendor_id,
        COALESCE(ov.company_name, ov.owner_name) as vendor_name,
        ov.owner_name,
        ov.owner_mobile,
        ov.owner_email,
        ov.service_type,
        ov.service_capabilities,
        ov.zone,
        ov.area_name,
        ov.rate_per_visit,
        ov.rating,
        ov.total_jobs_completed,
        ov.max_daily_visits,
        ov.status
      FROM onboarded_vendors ov
      WHERE ov.status = 'active'
    `;
    const params = [];

    // Filter by service type/capability
    if (serviceCategory) {
      query += ` AND (
        ov.service_type = ? 
        OR ov.service_type LIKE ?
        OR JSON_CONTAINS(ov.service_capabilities, ?)
      )`;
      params.push(serviceCategory, `%${serviceCategory}%`, JSON.stringify(serviceCategory));
    }

    // Filter by zone
    if (zone) {
      query += ` AND (ov.zone = ? OR ov.zone LIKE ? OR JSON_CONTAINS(ov.preferred_zones, ?))`;
      params.push(zone, `%${zone}%`, JSON.stringify(zone));
    }

    query += ` ORDER BY ov.rating DESC, ov.total_jobs_completed DESC`;

    const [vendors] = await pool.execute(query, params);
    return vendors;
  } catch (error) {
    console.error('Error fetching eligible vendors:', error);
    return [];
  }
}

/**
 * Assign vendor to a service for a property
 */
async function assignVendorToService({
  propertyId,
  vendorId,
  serviceType,
  serviceName,
  frequency,
  frequencyCount,
  totalVisits,
  estimateId,
  assignedBy,
  franchisePartnerId
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get vendor details
    const [vendor] = await connection.execute(
      `SELECT id, vendor_id, owner_name FROM onboarded_vendors WHERE id = ?`,
      [vendorId]
    );

    if (vendor.length === 0) {
      throw new Error('Vendor not found');
    }

    // Create or update property_vendor_assignment
    const [existingAssignment] = await connection.execute(
      `SELECT id FROM property_vendor_assignments 
       WHERE property_id = ? AND service_type = ?`,
      [propertyId, serviceType || serviceName]
    );

    if (existingAssignment.length > 0) {
      await connection.execute(
        `UPDATE property_vendor_assignments 
         SET vendor_id = ?, assigned_by = ?, assigned_at = NOW(), is_active = 1
         WHERE property_id = ? AND service_type = ?`,
        [vendorId, assignedBy, propertyId, serviceType || serviceName]
      );
    } else {
      await connection.execute(
        `INSERT INTO property_vendor_assignments 
         (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
         VALUES (?, ?, ?, ?, NOW(), TRUE)`,
        [propertyId, vendorId, serviceType || serviceName, assignedBy]
      );
    }

    // Create property_service_schedule record
    const scheduleId = generateScheduleId();
    const [existingSchedule] = await connection.execute(
      `SELECT id FROM property_service_schedules 
       WHERE property_id = ? AND service_name = ?`,
      [propertyId, serviceName]
    );

    if (existingSchedule.length > 0) {
      await connection.execute(
        `UPDATE property_service_schedules 
         SET vendor_id = ?, vendor_assigned_at = NOW(), vendor_assigned_by = ?,
             status = 'pending_schedule', updated_at = NOW()
         WHERE property_id = ? AND service_name = ?`,
        [vendorId, assignedBy, propertyId, serviceName]
      );
    } else {
      await connection.execute(
        `INSERT INTO property_service_schedules 
         (schedule_id, property_id, estimate_id, service_name, service_category, 
          frequency_type, frequency_count, total_visits, vendor_id, vendor_assigned_at,
          vendor_assigned_by, status, franchise_partner_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'pending_schedule', ?, ?)`,
        [scheduleId, propertyId, estimateId, serviceName, serviceType,
         frequency || 'monthly', frequencyCount || 1, totalVisits || 1,
         vendorId, assignedBy, franchisePartnerId, assignedBy]
      );
    }

    // Update pending_property_schedules
    await updatePendingPropertySchedule(connection, propertyId, estimateId, franchisePartnerId);

    // Check if all vendors are assigned and create notification
    const allAssigned = await checkAllVendorsAssigned(connection, propertyId);
    if (allAssigned) {
      await createSchedulingNotification(connection, {
        propertyId,
        franchisePartnerId,
        type: 'scheduling',
        title: 'New Property Ready for Scheduling',
        actionUrl: `/schedules/pending?propertyId=${propertyId}`
      });
    }

    await connection.commit();

    return {
      success: true,
      vendorName: vendor[0].owner_name,
      scheduleId,
      allVendorsAssigned: allAssigned
    };
  } catch (error) {
    await connection.rollback();
    console.error('Error assigning vendor to service:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update pending_property_schedules table
 */
async function updatePendingPropertySchedule(connection, propertyId, estimateId, franchisePartnerId) {
  // Get total services from estimate
  const [estimate] = await connection.execute(
    `SELECT service_rows FROM fp_estimates WHERE property_id = ? AND status = 'approved' LIMIT 1`,
    [propertyId]
  );

  let totalServices = 0;
  if (estimate.length > 0 && estimate[0].service_rows) {
    try {
      const services = typeof estimate[0].service_rows === 'string' 
        ? JSON.parse(estimate[0].service_rows) 
        : estimate[0].service_rows;
      totalServices = Array.isArray(services) ? services.length : 0;
    } catch (e) {
      console.warn('Error parsing service_rows:', e);
    }
  }

  // Count assigned vendors
  const [[{ assignedCount }]] = await connection.execute(
    `SELECT COUNT(*) as assignedCount FROM property_vendor_assignments 
     WHERE property_id = ? AND is_active = 1`,
    [propertyId]
  );

  // Count scheduled services
  const [[{ scheduledCount }]] = await connection.execute(
    `SELECT COUNT(*) as scheduledCount FROM property_service_schedules 
     WHERE property_id = ? AND status IN ('scheduled', 'active')`,
    [propertyId]
  );

  // Determine status
  let schedulingStatus = 'pending_vendor';
  if (assignedCount >= totalServices && totalServices > 0) {
    schedulingStatus = scheduledCount >= totalServices ? 'fully_scheduled' 
      : scheduledCount > 0 ? 'partially_scheduled' 
      : 'pending_schedule';
  }

  // Upsert pending_property_schedules
  await connection.execute(
    `INSERT INTO pending_property_schedules 
     (property_id, estimate_id, total_services, services_with_vendor, services_scheduled, 
      status, franchise_partner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_services = VALUES(total_services),
       services_with_vendor = VALUES(services_with_vendor),
       services_scheduled = VALUES(services_scheduled),
       status = VALUES(status),
       updated_at = NOW()`,
    [propertyId, estimateId, totalServices, assignedCount, scheduledCount, 
     schedulingStatus, franchisePartnerId]
  );
}

/**
 * Check if all vendors are assigned for a property
 */
async function checkAllVendorsAssigned(connection, propertyId) {
  const [[result]] = await connection.execute(
    `SELECT 
       (SELECT COUNT(*) FROM property_vendor_assignments WHERE property_id = ? AND is_active = 1) as assigned,
       (SELECT JSON_LENGTH(COALESCE(service_rows, '[]')) FROM fp_estimates WHERE property_id = ? AND status = 'approved' LIMIT 1) as total
    `,
    [propertyId, propertyId]
  );

  return result.assigned >= result.total && result.total > 0;
}

/**
 * Create in-portal notification
 */
async function createSchedulingNotification(connection, {
  propertyId,
  franchisePartnerId,
  userId,
  roleType = 'manager',
  type = 'scheduling',
  title,
  message,
  actionUrl,
  priority = 'normal'
}) {
  const notificationId = generateNotificationId();
  
  // Get property details for the notification
  const [property] = await connection.execute(
    `SELECT op.property_id, op.community_name, 
            (SELECT COUNT(*) FROM property_vendor_assignments WHERE property_id = op.id AND is_active = 1) as vendors_assigned,
            (SELECT JSON_LENGTH(COALESCE(fe.service_rows, '[]')) FROM fp_estimates fe WHERE fe.property_id = op.id AND fe.status = 'approved' LIMIT 1) as total_services
     FROM onboarded_properties op WHERE op.id = ?`,
    [propertyId]
  );

  const propertyData = property[0] || {};
  const notificationMessage = message || `Property ${propertyData.property_id} (${propertyData.community_name}) has ${propertyData.vendors_assigned}/${propertyData.total_services} vendors assigned and is ready for scheduling.`;

  await connection.execute(
    `INSERT INTO portal_notifications 
     (notification_id, franchise_partner_id, user_id, role_type, type, title, message,
      reference_type, reference_id, reference_data, action_url, action_label, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'property', ?, ?, ?, 'Schedule Property', ?)`,
    [notificationId, franchisePartnerId, userId, roleType, type, title, notificationMessage,
     propertyId, JSON.stringify({
       propertyId: propertyData.property_id,
       propertyName: propertyData.community_name,
       servicesReady: propertyData.total_services,
       vendorsAssigned: propertyData.vendors_assigned
     }), actionUrl, priority]
  );

  return notificationId;
}

/**
 * Get pending property schedules count (for badge)
 */
async function getPendingSchedulesCount(franchisePartnerId) {
  try {
    let query = `
      SELECT COUNT(*) as count 
      FROM pending_property_schedules pps
      WHERE pps.status IN ('pending_vendor_assignment', 'pending_scheduling', 'partial_vendor_assignment')
    `;
    const params = [];

    if (franchisePartnerId) {
      query += ` AND pps.franchise_partner_id = ?`;
      params.push(franchisePartnerId);
    }

    const [[result]] = await pool.execute(query, params);
    return result.count || 0;
  } catch (error) {
    console.error('Error getting pending schedules count:', error);
    return 0;
  }
}

/**
 * Get pending properties with full details
 */
async function getPendingPropertiesForScheduling(franchisePartnerId, filters = {}) {
  try {
    let query = `
      SELECT DISTINCT
        op.id,
        op.property_id as propertyCode,
        op.community_name as propertyName,
        op.property_type as propertyType,
        op.zone,
        op.area_name as areaName,
        op.created_at as addedOn,
        fe.id as estimateId,
        fe.estimate_id as estimateCode,
        fe.package_name as packageName,
        fe.total_price as totalPrice,
        fe.payment_status as paymentStatus,
        fe.service_rows as serviceRows,
        pc.name as customerName,
        pc.phone as customerPhone,
        pc.email as customerEmail,
        pps.total_services as totalServices,
        pps.services_with_vendor as assignedVendors,
        pps.services_scheduled as scheduledServices,
        pps.status as schedulingStatus,
        pps.notes as notificationNotes
      FROM onboarded_properties op
      INNER JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
      LEFT JOIN property_contacts pc ON pc.property_id = op.id
      LEFT JOIN pending_property_schedules pps ON pps.property_id = op.id
      WHERE op.status = 'active'
        AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
    `;
    const params = [];

    if (franchisePartnerId) {
      query += ` AND op.franchise_partner_id = ?`;
      params.push(franchisePartnerId);
    }

    if (filters.schedulingStatus) {
      query += ` AND pps.status = ?`;
      params.push(filters.schedulingStatus);
    }

    if (filters.zone) {
      query += ` AND op.zone = ?`;
      params.push(filters.zone);
    }

    if (filters.propertyType) {
      query += ` AND op.property_type = ?`;
      params.push(filters.propertyType);
    }

    query += ` ORDER BY op.created_at DESC`;

    const [properties] = await pool.execute(query, params);

    // Process each property to get service details with vendor assignments
    const processedProperties = await Promise.all(properties.map(async (p) => {
      let services = [];
      if (p.serviceRows) {
        try {
          services = typeof p.serviceRows === 'string' ? JSON.parse(p.serviceRows) : p.serviceRows;
        } catch (e) {
          console.warn('Error parsing service rows:', e);
        }
      }

      // Get vendor assignments for this property
      const [assignments] = await pool.execute(
        `SELECT pva.service_type, pva.vendor_id, ov.owner_name as vendorName, ov.vendor_id as vendorCode
         FROM property_vendor_assignments pva
         JOIN onboarded_vendors ov ON ov.id = pva.vendor_id
         WHERE pva.property_id = ? AND pva.is_active = 1`,
        [p.id]
      );

      // Map services with vendor info
      const assignmentMap = {};
      assignments.forEach(a => {
        assignmentMap[a.service_type] = {
          vendorId: a.vendor_id,
          vendorName: a.vendorName,
          vendorCode: a.vendorCode
        };
      });

      const totalServices = Array.isArray(services) ? services.length : 0;
      const assignedVendors = assignments.length;
      const pendingServices = Math.max(0, totalServices - assignedVendors);

      return {
        id: p.id,
        propertyId: p.propertyCode,
        propertyName: p.propertyName,
        customerName: p.customerName || 'N/A',
        customerPhone: p.customerPhone || '',
        customerEmail: p.customerEmail || '',
        propertyType: p.propertyType || 'Apartment',
        zone: p.zone || 'Zone A',
        areaName: p.areaName,
        packageName: p.packageName || 'Custom Package',
        packageType: 'AMC',
        estimateId: p.estimateId,
        estimateCode: p.estimateCode,
        totalPrice: p.totalPrice,
        totalServices,
        assignedVendors: Math.min(assignedVendors, totalServices),
        pendingServices,
        scheduledServices: p.scheduledServices || 0,
        paymentStatus: p.paymentStatus === 'paid' ? 'Paid' : 'Partial',
        schedulingStatus: p.schedulingStatus || (assignedVendors >= totalServices ? 'pending_schedule' : 'pending_vendor'),
        addedOn: p.addedOn,
        isNew: true,
        services: Array.isArray(services) ? services.map(s => {
          const serviceType = s.service || s.name || s.serviceType || 'General';
          const assignment = assignmentMap[serviceType];
          return {
            name: serviceType,
            frequency: s.frequencyType || s.frequency || 'Monthly',
            frequencyCount: s.frequencyCount || 1,
            visits: s.frequencyCount || s.visits || 1,
            vendorAssigned: !!assignment,
            vendorId: assignment?.vendorId || null,
            vendorName: assignment?.vendorName || null,
            vendorCode: assignment?.vendorCode || null
          };
        }) : []
      };
    }));

    return processedProperties;
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    throw error;
  }
}

/**
 * Frequency Configuration - uses First Service Date as recurrence anchor
 * Monthly: 12 visits/year, same day each month
 * Every 2 Months: 6 visits/year, every 2 months from first service date
 * Quarterly: 4 visits/year, every 3 months
 * Half-Yearly: 2 visits/year, every 6 months
 * Yearly: 1 visit/year
 * Customer Requirement / On Request: Manual - no auto generation
 */
const FREQUENCY_CONFIG = {
  'daily': { intervalMonths: 0, intervalDays: 1, visitsPerYear: 365 },
  'weekly': { intervalMonths: 0, intervalDays: 7, visitsPerYear: 52 },
  'bi_weekly': { intervalMonths: 0, intervalDays: 14, visitsPerYear: 26 },
  'monthly': { intervalMonths: 1, intervalDays: 0, visitsPerYear: 12 },
  'every_2_months': { intervalMonths: 2, intervalDays: 0, visitsPerYear: 6 },
  'bi_monthly': { intervalMonths: 2, intervalDays: 0, visitsPerYear: 6 },
  'quarterly': { intervalMonths: 3, intervalDays: 0, visitsPerYear: 4 },
  'half_yearly': { intervalMonths: 6, intervalDays: 0, visitsPerYear: 2 },
  'half-yearly': { intervalMonths: 6, intervalDays: 0, visitsPerYear: 2 },
  'yearly': { intervalMonths: 12, intervalDays: 0, visitsPerYear: 1 },
  'annual': { intervalMonths: 12, intervalDays: 0, visitsPerYear: 1 },
  'one_time': { intervalMonths: 0, intervalDays: 0, visitsPerYear: 1 },
  'customer_requirement': { intervalMonths: 0, intervalDays: 0, visitsPerYear: null, manual: true },
  'on_request': { intervalMonths: 0, intervalDays: 0, visitsPerYear: null, manual: true }
};

/**
 * Generate scheduled visits from a service schedule
 * Uses first service date as the recurrence anchor
 */
async function generateScheduledVisits(serviceScheduleId, startDate, endDate, frequency, totalVisits, customVisitDates = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get service schedule details
    const [schedule] = await connection.execute(
      `SELECT * FROM property_service_schedules WHERE id = ?`,
      [serviceScheduleId]
    );

    if (schedule.length === 0) {
      throw new Error('Service schedule not found');
    }

    const sched = schedule[0];
    const visits = [];
    const firstServiceDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    // Normalize frequency
    const normalizedFrequency = frequency?.toLowerCase()?.replace(/[\s-]/g, '_') || 'monthly';
    const config = FREQUENCY_CONFIG[normalizedFrequency] || FREQUENCY_CONFIG['monthly'];
    
    // Handle manual/customer requirement frequencies
    if (config.manual) {
      if (customVisitDates && Array.isArray(customVisitDates)) {
        // Use provided dates for manual scheduling
        for (let i = 0; i < customVisitDates.length; i++) {
          const visitId = generateVisitId();
          const visitDate = new Date(customVisitDates[i]);
          
          await connection.execute(
            `INSERT INTO scheduled_visits 
             (visit_id, service_schedule_id, property_id, vendor_id, scheduled_date, 
              visit_number, total_visits, status, customer_requested)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', TRUE)`,
            [visitId, serviceScheduleId, sched.property_id, sched.vendor_id, 
             visitDate.toISOString().split('T')[0], i + 1, customVisitDates.length]
          );

          visits.push({
            visitId,
            scheduledDate: visitDate.toISOString().split('T')[0],
            visitNumber: i + 1,
            isManual: true
          });
        }
      }
      // For on_request, no visits are pre-generated
      
      // Update service schedule
      await connection.execute(
        `UPDATE property_service_schedules 
         SET status = 'active', start_date = ?,
             schedule_notes = 'Customer Requirement - visits scheduled manually'
         WHERE id = ?`,
        [startDate, serviceScheduleId]
      );
      
      await connection.commit();
      return visits;
    }
    
    // Calculate number of visits
    const numVisits = totalVisits || config.visitsPerYear || 12;
    let visitNumber = 1;
    
    // Generate visits based on frequency using monthly intervals (accurate recurrence)
    while (visitNumber <= numVisits) {
      const visitDate = new Date(firstServiceDate);
      
      if (config.intervalMonths > 0) {
        // Use month-based calculation for accurate recurrence
        visitDate.setMonth(visitDate.getMonth() + ((visitNumber - 1) * config.intervalMonths));
        
        // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
        const targetDay = firstServiceDate.getDate();
        if (visitDate.getDate() !== targetDay) {
          // Month overflow - set to last day of the intended month
          visitDate.setDate(0);
        }
      } else if (config.intervalDays > 0) {
        // Use day-based calculation for daily/weekly frequencies
        visitDate.setDate(visitDate.getDate() + ((visitNumber - 1) * config.intervalDays));
      }
      
      // Check if within contract period
      if (visitDate > endDateObj) {
        break;
      }
      
      const visitId = generateVisitId();
      
      await connection.execute(
        `INSERT INTO scheduled_visits 
         (visit_id, service_schedule_id, property_id, vendor_id, scheduled_date, 
          visit_number, total_visits, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
        [visitId, serviceScheduleId, sched.property_id, sched.vendor_id, 
         visitDate.toISOString().split('T')[0], visitNumber, numVisits]
      );

      visits.push({
        visitId,
        scheduledDate: visitDate.toISOString().split('T')[0],
        visitNumber,
        dayOfMonth: visitDate.getDate(),
        month: visitDate.toLocaleString('en-US', { month: 'short' }),
        year: visitDate.getFullYear()
      });

      if (config.intervalMonths === 0 && config.intervalDays === 0) break; // one_time
      visitNumber++;
    }

    // Update service schedule status
    await connection.execute(
      `UPDATE property_service_schedules 
       SET status = 'scheduled', start_date = ?, end_date = ?
       WHERE id = ?`,
      [startDate, endDate, serviceScheduleId]
    );

    await connection.commit();
    return visits;
  } catch (error) {
    await connection.rollback();
    console.error('Error generating scheduled visits:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Auto-generate work orders for upcoming scheduled visits
 * Should be called by a cron job (e.g., daily)
 * 
 * Architecture:
 * - Schedule exists for entire contract period
 * - 7 days before scheduled service date → Auto-Create Work Order
 * 
 * Work order includes:
 * - Property ID, Schedule ID, Service, Vendor
 * - Scheduled Date/Time, Property Location, Customer Contact
 * - Service Description, Priority, Frequency/Visit Number (e.g., "Visit 3 of 12")
 */
async function generateWorkOrdersForUpcomingVisits(daysAhead = 7) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get upcoming visits that don't have work orders yet (7 days ahead)
    const [visits] = await connection.execute(
      `SELECT sv.*, 
              pss.service_name, pss.service_category, pss.schedule_id,
              pss.frequency_type, pss.frequency_count,
              op.community_name as property_name, op.property_id as property_code,
              op.address_line1, op.address_line2, op.city, op.state, op.pincode,
              op.zone as property_zone,
              pc.name as customer_name, pc.phone as customer_phone, pc.email as customer_email,
              ov.owner_name as vendor_name, ov.owner_mobile as vendor_phone,
              ov.company_name as vendor_company
       FROM scheduled_visits sv
       JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
       JOIN onboarded_properties op ON op.id = sv.property_id
       LEFT JOIN property_contacts pc ON pc.property_id = op.id
       LEFT JOIN onboarded_vendors ov ON ov.id = sv.vendor_id
       WHERE sv.work_order_id IS NULL
         AND sv.status IN ('scheduled', 'confirmed')
         AND sv.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND sv.scheduled_date >= CURDATE()
       ORDER BY sv.scheduled_date ASC`,
      [daysAhead]
    );

    const generatedWorkOrders = [];

    for (const visit of visits) {
      // Generate unique work order ID
      const workOrderId = `WO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
      
      // Build comprehensive work order description
      const description = `
Scheduled Service Visit - Auto-Generated

Service: ${visit.service_name}
Visit: ${visit.visit_number} of ${visit.total_visits}
Frequency: ${visit.frequency_type || 'Monthly'}

Property: ${visit.property_name} (${visit.property_code})
Location: ${[visit.address_line1, visit.address_line2, visit.city, visit.state, visit.pincode].filter(Boolean).join(', ')}
Zone: ${visit.property_zone || 'N/A'}

Customer Contact: ${visit.customer_name || 'N/A'} | ${visit.customer_phone || 'N/A'}

Vendor: ${visit.vendor_company || visit.vendor_name}
Vendor Contact: ${visit.vendor_phone || 'N/A'}

Schedule Reference: ${visit.schedule_id || 'N/A'}
      `.trim();

      // Determine priority based on visit number
      let priority = 'medium';
      if (visit.visit_number === 1) priority = 'high'; // First visit is high priority
      if (visit.visit_number === visit.total_visits) priority = 'high'; // Last visit is high priority
      
      const [result] = await connection.execute(
        `INSERT INTO work_orders 
         (work_order_id, property_id, category_name, subcategory_name, title, description, 
          scheduled_date, scheduled_time, assigned_vendor_id, priority, status, 
          visit_number, total_visits, schedule_reference, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?, ?, 1, NOW())`,
        [
          workOrderId, 
          visit.property_id, 
          visit.service_category || visit.service_name,
          visit.service_name,
          `${visit.service_name} Service - Visit ${visit.visit_number}/${visit.total_visits}`,
          description,
          visit.scheduled_date, 
          visit.scheduled_time_start || '10:00:00',
          visit.vendor_id,
          priority,
          visit.visit_number,
          visit.total_visits,
          visit.schedule_id || `PSS-${visit.service_schedule_id}`
        ]
      );

      // Update scheduled visit with work order reference and status
      await connection.execute(
        `UPDATE scheduled_visits 
         SET work_order_id = ?, 
             work_order_generated_at = NOW(),
             status = 'work_order_created'
         WHERE id = ?`,
        [result.insertId, visit.id]
      );

      // Create vendor notification for the new work order
      if (visit.vendor_id) {
        const notificationId = generateNotificationId();
        const scheduledDateStr = new Date(visit.scheduled_date).toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric', year: 'numeric' 
        });
        const scheduledTime = visit.scheduled_time_start 
          ? new Date(`2000-01-01T${visit.scheduled_time_start}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          : '10:00 AM';
        
        await connection.execute(
          `INSERT INTO portal_notifications 
           (notification_id, user_id, franchise_partner_id, role_type, type, title, message,
            reference_type, reference_id, reference_data, action_url, action_label, priority)
           VALUES (?, ?, ?, 'vendor', 'work_order', ?, ?, 'work_order', ?, ?, ?, 'View Details', ?)`,
          [
            notificationId,
            null, // Will be linked to vendor user if exists
            null,
            'New Work Order Available',
            `${workOrderId}\n${visit.service_name} Service\n${visit.property_name}\n${scheduledDateStr}, ${scheduledTime}`,
            result.insertId,
            JSON.stringify({
              workOrderId,
              workOrderDbId: result.insertId,
              serviceName: visit.service_name,
              propertyName: visit.property_name,
              propertyCode: visit.property_code,
              scheduledDate: visit.scheduled_date,
              scheduledTime,
              vendorId: visit.vendor_id,
              visitNumber: visit.visit_number,
              totalVisits: visit.total_visits
            }),
            `/vendor/work-orders/${result.insertId}`,
            priority === 'high' ? 'high' : 'normal'
          ]
        );

        // Also insert into vendor_notifications table if it exists
        try {
          await connection.execute(
            `INSERT INTO vendor_notifications 
             (vendor_id, notification_type, title, message, work_order_id, is_read, created_at)
             VALUES (?, 'work_order', ?, ?, ?, FALSE, NOW())`,
            [
              visit.vendor_id,
              'New Work Order Available',
              `${workOrderId} - ${visit.service_name} Service at ${visit.property_name} on ${scheduledDateStr}, ${scheduledTime}`,
              result.insertId
            ]
          );
        } catch (e) {
          // Table might not exist, ignore
          console.log('vendor_notifications table not available');
        }
      }

      generatedWorkOrders.push({
        workOrderId,
        workOrderDbId: result.insertId,
        visitId: visit.visit_id,
        scheduledDate: visit.scheduled_date,
        serviceName: visit.service_name,
        visitNumber: visit.visit_number,
        totalVisits: visit.total_visits,
        propertyCode: visit.property_code,
        propertyName: visit.property_name,
        vendorName: visit.vendor_name,
        vendorId: visit.vendor_id,
        priority,
        notificationSent: !!visit.vendor_id
      });
    }

    await connection.commit();
    
    console.log(`Generated ${generatedWorkOrders.length} work orders for upcoming visits`);
    return generatedWorkOrders;
  } catch (error) {
    await connection.rollback();
    console.error('Error generating work orders:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get unread notifications for a user/FP
 */
async function getUnreadNotifications(franchisePartnerId, userId, roleType, limit = 10) {
  try {
    let query = `
      SELECT * FROM portal_notifications 
      WHERE is_read = FALSE AND is_dismissed = FALSE
    `;
    const params = [];

    if (franchisePartnerId) {
      query += ` AND franchise_partner_id = ?`;
      params.push(franchisePartnerId);
    }

    if (userId) {
      query += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }

    if (roleType) {
      query += ` AND role_type = ?`;
      params.push(roleType);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const [notifications] = await pool.execute(query, params);
    return notifications;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(notificationId) {
  try {
    await pool.execute(
      `UPDATE portal_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? OR notification_id = ?`,
      [notificationId, notificationId]
    );
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

module.exports = {
  getEligibleVendors,
  assignVendorToService,
  getPendingSchedulesCount,
  getPendingPropertiesForScheduling,
  generateScheduledVisits,
  generateWorkOrdersForUpcomingVisits,
  getUnreadNotifications,
  markNotificationRead,
  createSchedulingNotification,
  updatePendingPropertySchedule
};
