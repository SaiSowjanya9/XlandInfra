/**
 * Executive Portal API Routes
 * All routes are scoped to the logged-in executive's data
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const {
  attachExecutiveScope,
  requireExecutiveScope,
  validateOwnership,
  buildScopedQuery,
  getExecutivePermissions,
  canViewPricing,
  filterPricing
} = require('../middleware/executiveScope');

// =====================================================
// EXECUTIVE LOGIN (No auth required)
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

    // Find executive user (include franchise_partner_id for FP linking)
    const [users] = await pool.query(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active, franchise_partner_id
       FROM users 
       WHERE (username = ? OR email = ?) AND role = 'executive'`,
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

    // Generate JWT token (include franchise_partner_id for FP data linking)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        executiveId: user.id,
        franchisePartnerId: user.franchise_partner_id || null
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
          executiveId: user.id,
          franchisePartnerId: user.franchise_partner_id || null,
          portal: 'executive'
        }
      }
    });
  } catch (error) {
    console.error('Executive login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachExecutiveScope);

// =====================================================
// DASHBOARD
// =====================================================
router.get('/dashboard', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    // Get counts for executive's data
    const [propertiesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE executive_id = ?
       UNION ALL
       SELECT COUNT(*) FROM executive_assigned_properties WHERE executive_id = ?`,
      [executiveId, executiveId]
    );

    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM vendors WHERE executive_id = ?
       UNION ALL
       SELECT COUNT(*) FROM executive_assigned_vendors WHERE executive_id = ?`,
      [executiveId, executiveId]
    );

    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients WHERE executive_id = ?`,
      [executiveId]
    );

    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM executive_employees WHERE executive_id = ?`,
      [executiveId]
    );

    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE executive_id = ?`,
      [executiveId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE executive_id = ? AND status IN ('requested', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [executiveId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE executive_id = ? AND status IN ('completed', 'closed')`,
      [executiveId]
    );

    const [estimatesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM estimates WHERE executive_id = ?`,
      [executiveId]
    );

    // Get recent work orders
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       WHERE wo.executive_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [executiveId]
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
router.get('/properties', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    // Get both own and assigned properties
    const [properties] = await pool.query(
      `SELECT p.*, z.name as zone_name, 
              'own' as access_type, TRUE as can_modify, FALSE as can_delete,
              FALSE as can_assign_vendor, FALSE as can_assign_employee
       FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE p.executive_id = ?
       UNION
       SELECT p.*, z.name as zone_name,
              'assigned' as access_type, eap.can_modify, eap.can_delete,
              eap.can_assign_vendor, eap.can_assign_employee
       FROM properties p
       INNER JOIN executive_assigned_properties eap ON p.id = eap.property_id
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE eap.executive_id = ?
       ORDER BY created_at DESC`,
      [executiveId, executiveId]
    );

    res.json({ success: true, data: properties });
  } catch (error) {
    console.error('Properties fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
});

router.post('/properties', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    const propertyId = `PROP-EXEC-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, executive_id, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, executiveId, franchisePartnerId]
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

router.put('/properties/:id', requireExecutiveScope, validateOwnership('properties', 'id', true), async (req, res) => {
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

router.delete('/properties/:id', requireExecutiveScope, validateOwnership('properties', 'id', true), async (req, res) => {
  try {
    if (!req.canDelete) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this property' });
    }

    const { id } = req.params;
    await pool.query('DELETE FROM properties WHERE id = ?', [id]);
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Property delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete property' });
  }
});

// =====================================================
// WORK ORDERS
// =====================================================
router.get('/work-orders', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const { status } = req.query;

    let query = `
      SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN service_categories sc ON wo.category_id = sc.id
      LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
      WHERE wo.executive_id = ?
    `;
    const params = [executiveId];

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

router.get('/work-orders/pending', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE wo.executive_id = ? AND wo.status IN ('requested', 'under_review', 'assigned', 'accepted', 'in_progress')
       ORDER BY wo.created_at DESC`,
      [executiveId]
    );

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Pending work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending work orders' });
  }
});

router.get('/work-orders/completed', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE wo.executive_id = ? AND wo.status IN ('completed', 'closed')
       ORDER BY wo.created_at DESC`,
      [executiveId]
    );

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Completed work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch completed work orders' });
  }
});

router.post('/work-orders', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate } = req.body;

    const workOrderId = `WO-EXEC-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, executive_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, executiveId, franchisePartnerId]
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

// =====================================================
// CUSTOMERS
// =====================================================
router.get('/customers', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [customers] = await pool.query(
      `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.executive_id = ?
       ORDER BY c.created_at DESC`,
      [executiveId]
    );

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Customers fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
});

router.post('/customers', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, email, phone, alternatePhone, address, city, state, zipCode, clientType, companyName, propertyId, gstNumber } = req.body;

    const clientId = `CLT-EXEC-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
        zip_code, client_type, company_name, property_id, gst_number, executive_id, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
        clientType || 'individual', companyName, propertyId || null, gstNumber, executiveId, franchisePartnerId]
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

router.put('/customers/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    const executiveId = req.executiveId;
    const { name, email, phone, alternatePhone, address, city, state, zipCode, clientType, companyName, gstNumber } = req.body;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM clients WHERE id = ? AND executive_id = ?',
      [id, executiveId]
    );

    if (existing.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query(
      `UPDATE clients SET name = ?, email = ?, phone = ?, alternate_phone = ?, address = ?, 
        city = ?, state = ?, zip_code = ?, client_type = ?, company_name = ?, gst_number = ?
       WHERE id = ?`,
      [name, email, phone, alternatePhone, address, city, state, zipCode, clientType, companyName, gstNumber, id]
    );

    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Customer update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update customer' });
  }
});

// =====================================================
// VENDORS
// =====================================================
router.get('/vendors', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    // Get own vendors
    const [ownVendors] = await pool.query(
      `SELECT v.*, 'own' as vendor_type, TRUE as can_modify, FALSE as can_delete
       FROM vendors v
       WHERE v.executive_id = ?`,
      [executiveId]
    );

    // Get assigned vendors
    const [assignedVendors] = await pool.query(
      `SELECT v.*, 'assigned' as vendor_type, eav.can_modify, eav.can_delete
       FROM vendors v
       INNER JOIN executive_assigned_vendors eav ON v.id = eav.vendor_id
       WHERE eav.executive_id = ? AND eav.is_active = TRUE`,
      [executiveId]
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

router.post('/vendors', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;

    const vendorId = `VND-EXEC-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO vendors (vendor_id, company_name, contact_person, email, phone, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, executive_id, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, executiveId, franchisePartnerId]
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

router.put('/vendors/:id', requireExecutiveScope, validateOwnership('vendors', 'id', true), async (req, res) => {
  try {
    if (!req.canModify) {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify this vendor' });
    }

    const { id } = req.params;
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;

    await pool.query(
      `UPDATE vendors SET company_name = ?, contact_person = ?, email = ?, phone = ?, 
        alternate_phone = ?, address = ?, city = ?, state = ?, zip_code = ?, gst_number = ?, pan_number = ?
       WHERE id = ?`,
      [companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, id]
    );

    res.json({ success: true, message: 'Vendor updated successfully' });
  } catch (error) {
    console.error('Vendor update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vendor' });
  }
});

router.delete('/vendors/:id', requireExecutiveScope, validateOwnership('vendors', 'id', true), async (req, res) => {
  try {
    if (!req.canDelete) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this vendor' });
    }

    const { id } = req.params;
    await pool.query('DELETE FROM vendors WHERE id = ?', [id]);
    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Vendor delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete vendor' });
  }
});

// =====================================================
// EMPLOYEES
// =====================================================
router.get('/employees', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [employees] = await pool.query(
      `SELECT ee.*, GROUP_CONCAT(z.name) as zone_names
       FROM executive_employees ee
       LEFT JOIN executive_employee_zones eez ON ee.id = eez.executive_employee_id
       LEFT JOIN zones z ON eez.zone_id = z.id
       WHERE ee.executive_id = ?
       GROUP BY ee.id
       ORDER BY ee.created_at DESC`,
      [executiveId]
    );

    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

router.get('/employees/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    const executiveId = req.executiveId;

    const [employees] = await pool.query(
      `SELECT ee.*, GROUP_CONCAT(z.id) as zone_ids, GROUP_CONCAT(z.name) as zone_names
       FROM executive_employees ee
       LEFT JOIN executive_employee_zones eez ON ee.id = eez.executive_employee_id
       LEFT JOIN zones z ON eez.zone_id = z.id
       WHERE ee.id = ? AND ee.executive_id = ?
       GROUP BY ee.id`,
      [id, executiveId]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, data: employees[0] });
  } catch (error) {
    console.error('Employee fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee' });
  }
});

router.post('/employees', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { firstName, lastName, email, phone, role, assignedZones } = req.body;

    const employeeCode = `EMP-EXEC-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO executive_employees (executive_id, franchise_partner_id, employee_code, first_name, last_name, email, phone, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [executiveId, franchisePartnerId, employeeCode, firstName, lastName, email, phone, role || 'exec_assistant']
    );

    // Assign zones
    if (assignedZones && assignedZones.length > 0) {
      const zoneValues = assignedZones.map(zoneId => [result.insertId, zoneId]);
      await pool.query(
        'INSERT INTO executive_employee_zones (executive_employee_id, zone_id) VALUES ?',
        [zoneValues]
      );
    }

    res.json({
      success: true,
      message: 'Employee created successfully',
      data: { id: result.insertId, employeeCode }
    });
  } catch (error) {
    console.error('Employee create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create employee' });
  }
});

router.put('/employees/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    const executiveId = req.executiveId;
    const { firstName, lastName, email, phone, role, assignedZones } = req.body;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM executive_employees WHERE id = ? AND executive_id = ?',
      [id, executiveId]
    );

    if (existing.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query(
      `UPDATE executive_employees SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?
       WHERE id = ?`,
      [firstName, lastName, email, phone, role, id]
    );

    // Update zones
    if (assignedZones) {
      await pool.query('DELETE FROM executive_employee_zones WHERE executive_employee_id = ?', [id]);
      if (assignedZones.length > 0) {
        const zoneValues = assignedZones.map(zoneId => [id, zoneId]);
        await pool.query(
          'INSERT INTO executive_employee_zones (executive_employee_id, zone_id) VALUES ?',
          [zoneValues]
        );
      }
    }

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    console.error('Employee update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
});

router.delete('/employees/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    const executiveId = req.executiveId;

    const [result] = await pool.query(
      'DELETE FROM executive_employees WHERE id = ? AND executive_id = ?',
      [id, executiveId]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Employee delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete employee' });
  }
});

// =====================================================
// ESTIMATES
// =====================================================
router.get('/estimates', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const { archived } = req.query;

    let query = `
      SELECT e.*, c.name as client_name, p.name as property_name
      FROM estimates e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE e.executive_id = ?
    `;

    if (archived === 'true') {
      query += ` AND e.status = 'archived'`;
    } else {
      query += ` AND e.status != 'archived'`;
    }

    query += ' ORDER BY e.created_at DESC';

    const [estimates] = await pool.query(query, [executiveId]);
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('Estimates fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
  }
});

router.post('/estimates', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { clientId, propertyId, title, description, estimateType, subtotal, taxPercentage, discountPercentage, validUntil, items } = req.body;

    const estimateId = `EST-EXEC-${Date.now()}`;
    const tax = (subtotal * (taxPercentage || 0)) / 100;
    const discount = (subtotal * (discountPercentage || 0)) / 100;
    const totalAmount = subtotal + tax - discount;

    const [result] = await pool.query(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, executive_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
        subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, totalAmount,
        validUntil || null, executiveId, franchisePartnerId]
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
router.get('/amc-packages', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const canView = await canViewPricing(executiveId, 'amc_packages');

    const [packages] = await pool.query(
      `SELECT * FROM executive_amc_packages WHERE executive_id = ? ORDER BY created_at DESC`,
      [executiveId]
    );

    res.json({ success: true, data: filterPricing(packages, canView) });
  } catch (error) {
    console.error('AMC packages fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
  }
});

router.post('/amc-packages', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, description, durationMonths, basePrice, services, termsConditions, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO executive_amc_packages (executive_id, franchise_partner_id, name, description, duration_months, base_price, services, terms_conditions, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [executiveId, franchisePartnerId, name, description, durationMonths || 12, basePrice || 0,
        JSON.stringify(services || []), termsConditions, hidePricing !== false]
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
router.get('/addons', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const canView = await canViewPricing(executiveId, 'addons');

    const [addons] = await pool.query(
      `SELECT ea.*, sc.name as category_name
       FROM executive_addons ea
       LEFT JOIN service_categories sc ON ea.category_id = sc.id
       WHERE ea.executive_id = ?
       ORDER BY ea.created_at DESC`,
      [executiveId]
    );

    res.json({ success: true, data: filterPricing(addons, canView) });
  } catch (error) {
    console.error('Addons fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
  }
});

router.post('/addons', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, description, price, unit, categoryId, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO executive_addons (executive_id, franchise_partner_id, name, description, price, unit, category_id, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [executiveId, franchisePartnerId, name, description, price || 0, unit || 'per_service', categoryId || null, hidePricing !== false]
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
router.get('/zones', requireExecutiveScope, async (req, res) => {
  try {
    const [zones] = await pool.query('SELECT * FROM zones WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: zones });
  } catch (error) {
    console.error('Zones fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch zones' });
  }
});

router.get('/categories', requireExecutiveScope, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM service_categories WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// =====================================================
// EXPORTS
// =====================================================
router.get('/export/properties', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [properties] = await pool.query(
      `SELECT p.*, z.name as zone_name FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE p.executive_id = ?`,
      [executiveId]
    );

    res.json({ success: true, data: properties, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

router.get('/export/vendors', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [vendors] = await pool.query(
      `SELECT * FROM vendors WHERE executive_id = ?`,
      [executiveId]
    );

    res.json({ success: true, data: vendors, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

router.get('/export/employees', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [employees] = await pool.query(
      `SELECT ee.*, GROUP_CONCAT(z.name) as zone_names
       FROM executive_employees ee
       LEFT JOIN executive_employee_zones eez ON ee.id = eez.executive_employee_id
       LEFT JOIN zones z ON eez.zone_id = z.id
       WHERE ee.executive_id = ?
       GROUP BY ee.id`,
      [executiveId]
    );

    res.json({ success: true, data: employees, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

router.get('/export/work-orders', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       WHERE wo.executive_id = ?`,
      [executiveId]
    );

    res.json({ success: true, data: workOrders, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

module.exports = router;
