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
const { sendVendorAssignmentEmail } = require('../services/emailService');
// Rate limiting disabled
// const { loginRateLimiter } = require('../middleware/security');

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

    // Try database first - use onboarded_vendors table
    try {
      const [vendors] = await pool.execute(
        `SELECT * FROM onboarded_vendors WHERE (username = ? OR email = ? OR owner_email = ?)`,
        [username, username, username]
      );
      if (vendors.length > 0) {
        vendor = vendors[0];
        
        const isValidPassword = await bcrypt.compare(password, vendor.password_hash || '');
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
          `UPDATE onboarded_vendors SET last_login = NOW() WHERE id = ?`,
          [vendor.id]
        );
      }
    } catch (dbError) {
      console.log('Database not available, using demo mode:', dbError.message);
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
      email: vendor.email || vendor.owner_email,
      role: ROLES.VENDOR,
      firstName: vendor.owner_name?.split(' ')[0] || vendor.company_name || vendor.contact_person,
      lastName: vendor.owner_name?.split(' ')[1] || ''
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
          email: vendor.email || vendor.owner_email,
          companyName: vendor.company_name || vendor.owner_name,
          contactPerson: vendor.contact_person || vendor.owner_name,
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
             COALESCE(c.name, wo.category_name) as category_name, sc.name as subcategory_name
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

// Get all vendors (from both vendors and onboarded_vendors tables)
router.get('/', authenticate, requireModuleAccess(MODULES.VENDOR_MANAGEMENT), async (req, res) => {
  try {
    const { isActive, isVerified, status } = req.query;
    
    // First, fetch from onboarded_vendors (FP-created vendors with full details)
    let onboardedQuery = `
      SELECT ov.id, ov.vendor_id, ov.username, ov.service_type, ov.service_verified,
             ov.zone, ov.zone as zone_name, ov.area_name, ov.division,
             ov.owner_name, ov.owner_mobile, ov.owner_email, ov.owner_aadhar,
             ov.owner_country_code,
             ov.manager_name, ov.manager_mobile, ov.manager_email, ov.manager_country_code,
             ov.poc_name, ov.poc_mobile, ov.poc_email, ov.poc_country_code,
             ov.gst_number, ov.pan_number, ov.license_number,
             ov.rate_per_visit, ov.coverage_per_day, ov.rating, ov.total_jobs_completed,
             ov.created_by, ov.created_by_id, ov.status, ov.created_at, ov.updated_at,
             COALESCE(
               CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
               CONCAT(fpe2.first_name, ' ', COALESCE(fpe2.last_name, '')),
               SUBSTRING_INDEX(ov.created_by, '@', 1),
               'System'
             ) as created_by_name,
             CASE WHEN ov.status = 'active' THEN 1 ELSE 0 END as is_active,
             'onboarded' as source
      FROM onboarded_vendors ov
      LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id
      LEFT JOIN fp_employees fpe2 ON ov.created_by = fpe2.email OR ov.created_by = fpe2.username
      WHERE 1=1
    `;

    // Handle status filter
    if (status === 'active') {
      onboardedQuery += ` AND ov.status = 'active'`;
    } else if (status === 'deleted') {
      onboardedQuery += ` AND ov.status != 'active'`;
    }

    onboardedQuery += ` ORDER BY ov.created_at DESC`;

    let onboardedVendors = [];
    try {
      const [result] = await pool.execute(onboardedQuery);
      onboardedVendors = result;
    } catch (e) { console.log('Onboarded vendors fetch:', e.message); }

    // Map onboarded vendors to standard format
    const mappedOnboarded = onboardedVendors.map(v => ({
      id: v.id,
      vendorId: v.vendor_id,
      username: v.username,
      serviceType: v.service_type,
      serviceVerified: v.service_verified,
      zone: v.zone,
      areaName: v.area_name,
      division: v.division,
      ownerName: v.owner_name,
      ownerMobile: v.owner_mobile,
      ownerEmail: v.owner_email,
      ownerAadhar: v.owner_aadhar,
      ownerCountryCode: v.owner_country_code || '+91',
      managerName: v.manager_name,
      managerMobile: v.manager_mobile,
      managerEmail: v.manager_email,
      managerCountryCode: v.manager_country_code || '+91',
      pocName: v.poc_name,
      pocMobile: v.poc_mobile,
      pocEmail: v.poc_email,
      pocCountryCode: v.poc_country_code || '+91',
      // Business Documents
      gstNumber: v.gst_number,
      panNumber: v.pan_number,
      licenseNumber: v.license_number,
      // Rate & Performance
      ratePerVisit: v.rate_per_visit || 0,
      coveragePerDay: v.coverage_per_day || 0,
      rating: v.rating || 0,
      totalJobsCompleted: v.total_jobs_completed || 0,
      // Metadata
      created_by_name: v.created_by_name,
      createdBy: v.created_by_name,
      status: v.status,
      is_active: v.is_active,
      createdAt: v.created_at,
      source: 'onboarded'
    }));

    // Only use onboarded_vendors - skip legacy vendors table to avoid duplicates
    // Legacy vendors don't have service_type and other required fields
    const allVendors = mappedOnboarded;

    res.json({
      success: true,
      data: allVendors
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
              COALESCE(v.created_by_name, CONCAT(u.first_name, ' ', u.last_name)) as created_by_name
       FROM onboarded_vendors v
       LEFT JOIN users u ON v.created_by_id = u.id
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
        email: v.email || v.owner_email,
        companyName: v.company_name || v.owner_name,
        contactPerson: v.contact_person || v.owner_name,
        ownerName: v.owner_name,
        ownerMobile: v.owner_mobile,
        ownerEmail: v.owner_email,
        phone: v.phone || v.owner_mobile,
        alternatePhone: v.alternate_phone,
        address: v.address,
        city: v.city,
        state: v.state,
        zipCode: v.zip_code,
        zone: v.zone,
        areaName: v.area_name,
        serviceType: v.service_type,
        serviceCategories: v.service_categories,
        gstNumber: v.gst_number,
        panNumber: v.pan_number,
        licenseNumber: v.license_number,
        managerName: v.manager_name,
        managerMobile: v.manager_mobile,
        managerEmail: v.manager_email,
        pocName: v.poc_name,
        pocMobile: v.poc_mobile,
        pocEmail: v.poc_email,
        ratePerVisit: v.rate_per_visit,
        coveragePerDay: v.coverage_per_day,
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
      `SELECT id FROM onboarded_vendors WHERE username = ? OR email = ? OR owner_email = ?`,
      [username, email, email]
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

    // Insert vendor into onboarded_vendors
    const [result] = await pool.execute(
      `INSERT INTO onboarded_vendors (
        vendor_id, username, email, password_hash, company_name, contact_person,
        owner_name, owner_email, owner_mobile,
        phone, alternate_phone, address, city, state, zip_code,
        service_type, service_categories, gst_number, pan_number, license_number,
        is_active, created_by_id, created_by_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, 'active')`,
      [
        vendorId, username, email, passwordHash, companyName, contactPerson || companyName,
        companyName, email, phone,
        phone, alternatePhone || null, address || null, city || null, state || null, zipCode || null,
        'General', serviceCategories ? JSON.stringify(serviceCategories) : null,
        gstNumber || null, panNumber || null, licenseNumber || null,
        req.user.id, req.user.username || req.user.email
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
    const body = req.body;

    // Check if vendor exists
    const [existing] = await pool.execute(
      `SELECT id FROM onboarded_vendors WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Build update query - handle both camelCase and snake_case field names
    let updateFields = [];
    let params = [];

    // Service & Location fields
    const serviceType = body.serviceType || body.service_type;
    const serviceVerified = body.serviceVerified !== undefined ? body.serviceVerified : body.service_verified;
    const zone = body.zone || body.zone_name;
    const areaName = body.areaName || body.area_name || body.area;
    const division = body.division;

    // Owner details
    const ownerName = body.ownerName || body.owner_name || body.companyName || body.company_name;
    const ownerMobile = body.ownerMobile || body.owner_mobile || body.phone;
    const ownerEmail = body.ownerEmail || body.owner_email || body.email;
    const ownerAadhar = body.ownerAadhar || body.owner_aadhar;

    // Manager details
    const managerName = body.managerName || body.manager_name;
    const managerMobile = body.managerMobile || body.manager_mobile;
    const managerEmail = body.managerEmail || body.manager_email;

    // POC details
    const pocName = body.pocName || body.poc_name;
    const pocMobile = body.pocMobile || body.poc_mobile;
    const pocEmail = body.pocEmail || body.poc_email;

    // Other fields
    const ratePerVisit = body.ratePerVisit || body.rate_per_visit;
    const coveragePerDay = body.coveragePerDay || body.coverage_per_day;
    const gstNumber = body.gstNumber || body.gst_number;
    const panNumber = body.panNumber || body.pan_number;
    const licenseNumber = body.licenseNumber || body.license_number;
    const isActive = body.isActive !== undefined ? body.isActive : body.is_active;
    const isVerified = body.isVerified !== undefined ? body.isVerified : body.is_verified;

    // Add fields to update
    if (serviceType !== undefined) { updateFields.push('service_type = ?'); params.push(serviceType); }
    if (serviceVerified !== undefined) { updateFields.push('service_verified = ?'); params.push(serviceVerified ? 1 : 0); }
    if (zone !== undefined) { updateFields.push('zone = ?'); params.push(zone); }
    if (areaName !== undefined) { updateFields.push('area_name = ?'); params.push(areaName); }
    if (division !== undefined) { updateFields.push('division = ?'); params.push(division); }
    if (ownerName !== undefined) { updateFields.push('owner_name = ?'); params.push(ownerName); }
    if (ownerMobile !== undefined) { updateFields.push('owner_mobile = ?'); params.push(ownerMobile); }
    if (ownerEmail !== undefined) { updateFields.push('owner_email = ?'); params.push(ownerEmail); }
    if (ownerAadhar !== undefined) { updateFields.push('owner_aadhar = ?'); params.push(ownerAadhar); }
    if (managerName !== undefined) { updateFields.push('manager_name = ?'); params.push(managerName); }
    if (managerMobile !== undefined) { updateFields.push('manager_mobile = ?'); params.push(managerMobile); }
    if (managerEmail !== undefined) { updateFields.push('manager_email = ?'); params.push(managerEmail); }
    if (pocName !== undefined) { updateFields.push('poc_name = ?'); params.push(pocName); }
    if (pocMobile !== undefined) { updateFields.push('poc_mobile = ?'); params.push(pocMobile); }
    if (pocEmail !== undefined) { updateFields.push('poc_email = ?'); params.push(pocEmail); }
    if (ratePerVisit !== undefined) { updateFields.push('rate_per_visit = ?'); params.push(ratePerVisit); }
    if (coveragePerDay !== undefined) { updateFields.push('coverage_per_day = ?'); params.push(coveragePerDay); }
    if (gstNumber !== undefined) { updateFields.push('gst_number = ?'); params.push(gstNumber); }
    if (panNumber !== undefined) { updateFields.push('pan_number = ?'); params.push(panNumber); }
    if (licenseNumber !== undefined) { updateFields.push('license_number = ?'); params.push(licenseNumber); }
    if (isActive !== undefined) { updateFields.push('is_active = ?'); params.push(isActive); }
    if (isVerified !== undefined) { updateFields.push('is_verified = ?'); params.push(isVerified); }

    if (body.password) {
      const passwordHash = await bcrypt.hash(body.password, 10);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (updateFields.length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }

    updateFields.push('updated_at = NOW()');
    params.push(id);

    await pool.execute(
      `UPDATE onboarded_vendors SET ${updateFields.join(', ')} WHERE id = ?`,
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
      `UPDATE onboarded_vendors SET is_active = 0, status = 'deleted' WHERE id = ?`,
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

// Permanent delete vendor (completely removes from database)
router.delete('/:id/permanent', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if vendor exists
    const [existing] = await pool.execute(
      `SELECT id, vendor_id, owner_name FROM onboarded_vendors WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Delete related assignments first
    await pool.execute(`DELETE FROM property_vendor_assignments WHERE vendor_id = ?`, [id]);

    // Permanently delete the vendor
    const [result] = await pool.execute(
      `DELETE FROM onboarded_vendors WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Failed to delete vendor' });
    }

    res.json({ success: true, message: 'Vendor permanently deleted' });
  } catch (error) {
    console.error('Error permanently deleting vendor:', error);
    res.status(500).json({ success: false, message: 'Error deleting vendor', error: error.message });
  }
});

// Restore vendor (set is_active back to TRUE)
router.put('/:id/restore', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `UPDATE onboarded_vendors SET is_active = 1, status = 'active', updated_at = NOW() WHERE id = ?`,
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
      message: 'Vendor restored successfully'
    });
  } catch (error) {
    console.error('Error restoring vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring vendor',
      error: error.message
    });
  }
});

// Get vendors for assignment dropdown
router.get('/list/active', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { categoryId } = req.query;
    
    let query = `
      SELECT id, vendor_id, COALESCE(company_name, owner_name) as company_name, 
             COALESCE(contact_person, owner_name) as contact_person, 
             COALESCE(phone, owner_mobile) as phone, rating
      FROM onboarded_vendors
      WHERE (is_active = 1 OR is_active IS NULL) AND (is_verified = 1 OR is_verified IS NULL OR status = 'active')
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

// ============================================
// VENDOR DASHBOARD - Get vendor-specific dashboard data
// ============================================
router.get('/dashboard', authenticate, vendorOnly, async (req, res) => {
  try {
    const vendorId = req.user?.id || req.user?.vendorId;
    
    if (!vendorId) {
      return res.status(401).json({ success: false, message: 'Vendor ID not found' });
    }

    // Get vendor details from onboarded_vendors
    const [vendor] = await pool.execute(
      `SELECT * FROM onboarded_vendors WHERE id = ? OR vendor_id = ?`,
      [vendorId, vendorId]
    );

    if (vendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const dbVendorId = vendor[0].id;

    // Get work orders assigned to this vendor
    const [workOrders] = await pool.execute(
      `SELECT wo.*, COALESCE(c.name, wo.category_name) as category_name, sc.name as subcategory_name, p.property_name
       FROM work_orders wo
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN subcategories sc ON wo.subcategory_id = sc.id
       LEFT JOIN properties p ON wo.property_id = p.id
       WHERE wo.assigned_vendor_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 10`,
      [dbVendorId]
    );

    // Get stats for this vendor with detailed status breakdown
    const [[statusStats]] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM work_orders WHERE assigned_vendor_id = ?`,
      [dbVendorId]
    );

    const pendingCount = (statusStats?.assigned || 0) + (statusStats?.accepted || 0) + (statusStats?.in_progress || 0);
    const completedCount = (statusStats?.completed || 0) + (statusStats?.verified || 0) + (statusStats?.closed || 0);

    res.json({
      success: true,
      data: {
        vendor: {
          id: vendor[0].id,
          vendorId: vendor[0].vendor_id,
          companyName: vendor[0].company_name || vendor[0].owner_name,
          contactPerson: vendor[0].contact_person || vendor[0].owner_name,
          email: vendor[0].email || vendor[0].owner_email,
          phone: vendor[0].phone || vendor[0].owner_mobile,
          rating: vendor[0].rating
        },
        recentWorkOrders: workOrders,
        stats: {
          pending: pendingCount,
          completed: completedCount,
          total: statusStats?.total || 0,
          byStatus: {
            assigned: statusStats?.assigned || 0,
            accepted: statusStats?.accepted || 0,
            in_progress: statusStats?.in_progress || 0,
            completed: statusStats?.completed || 0,
            verified: statusStats?.verified || 0,
            closed: statusStats?.closed || 0,
            cancelled: statusStats?.cancelled || 0
          }
        }
      }
    });
  } catch (error) {
    console.error('Vendor dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard', error: error.message });
  }
});

// ============================================
// VENDOR PROPERTY ASSIGNMENTS (Admin Portal)
// ============================================

// Get vendor assignments for properties (unified - uses onboarded_vendors)
router.get('/assignments', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let whereClause = status === 'removed' ? 'pva.is_active = 0' : 'pva.is_active = 1';
    if (status === 'all') whereClause = '1=1';
    
    // Fetch from onboarded_vendors (unified table after migration)
    const [propertyAssignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        p.name as property_name, p.property_id as property_code, p.property_type, p.address, p.city, p.zone_id as property_zone,
        COALESCE(ov.company_name, ov.owner_name) as vendor_name, ov.vendor_id as vendor_code, COALESCE(pva.service_type, ov.service_type) as service_type,
        COALESCE(ov.phone, ov.owner_mobile) as vendor_phone, COALESCE(ov.email, ov.owner_email) as vendor_email, ov.owner_aadhar,
        ov.owner_name, ov.owner_mobile, ov.owner_email,
        COALESCE(ov.zone_name, ov.zone) as zone_name, COALESCE(ov.area, ov.area_name) as area, ov.rate_per_visit, ov.coverage_per_day,
        ov.manager_name, ov.manager_mobile, ov.manager_email,
        ov.poc_name, ov.poc_mobile, ov.poc_email,
        CASE WHEN pva.is_active = 1 THEN 'active' ELSE 'removed' END as status
       FROM property_vendor_assignments pva
       JOIN properties p ON pva.property_id = p.id
       JOIN onboarded_vendors ov ON pva.vendor_id = ov.id
       WHERE ${whereClause}
       ORDER BY pva.assigned_at DESC`
    );

    // Format for frontend - create flat service assignments list
    const serviceAssignments = propertyAssignments.map(a => ({
      id: a.id,
      vendorId: a.vendor_code,
      vendorName: a.vendor_name,
      serviceType: a.service_type,
      vendor_phone: a.vendor_phone,
      vendor_email: a.vendor_email,
      owner_aadhar: a.owner_aadhar,
      zone_name: a.zone_name,
      area: a.area,
      rate_per_visit: a.rate_per_visit,
      coverage_per_day: a.coverage_per_day,
      manager_name: a.manager_name,
      manager_mobile: a.manager_mobile,
      manager_email: a.manager_email,
      poc_name: a.poc_name,
      poc_mobile: a.poc_mobile,
      poc_email: a.poc_email,
      propertyId: a.property_id,
      propertyName: a.property_name,
      property_type: a.property_type,
      propertyZone: a.property_zone,
      city: a.city,
      assignedDate: a.assigned_at,
      is_active: a.is_active,
      status: a.status
    }));

    res.json({
      success: true,
      data: {
        propertyAssignments,
        serviceAssignments
      }
    });
  } catch (error) {
    console.error('Get vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

// Get vendor assignments for a specific property
router.get('/assignments/property/:propertyId', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property ID is required' });
    }

    // Get all active vendor assignments for this property
    const [assignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.service_type, pva.assigned_at, pva.is_active,
        ov.vendor_id as vendor_code, 
        COALESCE(ov.company_name, ov.owner_name) as vendor_name, 
        COALESCE(ov.service_type) as vendor_service_type,
        COALESCE(ov.zone_name, ov.zone) as zone_name
       FROM property_vendor_assignments pva
       JOIN onboarded_vendors ov ON pva.vendor_id = ov.id
       WHERE pva.property_id = ? AND pva.is_active = 1
       ORDER BY pva.service_type`,
      [propertyId]
    );

    // Format for frontend
    const serviceAssignments = assignments.map(a => ({
      id: a.id,
      propertyId: a.property_id,
      vendorId: a.vendor_code,
      vendorDbId: a.vendor_id,
      vendorName: a.vendor_name,
      serviceType: a.service_type,
      vendorServiceType: a.vendor_service_type,
      zoneName: a.zone_name,
      assignedAt: a.assigned_at
    }));

    res.json({
      success: true,
      data: serviceAssignments
    });
  } catch (error) {
    console.error('Get property vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch property assignments', error: error.message });
  }
});

// Assign vendor to property
router.post('/assignments', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { propertyId, vendorId, serviceType } = req.body;

    if (!propertyId || !vendorId) {
      return res.status(400).json({ success: false, message: 'Property ID and Vendor ID are required' });
    }

    // Get property details - check both tables
    let property = [];
    [property] = await pool.execute(
      `SELECT id, property_id, name, property_type, address, city, state, zone_id, 
              contact_person, contact_phone 
       FROM properties WHERE id = ?`,
      [propertyId]
    );

    if (property.length === 0) {
      [property] = await pool.execute(
        `SELECT id, property_id, community_name as name, property_type, address, city, state, zone as zone_id, 
                contact_person, contact_phone 
         FROM onboarded_properties WHERE id = ?`,
        [propertyId]
      );
    }

    if (property.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Get vendor details from onboarded_vendors
    const [vendor] = await pool.execute(
      `SELECT id, owner_name, owner_email, owner_mobile, service_type FROM onboarded_vendors 
       WHERE id = ? OR vendor_id = ?`,
      [vendorId, vendorId]
    );

    if (vendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const numericVendorId = vendor[0].id;
    const assignedServiceType = serviceType || vendor[0].service_type || 'General';

    // Check if this exact vendor is already assigned and active
    const [existingActive] = await pool.execute(
      `SELECT id FROM property_vendor_assignments WHERE property_id = ? AND vendor_id = ? AND is_active = 1`,
      [propertyId, numericVendorId]
    );

    if (existingActive.length > 0) {
      return res.status(400).json({ success: false, message: 'This vendor is already assigned to this property' });
    }

    // Check if any assignment exists for this property + vendor (active or inactive)
    const [existingAny] = await pool.execute(
      `SELECT id FROM property_vendor_assignments WHERE property_id = ? AND vendor_id = ?`,
      [propertyId, numericVendorId]
    );

    // Deactivate existing assignments for this property + service type (other vendors)
    await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 0 WHERE property_id = ? AND service_type = ? AND is_active = 1 AND vendor_id != ?`,
      [propertyId, assignedServiceType, numericVendorId]
    );

    if (existingAny.length > 0) {
      // Update existing record instead of inserting
      await pool.execute(
        `UPDATE property_vendor_assignments SET service_type = ?, assigned_by = ?, assigned_at = NOW(), is_active = 1 WHERE property_id = ? AND vendor_id = ?`,
        [assignedServiceType, req.user.id, propertyId, numericVendorId]
      );
    } else {
      // Create new assignment
      await pool.execute(
        `INSERT INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
         VALUES (?, ?, ?, ?, NOW(), TRUE)`,
        [propertyId, numericVendorId, assignedServiceType, req.user.id]
      );
    }

    // Send email notification
    if (vendor[0].owner_email) {
      sendVendorAssignmentEmail(vendor[0].owner_email, vendor[0].owner_name, property[0])
        .catch(err => console.error('Failed to send vendor assignment email:', err));
    }

    res.json({
      success: true,
      message: 'Vendor assigned successfully',
      data: { vendorName: vendor[0].owner_name, serviceType: vendor[0].service_type }
    });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign vendor', error: error.message });
  }
});

// Update vendor assignment (change vendor)
router.put('/assignments/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, vendor_id } = req.body;
    const newVendorId = vendorId || vendor_id;

    if (!newVendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    // Get assignment
    const [assignment] = await pool.execute(
      `SELECT id, property_id FROM property_vendor_assignments WHERE id = ?`,
      [id]
    );

    if (assignment.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Get vendor from onboarded_vendors
    const [vendor] = await pool.execute(
      `SELECT id FROM onboarded_vendors WHERE id = ? OR vendor_id = ?`,
      [newVendorId, newVendorId]
    );

    if (vendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Update assignment
    await pool.execute(
      `UPDATE property_vendor_assignments SET vendor_id = ?, assigned_at = NOW() WHERE id = ?`,
      [vendor[0].id, id]
    );

    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment', error: error.message });
  }
});

// Remove vendor assignment (soft delete)
router.delete('/assignments/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 0 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    res.json({ success: true, message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove assignment', error: error.message });
  }
});

// Delete service vendor assignment (permanent delete)
router.delete('/service-assignments/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if the assignment exists
    const [existing] = await pool.execute(
      `SELECT * FROM property_vendor_assignments WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Permanently delete the assignment
    const [result] = await pool.execute(
      `DELETE FROM property_vendor_assignments WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Failed to delete assignment' });
    }

    res.json({ success: true, message: 'Assignment deleted permanently' });
  } catch (error) {
    console.error('Delete service assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete assignment', error: error.message });
  }
});

module.exports = router;
