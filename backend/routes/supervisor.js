/**
 * Supervisor Portal API Routes
 * All routes are scoped to the logged-in supervisor's data
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const {
  attachSupervisorScope,
  requireSupervisorScope,
  validateOwnership,
  buildScopedQuery,
  getSupervisorPermissions,
  canViewPricing,
  filterPricing
} = require('../middleware/supervisorScope');

// =====================================================
// SUPERVISOR LOGIN (No auth required)
// Handles both standalone supervisors and FP-created supervisors
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

    let user = null;
    let userSource = null;
    let franchisePartnerId = null;

    // First, try to find in users table (standalone supervisors)
    const [users] = await pool.query(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active, franchise_partner_id
       FROM users 
       WHERE (username = ? OR email = ?) AND role = 'supervisor'`,
      [username, username]
    );

    if (users.length > 0) {
      user = users[0];
      userSource = 'users';
      franchisePartnerId = user.franchise_partner_id;
    }

    // If not found, try fp_employees table (FP-created supervisors)
    if (!user) {
      const [fpSupervisors] = await pool.query(
        `SELECT fe.*, fe.id as employee_id
         FROM fp_employees fe
         WHERE (fe.username = ? OR fe.email = ?) AND fe.role = 'supervisor'`,
        [username, username]
      );

      if (fpSupervisors.length > 0) {
        const fpSup = fpSupervisors[0];
        
        // Check for linked user record
        if (fpSup.user_id) {
          const [linkedUsers] = await pool.query(
            `SELECT * FROM users WHERE id = ?`,
            [fpSup.user_id]
          );
          if (linkedUsers.length > 0) {
            user = linkedUsers[0];
            userSource = 'fp_employees_linked';
            franchisePartnerId = fpSup.franchise_partner_id;
          }
        }

        // If no linked user but fp_employee has password_hash
        if (!user && fpSup.password_hash) {
          user = {
            id: fpSup.user_id || fpSup.id,
            username: fpSup.username,
            email: fpSup.email,
            password_hash: fpSup.password_hash,
            first_name: fpSup.first_name,
            last_name: fpSup.last_name,
            role: 'supervisor',
            is_active: fpSup.is_active
          };
          userSource = 'fp_employees_direct';
          franchisePartnerId = fpSup.franchise_partner_id;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact your administrator to activate your account.'
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
        supervisorId: user.id,
        franchisePartnerId: franchisePartnerId || null
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
          supervisorId: user.id,
          franchisePartnerId: franchisePartnerId || null,
          portal: 'supervisor'
        }
      }
    });
  } catch (error) {
    console.error('Supervisor login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachSupervisorScope);

// =====================================================
// DASHBOARD
// =====================================================
router.get('/dashboard', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    // Get counts for supervisor's data
    const [propertiesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE supervisor_id = ?
       UNION ALL
       SELECT COUNT(*) FROM supervisor_assigned_properties WHERE supervisor_id = ?`,
      [supervisorId, supervisorId]
    );

    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM vendors WHERE supervisor_id = ?
       UNION ALL
       SELECT COUNT(*) FROM supervisor_assigned_vendors WHERE supervisor_id = ?`,
      [supervisorId, supervisorId]
    );

    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM supervisor_employees WHERE supervisor_id = ?`,
      [supervisorId]
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
      `SELECT COUNT(*) as count FROM estimates WHERE supervisor_id = ?`,
      [supervisorId]
    );

    // Get recent work orders
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       WHERE wo.supervisor_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [supervisorId]
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
router.get('/properties', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    
    // Get FP ID from multiple sources
    let franchisePartnerId = req.franchisePartnerId || req.fpId || req.user?.franchisePartnerId || req.user?.fpId;
    
    // If still no fpId, try to get it from fp_employees table
    if (!franchisePartnerId && req.user?.id) {
      try {
        const [fpEmp] = await pool.execute(
          'SELECT franchise_partner_id FROM fp_employees WHERE id = ? OR user_id = ?',
          [req.user.id, req.user.id]
        );
        if (fpEmp.length > 0) {
          franchisePartnerId = fpEmp[0].franchise_partner_id;
        }
      } catch (e) { /* ignore */ }
    }
    
    console.log('[Supervisor Properties] supervisorId:', supervisorId, 'franchisePartnerId:', franchisePartnerId);

    // Get own, assigned, and FP properties with creator name
    const query = `SELECT p.*, z.name as zone_name, 
              COALESCE(p.area_name, p.city) as area,
              COALESCE(p.division_id, p.division, 'General') as division,
              COALESCE(p.number_of_units, 1) as units,
              COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
              'own' as access_type, TRUE as can_modify, TRUE as can_delete,
              TRUE as can_assign_vendor, TRUE as can_assign_employee,
              'properties' as source_table
       FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR p.created_by = u.id
       WHERE (p.supervisor_id = ?${franchisePartnerId ? ' OR p.franchise_partner_id = ?' : ''})
       UNION
       SELECT p.*, z.name as zone_name,
              COALESCE(p.area_name, p.city) as area,
              COALESCE(p.division_id, p.division, 'General') as division,
              COALESCE(p.number_of_units, 1) as units,
              COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
              'assigned' as access_type, sap.can_modify, sap.can_delete,
              sap.can_assign_vendor, sap.can_assign_employee,
              'properties' as source_table
       FROM properties p
       INNER JOIN supervisor_assigned_properties sap ON p.id = sap.property_id
       LEFT JOIN zones z ON p.zone_id = z.id
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR p.created_by = u.id
       WHERE sap.supervisor_id = ?
       ORDER BY created_at DESC`;
    const params = franchisePartnerId ? [supervisorId, franchisePartnerId, supervisorId] : [supervisorId, supervisorId];
    const [regularProperties] = await pool.query(query, params);

    // Also fetch from onboarded_properties with creator name
    let onboardedProperties = [];
    try {
      const scopeColumn = franchisePartnerId ? 'franchise_partner_id' : 'supervisor_id';
      const scopeId = franchisePartnerId || supervisorId;
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type as type,
                op.zone as zone_name, op.division, COALESCE(op.total_units, 1) as units,
                op.address, op.city, op.state, op.pincode as zip_code,
                op.contact_person, op.contact_phone, op.contact_email as email,
                COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                op.created_at, op.status,
                'own' as access_type, TRUE as can_modify, TRUE as can_delete,
                TRUE as can_assign_vendor, TRUE as can_assign_employee,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
         WHERE op.${scopeColumn} = ? AND op.status = 'active'
         ORDER BY op.created_at DESC`,
        [scopeId]
      );
      onboardedProperties = rows;
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    const allProperties = [...regularProperties, ...onboardedProperties];

    res.json({ success: true, data: allProperties });
  } catch (error) {
    console.error('Properties fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
});

router.post('/properties', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    const propertyId = `PROP-SUP-${Date.now()}`;
    
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
        contact_person, contact_phone, contact_email, zone_id, supervisor_id, franchise_partner_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, supervisorId, franchisePartnerId, creatorName]
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

router.put('/properties/:id', requireSupervisorScope, validateOwnership('properties', 'id', true), async (req, res) => {
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

router.delete('/properties/:id', requireSupervisorScope, validateOwnership('properties', 'id', true), async (req, res) => {
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

router.post('/properties/:id/assign-vendor', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;
    const supervisorId = req.supervisorId;

    // Verify property belongs to supervisor
    const [property] = await pool.query(
      `SELECT id FROM properties WHERE id = ? AND supervisor_id = ?
       UNION
       SELECT property_id FROM supervisor_assigned_properties WHERE property_id = ? AND supervisor_id = ? AND can_assign_vendor = TRUE`,
      [id, supervisorId, id, supervisorId]
    );

    if (property.length === 0) {
      return res.status(403).json({ success: false, message: 'Cannot assign vendor to this property' });
    }

    await pool.query(
      'UPDATE properties SET assigned_vendor_id = ? WHERE id = ?',
      [vendorId, id]
    );

    res.json({ success: true, message: 'Vendor assigned successfully' });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign vendor' });
  }
});

router.post('/properties/:id/assign-employee', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    const supervisorId = req.supervisorId;

    // Verify property belongs to supervisor
    const [property] = await pool.query(
      `SELECT id FROM properties WHERE id = ? AND supervisor_id = ?
       UNION
       SELECT property_id FROM supervisor_assigned_properties WHERE property_id = ? AND supervisor_id = ? AND can_assign_employee = TRUE`,
      [id, supervisorId, id, supervisorId]
    );

    if (property.length === 0) {
      return res.status(403).json({ success: false, message: 'Cannot assign employee to this property' });
    }

    await pool.query(
      'UPDATE properties SET assigned_employee_id = ? WHERE id = ?',
      [employeeId, id]
    );

    res.json({ success: true, message: 'Employee assigned successfully' });
  } catch (error) {
    console.error('Assign employee error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign employee' });
  }
});

// =====================================================
// WORK ORDERS
// =====================================================
router.get('/work-orders', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { status } = req.query;

    // FP employees see FP work orders, standalone supervisors see their created work orders
    let query = `
      SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
      WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'}
    `;
    const params = franchisePartnerId ? [franchisePartnerId] : [req.user?.username || req.user?.email];

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

router.get('/work-orders/pending', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;

    const query = `SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress')
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId] : [req.user?.username || req.user?.email];

    const [workOrders] = await pool.query(query, params);

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Pending work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending work orders' });
  }
});

router.get('/work-orders/completed', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;

    const query = `SELECT wo.*, p.name as property_name, c.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('completed', 'closed')
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId] : [req.user?.username || req.user?.email];

    const [workOrders] = await pool.query(query, params);

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Completed work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch completed work orders' });
  }
});

router.post('/work-orders', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate,
            propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone } = req.body;

    const workOrderId = `WO-SUP-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, supervisor_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, supervisorId, franchisePartnerId]
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
      createdBy: req.user?.username || req.user?.email || 'Supervisor',
      createdByRole: 'Supervisor',
      createdFromPortal: 'Supervisor Portal'
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

router.patch('/work-orders/:id/status', requireSupervisorScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Supervisors can change status for completed work orders and revert to pending
    const allowedStatuses = ['requested', 'under_review', 'assigned', 'in_progress', 'completed', 'cancelled', 'closed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({ success: false, message: 'Invalid status value' });
    }

    await pool.query('UPDATE work_orders SET status = ? WHERE id = ?', [status, id]);

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
          completedBy: req.user?.username || req.user?.email || 'Supervisor',
          completedByRole: 'Supervisor'
        }).catch(err => console.error('Completion email error:', err));
      }
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// =====================================================
// CUSTOMERS
// =====================================================
router.get('/customers', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;

    const query = `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.supervisor_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [supervisorId, franchisePartnerId] : [supervisorId];

    const [customers] = await pool.query(query, params);

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Customers fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
});

router.post('/customers', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    console.log('[Supervisor Customer Create] supervisorId:', supervisorId, 'franchisePartnerId:', franchisePartnerId, 'user:', req.user?.id);
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
      const propertyIdGen = `SUP-${entryType || 'GC'}-${Date.now()}`;
      const clientId = `SUP-CLT-${Date.now()}`;
      
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      const [propertyResult] = await pool.query(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          supervisor_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          supervisorId, franchisePartnerId, req.user.id, 
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
              supervisor_id, franchise_partner_id, is_activated, temp_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, contactName, contactEmail, `${contactCountryCode}${contactPhone}`,
              hashedPassword, propertyResult.insertId, supervisorId, franchisePartnerId, 0, tempPassword]
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully',
        data: { propertyId: propertyIdGen, clientId, customerId: customerResult?.insertId || null }
      });
    } else {
      const clientId = `CLT-SUP-${Date.now()}`;
      const [result] = await pool.query(
        `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
          zip_code, client_type, company_name, property_id, gst_number, supervisor_id, franchise_partner_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber, supervisorId, franchisePartnerId]
      );
      res.json({ success: true, message: 'Customer created successfully', data: { id: result.insertId, clientId } });
    }
  } catch (error) {
    console.error('Customer create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
});

// =====================================================
// VENDORS
// =====================================================
router.get('/vendors', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    // Get own vendors
    const [ownVendors] = await pool.query(
      `SELECT v.*, 'own' as vendor_type, TRUE as can_modify, TRUE as can_delete
       FROM vendors v
       WHERE v.supervisor_id = ?`,
      [supervisorId]
    );

    // Get assigned vendors
    const [assignedVendors] = await pool.query(
      `SELECT v.*, 'assigned' as vendor_type, sav.can_modify, sav.can_delete
       FROM vendors v
       INNER JOIN supervisor_assigned_vendors sav ON v.id = sav.vendor_id
       WHERE sav.supervisor_id = ? AND sav.is_active = TRUE`,
      [supervisorId]
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

router.post('/vendors', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;

    const vendorId = `VND-SUP-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO vendors (vendor_id, company_name, contact_person, email, phone, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, supervisor_id, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, supervisorId, franchisePartnerId]
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

router.put('/vendors/:id', requireSupervisorScope, validateOwnership('vendors', 'id', true), async (req, res) => {
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

router.delete('/vendors/:id', requireSupervisorScope, validateOwnership('vendors', 'id', true), async (req, res) => {
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
router.get('/employees', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    const [employees] = await pool.query(
      `SELECT se.*, GROUP_CONCAT(z.name) as zone_names
       FROM supervisor_employees se
       LEFT JOIN supervisor_employee_zones sez ON se.id = sez.supervisor_employee_id
       LEFT JOIN zones z ON sez.zone_id = z.id
       WHERE se.supervisor_id = ?
       GROUP BY se.id
       ORDER BY se.created_at DESC`,
      [supervisorId]
    );

    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

router.get('/employees/:id', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.supervisorId;

    const [employees] = await pool.query(
      `SELECT se.*, GROUP_CONCAT(z.id) as zone_ids, GROUP_CONCAT(z.name) as zone_names
       FROM supervisor_employees se
       LEFT JOIN supervisor_employee_zones sez ON se.id = sez.supervisor_employee_id
       LEFT JOIN zones z ON sez.zone_id = z.id
       WHERE se.id = ? AND se.supervisor_id = ?
       GROUP BY se.id`,
      [id, supervisorId]
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

router.post('/employees', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { firstName, lastName, email, phone, role, assignedZones } = req.body;

    const employeeCode = `EMP-SUP-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO supervisor_employees (supervisor_id, franchise_partner_id, employee_code, first_name, last_name, email, phone, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [supervisorId, franchisePartnerId, employeeCode, firstName, lastName, email, phone, role || 'sup_executive']
    );

    // Assign zones
    if (assignedZones && assignedZones.length > 0) {
      const zoneValues = assignedZones.map(zoneId => [result.insertId, zoneId]);
      await pool.query(
        'INSERT INTO supervisor_employee_zones (supervisor_employee_id, zone_id) VALUES ?',
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

router.put('/employees/:id', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.supervisorId;
    const { firstName, lastName, email, phone, role, assignedZones } = req.body;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM supervisor_employees WHERE id = ? AND supervisor_id = ?',
      [id, supervisorId]
    );

    if (existing.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query(
      `UPDATE supervisor_employees SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?
       WHERE id = ?`,
      [firstName, lastName, email, phone, role, id]
    );

    // Update zones
    if (assignedZones) {
      await pool.query('DELETE FROM supervisor_employee_zones WHERE supervisor_employee_id = ?', [id]);
      if (assignedZones.length > 0) {
        const zoneValues = assignedZones.map(zoneId => [id, zoneId]);
        await pool.query(
          'INSERT INTO supervisor_employee_zones (supervisor_employee_id, zone_id) VALUES ?',
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

router.delete('/employees/:id', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.supervisorId;

    const [result] = await pool.query(
      'DELETE FROM supervisor_employees WHERE id = ? AND supervisor_id = ?',
      [id, supervisorId]
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
// ESTIMATES - Supervisor sees FP estimates from fp_estimates table
// =====================================================
router.get('/estimates', requireSupervisorScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    
    let estimates = [];
    
    // If supervisor is linked to an FP, fetch from fp_estimates table
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
         WHERE e.franchise_partner_id = ? AND (e.is_archived = ? OR e.is_archived IS NULL OR e.is_archived = 0)
         ORDER BY e.created_at DESC`,
        [franchisePartnerId, isArchived ? 1 : 0]
      );
      
      // Enrich estimates with property_code and parse addons
      estimates = await Promise.all(fpEstimates.map(async (est) => {
        let addons = [];
        if (est.addons_data) {
          try { addons = JSON.parse(est.addons_data); } catch(e) {}
        }
        return { ...est, addons };
      }));
    }
    
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('Estimates fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
  }
});

router.post('/estimates', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { clientId, propertyId, title, description, estimateType, subtotal, taxPercentage, discountPercentage, validUntil, items } = req.body;

    const estimateId = `EST-SUP-${Date.now()}`;
    const tax = (subtotal * (taxPercentage || 0)) / 100;
    const discount = (subtotal * (discountPercentage || 0)) / 100;
    const totalAmount = subtotal + tax - discount;

    const [result] = await pool.query(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, supervisor_id, franchise_partner_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
        subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, totalAmount,
        validUntil || null, supervisorId, franchisePartnerId]
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
// AMC PACKAGES - FP Supervisors use FP packages
// =====================================================
router.get('/amc-packages', requireSupervisorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // FP Supervisors read from fp_amc_packages
    if (franchisePartnerId) {
      const [packages] = await pool.query(
        `SELECT * FROM fp_amc_packages WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
        [franchisePartnerId]
      );
      return res.json({ success: true, data: packages });
    }
    
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('AMC packages fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
  }
});

router.post('/amc-packages', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, description, durationMonths, basePrice, services, termsConditions, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO supervisor_amc_packages (supervisor_id, franchise_partner_id, name, description, duration_months, base_price, services, terms_conditions, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [supervisorId, franchisePartnerId, name, description, durationMonths || 12, basePrice || 0,
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
// ADD-ONS - FP Supervisors use FP addons
// =====================================================
router.get('/addons', requireSupervisorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // FP Supervisors read from fp_addons
    if (franchisePartnerId) {
      const [addons] = await pool.query(
        `SELECT * FROM fp_addons WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
        [franchisePartnerId]
      );
      return res.json({ success: true, data: addons });
    }
    
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Addons fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
  }
});

router.post('/addons', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, description, price, unit, categoryId, hidePricing } = req.body;

    const [result] = await pool.query(
      `INSERT INTO supervisor_addons (supervisor_id, franchise_partner_id, name, description, price, unit, category_id, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [supervisorId, franchisePartnerId, name, description, price || 0, unit || 'per_service', categoryId || null, hidePricing !== false]
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
router.get('/zones', requireSupervisorScope, async (req, res) => {
  try {
    // Get global zones
    const [globalZones] = await pool.query('SELECT id, name FROM zones WHERE is_active = TRUE');
    
    // Get zones from supervisor's properties (including FP properties)
    const scopeColumn = req.franchisePartnerId ? 'franchise_partner_id' : 'supervisor_id';
    const scopeId = req.franchisePartnerId || req.supervisorId;
    const [propertyZones] = await pool.query(
      `SELECT DISTINCT zone_id as name FROM properties 
       WHERE ${scopeColumn} = ? AND zone_id IS NOT NULL AND zone_id != ''`,
      [scopeId]
    );

    // Get FP zones (from FP or supervisor-created)
    let fpZones = [];
    try {
      const [fz] = await pool.query(
        `SELECT id, name FROM fp_zones WHERE 
         (franchise_partner_id = ? OR supervisor_id = ?) AND is_active = 1`,
        [req.franchisePartnerId || 0, req.supervisorId]
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
router.post('/zones', requireSupervisorScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    const franchisePartnerId = req.franchisePartnerId || null;
    const supervisorId = req.supervisorId;
    
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND (franchise_partner_id = ? OR supervisor_id = ?)',
      [name, franchisePartnerId, supervisorId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, supervisor_id, created_by, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, franchisePartnerId, supervisorId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone
router.delete('/zones/:id', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND (franchise_partner_id = ? OR supervisor_id = ?)',
      [id, req.franchisePartnerId || 0, req.supervisorId]
    );
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', requireSupervisorScope, async (req, res) => {
  try {
    const categoriesConfig = require('../config/categories');
    return res.json({ success: true, data: categoriesConfig });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// =====================================================
// EXPORTS
// =====================================================
router.get('/export/properties', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    const [properties] = await pool.query(
      `SELECT p.*, z.name as zone_name FROM properties p
       LEFT JOIN zones z ON p.zone_id = z.id
       WHERE p.supervisor_id = ?`,
      [supervisorId]
    );

    res.json({ success: true, data: properties, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

router.get('/export/vendors', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    const [vendors] = await pool.query(
      `SELECT * FROM vendors WHERE supervisor_id = ?`,
      [supervisorId]
    );

    res.json({ success: true, data: vendors, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

router.get('/export/employees', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    const [employees] = await pool.query(
      `SELECT se.*, GROUP_CONCAT(z.name) as zone_names
       FROM supervisor_employees se
       LEFT JOIN supervisor_employee_zones sez ON se.id = sez.supervisor_employee_id
       LEFT JOIN zones z ON sez.zone_id = z.id
       WHERE se.supervisor_id = ?
       GROUP BY se.id`,
      [supervisorId]
    );

    res.json({ success: true, data: employees, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

router.get('/export/work-orders', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;

    const [workOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       WHERE wo.supervisor_id = ?`,
      [supervisorId]
    );

    res.json({ success: true, data: workOrders, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// View FP employee zone assignments (READ-ONLY for supervisors under FP)
router.get('/fp-employee-zones', requireSupervisorScope, async (req, res) => {
  try {
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
