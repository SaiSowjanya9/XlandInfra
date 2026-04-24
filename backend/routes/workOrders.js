const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const categoriesConfig = require('../config/categories');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { 
  requireModuleAccess, 
  managerOrAdmin, 
  supervisorOrAbove,
  canAssign, 
  canClose, 
  canReopen,
  canCreateRequest,
  canTrack,
  canMonitorVendor,
  adminOnly,
  MODULES,
  ROLES
} = require('../middleware/rbac');
const { WORK_ORDER_STATUS } = require('../config/roles');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Generate unique order number
const generateOrderNumber = () => {
  const prefix = 'WO';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// ============================================
// GET CATEGORIES (Public - for customer portal)
// ============================================
router.get('/categories', async (req, res) => {
  try {
    // Try to get from database first
    try {
      const [categories] = await pool.execute(
        `SELECT c.id, c.name, c.sort_order 
         FROM categories c 
         WHERE c.is_active = TRUE 
         ORDER BY c.sort_order`
      );
      
      // Get subcategories for each category
      for (let cat of categories) {
        const [subcats] = await pool.execute(
          `SELECT id, name, sort_order 
           FROM subcategories 
           WHERE category_id = ? AND is_active = TRUE 
           ORDER BY sort_order`,
          [cat.id]
        );
        cat.subcategories = subcats;
      }
      
      return res.json({ success: true, data: categories });
    } catch (dbError) {
      // Fallback to config file
      console.log('Using config categories (DB not available)');
      return res.json({ success: true, data: categoriesConfig });
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Error fetching categories' });
  }
});

// ============================================
// CREATE WORK ORDER (Customer Portal - No Auth Required)
// ============================================
router.post('/', upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      description,
      permissionToEnter,
      entryNotes,
      hasPet,
      residentId,
      propertyId,
      unitId
    } = req.body;

    // Validate required fields
    if (!categoryId || !subcategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category and subcategory are required'
      });
    }

    // Validate description length
    if (description && description.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 500 characters'
      });
    }

    // Get category and subcategory names from config
    const category = categoriesConfig.find(c => c.id === parseInt(categoryId));
    if (!category) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    
    // Handle subcategory - can be an object with id/name or just index
    let subcategoryName = '';
    if (category.subcategories && category.subcategories.length > 0) {
      const subcat = category.subcategories.find(s => 
        (typeof s === 'object' && s.id === parseInt(subcategoryId)) ||
        (typeof s === 'string')
      );
      if (typeof subcat === 'object') {
        subcategoryName = subcat.name;
      } else {
        // It's array index based
        subcategoryName = category.subcategories[parseInt(subcategoryId) - 1] || '';
      }
    }

    const orderNumber = generateOrderNumber();
    
    // Process uploaded files
    const attachments = req.files ? req.files.map(file => ({
      fileName: file.filename,
      originalName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      filePath: file.path
    })) : [];

    // Try to save to database
    try {
      const [result] = await pool.execute(
        `INSERT INTO work_orders (
          work_order_id, resident_id, property_id, unit_id,
          category_id, subcategory_id, category_name, subcategory_name,
          description, permission_to_enter, entry_notes, has_pet,
          status, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'customer', NOW())`,
        [
          orderNumber,
          residentId || null,
          propertyId || null,
          unitId || null,
          parseInt(categoryId),
          parseInt(subcategoryId),
          category.name,
          subcategoryName,
          description || '',
          permissionToEnter === 'yes' ? 'yes' : 'no',
          entryNotes || '',
          hasPet === 'yes' ? 'yes' : 'no'
        ]
      );

      const workOrderId = result.insertId;

      // Save attachments
      for (const att of attachments) {
        await pool.execute(
          `INSERT INTO work_order_attachments (work_order_id, file_name, original_name, file_type, file_size, file_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [workOrderId, att.fileName, att.originalName, att.fileType, att.fileSize, att.filePath]
        );
      }

      // Add to history
      await pool.execute(
        `INSERT INTO work_order_history (work_order_id, to_status, changed_by_type, notes)
         VALUES (?, 'pending', 'system', 'Work order created by customer')`,
        [workOrderId]
      );

      return res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: {
          id: workOrderId,
          orderNumber,
          categoryName: category.name,
          subcategoryName,
          status: 'pending'
        }
      });
    } catch (dbError) {
      console.log('DB not available, returning mock response:', dbError.message);
      // Return mock success for demo mode
      return res.status(201).json({
        success: true,
        message: 'Work order created successfully (Demo Mode)',
        data: {
          id: uuidv4(),
          orderNumber,
          categoryName: category.name,
          subcategoryName,
          status: 'pending'
        }
      });
    }
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating work order',
      error: error.message
    });
  }
});

// ============================================
// GET ALL WORK ORDERS (Admin Portal) - with search support
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;

    try {
      let query = `
        SELECT wo.*, 
               r.first_name, r.last_name, r.email, r.phone,
               u.unit_number, p.name as property_name
        FROM work_orders wo
        LEFT JOIN residents r ON wo.resident_id = r.id
        LEFT JOIN units u ON wo.unit_id = u.id
        LEFT JOIN properties p ON wo.property_id = p.id
      `;
      
      const params = [];
      const conditions = [];
      
      // Search by work order ID
      if (search && search.trim()) {
        conditions.push(`(wo.work_order_id LIKE ? OR wo.category_name LIKE ? OR wo.subcategory_name LIKE ? OR r.first_name LIKE ? OR r.last_name LIKE ?)`);
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      // Filter by status
      if (status && status !== 'all') {
        conditions.push(`wo.status = ?`);
        params.push(status);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ` ORDER BY wo.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [workOrders] = await pool.execute(query, params);

      // Get counts by status
      const [[counts]] = await pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
        FROM work_orders
      `);

      return res.json({
        success: true,
        data: workOrders,
        counts: {
          total: counts.total || 0,
          pending: counts.pending || 0,
          assigned: counts.assigned || 0,
          inProgress: counts.in_progress || 0,
          completed: counts.completed || 0
        }
      });
    } catch (dbError) {
      console.log('DB not available:', dbError.message);
      return res.json({
        success: true,
        data: [],
        counts: { total: 0, pending: 0, assigned: 0, inProgress: 0, completed: 0 },
        message: 'Database not connected - Demo Mode'
      });
    }
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching work orders',
      error: error.message
    });
  }
});

// ============================================
// GET WORK ORDER BY ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      const [workOrders] = await pool.execute(
        `SELECT wo.*, 
                r.first_name, r.last_name, r.email, r.phone,
                u.unit_number, p.name as property_name
         FROM work_orders wo
         LEFT JOIN residents r ON wo.resident_id = r.id
         LEFT JOIN units u ON wo.unit_id = u.id
         LEFT JOIN properties p ON wo.property_id = p.id
         WHERE wo.id = ?`,
        [id]
      );

      if (workOrders.length === 0) {
        return res.status(404).json({ success: false, message: 'Work order not found' });
      }

      // Get attachments
      const [attachments] = await pool.execute(
        `SELECT * FROM work_order_attachments WHERE work_order_id = ?`,
        [id]
      );

      // Get history
      const [history] = await pool.execute(
        `SELECT * FROM work_order_history WHERE work_order_id = ? ORDER BY created_at DESC`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          ...workOrders[0],
          attachments,
          history
        }
      });
    } catch (dbError) {
      return res.status(404).json({ success: false, message: 'Work order not found (DB not connected)' });
    }
  } catch (error) {
    console.error('Error fetching work order:', error);
    res.status(500).json({ success: false, message: 'Error fetching work order' });
  }
});

// ============================================
// UPDATE WORK ORDER STATUS
// ============================================
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, adminId } = req.body;
    
    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'closed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
      // Get current status
      const [[current]] = await pool.execute(
        `SELECT status FROM work_orders WHERE id = ?`,
        [id]
      );

      if (!current) {
        return res.status(404).json({ success: false, message: 'Work order not found' });
      }

      // Update status
      let completedDate = null;
      if (status === 'completed' || status === 'closed') {
        completedDate = new Date();
      }

      await pool.execute(
        `UPDATE work_orders SET status = ?, completed_date = ?, admin_notes = COALESCE(?, admin_notes), updated_at = NOW() WHERE id = ?`,
        [status, completedDate, notes, id]
      );

      // Add to history
      await pool.execute(
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by, changed_by_type, notes)
         VALUES (?, ?, ?, ?, 'admin', ?)`,
        [id, current.status, status, adminId || null, notes || null]
      );

      return res.json({ success: true, message: 'Status updated successfully' });
    } catch (dbError) {
      return res.json({ success: true, message: 'Status updated (Demo Mode)' });
    }
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// ============================================
// CREATE WORK ORDER FROM ADMIN PORTAL
// ============================================
router.post('/admin/create', upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      description,
      permissionToEnter,
      entryNotes,
      hasPet,
      residentId,
      propertyId,
      unitId,
      priority,
      adminId
    } = req.body;

    if (!categoryId || !subcategoryId) {
      return res.status(400).json({ success: false, message: 'Category and subcategory are required' });
    }

    const category = categoriesConfig.find(c => c.id === parseInt(categoryId));
    if (!category) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    let subcategoryName = '';
    if (category.subcategories && category.subcategories.length > 0) {
      const subcat = category.subcategories.find(s => 
        (typeof s === 'object' && s.id === parseInt(subcategoryId))
      );
      if (typeof subcat === 'object') {
        subcategoryName = subcat.name;
      } else {
        subcategoryName = category.subcategories[parseInt(subcategoryId) - 1] || '';
      }
    }

    const orderNumber = generateOrderNumber();
    const attachments = req.files ? req.files.map(file => ({
      fileName: file.filename,
      originalName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      filePath: file.path
    })) : [];

    try {
      const [result] = await pool.execute(
        `INSERT INTO work_orders (
          work_order_id, resident_id, property_id, unit_id,
          category_id, subcategory_id, category_name, subcategory_name,
          description, permission_to_enter, entry_notes, has_pet,
          status, priority, source, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'admin', ?, NOW())`,
        [
          orderNumber,
          residentId || null,
          propertyId || null,
          unitId || null,
          parseInt(categoryId),
          parseInt(subcategoryId),
          category.name,
          subcategoryName,
          description || '',
          permissionToEnter === 'yes' ? 'yes' : 'no',
          entryNotes || '',
          hasPet === 'yes' ? 'yes' : 'no',
          priority || 'medium',
          adminId || null
        ]
      );

      const workOrderId = result.insertId;

      for (const att of attachments) {
        await pool.execute(
          `INSERT INTO work_order_attachments (work_order_id, file_name, original_name, file_type, file_size, file_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [workOrderId, att.fileName, att.originalName, att.fileType, att.fileSize, att.filePath]
        );
      }

      await pool.execute(
        `INSERT INTO work_order_history (work_order_id, to_status, changed_by, changed_by_type, notes)
         VALUES (?, 'pending', ?, 'admin', 'Work order created by admin')`,
        [workOrderId, adminId || null]
      );

      return res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: { id: workOrderId, orderNumber, status: 'pending' }
      });
    } catch (dbError) {
      return res.status(201).json({
        success: true,
        message: 'Work order created (Demo Mode)',
        data: { id: uuidv4(), orderNumber, status: 'pending' }
      });
    }
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ success: false, message: 'Error creating work order' });
  }
});

// ============================================
// ASSIGN VENDOR
// ============================================
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, scheduledDate, adminId, notes } = req.body;

    try {
      await pool.execute(
        `UPDATE work_orders SET 
          assigned_vendor_id = ?, scheduled_date = ?, assigned_at = NOW(), 
          assigned_by = ?, status = 'assigned', admin_notes = COALESCE(?, admin_notes)
         WHERE id = ?`,
        [vendorId, scheduledDate || null, adminId || null, notes, id]
      );

      await pool.execute(
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by, changed_by_type, notes)
         VALUES (?, 'pending', 'assigned', ?, 'admin', ?)`,
        [id, adminId || null, notes || 'Vendor assigned']
      );

      return res.json({ success: true, message: 'Vendor assigned successfully' });
    } catch (dbError) {
      return res.json({ success: true, message: 'Vendor assigned (Demo Mode)' });
    }
  } catch (error) {
    console.error('Error assigning vendor:', error);
    res.status(500).json({ success: false, message: 'Error assigning vendor' });
  }
});

// ============================================
// CLOSE WORK ORDER
// ============================================
router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, adminId } = req.body;

    try {
      const [[current]] = await pool.execute(`SELECT status FROM work_orders WHERE id = ?`, [id]);

      await pool.execute(
        `UPDATE work_orders SET status = 'closed', completed_date = NOW(), admin_notes = COALESCE(?, admin_notes) WHERE id = ?`,
        [notes, id]
      );

      await pool.execute(
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by, changed_by_type, notes)
         VALUES (?, ?, 'closed', ?, 'admin', ?)`,
        [id, current?.status || 'completed', adminId || null, notes || 'Work order closed']
      );

      return res.json({ success: true, message: 'Work order closed successfully' });
    } catch (dbError) {
      return res.json({ success: true, message: 'Work order closed (Demo Mode)' });
    }
  } catch (error) {
    console.error('Error closing work order:', error);
    res.status(500).json({ success: false, message: 'Error closing work order' });
  }
});

// ============================================
// REOPEN WORK ORDER
// ============================================
router.post('/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminId } = req.body;

    try {
      await pool.execute(
        `UPDATE work_orders SET status = 'pending', completed_date = NULL WHERE id = ?`,
        [id]
      );

      await pool.execute(
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by, changed_by_type, notes)
         VALUES (?, 'closed', 'pending', ?, 'admin', ?)`,
        [id, adminId || null, reason || 'Work order reopened']
      );

      return res.json({ success: true, message: 'Work order reopened successfully' });
    } catch (dbError) {
      return res.json({ success: true, message: 'Work order reopened (Demo Mode)' });
    }
  } catch (error) {
    console.error('Error reopening work order:', error);
    res.status(500).json({ success: false, message: 'Error reopening work order' });
  }
});

// ============================================
// GET WORK ORDER HISTORY
// ============================================
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    try {
      const [history] = await pool.execute(
        `SELECT h.*, a.first_name, a.last_name 
         FROM work_order_history h
         LEFT JOIN admin_users a ON h.changed_by = a.id
         WHERE h.work_order_id = ? 
         ORDER BY h.created_at DESC`,
        [id]
      );

      return res.json({ success: true, data: history });
    } catch (dbError) {
      return res.json({ success: true, data: [] });
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Error fetching history' });
  }
});

module.exports = router;
