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
// Always returns config file categories with embedded subcategories for consistency
// ============================================
router.get('/categories', async (req, res) => {
  try {
    // Always use config file for categories (most reliable, has embedded subcategories)
    return res.json({ success: true, data: categoriesConfig });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.json({ success: true, data: categoriesConfig });
  }
});

// ============================================
// CREATE WORK ORDER (Customer Portal - No Auth Required)
// ============================================
router.post('/', (req, res, next) => {
  upload.array('attachments', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Too many files. Maximum 5 files allowed.' });
      }
      return res.status(400).json({ success: false, message: 'File upload error: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      description,
      permissionToEnter,
      entryNotes,
      hasPet,
      priority,
      residentId,
      propertyId,
      unitId,
      block,
      flatNumber,
      customerName,
      customerEmail,
      customerPhone,
      propertyName,
      propertyType
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
    
    // Find subcategory name by ID
    let subcategoryName = '';
    if (category.subcategories && category.subcategories.length > 0) {
      const parsedSubId = parseInt(subcategoryId);
      const subcat = category.subcategories.find(s => s.id === parsedSubId);
      if (subcat) {
        subcategoryName = subcat.name;
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
      // Get property details including franchise_partner_id, zone, division, address, contact info, and actual property_id
      let franchisePartnerId = null;
      let propDetails = {};
      let actualPropertyId = null;
      const propId = propertyId && propertyId !== 'undefined' ? propertyId : null;
      
      if (propId) {
        // Try properties table first - check by both id and property_id columns
        const [propData] = await pool.query(
          `SELECT id, franchise_partner_id, name, property_type, property_id, zone_id as zone, division,
                  address, city, state, contact_person, contact_phone, contact_email
           FROM properties WHERE id = ? OR property_id = ?`,
          [propId, propId]
        );
        if (propData.length > 0) {
          propDetails = propData[0];
          franchisePartnerId = propData[0].franchise_partner_id;
          actualPropertyId = propData[0].property_id;
        } else {
          // Try onboarded_properties - check by both id and property_id columns
          const [opData] = await pool.query(
            `SELECT id, franchise_partner_id, community_name as name, property_type, property_id, zone, division,
                    address, city, state, contact_person, contact_phone, contact_email
             FROM onboarded_properties WHERE id = ? OR property_id = ?`,
            [propId, propId]
          );
          if (opData.length > 0) {
            propDetails = opData[0];
            franchisePartnerId = opData[0].franchise_partner_id;
            actualPropertyId = opData[0].property_id;
          }
        }
        console.log('[WorkOrder] Property lookup - fpId:', franchisePartnerId, 'zone:', propDetails.zone, 'propertyId:', actualPropertyId);
      }

      // Fetch zone name from zones table if zone_id exists
      let zoneName = propDetails.zone || null;
      if (propDetails.zone && !isNaN(parseInt(propDetails.zone))) {
        const [zoneData] = await pool.query('SELECT name FROM zones WHERE id = ?', [parseInt(propDetails.zone)]);
        if (zoneData.length > 0) {
          zoneName = zoneData[0].name;
        }
      }

      // Use property details as fallbacks for customer info
      const finalCustomerName = customerName || propDetails.contact_person || null;
      const finalCustomerEmail = customerEmail || propDetails.contact_email || null;
      const finalCustomerPhone = customerPhone || propDetails.contact_phone || null;
      const finalPropertyName = propertyName || propDetails.name || null;
      const finalPropertyType = propertyType || propDetails.property_type || null;

      // Check for duplicate work order (same property, category, subcategory created in last 30 seconds)
      const [recentDuplicates] = await pool.query(
        `SELECT id, work_order_id FROM work_orders 
         WHERE property_id = ? AND category_id = ? AND subcategory_id = ? 
         AND created_at > DATE_SUB(NOW(), INTERVAL 30 SECOND)
         LIMIT 1`,
        [propDetails.id || propId, parseInt(categoryId), parseInt(subcategoryId)]
      );
      
      if (recentDuplicates.length > 0) {
        console.log('[WorkOrder] Duplicate detected - returning existing:', recentDuplicates[0].work_order_id);
        return res.status(200).json({
          success: true,
          message: 'Work order already submitted',
          workOrderId: recentDuplicates[0].id,
          orderNumber: recentDuplicates[0].work_order_id
        });
      }

      const [result] = await pool.query(
        `INSERT INTO work_orders (
          work_order_id, resident_id, property_id, unit_id,
          category_id, subcategory_id, category_name, subcategory_name,
          description, permission_to_enter, entry_notes, has_pet, priority,
          customer_name, customer_email, customer_phone, property_name, property_type, block, flat_number,
          franchise_partner_id, status, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'customer', NOW())`,
        [
          orderNumber,
          residentId && residentId !== 'undefined' ? residentId : null,
          propDetails.id || propId,
          unitId && unitId !== 'undefined' && !isNaN(parseInt(unitId)) ? parseInt(unitId) : null,
          parseInt(categoryId),
          parseInt(subcategoryId),
          category.name,
          subcategoryName,
          description || '',
          permissionToEnter === 'yes' ? 'yes' : 'no',
          entryNotes || '',
          hasPet === 'yes' ? 'yes' : 'no',
          priority || 'medium',
          finalCustomerName,
          finalCustomerEmail,
          finalCustomerPhone,
          finalPropertyName,
          finalPropertyType,
          block || null,
          flatNumber || null,
          franchisePartnerId
        ]
      );

      const workOrderId = result.insertId;

      // Save attachments
      for (const att of attachments) {
        await pool.query(
          `INSERT INTO work_order_attachments (work_order_id, file_name, original_name, file_type, file_size, file_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [workOrderId, att.fileName, att.originalName, att.fileType, att.fileSize, att.filePath]
        );
      }

      // Add to history
      await pool.query(
        `INSERT INTO work_order_history (work_order_id, to_status, changed_by_type, notes)
         VALUES (?, 'pending', 'system', 'Work order created by customer')`,
        [workOrderId]
      );

      // Send email notification for new work order
      // Sends to: FP email + zone-centric employees + customer
      const { sendWorkOrderCreatedNotification } = require('../services/emailService');
      sendWorkOrderCreatedNotification({
        orderId: workOrderId,
        orderNumber,
        title: `Service Request - ${category.name}`,
        propertyName: finalPropertyName,
        propertyId: actualPropertyId || propertyId,
        propertyType: propDetails.property_type || '',
        propertyAddress: propDetails.address || '',
        propertyCity: propDetails.city || '',
        propertyState: propDetails.state || '',
        customerName: finalCustomerName,
        customerEmail: finalCustomerEmail,
        customerPhone: finalCustomerPhone,
        zoneName: zoneName,
        division: propDetails.division || null,
        categoryName: category.name,
        subcategoryName,
        priority: priority || 'medium',
        description,
        permissionToEnter: permissionToEnter || 'no',
        hasPet: hasPet || 'no',
        entryNotes: entryNotes || '',
        createdBy: finalCustomerName || finalCustomerEmail || 'Customer',
        createdByRole: 'Customer',
        franchisePartnerId: franchisePartnerId,
        propertyZone: propDetails.zone || null,
        attachments: attachments
      }).catch(err => console.error('Email notification error:', err));

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
      console.error('❌ Database Error creating work order:', dbError.message);
      console.error('Full error:', dbError);
      // Return actual error - don't silently fail
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message,
        error: dbError.message
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
        SELECT DISTINCT wo.*,
               op.community_name as onboarded_property_name,
               op.entry_type as onboarded_entry_type,
               op.zone as onboarded_zone
        FROM work_orders wo
        LEFT JOIN (
          SELECT property_id, community_name, entry_type, zone 
          FROM onboarded_properties 
          GROUP BY property_id
        ) op ON wo.property_id = op.property_id
      `;
      
      const params = [];
      const conditions = [];
      
      // Search by work order ID
      if (search && search.trim()) {
        conditions.push(`(wo.work_order_id LIKE ? OR wo.category_name LIKE ? OR wo.subcategory_name LIKE ? OR wo.customer_name LIKE ? OR wo.customer_phone LIKE ? OR wo.property_id LIKE ? OR op.community_name LIKE ?)`);
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      // Filter by status
      if (status && status !== 'all') {
        if (status === 'pending') {
          conditions.push(`wo.status IN ('pending', 'assigned', 'in_progress')`);
        } else if (status === 'closed') {
          conditions.push(`wo.status IN ('completed', 'closed')`);
        } else {
          conditions.push(`wo.status = ?`);
          params.push(status);
        }
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ` GROUP BY wo.id ORDER BY wo.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [workOrders] = await pool.query(query, params);

      // Get counts by status
      const [[counts]] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('pending', 'assigned', 'in_progress', 'under_review', 'accepted') THEN 1 ELSE 0 END) as pending,
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
      console.error('❌ DB Error fetching work orders:', dbError.message);
      console.error('Full error:', dbError);
      return res.status(500).json({
        success: false,
        data: [],
        counts: { total: 0, pending: 0, assigned: 0, inProgress: 0, completed: 0 },
        message: 'Database error: ' + dbError.message
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
                op.community_name as onboarded_property_name,
                op.entry_type as onboarded_entry_type,
                op.zone as onboarded_zone
         FROM work_orders wo
         LEFT JOIN (
           SELECT property_id, community_name, entry_type, zone 
           FROM onboarded_properties 
           GROUP BY property_id
         ) op ON wo.property_id = op.property_id
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
    const { status, notes, adminId, closingNotes } = req.body;
    
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

      // Update status - include closing_notes if completing
      const completedAt = (status === 'completed' || status === 'closed') ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

      if (status === 'completed') {
        await pool.query(
          `UPDATE work_orders SET status = ?, closing_notes = ?, completed_at = ?, completed_date = NOW(), updated_at = NOW() WHERE id = ?`,
          [status, closingNotes || null, completedAt, id]
        );
      } else {
        await pool.query(
          `UPDATE work_orders SET status = ?, completed_at = ?, updated_at = NOW() WHERE id = ?`,
          [status, completedAt, id]
        );
      }

      // Add to history
      await pool.query(
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by_id, changed_by_type, notes)
         VALUES (?, ?, ?, ?, 'admin', ?)`,
        [id, current.status, status, adminId || null, notes || null]
      );

      // Send completion email if status is completed
      if (status === 'completed') {
        console.log('[Admin] Status changed to completed, sending email...');
        const [workOrder] = await pool.query(
          `SELECT wo.work_order_id, wo.title, 
                  COALESCE(p.name, op.community_name, wo.property_name) as property_name,
                  COALESCE(p.property_id, op.property_id, wo.property_id) as property_code,
                  wo.customer_name, wo.customer_email, wo.customer_phone, 
                  wo.category_name, wo.subcategory_name, wo.description, wo.closing_notes, wo.franchise_partner_id,
                  COALESCE(p.zone_id, op.zone) as property_zone,
                  COALESCE(fd.name, fd2.name, p.division_id, op.division) as division
           FROM work_orders wo
           LEFT JOIN properties p ON wo.property_id = p.id
           LEFT JOIN onboarded_properties op ON wo.property_id = op.id
           LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = wo.franchise_partner_id
           LEFT JOIN fp_divisions fd2 ON (CAST(op.division AS UNSIGNED) = fd2.id OR op.division = fd2.name) AND fd2.franchise_partner_id = wo.franchise_partner_id
           WHERE wo.id = ?`, [id]
        );
        console.log('[Admin] Work order data:', workOrder[0]);
        if (workOrder.length > 0) {
          // Fetch zone name from zones table
          let zoneName = workOrder[0].property_zone || null;
          if (workOrder[0].property_zone && !isNaN(parseInt(workOrder[0].property_zone))) {
            const [zoneData] = await pool.query('SELECT name FROM zones WHERE id = ?', [parseInt(workOrder[0].property_zone)]);
            if (zoneData.length > 0) zoneName = zoneData[0].name;
          }
          
          const { sendWorkOrderCompletedNotification } = require('../services/emailService');
          try {
            await sendWorkOrderCompletedNotification({
              orderId: id,
              orderNumber: workOrder[0].work_order_id,
              title: workOrder[0].title,
              propertyName: workOrder[0].property_name,
              propertyId: workOrder[0].property_code,
              customerName: workOrder[0].customer_name,
              customerEmail: workOrder[0].customer_email,
              customerPhone: workOrder[0].customer_phone,
              zoneName: zoneName,
              division: workOrder[0].division,
              categoryName: workOrder[0].category_name,
              subcategoryName: workOrder[0].subcategory_name,
              description: workOrder[0].description,
              closingNotes: workOrder[0].closing_notes,
              completedBy: 'Admin',
              completedByRole: 'Admin',
              completedAt: new Date(),
              franchisePartnerId: workOrder[0].franchise_partner_id,
              propertyZone: workOrder[0].property_zone
            });
            console.log('[Admin] Completion email sent');
          } catch (err) {
            console.error('[Admin] Completion email error:', err);
          }
        }
      }

      return res.json({ success: true, message: 'Status updated successfully' });
    } catch (dbError) {
      console.error('Status update DB error:', dbError.message);
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
      adminId,
      block,
      flatNumber,
      customerName,
      customerEmail,
      customerPhone,
      propertyName,
      propertyType
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
      const parsedSubId = parseInt(subcategoryId);
      const subcat = category.subcategories.find(s => s.id === parsedSubId);
      if (subcat) {
        subcategoryName = subcat.name;
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

    // Fetch actual property_id, franchise_partner_id, zone, and division from database
    let actualPropertyId = null;
    let finalPropertyName = propertyName;
    let finalPropertyType = propertyType;
    let propFranchisePartnerId = null;
    let propZone = null;
    let propDivision = null;
    const propId = propertyId && propertyId !== 'undefined' ? propertyId : null;
    
    if (propId) {
      const [propData] = await pool.query(
        `SELECT property_id, name, property_type, franchise_partner_id, zone_id as zone, division FROM properties WHERE id = ?`,
        [propId]
      );
      if (propData.length > 0) {
        actualPropertyId = propData[0].property_id;
        finalPropertyName = finalPropertyName || propData[0].name;
        finalPropertyType = finalPropertyType || propData[0].property_type;
        propFranchisePartnerId = propData[0].franchise_partner_id;
        propZone = propData[0].zone;
        propDivision = propData[0].division;
      } else {
        // Try onboarded_properties
        const [opData] = await pool.query(
          `SELECT property_id, community_name as name, property_type, franchise_partner_id, zone, division FROM onboarded_properties WHERE id = ?`,
          [propId]
        );
        if (opData.length > 0) {
          actualPropertyId = opData[0].property_id;
          finalPropertyName = finalPropertyName || opData[0].name;
          finalPropertyType = finalPropertyType || opData[0].property_type;
          propFranchisePartnerId = opData[0].franchise_partner_id;
          propZone = opData[0].zone;
          propDivision = opData[0].division;
        }
      }
    }

    // Fetch zone name from zones table if zone_id exists
    let propZoneName = propZone || null;
    if (propZone && !isNaN(parseInt(propZone))) {
      const [zoneData] = await pool.query('SELECT name FROM zones WHERE id = ?', [parseInt(propZone)]);
      if (zoneData.length > 0) {
        propZoneName = zoneData[0].name;
      }
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO work_orders (
          work_order_id, resident_id, property_id, unit_id,
          category_id, subcategory_id, category_name, subcategory_name,
          description, permission_to_enter, entry_notes, has_pet,
          customer_name, customer_email, customer_phone, property_name, property_type, block, flat_number,
          status, priority, source, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'admin', ?, NOW())`,
        [
          orderNumber,
          residentId && residentId !== 'undefined' ? residentId : null,
          propertyId && propertyId !== 'undefined' ? propertyId : null,
          unitId && unitId !== 'undefined' && !isNaN(parseInt(unitId)) ? parseInt(unitId) : null,
          parseInt(categoryId),
          parseInt(subcategoryId),
          category.name,
          subcategoryName,
          description || '',
          permissionToEnter === 'yes' ? 'yes' : 'no',
          entryNotes || '',
          hasPet === 'yes' ? 'yes' : 'no',
          customerName || null,
          customerEmail || null,
          customerPhone || null,
          propertyName || null,
          propertyType || null,
          block || null,
          flatNumber || null,
          priority || 'medium',
          adminId || null
        ]
      );

      const workOrderId = result.insertId;

      for (const att of attachments) {
        await pool.query(
          `INSERT INTO work_order_attachments (work_order_id, file_name, original_name, file_type, file_size, file_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [workOrderId, att.fileName, att.originalName, att.fileType, att.fileSize, att.filePath]
        );
      }

      await pool.query(
        `INSERT INTO work_order_history (work_order_id, to_status, changed_by_id, changed_by_type, notes)
         VALUES (?, 'pending', ?, 'admin', 'Work order created by admin')`,
        [workOrderId, adminId || null]
      );

      // Send email notification for new work order
      // Sends to: FP email + zone-centric employees + customer
      const { sendWorkOrderCreatedNotification } = require('../services/emailService');
      sendWorkOrderCreatedNotification({
        orderId: workOrderId,
        orderNumber,
        title: `Service Request - ${category.name}`,
        propertyName: finalPropertyName,
        propertyId: actualPropertyId || propertyId,
        propertyType: finalPropertyType,
        customerName,
        customerEmail,
        customerPhone,
        zoneName: propZoneName,
        division: propDivision,
        categoryName: category.name,
        subcategoryName,
        priority: priority || 'medium',
        description,
        createdBy: 'Admin',
        createdByRole: 'Admin',
        franchisePartnerId: propFranchisePartnerId,
        propertyZone: propZone,
        attachments: [] // Admin portal work orders don't have attachments yet
      }).catch(err => console.error('Email notification error:', err));

      return res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: { id: workOrderId, orderNumber, status: 'pending' }
      });
    } catch (dbError) {
      console.error('❌ Admin create DB error:', dbError.message);
      console.error('Full DB error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + dbError.message,
        error: dbError.message
      });
    }
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ success: false, message: 'Error creating work order', error: error.message });
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
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by_id, changed_by_type, notes)
         VALUES (?, 'pending', 'assigned', ?, 'admin', ?)`,
        [id, adminId || null, notes || 'Vendor assigned']
      );

      return res.json({ success: true, message: 'Vendor assigned successfully' });
    } catch (dbError) {
      console.error('Assign vendor DB error:', dbError);
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
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by_id, changed_by_type, notes)
         VALUES (?, ?, 'closed', ?, 'admin', ?)`,
        [id, current?.status || 'completed', adminId || null, notes || 'Work order closed']
      );

      return res.json({ success: true, message: 'Work order closed successfully' });
    } catch (dbError) {
      console.error('Close work order DB error:', dbError);
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
        `INSERT INTO work_order_history (work_order_id, from_status, to_status, changed_by_id, changed_by_type, notes)
         VALUES (?, 'closed', 'pending', ?, 'admin', ?)`,
        [id, adminId || null, reason || 'Work order reopened']
      );

      return res.json({ success: true, message: 'Work order reopened successfully' });
    } catch (dbError) {
      console.error('Reopen work order DB error:', dbError);
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
         LEFT JOIN admin_users a ON h.changed_by_id = a.id
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
