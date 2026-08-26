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

    // If schedule is from an estimate, mark estimate as converted
    if (estimateId) {
      await pool.execute(
        `UPDATE estimates SET status = 'converted' WHERE id = ?`,
        [estimateId]
      );
    }

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

module.exports = router;
