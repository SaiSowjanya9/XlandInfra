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
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
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
// PROPERTIES - Coordinator sees their own + linked FP properties
// =====================================================
router.get('/properties', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const isFPCoordinator = !!franchisePartnerId;

    console.log(`Coordinator properties fetch - coordinatorId: ${coordinatorId}, franchisePartnerId: ${franchisePartnerId}, isFPCoordinator: ${isFPCoordinator}`);

    // For FP Coordinators: primarily filter by franchise_partner_id
    // For standalone Coordinators: filter by coordinator_id
    let propQuery, propParams;
    
    if (isFPCoordinator) {
      // FP Coordinators see: ALL properties from their FP (created by any employee)
      propQuery = `SELECT p.*, 
          COALESCE(z.name, zn.name, p.zone_id) as zone_name,
          COALESCE(p.area_name, p.city) as area,
          COALESCE(p.division_id, p.division, 'General') as division,
          1 as units,
          COALESCE(p.status, 'active') as status,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            p.created_by, 'System'
          ) as created_by_name,
          'properties' as source_table
         FROM properties p
         LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
         LEFT JOIN zones zn ON p.zone_id = zn.name
         LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username
         LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR CAST(p.created_by AS UNSIGNED) = u.id
         WHERE p.franchise_partner_id = ?
         ORDER BY p.created_at DESC`;
      propParams = [franchisePartnerId];
    } else {
      // Standalone coordinator - check coordinator_id OR created_by matches
      propQuery = `SELECT p.*, 
          COALESCE(z.name, zn.name, p.zone_id) as zone_name,
          COALESCE(p.area_name, p.city) as area,
          COALESCE(p.division_id, p.division, 'General') as division,
          1 as units,
          COALESCE(p.status, 'active') as status,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            p.created_by, 'System'
          ) as created_by_name,
          'properties' as source_table
         FROM properties p
         LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
         LEFT JOIN zones zn ON p.zone_id = zn.name
         LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username
         LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR CAST(p.created_by AS UNSIGNED) = u.id
         WHERE (p.coordinator_id = ? OR p.created_by = ? OR p.created_by = ?)
         ORDER BY p.created_at DESC`;
      propParams = [coordinatorId, coordinatorId, req.user?.username || req.user?.email || ''];
    }
    
    const [regularProperties] = await pool.query(propQuery, propParams);
    console.log(`Found ${regularProperties.length} properties from properties table`);

    // Also fetch from onboarded_properties
    let onboardedProperties = [];
    try {
      let onbQuery, onbParams;
      if (isFPCoordinator) {
        // FP Coordinators see: ALL onboarded properties from their FP
        onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type,
                  op.zone_id as zone_name, op.division, op.total_units as units,
                  op.address, op.city, op.state, op.pincode as zip_code,
                  op.contact_person, op.contact_phone, op.contact_email as email,
                  COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                  op.created_at, op.status,
                  'onboarded_properties' as source_table
           FROM onboarded_properties op
           LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR CAST(op.created_by AS UNSIGNED) = u.id
           WHERE op.franchise_partner_id = ?
           ORDER BY op.created_at DESC`;
        onbParams = [franchisePartnerId];
      } else {
        onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type,
                  op.zone_id as zone_name, op.division, op.total_units as units,
                  op.address, op.city, op.state, op.pincode as zip_code,
                  op.contact_person, op.contact_phone, op.contact_email as email,
                  COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                  op.created_at, op.status,
                  'onboarded_properties' as source_table
           FROM onboarded_properties op
           LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR CAST(op.created_by AS UNSIGNED) = u.id
           WHERE (op.coordinator_id = ? OR op.created_by = ? OR op.created_by = ?)
           ORDER BY op.created_at DESC`;
        onbParams = [coordinatorId, coordinatorId, req.user?.username || req.user?.email || ''];
      }
      const [rows] = await pool.execute(onbQuery, onbParams);
      onboardedProperties = rows;
      console.log(`Found ${onboardedProperties.length} properties from onboarded_properties table`);
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    const allProperties = [...regularProperties, ...onboardedProperties];
    console.log(`Total properties returned: ${allProperties.length}`);

    res.json({ success: true, data: allProperties });
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

    const [result] = await pool.query(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, coordinator_id, franchise_partner_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, coordinatorId, franchisePartnerId, creatorName]
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
// WORK ORDERS - Coordinator sees their own + linked FP work orders
// =====================================================
router.get('/work-orders', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const isFPCoordinator = !!franchisePartnerId;
    const { status } = req.query;
    const creatorEmail = req.user?.username || req.user?.email || '';

    // FP Coordinators: see all work orders from their FP
    // Standalone Coordinators: see work orders they created
    let query, params;
    
    if (isFPCoordinator) {
      query = `
        SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            wo.created_by, 'System'
          ) as created_by_name
        FROM work_orders wo
        LEFT JOIN properties p ON wo.property_id = p.id
        LEFT JOIN categories c ON wo.category_id = c.id
        LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
        LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username
        LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
        WHERE wo.franchise_partner_id = ?
      `;
      params = [franchisePartnerId];
    } else {
      query = `
        SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            wo.created_by, 'System'
          ) as created_by_name
        FROM work_orders wo
        LEFT JOIN properties p ON wo.property_id = p.id
        LEFT JOIN categories c ON wo.category_id = c.id
        LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
        LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username
        LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
        WHERE (wo.coordinator_id = ? OR wo.created_by = ? OR wo.created_by = ?)
      `;
      params = [coordinatorId, coordinatorId, creatorEmail];
    }

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
    const franchisePartnerId = req.franchisePartnerId;
    const isFPCoordinator = !!franchisePartnerId;
    const creatorEmail = req.user?.username || req.user?.email || '';

    let query, params;
    
    if (isFPCoordinator) {
      query = `SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE wo.franchise_partner_id = ?
           AND wo.status IN ('pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress')
         ORDER BY wo.created_at DESC`;
      params = [franchisePartnerId];
    } else {
      query = `SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE (wo.coordinator_id = ? OR wo.created_by = ? OR wo.created_by = ?)
           AND wo.status IN ('pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress')
         ORDER BY wo.created_at DESC`;
      params = [coordinatorId, coordinatorId, creatorEmail];
    }

    const [workOrders] = await pool.query(query, params);

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Pending work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending work orders' });
  }
});

router.get('/work-orders/completed', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const isFPCoordinator = !!franchisePartnerId;
    const creatorEmail = req.user?.username || req.user?.email || '';

    let query, params;
    
    if (isFPCoordinator) {
      query = `SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE wo.franchise_partner_id = ?
           AND wo.status IN ('completed', 'closed')
         ORDER BY wo.created_at DESC`;
      params = [franchisePartnerId];
    } else {
      query = `SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE (wo.coordinator_id = ? OR wo.created_by = ? OR wo.created_by = ?)
           AND wo.status IN ('completed', 'closed')
         ORDER BY wo.created_at DESC`;
      params = [coordinatorId, coordinatorId, creatorEmail];
    }

    const [workOrders] = await pool.query(query, params);

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
// CUSTOMERS - Coordinator sees their own + linked FP customers
// =====================================================
router.get('/customers', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;

    const query = `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.coordinator_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [coordinatorId, franchisePartnerId] : [coordinatorId];

    const [customers] = await pool.query(query, params);

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
    // Fetch from onboarded_vendors table with proper field mapping
    const [vendors] = await pool.query(
      `SELECT ov.id, ov.vendor_id, ov.service_type, ov.service_verified,
              ov.zone as zone_name, ov.area_name as area, ov.division,
              ov.owner_name as company_name, ov.owner_name as contact_person,
              ov.owner_mobile as phone, ov.owner_email as email,
              ov.owner_aadhar, ov.owner_country_code,
              ov.manager_name, ov.manager_mobile, ov.manager_email, ov.manager_country_code,
              ov.poc_name, ov.poc_mobile, ov.poc_email, ov.poc_country_code,
              ov.rate_per_visit, ov.coverage_per_day,
              ov.created_by, ov.created_by_id,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                ov.created_by, 'System'
              ) as created_by_name,
              ov.status,
              ov.created_at, ov.updated_at,
              CASE WHEN ov.status = 'active' THEN 1 ELSE 0 END as is_active,
              'own' as vendor_type
       FROM onboarded_vendors ov
       LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id OR ov.created_by = fpe.email OR ov.created_by = fpe.username
       WHERE ov.franchise_partner_id = ?
       ORDER BY ov.created_at DESC`,
      [req.franchisePartnerId]
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

// Get vendor assignments (view-only for coordinators)
router.get('/vendors/assignments', requireCoordinatorScope, async (req, res) => {
  try {
    const { status } = req.query;
    
    // Fetch vendor assignments - all service vendor assignments
    const [assignments] = await pool.query(
      `SELECT va.id, va.vendor_id, va.property_id, va.service_type, va.zone,
              va.status, va.created_at, va.updated_at,
              ov.owner_name as vendor_name, ov.owner_mobile as vendor_phone,
              ov.owner_email as vendor_email, ov.rate_per_visit, ov.coverage_per_day,
              p.name as property_name, p.property_id as property_code
       FROM vendor_assignments va
       LEFT JOIN onboarded_vendors ov ON va.vendor_id = ov.id
       LEFT JOIN properties p ON va.property_id = p.id
       WHERE va.status = ?
       ORDER BY va.created_at DESC`,
      [status || 'active']
    );

    // Also get service-based assignments
    const [serviceAssignments] = await pool.query(
      `SELECT sva.id, sva.vendor_id, sva.service_type, sva.zone_id, sva.zone_name,
              sva.status, sva.created_at,
              ov.owner_name as vendor_name, ov.owner_mobile as vendor_phone,
              ov.owner_email as vendor_email, ov.rate_per_visit, ov.coverage_per_day
       FROM service_vendor_assignments sva
       LEFT JOIN onboarded_vendors ov ON sva.vendor_id = ov.id
       WHERE sva.status = ?
       ORDER BY sva.created_at DESC`,
      [status || 'active']
    );

    res.json({
      success: true,
      data: {
        propertyAssignments: assignments,
        serviceAssignments: serviceAssignments
      }
    });
  } catch (error) {
    console.error('Vendor assignments fetch error:', error);
    // Return empty arrays if tables don't exist
    res.json({
      success: true,
      data: {
        propertyAssignments: [],
        serviceAssignments: []
      }
    });
  }
});

router.post('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const {
      serviceType, serviceVerified, zone, areaName,
      ownerName, ownerMobile, ownerEmail, ownerAadhar, ownerCountryCode,
      managerName, managerMobile, managerEmail, managerCountryCode,
      pocName, pocMobile, pocEmail, pocCountryCode,
      ratePerVisit, coveragePerDay, createdBy
    } = req.body;

    const vendorId = `COORD-${serviceType?.substring(0, 3).toUpperCase() || 'VND'}-${Date.now()}`;

    // Get employee ID for proper creator tracking
    const employeeId = req.user?.id || coordinatorId;
    const employeeEmail = req.user?.email || req.user?.username || '';

    const [result] = await pool.query(
      `INSERT INTO onboarded_vendors (
        vendor_id, service_type, service_verified, zone, area_name,
        owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
        manager_name, manager_mobile, manager_email, manager_country_code,
        poc_name, poc_mobile, poc_email, poc_country_code,
        rate_per_visit, coverage_per_day, franchise_partner_id, coordinator_id, created_by, created_by_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        vendorId, serviceType || '', serviceVerified ? 1 : 0, zone || '', areaName || '',
        ownerName || '', ownerMobile || '', ownerEmail || '', ownerAadhar || '', ownerCountryCode || '+91',
        managerName || '', managerMobile || '', managerEmail || '', managerCountryCode || '+91',
        pocName || '', pocMobile || '', pocEmail || '', pocCountryCode || '+91',
        parseFloat(ratePerVisit) || 0, parseInt(coveragePerDay) || 0,
        franchisePartnerId, coordinatorId,
        employeeEmail, employeeId
      ]
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
// ESTIMATES - Coordinator sees their own + linked FP estimates
// =====================================================
router.get('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { archived } = req.query;

    let query = `
      SELECT e.*, c.name as client_name, p.name as property_name
      FROM estimates e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE (e.coordinator_id = ?${franchisePartnerId ? ' OR e.franchise_partner_id = ?' : ''})
    `;
    const params = franchisePartnerId ? [coordinatorId, franchisePartnerId] : [coordinatorId];

    if (archived === 'true') {
      query += ` AND e.status = 'archived'`;
    } else {
      query += ` AND e.status != 'archived'`;
    }

    query += ' ORDER BY e.created_at DESC';

    const [estimates] = await pool.query(query, params);
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
    // Get global zones
    const [globalZones] = await pool.query('SELECT id, name FROM zones WHERE is_active = TRUE');
    
    // Get zones from properties (FP-scoped or coordinator-scoped)
    const scopeColumn = req.franchisePartnerId ? 'franchise_partner_id' : 'coordinator_id';
    const scopeId = req.franchisePartnerId || req.coordinatorId;
    const [propertyZones] = await pool.query(
      `SELECT DISTINCT zone_id as name FROM properties 
       WHERE ${scopeColumn} = ? AND zone_id IS NOT NULL AND zone_id != ''`,
      [scopeId]
    );

    // Get FP zones (from FP or coordinator-created)
    let fpZones = [];
    try {
      const [fz] = await pool.query(
        `SELECT id, name FROM fp_zones WHERE 
         franchise_partner_id = ? AND is_active = 1`,
        [req.franchisePartnerId || 0]
      );
      fpZones = fz;
    } catch (_) {}

    // Combine and deduplicate
    const allZoneNames = new Set();
    const combinedZones = [];

    globalZones.forEach(z => {
      if (!allZoneNames.has(z.name)) {
        allZoneNames.add(z.name);
        combinedZones.push({ id: z.id, name: z.name });
      }
    });

    fpZones.forEach(z => {
      if (!allZoneNames.has(z.name)) {
        allZoneNames.add(z.name);
        combinedZones.push({ id: z.id, name: z.name });
      }
    });

    propertyZones.forEach(z => {
      if (z.name && !allZoneNames.has(z.name)) {
        allZoneNames.add(z.name);
        combinedZones.push({ id: `custom-${z.name}`, name: z.name });
      }
    });

    combinedZones.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, data: combinedZones });
  } catch (error) {
    console.error('Zones fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch zones' });
  }
});

// Create zone
router.post('/zones', requireCoordinatorScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    const franchisePartnerId = req.franchisePartnerId || null;
    const coordinatorId = req.coordinatorId;
    
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND (franchise_partner_id = ? OR coordinator_id = ?)',
      [name, franchisePartnerId, coordinatorId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, created_by, is_active) VALUES (?, ?, ?, 1)',
      [name, franchisePartnerId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone
router.delete('/zones/:id', requireCoordinatorScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?',
      [id, req.franchisePartnerId || 0]
    );
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       WHERE wo.coordinator_id = ?`,
      [coordinatorId]
    );

    res.json({ success: true, data: workOrders, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// View FP employee zone assignments (READ-ONLY for coordinators under FP)
router.get('/fp-employee-zones', requireCoordinatorScope, async (req, res) => {
  try {
    console.log('FP Employee Zones - Request user:', req.user);
    console.log('FP Employee Zones - franchisePartnerId:', req.franchisePartnerId);
    console.log('FP Employee Zones - isFPCoordinator:', req.isFPCoordinator);
    
    if (!req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP employees' });
    }

    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active,
              GROUP_CONCAT(DISTINCT ez.zone_name ORDER BY ez.zone_name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      [req.franchisePartnerId, req.franchisePartnerId]
    );

    const [zones] = await pool.execute(
      `SELECT DISTINCT ez.zone_name as name FROM fp_employee_zones ez 
       WHERE ez.franchise_partner_id = ? ORDER BY ez.zone_name`,
      [req.franchisePartnerId]
    );

    res.json({ 
      success: true, 
      data: {
        employees: employees.map(emp => ({
          ...emp,
          zone_ids: emp.zone_ids ? emp.zone_ids.split(',').map(Number) : [],
          zone_names: emp.zone_names || 'No zones assigned'
        })),
        zones
      }
    });
  } catch (error) {
    console.error('Get FP employee zones error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
