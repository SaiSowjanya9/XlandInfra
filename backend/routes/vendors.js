/**
 * Vendor Management Routes
 * Handles CRUD operations for Vendors and Vendor Portal
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { 
  managerOrAdmin, 
  adminOnly, 
  vendorOnly,
  requireModuleAccess,
  ROLES, 
  MODULES 
} = require('../middleware/rbac');
const { ROLE_NAMES, WORK_ORDER_STATUS } = require('../config/roles');

// ============================================
// VENDOR LOGIN
// ============================================

// Demo vendors
const DEMO_VENDORS = [
  { 
    id: 1, 
    vendorId: 'VEN-001',
    username: 'vendor1', 
    email: 'vendor1@example.com', 
    companyName: 'ABC Services', 
    contactPerson: 'Mike Vendor',
    role: 'vendor', 
    password: 'vendor123' 
  }
];

// Vendor Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    let vendor = null;

    // Try database first
    try {
      const [vendors] = await pool.execute(
        `SELECT * FROM vendors WHERE (username = ? OR email = ?) AND is_active = TRUE`,
        [username, username]
      );
      if (vendors.length > 0) {
        vendor = vendors[0];
        
        const isValidPassword = await bcrypt.compare(password, vendor.password_hash);
        if (!isValidPassword) {
          const demoVendor = DEMO_VENDORS.find(v => v.username === username || v.email === username);
          if (!demoVendor || demoVendor.password !== password) {
            return res.status(401).json({
              success: false,
              message: 'Invalid credentials'
            });
          }
        }

        await pool.execute(
          `UPDATE vendors SET last_login = NOW() WHERE id = ?`,
          [vendor.id]
        );
      }
    } catch (dbError) {
      console.log('Database not available, using demo mode');
    }

    // Fallback to demo vendors
    if (!vendor) {
      const demoVendor = DEMO_VENDORS.find(v => 
        (v.username === username || v.email === username) && v.password === password
      );
      
      if (!demoVendor) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const token = generateToken({
        ...demoVendor,
        firstName: demoVendor.contactPerson.split(' ')[0],
        lastName: demoVendor.contactPerson.split(' ')[1] || ''
      });
      
      return res.json({
        success: true,
        message: 'Login successful (Demo Mode)',
        data: {
          token,
          vendor: {
            id: demoVendor.id,
            vendorId: demoVendor.vendorId,
            username: demoVendor.username,
            email: demoVendor.email,
            companyName: demoVendor.companyName,
            contactPerson: demoVendor.contactPerson,
            role: 'vendor'
          }
        }
      });
    }

    // Generate token for database vendor
    const token = generateToken({
      id: vendor.id,
      vendorId: vendor.vendor_id,
      username: vendor.username,
      email: vendor.email,
      role: ROLES.VENDOR,
      firstName: vendor.contact_person?.split(' ')[0] || vendor.company_name,
      lastName: vendor.contact_person?.split(' ')[1] || ''
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        vendor: {
          id: vendor.id,
          vendorId: vendor.vendor_id,
          username: vendor.username,
          email: vendor.email,
          companyName: vendor.company_name,
          contactPerson: vendor.contact_person,
          role: 'vendor'
        }
      }
    });
  } catch (error) {
    console.error('Vendor login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// ============================================
// VENDOR PORTAL ROUTES (For Vendors)
// ============================================

// Get vendor's assigned work orders
router.get('/my-work-orders', authenticate, vendorOnly, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT wo.*, 
             p.name as property_name, p.address as property_address,
             c.name as category_name, sc.name as subcategory_name
      FROM work_orders wo
      JOIN properties p ON wo.property_id = p.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN subcategories sc ON wo.subcategory_id = sc.id
      WHERE wo.assigned_vendor_id = ?
    `;
    const params = [req.user.id];

    if (status) {
      query += ` AND wo.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY wo.created_at DESC`;

    const [workOrders] = await pool.execute(query, params);

    res.json({
      success: true,
      data: workOrders
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

// Update work order status (Vendor can only update to: accepted, in_progress, completed)
router.put('/work-orders/:id/status', authenticate, vendorOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status
    const allowedStatuses = [
      WORK_ORDER_STATUS.ACCEPTED,
      WORK_ORDER_STATUS.IN_PROGRESS,
      WORK_ORDER_STATUS.COMPLETED
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Vendors can only set status to: ${allowedStatuses.join(', ')}`
      });
    }

    // Check if work order is assigned to this vendor
    const [workOrders] = await pool.execute(
      `SELECT id, status FROM work_orders WHERE id = ? AND assigned_vendor_id = ?`,
      [id, req.user.id]
    );

    if (workOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found or not assigned to you'
      });
    }

    const currentStatus = workOrders[0].status;

    // Build update query
    let updateFields = ['status = ?'];
    let params = [status];

    if (status === WORK_ORDER_STATUS.ACCEPTED) {
      updateFields.push('vendor_accepted_at = NOW()');
    } else if (status === WORK_ORDER_STATUS.IN_PROGRESS) {
      updateFields.push('vendor_started_at = NOW()');
    } else if (status === WORK_ORDER_STATUS.COMPLETED) {
      updateFields.push('vendor_completed_at = NOW()');
    }

    if (notes) {
      updateFields.push('vendor_notes = ?');
      params.push(notes);
    }

    params.push(id);

    await pool.execute(
      `UPDATE work_orders SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    // Log status change
    await pool.execute(
      `INSERT INTO work_order_status_history 
       (work_order_id, from_status, to_status, changed_by, changed_by_role, notes)
       VALUES (?, ?, ?, ?, 'vendor', ?)`,
      [id, currentStatus, status, req.user.id, notes || null]
    );

    res.json({
      success: true,
      message: 'Work order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating work order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating work order status',
      error: error.message
    });
  }
});

// ============================================
// VENDOR MANAGEMENT ROUTES (For Staff)
// ============================================

// Get all vendors
router.get('/', authenticate, requireModuleAccess(MODULES.VENDOR_MANAGEMENT), async (req, res) => {
  try {
    const { isActive, isVerified } = req.query;
    
    let query = `
      SELECT v.*, 
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM vendors v
      LEFT JOIN users u ON v.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (isActive !== undefined) {
      query += ` AND v.is_active = ?`;
      params.push(isActive === 'true');
    }

    if (isVerified !== undefined) {
      query += ` AND v.is_verified = ?`;
      params.push(isVerified === 'true');
    }

    query += ` ORDER BY v.created_at DESC`;

    const [vendors] = await pool.execute(query, params);

    res.json({
      success: true,
      data: vendors.map(v => ({
        id: v.id,
        vendorId: v.vendor_id,
        username: v.username,
        email: v.email,
        companyName: v.company_name,
        contactPerson: v.contact_person,
        phone: v.phone,
        alternatePhone: v.alternate_phone,
        address: v.address,
        city: v.city,
        state: v.state,
        zipCode: v.zip_code,
        serviceCategories: v.service_categories,
        gstNumber: v.gst_number,
        panNumber: v.pan_number,
        licenseNumber: v.license_number,
        isActive: v.is_active,
        isVerified: v.is_verified,
        rating: v.rating,
        totalJobsCompleted: v.total_jobs_completed,
        lastLogin: v.last_login,
        createdBy: v.created_by_name,
        createdAt: v.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendors',
      error: error.message
    });
  }
});

// Get single vendor
router.get('/:id', authenticate, requireModuleAccess(MODULES.VENDOR_MANAGEMENT), async (req, res) => {
  try {
    const { id } = req.params;

    const [vendors] = await pool.execute(
      `SELECT v.*, 
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM vendors v
       LEFT JOIN users u ON v.created_by = u.id
       WHERE v.id = ?`,
      [id]
    );

    if (vendors.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const v = vendors[0];
    res.json({
      success: true,
      data: {
        id: v.id,
        vendorId: v.vendor_id,
        username: v.username,
        email: v.email,
        companyName: v.company_name,
        contactPerson: v.contact_person,
        phone: v.phone,
        alternatePhone: v.alternate_phone,
        address: v.address,
        city: v.city,
        state: v.state,
        zipCode: v.zip_code,
        serviceCategories: v.service_categories,
        gstNumber: v.gst_number,
        panNumber: v.pan_number,
        licenseNumber: v.license_number,
        isActive: v.is_active,
        isVerified: v.is_verified,
        rating: v.rating,
        totalJobsCompleted: v.total_jobs_completed,
        lastLogin: v.last_login,
        createdBy: v.created_by_name,
        createdAt: v.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor',
      error: error.message
    });
  }
});

// Create vendor (Manager/Admin)
router.post('/', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { 
      username, email, password, companyName, contactPerson,
      phone, alternatePhone, address, city, state, zipCode,
      serviceCategories, gstNumber, panNumber, licenseNumber
    } = req.body;

    // Validation
    if (!username || !email || !password || !companyName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, company name, and phone are required'
      });
    }

    // Check if username or email already exists
    const [existing] = await pool.execute(
      `SELECT id FROM vendors WHERE username = ? OR email = ?`,
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Generate vendor ID
    const vendorId = `VEN-${Date.now().toString(36).toUpperCase()}`;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert vendor
    const [result] = await pool.execute(
      `INSERT INTO vendors (
        vendor_id, username, email, password_hash, company_name, contact_person,
        phone, alternate_phone, address, city, state, zip_code,
        service_categories, gst_number, pan_number, license_number,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId, username, email, passwordHash, companyName, contactPerson || null,
        phone, alternatePhone || null, address || null, city || null, state || null, zipCode || null,
        serviceCategories ? JSON.stringify(serviceCategories) : null,
        gstNumber || null, panNumber || null, licenseNumber || null,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: {
        id: result.insertId,
        vendorId,
        username,
        email,
        companyName
      }
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating vendor',
      error: error.message
    });
  }
});

// Update vendor
router.put('/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      username, email, password, companyName, contactPerson,
      phone, alternatePhone, address, city, state, zipCode,
      serviceCategories, gstNumber, panNumber, licenseNumber,
      isActive, isVerified
    } = req.body;

    // Check if vendor exists
    const [existing] = await pool.execute(
      `SELECT id FROM vendors WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Build update query
    let updateFields = [];
    let params = [];

    if (username) { updateFields.push('username = ?'); params.push(username); }
    if (email) { updateFields.push('email = ?'); params.push(email); }
    if (companyName) { updateFields.push('company_name = ?'); params.push(companyName); }
    if (contactPerson !== undefined) { updateFields.push('contact_person = ?'); params.push(contactPerson); }
    if (phone) { updateFields.push('phone = ?'); params.push(phone); }
    if (alternatePhone !== undefined) { updateFields.push('alternate_phone = ?'); params.push(alternatePhone); }
    if (address !== undefined) { updateFields.push('address = ?'); params.push(address); }
    if (city !== undefined) { updateFields.push('city = ?'); params.push(city); }
    if (state !== undefined) { updateFields.push('state = ?'); params.push(state); }
    if (zipCode !== undefined) { updateFields.push('zip_code = ?'); params.push(zipCode); }
    if (serviceCategories !== undefined) { 
      updateFields.push('service_categories = ?'); 
      params.push(JSON.stringify(serviceCategories)); 
    }
    if (gstNumber !== undefined) { updateFields.push('gst_number = ?'); params.push(gstNumber); }
    if (panNumber !== undefined) { updateFields.push('pan_number = ?'); params.push(panNumber); }
    if (licenseNumber !== undefined) { updateFields.push('license_number = ?'); params.push(licenseNumber); }
    if (isActive !== undefined) { updateFields.push('is_active = ?'); params.push(isActive); }
    if (isVerified !== undefined) { updateFields.push('is_verified = ?'); params.push(isVerified); }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(id);

    await pool.execute(
      `UPDATE vendors SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Vendor updated successfully'
    });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating vendor',
      error: error.message
    });
  }
});

// Delete vendor (soft delete)
router.delete('/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `UPDATE vendors SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vendor',
      error: error.message
    });
  }
});

// Get vendors for assignment dropdown
router.get('/list/active', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { categoryId } = req.query;
    
    let query = `
      SELECT id, vendor_id, company_name, contact_person, phone, rating
      FROM vendors
      WHERE is_active = TRUE AND is_verified = TRUE
    `;
    const params = [];

    if (categoryId) {
      query += ` AND JSON_CONTAINS(service_categories, ?)`;
      params.push(JSON.stringify(parseInt(categoryId)));
    }

    query += ` ORDER BY rating DESC, company_name`;

    const [vendors] = await pool.execute(query, params);

    res.json({
      success: true,
      data: vendors.map(v => ({
        id: v.id,
        vendorId: v.vendor_id,
        companyName: v.company_name,
        contactPerson: v.contact_person,
        phone: v.phone,
        rating: v.rating
      }))
    });
  } catch (error) {
    console.error('Error fetching active vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendors',
      error: error.message
    });
  }
});

module.exports = router;
