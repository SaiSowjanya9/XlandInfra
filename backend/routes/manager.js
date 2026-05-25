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
  filterPricing,
  getScopeId,
  getScopeColumn
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

    // Find manager user - include franchise_partner_id for FP-created managers
    const [users] = await pool.execute(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active, franchise_partner_id 
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

    // Generate token - include franchisePartnerId for FP-created managers
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      managerId: user.id,
      franchisePartnerId: user.franchise_partner_id || null
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
          franchisePartnerId: user.franchise_partner_id || null,
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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    // Get counts for dashboard - filter by FP or Manager scope
    const [propertiesCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM properties WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    const [vendorsCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM vendors WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    const [customersCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM clients WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    // For FP Managers, count FP employees; for standalone, count manager employees
    const employeeTable = req.isFPManager ? 'fp_employees' : 'manager_employees';
    const employeeScopeCol = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    const [employeesCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM ${employeeTable} WHERE ${employeeScopeCol} = ? AND is_active = 1`,
      [scopeId]
    );

    // Work orders - Manager sees only their own (by manager_id)
    const managerId = req.managerId;
    
    const [workOrdersCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM work_orders WHERE manager_id = ?`,
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
      `SELECT COUNT(*) as count FROM estimates WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    // Get recent work orders - Manager sees only their own
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

// Get all manager properties (FP-scoped or Manager-scoped)
router.get('/properties', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [properties] = await pool.execute(
      `SELECT p.*, z.name as zone_name 
       FROM properties p 
       LEFT JOIN zones z ON p.zone_id = z.id 
       WHERE p.${scopeColumn} = ?
       ORDER BY p.created_at DESC`,
      [scopeId]
    );

    res.json({ success: true, data: properties });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property - uses FP scope if FP Manager
router.post('/properties', requireManagerScope, async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;
    
    const propertyId = `PROP-MGR-${Date.now()}`;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [result] = await pool.execute(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, ${scopeColumn}, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode, 
       contactPerson, contactPhone, contactEmail, zoneId || null, scopeId]
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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE properties SET name = ?, property_type = ?, address = ?, city = ?, state = ?, 
        zip_code = ?, contact_person = ?, contact_phone = ?, contact_email = ?, zone_id = ?, updated_at = NOW()
       WHERE id = ? AND ${scopeColumn} = ?`,
      [name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, 
       zoneId || null, req.params.id, scopeId]
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

// Assign vendor to property - DISABLED for FP Manager
router.post('/properties/:id/assign-vendor', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  // FP Managers cannot assign vendors
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Assign vendor not allowed for this role' });
  }
  try {
    const { vendorId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE properties SET assigned_vendor_id = ?, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      [vendorId, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Vendor assigned to property' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign employee to property - DISABLED for FP Manager
router.post('/properties/:id/assign-employee', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  // FP Managers cannot assign employees
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Assign employee not allowed for this role' });
  }
  try {
    const { employeeId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE properties SET assigned_employee_id = ?, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      [employeeId, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Employee assigned to property' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WORK ORDERS
// ============================================

// Get all manager work orders - Manager sees ONLY their own work orders (by manager_id)
router.get('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { status } = req.query;
    // Always filter by manager_id so manager sees only their own work orders
    // FP dashboard uses a different route to see all FP work orders
    const managerId = req.managerId;
    
    let query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
                        v.company_name as vendor_name, cl.name as client_name
                 FROM work_orders wo
                 LEFT JOIN properties p ON wo.property_id = p.id
                 LEFT JOIN categories c ON wo.category_id = c.id
                 LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
                 LEFT JOIN clients cl ON wo.client_id = cl.id
                 WHERE wo.manager_id = ?`;
    
    const params = [managerId];
    
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

// Get pending work orders - Manager sees only their own
router.get('/work-orders/pending', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    
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
      [managerId]
    );
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get completed work orders - Manager sees only their own
router.get('/work-orders/completed', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    
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
      [managerId]
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
    
    // For FP-created managers: store BOTH franchise_partner_id AND manager_id
    // So work order shows in both FP dashboard and Manager dashboard
    const managerId = req.managerId;
    const franchisePartnerId = req.isFPManager ? req.franchisePartnerId : null;
    
    const [result] = await pool.execute(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, status, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, NOW())`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
       priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null,
       managerId, franchisePartnerId, req.user.id]
    );

    res.json({ success: true, message: 'Work order created', data: { id: result.insertId, workOrderId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update work order status - Manager can only update their own work orders
router.patch('/work-orders/:id/status', requireManagerScope, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const managerId = req.managerId;
    
    // Build update query - include notes if cancelling
    let updateQuery = `UPDATE work_orders SET status = ?, updated_at = NOW()`;
    const params = [status];
    
    if (status === 'cancelled' && notes) {
      updateQuery += `, cancellation_notes = ?`;
      params.push(notes);
    }
    
    updateQuery += ` WHERE id = ? AND manager_id = ?`;
    params.push(req.params.id, managerId);
    
    await pool.execute(updateQuery, params);

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign vendor to work order
router.patch('/work-orders/:id/assign-vendor', requireManagerScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { vendorId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE work_orders SET assigned_vendor_id = ?, status = 'assigned', updated_at = NOW() 
       WHERE id = ? AND ${scopeColumn} = ?`,
      [vendorId, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Vendor assigned' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// Get all manager customers (FP-scoped or Manager-scoped)
router.get('/customers', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [customers] = await pool.execute(
      `SELECT c.*, p.name as property_name 
       FROM clients c 
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.${scopeColumn} = ?
       ORDER BY c.created_at DESC`,
      [scopeId]
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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [result] = await pool.execute(
      `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
        zip_code, client_type, company_name, property_id, gst_number, ${scopeColumn}, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
       clientType || 'individual', companyName, propertyId || null, gstNumber, scopeId]
    );

    res.json({ success: true, message: 'Customer created', data: { id: result.insertId, clientId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get all manager vendors (FP-scoped or Manager-scoped)
router.get('/vendors', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    // Get vendors scoped to FP or Manager
    const [vendors] = await pool.execute(
      `SELECT v.*, 'own' as vendor_type FROM vendors v WHERE v.${scopeColumn} = ?`,
      [scopeId]
    );

    res.json({
      success: true,
      data: {
        own: vendors,
        assigned: [],
        all: vendors
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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [result] = await pool.execute(
      `INSERT INTO vendors (vendor_id, company_name, contact_person, email, phone, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, ${scopeColumn}, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [vendorId, companyName, contactPerson, email, phone, alternatePhone, address, city, state, 
       zipCode, gstNumber, panNumber, scopeId]
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

// Get all manager estimates (FP-scoped or Manager-scoped)
router.get('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [estimates] = await pool.execute(
      `SELECT e.*, p.name as property_name, c.name as client_name
       FROM estimates e
       LEFT JOIN properties p ON e.property_id = p.id
       LEFT JOIN clients c ON e.client_id = c.id
       WHERE e.${scopeColumn} = ? AND e.is_archived = ?
       ORDER BY e.created_at DESC`,
      [scopeId, isArchived]
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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    const [result] = await pool.execute(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, status, ${scopeColumn}, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NOW())`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
       subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, total,
       validUntil || null, scopeId, req.user.id]
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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE estimates SET is_archived = 1, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      [req.params.id, scopeId]
    );
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AMC PACKAGES - FP Managers use FP packages (read-only), standalone use manager packages
// ============================================

// Get all AMC packages
router.get('/amc-packages', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers read from fp_amc_packages, standalone from manager_amc_packages
    const table = req.isFPManager ? 'fp_amc_packages' : 'manager_amc_packages';
    const scopeColumn = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    
    const [packages] = await pool.execute(
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? AND is_active = 1 ORDER BY created_at DESC`,
      [scopeId]
    );
    
    // Filter pricing if needed
    const filteredPackages = packages.map(pkg => {
      if (pkg.hide_pricing) {
        const { base_price, price, ...rest } = pkg;
        return rest;
      }
      return pkg;
    });
    
    res.json({ success: true, data: filteredPackages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create AMC package - DISABLED for FP Managers
router.post('/amc-packages', requireManagerScope, async (req, res) => {
  // FP Managers cannot create packages
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Create package not allowed for this role' });
  }
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
// ADD-ONS - FP Managers use FP addons (read-only), standalone use manager addons
// ============================================

// Get all add-ons
router.get('/addons', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers read from fp_addons, standalone from manager_addons
    const table = req.isFPManager ? 'fp_addons' : 'manager_addons';
    const scopeColumn = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    
    const [addons] = await pool.execute(
      `SELECT a.*, c.name as category_name 
       FROM ${table} a
       LEFT JOIN categories c ON a.category_id = c.id
       WHERE a.${scopeColumn} = ? AND a.is_active = 1
       ORDER BY a.created_at DESC`,
      [scopeId]
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

// Create add-on - DISABLED for FP Managers
router.post('/addons', requireManagerScope, async (req, res) => {
  // FP Managers cannot create add-ons
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Create add-on not allowed for this role' });
  }
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
// ZONES & CATEGORIES - FP Managers use FP zones, standalone use global zones
// ============================================

router.get('/zones', requireManagerScope, async (req, res) => {
  try {
    // FP Managers get zones from fp_zones, standalone get global zones
    if (req.isFPManager) {
      const [zones] = await pool.execute(
        'SELECT * FROM fp_zones WHERE franchise_partner_id = ? AND is_active = 1 ORDER BY name',
        [req.franchisePartnerId]
      );
      res.json({ success: true, data: zones });
    } else {
      const [zones] = await pool.execute('SELECT * FROM zones WHERE is_active = 1 ORDER BY name');
      res.json({ success: true, data: zones });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', requireManagerScope, async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM categories WHERE is_active = TRUE OR is_active = 1 ORDER BY sort_order, name'
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get subcategories by category ID
router.get('/categories/:categoryId/subcategories', requireManagerScope, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const [subcategories] = await pool.execute(
      'SELECT * FROM subcategories WHERE category_id = ? AND (is_active = TRUE OR is_active = 1) ORDER BY sort_order, name',
      [categoryId]
    );
    res.json({ success: true, data: subcategories });
  } catch (error) {
    console.error('Subcategories fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// EXPORT ENDPOINTS - All DISABLED for FP Manager role
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
  // Disabled for FP Managers
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
  }
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
