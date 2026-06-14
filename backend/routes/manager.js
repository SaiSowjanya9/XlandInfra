/**
 * Manager Portal API Routes
 * All routes are scoped to the logged-in Manager
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { sendCustomerActivationEmail } = require('../services/emailService');

// Constants for customer activation
const ACTIVATION_EXPIRY_HOURS = 72;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://xlandinfra.com';

// Generate secure temporary password (8 chars, alphanumeric)
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Generate secure activation token
const generateActivationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};
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
const {
  getAssignedZones,
  buildPropertyZoneOrCreatorFilter,
  buildOnboardedPropertyZoneOrCreatorFilter,
  buildWorkOrderZoneOrCreatorFilter,
  buildClientZoneOrCreatorFilter,
  getEmployeeIdForZoneLookup,
  getCreatorIdentifier
} = require('../middleware/zoneHelper');

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

    // Get franchise_partner_id - check users table first, then fp_employees table
    let franchisePartnerId = user.franchise_partner_id || null;
    if (!franchisePartnerId) {
      // Check fp_employees table by email or username
      const [fpEmployee] = await pool.execute(
        `SELECT franchise_partner_id FROM fp_employees WHERE (email = ? OR username = ?) AND is_active = 1`,
        [user.email, user.username]
      );
      if (fpEmployee.length > 0 && fpEmployee[0].franchise_partner_id) {
        franchisePartnerId = fpEmployee[0].franchise_partner_id;
      }
    }

    // Generate token - include franchisePartnerId for FP-created managers
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      managerId: user.id,
      franchisePartnerId: franchisePartnerId
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
          franchisePartnerId: franchisePartnerId,
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
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeTable = req.isFPManager ? 'fp_employees' : 'manager_employees';
    const employeeScopeCol = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId);

    console.log('[Manager Dashboard] scopeId:', scopeId, 'scopeColumn:', scopeColumn, 'fpId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);

    // Build zone conditions
    const zoneList = assignedZones.length > 0 ? assignedZones.map(() => '?').join(',') : null;

    // Run all queries in parallel for faster response
    const [
      propertiesCount,
      onboardedPropertiesCount,
      vendorsCount,
      customersCount,
      employeesCount,
      workOrderStats,
      estimatesCount,
      recentWorkOrders
    ] = await Promise.all([
      // Properties count (zone-centric + own created)
      pool.execute(
        `SELECT COUNT(*) as count FROM properties 
         WHERE franchise_partner_id = ? AND (status IS NULL OR status != 'deleted') AND (created_by = ? OR created_by = ? OR manager_id = ?${zoneList ? ` OR zone_id IN (${zoneList})` : ''})`,
        [franchisePartnerId, creatorEmail, req.user?.username || '', managerId, ...assignedZones]
      ).then(([r]) => r[0].count).catch(() => 0),
      
      // Onboarded Properties count (zone-centric + own created)
      pool.execute(
        `SELECT COUNT(*) as count FROM onboarded_properties 
         WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR manager_id = ?${zoneList ? ` OR zone IN (${zoneList})` : ''})`,
        [franchisePartnerId, creatorEmail, req.user?.username || '', managerId, ...assignedZones]
      ).then(([r]) => r[0].count).catch(() => 0),
      
      // Vendors count (zone-centric + own created)
      pool.execute(
        `SELECT COUNT(*) as count FROM onboarded_vendors 
         WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ?${zoneList ? ` OR zone IN (${zoneList})` : ''})`,
        [franchisePartnerId, creatorEmail, req.user?.username || '', ...assignedZones]
      ).then(([r]) => r[0].count).catch(() => 0),
      
      // Customers count (own created)
      pool.execute(
        `SELECT COUNT(*) as count FROM clients 
         WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR manager_id = ?)`,
        [franchisePartnerId, creatorEmail, req.user?.username || '', managerId]
      ).then(([r]) => r[0].count).catch(() => 0),
      
      // Employees count
      pool.execute(`SELECT COUNT(*) as count FROM ${employeeTable} WHERE ${employeeScopeCol} = ? AND is_active = 1`, [scopeId])
        .then(([r]) => r[0].count).catch(() => 0),
      
      // Work orders (own created)
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
        FROM work_orders 
        WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR manager_id = ?)
      `, [franchisePartnerId, creatorEmail, req.user?.username || '', managerId]).then(([[r]]) => ({ 
        total: r.total || 0, 
        pending: r.pending || 0, 
        completed: r.completed || 0 
      })).catch(() => ({ total: 0, pending: 0, completed: 0 })),
      
      // Estimates count (own created)
      pool.execute(
        `SELECT COUNT(*) as count FROM fp_estimates 
         WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR manager_id = ?)`,
        [franchisePartnerId, creatorEmail, req.user?.username || '', managerId]
      ).then(([r]) => r[0].count).catch(() => 0),
      
      // Recent work orders (own created)
      pool.execute(
        `SELECT wo.*, p.name as property_name, c.name as category_name, 
                v.company_name as vendor_name, cl.name as client_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN clients cl ON wo.client_id = cl.id
         WHERE wo.franchise_partner_id = ? AND (wo.created_by = ? OR wo.created_by = ? OR wo.manager_id = ?)
         ORDER BY wo.created_at DESC
         LIMIT 10`,
        [franchisePartnerId, creatorEmail, req.user?.username || '', managerId]
      ).then(([rows]) => rows).catch(() => [])
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          properties: propertiesCount + onboardedPropertiesCount,
          vendors: vendorsCount,
          customers: customersCount,
          employees: employeesCount,
          workOrders: workOrderStats.total,
          pendingWorkOrders: workOrderStats.pending,
          completedWorkOrders: workOrderStats.completed,
          estimates: estimatesCount
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

// Get all manager properties - Manager sees their own + linked FP properties (ZONE-CENTRIC)
router.get('/properties', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    console.log('[Manager Properties] managerId:', managerId, 'franchisePartnerId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);
    
    // Build zone filter (zone-centric + own created)
    const zoneFilter = buildPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'p');
    
    // Fetch from properties table with creator name - filter by FP for FP employees
    let propQuery = `SELECT p.*, 
        p.zone_id as zone_name,
        COALESCE(p.area_name, p.city) as area,
        COALESCE(p.division, 'General') as division,
        COALESCE(p.number_of_units, 1) as units,
        COALESCE(
          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
          p.created_by, 'System'
        ) as created_by_name,
        'properties' as source_table
       FROM properties p 
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username
       LEFT JOIN users u ON p.created_by = u.email OR CAST(p.created_by AS UNSIGNED) = u.id
       WHERE ${franchisePartnerId ? 'p.franchise_partner_id = ?' : 'p.manager_id = ?'} AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
       ORDER BY p.created_at DESC`;
    const propParams = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [managerId, ...zoneFilter.params];
    console.log('[Manager Properties] Params:', propParams);
    const [regularProperties] = await pool.execute(propQuery, propParams);
    console.log('[Manager Properties] Found:', regularProperties.length, 'properties');

    // Also fetch from onboarded_properties with creator name (zone-centric + own created)
    // Only fetch if franchisePartnerId exists (onboarded_properties doesn't have manager_id column)
    let onboardedProperties = [];
    if (franchisePartnerId) {
      try {
        const onbZoneFilter = buildOnboardedPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'op');
        let onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type as type,
                  op.zone as zone_name, op.area_name as area, op.division, op.total_units as units,
                  op.total_units, op.number_of_blocks, op.block_names, op.units_per_block, op.number_of_units,
                  op.address, op.city, op.state, op.postal_code as zip_code,
                  op.contact_person, op.contact_phone, op.contact_email as email,
                  COALESCE(
                    CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                    CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                    op.created_by, 'System'
                  ) as created_by_name,
                  op.created_at, op.status,
                  'onboarded_properties' as source_table
           FROM onboarded_properties op
           LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR op.created_by = fpe.username
           LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
           WHERE op.franchise_partner_id = ? AND op.status = 'active'${onbZoneFilter.clause}
           ORDER BY op.created_at DESC`;
        const onbParams = [franchisePartnerId, ...onbZoneFilter.params];
        const [rows] = await pool.execute(onbQuery, onbParams);
        onboardedProperties = rows;
      } catch (e) {
        console.log('onboarded_properties fetch error:', e.message);
      }
    }

    const allProperties = [...regularProperties, ...onboardedProperties];

    res.json({ success: true, data: allProperties });
  } catch (error) {
    console.error('[Manager Properties ERROR]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property - dual-tag with manager_id AND franchise_partner_id
router.post('/properties', requireManagerScope, async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;
    
    const propertyId = `PROP-MGR-${Date.now()}`;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
    // Get actual user name from database (check both users and fp_employees tables)
    let creatorName = req.user?.username || req.user?.email || 'System';
    try {
      const [userRows] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ? OR email = ? OR username = ?',
        [req.user?.id || 0, req.user?.email || '', req.user?.username || '']
      );
      if (userRows.length > 0 && (userRows[0].first_name || userRows[0].last_name)) {
        creatorName = `${userRows[0].first_name || ''} ${userRows[0].last_name || ''}`.trim();
      } else {
        const [fpRows] = await pool.execute(
          'SELECT first_name, last_name FROM fp_employees WHERE id = ? OR email = ? OR username = ?',
          [req.user?.id || 0, req.user?.email || '', req.user?.username || '']
        );
        if (fpRows.length > 0 && (fpRows[0].first_name || fpRows[0].last_name)) {
          creatorName = `${fpRows[0].first_name || ''} ${fpRows[0].last_name || ''}`.trim();
        }
      }
    } catch (e) {
      console.log('Could not fetch creator name:', e.message);
    }
    
    const [result] = await pool.execute(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode, 
       contactPerson, contactPhone, contactEmail, zoneId || null, managerId, franchisePartnerId, creatorName]
    );

    res.json({ success: true, message: 'Property created', data: { id: result.insertId, propertyId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single property by ID (for auto-populate in work orders)
router.get('/properties/:id', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    // Try properties table first
    const [properties] = await pool.execute(
      `SELECT p.*, p.contact_person, p.contact_phone, p.contact_email
       FROM properties p
       WHERE (p.id = ? OR p.property_id = ?) AND p.${scopeColumn} = ?`,
      [id, id, scopeId]
    );
    
    if (properties.length > 0) {
      return res.json({ success: true, data: properties[0] });
    }
    
    // Try onboarded_properties table
    const [onboarded] = await pool.execute(
      `SELECT op.*, op.community_name as name, NULL as contact_person, NULL as contact_phone, NULL as contact_email
       FROM onboarded_properties op
       WHERE (op.id = ? OR op.property_id = ?) AND op.${scopeColumn} = ?`,
      [id, id, scopeId]
    );
    
    if (onboarded.length > 0) {
      return res.json({ success: true, data: onboarded[0] });
    }
    
    res.status(404).json({ success: false, message: 'Property not found' });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch property' });
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

// Get all manager work orders - Manager sees their own + linked FP work orders (ZONE-CENTRIC)
router.get('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { status } = req.query;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    console.log('[Manager Work Orders] managerId:', managerId, 'franchisePartnerId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);
    
    // Build zone filter for properties linked to work orders (zone-centric + own created)
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    // FP employees see FP work orders, standalone managers see their created work orders
    let query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
                        v.company_name as vendor_name, cl.name as client_name,
                        COALESCE(
                          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                          wo.created_by, 'System'
                        ) as created_by_name
                 FROM work_orders wo
                 LEFT JOIN properties p ON wo.property_id = p.id
                 LEFT JOIN categories c ON wo.category_id = c.id
                 LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
                 LEFT JOIN clients cl ON wo.client_id = cl.id
                 LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username
                 WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'}${zoneFilter.clause}`;
    
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];
    
    if (status) {
      query += ' AND wo.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY wo.created_at DESC';
    
    console.log('[Manager Work Orders] Query:', query);
    console.log('[Manager Work Orders] Params:', params);
    
    const [workOrders] = await pool.execute(query, params);
    console.log('[Manager Work Orders] Results count:', workOrders.length);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pending work orders - Manager sees their own + linked FP work orders (ZONE-CENTRIC + OWN CREATED)
router.get('/work-orders/pending', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    const query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status NOT IN ('completed', 'closed', 'cancelled')${zoneFilter.clause}
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];
    
    const [workOrders] = await pool.execute(query, params);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get completed work orders - Manager sees their own + linked FP work orders (ZONE-CENTRIC + OWN CREATED)
router.get('/work-orders/completed', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    const query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('completed', 'closed')${zoneFilter.clause}
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];
    
    const [workOrders] = await pool.execute(query, params);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create work order
router.post('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate,
            propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone } = req.body;
    
    const workOrderId = `WO-MGR-${Date.now()}`;
    
    // For FP-created managers: store BOTH franchise_partner_id AND manager_id
    // So work order shows in both FP dashboard and Manager dashboard
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
    const [result] = await pool.execute(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, status, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, NOW())`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
       priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null,
       managerId, franchisePartnerId, req.user.id]
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
      createdBy: req.user?.username || req.user?.email || 'Manager',
      createdByRole: 'Manager',
      createdFromPortal: 'Manager Portal'
    }).catch(err => console.error('Email notification error:', err));

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

    // Send completion email if status is completed
    if (status === 'completed') {
      const [workOrder] = await pool.execute(
        `SELECT work_order_id, title, property_name, property_id, customer_name, customer_email, customer_phone, category_name, subcategory_name 
         FROM work_orders WHERE id = ?`, [req.params.id]
      );
      if (workOrder.length > 0) {
        const { sendWorkOrderCompletedNotification } = require('../services/emailService');
        sendWorkOrderCompletedNotification({
          orderId: req.params.id,
          orderNumber: workOrder[0].work_order_id,
          title: workOrder[0].title,
          propertyName: workOrder[0].property_name,
          propertyId: workOrder[0].property_id,
          customerName: workOrder[0].customer_name,
          customerEmail: workOrder[0].customer_email,
          customerPhone: workOrder[0].customer_phone,
          categoryName: workOrder[0].category_name,
          subcategoryName: workOrder[0].subcategory_name,
          completedBy: req.user?.username || req.user?.email || 'Manager',
          completedByRole: 'Manager'
        }).catch(err => console.error('Completion email error:', err));
      }
    }

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

// Get all manager customers - Manager sees their own + linked FP customers (ZONE-CENTRIC + OWN CREATED)
router.get('/customers', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildClientZoneOrCreatorFilter(assignedZones, creatorEmail, 'c', 'p');
    
    const query = `SELECT c.*, p.name as property_name, p.zone_id as zone 
       FROM clients c 
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.manager_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})${zoneFilter.clause}
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [managerId, franchisePartnerId, ...zoneFilter.params] : [managerId, ...zoneFilter.params];
    
    const [customers] = await pool.execute(query, params);
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create customer with property - full form support
router.post('/customers', requireManagerScope, async (req, res) => {
  try {
    const {
      // Property form data
      zone, areaName, division, propertyType, communityName,
      associationContacts, numberOfBlocks, unitsPerBlock, blockNames,
      numberOfUnits, villaPlotNumber, blockInfo, blockNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      // Simple customer data (for backward compatibility)
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;

    // Check if this is a property form submission (has zone/communityName)
    if (zone && communityName) {
      // Generate IDs
      const propertyIdGen = `MGR-${entryType || 'GC'}-${Date.now()}`;
      const clientId = `MGR-CLT-${Date.now()}`;
      
      // Get contact info
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      // Create property first
      const [propertyResult] = await pool.execute(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          manager_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          managerId, franchisePartnerId, req.user?.username || req.user?.email || req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || ''
        ]
      );

      // Also create a record in clients table for Property Management listing
      try {
        await pool.execute(
          `INSERT INTO clients (name, email, phone, address, city, state, zip_code, 
            property_id, manager_id, franchise_partner_id, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [contactName || communityName, contactEmail || '', `${contactCountryCode}${contactPhone || ''}`,
           address || '', city || '', state || '', postalCode || '',
           propertyResult.insertId, managerId, franchisePartnerId, req.user?.username || req.user?.email || '']
        );
      } catch (clientErr) {
        console.error('Clients insert failed (non-critical):', clientErr.message);
      }

      // Create customer account if email provided
      let customerResult = null;
      let emailSent = false;
      if (contactEmail) {
        const tempPassword = generateTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const [existing] = await pool.execute(
          'SELECT id, is_activated FROM customer_accounts WHERE email = ?', [contactEmail.toLowerCase()]
        );
        
        if (existing.length === 0) {
          [customerResult] = await pool.execute(
            `INSERT INTO customer_accounts (
              customer_id, first_name, last_name, email, phone, temp_password_hash, property_id,
              activation_token, activation_expires, is_activated, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientId, contactName, '', contactEmail.toLowerCase(), `${contactCountryCode}${contactPhone}`,
              tempPasswordHash, propertyResult.insertId, activationToken, activationExpires, 0, 'manager'
            ]
          );
          
          // Send activation email
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Sending customer activation email to:', contactEmail.toLowerCase());
          console.log('📧 Activation link:', activationLink);
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: contactEmail.toLowerCase(),
              firstName: contactName,
              tempPassword,
              activationLink,
              propertyName: communityName
            });
            emailSent = emailResult.success;
            console.log('📧 Email result:', emailResult);
          } catch (emailError) {
            console.error('📧 Email sending failed:', emailError);
            emailSent = false;
          }
        } else if (!existing[0].is_activated) {
          // Resend activation email for inactive account
          await pool.execute(
            `UPDATE customer_accounts 
             SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW()
             WHERE id = ?`,
            [tempPasswordHash, activationToken, activationExpires, existing[0].id]
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Resending activation email to existing inactive account:', contactEmail.toLowerCase());
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: contactEmail.toLowerCase(),
              firstName: contactName,
              tempPassword,
              activationLink,
              propertyName: communityName
            });
            emailSent = emailResult.success;
            console.log('📧 Resend email result:', emailResult);
          } catch (emailError) {
            console.error('📧 Resend email failed:', emailError);
            emailSent = false;
          }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully' + (emailSent ? ', activation email sent' : ''),
        data: { 
          propertyId: propertyIdGen,
          clientId,
          customerId: customerResult?.insertId || null,
          emailSent
        }
      });
    } else {
      // Simple customer creation (backward compatibility)
      const clientId = `CLT-MGR-${Date.now()}`;
      
      const [result] = await pool.execute(
        `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
          zip_code, client_type, company_name, property_id, gst_number, manager_id, franchise_partner_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
         clientType || 'individual', companyName, propertyId || null, gstNumber, managerId, franchisePartnerId, 
         req.user?.username || req.user?.email || '']
      );

      // Create customer account and send activation email if email provided
      let emailSent = false;
      if (email) {
        const tempPassword = generateTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const [existing] = await pool.execute(
          'SELECT id, is_activated FROM customer_accounts WHERE email = ?', [email.toLowerCase()]
        );
        
        if (existing.length === 0) {
          await pool.execute(
            `INSERT INTO customer_accounts (
              customer_id, first_name, last_name, email, phone, temp_password_hash,
              activation_token, activation_expires, is_activated, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, name, '', email.toLowerCase(), phone || '', tempPasswordHash, activationToken, activationExpires, 0, 'manager']
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Sending activation email (simple create) to:', email.toLowerCase());
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: email.toLowerCase(),
              firstName: name,
              tempPassword,
              activationLink,
              propertyName: companyName || 'XLAND INFRA'
            });
            emailSent = emailResult.success;
            console.log('📧 Email result:', emailResult);
          } catch (emailError) {
            console.error('📧 Email sending failed:', emailError);
          }
        } else if (!existing[0].is_activated) {
          await pool.execute(
            `UPDATE customer_accounts SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW() WHERE id = ?`,
            [tempPasswordHash, activationToken, activationExpires, existing[0].id]
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Resending activation email (simple create) to:', email.toLowerCase());
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: email.toLowerCase(),
              firstName: name,
              tempPassword,
              activationLink,
              propertyName: companyName || 'XLAND INFRA'
            });
            emailSent = emailResult.success;
          } catch (emailError) {
            console.error('📧 Email resend failed:', emailError);
          }
        }
      }

      res.json({ 
        success: true, 
        message: 'Customer created' + (emailSent ? ', activation email sent' : ''), 
        data: { id: result.insertId, clientId, emailSent } 
      });
    }
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get all manager vendors (ZONE-CENTRIC + OWN CREATED)
router.get('/vendors', requireManagerScope, async (req, res) => {
  try {
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get employee's assigned zones
    const assignedZones = await getAssignedZones(employeeId);

    // Build zone + creator filter
    let zoneClause = '';
    let zoneParams = [];
    if (assignedZones.length > 0) {
      const placeholders = assignedZones.map(() => '?').join(',');
      zoneClause = ` AND (ov.zone IN (${placeholders}) OR ov.created_by = ? OR ov.created_by = ?)`;
      zoneParams = [...assignedZones, creatorEmail, req.user?.username || ''];
    } else {
      // No zones = only see own created
      zoneClause = ` AND (ov.created_by = ? OR ov.created_by = ?)`;
      zoneParams = [creatorEmail, req.user?.username || ''];
    }

    const query = `SELECT ov.id, ov.vendor_id, ov.service_type, ov.service_verified,
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
       WHERE ov.franchise_partner_id = ?${zoneClause}
       ORDER BY ov.created_at DESC`;
    
    const [vendors] = await pool.execute(query, [req.franchisePartnerId, ...zoneParams]);

    res.json({
      success: true,
      data: {
        own: vendors,
        assigned: [],
        all: vendors
      }
    });
  } catch (error) {
    console.error('Manager vendors fetch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get vendor assignments for Manager portal (view-only) (ZONE-CENTRIC)
router.get('/vendors/assignments', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    const employeeId = getEmployeeIdForZoneLookup(req);
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId);
    
    console.log('Manager Vendor Assignments Query:', { scopeId, scopeColumn, assignedZones });
    
    // Build zone filter for vendor's zone
    let zoneClause = '';
    let zoneParams = [];
    if (assignedZones.length > 0) {
      const placeholders = assignedZones.map(() => '?').join(',');
      zoneClause = ` AND v.zone IN (${placeholders})`;
      zoneParams = assignedZones;
    }
    
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
       WHERE (p.${scopeColumn} = ? OR op.${scopeColumn} = ?) AND pva.is_active = 1${zoneClause}
       ORDER BY pva.assigned_at DESC`,
      [scopeId, scopeId, ...zoneParams]
    );

    console.log('Vendor assignments found:', propertyAssignments.length);

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
    console.error('Manager vendor assignments fetch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create vendor - dual-tag with manager_id AND franchise_partner_id
router.post('/vendors', requireManagerScope, async (req, res) => {
  try {
    const { 
      serviceType, serviceVerified, zone, areaName, division,
      ownerName, ownerMobile, ownerEmail, ownerAadhar, ownerCountryCode,
      managerName, managerMobile, managerEmail, managerCountryCode,
      pocName, pocMobile, pocEmail, pocCountryCode,
      ratePerVisit, coveragePerDay,
      gstNumber, panNumber, licenseNumber
    } = req.body;
    
    const vendorId = `MGR-${serviceType?.substring(0, 3).toUpperCase() || 'VND'}-${Date.now()}`;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
    // Get employee ID for proper creator tracking
    const employeeId = req.user?.id || managerId;
    const employeeUsername = req.user?.username || '';
    // Generate username from email
    const username = ownerEmail ? ownerEmail.split('@')[0] + '_' + Date.now() : `vendor_${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO onboarded_vendors (
        vendor_id, username, service_type, service_verified, zone, area_name, division,
        owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
        manager_name, manager_mobile, manager_email, manager_country_code,
        poc_name, poc_mobile, poc_email, poc_country_code,
        gst_number, pan_number, license_number,
        rate_per_visit, coverage_per_day, rating, total_jobs_completed,
        franchise_partner_id, manager_id, created_by, created_by_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'active')`,
      [
        vendorId, username, serviceType || '', serviceVerified ? 1 : 0, zone || '', areaName || '', division || '',
        ownerName || '', ownerMobile || '', ownerEmail || '', ownerAadhar || '', ownerCountryCode || '+91',
        managerName || '', managerMobile || '', managerEmail || '', managerCountryCode || '+91',
        pocName || '', pocMobile || '', pocEmail || '', pocCountryCode || '+91',
        gstNumber || '', panNumber || '', licenseNumber || '',
        parseFloat(ratePerVisit) || 0, parseInt(coveragePerDay) || 0,
        franchisePartnerId, managerId,
        employeeUsername, employeeId
      ]
    );

    res.json({ success: true, message: 'Vendor created', data: { id: result.insertId, vendorId } });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update vendor - DISABLED for Manager role
router.put('/vendors/:id', requireManagerScope, validateOwnership('onboarded_vendors'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Modify vendor not allowed for this role' });
});

// Delete vendor - DISABLED for Manager role
router.delete('/vendors/:id', requireManagerScope, validateOwnership('onboarded_vendors'), async (req, res) => {
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

// View FP employee zone assignments (READ-ONLY for managers under FP) - ZONE-CENTRIC
router.get('/fp-employee-zones', requireManagerScope, async (req, res) => {
  try {
    // Only available for managers under FP
    if (!req.isFPManager || !req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP managers' });
    }

    const employeeId = getEmployeeIdForZoneLookup(req);
    
    // Get manager's assigned zones for zone-centric filtering
    const managerZones = await getAssignedZones(employeeId);
    
    // Build zone filter - if manager has zones, only show employees with overlapping zones
    let employeeZoneFilter = '';
    let employeeParams = [req.franchisePartnerId, req.franchisePartnerId];
    
    if (managerZones.length > 0) {
      // Filter to only show employees who have at least one zone that overlaps with manager's zones
      const placeholders = managerZones.map(() => '?').join(',');
      employeeZoneFilter = ` AND e.id IN (
        SELECT DISTINCT ez2.fp_employee_id FROM fp_employee_zones ez2
        JOIN zones z2 ON ez2.zone_id = z2.id
        WHERE ez2.franchise_partner_id = ? AND z2.name IN (${placeholders})
      )`;
      employeeParams.push(req.franchisePartnerId, ...managerZones);
    }

    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active,
              GROUP_CONCAT(DISTINCT z.name ORDER BY z.name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       LEFT JOIN zones z ON ez.zone_id = z.id
       WHERE e.franchise_partner_id = ? AND e.is_active = 1${employeeZoneFilter}
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      employeeParams
    );

    // Get zones for reference - if manager has zones, only show their zones
    let zones = [];
    if (managerZones.length > 0) {
      // Only show manager's assigned zones
      zones = managerZones.map(z => ({ name: z }));
    } else {
      // Manager has full access - show all zones
      const [allZones] = await pool.execute(
        `SELECT DISTINCT z.name FROM fp_employee_zones ez 
         JOIN zones z ON ez.zone_id = z.id
         WHERE ez.franchise_partner_id = ? ORDER BY z.name`,
        [req.franchisePartnerId]
      );
      zones = allZones;
    }

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

// ============================================
// ESTIMATES MANAGEMENT
// ============================================

// Get all manager estimates - Zone-centric + own created
router.get('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    let estimates = [];
    
    // If manager is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      // Get assigned zones
      const assignedZones = await getAssignedZones(employeeId);
      
      // Build zone + creator filter - match by created_by_id OR created_by_name (name, email, or username)
      let zoneClause = '';
      let zoneParams = [];
      if (assignedZones.length > 0) {
        const placeholders = assignedZones.map(() => '?').join(',');
        zoneClause = ` AND (e.zone IN (${placeholders}) OR e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [...assignedZones, managerId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
      } else {
        // No zones = only see own created (by ID or by name/email/username)
        zoneClause = ` AND (e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [managerId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
      }
      
      const [fpEstimates] = await pool.execute(
        `SELECT e.*, fpamc.services as packageServices,
                COALESCE(e.amc_package_description, fpamc.description) as amc_package_description,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                  e.created_by_name
                ) as created_by_name
         FROM fp_estimates e
         LEFT JOIN fp_employees fpe ON e.created_by_name = fpe.email OR e.created_by_name = fpe.username
         LEFT JOIN users u ON e.created_by_name = u.email
         LEFT JOIN fp_amc_packages fpamc ON e.package_id = fpamc.id
         WHERE e.franchise_partner_id = ? AND ${isArchived ? 'e.is_archived = 1' : '(e.is_archived = 0 OR e.is_archived IS NULL)'}${zoneClause}
         ORDER BY e.created_at DESC`,
        [franchisePartnerId, ...zoneParams]
      );
      
      // Get FP addons for description lookup
      let fpAddons = [];
      try {
        const [addonResults] = await pool.execute(
          `SELECT id, service_name, description FROM fp_addons WHERE franchise_partner_id = ?`,
          [franchisePartnerId]
        );
        fpAddons = addonResults;
      } catch (e) {}

      // Enrich estimates with property_code and parse addons
      estimates = await Promise.all(fpEstimates.map(async (est) => {
        // Parse addons JSON
        let addons = [];
        if (est.addons_data) {
          try { 
            addons = JSON.parse(est.addons_data);
            // Enrich addons with descriptions from fp_addons
            addons = addons.map(addon => {
              if (!addon.description) {
                const foundAddon = fpAddons.find(a => a.id == addon.id || a.service_name === (addon.name || addon.service_name));
                if (foundAddon) {
                  addon.description = foundAddon.description || '';
                }
              }
              return addon;
            });
          } catch(e) {}
        }
        
        // Get original property_code from onboarded_properties or properties table
        let property_code = est.property_code;
        const propId = est.property_id;
        const propName = est.property_name || '';
        
        // Always try to fetch the original property_id from the property tables
        if (propId || propName) {
          try {
            // Try onboarded_properties first (admin-created properties visible to FP)
            let [props] = await pool.execute(
              `SELECT property_id as orig_code FROM onboarded_properties 
               WHERE (id = ? OR community_name = ?) LIMIT 1`,
              [propId || 0, propName]
            );
            if (props.length > 0 && props[0].orig_code) {
              property_code = props[0].orig_code;
            } else {
              // Try properties table (FP-created properties)
              [props] = await pool.execute(
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
      
      console.log(`Manager ${managerId} (FP: ${franchisePartnerId}) - Found ${estimates.length} FP estimates`);
    }
    
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('Error fetching manager estimates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create estimate - dual-tag with manager_id AND franchise_partner_id
router.post('/estimates', requireManagerScope, async (req, res) => {
  try {
    const {
      estimate_type, property_id, property_code, client_name, client_phone, client_email,
      property_name, property_type, zone, city, address, package_id, package_name, package_price,
      amc_package_description, package_services,
      addons, subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
      description, number_of_blocks, block_names, units_per_block, total_units,
      tower_name, block_number, villa_plot_number, division,
      flat_number, villa_number, plot_number
    } = req.body;
    
    const estimateId = `EST-MGR-${Date.now()}`;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || 1;
    
    // property_id column is INT, so use null for string codes
    const numericPropertyId = parseInt(property_id);
    const propertyIdValue = isNaN(numericPropertyId) ? null : numericPropertyId;

    // Get creator name - check fp_employees first, then users table
    let creatorName = 'Manager';
    try {
      // Try fp_employees table first (for FP-created employees)
      const [[fpEmp]] = await pool.query(
        'SELECT first_name, last_name FROM fp_employees WHERE id = ? OR user_id = ?',
        [managerId, managerId]
      );
      if (fpEmp && (fpEmp.first_name || fpEmp.last_name)) {
        creatorName = `${fpEmp.first_name || ''} ${fpEmp.last_name || ''}`.trim() || 'Manager';
      } else {
        // Fall back to users table
        const [[userInfo]] = await pool.query('SELECT first_name, last_name, name FROM users WHERE id = ?', [managerId]);
        if (userInfo) creatorName = userInfo.first_name && userInfo.last_name ? `${userInfo.first_name} ${userInfo.last_name}`.trim() : userInfo.name || 'Manager';
      }
    } catch (e) { console.log('Creator name lookup error:', e.message); }

    // Add new columns if they don't exist
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN amc_package_description TEXT`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN package_services TEXT`);
    } catch (e) { /* Column exists */ }

    const [result] = await pool.execute(
      `INSERT INTO fp_estimates (
        estimate_id, franchise_partner_id, property_id, estimate_type,
        client_name, client_phone, client_email, property_name, property_code, property_type,
        zone, city, address, package_id, package_name, package_price, amc_package_description, package_services,
        subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
        addons_data, description, created_by_id, created_by_name, created_by_role, status,
        number_of_blocks, block_names, units_per_block, total_units, tower_name, block_number, villa_plot_number, division,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        estimateId, franchisePartnerId, propertyIdValue, estimate_type || 'property_based',
        client_name || '', client_phone || '', client_email || '',
        property_name || '', property_code || property_id || '', property_type || '',
        zone || '', city || '', address || '',
        package_id || null, package_name || '', package_price || 0, amc_package_description || '', package_services ? JSON.stringify(package_services) : null,
        subtotal || 0, discount_percent || 0, discount_amount || 0,
        gst_percent || 0, gst_amount || 0, total_amount || 0,
        JSON.stringify(addons || []), description || '', managerId, creatorName, 'manager',
        number_of_blocks || null, block_names ? JSON.stringify(block_names) : null, 
        units_per_block ? JSON.stringify(units_per_block) : null, total_units || null,
        tower_name || null, block_number || null, villa_plot_number || null, division || null
      ]
    );

    res.json({ success: true, message: 'Estimate created', data: { id: result.insertId, estimateId } });
  } catch (error) {
    console.error('Manager estimate create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create estimate: ' + error.message });
  }
});

// Archive estimate
router.put('/estimates/:id/archive', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers update fp_estimates, standalone update estimates
    if (req.isFPManager) {
      await pool.execute(
        `UPDATE fp_estimates SET is_archived = 1, archived_at = NOW(), updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
        [req.params.id, scopeId]
      );
    } else {
      await pool.execute(
        `UPDATE estimates SET is_archived = 1, updated_at = NOW() WHERE id = ? AND manager_id = ?`,
        [req.params.id, scopeId]
      );
    }
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AMC PACKAGES - FP Managers use FP packages (read-only), standalone use manager packages
// ============================================

// Transform AMC package to frontend format
const transformPackage = (pkg) => ({
  id: pkg.id,
  packageId: pkg.package_code || `PKG-${pkg.id}`,
  packageName: pkg.name || pkg.package_name,
  name: pkg.name || pkg.package_name,
  description: pkg.description || '',
  propertyType: pkg.property_type === 'AP' ? 'APT' : pkg.property_type === 'VL' ? 'VILLA' : pkg.property_type === 'FL' ? 'FLAT' : pkg.property_type === 'PL' ? 'PLOT' : pkg.property_type || 'GC',
  price: parseFloat(pkg.base_price || pkg.price) || 0,
  rate: parseFloat(pkg.base_price || pkg.price) || 0,
  services: pkg.services ? (typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services) : [],
  serviceRows: pkg.service_rows ? (typeof pkg.service_rows === 'string' ? JSON.parse(pkg.service_rows) : pkg.service_rows) : [],
  durationMonths: pkg.duration_months || 12,
  billingCycle: pkg.billing_duration || 'Annual',
  createdAt: pkg.created_at
});

// Get AMC packages - FP Managers see FP packages, standalone see their own
router.get('/amc-packages', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers read from fp_amc_packages, standalone from manager_amc_packages
    const table = req.isFPManager ? 'fp_amc_packages' : 'manager_amc_packages';
    const scopeColumn = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    
    const [packages] = await pool.execute(
        `SELECT * FROM ${table} WHERE ${scopeColumn} = ? ORDER BY created_at DESC`,
        [scopeId]
      );
      res.json({ success: true, data: packages.map(transformPackage) });
  } catch (error) {
    // Silently return empty array for missing tables (standalone manager tables may not exist)
    res.json({ success: true, data: [] });
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

// Transform addon to frontend format - include both transformed and raw fields
const transformAddon = (addon) => ({
  id: addon.id,
  addonId: addon.addon_code || `ADDON-${addon.id}`,
  // Raw fields for frontend compatibility
  service_name: addon.service_name || addon.name || '',
  property_type: addon.property_type,
  frequency_type: addon.frequency_type || 'Monthly',
  frequency_count: addon.frequency_count || 1,
  price: parseFloat(addon.price) || 0,
  description: addon.description || '',
  billing_cycle: addon.billing_cycle || 'Monthly',
  // Transformed fields
  propertyType: addon.property_type === 'AP' ? 'APT' : addon.property_type === 'VL' ? 'VILLA' : addon.property_type === 'FL' ? 'FLAT' : addon.property_type === 'PL' ? 'PLOT' : addon.property_type,
  propertyTypeName: addon.property_type === 'GC' ? 'Gated Community' : addon.property_type === 'AP' || addon.property_type === 'APT' ? 'Apartment' : addon.property_type === 'VL' || addon.property_type === 'VILLA' ? 'Villa' : addon.property_type === 'FL' || addon.property_type === 'FLAT' ? 'Flat' : addon.property_type === 'PL' || addon.property_type === 'PLOT' ? 'Plot' : addon.property_type,
  services: [{ name: addon.service_name || addon.name || '', frequency: addon.frequency_count || 1, frequencyType: addon.frequency_type || 'Monthly', price: parseFloat(addon.price) || 0, description: addon.description || '' }],
  totalPrice: parseFloat(addon.price) || 0,
  billingCycle: addon.billing_cycle || 'Monthly',
  createdAt: addon.created_at
});

// Get add-ons - FP Managers see FP add-ons, standalone see their own
router.get('/addons', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers read from fp_addons, standalone from manager_addons
    const table = req.isFPManager ? 'fp_addons' : 'manager_addons';
    const scopeColumn = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    
    const [addons] = await pool.execute(
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? ORDER BY created_at DESC`,
      [scopeId]
    );
    res.json({ success: true, data: addons.map(transformAddon) });
  } catch (error) {
    // Silently return empty array for missing tables (standalone manager tables may not exist)
    res.json({ success: true, data: [] });
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
    // Get global zones
    const [globalZones] = await pool.execute('SELECT id, name FROM zones WHERE is_active = 1');
    
    // Get zones from properties (FP-scoped or manager-scoped)
    const scopeColumn = req.franchisePartnerId ? 'franchise_partner_id' : 'manager_id';
    const scopeId = req.franchisePartnerId || req.managerId;
    const [propertyZones] = await pool.execute(
      `SELECT DISTINCT zone_id as name FROM properties 
       WHERE ${scopeColumn} = ? AND zone_id IS NOT NULL AND zone_id != ''`,
      [scopeId]
    );

    // Get FP zones (from FP or manager-created)
    let fpZones = [];
    try {
      const [fz] = await pool.execute(
        `SELECT id, name FROM fp_zones WHERE 
         (franchise_partner_id = ? OR manager_id = ?) AND is_active = 1`,
        [req.franchisePartnerId || 0, req.managerId]
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create zone - saves to fp_zones table
router.post('/zones', requireManagerScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    const franchisePartnerId = req.franchisePartnerId || null;
    const managerId = req.managerId;
    
    // Check if zone already exists
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND (franchise_partner_id = ? OR manager_id = ?)',
      [name, franchisePartnerId, managerId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, manager_id, created_by, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, franchisePartnerId, managerId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone
router.delete('/zones/:id', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const franchisePartnerId = req.franchisePartnerId || null;
    const managerId = req.managerId;
    
    // Only allow deleting zones created by this manager or their FP
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND (franchise_partner_id = ? OR manager_id = ?)',
      [id, franchisePartnerId, managerId]
    );
    
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DIVISIONS - FP-specific divisions shared across employees
// ============================================
router.get('/divisions', requireManagerScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // Get FP-specific divisions
    let divisions = [];
    if (franchisePartnerId) {
      const [fpDivisions] = await pool.execute(
        'SELECT id, name FROM fp_divisions WHERE franchise_partner_id = ? AND is_active = 1 ORDER BY name',
        [franchisePartnerId]
      );
      divisions = fpDivisions;
    }
    
    // Also get divisions from existing properties/vendors for this FP
    const [propertyDivisions] = await pool.execute(
      `SELECT DISTINCT division as name FROM properties 
       WHERE franchise_partner_id = ? AND division IS NOT NULL AND division != ''
       UNION
       SELECT DISTINCT division as name FROM onboarded_vendors 
       WHERE franchise_partner_id = ? AND division IS NOT NULL AND division != ''`,
      [franchisePartnerId || 0, franchisePartnerId || 0]
    );
    
    // Combine and deduplicate
    const allDivisionNames = new Set(divisions.map(d => d.name));
    propertyDivisions.forEach(d => {
      if (d.name && !allDivisionNames.has(d.name)) {
        allDivisionNames.add(d.name);
        divisions.push({ id: `custom-${d.name}`, name: d.name });
      }
    });
    
    divisions.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, data: divisions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/divisions', requireManagerScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Division name is required' });
    }
    
    const franchisePartnerId = req.franchisePartnerId;
    if (!franchisePartnerId) {
      return res.status(400).json({ success: false, message: 'FP context required' });
    }
    
    // Check if division already exists
    const [existing] = await pool.execute(
      'SELECT id FROM fp_divisions WHERE name = ? AND franchise_partner_id = ?',
      [name, franchisePartnerId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Division already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_divisions (name, franchise_partner_id, created_by, is_active) VALUES (?, ?, ?, 1)',
      [name, franchisePartnerId, req.user?.email || req.user?.username || '']
    );
    
    res.json({ success: true, message: 'Division created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/divisions/:id', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const franchisePartnerId = req.franchisePartnerId;
    
    await pool.execute(
      'UPDATE fp_divisions SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?',
      [id, franchisePartnerId]
    );
    
    res.json({ success: true, message: 'Division deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', requireManagerScope, async (req, res) => {
  try {
    const categoriesConfig = require('../config/categories');
    return res.json({ success: true, data: categoriesConfig });
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
      'SELECT * FROM subcategories WHERE category_id = ? ORDER BY name',
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

// =====================================================
// FP PORTAL LINKS (Read-only for employees)
// =====================================================
router.get('/fp-portal-links', requireManagerScope, async (req, res) => {
  try {
    const fpId = req.franchisePartnerId || req.fpId;
    
    if (!fpId) {
      return res.json({ success: true, data: [] });
    }
    
    const [links] = await pool.execute(
      `SELECT id, link_slot, heading, url, created_at, updated_at 
       FROM fp_portal_links 
       WHERE franchise_partner_id = ? AND is_active = 1 
       ORDER BY link_slot ASC`,
      [fpId]
    );
    
    res.json({ success: true, data: links });
  } catch (error) {
    console.error('Get FP portal links error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portal links',
      error: error.message
    });
  }
});

module.exports = router;
