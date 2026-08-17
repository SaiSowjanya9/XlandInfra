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
    const { status, propertyId } = req.query;
    
    let query = `
      SELECT s.*, 
             p.name as property_name, p.property_id as property_code,
             e.estimate_id, e.title as estimate_title,
             pkg.name as package_name,
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM schedules s
      LEFT JOIN properties p ON s.property_id = p.id
      LEFT JOIN estimates e ON s.estimate_id = e.id
      LEFT JOIN packages pkg ON s.package_id = pkg.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

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
        estimateId: s.estimate_id,
        estimateTitle: s.estimate_title,
        packageId: s.package_id,
        packageName: s.package_name,
        propertyId: s.property_id,
        propertyName: s.property_name,
        propertyCode: s.property_code,
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

// Get single schedule (Admin, Manager, Supervisor can view)
router.get('/:id', authenticate, canSeeSchedule, async (req, res) => {
  try {
    const { id } = req.params;

    const [schedules] = await pool.execute(
      `SELECT s.*, 
              p.name as property_name, p.property_id as property_code,
              e.estimate_id, e.title as estimate_title,
              pkg.name as package_name,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM schedules s
       LEFT JOIN properties p ON s.property_id = p.id
       LEFT JOIN estimates e ON s.estimate_id = e.id
       LEFT JOIN packages pkg ON s.package_id = pkg.id
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
        estimateId: s.estimate_id,
        estimateTitle: s.estimate_title,
        packageId: s.package_id,
        packageName: s.package_name,
        propertyId: s.property_id,
        propertyName: s.property_name,
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
