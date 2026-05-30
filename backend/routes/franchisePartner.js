/**
 * Franchise Partner API Routes
 * All routes are scoped to the logged-in FP's data only
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { ROLES, ROLE_NAMES, isFranchisePartner } = require('../config/roles');
const { 
  attachFPScope, 
  requireFPScope, 
  getFPIdForInsert,
  validateOwnership,
  buildScopedQuery 
} = require('../middleware/fpScope');
const { sendFPEmployeeWelcomeEmail } = require('../services/emailService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ============================================
// FP AUTHENTICATION (Public - No Auth Required)
// ============================================

// FP Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check franchise_partners table
    const [fps] = await pool.execute(
      `SELECT * FROM franchise_partners WHERE (username = ? OR email = ?) AND is_active = TRUE`,
      [username, username]
    );

    if (fps.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const fp = fps[0];
    const isValidPassword = await bcrypt.compare(password, fp.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.execute(
      `UPDATE franchise_partners SET last_login = NOW() WHERE id = ?`,
      [fp.id]
    );

    // Handle owner_name safely (might be null)
    const ownerName = fp.owner_name || fp.contact_person || fp.company_name || 'Franchise Partner';
    const nameParts = ownerName.split(' ');
    const firstName = nameParts[0] || 'Franchise';
    const lastName = nameParts.slice(1).join(' ') || 'Partner';

    // Generate token with FP info
    const token = generateToken({
      id: fp.id,
      fpId: fp.id,
      username: fp.username,
      email: fp.email,
      role: ROLES.FRANCHISE_PARTNER,
      firstName: firstName,
      lastName: lastName,
      franchisePartnerId: fp.id,
      companyName: fp.company_name
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: fp.id,
          fpId: fp.id,
          username: fp.username,
          email: fp.email,
          firstName: firstName,
          lastName: lastName,
          companyName: fp.company_name,
          role: ROLES.FRANCHISE_PARTNER,
          roleName: ROLE_NAMES[ROLES.FRANCHISE_PARTNER],
          franchisePartnerId: fp.id
        }
      }
    });
  } catch (error) {
    console.error('FP Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachFPScope);

// ============================================
// FP DASHBOARD
// ============================================

router.get('/dashboard', requireFPScope, async (req, res) => {
  try {
    const fpId = req.fpId;

    // Helper function to safely get count (handles missing tables)
    const safeCount = (query, params) => {
      return pool.execute(query, params)
        .then(([result]) => result[0]?.count || 0)
        .catch((e) => {
          console.log(`Dashboard query skipped (table may not exist): ${e.message}`);
          return 0;
        });
    };

    // Run all queries in parallel for faster response
    const [
      properties,
      vendors,
      customers,
      workOrderStats,
      estimates,
      employeeStats,
      workOrdersByRole,
      recentWorkOrders
    ] = await Promise.all([
      // Properties count
      safeCount('SELECT COUNT(*) as count FROM properties WHERE franchise_partner_id = ?', [fpId]),
      
      // Vendors count
      safeCount('SELECT COUNT(*) as count FROM vendors WHERE franchise_partner_id = ?', [fpId]),
      
      // Customers count
      safeCount('SELECT COUNT(*) as count FROM clients WHERE franchise_partner_id = ?', [fpId]),
      
      // Work orders - combined query
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
        FROM work_orders WHERE franchise_partner_id = ?
      `, [fpId]).then(([[r]]) => ({ total: r.total || 0, pending: r.pending || 0, completed: r.completed || 0 }))
        .catch(() => ({ total: 0, pending: 0, completed: 0 })),
      
      // Estimates count
      safeCount('SELECT COUNT(*) as count FROM estimates WHERE franchise_partner_id = ?', [fpId]),
      
      // Employee stats - combined query
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN role = 'manager' AND is_active = 1 THEN 1 ELSE 0 END) as managers,
          SUM(CASE WHEN role = 'coordinator' AND is_active = 1 THEN 1 ELSE 0 END) as coordinators,
          SUM(CASE WHEN role = 'supervisor' AND is_active = 1 THEN 1 ELSE 0 END) as supervisors,
          SUM(CASE WHEN role = 'executive' AND is_active = 1 THEN 1 ELSE 0 END) as executives
        FROM fp_employees WHERE franchise_partner_id = ?
      `, [fpId]).then(([[r]]) => ({
        total: r.total || 0,
        managers: r.managers || 0,
        coordinators: r.coordinators || 0,
        supervisors: r.supervisors || 0,
        executives: r.executives || 0
      })).catch(() => ({ total: 0, managers: 0, coordinators: 0, supervisors: 0, executives: 0 })),
      
      // Work orders by role - simplified without JOIN
      Promise.resolve({ managers: 0, coordinators: 0, supervisors: 0, executives: 0 }),
      
      // Recent work orders - simplified without fp_employees JOIN
      pool.execute(
        `SELECT wo.*, p.name as property_name, c.name as category_name,
                wo.created_by as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         WHERE wo.franchise_partner_id = ?
         ORDER BY wo.created_at DESC LIMIT 5`,
        [fpId]
      ).then(([rows]) => rows).catch(() => [])
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          properties,
          vendors,
          customers,
          workOrders: {
            total: workOrderStats.total,
            pending: workOrderStats.pending,
            completed: workOrderStats.completed,
            byRole: workOrdersByRole
          },
          estimates,
          employees: employeeStats.total,
          employeeRoles: {
            managers: employeeStats.managers,
            coordinators: employeeStats.coordinators,
            supervisors: employeeStats.supervisors,
            executives: employeeStats.executives
          }
        },
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data',
      error: error.message
    });
  }
});

// ============================================
// PROPERTY MANAGEMENT
// ============================================

// Get all FP properties
router.get('/properties', requireFPScope, async (req, res) => {
  try {
    // Fetch from properties table with creator name
    const [regularProperties] = await pool.execute(
      `SELECT p.*,
        p.zone_id as zone_name,
        p.division_id as division,
        p.area_name as area,
        COALESCE(p.number_of_units, p.number_of_blocks, 1) as units,
        p.block_names,
        p.units_per_block,
        p.villa_plot_number,
        p.landmark,
        p.latitude,
        p.longitude,
        COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
        'properties' as source_table
       FROM properties p
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR p.created_by = u.id
       WHERE p.franchise_partner_id = ?
       ORDER BY p.created_at DESC`,
      [req.fpId]
    );

    // Also fetch from onboarded_properties with creator name
    let onboardedProperties = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type as type,
                op.zone_id as zone_name, op.division, op.total_units as units,
                op.address, op.city, op.state, op.pincode as zip_code,
                op.contact_person, op.contact_phone, op.contact_email as email,
                COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                op.created_at, op.status,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
         WHERE op.franchise_partner_id = ? AND op.status = 'active'
         ORDER BY op.created_at DESC`,
        [req.fpId]
      );
      onboardedProperties = rows;
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    const allProperties = [...regularProperties, ...onboardedProperties];

    res.json({
      success: true,
      data: allProperties
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message
    });
  }
});

// Create property
router.post('/properties', requireFPScope, async (req, res) => {
  try {
    const {
      name, propertyType, address, city, state, zipCode,
      contactPerson, contactPhone, contactEmail, zoneId, divisionId
    } = req.body;

    const propertyId = `FP${req.fpId}-PROP-${Date.now()}`;
    
    // Get actual user name from database
    let creatorName = 'System';
    try {
      const [userRows] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ? OR email = ?',
        [req.user?.id, req.user?.email]
      );
      if (userRows.length > 0) {
        creatorName = `${userRows[0].first_name || ''} ${userRows[0].last_name || ''}`.trim() || 'System';
      }
    } catch (e) {
      console.log('Could not fetch creator name:', e.message);
    }

    const [result] = await pool.execute(
      `INSERT INTO properties (
        property_id, name, property_type, address, city, state, zip_code,
        contact_person, contact_phone, contact_email, zone_id, division_id,
        franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, divisionId || null,
        req.fpId, creatorName
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: { id: result.insertId, propertyId }
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: error.message
    });
  }
});

// Get single property by ID (for auto-populate in work orders)
router.get('/properties/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try properties table first
    const [properties] = await pool.execute(
      `SELECT p.*, p.contact_person, p.contact_phone, p.contact_email
       FROM properties p
       WHERE (p.id = ? OR p.property_id = ?) AND p.franchise_partner_id = ?`,
      [id, id, req.fpId]
    );
    
    if (properties.length > 0) {
      return res.json({ success: true, data: properties[0] });
    }
    
    // Try onboarded_properties table
    const [onboarded] = await pool.execute(
      `SELECT op.*, op.community_name as name, op.contact_person, op.contact_phone, op.contact_email
       FROM onboarded_properties op
       WHERE (op.id = ? OR op.property_id = ?) AND (op.franchise_partner_id = ? OR op.franchise_partner_id IS NULL)`,
      [id, id, req.fpId]
    );
    
    if (onboarded.length > 0) {
      return res.json({ success: true, data: onboarded[0] });
    }
    
    res.status(404).json({ success: false, message: 'Property not found' });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch property' });
  }
});

// Update property
router.put('/properties/:id', requireFPScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'property_type', 'address', 'city', 'state', 'zip_code',
      'contact_person', 'contact_phone', 'contact_email', 'zone_id', 'division_id', 'area_name', 'is_active'
    ];

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id, req.fpId);

    await pool.execute(
      `UPDATE properties SET ${setClauses.join(', ')} WHERE id = ? AND franchise_partner_id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Property updated successfully'
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update property',
      error: error.message
    });
  }
});

// Delete property
router.delete('/properties/:id', requireFPScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      `DELETE FROM properties WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WORK ORDERS
// ============================================

// Get all FP work orders (shows ALL work orders for FP visibility)
router.get('/work-orders', requireFPScope, async (req, res) => {
  try {
    const { status, priority } = req.query;
    console.log('[FP Work Orders GET] fpId:', req.fpId, 'status filter:', status);

    let query = `
      SELECT wo.*, 
        COALESCE(p.name, wo.property_name, op.community_name) as property_name,
        COALESCE(c.name, wo.category_name) as category_name,
        wo.subcategory_name,
        v.company_name as vendor_name,
        wo.customer_name,
        wo.customer_email,
        wo.customer_phone
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.property_id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
      WHERE (wo.franchise_partner_id = ? OR wo.franchise_partner_id IS NULL)
    `;
    const params = [req.fpId];

    if (status) {
      if (status === 'pending') {
        query += ` AND wo.status IN ('pending', 'assigned', 'in_progress')`;
      } else if (status === 'completed') {
        query += ` AND wo.status IN ('completed', 'closed')`;
      } else {
        query += ' AND wo.status = ?';
        params.push(status);
      }
    }

    if (priority) {
      query += ' AND wo.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY wo.created_at DESC LIMIT 500';

    const [workOrders] = await pool.execute(query, params);
    console.log('[FP Work Orders GET] Found:', workOrders.length, 'work orders');

    res.json({
      success: true,
      data: workOrders
    });
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch work orders',
      error: error.message
    });
  }
});

// Create work order (with file upload support)
router.post('/work-orders', requireFPScope, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      propertyId, categoryId, subcategoryId, description, priority,
      permissionToEnter, hasPet, entryNotes, customerName, customerEmail, customerPhone,
      categoryName: reqCategoryName, subcategoryName: reqSubcategoryName
    } = req.body;

    // Validate property belongs to FP - check both tables
    let property = [];
    
    // Check properties table first
    const [regularProp] = await pool.execute(
      'SELECT id, name FROM properties WHERE (id = ? OR property_id = ?) AND franchise_partner_id = ?',
      [propertyId, propertyId, req.fpId]
    );
    
    if (regularProp.length > 0) {
      property = regularProp;
    } else {
      // Check onboarded_properties table
      const [onboardedProp] = await pool.execute(
        'SELECT id, name FROM onboarded_properties WHERE (id = ? OR property_id = ?) AND franchise_partner_id = ?',
        [propertyId, propertyId, req.fpId]
      );
      property = onboardedProp;
    }

    if (property.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid property selection'
      });
    }

    const workOrderId = `FP${req.fpId}-WO-${Date.now()}`;
    const title = `Service Request - ${property[0].name || 'Property'}`;

    // Get category and subcategory names - use request body values or fetch from DB
    let categoryName = reqCategoryName || null;
    let subcategoryName = reqSubcategoryName || null;
    
    if (categoryId && !categoryName) {
      const [catResult] = await pool.execute('SELECT name FROM categories WHERE id = ?', [categoryId]);
      if (catResult.length > 0) categoryName = catResult[0].name;
    }
    
    if (subcategoryId && !subcategoryName) {
      const [subResult] = await pool.execute('SELECT name FROM subcategories WHERE id = ?', [subcategoryId]);
      if (subResult.length > 0) subcategoryName = subResult[0].name;
    }

    const [result] = await pool.execute(
      `INSERT INTO work_orders (
        work_order_id, property_id, category_id, subcategory_id, category_name, subcategory_name, 
        title, description, priority, permission_to_enter, has_pet, entry_notes, 
        customer_name, customer_email, customer_phone, status, franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        workOrderId, propertyId, categoryId || null, subcategoryId || null, categoryName, subcategoryName,
        title, description || '', priority || 'medium', permissionToEnter || 'no', hasPet || 'no', 
        entryNotes || null, customerName || null, customerEmail || null, customerPhone || null,
        req.fpId, req.user?.id || null
      ]
    );

    // Save attachments if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.execute(
          `INSERT INTO work_order_attachments (work_order_id, file_name, file_path, file_type, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [result.insertId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Work order created successfully',
      data: { id: result.insertId, workOrderId }
    });
  } catch (error) {
    console.error('Create work order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create work order',
      error: error.message
    });
  }
});

// Update work order status
router.patch('/work-orders/:id/status', requireFPScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    await pool.execute(
      `UPDATE work_orders SET status = ?, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [status, id, req.fpId]
    );

    // Log status change
    await pool.execute(
      `INSERT INTO work_order_status_history (work_order_id, to_status, changed_by, changed_by_role, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, status, req.user.id, req.user.role, notes || null]
    );

    res.json({
      success: true,
      message: 'Work order status updated'
    });
  } catch (error) {
    console.error('Update work order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work order status',
      error: error.message
    });
  }
});

// Assign vendor to work order
router.patch('/work-orders/:id/assign-vendor', requireFPScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    // Validate vendor belongs to FP or is assigned to FP
    const [vendor] = await pool.execute(
      `SELECT id FROM vendors WHERE id = ? AND (franchise_partner_id = ? OR id IN (
        SELECT vendor_id FROM fp_assigned_vendors WHERE franchise_partner_id = ? AND is_active = TRUE
      ))`,
      [vendorId, req.fpId, req.fpId]
    );

    if (vendor.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid vendor selection'
      });
    }

    await pool.execute(
      `UPDATE work_orders 
       SET assigned_vendor_id = ?, assigned_at = NOW(), assigned_by = ?, status = 'assigned'
       WHERE id = ? AND franchise_partner_id = ?`,
      [vendorId, req.user.id, id, req.fpId]
    );

    res.json({
      success: true,
      message: 'Vendor assigned successfully'
    });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign vendor',
      error: error.message
    });
  }
});

// Update work order status (PUT)
router.put('/work-orders/:id/status', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.execute(
      `UPDATE work_orders SET status = ?, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [status, id, req.fpId]
    );

    // Log status change
    try {
      await pool.execute(
        `INSERT INTO work_order_status_history (work_order_id, to_status, changed_by, changed_by_role)
         VALUES (?, ?, ?, ?)`,
        [id, status, req.user.id, req.user.role]
      );
    } catch (e) {
      // Ignore if history table doesn't exist
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete work order
router.delete('/work-orders/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete work orders that belong to this FP or have no FP assigned
    const [result] = await pool.execute(
      `DELETE FROM work_orders WHERE id = ? AND (franchise_partner_id = ? OR franchise_partner_id IS NULL)`,
      [id, req.fpId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Work order not found or access denied' });
    }

    res.json({ success: true, message: 'Work order deleted' });
  } catch (error) {
    console.error('Delete work order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// Get all FP customers
// Combines data from both clients table (legacy) and customer_accounts + properties (new form)
router.get('/customers', requireFPScope, async (req, res) => {
  try {
    // Get legacy clients
    const [legacyClients] = await pool.execute(
      `SELECT c.*, p.name as property_name, 'client' as source_type
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.franchise_partner_id = ?`,
      [req.fpId]
    );

    // Get customers from customer_accounts linked to FP properties
    const [accountCustomers] = await pool.execute(
      `SELECT 
         ca.id, ca.customer_id as client_id, 
         COALESCE(ca.name, CONCAT(ca.first_name, ' ', ca.last_name)) as name,
         ca.email, ca.phone, ca.country_code,
         p.name as property_name, p.property_id as property_code,
         p.address, p.city, p.state, p.zip_code as postalCode,
         ca.is_activated, ca.is_active,
         ca.created_at, ca.updated_at,
         'customer_account' as source_type
       FROM customer_accounts ca
       INNER JOIN properties p ON ca.property_id = p.id
       WHERE ca.franchise_partner_id = ?`,
      [req.fpId]
    );

    // Get customers from customer_accounts linked to onboarded_properties (admin-created)
    const [adminCustomers] = await pool.execute(
      `SELECT 
         ca.id, ca.customer_id as client_id, 
         COALESCE(ca.name, CONCAT(ca.first_name, ' ', ca.last_name)) as name,
         ca.email, ca.phone, ca.country_code,
         op.community_name as property_name, op.property_id as property_code,
         op.address, op.city, op.state, op.postal_code as postalCode,
         ca.is_activated, ca.is_active,
         ca.created_at, ca.updated_at,
         'admin_created' as source_type
       FROM customer_accounts ca
       INNER JOIN onboarded_properties op ON ca.property_id = op.id
       WHERE ca.franchise_partner_id IS NULL`
    );

    // Combine and sort by created_at
    const allCustomers = [...legacyClients, ...accountCustomers, ...adminCustomers]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: allCustomers
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
});

// Create customer with property
router.post('/customers', requireFPScope, async (req, res) => {
  try {
    const {
      // Property form data
      zone, areaName, division, propertyType, communityName,
      associationContacts, numberOfBlocks, unitsPerBlock, blockNames,
      numberOfUnits, villaPlotNumber, blockInfo, blockNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      // Simple customer data (for backward compatibility)
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    // Check if this is a property form submission (has zone/communityName)
    if (zone && communityName) {
      // Generate IDs
      const propertyIdGen = `GC-Y001-${Date.now()}`;
      const clientId = `FP${req.fpId}-CLT-${Date.now()}`;
      
      // Get contact info
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      // Create property first (zone_id and division_id store names as VARCHAR)
      const [propertyResult] = await pool.execute(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          req.fpId, req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || ''
        ]
      );

      // Create customer account if email provided
      let customerResult = null;
      if (contactEmail) {
        // Generate temp password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        // Check if customer already exists
        const [existing] = await pool.execute(
          'SELECT id FROM customer_accounts WHERE email = ?', [contactEmail]
        );
        
        if (existing.length === 0) {
          [customerResult] = await pool.execute(
            `INSERT INTO customer_accounts (
              customer_id, name, email, phone, password_hash, property_id,
              franchise_partner_id, is_activated, temp_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientId, contactName, contactEmail, `${contactCountryCode}${contactPhone}`,
              hashedPassword, propertyResult.insertId, req.fpId, 0, tempPassword
            ]
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully',
        data: { 
          propertyId: propertyIdGen,
          clientId,
          customerId: customerResult?.insertId || null
        }
      });
    } else {
      // Simple customer creation (backward compatibility)
      const clientId = `FP${req.fpId}-CLT-${Date.now()}`;

      const [result] = await pool.execute(
        `INSERT INTO clients (
          client_id, name, email, phone, alternate_phone, address, city, state, zip_code,
          client_type, company_name, property_id, gst_number, franchise_partner_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber,
          req.fpId, req.user.id
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: { id: result.insertId, clientId }
      });
    }
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
});

// Get customer accounts for FP
// Includes both FP-created customers AND admin-created customers (from onboarded_properties)
router.get('/customer-accounts', requireFPScope, async (req, res) => {
  try {
    const [accounts] = await pool.execute(
      `SELECT ca.*, 
              COALESCE(p.name, op.community_name) as property_name, 
              COALESCE(p.property_id, op.property_id) as property_code,
              CASE WHEN ca.franchise_partner_id IS NULL THEN 'admin' ELSE 'fp' END as created_source
       FROM customer_accounts ca
       LEFT JOIN properties p ON ca.property_id = p.id AND ca.franchise_partner_id IS NOT NULL
       LEFT JOIN onboarded_properties op ON ca.property_id = op.id AND ca.franchise_partner_id IS NULL
       WHERE ca.franchise_partner_id = ? OR ca.franchise_partner_id IS NULL
       ORDER BY ca.created_at DESC`,
      [req.fpId]
    );
    
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Get customer accounts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Activate customer account
router.post('/customer-accounts/:id/activate', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate new temp password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await pool.execute(
      `UPDATE customer_accounts 
       SET is_activated = 1, password_hash = ?, temp_password = ?, updated_at = NOW()
       WHERE id = ? AND (franchise_partner_id = ? OR franchise_partner_id IS NULL)`,
      [hashedPassword, tempPassword, id, req.fpId]
    );
    
    // Get customer details for email
    const [[customer]] = await pool.execute(
      'SELECT name, email FROM customer_accounts WHERE id = ?', [id]
    );
    
    // TODO: Send activation email with temp password
    
    res.json({ 
      success: true, 
      message: 'Customer account activated',
      data: { tempPassword } // Return temp password for manual sharing if needed
    });
  } catch (error) {
    console.error('Activate customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Deactivate customer account
router.post('/customer-accounts/:id/deactivate', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      `UPDATE customer_accounts SET is_activated = 0, updated_at = NOW()
       WHERE id = ? AND (franchise_partner_id = ? OR franchise_partner_id IS NULL)`,
      [id, req.fpId]
    );
    
    res.json({ success: true, message: 'Customer account deactivated' });
  } catch (error) {
    console.error('Deactivate customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Resend activation email
router.post('/customer-accounts/:id/resend-activation', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate new temp password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await pool.execute(
      `UPDATE customer_accounts SET password_hash = ?, temp_password = ?, updated_at = NOW()
       WHERE id = ? AND (franchise_partner_id = ? OR franchise_partner_id IS NULL)`,
      [hashedPassword, tempPassword, id, req.fpId]
    );
    
    // Get customer email
    const [[customer]] = await pool.execute(
      'SELECT name, email FROM customer_accounts WHERE id = ?', [id]
    );
    
    // TODO: Send email with new temp password
    
    res.json({ 
      success: true, 
      message: 'New activation credentials generated',
      data: { tempPassword, email: customer?.email }
    });
  } catch (error) {
    console.error('Resend activation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get all FP vendors (own + assigned)
router.get('/vendors', requireFPScope, async (req, res) => {
  try {
    const [ownVendors] = await pool.execute(
      `SELECT v.*, 'own' as vendor_type
       FROM vendors v
       WHERE v.franchise_partner_id = ?`,
      [req.fpId]
    );

    const [assignedVendors] = await pool.execute(
      `SELECT v.*, 'assigned' as vendor_type, fav.assigned_at
       FROM vendors v
       INNER JOIN fp_assigned_vendors fav ON v.id = fav.vendor_id
       WHERE fav.franchise_partner_id = ? AND fav.is_active = TRUE`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: {
        own: ownVendors,
        assigned: assignedVendors,
        all: [...ownVendors, ...assignedVendors]
      }
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors',
      error: error.message
    });
  }
});

// Create vendor
router.post('/vendors', requireFPScope, async (req, res) => {
  try {
    const {
      companyName, contactPerson, email, phone, alternatePhone,
      address, city, state, zipCode, serviceCategories,
      gstNumber, panNumber
    } = req.body;

    const vendorId = `FP${req.fpId}-VND-${Date.now()}`;
    const username = `vendor_${Date.now()}`;
    const tempPassword = await bcrypt.hash('temp123', 10);

    const [result] = await pool.execute(
      `INSERT INTO vendors (
        vendor_id, username, email, password_hash, company_name, contact_person,
        phone, alternate_phone, address, city, state, zip_code, service_categories,
        gst_number, pan_number, franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId, username, email, tempPassword, companyName, contactPerson,
        phone, alternatePhone, address, city, state, zipCode,
        JSON.stringify(serviceCategories || []), gstNumber, panNumber,
        req.fpId, req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: { id: result.insertId, vendorId }
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vendor',
      error: error.message
    });
  }
});

// Update/Modify vendor
router.put('/vendors/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      companyName, contactPerson, email, phone, alternatePhone,
      address, city, state, zipCode, serviceCategories,
      gstNumber, panNumber, status
    } = req.body;

    // Verify vendor belongs to this FP
    const [existing] = await pool.execute(
      'SELECT id FROM vendors WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or access denied'
      });
    }

    await pool.execute(
      `UPDATE vendors SET 
        company_name = COALESCE(?, company_name),
        contact_person = COALESCE(?, contact_person),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        alternate_phone = COALESCE(?, alternate_phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        zip_code = COALESCE(?, zip_code),
        service_categories = COALESCE(?, service_categories),
        gst_number = COALESCE(?, gst_number),
        pan_number = COALESCE(?, pan_number),
        status = COALESCE(?, status),
        updated_at = NOW()
      WHERE id = ? AND franchise_partner_id = ?`,
      [
        companyName, contactPerson, email, phone, alternatePhone,
        address, city, state, zipCode,
        serviceCategories ? JSON.stringify(serviceCategories) : null,
        gstNumber, panNumber, status,
        id, req.fpId
      ]
    );

    res.json({
      success: true,
      message: 'Vendor updated successfully'
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor',
      error: error.message
    });
  }
});

// Delete vendor (soft delete)
router.delete('/vendors/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify vendor belongs to this FP
    const [existing] = await pool.execute(
      'SELECT id FROM vendors WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or access denied'
      });
    }

    await pool.execute(
      `UPDATE vendors SET status = 'deleted', is_active = FALSE, updated_at = NOW() 
       WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vendor',
      error: error.message
    });
  }
});

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

// Get all FP employees
router.get('/employees', requireFPScope, async (req, res) => {
  try {
    console.log('Fetching FP employees for FP ID:', req.fpId);
    
    // Get employees first
    const [employees] = await pool.execute(
      `SELECT e.*, CONCAT(e.first_name, ' ', e.last_name) as name
       FROM fp_employees e
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       ORDER BY e.created_at DESC`,
      [req.fpId]
    );

    // Get zone assignments separately
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?`,
      [req.fpId]
    );

    // Build a map of employee zones
    const employeeZonesMap = {};
    zoneAssignments.forEach(za => {
      if (!employeeZonesMap[za.fp_employee_id]) {
        employeeZonesMap[za.fp_employee_id] = [];
      }
      if (za.zone_name) {
        employeeZonesMap[za.fp_employee_id].push(za.zone_name);
      }
    });

    // Transform employees with their zones
    const transformedEmployees = employees.map(emp => ({
      ...emp,
      assigned_zones: employeeZonesMap[emp.id] || []
    }));

    console.log('Employees found:', transformedEmployees.length);

    res.json({
      success: true,
      data: transformedEmployees
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// Helper function to generate temporary password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper function to generate GLOBAL SEQUENTIAL user ID
// All FP-created staff share the same sequence as Admin-created staff (001, 002, 003...)
const generateUserId = async (role) => {
  const employeeRoles = ['manager', 'coordinator', 'supervisor', 'executive'];
  const isEmployee = employeeRoles.includes(role);
  
  try {
    if (isEmployee) {
      // For employees: Generate numeric-only ID (001, 002, 003...) - GLOBAL sequence
      const [rows] = await pool.execute(
        `SELECT user_id FROM users 
         WHERE role IN ('manager', 'coordinator', 'supervisor', 'executive') 
         AND user_id REGEXP '^[0-9]+$'
         ORDER BY CAST(user_id AS UNSIGNED) DESC LIMIT 1`
      );
      
      let nextSequence = 1;
      if (rows.length > 0) {
        const existingId = rows[0].user_id;
        const numericPart = parseInt(existingId, 10);
        if (!isNaN(numericPart)) {
          nextSequence = numericPart + 1;
        }
      }
      
      // Format with leading zeros (3 digits minimum)
      return String(nextSequence).padStart(3, '0');
    }
    
    // For non-employees: Use FPE prefix
    const prefix = 'FPE';
    const [rows] = await pool.execute(
      `SELECT user_id FROM users WHERE user_id LIKE ? ORDER BY user_id DESC LIMIT 1`,
      [`${prefix}%`]
    );
    
    let nextSequence = 1;
    if (rows.length > 0) {
      const existingId = rows[0].user_id;
      const numericPart = parseInt(existingId.replace(prefix, ''), 10);
      if (!isNaN(numericPart)) {
        nextSequence = numericPart + 1;
      }
    }
    
    return `${prefix}${String(nextSequence).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating user ID:', error);
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return isEmployee ? `${Date.now() % 100000}` : `FPE-${timestamp}${random}`;
  }
};

// Create employee with full onboarding (user account + email)
router.post('/employees', requireFPScope, async (req, res) => {
  try {
    const {
      name, email, phone, countryCode, aadhaar, role, assignedZones
    } = req.body;

    // Validate required email field
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required for employee account creation',
        field: 'email'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        field: 'email'
      });
    }

    // Check if email already exists in users table
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
        field: 'email'
      });
    }

    // Check if email exists in fp_employees table
    const [existingEmployee] = await pool.execute(
      'SELECT id FROM fp_employees WHERE email = ? AND franchise_partner_id = ?',
      [email.trim().toLowerCase(), req.fpId]
    );

    if (existingEmployee.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An employee with this email already exists',
        field: 'email'
      });
    }

    // Parse name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate sequential employee code (001, 002, 003...)
    const [maxEmpCode] = await pool.execute(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?`,
      [req.fpId]
    );
    const nextSeq = (maxEmpCode[0].count || 0) + 1;
    const employeeCode = String(nextSeq).padStart(3, '0');
    
    const userId = await generateUserId(role || 'executive');  // Global sequential ID
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Generate username from email (part before @)
    const username = email.trim().toLowerCase().split('@')[0] + '_' + Date.now().toString(36);

    // Get FP company name for email
    const [fpData] = await pool.execute(
      'SELECT company_name FROM franchise_partners WHERE id = ?',
      [req.fpId]
    );
    const companyName = fpData.length > 0 ? fpData[0].company_name : 'Franchise Partner';

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Map FP role to user role
      const userRole = role === 'manager' ? 'manager' :
                       role === 'supervisor' ? 'supervisor' : 
                       role === 'coordinator' ? 'coordinator' : 
                       role === 'executive' ? 'executive' : 'fp_executive';

      // 1. Create user account in users table with must_change_password flag
      const [userResult] = await connection.execute(
        `INSERT INTO users (
          user_id, username, email, password_hash, first_name, last_name, phone, 
          role, franchise_partner_id, must_change_password, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?)`,
        [
          userId, 
          username, 
          email.trim().toLowerCase(), 
          passwordHash, 
          firstName, 
          lastName, 
          phone || null,
          userRole,
          req.fpId,
          req.user.id
        ]
      );

      // 2. Create fp_employees record
      const [empResult] = await connection.execute(
        `INSERT INTO fp_employees (
          franchise_partner_id, employee_code, first_name, last_name, email, phone, 
          country_code, aadhaar, role, username, password_hash, user_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          req.fpId, 
          employeeCode, 
          firstName, 
          lastName, 
          email.trim().toLowerCase(), 
          phone || null,
          countryCode || '+91',
          aadhaar || null,
          role || 'fp_executive',
          username,
          passwordHash,
          userResult.insertId
        ]
      );

      // 3. Assign zones if provided (store zone names directly)
      if (assignedZones && assignedZones.length > 0) {
        for (const zoneName of assignedZones) {
          await connection.execute(
            `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name)
             VALUES (?, ?, ?)`,
            [req.fpId, empResult.insertId, zoneName]
          );
        }
      }

      await connection.commit();
      connection.release();

      // 4. Send welcome email with temporary password and login instructions
      const portalUrl = process.env.ADMIN_PORTAL_URL || 'http://localhost:5174';
      const emailResult = await sendFPEmployeeWelcomeEmail({
        email: email.trim().toLowerCase(),
        firstName,
        lastName,
        username,
        userId,
        tempPassword,
        companyName,
        role: role || 'fp_executive',
        loginUrl: portalUrl
      });

      res.status(201).json({
        success: true,
        message: 'Employee account created successfully. Login credentials have been sent to the employee\'s email.',
        data: { 
          id: empResult.insertId, 
          employeeId: employeeCode,
          userId: userId,
          email: email.trim().toLowerCase(),
          emailSent: emailResult.success,
          emailMessage: emailResult.success 
            ? 'Welcome email sent successfully with login instructions'
            : 'Account created but email delivery failed. Please share credentials manually.'
        }
      });
    } catch (dbError) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Create employee error:', error);
    
    // Handle duplicate entry errors
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('email')) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists',
          field: 'email'
        });
      }
      if (error.message.includes('username')) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists. Please try again.',
          field: 'email'
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create employee account',
      error: error.message
    });
  }
});

// Get single employee for editing
router.get('/employees/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const [employees] = await pool.execute(
      `SELECT e.*, CONCAT(e.first_name, ' ', e.last_name) as name
       FROM fp_employees e
       WHERE e.id = ? AND e.franchise_partner_id = ?`,
      [id, req.fpId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    res.json({ success: true, data: employees[0] });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee details
router.put('/employees/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, countryCode, aadhaar, role } = req.body;
    
    // Verify employee belongs to this FP
    const [existing] = await pool.execute(
      'SELECT id, user_id FROM fp_employees WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    // Update fp_employees table
    await pool.execute(
      `UPDATE fp_employees SET 
        first_name = ?, last_name = ?, email = ?, phone = ?, 
        country_code = ?, aadhaar = ?, role = ?, updated_at = NOW()
       WHERE id = ? AND franchise_partner_id = ?`,
      [firstName, lastName, email, phone, countryCode || '+91', aadhaar || null, role || 'field_staff', id, req.fpId]
    );
    
    // Also update linked user account if exists
    if (existing[0].user_id) {
      await pool.execute(
        `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?`,
        [firstName, lastName, email, phone, existing[0].user_id]
      );
    }
    
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee status (activate/deactivate)
router.put('/employees/:id/status', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isActive = status === 'active' ? 1 : 0;
    
    // Get employee to find linked user_id
    const [employees] = await pool.execute(
      `SELECT user_id FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Update fp_employees table
    await pool.execute(
      `UPDATE fp_employees SET status = ?, is_active = ? WHERE id = ? AND franchise_partner_id = ?`,
      [status, isActive, id, req.fpId]
    );

    // Also update linked user account if exists
    if (employees[0].user_id) {
      await pool.execute(
        `UPDATE users SET is_active = ? WHERE id = ?`,
        [isActive, employees[0].user_id]
      );
    }
    
    res.json({ 
      success: true, 
      message: status === 'active' ? 'Employee account activated' : 'Employee account deactivated'
    });
  } catch (error) {
    console.error('Update employee status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete employee
router.delete('/employees/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get employee to find linked user_id
    const [employees] = await pool.execute(
      `SELECT user_id, first_name, last_name FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = employees[0];
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete zone assignments first
      await connection.execute(
        `DELETE FROM fp_employee_zones WHERE fp_employee_id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );

      // Delete from fp_employees table
      await connection.execute(
        `DELETE FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );

      // Also delete linked user account if exists
      if (employee.user_id) {
        await connection.execute(
          `DELETE FROM users WHERE id = ?`,
          [employee.user_id]
        );
      }

      await connection.commit();
      connection.release();

      res.json({ 
        success: true, 
        message: `Employee ${employee.first_name} ${employee.last_name} has been permanently deleted`
      });
    } catch (dbError) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee zones
router.put('/employees/:id/zones', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { zones } = req.body;
    
    console.log('Updating zones for employee:', id, 'FP:', req.fpId, 'Zones:', zones);
    
    // Delete existing zone assignments
    await pool.execute(
      `DELETE FROM fp_employee_zones WHERE fp_employee_id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );
    
    // Insert new zone assignments - store zone names directly since zones can come from multiple sources
    if (zones && zones.length > 0) {
      for (const zoneName of zones) {
        // Store zone name directly in the assignment table
        await pool.execute(
          `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name) VALUES (?, ?, ?)`,
          [req.fpId, id, zoneName]
        );
        console.log('Inserted zone assignment:', { fpId: req.fpId, empId: id, zoneName });
      }
    }
    
    res.json({ success: true, message: 'Employee zones updated' });
  } catch (error) {
    console.error('Update employee zones error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// STAFF MANAGEMENT (FP Portal Staff - Manager, Coordinator, Supervisor, Executive)
// ============================================

// FP Staff Roles (allowed roles for FP to create)
const FP_STAFF_ROLES = {
  manager: {
    label: 'Manager',
    description: 'Manages work orders, vendors, estimates, and schedules'
  },
  coordinator: {
    label: 'Coordinator',
    description: 'Manages assigned properties, work orders, and field operations'
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Creates work order requests and tracks progress'
  },
  executive: {
    label: 'Executive',
    description: 'Basic data collection - Adds client and vendor details'
  }
};

// Helper function to generate staff user ID - uses global sequential IDs
// Reuses generateUserId for consistency
const generateStaffUserId = async (role) => {
  return await generateUserId(role);
};

// Helper function to generate staff temp password
const generateStaffTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Get all FP staff members
router.get('/staff', requireFPScope, async (req, res) => {
  try {
    const { role, isActive } = req.query;
    
    let query = `
      SELECT u.id, u.user_id, u.username, u.email, u.first_name, u.last_name, 
             u.phone, u.role, u.is_active, u.created_at, u.last_login,
             u.must_change_password,
             CONCAT(c.first_name, ' ', c.last_name) as created_by_name
      FROM users u
      LEFT JOIN users c ON u.created_by = c.id
      WHERE u.franchise_partner_id = ?
      AND u.role IN ('manager', 'coordinator', 'supervisor', 'executive')
    `;
    const params = [req.fpId];

    if (role && FP_STAFF_ROLES[role]) {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ` AND u.is_active = ?`;
      params.push(isActive === 'true');
    }

    query += ` ORDER BY u.created_at DESC`;

    const [staff] = await pool.execute(query, params);

    // Format the response similar to admin UserManagement
    const formattedStaff = staff.map(s => ({
      id: s.id,
      userId: s.user_id,
      username: s.username,
      email: s.email,
      firstName: s.first_name,
      lastName: s.last_name,
      phone: s.phone,
      role: s.role,
      roleName: FP_STAFF_ROLES[s.role]?.label || s.role,
      isActive: s.is_active === 1 || s.is_active === true,
      lastLogin: s.last_login,
      createdBy: s.created_by_name,
      createdAt: s.created_at,
      mustChangePassword: s.must_change_password
    }));

    res.json({
      success: true,
      data: formattedStaff
    });
  } catch (error) {
    console.error('Get FP staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members',
      error: error.message
    });
  }
});

// Get single FP staff member
router.get('/staff/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    const [staff] = await pool.execute(
      `SELECT u.*, CONCAT(c.first_name, ' ', c.last_name) as created_by_name
       FROM users u
       LEFT JOIN users c ON u.created_by = c.id
       WHERE u.id = ? AND u.franchise_partner_id = ?
       AND u.role IN ('manager', 'coordinator', 'supervisor', 'executive')`,
      [id, req.fpId]
    );

    if (staff.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const s = staff[0];
    res.json({
      success: true,
      data: {
        id: s.id,
        userId: s.user_id,
        username: s.username,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        phone: s.phone,
        role: s.role,
        roleName: FP_STAFF_ROLES[s.role]?.label || s.role,
        isActive: s.is_active === 1 || s.is_active === true,
        lastLogin: s.last_login,
        createdBy: s.created_by_name,
        createdAt: s.created_at
      }
    });
  } catch (error) {
    console.error('Get FP staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff member',
      error: error.message
    });
  }
});

// Create FP staff member with auto-generated password and email notification
router.post('/staff', requireFPScope, async (req, res) => {
  try {
    const { username, email, firstName, lastName, phone, role, sendEmail = true } = req.body;

    // Validation
    if (!username || !email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, first name, last name, and role are required'
      });
    }

    // Validate role - only allow FP staff roles
    if (!FP_STAFF_ROLES[role]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: manager, coordinator, supervisor, executive'
      });
    }

    // Check if username or email already exists
    const [existing] = await pool.execute(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username, email.toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Generate unique User ID (global sequential) and temporary password
    const userId = await generateStaffUserId(role);
    const tempPassword = generateStaffTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Insert new staff member
    const [result] = await pool.execute(
      `INSERT INTO users (
        user_id, username, email, password_hash, first_name, last_name, phone, role,
        franchise_partner_id, must_change_password, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?)`,
      [
        userId, username, email.toLowerCase(), passwordHash, 
        firstName, lastName, phone || null, role,
        req.fpId, req.user.id
      ]
    );

    // Get FP company name for email
    let companyName = 'Franchise Partner';
    try {
      const [fpData] = await pool.execute(
        'SELECT company_name FROM franchise_partners WHERE id = ?',
        [req.fpId]
      );
      if (fpData.length > 0) {
        companyName = fpData[0].company_name;
      }
    } catch (e) {
      console.log('Could not fetch FP company name');
    }

    // Send welcome email with temporary password
    let emailSent = false;
    if (sendEmail) {
      try {
        const emailResult = await sendFPEmployeeWelcomeEmail({
          email: email.toLowerCase(),
          firstName,
          lastName,
          username,
          userId,
          tempPassword,
          companyName,
          role,
          loginUrl: process.env.ADMIN_PORTAL_URL || 'http://localhost:5174'
        });
        emailSent = emailResult.success;
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Staff member created successfully. Welcome email sent with login credentials.' 
        : 'Staff member created successfully. Email notification could not be sent.',
      data: {
        id: result.insertId,
        userId,
        username,
        email: email.toLowerCase(),
        role,
        roleName: FP_STAFF_ROLES[role].label,
        emailSent
      }
    });
  } catch (error) {
    console.error('Create FP staff error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create staff member',
      error: error.message
    });
  }
});

// Update FP staff member
router.put('/staff/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, firstName, lastName, phone, role, isActive } = req.body;

    // Check if staff exists and belongs to this FP
    const [existing] = await pool.execute(
      `SELECT id, role FROM users WHERE id = ? AND franchise_partner_id = ?
       AND role IN ('manager', 'coordinator', 'supervisor', 'executive')`,
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check for duplicate username/email
    if (username || email) {
      const [duplicates] = await pool.execute(
        `SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?`,
        [username || '', email || '', id]
      );

      if (duplicates.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists'
        });
      }
    }

    // Validate role if changing
    if (role && !FP_STAFF_ROLES[role]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: manager, coordinator, supervisor, executive'
      });
    }

    // Build update query
    let updateFields = [];
    let params = [];

    if (username) { updateFields.push('username = ?'); params.push(username); }
    if (email) { updateFields.push('email = ?'); params.push(email.toLowerCase()); }
    if (firstName) { updateFields.push('first_name = ?'); params.push(firstName); }
    if (lastName) { updateFields.push('last_name = ?'); params.push(lastName); }
    if (phone !== undefined) { updateFields.push('phone = ?'); params.push(phone); }
    if (role) { updateFields.push('role = ?'); params.push(role); }
    if (isActive !== undefined) { updateFields.push('is_active = ?'); params.push(isActive); }

    // Update password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
      updateFields.push('must_change_password = FALSE');
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateFields.push('updated_at = NOW()');
    params.push(id, req.fpId);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND franchise_partner_id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Staff member updated successfully'
    });
  } catch (error) {
    console.error('Update FP staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message
    });
  }
});

// Delete FP staff member
router.delete('/staff/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if staff exists and belongs to this FP
    const [existing] = await pool.execute(
      `SELECT id, email, role FROM users WHERE id = ? AND franchise_partner_id = ?
       AND role IN ('manager', 'coordinator', 'supervisor', 'executive')`,
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Permanently delete the staff member
    const [result] = await pool.execute(
      `DELETE FROM users WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    console.log(`🗑️ FP Staff permanently deleted: ID ${id}, Email: ${existing[0].email}, FP: ${req.fpId}`);

    res.json({
      success: true,
      message: 'Staff member permanently deleted successfully'
    });
  } catch (error) {
    console.error('Delete FP staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member',
      error: error.message
    });
  }
});

// Get FP staff roles list
router.get('/staff-roles', requireFPScope, async (req, res) => {
  try {
    const roles = Object.entries(FP_STAFF_ROLES).map(([key, value]) => ({
      value: key,
      label: value.label,
      description: value.description
    }));

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching roles',
      error: error.message
    });
  }
});

// ============================================
// LEGACY USER MANAGEMENT (FP Portal Users - fp_users table)
// ============================================

// Get all FP users (legacy)
router.get('/users', requireFPScope, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, username, email, first_name, last_name, phone, role, is_active, created_at, last_login
       FROM fp_users
       WHERE franchise_partner_id = ?
       ORDER BY created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Create FP user (legacy)
router.post('/users', requireFPScope, async (req, res) => {
  try {
    const {
      username, email, password, firstName, lastName, phone, role
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO fp_users (
        franchise_partner_id, username, email, password_hash, first_name, last_name, phone, role, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.fpId, username, email, hashedPassword, firstName, lastName, phone, role || 'fp_executive', req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// ============================================
// ESTIMATES & AMC MANAGEMENT
// ============================================

// Get all FP estimates
router.get('/estimates', requireFPScope, async (req, res) => {
  try {
    const { status, archived } = req.query;

    let query = `
      SELECT e.*, c.name as client_name, p.name as property_name
       FROM estimates e
       LEFT JOIN clients c ON e.client_id = c.id
       LEFT JOIN properties p ON e.property_id = p.id
       WHERE e.franchise_partner_id = ?
    `;
    const params = [req.fpId];

    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    if (archived === 'true') {
      query += ' AND e.status = "archived"';
    } else if (archived === 'false') {
      query += ' AND e.status != "archived"';
    }

    query += ' ORDER BY e.created_at DESC';

    const [estimates] = await pool.execute(query, params);

    res.json({
      success: true,
      data: estimates
    });
  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch estimates',
      error: error.message
    });
  }
});

// Create estimate
router.post('/estimates', requireFPScope, async (req, res) => {
  try {
    const {
      clientId, propertyId, title, description, estimateType,
      subtotal, taxPercentage, discountPercentage, validUntil, items
    } = req.body;

    const estimateId = `FP${req.fpId}-EST-${Date.now()}`;
    const taxAmount = (subtotal * (taxPercentage || 18)) / 100;
    const discountAmount = (subtotal * (discountPercentage || 0)) / 100;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const [result] = await pool.execute(
      `INSERT INTO estimates (
        estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount,
        total_amount, valid_until, franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estimateId, clientId || null, propertyId || null, title, description,
        estimateType || 'property_based', subtotal || 0, taxPercentage || 18,
        taxAmount, discountPercentage || 0, discountAmount, totalAmount,
        validUntil || null, req.fpId, req.user.id
      ]
    );

    // Add estimate items
    if (items && items.length > 0) {
      for (const item of items) {
        await pool.execute(
          `INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [result.insertId, item.description, item.quantity || 1, item.unitPrice || 0, item.totalPrice || 0]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Estimate created successfully',
      data: { id: result.insertId, estimateId }
    });
  } catch (error) {
    console.error('Create estimate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create estimate',
      error: error.message
    });
  }
});

// Archive estimate
router.put('/estimates/:id/archive', requireFPScope, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE fp_estimates SET is_archived = 1, archived_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [req.params.id, req.fpId]
    );
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    console.error('Archive estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore estimate
router.put('/estimates/:id/restore', requireFPScope, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE fp_estimates SET is_archived = 0, archived_at = NULL WHERE id = ? AND franchise_partner_id = ?`,
      [req.params.id, req.fpId]
    );
    res.json({ success: true, message: 'Estimate restored' });
  } catch (error) {
    console.error('Restore estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete estimate permanently
router.delete('/estimates/:id', requireFPScope, async (req, res) => {
  try {
    await pool.execute(
      `DELETE FROM fp_estimates WHERE id = ? AND franchise_partner_id = ?`,
      [req.params.id, req.fpId]
    );
    res.json({ success: true, message: 'Estimate deleted' });
  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all archived estimates
router.delete('/estimates/archived/delete-all', requireFPScope, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `DELETE FROM fp_estimates WHERE franchise_partner_id = ? AND is_archived = 1`,
      [req.fpId]
    );
    res.json({ success: true, message: `${result.affectedRows} archived estimates deleted`, deletedCount: result.affectedRows });
  } catch (error) {
    console.error('Delete all archived error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get FP AMC packages - Scoped to each FP
router.get('/amc-packages', requireFPScope, async (req, res) => {
  try {
    const [packages] = await pool.execute(
      `SELECT * FROM fp_amc_packages WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    console.error('Get AMC packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AMC packages',
      error: error.message
    });
  }
});

// Create AMC package
router.post('/amc-packages', requireFPScope, async (req, res) => {
  try {
    const {
      name, description, durationMonths, basePrice, services, termsConditions
    } = req.body;

    const packageCode = `FP${req.fpId}-AMC-${Date.now()}`;

    const [result] = await pool.execute(
      `INSERT INTO fp_amc_packages (
        franchise_partner_id, package_code, name, description, duration_months,
        base_price, services, terms_conditions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.fpId, packageCode, name, description, durationMonths || 12,
        basePrice || 0, JSON.stringify(services || []), termsConditions
      ]
    );

    res.status(201).json({
      success: true,
      message: 'AMC package created successfully',
      data: { id: result.insertId, packageCode }
    });
  } catch (error) {
    console.error('Create AMC package error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create AMC package',
      error: error.message
    });
  }
});

// Get FP add-ons - Scoped to each FP
router.get('/addons', requireFPScope, async (req, res) => {
  try {
    const [addons] = await pool.execute(
      `SELECT id, franchise_partner_id, property_type, service_name, frequency_count, frequency_type, billing_cycle, price, description, created_at
       FROM fp_addons
       WHERE franchise_partner_id = ?
       ORDER BY created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: addons
    });
  } catch (error) {
    console.error('Get addons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch addons',
      error: error.message
    });
  }
});

// Create addon
router.post('/addons', requireFPScope, async (req, res) => {
  try {
    const { property_type, service_name, frequency_count, frequency_type, billing_cycle, price, description } = req.body;

    if (!service_name || !property_type) {
      return res.status(400).json({ success: false, message: 'Service name and property type are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO fp_addons (
        franchise_partner_id, property_type, service_name, frequency_count, frequency_type, billing_cycle, price, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.fpId, property_type, service_name, frequency_count || 1, frequency_type || 'Monthly', billing_cycle || 'Monthly', price || 0, description || '']
    );

    res.status(201).json({
      success: true,
      message: 'Add-on created successfully',
      data: { id: result.insertId, service_name, property_type }
    });
  } catch (error) {
    console.error('Create addon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create add-on',
      error: error.message
    });
  }
});

// Update addon
router.put('/addons/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, frequency_type, frequency_count, property_type, price, description } = req.body;

    await pool.execute(
      `UPDATE fp_addons SET 
        service_name = ?, frequency_type = ?, frequency_count = ?, property_type = ?, price = ?, description = ?
       WHERE id = ? AND franchise_partner_id = ?`,
      [service_name, frequency_type, frequency_count || 1, property_type, price || 0, description || '', id, req.fpId]
    );

    res.json({ success: true, message: 'Add-on updated successfully' });
  } catch (error) {
    console.error('Update addon error:', error);
    res.status(500).json({ success: false, message: 'Failed to update add-on', error: error.message });
  }
});

// Delete addon
router.delete('/addons/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM fp_addons WHERE id = ? AND franchise_partner_id = ?', [id, req.fpId]);
    res.json({ success: true, message: 'Add-on deleted successfully' });
  } catch (error) {
    console.error('Delete addon error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete add-on', error: error.message });
  }
});

// ============================================
// EXPORT DATA
// ============================================

router.get('/export/:type', requireFPScope, async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let filename = '';

    // Block export for properties and vendors (role restriction)
    if (type === 'properties' || type === 'vendors') {
      return res.status(403).json({
        success: false,
        message: 'Export not allowed for this resource type'
      });
    }

    switch (type) {
      case 'customers':
        [data] = await pool.execute(
          'SELECT * FROM clients WHERE franchise_partner_id = ?',
          [req.fpId]
        );
        filename = 'customers_export.json';
        break;
      case 'work-orders':
        [data] = await pool.execute(
          'SELECT * FROM work_orders WHERE franchise_partner_id = ?',
          [req.fpId]
        );
        filename = 'work_orders_export.json';
        break;
      case 'employees':
        [data] = await pool.execute(
          'SELECT * FROM fp_employees WHERE franchise_partner_id = ?',
          [req.fpId]
        );
        filename = 'employees_export.json';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message
    });
  }
});

// ============================================
// ZONES (FP-specific zones from fp_zones table AND property zones)
// ============================================

router.get('/zones', requireFPScope, async (req, res) => {
  try {
    const allZoneNames = new Set();
    const combinedZones = [];

    // Get zones from fp_zones table
    try {
      const [fpZones] = await pool.execute(
        'SELECT id, name FROM fp_zones WHERE franchise_partner_id = ? AND is_active = 1 ORDER BY name',
        [req.fpId]
      );
      fpZones.forEach(z => {
        if (!allZoneNames.has(z.name)) {
          allZoneNames.add(z.name);
          combinedZones.push({ id: z.id, name: z.name });
        }
      });
    } catch (_) {}

    // Get zones from FP's properties (zone_id column stores zone name)
    try {
      const [propertyZones] = await pool.execute(
        `SELECT DISTINCT zone_id FROM properties WHERE franchise_partner_id = ? AND zone_id IS NOT NULL AND zone_id != ''`,
        [req.fpId]
      );
      propertyZones.forEach(z => {
        if (z.zone_id && !allZoneNames.has(z.zone_id)) {
          allZoneNames.add(z.zone_id);
          combinedZones.push({ id: `prop-${z.zone_id}`, name: z.zone_id });
        }
      });
    } catch (_) {}

    // Sort by name
    combinedZones.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: combinedZones
    });
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zones',
      error: error.message
    });
  }
});

// Create zone - FP can create zones
router.post('/zones', requireFPScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    // Check if zone already exists for this FP
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND franchise_partner_id = ?',
      [name, req.fpId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, created_by, is_active) VALUES (?, ?, ?, 1)',
      [name, req.fpId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    console.error('Create zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone - FP can delete their zones
router.delete('/zones/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );
    
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    console.error('Delete zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CATEGORIES (Read-only for FP)
// ============================================

router.get('/categories', requireFPScope, async (req, res) => {
  try {
    // Always use config file for categories (most reliable)
    const categoriesConfig = require('../config/categories');
    return res.json({ success: true, data: categoriesConfig });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

module.exports = router;
