/**
 * Vendor Work Orders Routes
 * Handles vendor-specific work order actions:
 * - Accept work order
 * - View details
 * - Start work
 * - Upload photos
 * - Complete work (submit for verification)
 * 
 * Note: Vendor CANNOT close work order - only Manager/FP can close after verification
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/work-orders');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `wo-${req.params.workOrderId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Work Order Status Flow for Vendors:
// assigned → accepted → in_progress → work_completed → verified (by Manager) → closed
const VENDOR_ALLOWED_STATUSES = ['assigned', 'accepted', 'in_progress', 'work_completed'];

// Get vendor's work orders
router.get('/', authenticate, async (req, res) => {
  try {
    const vendorId = req.user?.vendorId || req.query.vendorId;
    const { status, startDate, endDate } = req.query;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required'
      });
    }

    let query = `
      SELECT wo.*, 
             op.community_name as property_name, op.property_id as property_code,
             op.address_line1, op.city, op.zone,
             pc.name as customer_name, pc.phone as customer_phone,
             sv.visit_number, sv.total_visits, sv.visit_id as schedule_visit_id
      FROM work_orders wo
      JOIN onboarded_properties op ON op.id = wo.property_id
      LEFT JOIN property_contacts pc ON pc.property_id = op.id
      LEFT JOIN scheduled_visits sv ON sv.work_order_id = wo.id
      WHERE wo.assigned_vendor_id = ?
    `;
    const params = [vendorId];

    if (status) {
      query += ` AND wo.status = ?`;
      params.push(status);
    }

    if (startDate) {
      query += ` AND wo.scheduled_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND wo.scheduled_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY wo.scheduled_date ASC, wo.priority DESC`;

    const [workOrders] = await pool.execute(query, params);

    res.json({
      success: true,
      data: workOrders.map(wo => ({
        id: wo.id,
        workOrderId: wo.work_order_id,
        title: wo.title,
        description: wo.description,
        categoryName: wo.category_name,
        subcategoryName: wo.subcategory_name,
        propertyId: wo.property_id,
        propertyCode: wo.property_code,
        propertyName: wo.property_name,
        propertyAddress: [wo.address_line1, wo.city].filter(Boolean).join(', '),
        zone: wo.zone,
        customerName: wo.customer_name,
        customerPhone: wo.customer_phone,
        scheduledDate: wo.scheduled_date,
        scheduledTime: wo.scheduled_time,
        priority: wo.priority,
        status: wo.status,
        visitNumber: wo.visit_number,
        totalVisits: wo.total_visits,
        scheduleReference: wo.schedule_reference,
        vendorAcceptedAt: wo.vendor_accepted_at,
        workStartedAt: wo.work_started_at,
        workCompletedAt: wo.work_completed_at,
        photos: wo.photos ? JSON.parse(wo.photos) : [],
        vendorNotes: wo.vendor_notes,
        createdAt: wo.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching vendor work orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching work orders',
      error: error.message
    });
  }
});

// Get single work order details
router.get('/:workOrderId', authenticate, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const vendorId = req.user?.vendorId;

    const [workOrders] = await pool.execute(
      `SELECT wo.*, 
              op.community_name as property_name, op.property_id as property_code,
              op.address_line1, op.address_line2, op.city, op.state, op.pincode, op.zone,
              pc.name as customer_name, pc.phone as customer_phone, pc.email as customer_email,
              sv.visit_number, sv.total_visits, sv.visit_id as schedule_visit_id,
              pss.service_name, pss.frequency_type
       FROM work_orders wo
       JOIN onboarded_properties op ON op.id = wo.property_id
       LEFT JOIN property_contacts pc ON pc.property_id = op.id
       LEFT JOIN scheduled_visits sv ON sv.work_order_id = wo.id
       LEFT JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
       WHERE wo.id = ? OR wo.work_order_id = ?`,
      [workOrderId, workOrderId]
    );

    if (workOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    const wo = workOrders[0];

    // Verify vendor has access
    if (vendorId && wo.assigned_vendor_id !== vendorId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this work order'
      });
    }

    res.json({
      success: true,
      data: {
        id: wo.id,
        workOrderId: wo.work_order_id,
        title: wo.title,
        description: wo.description,
        categoryName: wo.category_name,
        subcategoryName: wo.subcategory_name,
        serviceName: wo.service_name,
        frequencyType: wo.frequency_type,
        propertyId: wo.property_id,
        propertyCode: wo.property_code,
        propertyName: wo.property_name,
        propertyAddress: {
          line1: wo.address_line1,
          line2: wo.address_line2,
          city: wo.city,
          state: wo.state,
          pincode: wo.pincode
        },
        zone: wo.zone,
        customerName: wo.customer_name,
        customerPhone: wo.customer_phone,
        customerEmail: wo.customer_email,
        scheduledDate: wo.scheduled_date,
        scheduledTime: wo.scheduled_time,
        priority: wo.priority,
        status: wo.status,
        visitNumber: wo.visit_number,
        totalVisits: wo.total_visits,
        scheduleReference: wo.schedule_reference,
        vendorAcceptedAt: wo.vendor_accepted_at,
        workStartedAt: wo.work_started_at,
        workCompletedAt: wo.work_completed_at,
        photos: wo.photos ? JSON.parse(wo.photos) : [],
        vendorNotes: wo.vendor_notes,
        managerNotes: wo.manager_notes,
        createdAt: wo.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching work order details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching work order details',
      error: error.message
    });
  }
});

// Accept work order
router.post('/:workOrderId/accept', authenticate, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const vendorId = req.user?.vendorId;

    // Verify work order exists and is assigned to this vendor
    const [workOrders] = await pool.execute(
      `SELECT * FROM work_orders WHERE (id = ? OR work_order_id = ?) AND status = 'assigned'`,
      [workOrderId, workOrderId]
    );

    if (workOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found or already accepted'
      });
    }

    const wo = workOrders[0];

    // Update status to accepted
    await pool.execute(
      `UPDATE work_orders 
       SET status = 'accepted', 
           vendor_accepted_at = NOW()
       WHERE id = ?`,
      [wo.id]
    );

    res.json({
      success: true,
      message: 'Work order accepted successfully',
      data: { status: 'accepted', acceptedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error accepting work order:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting work order',
      error: error.message
    });
  }
});

// Start work
router.post('/:workOrderId/start', authenticate, async (req, res) => {
  try {
    const { workOrderId } = req.params;

    const [workOrders] = await pool.execute(
      `SELECT * FROM work_orders WHERE (id = ? OR work_order_id = ?) AND status = 'accepted'`,
      [workOrderId, workOrderId]
    );

    if (workOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Work order must be accepted before starting work'
      });
    }

    const wo = workOrders[0];

    await pool.execute(
      `UPDATE work_orders 
       SET status = 'in_progress', 
           work_started_at = NOW()
       WHERE id = ?`,
      [wo.id]
    );

    // Also update scheduled visit status
    await pool.execute(
      `UPDATE scheduled_visits SET status = 'in_progress' WHERE work_order_id = ?`,
      [wo.id]
    );

    res.json({
      success: true,
      message: 'Work started successfully',
      data: { status: 'in_progress', startedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error starting work:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting work',
      error: error.message
    });
  }
});

// Upload photos
router.post('/:workOrderId/photos', authenticate, upload.array('photos', 10), async (req, res) => {
  try {
    const { workOrderId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No photos uploaded'
      });
    }

    // Get existing photos
    const [[wo]] = await pool.execute(
      `SELECT photos FROM work_orders WHERE id = ? OR work_order_id = ?`,
      [workOrderId, workOrderId]
    );

    if (!wo) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    const existingPhotos = wo.photos ? JSON.parse(wo.photos) : [];
    const newPhotos = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/work-orders/${file.filename}`,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }));

    const allPhotos = [...existingPhotos, ...newPhotos];

    await pool.execute(
      `UPDATE work_orders SET photos = ? WHERE id = ? OR work_order_id = ?`,
      [JSON.stringify(allPhotos), workOrderId, workOrderId]
    );

    res.json({
      success: true,
      message: `${newPhotos.length} photo(s) uploaded successfully`,
      data: { photos: allPhotos }
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading photos',
      error: error.message
    });
  }
});

// Complete work (submit for verification - vendor CANNOT close)
router.post('/:workOrderId/complete', authenticate, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { notes, checklist } = req.body;

    const [workOrders] = await pool.execute(
      `SELECT * FROM work_orders WHERE (id = ? OR work_order_id = ?) AND status = 'in_progress'`,
      [workOrderId, workOrderId]
    );

    if (workOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Work order must be in progress to complete'
      });
    }

    const wo = workOrders[0];

    // Update to work_completed (NOT closed - Manager/FP will verify and close)
    await pool.execute(
      `UPDATE work_orders 
       SET status = 'work_completed', 
           work_completed_at = NOW(),
           vendor_notes = ?,
           completion_checklist = ?
       WHERE id = ?`,
      [notes || null, checklist ? JSON.stringify(checklist) : null, wo.id]
    );

    // Update scheduled visit status
    await pool.execute(
      `UPDATE scheduled_visits SET status = 'completed' WHERE work_order_id = ?`,
      [wo.id]
    );

    // Notify Manager/FP for verification
    const notificationId = `NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    await pool.execute(
      `INSERT INTO portal_notifications 
       (notification_id, role_type, type, title, message, reference_type, reference_id, action_url, action_label, priority)
       VALUES (?, 'manager', 'work_order', ?, ?, 'work_order', ?, ?, 'Verify & Close', 'high')`,
      [
        notificationId,
        'Work Completed - Verification Required',
        `Work order ${wo.work_order_id} has been completed by vendor and requires verification.`,
        wo.id,
        `/manager/work-orders/${wo.id}/verify`
      ]
    );

    res.json({
      success: true,
      message: 'Work completed and submitted for verification',
      data: { 
        status: 'work_completed', 
        completedAt: new Date().toISOString(),
        note: 'Manager/FP will verify and close this work order'
      }
    });
  } catch (error) {
    console.error('Error completing work:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing work',
      error: error.message
    });
  }
});

// Get vendor notifications
router.get('/notifications/list', authenticate, async (req, res) => {
  try {
    const vendorId = req.user?.vendorId;
    const { unreadOnly = 'true', limit = 20 } = req.query;

    let query = `
      SELECT * FROM portal_notifications 
      WHERE role_type = 'vendor'
    `;
    const params = [];

    if (unreadOnly === 'true') {
      query += ` AND is_read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [notifications] = await pool.execute(query, params);

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

    await pool.execute(
      `UPDATE portal_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? OR notification_id = ?`,
      [notificationId, notificationId]
    );

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

module.exports = router;
