/**
 * Coordinator Portal API Routes
 * All routes are scoped to the logged-in coordinator's data
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const {
  attachCoordinatorScope,
  requireCoordinatorScope,
  validateOwnership,
  buildScopedQuery,
  getCoordinatorPermissions,
  canViewPricing,
  filterPricing
} = require('../middleware/coordinatorScope');

// =====================================================
// COORDINATOR LOGIN (No auth required)
// =====================================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find coordinator user
    const [users] = await pool.query(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active
       FROM users 
       WHERE (username = ? OR email = ?) AND role = 'coordinator'`,
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        coordinatorId: user.id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          coordinatorId: user.id,
          portal: 'coordinator'
        }
      }
    });
  } catch (error) {
    console.error('Coordinator login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachCoordinatorScope);

// =====================================================
// DASHBOARD
// =====================================================
router.get('/dashboard', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    // Get counts for coordinator's data
    const [propertiesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE coordinator_id = ?
       UNION ALL
       SELECT COUNT(*) FROM coordinator_assigned_properties WHERE coordinator_id = ?`,
      [coordinatorId, coordinatorId]
    );

    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM vendors WHERE coordinator_id = ?
       UNION ALL
       SELECT COUNT(*) FROM coordinator_assigned_vendors WHERE coordinator_id = ?`,
      [coordinatorId, coordinatorId]
    );

    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients WHERE coordinator_id = ?`,
      [coordinatorId]
    );

    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM coordinator_employees WHERE coordinator_id = ?`,
      [coordinatorId]
    );

    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE coordinator_id = ?`,
      [coordinatorId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE coordinator_id = ? AND status IN ('requested', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [coordinatorId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE coordinator_id = ? AND status IN ('completed', 'closed')`,
      [coordinatorId]
    );

    const [estimatesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM estimates WHERE coordinator_id = ?`,
      [coordinatorId]
    );

    // Get recent work orders
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       WHERE wo.coordinator_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [coordinatorId]
    );

    res.json({
      success: true,
      data: {
        stats: {
          properties: (propertiesCount[0]?.count || 0) + (propertiesCount[1]?.count || 0),
          vendors: (vendorsCount[0]?.count || 0) + (vendorsCount[1]?.count || 0),
          customers: customersCount[0]?.count || 0,
          employees: employeesCount[0]?.count || 0,
          workOrders: workOrdersCount[0]?.count || 0,
          pendingWorkOrders: pendingWOCount[0]?.count || 0,
          completedWorkOrders: completedWOCount[0]?.count || 0,
          estimates: estimatesCount[0]?.count || 0
        },
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

// =====================================================
// PROPERTIES
// =====================================================
router.get('/properties', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    // Get both own and assigned properties
    const [properties] = await pool.query(
      `SELECT p.*, z.name as zone_name, 
              'own' as access_type, TRUE as can_modify, TRUE as can_delete,
              TRUE as can_assign_vendor, TRUE as can_assign_employee
       FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE p.coordinator_id = ?
       UNION
       SELECT p.*, z.name as zone_name,
              'assigned' as access_type, cap.can_modify, cap.can_delete,
              cap.can_assign_vendor, cap.can_assign_employee
       FROM properties p
       INNER JOIN coordinator_assigned_properties cap ON p.id = cap.property_id
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE cap.coordinator_id = ?
       ORDER BY created_at DESC`,
      [coordinatorId, coordinatorId]
    );

    res.json({ success: true, data: properties });
  } catch (error) {
    console.error('Properties fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
});

router.post('/properties', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    const propertyId = `PROP-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, coordinator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, coordinatorId]
    );

    res.json({
      success: true,
      message: 'Property created successfully',
      data: { id: result.insertId, propertyId }
    });
  } catch (error) {
    console.error('Property create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create property' });
  }
});

router.put('/properties/:id', requireCoordinatorScope, validateOwnership('properties', 'id', true), async (req, res) => {
  try {
    if (!req.canModify) {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify this property' });
    }

    const { id } = req.params;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    await pool.query(
      `UPDATE properties SET name = ?, property_type = ?, address = ?, city = ?, state = ?, 
        zip_code = ?, contact_person = ?, contact_phone = ?, contact_email = ?, zone_id = ?
       WHERE id = ?`,
      [name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId || null, id]
    );

    res.json({ success: true, message: 'Property updated successfully' });
  } catch (error) {
    console.error('Property update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update property' });
  }
});

// Delete property - DISABLED for Coordinator role
router.delete('/properties/:id', requireCoordinatorScope, validateOwnership('properties', 'id', true), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// Assign vendor - DISABLED for Coordinator role
router.post('/properties/:id/assign-vendor', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Assign vendor not allowed for this role' });
});

// Assign employee - DISABLED for Coordinator role
router.post('/properties/:id/assign-employee', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Assign employee not allowed for this role' });
});

// =====================================================
// WORK ORDERS
// =====================================================
router.get('/work-orders', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { status } = req.query;

    let query = `
      SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN service_categories sc ON wo.category_id = sc.id
      LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
      WHERE wo.coordinator_id = ?
    `;
    const params = [coordinatorId];

    if (status) {
      query += ' AND wo.status = ?';
      params.push(status);
    }

    query += ' ORDER BY wo.created_at DESC';

    const [workOrders] = await pool.query(query, params);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work orders' });
  }
});

router.get('/work-orders/pending', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE wo.coordinator_id = ? AND wo.status IN ('requested', 'under_review', 'assigned', 'accepted', 'in_progress')
       ORDER BY wo.created_at DESC`,
      [coordinatorId]
    );

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Pending work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending work orders' });
  }
});

router.get('/work-orders/completed', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE wo.coordinator_id = ? AND wo.status IN ('completed', 'closed')
       ORDER BY wo.created_at DESC`,
      [coordinatorId]
    );

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Completed work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch completed work orders' });
  }
});

router.post('/work-orders', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate } = req.body;

    const workOrderId = `WO-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, coordinator_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, coordinatorId]
    );

    res.json({
      success: true,
      message: 'Work order created successfully',
      data: { id: result.insertId, workOrderId }
    });
  } catch (error) {
    console.error('Work order create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create work order' });
  }
});

router.patch('/work-orders/:id/status', requireCoordinatorScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query('UPDATE work_orders SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

router.patch('/work-orders/:id/assign-vendor', requireCoordinatorScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    await pool.query(
      'UPDATE work_orders SET assigned_vendor_id = ?, status = ? WHERE id = ?',
      [vendorId, 'assigned', id]
    );

    res.json({ success: true, message: 'Vendor assigned successfully' });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign vendor' });
  }
});

// =====================================================
// CUSTOMERS
// =====================================================
router.get('/customers', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    const [customers] = await pool.query(
      `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.coordinator_id = ?
       ORDER BY c.created_at DESC`,
      [coordinatorId]
    );

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Customers fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
});

router.post('/customers', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { name, email, phone, alternatePhone, address, city, state, zipCode, clientType, companyName, propertyId, gstNumber } = req.body;

    const clientId = `CLT-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
        zip_code, client_type, company_name, property_id, gst_number, coordinator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
        clientType || 'individual', companyName, propertyId || null, gstNumber, coordinatorId]
    );

    res.json({
      success: true,
      message: 'Customer created successfully',
      data: { id: result.insertId, clientId }
    });
  } catch (error) {
    console.error('Customer create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
});

// =====================================================
// VENDORS
// =====================================================
router.get('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    // Get own vendors
    const [ownVendors] = await pool.query(
      `SELECT v.*, 'own' as vendor_type, TRUE as can_modify, TRUE as can_delete
       FROM vendors v
       WHERE v.coordinator_id = ?`,
      [coordinatorId]
    );

    // Get assigned vendors
    const [assignedVendors] = await pool.query(
      `SELECT v.*, 'assigned' as vendor_type, cav.can_modify, cav.can_delete
       FROM vendors v
       INNER JOIN coordinator_assigned_vendors cav ON v.id = cav.vendor_id
       WHERE cav.coordinator_id = ? AND cav.is_active = TRUE`,
      [coordinatorId]
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
    console.error('Vendors fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
  }
});

router.post('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;

    const vendorId = `VND-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO vendors (vendor_id, company_name, contact_person, email, phone, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, coordinator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, coordinatorId]
    );

    res.json({
      success: true,
      message: 'Vendor created successfully',
      data: { id: result.insertId, vendorId }
    });
  } catch (error) {
    console.error('Vendor create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create vendor' });
  }
});

// Update vendor - DISABLED for Coordinator role
router.put('/vendors/:id', requireCoordinatorScope, validateOwnership('vendors', 'id', true), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Modify vendor not allowed for this role' });
});

// Delete vendor - DISABLED for Coordinator role
router.delete('/vendors/:id', requireCoordinatorScope, validateOwnership('vendors', 'id', true), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete vendor not allowed for this role' });
});

// =====================================================
// EMPLOYEES - DISABLED for Coordinator role
// =====================================================
router.get('/employees', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

router.get('/employees/:id', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

router.post('/employees', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

router.put('/employees/:id', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

router.delete('/employees/:id', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// =====================================================
// ESTIMATES
// =====================================================
router.get('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { archived } = req.query;

    let query = `
      SELECT e.*, c.name as client_name, p.name as property_name
      FROM estimates e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE e.coordinator_id = ?
    `;

    if (archived === 'true') {
      query += ` AND e.status = 'archived'`;
    } else {
      query += ` AND e.status != 'archived'`;
    }

    query += ' ORDER BY e.created_at DESC';

    const [estimates] = await pool.query(query, [coordinatorId]);
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('Estimates fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
  }
});

router.post('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { clientId, propertyId, title, description, estimateType, subtotal, taxPercentage, discountPercentage, validUntil, items } = req.body;

    const estimateId = `EST-COORD-${Date.now()}`;
    const tax = (subtotal * (taxPercentage || 0)) / 100;
    const discount = (subtotal * (discountPercentage || 0)) / 100;
    const totalAmount = subtotal + tax - discount;

    const [result] = await pool.query(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, coordinator_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
        subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, totalAmount,
        validUntil || null, coordinatorId]
    );

    // Insert line items
    if (items && items.length > 0) {
      const itemValues = items.map(item => [
        result.insertId,
        item.description,
        item.quantity,
        item.unitPrice,
        item.totalPrice || (item.quantity * item.unitPrice)
      ]);
      await pool.query(
        'INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total_price) VALUES ?',
        [itemValues]
      );
    }

    res.json({
      success: true,
      message: 'Estimate created successfully',
      data: { id: result.insertId, estimateId }
    });
  } catch (error) {
    console.error('Estimate create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create estimate' });
  }
});

// =====================================================
// AMC PACKAGES
// =====================================================
router.get('/amc-packages', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const canView = await canViewPricing(coordinatorId, 'amc_packages');

    const [packages] = await pool.query(
      `SELECT * FROM coordinator_amc_packages WHERE coordinator_id = ? ORDER BY created_at DESC`,
      [coordinatorId]
    );

    res.json({ success: true, data: filterPricing(packages, canView) });
  } catch (error) {
    console.error('AMC packages fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
  }
});

router.post('/amc-packages', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { name, description, durationMonths, basePrice, services, termsConditions, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO coordinator_amc_packages (coordinator_id, name, description, duration_months, base_price, services, terms_conditions, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [coordinatorId, name, description, durationMonths || 12, basePrice || 0,
        JSON.stringify(services || []), termsConditions, hidePricing || false]
    );

    res.json({
      success: true,
      message: 'AMC package created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('AMC package create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create AMC package' });
  }
});

// =====================================================
// ADD-ONS
// =====================================================
router.get('/addons', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const canView = await canViewPricing(coordinatorId, 'addons');

    const [addons] = await pool.query(
      `SELECT ca.*, sc.name as category_name
       FROM coordinator_addons ca
       LEFT JOIN service_categories sc ON ca.category_id = sc.id
       WHERE ca.coordinator_id = ?
       ORDER BY ca.created_at DESC`,
      [coordinatorId]
    );

    res.json({ success: true, data: filterPricing(addons, canView) });
  } catch (error) {
    console.error('Addons fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
  }
});

router.post('/addons', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const { name, description, price, unit, categoryId, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO coordinator_addons (coordinator_id, name, description, price, unit, category_id, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [coordinatorId, name, description, price || 0, unit || 'per_service', categoryId || null, hidePricing || false]
    );

    res.json({
      success: true,
      message: 'Add-on created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Addon create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create addon' });
  }
});

// =====================================================
// ZONES & CATEGORIES
// =====================================================
router.get('/zones', requireCoordinatorScope, async (req, res) => {
  try {
    const [zones] = await pool.query('SELECT * FROM zones WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: zones });
  } catch (error) {
    console.error('Zones fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch zones' });
  }
});

router.get('/categories', requireCoordinatorScope, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM service_categories WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// =====================================================
// EXPORTS - DISABLED for Coordinator role
// =====================================================
router.get('/export/properties', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

router.get('/export/vendors', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

router.get('/export/employees', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

router.get('/export/work-orders', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       WHERE wo.coordinator_id = ?`,
      [coordinatorId]
    );

    res.json({ success: true, data: workOrders, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

module.exports = router;
