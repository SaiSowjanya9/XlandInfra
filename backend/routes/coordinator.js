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
  filterPricing,
  getScopeId,
  getScopeColumn
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

    // Find coordinator user - include franchise_partner_id for FP-created coordinators
    const [users] = await pool.query(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active, franchise_partner_id
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

    // Generate JWT token - include franchisePartnerId for FP-created coordinators
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        coordinatorId: user.id,
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
          coordinatorId: user.id,
          franchisePartnerId: user.franchise_partner_id || null,
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
// DASHBOARD (FP-scoped or Coordinator-scoped)
// =====================================================
router.get('/dashboard', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    // Get counts - filter by FP or Coordinator scope
    const [propertiesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM vendors WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    // For FP Coordinators, count FP employees; for standalone, count coordinator employees
    const employeeTable = req.isFPCoordinator ? 'fp_employees' : 'coordinator_employees';
    const employeeScopeCol = req.isFPCoordinator ? 'franchise_partner_id' : 'coordinator_id';
    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM ${employeeTable} WHERE ${employeeScopeCol} = ? AND is_active = 1`,
      [scopeId]
    );

    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE ${scopeColumn} = ? AND status IN ('requested', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [scopeId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE ${scopeColumn} = ? AND status IN ('completed', 'closed')`,
      [scopeId]
    );

    const [estimatesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM estimates WHERE ${scopeColumn} = ?`,
      [scopeId]
    );

    // Get recent work orders
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       WHERE wo.${scopeColumn} = ?
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [scopeId]
    );

    res.json({
      success: true,
      data: {
        stats: {
          properties: propertiesCount[0]?.count || 0,
          vendors: vendorsCount[0]?.count || 0,
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
// PROPERTIES (FP-scoped or Coordinator-scoped)
// =====================================================
router.get('/properties', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    // Get properties scoped to FP or Coordinator with all required fields
    const [properties] = await pool.query(
      `SELECT p.*, 
        z.name as zone_name,
        COALESCE(p.area_name, p.city) as area,
        COALESCE(p.division, 'General') as division,
        COALESCE(p.total_units, 1) as units,
        COALESCE(p.status, 'active') as status,
        COALESCE(p.created_by, 'System') as created_by,
        CONCAT(COALESCE(p.contact_person, ''), CASE WHEN p.contact_phone IS NOT NULL THEN CONCAT(' | ', p.contact_phone) ELSE '' END) as contacts
       FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE p.${scopeColumn} = ?
       ORDER BY p.created_at DESC`,
      [scopeId]
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
    const franchisePartnerId = req.franchisePartnerId;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    const propertyId = `PROP-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, coordinator_id, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, coordinatorId, franchisePartnerId]
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
// WORK ORDERS (FP-scoped or Coordinator-scoped)
// =====================================================
router.get('/work-orders', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    const { status } = req.query;

    let query = `
      SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN service_categories sc ON wo.category_id = sc.id
      LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
      WHERE wo.${scopeColumn} = ?
    `;
    const params = [scopeId];

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
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE wo.${scopeColumn} = ? AND wo.status IN ('requested', 'under_review', 'assigned', 'accepted', 'in_progress')
       ORDER BY wo.created_at DESC`,
      [scopeId]
    );

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Pending work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending work orders' });
  }
});

router.get('/work-orders/completed', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, sc.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN service_categories sc ON wo.category_id = sc.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE wo.${scopeColumn} = ? AND wo.status IN ('completed', 'closed')
       ORDER BY wo.created_at DESC`,
      [scopeId]
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
    const franchisePartnerId = req.franchisePartnerId;
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate } = req.body;

    const workOrderId = `WO-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, coordinator_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, coordinatorId, franchisePartnerId]
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
    const { status, cancellationNote } = req.body;

    // If cancelling, store the cancellation note
    if (status === 'cancelled' && cancellationNote) {
      await pool.query(
        'UPDATE work_orders SET status = ?, cancellation_note = ?, cancelled_at = NOW() WHERE id = ?', 
        [status, cancellationNote, id]
      );
    } else {
      await pool.query('UPDATE work_orders SET status = ? WHERE id = ?', [status, id]);
    }
    
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

router.patch('/work-orders/:id/assign-employee', requireCoordinatorScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    await pool.query(
      'UPDATE work_orders SET assigned_employee_id = ?, status = ? WHERE id = ?',
      [employeeId, 'assigned', id]
    );

    res.json({ success: true, message: 'Employee assigned successfully' });
  } catch (error) {
    console.error('Assign employee error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign employee' });
  }
});

router.delete('/work-orders/:id', requireCoordinatorScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete - update status to cancelled
    await pool.query(
      'UPDATE work_orders SET status = ?, deleted_at = NOW() WHERE id = ?',
      ['cancelled', id]
    );

    res.json({ success: true, message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Delete work order error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete work order' });
  }
});

// =====================================================
// CUSTOMERS (FP-scoped or Coordinator-scoped)
// =====================================================
router.get('/customers', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    const [customers] = await pool.query(
      `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.${scopeColumn} = ?
       ORDER BY c.created_at DESC`,
      [scopeId]
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
    const franchisePartnerId = req.franchisePartnerId;
    const {
      // Property form data
      zone, areaName, division, propertyType, communityName,
      associationContacts, numberOfBlocks, unitsPerBlock, blockNames,
      numberOfUnits, villaPlotNumber, blockInfo, blockNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      // Simple customer data (backward compatibility)
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    // Check if this is a property form submission
    if (zone && communityName) {
      const propertyIdGen = `COORD-${entryType || 'GC'}-${Date.now()}`;
      const clientId = `COORD-CLT-${Date.now()}`;
      
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      const [propertyResult] = await pool.query(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          coordinator_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          coordinatorId, franchisePartnerId, req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || ''
        ]
      );

      let customerResult = null;
      if (contactEmail) {
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        const [existing] = await pool.query('SELECT id FROM customer_accounts WHERE email = ?', [contactEmail]);
        
        if (existing.length === 0) {
          [customerResult] = await pool.query(
            `INSERT INTO customer_accounts (
              customer_id, name, email, phone, password_hash, property_id,
              coordinator_id, franchise_partner_id, is_activated, temp_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, contactName, contactEmail, `${contactCountryCode}${contactPhone}`,
              hashedPassword, propertyResult.insertId, coordinatorId, franchisePartnerId, 0, tempPassword]
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully',
        data: { propertyId: propertyIdGen, clientId, customerId: customerResult?.insertId || null }
      });
    } else {
      const clientId = `CLT-COORD-${Date.now()}`;
      const [result] = await pool.query(
        `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
          zip_code, client_type, company_name, property_id, gst_number, coordinator_id, franchise_partner_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber, coordinatorId, franchisePartnerId]
      );
      res.json({ success: true, message: 'Customer created successfully', data: { id: result.insertId, clientId } });
    }
  } catch (error) {
    console.error('Customer create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
});

// =====================================================
// VENDORS (FP-scoped or Coordinator-scoped)
// =====================================================
router.get('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    // Get vendors scoped to FP or Coordinator
    const [vendors] = await pool.query(
      `SELECT v.*, 'own' as vendor_type
       FROM vendors v
       WHERE v.${scopeColumn} = ?
       ORDER BY v.created_at DESC`,
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
    console.error('Vendors fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
  }
});

router.post('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;

    const vendorId = `VND-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO vendors (vendor_id, company_name, contact_person, email, phone, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, coordinator_id, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, coordinatorId, franchisePartnerId]
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
// EMPLOYEES - Read-only access for work order assignment
// =====================================================
router.get('/employees', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Coordinators get FP employees, standalone coordinators get coordinator employees
    if (req.isFPCoordinator) {
      const [employees] = await pool.query(
        `SELECT id, first_name, last_name, email, role, is_active 
         FROM fp_employees 
         WHERE franchise_partner_id = ? AND is_active = 1
         ORDER BY first_name, last_name`,
        [scopeId]
      );
      return res.json({ success: true, data: employees });
    }
    
    // For standalone coordinators, return coordinator employees
    const [employees] = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_active 
       FROM coordinator_employees 
       WHERE coordinator_id = ? AND is_active = 1
       ORDER BY first_name, last_name`,
      [scopeId]
    );
    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

router.get('/employees/:id', requireCoordinatorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee details not allowed for this role' });
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
// ESTIMATES (FP-scoped or Coordinator-scoped)
// =====================================================
router.get('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    const { archived } = req.query;

    let query = `
      SELECT e.*, c.name as client_name, p.name as property_name
      FROM estimates e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE e.${scopeColumn} = ?
    `;

    if (archived === 'true') {
      query += ` AND e.status = 'archived'`;
    } else {
      query += ` AND e.status != 'archived'`;
    }

    query += ' ORDER BY e.created_at DESC';

    const [estimates] = await pool.query(query, [scopeId]);
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('Estimates fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
  }
});

router.post('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { clientId, propertyId, title, description, estimateType, subtotal, taxPercentage, discountPercentage, validUntil, items } = req.body;

    const estimateId = `EST-COORD-${Date.now()}`;
    const tax = (subtotal * (taxPercentage || 0)) / 100;
    const discount = (subtotal * (discountPercentage || 0)) / 100;
    const totalAmount = subtotal + tax - discount;

    const [result] = await pool.query(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, coordinator_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
        subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, totalAmount,
        validUntil || null, coordinatorId, franchisePartnerId]
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
// AMC PACKAGES - FP Coordinators use FP packages (read-only)
// =====================================================
router.get('/amc-packages', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Coordinators read from fp_amc_packages, standalone from coordinator_amc_packages
    const table = req.isFPCoordinator ? 'fp_amc_packages' : 'coordinator_amc_packages';
    const scopeColumn = req.isFPCoordinator ? 'franchise_partner_id' : 'coordinator_id';
    
    const [packages] = await pool.query(
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? AND is_active = 1 ORDER BY created_at DESC`,
      [scopeId]
    );

    res.json({ success: true, data: filterPricing(packages, true) });
  } catch (error) {
    console.error('AMC packages fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
  }
});

// Create AMC package - DISABLED for FP Coordinators
router.post('/amc-packages', requireCoordinatorScope, async (req, res) => {
  // FP Coordinators cannot create packages
  if (req.isFPCoordinator) {
    return res.status(403).json({ success: false, message: 'Create package not allowed for this role' });
  }
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, description, durationMonths, basePrice, services, termsConditions, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO coordinator_amc_packages (coordinator_id, franchise_partner_id, name, description, duration_months, base_price, services, terms_conditions, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [coordinatorId, franchisePartnerId, name, description, durationMonths || 12, basePrice || 0,
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
// ADD-ONS - FP Coordinators use FP addons (read-only)
// =====================================================
router.get('/addons', requireCoordinatorScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Coordinators read from fp_addons, standalone from coordinator_addons
    const table = req.isFPCoordinator ? 'fp_addons' : 'coordinator_addons';
    const scopeColumn = req.isFPCoordinator ? 'franchise_partner_id' : 'coordinator_id';
    
    const [addons] = await pool.query(
      `SELECT a.*, c.name as category_name
       FROM ${table} a
       LEFT JOIN categories c ON a.category_id = c.id
       WHERE a.${scopeColumn} = ? AND a.is_active = 1
       ORDER BY a.created_at DESC`,
      [scopeId]
    );

    res.json({ success: true, data: filterPricing(addons, true) });
  } catch (error) {
    console.error('Addons fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
  }
});

// Create add-on - DISABLED for FP Coordinators
router.post('/addons', requireCoordinatorScope, async (req, res) => {
  // FP Coordinators cannot create add-ons
  if (req.isFPCoordinator) {
    return res.status(403).json({ success: false, message: 'Create add-on not allowed for this role' });
  }
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, description, price, unit, categoryId, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO coordinator_addons (coordinator_id, franchise_partner_id, name, description, price, unit, category_id, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [coordinatorId, franchisePartnerId, name, description, price || 0, unit || 'per_service', categoryId || null, hidePricing || false]
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
// ZONES & CATEGORIES - FP Coordinators use FP zones
// =====================================================
router.get('/zones', requireCoordinatorScope, async (req, res) => {
  try {
    // FP Coordinators get zones from fp_zones, standalone get global zones
    if (req.isFPCoordinator) {
      const [zones] = await pool.query(
        'SELECT * FROM fp_zones WHERE franchise_partner_id = ? AND is_active = 1 ORDER BY name',
        [req.franchisePartnerId]
      );
      return res.json({ success: true, data: zones });
    }
    const [zones] = await pool.query('SELECT * FROM zones WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: zones });
  } catch (error) {
    console.error('Zones fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch zones' });
  }
});

router.get('/categories', requireCoordinatorScope, async (req, res) => {
  try {
    const categoriesConfig = require('../config/categories');
    return res.json({ success: true, data: categoriesConfig });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Get subcategories by category ID
router.get('/categories/:categoryId/subcategories', requireCoordinatorScope, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const [subcategories] = await pool.query(
      'SELECT * FROM subcategories WHERE category_id = ? AND (is_active = TRUE OR is_active = 1) ORDER BY sort_order, name',
      [categoryId]
    );
    res.json({ success: true, data: subcategories });
  } catch (error) {
    console.error('Subcategories fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subcategories' });
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
