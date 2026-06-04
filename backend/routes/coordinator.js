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
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    
    console.log('[Coordinator Dashboard] scopeId:', scopeId, 'scopeColumn:', scopeColumn, 'fpId:', franchisePartnerId);

    // Get counts - use franchise_partner_id for all tables
    const [propertiesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );
    
    // Count onboarded_properties separately (no franchise_partner_id column)
    const [onboardedPropsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM onboarded_properties`
    );

    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM onboarded_vendors WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND status IN ('pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [franchisePartnerId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND status IN ('completed', 'closed')`,
      [franchisePartnerId]
    );

    const [estimatesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM estimates WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    // Get recent work orders
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       WHERE wo.franchise_partner_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [franchisePartnerId]
    );

    res.json({
      success: true,
      data: {
        stats: {
          properties: (propertiesCount[0]?.count || 0) + (onboardedPropsCount[0]?.count || 0),
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
                  op.zone as zone_name, op.area_name as area, op.division, op.total_units as units,
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
                  op.zone as zone_name, op.area_name as area, op.division, op.total_units as units,
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
        LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
        LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate,
            propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone } = req.body;

    const workOrderId = `WO-COORD-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, coordinator_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, coordinatorId, franchisePartnerId]
    );

    // Send email notification for new work order
    const { sendWorkOrderCreatedNotification } = require('../services/emailService');
    sendWorkOrderCreatedNotification({
      orderId: result.insertId,
      orderNumber: workOrderId,
      title,
      propertyName,
      propertyId,
      customerName,
      customerEmail,
      customerPhone,
      categoryName,
      subcategoryName,
      priority,
      description,
      createdBy: req.user?.username || req.user?.email || 'Coordinator',
      createdByRole: 'Coordinator',
      createdFromPortal: 'Coordinator Portal'
    }).catch(err => console.error('Email notification error:', err));

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

    // Send completion email if status is completed
    if (status === 'completed') {
      const [workOrder] = await pool.query(
        `SELECT work_order_id, title, property_name, property_id, customer_name, customer_email, customer_phone, category_name, subcategory_name 
         FROM work_orders WHERE id = ?`, [id]
      );
      if (workOrder.length > 0) {
        const { sendWorkOrderCompletedNotification } = require('../services/emailService');
        sendWorkOrderCompletedNotification({
          orderId: id,
          orderNumber: workOrder[0].work_order_id,
          title: workOrder[0].title,
          propertyName: workOrder[0].property_name,
          propertyId: workOrder[0].property_id,
          customerName: workOrder[0].customer_name,
          customerEmail: workOrder[0].customer_email,
          customerPhone: workOrder[0].customer_phone,
          categoryName: workOrder[0].category_name,
          subcategoryName: workOrder[0].subcategory_name,
          completedBy: req.user?.username || req.user?.email || 'Coordinator',
          completedByRole: 'Coordinator'
        }).catch(err => console.error('Completion email error:', err));
      }
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
// VENDORS (ZONE-CENTRIC - employees see data from their assigned zones)
// =====================================================
router.get('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const employeeId = req.user?.id || req.coordinatorId;
    
    // Get employee's assigned zones
    let assignedZones = [];
    try {
      const [zones] = await pool.query(
        `SELECT zone_name FROM fp_employee_zones WHERE fp_employee_id = ?`,
        [employeeId]
      );
      assignedZones = zones.map(z => z.zone_name);
    } catch (e) {
      console.log('Zone fetch error:', e.message);
    }

    // Fetch vendors filtered by assigned zones (or all if no zones assigned)
    let query = `SELECT ov.id, ov.vendor_id, ov.service_type, ov.service_verified,
              ov.zone, ov.zone as zone_name, ov.area_name, ov.area_name as area, ov.division,
              ov.owner_name, ov.owner_name as company_name, ov.owner_name as contact_person,
              ov.owner_mobile, ov.owner_mobile as phone, ov.owner_email, ov.owner_email as email,
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
       WHERE ov.franchise_partner_id = ?`;
    
    let params = [req.franchisePartnerId];
    
    // Filter by assigned zones - if zones assigned, filter by them; if none assigned (all access), show all
    if (assignedZones.length > 0) {
      query += ` AND ov.zone IN (${assignedZones.map(() => '?').join(',')})`;
      params.push(...assignedZones);
    }
    // If no zones assigned, employee has access to all zones (all FP data)
    
    query += ` ORDER BY ov.created_at DESC`;
    
    const [vendors] = await pool.query(query, params);

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
    const franchisePartnerId = req.franchisePartnerId;
    
    if (!franchisePartnerId) {
      return res.json({ success: true, data: { propertyAssignments: [], serviceAssignments: [] } });
    }
    
    console.log('Coordinator Vendor Assignments Query - FP:', franchisePartnerId);
    
    // Get property-vendor assignments with full vendor details
    // Join with both properties and onboarded_properties
    const [propertyAssignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        COALESCE(p.name, op.community_name) as property_name, 
        COALESCE(p.property_id, op.property_id) as propertyId, 
        COALESCE(p.property_type, op.property_type) as property_type, 
        COALESCE(p.address, op.address) as address, 
        COALESCE(p.city, op.city) as city,
        v.owner_name as vendor_name, v.vendor_id as vendor_code, v.service_type,
        v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
        v.zone as zone_name, v.area_name as area, v.rate_per_visit, v.coverage_per_day,
        v.owner_aadhar, v.manager_name, v.manager_mobile, v.manager_email,
        v.poc_name, v.poc_mobile, v.poc_email
       FROM property_vendor_assignments pva
       LEFT JOIN properties p ON pva.property_id = p.id
       LEFT JOIN onboarded_properties op ON pva.property_id = op.id
       JOIN onboarded_vendors v ON pva.vendor_id = v.id
       WHERE (p.franchise_partner_id = ? OR op.franchise_partner_id = ?) AND pva.is_active = TRUE
       ORDER BY pva.assigned_at DESC`,
      [franchisePartnerId, franchisePartnerId]
    );

    console.log('Coordinator Vendor assignments found:', propertyAssignments.length);

    // Convert to service assignments format for frontend
    const serviceAssignments = propertyAssignments.map(a => ({
      id: a.id,
      propertyId: a.propertyId || a.property_id,
      propertyName: a.property_name,
      propertyType: a.property_type,
      propertyZone: a.zone_name || '',
      city: a.city || '',
      address: a.address || '',
      vendorId: a.vendor_code,
      vendorName: a.vendor_name,
      vendorPhone: a.vendor_phone,
      vendorEmail: a.vendor_email,
      owner_aadhar: a.owner_aadhar,
      serviceType: a.service_type,
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
      assignedDate: a.assigned_at,
      status: a.is_active ? 'active' : 'removed'
    }));

    res.json({
      success: true,
      data: {
        propertyAssignments: [],
        serviceAssignments
      }
    });
  } catch (error) {
    console.error('Coordinator Vendor assignments fetch error:', error.message);
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
      serviceType, serviceVerified, zone, areaName, division,
      ownerName, ownerMobile, ownerEmail, ownerAadhar, ownerCountryCode,
      managerName, managerMobile, managerEmail, managerCountryCode,
      pocName, pocMobile, pocEmail, pocCountryCode,
      ratePerVisit, coveragePerDay,
      gstNumber, panNumber, licenseNumber
    } = req.body;

    const vendorId = `COORD-${serviceType?.substring(0, 3).toUpperCase() || 'VND'}-${Date.now()}`;

    // Get employee ID for proper creator tracking
    const employeeId = req.user?.id || coordinatorId;
    const employeeUsername = req.user?.username || '';
    // Generate username from email
    const username = ownerEmail ? ownerEmail.split('@')[0] + '_' + Date.now() : `vendor_${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO onboarded_vendors (
        vendor_id, username, service_type, service_verified, zone, area_name, division,
        owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
        manager_name, manager_mobile, manager_email, manager_country_code,
        poc_name, poc_mobile, poc_email, poc_country_code,
        gst_number, pan_number, license_number,
        rate_per_visit, coverage_per_day, rating, total_jobs_completed,
        franchise_partner_id, coordinator_id, created_by, created_by_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'active')`,
      [
        vendorId, username, serviceType || '', serviceVerified ? 1 : 0, zone || '', areaName || '', division || '',
        ownerName || '', ownerMobile || '', ownerEmail || '', ownerAadhar || '', ownerCountryCode || '+91',
        managerName || '', managerMobile || '', managerEmail || '', managerCountryCode || '+91',
        pocName || '', pocMobile || '', pocEmail || '', pocCountryCode || '+91',
        gstNumber || '', panNumber || '', licenseNumber || '',
        parseFloat(ratePerVisit) || 0, parseInt(coveragePerDay) || 0,
        franchisePartnerId, coordinatorId,
        employeeUsername, employeeId
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
router.put('/vendors/:id', requireCoordinatorScope, validateOwnership('onboarded_vendors', 'id', true), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Modify vendor not allowed for this role' });
});

// Delete vendor - DISABLED for Coordinator role
router.delete('/vendors/:id', requireCoordinatorScope, validateOwnership('onboarded_vendors', 'id', true), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete vendor not allowed for this role' });
});

// =====================================================
// EMPLOYEES - Read-only access for work order assignment
// =====================================================
router.get('/employees', requireCoordinatorScope, async (req, res) => {
  try {
    const fpId = req.franchisePartnerId || req.fpId;
    
    console.log('[Coordinator Employees] fpId:', fpId, 'isFPCoordinator:', req.isFPCoordinator, 'coordinatorId:', req.coordinatorId);
    
    // FP Coordinators get FP employees
    if (fpId) {
      const [employees] = await pool.query(
        `SELECT id, first_name, last_name, email, role, is_active 
         FROM fp_employees 
         WHERE franchise_partner_id = ? AND is_active = 1
         ORDER BY first_name, last_name`,
        [fpId]
      );
      console.log('[Coordinator Employees] Found:', employees.length, 'employees');
      return res.json({ success: true, data: employees });
    }
    
    // For standalone coordinators, return coordinator employees
    const [employees] = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_active 
       FROM coordinator_employees 
       WHERE coordinator_id = ? AND is_active = 1
       ORDER BY first_name, last_name`,
      [req.coordinatorId]
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
// ESTIMATES - Coordinator sees FP estimates from fp_estimates table
// =====================================================
router.get('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    
    let estimates = [];
    
    // If coordinator is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      const [fpEstimates] = await pool.query(
        `SELECT e.*, 
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                  e.created_by_name
                ) as created_by_name
         FROM fp_estimates e
         LEFT JOIN fp_employees fpe ON e.created_by_name = fpe.email OR e.created_by_name = fpe.username
         LEFT JOIN users u ON e.created_by_name = u.email
         WHERE e.franchise_partner_id = ? AND ${isArchived ? 'e.is_archived = 1' : '(e.is_archived = 0 OR e.is_archived IS NULL)'}
         ORDER BY e.created_at DESC`,
        [franchisePartnerId]
      );
      
      // Enrich estimates with property_code and parse addons
      estimates = await Promise.all(fpEstimates.map(async (est) => {
        // Parse addons JSON
        let addons = [];
        if (est.addons_data) {
          try { addons = JSON.parse(est.addons_data); } catch(e) {}
        }
        
        // Get original property_code from onboarded_properties or properties table
        let property_code = est.property_code;
        const propId = est.property_id;
        const propName = est.property_name || '';
        
        // Always try to fetch the original property_id from the property tables
        if (propId || propName) {
          try {
            // Try onboarded_properties first (admin-created properties visible to FP)
            let [props] = await pool.query(
              `SELECT property_id as orig_code FROM onboarded_properties 
               WHERE (id = ? OR community_name = ?) LIMIT 1`,
              [propId || 0, propName]
            );
            if (props.length > 0 && props[0].orig_code) {
              property_code = props[0].orig_code;
            } else {
              // Try properties table (FP-created properties)
              [props] = await pool.query(
                `SELECT property_id as orig_code FROM properties 
                 WHERE (id = ? OR name = ?) AND franchise_partner_id = ? LIMIT 1`,
                [propId || 0, propName, franchisePartnerId]
              );
              if (props.length > 0 && props[0].orig_code) property_code = props[0].orig_code;
            }
          } catch (e) { console.log('Property lookup error:', e.message); }
        }
        
        return { ...est, addons, property_code, created_by_name: est.created_by_name || 'Franchise Partner' };
      }));
      
      console.log(`Coordinator ${coordinatorId} (FP: ${franchisePartnerId}) - Found ${estimates.length} FP estimates`);
    }
    
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

// Archive estimate
router.put('/estimates/:id/archive', requireCoordinatorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    if (franchisePartnerId) {
      await pool.query(
        `UPDATE fp_estimates SET is_archived = 1, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
        [req.params.id, franchisePartnerId]
      );
    }
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore estimate
router.put('/estimates/:id/restore', requireCoordinatorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    if (franchisePartnerId) {
      await pool.query(
        `UPDATE fp_estimates SET is_archived = 0, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
        [req.params.id, franchisePartnerId]
      );
    }
    res.json({ success: true, message: 'Estimate restored' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete estimate permanently
router.delete('/estimates/:id', requireCoordinatorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    if (franchisePartnerId) {
      await pool.query(
        `DELETE FROM fp_estimates WHERE id = ? AND franchise_partner_id = ?`,
        [req.params.id, franchisePartnerId]
      );
    }
    res.json({ success: true, message: 'Estimate deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? ORDER BY created_at DESC`,
      [scopeId]
    );

    res.json({ success: true, data: packages });
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
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? ORDER BY created_at DESC`,
      [scopeId]
    );

    res.json({ success: true, data: addons });
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
    // Get FP ID from multiple sources
    let fpId = req.franchisePartnerId || req.fpId || req.user?.franchisePartnerId || req.user?.fpId;
    
    // If still no fpId, try to get it from fp_employees table using coordinator's user id
    if (!fpId && req.user?.id) {
      const [fpEmp] = await pool.execute(
        'SELECT franchise_partner_id FROM fp_employees WHERE id = ? OR user_id = ?',
        [req.user.id, req.user.id]
      );
      if (fpEmp.length > 0) {
        fpId = fpEmp[0].franchise_partner_id;
      }
    }
    
    console.log('FP Employee Zones - fpId:', fpId, 'userId:', req.user?.id);
    
    if (!fpId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP employees' });
    }
    
    // Use fpId for queries
    req.franchisePartnerId = fpId;
    
    // Debug: Check how many employees exist for this FP
    const [countCheck] = await pool.execute(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM fp_employees WHERE franchise_partner_id = ?',
      [fpId]
    );
    console.log('[Coordinator fp-employee-zones] FP:', fpId, 'Total employees:', countCheck[0]?.total, 'Active:', countCheck[0]?.active);

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
    
    console.log('[Coordinator fp-employee-zones] Found employees:', employees.length);

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
