const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const categories = require('../config/categories');
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

// Create a new work order (Admin, Manager, Supervisor can create requests)
router.post('/', authenticate, canCreateRequest, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      description,
      permissionToEnter,
      entryNotes,
      hasPet,
      customerId
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

    // Get category and subcategory names
    const category = categories.find(c => c.id === parseInt(categoryId));
    if (!category) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    
    const subcategoryName = category.subcategories[parseInt(subcategoryId) - 1];
    if (!subcategoryName) {
      return res.status(400).json({ success: false, message: 'Invalid subcategory' });
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

    // Create work order object (for now, store in memory or return)
    const workOrder = {
      id: uuidv4(),
      orderNumber,
      categoryId: parseInt(categoryId),
      categoryName: category.name,
      subcategoryId: parseInt(subcategoryId),
      subcategoryName,
      description: description || '',
      permissionToEnter: permissionToEnter === 'yes' ? 'yes' : 'no',
      entryNotes: entryNotes || '',
      hasPet: hasPet === 'yes' ? 'yes' : 'no',
      attachments,
      status: 'pending',
      createdAt: new Date().toISOString(),
      customerId: customerId || null
    };

    // TODO: Save to database when MySQL is connected
    // For now, return the created work order

    res.status(201).json({
      success: true,
      message: 'Work order created successfully',
      data: workOrder
    });
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating work order',
      error: error.message
    });
  }
});

// Get all work orders (Admin, Manager full access; Supervisor view only for tracking)
router.get('/', authenticate, supervisorOrAbove, async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({
      success: true,
      data: [],
      message: 'Work orders retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching work orders',
      error: error.message
    });
  }
});

// Get work order by ID (Admin, Manager, Supervisor can view)
router.get('/:id', authenticate, supervisorOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Fetch from database
    res.json({
      success: true,
      data: null,
      message: 'Work order not found'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching work order',
      error: error.message
    });
  }
});

// Update work order status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userRole = req.user.role;
    
    // Valid statuses based on the workflow
    const validStatuses = Object.values(WORK_ORDER_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Check role-based permissions for status changes
    const vendorOnlyStatuses = [WORK_ORDER_STATUS.ACCEPTED, WORK_ORDER_STATUS.IN_PROGRESS, WORK_ORDER_STATUS.COMPLETED];
    const managerOnlyStatuses = [WORK_ORDER_STATUS.ASSIGNED, WORK_ORDER_STATUS.VERIFIED, WORK_ORDER_STATUS.CLOSED];
    
    if (vendorOnlyStatuses.includes(status) && userRole !== ROLES.VENDOR) {
      return res.status(403).json({
        success: false,
        message: 'Only vendors can set this status'
      });
    }

    if (managerOnlyStatuses.includes(status) && ![ROLES.ADMIN, ROLES.MANAGER].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only Manager or Admin can set this status'
      });
    }

    // TODO: Update in database with status history
    res.json({
      success: true,
      message: 'Work order status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating work order',
      error: error.message
    });
  }
});

// Assign vendor to work order (Manager/Admin only)
router.post('/:id/assign', authenticate, canAssign, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, scheduledDate, notes } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required'
      });
    }

    // TODO: Update work order with vendor assignment
    res.json({
      success: true,
      message: 'Vendor assigned successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning vendor',
      error: error.message
    });
  }
});

// Close work order (Manager/Admin only)
router.post('/:id/close', authenticate, canClose, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // TODO: Close work order in database
    res.json({
      success: true,
      message: 'Work order closed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error closing work order',
      error: error.message
    });
  }
});

// Reopen work order (Admin only)
router.post('/:id/reopen', authenticate, canReopen, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // TODO: Reopen work order in database
    res.json({
      success: true,
      message: 'Work order reopened successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reopening work order',
      error: error.message
    });
  }
});

// Get work order status history
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch status history from database
    res.json({
      success: true,
      data: [],
      message: 'Status history retrieved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching status history',
      error: error.message
    });
  }
});

module.exports = router;
