/**
 * Schedules Routes
 * RBAC: Admin - full access, Manager - create after estimate/package, Supervisor - view only
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { 
  adminOnly,
  managerOrAdmin,
  canMakeSchedule,
  canSeeSchedule,
  ROLES
} = require('../middleware/rbac');

// Generate unique schedule ID
const generateScheduleId = () => {
  const prefix = 'SCH';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Get all schedules (Admin, Manager full access; Supervisor view only)
router.get('/', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { status, propertyId, fpId } = req.query;
    
    // Get FP scope for non-admin users
    const userFpId = req.user?.franchisePartnerId || req.user?.fpId;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'operations_manager';
    
    let query = `
      SELECT s.*, 
             COALESCE(op.community_name, p.name) as property_name, 
             COALESCE(op.property_id, p.property_id) as property_code,
             COALESCE(op.property_type, p.property_type) as property_type,
             op.zone as zone,
             COALESCE(op.city, p.city) as city,
             op.franchise_partner_id as fp_id,
             fe.estimate_id as fp_estimate_id, fe.title as fp_estimate_title,
             fe.service_category,
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM schedules s
      LEFT JOIN onboarded_properties op ON s.property_id = op.id
      LEFT JOIN properties p ON s.property_id = p.id
      LEFT JOIN fp_estimates fe ON s.estimate_id = fe.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by FP - for non-admin users use their FP, for admin use query param
    if (userFpId) {
      query += ` AND op.franchise_partner_id = ?`;
      params.push(userFpId);
    } else if (isAdmin && fpId) {
      query += ` AND op.franchise_partner_id = ?`;
      params.push(fpId);
    }

    if (status) {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    if (propertyId) {
      query += ` AND s.property_id = ?`;
      params.push(propertyId);
    }

    query += ` ORDER BY s.start_date DESC`;

    const [schedules] = await pool.execute(query, params);

    res.json({
      success: true,
      data: schedules.map(s => ({
        id: s.id,
        scheduleId: s.schedule_id,
        estimateId: s.estimate_id || s.fp_estimate_id,
        estimateTitle: s.fp_estimate_title,
        packageId: s.package_id,
        propertyId: s.property_id,
        propertyName: s.property_name,
        propertyCode: s.property_code,
        propertyType: s.property_type,
        zone: s.zone,
        city: s.city,
        serviceCategory: s.service_category,
        title: s.title,
        description: s.description,
        startDate: s.start_date,
        endDate: s.end_date,
        frequency: s.frequency,
        frequencyDetails: s.frequency_details,
        status: s.status,
        createdBy: s.created_by_name,
        createdAt: s.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedules',
      error: error.message
    });
  }
});

// Get dashboard statistics - MUST be before /:id route
router.get('/dashboard/stats', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { startDate, endDate, zone } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate) {
      dateFilter += ' AND s.start_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND s.start_date <= ?';
      params.push(endDate);
    }

    // Get all schedules with property info
    const [schedules] = await pool.execute(
      `SELECT s.*, 
              COALESCE(op.community_name, p.name) as property_name, 
              COALESCE(op.property_id, p.property_id) as property_code,
              COALESCE(op.property_type, p.property_type) as property_type,
              op.zone as zone,
              COALESCE(op.city, p.city) as city,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
              fe.title as estimate_title,
              fe.service_category
       FROM schedules s
       LEFT JOIN onboarded_properties op ON s.property_id = op.id
       LEFT JOIN properties p ON s.property_id = p.id
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN fp_estimates fe ON s.estimate_id = fe.id
       WHERE 1=1 ${dateFilter}
       ORDER BY s.start_date DESC`,
      params
    );

    // Calculate statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = {
      total: schedules.length,
      byStatus: {},
      byPropertyType: {},
      byServiceCategory: {},
      todaysSchedules: [],
      upcomingSchedules: [],
      unscheduled: []
    };

    // Status counts
    const statusCounts = {
      active: 0,
      draft: 0,
      completed: 0,
      cancelled: 0,
      paused: 0,
      rescheduled: 0,
      in_progress: 0
    };

    // Property type counts
    const propertyTypeCounts = {};
    
    // Service category counts
    const serviceCategoryCounts = {};

    schedules.forEach(s => {
      const status = (s.status || 'draft').toLowerCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Property type
      const propType = s.property_type || 'Other';
      propertyTypeCounts[propType] = (propertyTypeCounts[propType] || 0) + 1;

      // Service category
      const category = s.service_category || s.title?.split(' ')[0] || 'General';
      serviceCategoryCounts[category] = (serviceCategoryCounts[category] || 0) + 1;

      // Today's schedules
      if (s.start_date) {
        const sDate = new Date(s.start_date);
        sDate.setHours(0, 0, 0, 0);
        
        if (sDate.getTime() === today.getTime()) {
          stats.todaysSchedules.push({
            id: s.id,
            scheduleId: s.schedule_id,
            title: s.title,
            description: s.description,
            startDate: s.start_date,
            status: s.status,
            propertyName: s.property_name,
            propertyType: s.property_type
          });
        }

        // Upcoming (next 7 days)
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);
        
        if (sDate > today && sDate <= next7Days) {
          stats.upcomingSchedules.push({
            id: s.id,
            scheduleId: s.schedule_id,
            title: s.title,
            startDate: s.start_date,
            status: s.status,
            propertyName: s.property_name
          });
        }
      }

      // Unscheduled (drafts)
      if (status === 'draft' || !s.start_date) {
        stats.unscheduled.push({
          id: s.id,
          scheduleId: s.schedule_id,
          title: s.title,
          status: s.status
        });
      }
    });

    stats.byStatus = statusCounts;
    stats.byPropertyType = propertyTypeCounts;
    stats.byServiceCategory = serviceCategoryCounts;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching schedule stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedule statistics',
      error: error.message
    });
  }
});

// Get pending properties for scheduling - MUST be before /:id route
// Returns properties that are paid and have vendors assigned but not yet scheduled
router.get('/pending-properties', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const userFpId = req.user?.franchisePartnerId || req.user?.fpId;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'operations_manager';
    
    // Query to get properties with:
    // 1. Approved/paid estimates (payment_status = 'paid')
    // 2. Vendor assignments (from property_vendor_assignments)
    // 3. Not yet scheduled (no active schedule exists)
    let query = `
      SELECT DISTINCT
        op.id,
        op.property_id as propertyId,
        op.community_name as propertyName,
        op.property_type as propertyType,
        op.zone,
        op.area_name as areaName,
        op.created_at as addedOn,
        fe.id as estimateId,
        fe.estimate_id as estimateCode,
        fe.package_name as packageName,
        fe.total_price as totalPrice,
        fe.status as estimateStatus,
        fe.payment_status as paymentStatus,
        fe.service_rows as serviceRows,
        pc.name as customerName,
        pc.phone as customerPhone,
        pc.email as customerEmail,
        (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) as assignedVendors,
        (SELECT COUNT(*) FROM schedules s WHERE s.property_id = op.id AND s.status IN ('active', 'draft')) as existingSchedules
      FROM onboarded_properties op
      LEFT JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
      LEFT JOIN property_contacts pc ON pc.property_id = op.id
      WHERE op.status = 'active'
        AND fe.id IS NOT NULL
        AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
    `;
    
    const params = [];
    
    // Filter by FP for non-admin users
    if (userFpId) {
      query += ` AND op.franchise_partner_id = ?`;
      params.push(userFpId);
    }
    
    // Exclude properties that already have active schedules
    query += ` HAVING existingSchedules = 0`;
    query += ` ORDER BY op.created_at DESC`;

    const [properties] = await pool.execute(query, params);

    // Parse service rows and calculate service counts
    const processedProperties = properties.map(p => {
      let services = [];
      let totalServices = 0;
      
      // Parse service_rows JSON
      if (p.serviceRows) {
        try {
          services = typeof p.serviceRows === 'string' ? JSON.parse(p.serviceRows) : p.serviceRows;
          totalServices = Array.isArray(services) ? services.length : 0;
        } catch (e) {
          console.warn('Error parsing service rows:', e);
        }
      }
      
      const assignedVendors = p.assignedVendors || 0;
      const pendingServices = Math.max(0, totalServices - assignedVendors);
      
      return {
        id: p.id,
        propertyId: p.propertyId,
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
        totalServices: totalServices,
        assignedVendors: Math.min(assignedVendors, totalServices),
        pendingServices: pendingServices,
        paymentStatus: p.paymentStatus === 'paid' ? 'Paid' : 'Partial',
        addedOn: p.addedOn,
        isNew: true, // Mark as new for UI badge
        services: services.map(s => ({
          name: s.service || s.name || s.serviceType,
          frequency: s.frequencyType || 'Monthly',
          frequencyCount: s.frequencyCount || 1,
          visits: s.frequencyCount || 1,
          vendorAssigned: false,
          vendorName: null
        }))
      };
    });

    res.json({
      success: true,
      data: processedProperties
    });
  } catch (error) {
    console.error('Error fetching pending properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending properties',
      error: error.message
    });
  }
});

// Get single schedule (Admin, Manager, Supervisor can view)
router.get('/:id', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { id } = req.params;

    const [schedules] = await pool.execute(
      `SELECT s.*, 
              COALESCE(op.community_name, p.name) as property_name, 
              COALESCE(op.property_id, p.property_id) as property_code,
              COALESCE(op.property_type, p.property_type) as property_type,
              fe.estimate_id as fp_estimate_id, fe.title as fp_estimate_title,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM schedules s
       LEFT JOIN onboarded_properties op ON s.property_id = op.id
       LEFT JOIN properties p ON s.property_id = p.id
       LEFT JOIN fp_estimates fe ON s.estimate_id = fe.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = ?`,
      [id]
    );

    if (schedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    const s = schedules[0];
    res.json({
      success: true,
      data: {
        id: s.id,
        scheduleId: s.schedule_id,
        estimateId: s.estimate_id || s.fp_estimate_id,
        estimateTitle: s.fp_estimate_title,
        packageId: s.package_id,
        propertyId: s.property_id,
        propertyName: s.property_name,
        propertyType: s.property_type,
        title: s.title,
        description: s.description,
        startDate: s.start_date,
        endDate: s.end_date,
        frequency: s.frequency,
        frequencyDetails: s.frequency_details,
        status: s.status,
        createdBy: s.created_by_name,
        createdAt: s.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedule',
      error: error.message
    });
  }
});

// Create schedule (Admin, Manager only - after estimate/package creation)
router.post('/', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { 
      estimateId, packageId, propertyId, title, description,
      startDate, endDate, frequency, frequencyDetails
    } = req.body;

    if (!propertyId || !title || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Property, title, and start date are required'
      });
    }

    // Verify estimate is approved if estimateId is provided
    if (estimateId) {
      const [estimates] = await pool.execute(
        `SELECT status FROM estimates WHERE id = ?`,
        [estimateId]
      );
      
      if (estimates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Estimate not found'
        });
      }
      
      if (estimates[0].status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Schedule can only be created for approved estimates'
        });
      }
    }

    const scheduleId = generateScheduleId();

    const [result] = await pool.execute(
      `INSERT INTO schedules (
        schedule_id, estimate_id, package_id, property_id, title, description,
        start_date, end_date, frequency, frequency_details, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId, estimateId || null, packageId || null, propertyId, title, description || null,
        startDate, endDate || null, frequency || 'one_time', 
        frequencyDetails ? JSON.stringify(frequencyDetails) : null,
        req.user.id
      ]
    );

    // Estimate status stays as 'approved' - no need to change it

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: {
        id: result.insertId,
        scheduleId
      }
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating schedule',
      error: error.message
    });
  }
});

// Update schedule (Admin, Manager only)
router.put('/:id', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, startDate, endDate, frequency, frequencyDetails, status
    } = req.body;

    const [result] = await pool.execute(
      `UPDATE schedules SET 
        title = COALESCE(?, title),
        description = ?,
        start_date = COALESCE(?, start_date),
        end_date = ?,
        frequency = COALESCE(?, frequency),
        frequency_details = ?,
        status = COALESCE(?, status)
       WHERE id = ?`,
      [
        title, description, startDate, endDate, frequency,
        frequencyDetails ? JSON.stringify(frequencyDetails) : null,
        status, id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.json({
      success: true,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating schedule',
      error: error.message
    });
  }
});

// Activate schedule (Admin, Manager)
router.post('/:id/activate', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE schedules SET status = 'active' WHERE id = ? AND status = 'draft'`,
      [id]
    );

    res.json({
      success: true,
      message: 'Schedule activated'
    });
  } catch (error) {
    console.error('Error activating schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error activating schedule',
      error: error.message
    });
  }
});

// Pause schedule (Admin, Manager)
router.post('/:id/pause', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE schedules SET status = 'paused' WHERE id = ? AND status = 'active'`,
      [id]
    );

    res.json({
      success: true,
      message: 'Schedule paused'
    });
  } catch (error) {
    console.error('Error pausing schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error pausing schedule',
      error: error.message
    });
  }
});

// Cancel schedule (Admin only)
router.post('/:id/cancel', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE schedules SET status = 'cancelled' WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Schedule cancelled'
    });
  } catch (error) {
    console.error('Error cancelling schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling schedule',
      error: error.message
    });
  }
});

// Delete schedule (Admin only - if draft)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `DELETE FROM schedules WHERE id = ? AND status = 'draft'`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active or completed schedules'
      });
    }

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting schedule',
      error: error.message
    });
  }
});

// ============================================
// ENHANCED SCHEDULING ROUTES (V22)
// ============================================

const schedulingService = require('../services/schedulingService');

// Get eligible vendors for a service (filtered by capability, zone, status)
router.get('/eligible-vendors', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { serviceCategory, zone, propertyId } = req.query;
    
    const vendors = await schedulingService.getEligibleVendors({
      serviceCategory,
      zone,
      propertyId
    });

    // If no vendors found, return appropriate message
    if (vendors.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No Vendor Available'
      });
    }

    res.json({
      success: true,
      data: vendors.map(v => ({
        id: v.id,
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        ownerName: v.owner_name,
        ownerMobile: v.owner_mobile,
        ownerEmail: v.owner_email,
        serviceType: v.service_type,
        serviceCapabilities: v.service_capabilities,
        zone: v.zone,
        areaName: v.area_name,
        ratePerVisit: v.rate_per_visit,
        rating: v.rating,
        totalJobsCompleted: v.total_jobs_completed,
        maxDailyVisits: v.max_daily_visits,
        status: v.status
      }))
    });
  } catch (error) {
    console.error('Error fetching eligible vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching eligible vendors',
      error: error.message
    });
  }
});

// Assign vendor to a service for a property
router.post('/assign-vendor', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const {
      propertyId,
      vendorId,
      serviceType,
      serviceName,
      frequency,
      frequencyCount,
      totalVisits,
      estimateId
    } = req.body;

    if (!propertyId || !vendorId || !serviceName) {
      return res.status(400).json({
        success: false,
        message: 'Property ID, Vendor ID, and Service Name are required'
      });
    }

    const userFpId = req.user?.franchisePartnerId || req.user?.fpId;

    const result = await schedulingService.assignVendorToService({
      propertyId,
      vendorId,
      serviceType: serviceType || serviceName,
      serviceName,
      frequency,
      frequencyCount,
      totalVisits,
      estimateId,
      assignedBy: req.user.id,
      franchisePartnerId: userFpId
    });

    res.json({
      success: true,
      message: `Vendor ${result.vendorName} assigned to ${serviceName}`,
      data: result
    });
  } catch (error) {
    console.error('Error assigning vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning vendor to service',
      error: error.message
    });
  }
});

// Get pending schedules count (for badge)
router.get('/pending-count', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const userFpId = req.user?.franchisePartnerId || req.user?.fpId;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'operations_manager';
    
    const count = await schedulingService.getPendingSchedulesCount(isAdmin ? null : userFpId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending schedules count',
      error: error.message
    });
  }
});

// Get pending properties with full details (enhanced version)
router.get('/pending-properties-v2', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const userFpId = req.user?.franchisePartnerId || req.user?.fpId;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'operations_manager';
    
    const { schedulingStatus, zone, propertyType } = req.query;
    
    const properties = await schedulingService.getPendingPropertiesForScheduling(
      isAdmin ? null : userFpId,
      { schedulingStatus, zone, propertyType }
    );

    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching pending properties v2:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending properties',
      error: error.message
    });
  }
});

// Get service schedules for a property
router.get('/property/:propertyId/services', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const [services] = await pool.execute(
      `SELECT pss.*, 
              ov.vendor_id as vendor_code, 
              COALESCE(ov.company_name, ov.owner_name) as vendor_name,
              ov.owner_mobile as vendor_phone
       FROM property_service_schedules pss
       LEFT JOIN onboarded_vendors ov ON ov.id = pss.vendor_id
       WHERE pss.property_id = ?
       ORDER BY pss.service_name`,
      [propertyId]
    );

    res.json({
      success: true,
      data: services.map(s => ({
        id: s.id,
        scheduleId: s.schedule_id,
        serviceName: s.service_name,
        serviceCategory: s.service_category,
        frequencyType: s.frequency_type,
        frequencyCount: s.frequency_count,
        totalVisits: s.total_visits,
        vendorId: s.vendor_id,
        vendorCode: s.vendor_code,
        vendorName: s.vendor_name,
        vendorPhone: s.vendor_phone,
        vendorAssignedAt: s.vendor_assigned_at,
        startDate: s.start_date,
        endDate: s.end_date,
        preferredDay: s.preferred_day,
        preferredTimeSlot: s.preferred_time_slot,
        recommendedDates: s.recommended_dates,
        status: s.status,
        schedulingStatus: s.scheduling_status
      }))
    });
  } catch (error) {
    console.error('Error fetching property services:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property services',
      error: error.message
    });
  }
});

// Schedule a service (create visits)
router.post('/property/:propertyId/services/:serviceScheduleId/schedule', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { propertyId, serviceScheduleId } = req.params;
    const { startDate, endDate, frequency, totalVisits, preferredDay, preferredTimeSlot } = req.body;

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required'
      });
    }

    // Update preferred schedule options
    await pool.execute(
      `UPDATE property_service_schedules 
       SET preferred_day = ?, preferred_time_slot = ?
       WHERE id = ?`,
      [preferredDay || null, preferredTimeSlot || null, serviceScheduleId]
    );

    // Generate scheduled visits
    const visits = await schedulingService.generateScheduledVisits(
      serviceScheduleId,
      startDate,
      endDate || new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)).toISOString().split('T')[0],
      frequency || 'monthly',
      totalVisits || 12
    );

    res.json({
      success: true,
      message: `Created ${visits.length} scheduled visits`,
      data: { visits }
    });
  } catch (error) {
    console.error('Error scheduling service:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling service',
      error: error.message
    });
  }
});

// Get scheduled visits for a service
router.get('/service/:serviceScheduleId/visits', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { serviceScheduleId } = req.params;
    const { status, startDate, endDate } = req.query;

    let query = `
      SELECT sv.*, 
             wo.work_order_id as work_order_code, wo.status as work_order_status
      FROM scheduled_visits sv
      LEFT JOIN work_orders wo ON wo.id = sv.work_order_id
      WHERE sv.service_schedule_id = ?
    `;
    const params = [serviceScheduleId];

    if (status) {
      query += ` AND sv.status = ?`;
      params.push(status);
    }

    if (startDate) {
      query += ` AND sv.scheduled_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND sv.scheduled_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY sv.scheduled_date ASC`;

    const [visits] = await pool.execute(query, params);

    res.json({
      success: true,
      data: visits.map(v => ({
        id: v.id,
        visitId: v.visit_id,
        scheduledDate: v.scheduled_date,
        scheduledTimeStart: v.scheduled_time_start,
        scheduledTimeEnd: v.scheduled_time_end,
        visitNumber: v.visit_number,
        totalVisits: v.total_visits,
        status: v.status,
        workOrderId: v.work_order_id,
        workOrderCode: v.work_order_code,
        workOrderStatus: v.work_order_status,
        customerRequested: v.customer_requested,
        customerPreferredDate: v.customer_preferred_date,
        originalDate: v.original_date,
        rescheduleReason: v.reschedule_reason
      }))
    });
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching scheduled visits',
      error: error.message
    });
  }
});

// Reschedule a visit
router.put('/visits/:visitId/reschedule', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { visitId } = req.params;
    const { newDate, newTimeStart, newTimeEnd, reason } = req.body;

    if (!newDate) {
      return res.status(400).json({
        success: false,
        message: 'New date is required'
      });
    }

    // Get current visit
    const [visit] = await pool.execute(
      `SELECT scheduled_date FROM scheduled_visits WHERE id = ? OR visit_id = ?`,
      [visitId, visitId]
    );

    if (visit.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    await pool.execute(
      `UPDATE scheduled_visits 
       SET scheduled_date = ?, 
           scheduled_time_start = ?,
           scheduled_time_end = ?,
           original_date = COALESCE(original_date, ?),
           rescheduled_by = ?,
           rescheduled_at = NOW(),
           reschedule_reason = ?,
           status = 'rescheduled'
       WHERE id = ? OR visit_id = ?`,
      [newDate, newTimeStart || null, newTimeEnd || null, visit[0].scheduled_date,
       req.user.id, reason || null, visitId, visitId]
    );

    res.json({
      success: true,
      message: 'Visit rescheduled successfully'
    });
  } catch (error) {
    console.error('Error rescheduling visit:', error);
    res.status(500).json({
      success: false,
      message: 'Error rescheduling visit',
      error: error.message
    });
  }
});

// Cancel a visit
router.put('/visits/:visitId/cancel', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { visitId } = req.params;
    const { reason } = req.body;

    await pool.execute(
      `UPDATE scheduled_visits 
       SET status = 'cancelled',
           cancelled_by = ?,
           cancelled_at = NOW(),
           cancellation_note = ?
       WHERE id = ? OR visit_id = ?`,
      [req.user.id, reason || null, visitId, visitId]
    );

    res.json({
      success: true,
      message: 'Visit cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling visit:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling visit',
      error: error.message
    });
  }
});

// Cancel future visits for a schedule series
router.put('/service/:serviceScheduleId/cancel-future', authenticate, canMakeSchedule, async (req, res) => {
  try {
    const { serviceScheduleId } = req.params;
    const { fromDate, reason } = req.body;

    const cancelFromDate = fromDate || new Date().toISOString().split('T')[0];

    const [result] = await pool.execute(
      `UPDATE scheduled_visits 
       SET status = 'cancelled',
           cancelled_by = ?,
           cancelled_at = NOW(),
           cancellation_note = ?
       WHERE service_schedule_id = ? 
         AND scheduled_date >= ?
         AND status IN ('scheduled', 'confirmed')`,
      [req.user.id, reason || 'Future series cancelled', serviceScheduleId, cancelFromDate]
    );

    res.json({
      success: true,
      message: `Cancelled ${result.affectedRows} future visits`
    });
  } catch (error) {
    console.error('Error cancelling future visits:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling future visits',
      error: error.message
    });
  }
});

// Customer custom scheduling request
router.post('/visits/:visitId/customer-request', authenticate, async (req, res) => {
  try {
    const { visitId } = req.params;
    const { preferredDate, preferredTime, notes } = req.body;

    await pool.execute(
      `UPDATE scheduled_visits 
       SET customer_requested = TRUE,
           customer_preferred_date = ?,
           customer_preferred_time = ?,
           customer_notes = ?
       WHERE id = ? OR visit_id = ?`,
      [preferredDate || null, preferredTime || null, notes || null, visitId, visitId]
    );

    res.json({
      success: true,
      message: 'Customer scheduling request submitted'
    });
  } catch (error) {
    console.error('Error submitting customer request:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting request',
      error: error.message
    });
  }
});

// Get notifications
router.get('/notifications', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const userFpId = req.user?.franchisePartnerId || req.user?.fpId;
    const userId = req.user?.id;
    const role = req.user?.role;
    const { limit = 10 } = req.query;

    const notifications = await schedulingService.getUnreadNotifications(
      userFpId,
      userId,
      role === 'manager' ? 'manager' : role === 'franchise_partner' ? 'fp' : role,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: notifications.map(n => ({
        id: n.id,
        notificationId: n.notification_id,
        type: n.type,
        title: n.title,
        message: n.message,
        referenceType: n.reference_type,
        referenceId: n.reference_id,
        referenceData: n.reference_data ? JSON.parse(n.reference_data) : null,
        actionUrl: n.action_url,
        actionLabel: n.action_label,
        priority: n.priority,
        isRead: n.is_read,
        createdAt: n.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
});

// Mark notification as read
router.put('/notifications/:notificationId/read', authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;

    await schedulingService.markNotificationRead(notificationId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
});

// Get vendor availability calendar
router.get('/vendor/:vendorId/availability', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { month, year } = req.query;

    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    // Get vendor's existing bookings for the month
    const [bookings] = await pool.execute(
      `SELECT sv.scheduled_date, COUNT(*) as booking_count
       FROM scheduled_visits sv
       WHERE sv.vendor_id = ?
         AND MONTH(sv.scheduled_date) = ?
         AND YEAR(sv.scheduled_date) = ?
         AND sv.status NOT IN ('cancelled', 'completed')
       GROUP BY sv.scheduled_date`,
      [vendorId, currentMonth, currentYear]
    );

    // Get vendor's availability settings
    const [availability] = await pool.execute(
      `SELECT * FROM vendor_availability 
       WHERE vendor_id = ?
       ORDER BY date, day_of_week`,
      [vendorId]
    );

    // Get vendor's max daily visits
    const [[vendor]] = await pool.execute(
      `SELECT max_daily_visits FROM onboarded_vendors WHERE id = ?`,
      [vendorId]
    );

    const maxDaily = vendor?.max_daily_visits || 5;

    // Build availability calendar
    const bookingMap = {};
    bookings.forEach(b => {
      bookingMap[b.scheduled_date] = b.booking_count;
    });

    res.json({
      success: true,
      data: {
        vendorId,
        month: currentMonth,
        year: currentYear,
        maxDailyVisits: maxDaily,
        bookings: bookingMap,
        availability: availability.map(a => ({
          id: a.id,
          date: a.date,
          dayOfWeek: a.day_of_week,
          type: a.availability_type,
          timeStart: a.time_slot_start,
          timeEnd: a.time_slot_end,
          isRecurring: a.is_recurring,
          maxVisits: a.max_visits_per_day,
          currentBookings: a.current_bookings
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching vendor availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor availability',
      error: error.message
    });
  }
});

// Frequency configuration for recommended dates (uses first service date as anchor)
const FREQ_CONFIG = {
  'daily': { intervalMonths: 0, intervalDays: 1 },
  'weekly': { intervalMonths: 0, intervalDays: 7 },
  'bi_weekly': { intervalMonths: 0, intervalDays: 14 },
  'monthly': { intervalMonths: 1, intervalDays: 0 },
  'every_2_months': { intervalMonths: 2, intervalDays: 0 },
  'bi_monthly': { intervalMonths: 2, intervalDays: 0 },
  'quarterly': { intervalMonths: 3, intervalDays: 0 },
  'half_yearly': { intervalMonths: 6, intervalDays: 0 },
  'half-yearly': { intervalMonths: 6, intervalDays: 0 },
  'yearly': { intervalMonths: 12, intervalDays: 0 },
  'annual': { intervalMonths: 12, intervalDays: 0 }
};

// Get recommended dates for a service based on vendor availability
// Uses first service date as the recurrence anchor
router.get('/recommended-dates', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { vendorId, frequency, startDate, count = 5, totalVisits } = req.query;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required'
      });
    }

    // Normalize frequency
    const normalizedFreq = (frequency || 'monthly').toLowerCase().replace(/[\s-]/g, '_');
    const config = FREQ_CONFIG[normalizedFreq] || FREQ_CONFIG['monthly'];
    
    const firstServiceDate = startDate ? new Date(startDate) : new Date();
    const numVisits = parseInt(totalVisits) || parseInt(count) || 5;
    const recommendedDates = [];

    // Get vendor's existing bookings
    const [bookings] = await pool.execute(
      `SELECT scheduled_date, COUNT(*) as count
       FROM scheduled_visits
       WHERE vendor_id = ? AND status NOT IN ('cancelled', 'completed')
       AND scheduled_date >= CURDATE()
       GROUP BY scheduled_date`,
      [vendorId]
    );

    const bookingMap = {};
    bookings.forEach(b => {
      bookingMap[b.scheduled_date.toISOString().split('T')[0]] = b.count;
    });

    // Get vendor max daily visits
    const [[vendor]] = await pool.execute(
      `SELECT max_daily_visits FROM onboarded_vendors WHERE id = ?`,
      [vendorId]
    );
    const maxDaily = vendor?.max_daily_visits || 5;

    // Generate recommended dates based on frequency using first service date as anchor
    for (let visitNum = 0; visitNum < numVisits; visitNum++) {
      const visitDate = new Date(firstServiceDate);
      
      if (config.intervalMonths > 0) {
        // Month-based frequency (Monthly, Quarterly, etc.)
        visitDate.setMonth(visitDate.getMonth() + (visitNum * config.intervalMonths));
        
        // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
        const targetDay = firstServiceDate.getDate();
        if (visitDate.getDate() !== targetDay) {
          visitDate.setDate(0); // Last day of previous month
        }
      } else if (config.intervalDays > 0) {
        // Day-based frequency (Daily, Weekly)
        visitDate.setDate(visitDate.getDate() + (visitNum * config.intervalDays));
      }
      
      const dateStr = visitDate.toISOString().split('T')[0];
      const dayOfWeek = visitDate.getDay();
      const currentBookings = bookingMap[dateStr] || 0;
      const availableSlots = maxDaily - currentBookings;
      
      recommendedDates.push({
        visitNumber: visitNum + 1,
        date: dateStr,
        dayOfMonth: visitDate.getDate(),
        month: visitDate.toLocaleString('en-US', { month: 'short' }),
        year: visitDate.getFullYear(),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        availableSlots: Math.max(0, availableSlots),
        isAvailable: availableSlots > 0,
        needsAdjustment: availableSlots <= 0
      });
    }

    res.json({
      success: true,
      data: {
        frequency: normalizedFreq,
        firstServiceDate: firstServiceDate.toISOString().split('T')[0],
        anchorDay: firstServiceDate.getDate(),
        totalVisits: numVisits,
        recommendedDates
      }
    });
  } catch (error) {
    console.error('Error fetching recommended dates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recommended dates',
      error: error.message
    });
  }
});

module.exports = router;
