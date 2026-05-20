/**
 * Franchise Partner API Routes
 * All routes are scoped to the logged-in FP's data only
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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
    const safeCount = async (query, params) => {
      try {
        const [result] = await pool.execute(query, params);
        return result[0]?.count || 0;
      } catch (e) {
        console.log(`Dashboard query skipped (table may not exist): ${e.message}`);
        return 0;
      }
    };

    // Get counts for dashboard (safely handles missing tables)
    const properties = await safeCount(
      'SELECT COUNT(*) as count FROM properties WHERE franchise_partner_id = ?', [fpId]
    );
    const vendors = await safeCount(
      'SELECT COUNT(*) as count FROM vendors WHERE franchise_partner_id = ?', [fpId]
    );
    const customers = await safeCount(
      'SELECT COUNT(*) as count FROM clients WHERE franchise_partner_id = ?', [fpId]
    );
    const totalWorkOrders = await safeCount(
      'SELECT COUNT(*) as count FROM work_orders WHERE franchise_partner_id = ?', [fpId]
    );
    const pendingWorkOrders = await safeCount(
      `SELECT COUNT(*) as count FROM work_orders WHERE franchise_partner_id = ? AND status NOT IN ('completed', 'closed', 'cancelled')`, [fpId]
    );
    const completedWorkOrders = await safeCount(
      `SELECT COUNT(*) as count FROM work_orders WHERE franchise_partner_id = ? AND status IN ('completed', 'closed')`, [fpId]
    );
    const estimates = await safeCount(
      'SELECT COUNT(*) as count FROM estimates WHERE franchise_partner_id = ?', [fpId]
    );
    const employees = await safeCount(
      'SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?', [fpId]
    );

    // Recent work orders (safely handle missing table)
    let recentWorkOrders = [];
    try {
      const [rows] = await pool.execute(
        `SELECT wo.*, p.name as property_name, c.name as category_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         WHERE wo.franchise_partner_id = ?
         ORDER BY wo.created_at DESC LIMIT 5`,
        [fpId]
      );
      recentWorkOrders = rows;
    } catch (e) {
      console.log('Recent work orders query skipped:', e.message);
    }

    res.json({
      success: true,
      data: {
        stats: {
          properties,
          vendors,
          customers,
          workOrders: {
            total: totalWorkOrders,
            pending: pendingWorkOrders,
            completed: completedWorkOrders
          },
          estimates,
          employees
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
    const [properties] = await pool.execute(
      `SELECT p.*, z.name as zone_name, d.name as division_name
       FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       LEFT JOIN divisions d ON p.division_id = d.id
       WHERE p.franchise_partner_id = ?
       ORDER BY p.created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: properties
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

    const [result] = await pool.execute(
      `INSERT INTO properties (
        property_id, name, property_type, address, city, state, zip_code,
        contact_person, contact_phone, contact_email, zone_id, division_id,
        franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, divisionId || null,
        req.fpId, req.user.id
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

// Update property
router.put('/properties/:id', requireFPScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'property_type', 'address', 'city', 'state', 'zip_code',
      'contact_person', 'contact_phone', 'contact_email', 'zone_id', 'division_id', 'is_active'
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

// Delete property - DISABLED for Franchise Partner role
router.delete('/properties/:id', requireFPScope, validateOwnership('properties'), async (req, res) => {
  // Role restriction: Delete property not allowed for Franchise Partner
  return res.status(403).json({
    success: false,
    message: 'Delete operation not allowed for this role'
  });
});

// ============================================
// WORK ORDERS
// ============================================

// Get all FP work orders (shows ALL work orders for FP visibility)
router.get('/work-orders', requireFPScope, async (req, res) => {
  try {
    const { status, priority } = req.query;

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

// Create work order
router.post('/work-orders', requireFPScope, async (req, res) => {
  try {
    const {
      propertyId, categoryId, title, description, priority,
      permissionToEnter, hasPet, scheduledDate
    } = req.body;

    // Validate property belongs to FP
    const [property] = await pool.execute(
      'SELECT id FROM properties WHERE id = ? AND franchise_partner_id = ?',
      [propertyId, req.fpId]
    );

    if (property.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid property selection'
      });
    }

    const workOrderId = `FP${req.fpId}-WO-${Date.now()}`;

    const [result] = await pool.execute(
      `INSERT INTO work_orders (
        work_order_id, property_id, category_id, title, description, priority,
        permission_to_enter, has_pet, scheduled_date, status,
        franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`,
      [
        workOrderId, propertyId, categoryId, title, description, priority || 'medium',
        permissionToEnter || 'no', hasPet || 'no', scheduledDate || null,
        req.fpId, req.user.id
      ]
    );

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

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// Get all FP customers
router.get('/customers', requireFPScope, async (req, res) => {
  try {
    const [customers] = await pool.execute(
      `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.franchise_partner_id = ?
       ORDER BY c.created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: customers
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

// Create customer
router.post('/customers', requireFPScope, async (req, res) => {
  try {
    const {
      name, email, phone, alternatePhone, address, city, state, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

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
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
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
    const [employees] = await pool.execute(
      `SELECT e.*, GROUP_CONCAT(z.name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id
       LEFT JOIN zones z ON ez.zone_id = z.id
       WHERE e.franchise_partner_id = ?
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: employees
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

// Helper function to generate user ID
const generateUserId = (prefix = 'FPE') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
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

    // Generate employee code, user ID, and temporary password
    const employeeCode = `FP${req.fpId}-EMP-${Date.now()}`;
    const userId = generateUserId('FPE');
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
      // 1. Create user account in users table with must_change_password flag
      const [userResult] = await connection.execute(
        `INSERT INTO users (
          user_id, username, email, password_hash, first_name, last_name, phone, 
          role, franchise_partner_id, must_change_password, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fp_executive', ?, TRUE, TRUE, ?)`,
        [
          userId, 
          username, 
          email.trim().toLowerCase(), 
          passwordHash, 
          firstName, 
          lastName, 
          phone || null,
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

      // 3. Assign zones if provided
      if (assignedZones && assignedZones.length > 0) {
        for (const zoneId of assignedZones) {
          await connection.execute(
            `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_id)
             VALUES (?, ?, ?)`,
            [req.fpId, empResult.insertId, zoneId]
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

// ============================================
// USER MANAGEMENT (FP Portal Users)
// ============================================

// Get all FP users
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

// Create FP user
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

// Get FP AMC packages
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

// Get FP addons
router.get('/addons', requireFPScope, async (req, res) => {
  try {
    const [addons] = await pool.execute(
      `SELECT a.*, c.name as category_name
       FROM fp_addons a
       LEFT JOIN categories c ON a.category_id = c.id
       WHERE a.franchise_partner_id = ?
       ORDER BY a.created_at DESC`,
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
    const { name, description, price, unit, categoryId } = req.body;

    const addonCode = `FP${req.fpId}-ADD-${Date.now()}`;

    const [result] = await pool.execute(
      `INSERT INTO fp_addons (
        franchise_partner_id, addon_code, name, description, price, unit, category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.fpId, addonCode, name, description, price || 0, unit || 'per_service', categoryId || null]
    );

    res.status(201).json({
      success: true,
      message: 'Add-on created successfully',
      data: { id: result.insertId, addonCode }
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
// ZONES (Read-only for FP)
// ============================================

router.get('/zones', requireFPScope, async (req, res) => {
  try {
    const [zones] = await pool.execute(
      'SELECT * FROM zones WHERE is_active = TRUE ORDER BY name'
    );

    res.json({
      success: true,
      data: zones
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

// ============================================
// CATEGORIES (Read-only for FP)
// ============================================

router.get('/categories', requireFPScope, async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM categories WHERE is_active = TRUE ORDER BY name'
    );

    res.json({
      success: true,
      data: categories
    });
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
