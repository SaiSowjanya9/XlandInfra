/**
 * Executive Portal API Routes
 * All routes are scoped to the logged-in executive's data
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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
const {
  getAssignedZones,
  buildPropertyZoneOrCreatorFilter,
  buildOnboardedPropertyZoneOrCreatorFilter,
  buildWorkOrderZoneOrCreatorFilter,
  buildClientZoneOrCreatorFilter,
  getEmployeeIdForZoneLookup,
  getCreatorIdentifier
} = require('../middleware/zoneHelper');

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

    // First check users table
    let [users] = await pool.query(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active, franchise_partner_id
       FROM users 
       WHERE (username = ? OR email = ?) AND role = 'executive'`,
      [username, username]
    );

    let userSource = 'users';

    // If not found in users, check fp_employees table
    if (users.length === 0) {
      [users] = await pool.query(
        `SELECT id, username, email, password as password_hash, first_name, last_name, role, is_active, franchise_partner_id
         FROM fp_employees 
         WHERE (username = ? OR email = ?) AND role = 'executive'`,
        [username, username]
      );
      userSource = 'fp_employees';
    }

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];
    console.log('[Executive Login] Found user in:', userSource, 'ID:', user.id, 'FP:', user.franchise_partner_id);

    if (!user.is_active && user.is_active !== undefined) {
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

    // Get franchise_partner_id - check users table first, then fp_employees table
    let franchisePartnerId = user.franchise_partner_id || null;
    if (!franchisePartnerId && userSource === 'users') {
      const [fpCheck] = await pool.query(
        `SELECT franchise_partner_id FROM fp_employees WHERE (email = ? OR username = ?) AND is_active = 1`,
        [user.email, user.username]
      );
      if (fpCheck.length > 0 && fpCheck[0].franchise_partner_id) {
        franchisePartnerId = fpCheck[0].franchise_partner_id;
      }
    }

    // Generate JWT token (include franchise_partner_id for FP data linking)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        executiveId: user.id,
        franchisePartnerId: franchisePartnerId
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
          franchisePartnerId: franchisePartnerId,
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
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId);
    
    console.log('[Executive Dashboard] executiveId:', executiveId, 'fpId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);

    // Build zone filter for properties (zone-centric + own created)
    let zoneCondition = '';
    let zoneParams = [];
    if (assignedZones.length > 0) {
      const zonePlaceholders = assignedZones.map(() => '?').join(',');
      zoneCondition = ` OR p.zone_id IN (${zonePlaceholders}) OR COALESCE(z.name, p.zone_id) IN (${zonePlaceholders})`;
      zoneParams = [...assignedZones, ...assignedZones];
    }

    // Count properties (zone-centric + own created)
    const [propertiesCount] = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as count FROM properties p
       LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id OR p.zone_id = z.name
       WHERE (p.franchise_partner_id = ? AND (p.status IS NULL OR p.status != 'deleted') AND (p.created_by = ? OR p.created_by = ? OR p.executive_id = ?${zoneCondition}))`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId, ...zoneParams]
    );
    
    // Build zone filter for onboarded_properties
    let onbZoneCondition = '';
    let onbZoneParams = [];
    if (assignedZones.length > 0) {
      const zonePlaceholders = assignedZones.map(() => '?').join(',');
      onbZoneCondition = ` OR op.zone IN (${zonePlaceholders})`;
      onbZoneParams = [...assignedZones];
    }

    // Count onboarded_properties (zone-centric + own created, only active)
    const [onboardedPropsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM onboarded_properties op
       WHERE op.status = 'active' AND (op.franchise_partner_id = ? AND (op.created_by = ? OR op.created_by = ? OR op.executive_id = ?${onbZoneCondition}))`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId, ...onbZoneParams]
    );

    // Vendors - zone-centric + own created
    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM onboarded_vendors 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ?${assignedZones.length > 0 ? ` OR zone IN (${assignedZones.map(() => '?').join(',')})` : ''})`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', ...assignedZones]
    );

    // Customers - own created
    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR executive_id = ?)`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId]
    );

    // Employees under this FP
    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    // Work orders - own created
    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR executive_id = ?)`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR executive_id = ?)
       AND status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR executive_id = ?)
       AND status IN ('completed', 'closed')`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId]
    );

    // Estimates - by FP (non-archived only)
    const [estimatesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM fp_estimates 
       WHERE franchise_partner_id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
      [franchisePartnerId]
    );

    // Get recent work orders (own created)
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       WHERE wo.franchise_partner_id = ? AND (wo.created_by = ? OR wo.created_by = ? OR wo.executive_id = ?)
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', executiveId]
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
// PROPERTIES (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/properties', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'p');

    // For FP executives, fetch properties from franchise partner
    // For regular executives, fetch their own and assigned properties
    let regularProperties = [];
    
    if (franchisePartnerId) {
      // FP Executive - get zone-centric properties + own created
      const [rows] = await pool.query(
        `SELECT p.id, p.property_id, p.name, p.property_type,
                COALESCE(z.name, p.zone_id) as zone_name, p.area_name as area, 
                p.division_id as division, p.number_of_units as units,
                p.address, p.city, p.state, p.zip_code,
                p.contact_person, p.contact_phone, p.contact_email,
                COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
                p.created_at, p.status, TRUE as is_active,
                'fp' as access_type, FALSE as can_modify, FALSE as can_delete,
                FALSE as can_assign_vendor, FALSE as can_assign_employee,
                'properties' as source_table
         FROM properties p
         LEFT JOIN zones z ON p.zone_id = z.id OR p.zone_id = z.name
         LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
         LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.username OR p.created_by = u.user_id OR CAST(p.created_by AS CHAR) = CAST(u.id AS CHAR)
         WHERE p.franchise_partner_id = ? AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
         ORDER BY p.created_at DESC`,
        [franchisePartnerId, ...zoneFilter.params]
      );
      regularProperties = rows;
    } else {
      // Regular Executive - get own and assigned properties
      const [rows] = await pool.query(
        `SELECT p.id, p.property_id, p.name, p.property_type,
                COALESCE(z.name, p.zone_id) as zone_name, p.area_name as area,
                p.division_id as division, p.number_of_units as units,
                p.address, p.city, p.state, p.zip_code,
                p.contact_person, p.contact_phone, p.contact_email,
                COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
                p.created_at, p.status, TRUE as is_active,
                'own' as access_type, TRUE as can_modify, FALSE as can_delete,
                FALSE as can_assign_vendor, FALSE as can_assign_employee,
                'properties' as source_table
         FROM properties p
         LEFT JOIN zones z ON p.zone_id = z.id OR p.zone_id = z.name
         LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
         LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.username OR p.created_by = u.user_id OR CAST(p.created_by AS CHAR) = CAST(u.id AS CHAR)
         WHERE p.executive_id = ? AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
         ORDER BY p.created_at DESC`,
        [executiveId, ...zoneFilter.params]
      );
      regularProperties = rows;
    }

    // Also fetch from onboarded_properties (zone-centric + own created)
    let onboardedProperties = [];
    try {
      const onbZoneFilter = buildOnboardedPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'op');
      const scopeColumn = franchisePartnerId ? 'franchise_partner_id' : 'executive_id';
      const scopeId = franchisePartnerId || executiveId;
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type,
                op.zone as zone_name, op.area_name as area, op.division, op.total_units as units,
                op.address, op.city, op.state, op.postal_code as zip_code,
                NULL as contact_person, NULL as contact_phone, NULL as email,
                COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                op.created_at, op.status, TRUE as is_active,
                'own' as access_type, FALSE as can_modify, FALSE as can_delete,
                FALSE as can_assign_vendor, FALSE as can_assign_employee,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR op.created_by = fpe.username OR CAST(op.created_by AS CHAR) = CAST(fpe.id AS CHAR)
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.username OR op.created_by = u.user_id OR CAST(op.created_by AS CHAR) = CAST(u.id AS CHAR)
         WHERE op.${scopeColumn} = ? AND op.status = 'active'${onbZoneFilter.clause}
         ORDER BY op.created_at DESC`,
        [scopeId, ...onbZoneFilter.params]
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

router.post('/properties', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    const propertyId = `PROP-${Date.now()}`;
    
    // Get creator identifier - MUST match what getCreatorIdentifier returns (username/email)
    // This is used for zone filtering to show "own created data"
    const creatorId = req.user?.username || req.user?.email || 'System';

    const [result] = await pool.query(
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, executive_id, franchise_partner_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, executiveId, franchisePartnerId, creatorId]
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

router.put('/properties/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sourceTable = updates.sourceTable || updates.source_table;

    let tableName = 'properties';
    
    if (sourceTable === 'onboarded_properties') {
      tableName = 'onboarded_properties';
    } else {
      const [propCheck] = await pool.query('SELECT id FROM properties WHERE id = ?', [id]);
      if (propCheck.length === 0) {
        const [onboardedCheck] = await pool.query('SELECT id FROM onboarded_properties WHERE id = ?', [id]);
        if (onboardedCheck.length > 0) {
          tableName = 'onboarded_properties';
        } else {
          return res.status(404).json({ success: false, message: 'Property not found' });
        }
      }
    }

    const allowedFieldsMap = {
      properties: ['name', 'property_type', 'address', 'city', 'state', 'zip_code', 'contact_person', 'contact_phone', 'contact_email', 'zone_id', 'division_id', 'area_name', 'is_active'],
      onboarded_properties: ['community_name', 'property_type', 'address', 'city', 'state', 'postal_code', 'zone', 'division', 'area_name', 'status', 'number_of_units', 'total_units']
    };

    const fieldMapping = {
      name: tableName === 'onboarded_properties' ? 'community_name' : 'name',
      zipCode: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zip_code: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zoneId: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      zone_id: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      divisionId: tableName === 'onboarded_properties' ? 'division' : 'division_id',
      division_id: tableName === 'onboarded_properties' ? 'division' : 'division_id'
    };

    const allowedFields = allowedFieldsMap[tableName];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'sourceTable' || key === 'source_table') continue;
      let dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (fieldMapping[key]) dbKey = fieldMapping[key];
      else if (fieldMapping[dbKey]) dbKey = fieldMapping[dbKey];
      
      let finalValue = value;
      if (tableName === 'onboarded_properties' && (key === 'isActive' || key === 'is_active')) {
        dbKey = 'status';
        finalValue = value ? 'active' : 'inactive';
      }
      
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(finalValue);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(id);
    await pool.query(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Property updated successfully' });
  } catch (error) {
    console.error('Property update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update property' });
  }
});

// Delete property - DISABLED for Executive role
router.delete('/properties/:id', requireExecutiveScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// =====================================================
// WORK ORDERS (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/work-orders', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { status } = req.query;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');

    // FP employees see FP work orders, standalone executives see their created work orders
    let query = `
      SELECT wo.*, 
             COALESCE(p.name, wo.property_name, op.community_name) as property_name,
             COALESCE(p.property_id, op.property_id) as actual_property_id,
             COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
             COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division, op.division) as division,
             COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
             op.total_units, op.blocks as total_blocks,
             COALESCE(c.name, wo.category_name) as category_name, 
             v.company_name as vendor_name,
             COALESCE(cl.name, wo.customer_name) as client_name,
             wo.customer_name, wo.customer_email, wo.customer_phone
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN clients cl ON wo.client_id = cl.id
      WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'}${zoneFilter.clause}
    `;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];

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
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');

    const query = `SELECT wo.*, 
             COALESCE(p.name, wo.property_name, op.community_name) as property_name,
             COALESCE(p.property_id, op.property_id) as actual_property_id,
             COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
             COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division, op.division) as division,
             COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
             op.total_units, op.blocks as total_blocks,
             COALESCE(c.name, wo.category_name) as category_name, 
             v.company_name as vendor_name,
             COALESCE(cl.name, wo.customer_name) as client_name,
             wo.customer_name, wo.customer_email, wo.customer_phone
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN onboarded_properties op ON wo.property_id = op.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')${zoneFilter.clause}
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];

    const [workOrders] = await pool.query(query, params);

    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Pending work orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending work orders' });
  }
});

router.get('/work-orders/completed', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');

    const query = `SELECT wo.*, 
             COALESCE(p.name, wo.property_name, op.community_name) as property_name,
             COALESCE(p.property_id, op.property_id) as actual_property_id,
             COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
             COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division, op.division) as division,
             COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
             op.total_units, op.blocks as total_blocks,
             COALESCE(c.name, wo.category_name) as category_name, 
             v.company_name as vendor_name,
             COALESCE(cl.name, wo.customer_name) as client_name,
             wo.customer_name, wo.customer_email, wo.customer_phone
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN onboarded_properties op ON wo.property_id = op.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('completed', 'closed')${zoneFilter.clause}
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];

    const [workOrders] = await pool.query(query, params);

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
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate,
            propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone } = req.body;

    const workOrderId = `WO-${Date.now()}`;

    // Fetch property details if not provided - including actual property_id
    let finalPropertyName = propertyName;
    let finalPropertyType = null;
    let actualPropertyId = null;
    if (propertyId) {
      const [props] = await pool.query(
        `SELECT name, property_type, property_id FROM properties WHERE id = ? 
         UNION SELECT community_name as name, property_type, property_id FROM onboarded_properties WHERE id = ?`,
        [propertyId, propertyId]
      );
      if (props.length > 0) {
        finalPropertyName = finalPropertyName || props[0].name;
        finalPropertyType = props[0].property_type;
        actualPropertyId = props[0].property_id;
      }
    }

    // Fetch category details if not provided
    let finalCategoryName = categoryName;
    let finalSubcategoryName = subcategoryName;
    if (categoryId && !categoryName) {
      const [cats] = await pool.query('SELECT name FROM categories WHERE id = ?', [categoryId]);
      if (cats.length > 0) finalCategoryName = cats[0].name;
    }

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, executive_id, franchise_partner_id, status,
        property_name, category_name, subcategory_name, customer_name, customer_email, customer_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, executiveId, franchisePartnerId,
        finalPropertyName || null, finalCategoryName || null, finalSubcategoryName || null,
        customerName || null, customerEmail || null, customerPhone || null]
    );

    // Send email notification for new work order
    const { sendWorkOrderCreatedNotification } = require('../services/emailService');
    sendWorkOrderCreatedNotification({
      orderId: result.insertId,
      orderNumber: workOrderId,
      title: title || `Service Request - ${finalCategoryName || 'General'}`,
      propertyName: finalPropertyName,
      propertyId: actualPropertyId || propertyId,
      propertyType: finalPropertyType,
      customerName,
      customerEmail,
      customerPhone,
      categoryName: finalCategoryName,
      subcategoryName: finalSubcategoryName,
      priority,
      description,
      createdBy: req.user?.username || req.user?.email || 'Executive',
      createdByRole: 'Executive'
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

// Update work order status
router.patch('/work-orders/:id/status', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    await pool.query('UPDATE work_orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);

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
          completedBy: req.user?.username || req.user?.email || 'Executive',
          completedByRole: 'Executive'
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
// CUSTOMERS (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/customers', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildClientZoneOrCreatorFilter(assignedZones, creatorEmail, 'c', 'p');

    const query = `SELECT c.*, p.name as property_name, p.zone_id as zone
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.executive_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})${zoneFilter.clause}
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [executiveId, franchisePartnerId, ...zoneFilter.params] : [executiveId, ...zoneFilter.params];

    const [customers] = await pool.query(query, params);

    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Customers fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
});

// Helper function to create customer account and send activation email
async function createCustomerAccountAndSendEmail(customerData) {
  const { clientId, customerName, customerEmail, customerPhone, propertyId, propertyName } = customerData;
  
  console.log('📧 [CreateCustomerAccount] Starting for email:', customerEmail);
  
  if (!customerEmail) {
    console.log('📧 [CreateCustomerAccount] No email provided, skipping');
    return { success: false, reason: 'no_email' };
  }

  try {
    const emailLower = customerEmail.toLowerCase().trim();
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const activationToken = generateActivationToken();
    const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
    const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;

    console.log('📧 [CreateCustomerAccount] Generated temp password and token');
    console.log('📧 [CreateCustomerAccount] Activation link:', activationLink);

    // Check if customer account already exists
    const [existing] = await pool.query(
      'SELECT id, is_activated FROM customer_accounts WHERE email = ?',
      [emailLower]
    );

    if (existing.length > 0 && existing[0].is_activated) {
      console.log('📧 [CreateCustomerAccount] Account already exists and is activated');
      return { success: false, reason: 'already_activated' };
    }

    if (existing.length > 0) {
      // Update existing inactive account
      console.log('📧 [CreateCustomerAccount] Updating existing inactive account');
      await pool.query(
        `UPDATE customer_accounts 
         SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW()
         WHERE id = ?`,
        [tempPasswordHash, activationToken, activationExpires, existing[0].id]
      );
    } else {
      // Create new customer account
      console.log('📧 [CreateCustomerAccount] Creating new customer account');
      await pool.query(
        `INSERT INTO customer_accounts (
          customer_id, first_name, last_name, email, phone, temp_password_hash, property_id,
          activation_token, activation_expires, is_activated, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, customerName || '', '', emailLower, customerPhone || '',
          tempPasswordHash, propertyId, activationToken, activationExpires, 0, 'executive']
      );
    }

    // Send activation email
    console.log('📧 [CreateCustomerAccount] Sending activation email to:', emailLower);
    const emailResult = await sendCustomerActivationEmail({
      email: emailLower,
      firstName: customerName || 'Customer',
      tempPassword,
      activationLink,
      propertyName: propertyName || 'XLAND INFRA',
      propertyId: propertyId || clientId
    });

    console.log('� [CreateCustomerAccount] Email result:', emailResult);
    return { success: emailResult.success, emailSent: emailResult.success };
  } catch (error) {
    console.error('� [CreateCustomerAccount] Error:', error.message);
    return { success: false, error: error.message };
  }
}

router.post('/customers', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const creatorId = req.user?.username || req.user?.email || 'System';

    console.log('📋 [Executive] Customer creation - executiveId:', executiveId, 'fpId:', franchisePartnerId);

    const {
      // Property form data
      zone, areaName, division, propertyType, communityName,
      associationContacts, numberOfBlocks, unitsPerBlock, blockNames,
      numberOfUnits, villaPlotNumber, blockInfo,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      // Simple customer data
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    // Property form submission (with zone and communityName)
    if (zone && communityName) {
      console.log('📋 [Executive] Property form - community:', communityName, 'zone:', zone);
      
      const prefixMap = { GC: 'GC', APT: 'APT', VILLA: 'V', PLOT: 'PL', FLAT: 'FL' };
      const prefix = prefixMap[entryType] || 'PROP';
      const propertyIdGen = `${prefix}-${Date.now()}`;
      const clientId = `CLT-${Date.now()}`;
      
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      console.log('📋 [Executive] Contact info - name:', contactName, 'email:', contactEmail);

      // Create property
      const [propertyResult] = await pool.query(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          executive_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          executiveId, franchisePartnerId, creatorId, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || ''
        ]
      );

      // Create client record
      await pool.execute(
        `INSERT INTO clients (client_id, name, email, phone, address, city, state, zip_code, 
          property_id, executive_id, franchise_partner_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [clientId, contactName || communityName, contactEmail || '', `${contactCountryCode}${contactPhone || ''}`,
         address || '', city || '', state || '', postalCode || '',
         propertyResult.insertId, executiveId, franchisePartnerId, creatorId]
      );

      // Create customer account and send activation email
      const emailResult = await createCustomerAccountAndSendEmail({
        clientId,
        customerName: contactName,
        customerEmail: contactEmail,
        customerPhone: `${contactCountryCode}${contactPhone}`,
        propertyId: propertyResult.insertId,
        propertyName: communityName
      });

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully' + (emailResult.emailSent ? ', activation email sent' : ''),
        data: { propertyId: propertyIdGen, clientId, emailSent: emailResult.emailSent || false }
      });

    } else {
      // Simple customer form
      console.log('� [Executive] Simple customer form - name:', name, 'email:', email);
      
      const clientId = `CLT-${Date.now()}`;
      const [result] = await pool.query(
        `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
          zip_code, client_type, company_name, property_id, gst_number, executive_id, franchise_partner_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber, executiveId, franchisePartnerId, creatorId]
      );

      // Create customer account and send activation email
      const emailResult = await createCustomerAccountAndSendEmail({
        clientId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        propertyId: null,
        propertyName: companyName || 'XLAND INFRA'
      });

      res.json({
        success: true,
        message: 'Customer created' + (emailResult.emailSent ? ', activation email sent' : ''),
        data: { id: result.insertId, clientId, emailSent: emailResult.emailSent || false }
      });
    }
  } catch (error) {
    console.error('📋 [Executive] Customer create error:', error);
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

// Delete customer - DISABLED for Executive role
router.delete('/customers/:id', requireExecutiveScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// =====================================================
// VENDORS (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/vendors', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // If FP employee, get zone-centric + own created vendors
    if (franchisePartnerId) {
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
      
      const [vendors] = await pool.execute(query, [franchisePartnerId, ...zoneParams]);

      return res.json({
        success: true,
        data: {
          own: vendors,
          assigned: [],
          all: vendors
        }
      });
    }

    // Standalone executive - get own and assigned vendors
    const [ownVendors] = await pool.query(
      `SELECT v.*, 'own' as vendor_type, TRUE as can_modify, FALSE as can_delete
       FROM onboarded_vendors v
       WHERE v.executive_id = ?`,
      [executiveId]
    );

    const [assignedVendors] = await pool.query(
      `SELECT v.*, 'assigned' as vendor_type, eav.can_modify, eav.can_delete
       FROM onboarded_vendors v
       INNER JOIN executive_assigned_vendors eav ON v.id = eav.vendor_id
       WHERE eav.executive_id = ? AND eav.is_active = 1`,
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

    const vendorId = `VND-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO onboarded_vendors (vendor_id, company_name, contact_person, owner_name, email, owner_email, 
        phone, owner_mobile, alternate_phone, address, city, state, zip_code, gst_number, pan_number, 
        executive_id, franchise_partner_id, service_type, is_active, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'General', TRUE, 'active')`,
      [vendorId, companyName, contactPerson || companyName, companyName, email, email, phone, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, executiveId, franchisePartnerId]
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

router.put('/vendors/:id', requireExecutiveScope, validateOwnership('onboarded_vendors', 'id', true), async (req, res) => {
  try {
    if (!req.canModify) {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify this vendor' });
    }

    const { id } = req.params;
    const { companyName, contactPerson, email, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber } = req.body;

    await pool.query(
      `UPDATE onboarded_vendors SET company_name = ?, contact_person = ?, owner_name = ?, email = ?, owner_email = ?, 
        phone = ?, owner_mobile = ?, alternate_phone = ?, address = ?, city = ?, state = ?, zip_code = ?, gst_number = ?, pan_number = ?
       WHERE id = ?`,
      [companyName, contactPerson || companyName, companyName, email, email, phone, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, id]
    );

    res.json({ success: true, message: 'Vendor updated successfully' });
  } catch (error) {
    console.error('Vendor update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vendor' });
  }
});

// Delete vendor - DISABLED for Executive role
router.delete('/vendors/:id', requireExecutiveScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// Get vendor assignments for executive (ZONE-CENTRIC)
router.get('/vendors/assignments', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId);
    
    // Build zone filter for vendor's zone
    let zoneClause = '';
    let zoneParams = [];
    if (assignedZones.length > 0) {
      const placeholders = assignedZones.map(() => '?').join(',');
      zoneClause = ` AND v.zone IN (${placeholders})`;
      zoneParams = assignedZones;
    }
    
    // Get property-vendor assignments with full vendor details
    const [propertyAssignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        COALESCE(p.name, op.community_name) as property_name, 
        COALESCE(p.property_id, op.property_id) as propertyId, 
        COALESCE(p.property_type, op.property_type) as property_type, 
        COALESCE(p.address, op.address) as address, 
        COALESCE(p.city, op.city) as city,
        v.owner_name as vendor_name, v.vendor_id as vendor_code, v.service_type,
        v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
        v.zone as zone_name, v.area_name as area, v.rate_per_visit, v.coverage_per_day
       FROM property_vendor_assignments pva
       LEFT JOIN properties p ON pva.property_id = p.id
       LEFT JOIN onboarded_properties op ON pva.property_id = op.id
       JOIN onboarded_vendors v ON pva.vendor_id = v.id
       WHERE (p.executive_id = ? OR op.executive_id = ?) AND pva.is_active = 1${zoneClause}
       ORDER BY pva.assigned_at DESC`,
      [executiveId, executiveId, ...zoneParams]
    );

    const serviceAssignments = propertyAssignments.map(a => ({
      id: a.id,
      propertyId: a.propertyId || a.property_id,
      propertyName: a.property_name,
      propertyType: a.property_type,
      city: a.city || '',
      address: a.address || '',
      vendorId: a.vendor_code,
      vendorName: a.vendor_name,
      vendorPhone: a.vendor_phone,
      vendorEmail: a.vendor_email,
      serviceType: a.service_type,
      zone_name: a.zone_name,
      area: a.area,
      rate_per_visit: a.rate_per_visit,
      coverage_per_day: a.coverage_per_day,
      assignedDate: a.assigned_at,
      status: a.is_active ? 'active' : 'removed'
    }));

    res.json({
      success: true,
      data: { propertyAssignments, serviceAssignments }
    });
  } catch (error) {
    console.error('Executive vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

// =====================================================
// EMPLOYEES
// =====================================================
router.get('/employees', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;

    const [employees] = await pool.query(
      `SELECT fpe.*, GROUP_CONCAT(z.name) as zone_names
       FROM fp_employees fpe
       LEFT JOIN fp_employee_zones fez ON fpe.id = fez.fp_employee_id
       LEFT JOIN zones z ON fez.zone_id = z.id
       WHERE fpe.franchise_partner_id = ?
       GROUP BY fpe.id
       ORDER BY fpe.created_at DESC`,
      [req.franchisePartnerId]
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
      `SELECT fpe.*, GROUP_CONCAT(z.id) as zone_ids, GROUP_CONCAT(z.name) as zone_names
       FROM fp_employees fpe
       LEFT JOIN fp_employee_zones fez ON fpe.id = fez.fp_employee_id
       LEFT JOIN zones z ON fez.zone_id = z.id
       WHERE fpe.id = ? AND fpe.franchise_partner_id = ?
       GROUP BY fpe.id`,
      [id, req.franchisePartnerId]
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
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role. Use FP Portal.' });
});

router.put('/employees/:id', requireExecutiveScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role. Use FP Portal.' });
});

router.delete('/employees/:id', requireExecutiveScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role. Use FP Portal.' });
});

// =====================================================
// ESTIMATES - Executive sees zone-centric + own created estimates
// =====================================================
router.get('/estimates', requireExecutiveScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    let estimates = [];
    
    // If executive is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      // Get assigned zones
      const assignedZones = await getAssignedZones(employeeId);
      
      // Build zone + creator filter - match by created_by_id OR created_by_name (name, email, or username)
      let zoneClause = '';
      let zoneParams = [];
      if (assignedZones.length > 0) {
        const placeholders = assignedZones.map(() => '?').join(',');
        zoneClause = ` AND (e.zone IN (${placeholders}) OR e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [...assignedZones, executiveId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
      } else {
        // No zones = only see own created (by ID or by name/email/username)
        zoneClause = ` AND (e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [executiveId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
      }
      
      const [fpEstimates] = await pool.query(
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
        const [addonResults] = await pool.query(
          `SELECT id, service_name, description FROM fp_addons WHERE franchise_partner_id = ?`,
          [franchisePartnerId]
        );
        fpAddons = addonResults;
      } catch (e) {}

      // Enrich estimates with property_code and parse addons
      estimates = await Promise.all(fpEstimates.map(async (est) => {
        let addons = [];
        if (est.addons_data) {
          try { 
            addons = JSON.parse(est.addons_data);
            // Enrich addons with descriptions
            addons = addons.map(addon => {
              if (!addon.description) {
                const foundAddon = fpAddons.find(a => a.id == addon.id || a.service_name === (addon.name || addon.service_name));
                if (foundAddon) addon.description = foundAddon.description || '';
              }
              return addon;
            });
          } catch(e) {}
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

router.post('/estimates', requireExecutiveScope, async (req, res) => {
  try {
    const executiveId = req.executiveId;
    const franchisePartnerId = req.franchisePartnerId;
    const { 
      estimate_type, property_id, property_code, client_name, client_phone, client_email,
      property_name, property_type, zone, city, address, package_id, package_name, package_price,
      amc_package_description, package_services,
      addons, subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
      description
    } = req.body;

    const estimateId = `EST-${Date.now()}`;
    
    // property_id column is INT, so pass null and use property_code for string ID
    const numericPropertyId = parseInt(property_id);
    const propertyIdValue = isNaN(numericPropertyId) ? null : numericPropertyId;

    // Get creator name - check fp_employees first, then users table
    let creatorName = 'Executive';
    try {
      // Try fp_employees table first (for FP-created employees)
      const [[fpEmp]] = await pool.query(
        'SELECT first_name, last_name FROM fp_employees WHERE id = ? OR user_id = ?',
        [executiveId, executiveId]
      );
      if (fpEmp && (fpEmp.first_name || fpEmp.last_name)) {
        creatorName = `${fpEmp.first_name || ''} ${fpEmp.last_name || ''}`.trim() || 'Executive';
      } else {
        // Fall back to users table
        const [[userInfo]] = await pool.query('SELECT first_name, last_name, name FROM users WHERE id = ?', [executiveId]);
        if (userInfo) creatorName = userInfo.first_name && userInfo.last_name ? `${userInfo.first_name} ${userInfo.last_name}`.trim() : userInfo.name || 'Executive';
      }
    } catch (e) { console.log('Creator name lookup error:', e.message); }

    // Add new columns if they don't exist
    try {
      await pool.query(`ALTER TABLE fp_estimates ADD COLUMN amc_package_description TEXT`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.query(`ALTER TABLE fp_estimates ADD COLUMN package_services TEXT`);
    } catch (e) { /* Column exists */ }

    // Use fp_estimates table (has all required columns)
    const [result] = await pool.query(
      `INSERT INTO fp_estimates (
        estimate_id, franchise_partner_id, property_id, estimate_type,
        client_name, client_phone, client_email, property_name, property_code, property_type,
        zone, city, address, package_id, package_name, package_price, amc_package_description, package_services,
        subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
        addons_data, description, created_by_id, created_by_name, created_by_role, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW())`,
      [
        estimateId, franchisePartnerId || 1, propertyIdValue, estimate_type || 'property_based',
        client_name || '', client_phone || '', client_email || '',
        property_name || '', property_code || property_id || '', property_type || '',
        zone || '', city || '', address || '',
        package_id || null, package_name || '', package_price || 0, amc_package_description || '', package_services ? JSON.stringify(package_services) : null,
        subtotal || 0, discount_percent || 0, discount_amount || 0,
        gst_percent || 0, gst_amount || 0, total_amount || 0,
        JSON.stringify(addons || []), description || '', executiveId, creatorName, 'executive'
      ]
    );

    res.json({
      success: true,
      message: 'Estimate created successfully',
      data: { id: result.insertId, estimateId }
    });
  } catch (error) {
    console.error('Estimate create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create estimate: ' + error.message });
  }
});

// Archive estimate
router.put('/estimates/:id/archive', requireExecutiveScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    if (franchisePartnerId) {
      await pool.query(
        `UPDATE fp_estimates SET is_archived = 1, archived_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
        [req.params.id, franchisePartnerId]
      );
    }
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    console.error('Archive estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore estimate
router.put('/estimates/:id/restore', requireExecutiveScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    if (franchisePartnerId) {
      await pool.query(
        `UPDATE fp_estimates SET is_archived = 0, archived_at = NULL WHERE id = ? AND franchise_partner_id = ?`,
        [req.params.id, franchisePartnerId]
      );
    }
    res.json({ success: true, message: 'Estimate restored' });
  } catch (error) {
    console.error('Restore estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =====================================================
// AMC PACKAGES - FP Executives use FP packages
// =====================================================

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

router.get('/amc-packages', requireExecutiveScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // FP Executives read from fp_amc_packages
    if (franchisePartnerId) {
      const [packages] = await pool.query(
        `SELECT * FROM fp_amc_packages WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
        [franchisePartnerId]
      );
      return res.json({ success: true, data: packages.map(transformPackage) });
    }
    
    res.json({ success: true, data: [] });
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
// ADD-ONS - FP Executives use FP addons
// =====================================================

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

router.get('/addons', requireExecutiveScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // FP Executives read from fp_addons
    if (franchisePartnerId) {
      const [addons] = await pool.query(
        `SELECT * FROM fp_addons WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
        [franchisePartnerId]
      );
      return res.json({ success: true, data: addons.map(transformAddon) });
    }
    
    res.json({ success: true, data: [] });
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
    // Get global zones
    const [globalZones] = await pool.query('SELECT id, name FROM zones WHERE is_active = 1');
    
    // Get zones from executive's properties (including FP properties)
    const scopeColumn = req.franchisePartnerId ? 'franchise_partner_id' : 'executive_id';
    const scopeId = req.franchisePartnerId || req.executiveId;
    const [propertyZones] = await pool.query(
      `SELECT DISTINCT zone_id as name FROM properties 
       WHERE ${scopeColumn} = ? AND zone_id IS NOT NULL AND zone_id != ''`,
      [scopeId]
    );

    // Get FP zones (from FP or executive-created)
    let fpZones = [];
    try {
      const [fz] = await pool.query(
        `SELECT id, name FROM fp_zones WHERE 
         (franchise_partner_id = ? OR executive_id = ?) AND is_active = 1`,
        [req.franchisePartnerId || 0, req.executiveId]
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
router.post('/zones', requireExecutiveScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    const franchisePartnerId = req.franchisePartnerId || null;
    const executiveId = req.executiveId;
    
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND (franchise_partner_id = ? OR executive_id = ?)',
      [name, franchisePartnerId, executiveId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, executive_id, created_by, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, franchisePartnerId, executiveId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone
router.delete('/zones/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND (franchise_partner_id = ? OR executive_id = ?)',
      [id, req.franchisePartnerId || 0, req.executiveId]
    );
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =====================================================
// DIVISIONS - FP-specific divisions shared across employees
// =====================================================
router.get('/divisions', requireExecutiveScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    let divisions = [];
    if (franchisePartnerId) {
      const [fpDivisions] = await pool.execute(
        'SELECT id, name FROM fp_divisions WHERE franchise_partner_id = ? AND is_active = 1 ORDER BY name',
        [franchisePartnerId]
      );
      divisions = fpDivisions;
    }
    const [propertyDivisions] = await pool.execute(
      `SELECT DISTINCT division as name FROM properties WHERE franchise_partner_id = ? AND division IS NOT NULL AND division != ''
       UNION SELECT DISTINCT division as name FROM onboarded_vendors WHERE franchise_partner_id = ? AND division IS NOT NULL AND division != ''`,
      [franchisePartnerId || 0, franchisePartnerId || 0]
    );
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

router.post('/divisions', requireExecutiveScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Division name is required' });
    const franchisePartnerId = req.franchisePartnerId;
    if (!franchisePartnerId) return res.status(400).json({ success: false, message: 'FP context required' });
    const [existing] = await pool.execute('SELECT id FROM fp_divisions WHERE name = ? AND franchise_partner_id = ?', [name, franchisePartnerId]);
    if (existing.length > 0) return res.status(400).json({ success: false, message: 'Division already exists' });
    const [result] = await pool.execute(
      'INSERT INTO fp_divisions (name, franchise_partner_id, created_by, is_active) VALUES (?, ?, ?, 1)',
      [name, franchisePartnerId, req.user?.email || req.user?.username || '']
    );
    res.json({ success: true, message: 'Division created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/divisions/:id', requireExecutiveScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE fp_divisions SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?', [id, req.franchisePartnerId]);
    res.json({ success: true, message: 'Division deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', requireExecutiveScope, async (req, res) => {
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
      `SELECT * FROM onboarded_vendors WHERE executive_id = ?`,
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
    const [employees] = await pool.query(
      `SELECT fpe.*, GROUP_CONCAT(z.name) as zone_names
       FROM fp_employees fpe
       LEFT JOIN fp_employee_zones fez ON fpe.id = fez.fp_employee_id
       LEFT JOIN zones z ON fez.zone_id = z.id
       WHERE fpe.franchise_partner_id = ?
       GROUP BY fpe.id`,
      [req.franchisePartnerId]
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
      `SELECT wo.*, p.name as property_name, c.name as category_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       WHERE wo.executive_id = ?`,
      [executiveId]
    );

    res.json({ success: true, data: workOrders, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// View FP employee zone assignments (READ-ONLY for executives under FP)
router.get('/fp-employee-zones', requireExecutiveScope, async (req, res) => {
  try {
    if (!req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP employees' });
    }

    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active,
              GROUP_CONCAT(DISTINCT z.name ORDER BY z.name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       LEFT JOIN zones z ON ez.zone_id = z.id
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      [req.franchisePartnerId, req.franchisePartnerId]
    );

    const [zones] = await pool.execute(
      `SELECT DISTINCT z.name FROM fp_employee_zones ez 
       JOIN zones z ON ez.zone_id = z.id
       WHERE ez.franchise_partner_id = ? ORDER BY z.name`,
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

// =====================================================
// FP PORTAL LINKS (Read-only for employees)
// =====================================================
router.get('/fp-portal-links', requireExecutiveScope, async (req, res) => {
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
