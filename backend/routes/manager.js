/**
 * Manager Portal API Routes
 * All routes are scoped to the logged-in Manager
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { ROLES, ROLE_NAMES, isManager } = require('../config/roles');
const { 
  attachManagerScope, 
  requireManagerScope, 
  getManagerIdForInsert,
  validateOwnership,
  buildScopedQuery,
  filterPricing
} = require('../middleware/managerScope');

// ============================================
// MANAGER AUTHENTICATION (Public - No Auth Required)
// ============================================

// Manager Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find manager user
    const [users] = await pool.execute(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active 
       FROM users 
       WHERE (username = ? OR email = ?) AND role = ? AND is_active = 1`,
      [username, username, ROLES.MANAGER]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or not a Manager account'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      managerId: user.id
    });

    // Update last login
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          roleName: ROLE_NAMES[user.role],
          managerId: user.id,
          portal: 'manager'
        }
      }
    });
  } catch (error) {
    console.error('Manager Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachManagerScope);

// ============================================
// MANAGER DASHBOARD
// ============================================

router.get('/dashboard', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;

    // Get counts for dashboard
    const [propertiesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM properties WHERE manager_id = ?',
      [managerId]
    );

    const [vendorsCount] = await pool.execute(
      `SELECT COUNT(DISTINCT v.id) as count FROM vendors v 
       LEFT JOIN manager_assigned_vendors mav ON v.id = mav.vendor_id AND mav.manager_id = ?
       WHERE v.manager_id = ? OR mav.id IS NOT NULL`,
      [managerId, managerId]
    );

    const [customersCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM clients WHERE manager_id = ?',
      [managerId]
    );

    const [employeesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM manager_employees WHERE manager_id = ? AND is_active = 1',
      [managerId]
    );

    const [workOrdersCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM work_orders WHERE manager_id = ?',
      [managerId]
    );

    const [pendingWorkOrders] = await pool.execute(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE manager_id = ? AND status NOT IN ('completed', 'closed', 'cancelled')`,
      [managerId]
    );

    const [completedWorkOrders] = await pool.execute(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE manager_id = ? AND status IN ('completed', 'closed')`,
      [managerId]
    );

    const [estimatesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM estimates WHERE manager_id = ?',
      [managerId]
    );

    // Get recent work orders
    const [recentWorkOrders] = await pool.execute(
      `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE wo.manager_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 10`,
      [managerId]
    );

    res.json({
      success: true,
      data: {
        stats: {
          properties: propertiesCount[0].count,
          vendors: vendorsCount[0].count,
          customers: customersCount[0].count,
          employees: employeesCount[0].count,
          workOrders: workOrdersCount[0].count,
          pendingWorkOrders: pendingWorkOrders[0].count,
          completedWorkOrders: completedWorkOrders[0].count,
          estimates: estimatesCount[0].count
        },
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Manager Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard',
      error: error.message
    });
  }
});

// ============================================
// PROPERTY MANAGEMENT
// ============================================

// Get all manager properties
router.get('/properties', requireManagerScope, async (req, res) => {
  try {
    const [properties] = await pool.execute(
      `SELECT p.*, z.name as zone_name 
       FROM properties p 
       LEFT JOIN zones z ON p.zone_id = z.id 
       WHERE p.manager_id = ?
       ORDER BY p.created_at DESC`,
      [req.managerId]
    );

    res.json({ success: true, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property
router.post('/properties', requireManagerScope, async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;
    
    const propertyId = `PROP-MGR-${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, manager_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode, 
       contactPerson, contactPhone, contactEmail, zoneId || null, req.managerId]
    );

    res.json({ success: true, message: 'Property created', data: { id: result.insertId, propertyId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update property
router.put('/properties/:id', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;
    
    await pool.execute(
      `UPDATE properties SET name = ?, property_type = ?, address = ?, city = ?, state = ?, 
        zip_code = ?, contact_person = ?, contact_phone = ?, contact_email = ?, zone_id = ?, updated_at = NOW()
       WHERE id = ? AND manager_id = ?`,
      [name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, 
       zoneId || null, req.params.id, req.managerId]
    );

    res.json({ success: true, message: 'Property updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete property - DISABLED for Manager role
router.delete('/properties/:id', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// Assign vendor to property
router.post('/properties/:id/assign-vendor', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { vendorId } = req.body;
    
    await pool.execute(
      'UPDATE properties SET assigned_vendor_id = ?, updated_at = NOW() WHERE id = ? AND manager_id = ?',
      [vendorId, req.params.id, req.managerId]
    );

    res.json({ success: true, message: 'Vendor assigned to property' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign employee to property
router.post('/properties/:id/assign-employee', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { employeeId } = req.body;
    
    await pool.execute(
      'UPDATE properties SET assigned_employee_id = ?, updated_at = NOW() WHERE id = ? AND manager_id = ?',
      [employeeId, req.params.id, req.managerId]
    );

    res.json({ success: true, message: 'Employee assigned to property' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WORK ORDERS
// ============================================

// Get all manager work orders
router.get('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
                        v.company_name as vendor_name, cl.name as client_name
                 FROM work_orders wo
                 LEFT JOIN properties p ON wo.property_id = p.id
                 LEFT JOIN categories c ON wo.category_id = c.id
                 LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
                 LEFT JOIN clients cl ON wo.client_id = cl.id
                 WHERE wo.manager_id = ?`;
    
    const params = [req.managerId];
    
    if (status) {
      query += ' AND wo.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY wo.created_at DESC';
    
    const [workOrders] = await pool.execute(query, params);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pending work orders
router.get('/work-orders/pending', requireManagerScope, async (req, res) => {
  try {
    const [workOrders] = await pool.execute(
      `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE wo.manager_id = ? AND wo.status NOT IN ('completed', 'closed', 'cancelled')
       ORDER BY wo.created_at DESC`,
      [req.managerId]
    );
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get completed work orders
router.get('/work-orders/completed', requireManagerScope, async (req, res) => {
  try {
    const [workOrders] = await pool.execute(
      `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE wo.manager_id = ? AND wo.status IN ('completed', 'closed')
       ORDER BY wo.created_at DESC`,
      [req.managerId]
    );
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create work order
router.post('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate } = req.body;
    
    const workOrderId = `WO-MGR-${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, status, manager_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, NOW())`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
       priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null,
       req.managerId, req.user.id]
    );

    res.json({ success: true, message: 'Work order created', data: { id: result.insertId, workOrderId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update work order status
router.patch('/work-orders/:id/status', requireManagerScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { status } = req.body;
    
    await pool.execute(
      'UPDATE work_orders SET status = ?, updated_at = NOW() WHERE id = ? AND manager_id = ?',
      [status, req.params.id, req.managerId]
    );

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign vendor to work order
router.patch('/work-orders/:id/assign-vendor', requireManagerScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { vendorId } = req.body;
    
    await pool.execute(
      `UPDATE work_orders SET assigned_vendor_id = ?, status = 'assigned', updated_at = NOW() 
       WHERE id = ? AND manager_id = ?`,
      [vendorId, req.params.id, req.managerId]
    );

    res.json({ success: true, message: 'Vendor assigned' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// Get all manager customers
router.get('/customers', requireManagerScope, async (req, res) => {
  try {
    const [customers] = await pool.execute(
      `SELECT c.*, p.name as property_name 
       FROM clients c 
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.manager_id = ?
       ORDER BY c.created_at DESC`,
      [req.managerId]
    );
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create customer
router.post('/customers', requireManagerScope, async (req, res) => {
  try {
    const { name, email, phone, alternatePhone, address, city, state, zipCode, clientType, companyName, propertyId, gstNumber } = req.body;
    
    const clientId = `CLT-MGR-${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
        zip_code, client_type, company_name, property_id, gst_number, manager_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
       clientType || 'individual', companyName, propertyId || null, gstNumber, req.managerId]
    );

    res.json({ success: true, message: 'Customer created', data: { id: result.insertId, clientId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get all manager vendors (own + assigned)
router.get('/vendors', requireManagerScope, async (req, res) => {
  try {
    // Get vendors created by manager
    const [ownVendors] = await pool.execute(
      `SELECT v.*, 'own' as vendor_type FROM vendors v WHERE v.manager_id = ?`,
      [req.managerId]
    );

    // Get vendors assigned to manager
    const [assignedVendors] = await pool.execute(
      `SELECT v.*, 'assigned' as vendor_type 
       FROM vendors v 
       INNER JOIN manager_assigned_vendors mav ON v.id = mav.vendor_id 
       WHERE mav.manager_id = ? AND mav.is_active = 1`,
      [req.managerId]
    );

    // Combine and deduplicate
    const allVendors = [...ownVendors, ...assignedVendors];
    const uniqueVendors = allVendors.filter((v, index, self) => 
      index === self.findIndex(t => t.id === v.id)
    );

    res.json({
      success: true,
      data: {
        own: ownVendors,
        assigned: assignedVendors,
        all: uniqueVendors
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create vendor
router.post('/vendors', requireManagerScope, async (req, res) => {
  try {
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;
    
    const vendorId = `VND-MGR-${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO vendors (vendor_id, company_name, contact_person, email, phone, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, manager_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [vendorId, companyName, contactPerson, email, phone, alternatePhone, address, city, state, 
       zipCode, gstNumber, panNumber, req.managerId]
    );

    res.json({ success: true, message: 'Vendor created', data: { id: result.insertId, vendorId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update vendor - DISABLED for Manager role
router.put('/vendors/:id', requireManagerScope, validateOwnership('vendors'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Modify vendor not allowed for this role' });
});

// Delete vendor - DISABLED for Manager role
router.delete('/vendors/:id', requireManagerScope, validateOwnership('vendors'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

// Get all manager employees - DISABLED for Manager role
router.get('/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// Create employee - DISABLED for Manager role
router.post('/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// Update employee - DISABLED for Manager role
router.put('/employees/:id', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// Delete employee - DISABLED for Manager role
router.delete('/employees/:id', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// ============================================
// ESTIMATES MANAGEMENT
// ============================================

// Get all manager estimates
router.get('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    
    const [estimates] = await pool.execute(
      `SELECT e.*, p.name as property_name, c.name as client_name
       FROM estimates e
       LEFT JOIN properties p ON e.property_id = p.id
       LEFT JOIN clients c ON e.client_id = c.id
       WHERE e.manager_id = ? AND e.is_archived = ?
       ORDER BY e.created_at DESC`,
      [req.managerId, isArchived]
    );
    res.json({ success: true, data: estimates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create estimate
router.post('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { clientId, propertyId, title, description, estimateType, items, subtotal, taxPercentage, discountPercentage, validUntil } = req.body;
    
    const estimateId = `EST-MGR-${Date.now()}`;
    const tax = (subtotal * (taxPercentage || 0)) / 100;
    const discount = (subtotal * (discountPercentage || 0)) / 100;
    const total = subtotal + tax - discount;
    
    const [result] = await pool.execute(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, status, manager_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NOW())`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
       subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, total,
       validUntil || null, req.managerId, req.user.id]
    );

    // Insert line items
    if (items && items.length > 0) {
      for (const item of items) {
        await pool.execute(
          `INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [result.insertId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
        );
      }
    }

    res.json({ success: true, message: 'Estimate created', data: { id: result.insertId, estimateId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Archive estimate
router.patch('/estimates/:id/archive', requireManagerScope, validateOwnership('estimates'), async (req, res) => {
  try {
    await pool.execute(
      'UPDATE estimates SET is_archived = 1, updated_at = NOW() WHERE id = ? AND manager_id = ?',
      [req.params.id, req.managerId]
    );
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AMC PACKAGES
// ============================================

// Get all manager AMC packages
router.get('/amc-packages', requireManagerScope, async (req, res) => {
  try {
    const [packages] = await pool.execute(
      'SELECT * FROM manager_amc_packages WHERE manager_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [req.managerId]
    );
    
    // Filter pricing if needed
    const filteredPackages = packages.map(pkg => {
      if (pkg.hide_pricing) {
        const { base_price, ...rest } = pkg;
        return rest;
      }
      return pkg;
    });
    
    res.json({ success: true, data: filteredPackages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create AMC package
router.post('/amc-packages', requireManagerScope, async (req, res) => {
  try {
    const { name, description, durationMonths, basePrice, services, termsConditions, hidePricing } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO manager_amc_packages (manager_id, name, description, duration_months, base_price, 
        services, terms_conditions, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.managerId, name, description, durationMonths || 12, basePrice || 0,
       JSON.stringify(services || []), termsConditions, hidePricing || false]
    );

    res.json({ success: true, message: 'AMC package created', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADD-ONS
// ============================================

// Get all manager add-ons
router.get('/addons', requireManagerScope, async (req, res) => {
  try {
    const [addons] = await pool.execute(
      `SELECT a.*, c.name as category_name 
       FROM manager_addons a
       LEFT JOIN categories c ON a.category_id = c.id
       WHERE a.manager_id = ? AND a.is_active = 1
       ORDER BY a.created_at DESC`,
      [req.managerId]
    );
    
    // Filter pricing if needed
    const filteredAddons = addons.map(addon => {
      if (addon.hide_pricing) {
        const { price, ...rest } = addon;
        return rest;
      }
      return addon;
    });
    
    res.json({ success: true, data: filteredAddons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create add-on
router.post('/addons', requireManagerScope, async (req, res) => {
  try {
    const { name, description, price, unit, categoryId, hidePricing } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO manager_addons (manager_id, category_id, name, description, price, unit, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.managerId, categoryId || null, name, description, price || 0, unit || 'per_service', hidePricing || false]
    );

    res.json({ success: true, message: 'Add-on created', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ZONES & CATEGORIES (Read-only)
// ============================================

router.get('/zones', requireManagerScope, async (req, res) => {
  try {
    const [zones] = await pool.execute('SELECT * FROM zones WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', requireManagerScope, async (req, res) => {
  try {
    const [categories] = await pool.execute('SELECT * FROM categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// EXPORT ENDPOINTS
// ============================================

// Export properties - DISABLED for Manager role
router.get('/export/properties', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

// Export vendors - DISABLED for Manager role
router.get('/export/vendors', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

// Export employees - DISABLED for Manager role
router.get('/export/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

router.get('/export/work-orders', requireManagerScope, async (req, res) => {
  try {
    const [data] = await pool.execute(
      'SELECT * FROM work_orders WHERE manager_id = ?',
      [req.managerId]
    );
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
