/**
 * Supervisor Portal API Routes
 * All routes are scoped to the logged-in supervisor's data
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
  attachSupervisorScope,
  requireSupervisorScope,
  validateOwnership,
  buildScopedQuery,
  getSupervisorPermissions,
  canViewPricing,
  filterPricing
} = require('../middleware/supervisorScope');
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
      
      // If franchise_partner_id is null, check fp_employees table
      if (!franchisePartnerId) {
        const [fpCheck] = await pool.query(
          `SELECT franchise_partner_id FROM fp_employees WHERE (email = ? OR username = ?) AND is_active = 1`,
          [user.email, user.username]
        );
        if (fpCheck.length > 0 && fpCheck[0].franchise_partner_id) {
          franchisePartnerId = fpCheck[0].franchise_partner_id;
        }
      }
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

        // If no linked user but fp_employee has password
        if (!user && (fpSup.password_hash || fpSup.password)) {
          user = {
            id: fpSup.user_id || fpSup.id,
            username: fpSup.username,
            email: fpSup.email,
            password_hash: fpSup.password_hash || fpSup.password,
            first_name: fpSup.first_name,
            last_name: fpSup.last_name,
            role: 'supervisor',
            is_active: fpSup.is_active !== false && fpSup.is_active !== 0
          };
          userSource = 'fp_employees_direct';
          franchisePartnerId = fpSup.franchise_partner_id;
          console.log('[Supervisor Login] Using fp_employees direct, FP:', franchisePartnerId);
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
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId);
    
    console.log('[Supervisor Dashboard] supervisorId:', supervisorId, 'fpId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);

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
       WHERE (p.franchise_partner_id = ? AND (p.status IS NULL OR p.status != 'deleted') AND (p.created_by = ? OR p.created_by = ? OR p.supervisor_id = ?${zoneCondition}))`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId, ...zoneParams]
    );
    
    // Build zone filter for onboarded_properties
    let onbZoneCondition = '';
    let onbZoneParams = [];
    if (assignedZones.length > 0) {
      const zonePlaceholders = assignedZones.map(() => '?').join(',');
      onbZoneCondition = ` OR op.zone IN (${zonePlaceholders})`;
      onbZoneParams = [...assignedZones];
    }

    // Count onboarded_properties (zone-centric + own created)
    const [onboardedPropsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM onboarded_properties op
       WHERE (op.franchise_partner_id = ? AND (op.created_by = ? OR op.created_by = ? OR op.supervisor_id = ?${onbZoneCondition}))`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId, ...onbZoneParams]
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
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR supervisor_id = ?)`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId]
    );

    // Employees under this FP
    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    // Work orders - own created
    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR supervisor_id = ?)`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR supervisor_id = ?)
       AND status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR supervisor_id = ?)
       AND status IN ('completed', 'closed')`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId]
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
       WHERE wo.franchise_partner_id = ? AND (wo.created_by = ? OR wo.created_by = ? OR wo.supervisor_id = ?)
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', supervisorId]
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
// PROPERTIES (ZONE-CENTRIC)
// =====================================================
router.get('/properties', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    
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
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const creatorEmail = getCreatorIdentifier(req);
    const zoneFilter = buildPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'p');
    
    console.log('[Supervisor Properties] supervisorId:', supervisorId, 'franchisePartnerId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);

    // Get own, assigned, and FP properties with creator name (zone-centric + own created)
    const query = `SELECT p.*, 
              COALESCE(z.name, zn.name, p.zone_id) as zone_name, 
              COALESCE(p.area_name, p.city) as area,
              COALESCE(fd.name, p.division_id) as division_name,
              p.division_id as division,
              COALESCE(p.number_of_units, 1) as units,
              COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
              'own' as access_type, TRUE as can_modify, TRUE as can_delete,
              TRUE as can_assign_vendor, TRUE as can_assign_employee,
              'properties' as source_table
       FROM properties p
       LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
       LEFT JOIN zones zn ON p.zone_id = zn.name
       LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = p.franchise_partner_id
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.username OR p.created_by = u.user_id OR CAST(p.created_by AS CHAR) = CAST(u.id AS CHAR)
       WHERE (p.supervisor_id = ?${franchisePartnerId ? ' OR p.franchise_partner_id = ?' : ''}) AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
       UNION
       SELECT p.*,
              COALESCE(z.name, zn.name, p.zone_id) as zone_name,
              COALESCE(p.area_name, p.city) as area,
              COALESCE(fd.name, p.division_id) as division_name,
              p.division_id as division,
              COALESCE(p.number_of_units, 1) as units,
              COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
              'assigned' as access_type, sap.can_modify, sap.can_delete,
              sap.can_assign_vendor, sap.can_assign_employee,
              'properties' as source_table
       FROM properties p
       INNER JOIN supervisor_assigned_properties sap ON p.id = sap.property_id
       LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
       LEFT JOIN zones zn ON p.zone_id = zn.name
       LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = p.franchise_partner_id
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.username OR p.created_by = u.user_id OR CAST(p.created_by AS CHAR) = CAST(u.id AS CHAR)
       WHERE sap.supervisor_id = ? AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
       ORDER BY created_at DESC`;
    const params = franchisePartnerId 
      ? [supervisorId, franchisePartnerId, ...zoneFilter.params, supervisorId, ...zoneFilter.params] 
      : [supervisorId, ...zoneFilter.params, supervisorId, ...zoneFilter.params];
    const [regularProperties] = await pool.query(query, params);

    // Also fetch from onboarded_properties with creator name (zone-centric + own created)
    let onboardedProperties = [];
    try {
      const onbZoneFilter = buildOnboardedPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'op');
      const scopeColumn = franchisePartnerId ? 'franchise_partner_id' : 'supervisor_id';
      const scopeId = franchisePartnerId || supervisorId;
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type,
                op.zone as zone_name, op.area_name as area, 
                COALESCE(fd.name, op.division) as division, COALESCE(fd.name, op.division) as division_name,
                COALESCE(op.total_units, 1) as units,
                op.address, op.city, op.state, op.postal_code as zip_code,
                NULL as contact_person, NULL as contact_phone, NULL as email,
                COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                op.created_at, op.status,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN fp_divisions fd ON (CAST(op.division AS UNSIGNED) = fd.id OR op.division = fd.name) AND fd.franchise_partner_id = op.franchise_partner_id
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

router.post('/properties', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;

    const propertyId = `PROP-${Date.now()}`;
    
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

router.put('/properties/:id', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sourceTable = updates.sourceTable || updates.source_table;

    // Check which table the property belongs to
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

// Delete property - DISABLED for Supervisor role
router.delete('/properties/:id', requireSupervisorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
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
// WORK ORDERS (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/work-orders', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const { status } = req.query;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');

    // FP employees see FP work orders, standalone supervisors see their created work orders
    let query = `
      SELECT wo.*, 
        COALESCE(p.name, wo.property_name, op.community_name) as property_name,
        COALESCE(p.property_id, op.property_id) as actual_property_id,
        COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
        COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
        COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
        op.total_units, op.number_of_blocks as total_blocks,
        c.name as category_name, v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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

router.get('/work-orders/pending', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
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
        COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
        COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
        op.total_units, op.number_of_blocks as total_blocks,
        c.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN onboarded_properties op ON wo.property_id = op.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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

router.get('/work-orders/completed', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
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
        COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
        COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
        op.total_units, op.number_of_blocks as total_blocks,
        c.name as category_name, v.company_name as vendor_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN onboarded_properties op ON wo.property_id = op.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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

router.post('/work-orders', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    console.log('[Supervisor WO Create] SupervisorID:', supervisorId, 'FP:', franchisePartnerId);
    const { propertyId, categoryId, subcategoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate,
            propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone } = req.body;

    const workOrderId = `WO-${Date.now()}`;

    // Fetch property details if not provided - including actual property_id and zone
    let finalPropertyName = propertyName;
    let finalPropertyType = null;
    let actualPropertyId = null;
    let propertyZone = null;
    if (propertyId) {
      const [props] = await pool.query(
        `SELECT name, property_type, property_id, zone_id as zone FROM properties WHERE id = ? 
         UNION SELECT community_name as name, property_type, property_id, zone FROM onboarded_properties WHERE id = ?`,
        [propertyId, propertyId]
      );
      if (props.length > 0) {
        finalPropertyName = finalPropertyName || props[0].name;
        finalPropertyType = props[0].property_type;
        actualPropertyId = props[0].property_id;
        propertyZone = props[0].zone;
      }
    }

    // Fetch category and subcategory details from config
    let finalCategoryName = categoryName;
    let finalSubcategoryName = subcategoryName;
    if (categoryId) {
      try {
        const categoriesConfig = require('../config/categories');
        const category = categoriesConfig.find(c => c.id === parseInt(categoryId) || c.id === categoryId);
        if (category) {
          if (!finalCategoryName) finalCategoryName = category.name;
          if (!finalSubcategoryName && subcategoryId && category.subcategories) {
            const subcat = category.subcategories.find(s => s.id === parseInt(subcategoryId) || s.id === subcategoryId);
            if (subcat) finalSubcategoryName = subcat.name;
          }
        }
      } catch (e) { console.log('Category lookup error:', e.message); }
    }

    // Get creator identifier for zone-centric filtering
    const createdBy = req.user?.email || req.user?.username || `supervisor-${supervisorId}`;

    const [result] = await pool.query(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, franchise_partner_id, status,
        property_name, category_name, subcategory_name, customer_name, customer_email, customer_phone, zone, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
        priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null, franchisePartnerId,
        finalPropertyName || null, finalCategoryName || null, finalSubcategoryName || null,
        customerName || null, customerEmail || null, customerPhone || null, propertyZone, createdBy]
    );

    // Send email notification for new work order
    // Sends to: FP email + zone-centric employees + customer
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
      createdBy: req.user?.username || req.user?.email || 'Supervisor',
      createdByRole: 'Supervisor',
      franchisePartnerId: franchisePartnerId,
      propertyZone: propertyZone
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
    const allowedStatuses = ['pending', 'under_review', 'assigned', 'in_progress', 'completed', 'cancelled', 'closed'];
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
// CUSTOMERS (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/customers', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId);
    const zoneFilter = buildClientZoneOrCreatorFilter(assignedZones, creatorEmail, 'c', 'p');

    const query = `SELECT c.*, p.name as property_name, p.zone_id as zone
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.supervisor_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})${zoneFilter.clause}
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [supervisorId, franchisePartnerId, ...zoneFilter.params] : [supervisorId, ...zoneFilter.params];

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
      const prefixMap = { GC: 'GC', APT: 'APT', VILLA: 'V', PLOT: 'PL', FLAT: 'FL' };
      const prefix = prefixMap[entryType] || 'PROP';
      const propertyIdGen = `${prefix}-${Date.now()}`;
      const clientId = `CLT-${Date.now()}`;
      
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
          supervisorId, franchisePartnerId, req.user?.username || req.user?.email || req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || ''
        ]
      );

      // Also create a record in clients table for Property Management listing
      await pool.execute(
        `INSERT INTO clients (client_id, name, email, phone, address, city, state, zip_code, 
          property_id, supervisor_id, franchise_partner_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [clientId, contactName || communityName, contactEmail || '', `${contactCountryCode}${contactPhone || ''}`,
         address || '', city || '', state || '', postalCode || '',
         propertyResult.insertId, supervisorId, franchisePartnerId, req.user?.username || req.user?.email || '']
      );

      let customerResult = null;
      let emailSent = false;
      if (contactEmail) {
        const tempPassword = generateTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const [existing] = await pool.query('SELECT id, is_activated FROM customer_accounts WHERE email = ?', [contactEmail.toLowerCase()]);
        
        if (existing.length === 0) {
          [customerResult] = await pool.query(
            `INSERT INTO customer_accounts (
              customer_id, first_name, last_name, email, phone, temp_password_hash, property_id,
              activation_token, activation_expires, is_activated, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, contactName, '', contactEmail.toLowerCase(), `${contactCountryCode}${contactPhone}`,
              tempPasswordHash, propertyResult.insertId, activationToken, activationExpires, 0, 'supervisor']
          );
          
          // Send activation email
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          const emailResult = await sendCustomerActivationEmail({
            email: contactEmail.toLowerCase(),
            firstName: contactName,
            tempPassword,
            activationLink,
            propertyName: communityName,
            propertyId: propertyIdGen
          });
          emailSent = emailResult.success;
        } else if (!existing[0].is_activated) {
          // Resend activation email for inactive account
          await pool.query(
            `UPDATE customer_accounts 
             SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW()
             WHERE id = ?`,
            [tempPasswordHash, activationToken, activationExpires, existing[0].id]
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          const emailResult = await sendCustomerActivationEmail({
            email: contactEmail.toLowerCase(),
            firstName: contactName,
            tempPassword,
            activationLink,
            propertyName: communityName,
            propertyId: propertyIdGen
          });
          emailSent = emailResult.success;
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully' + (emailSent ? ', activation email sent' : ''),
        data: { propertyId: propertyIdGen, clientId, customerId: customerResult?.insertId || null, emailSent }
      });
    } else {
      const clientId = `CLT-${Date.now()}`;
      const [result] = await pool.query(
        `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
          zip_code, client_type, company_name, property_id, gst_number, supervisor_id, franchise_partner_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber, supervisorId, franchisePartnerId,
          req.user?.username || req.user?.email || '']
      );

      // Create customer account and send activation email if email provided
      let emailSent = false;
      if (email) {
        const tempPassword = generateTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const [existing] = await pool.query(
          'SELECT id, is_activated FROM customer_accounts WHERE email = ?', [email.toLowerCase()]
        );
        
        if (existing.length === 0) {
          await pool.query(
            `INSERT INTO customer_accounts (customer_id, first_name, last_name, email, phone, temp_password_hash,
              activation_token, activation_expires, is_activated, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, name, '', email.toLowerCase(), phone || '', tempPasswordHash, activationToken, activationExpires, 0, 'supervisor']
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Sending activation email (supervisor simple create) to:', email.toLowerCase());
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: email.toLowerCase(), firstName: name, tempPassword, activationLink, propertyName: companyName || 'XLAND INFRA', propertyId: propertyId || clientId
            });
            emailSent = emailResult.success;
          } catch (emailError) {
            console.error('📧 Email sending failed:', emailError);
          }
        } else if (!existing[0].is_activated) {
          await pool.query(
            `UPDATE customer_accounts SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW() WHERE id = ?`,
            [tempPasswordHash, activationToken, activationExpires, existing[0].id]
          );
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: email.toLowerCase(), firstName: name, tempPassword, activationLink, propertyName: companyName || 'XLAND INFRA', propertyId: propertyId || clientId
            });
            emailSent = emailResult.success;
          } catch (emailError) {
            console.error('📧 Email resend failed:', emailError);
          }
        }
      }

      res.json({ success: true, message: 'Customer created' + (emailSent ? ', activation email sent' : ''), data: { id: result.insertId, clientId, emailSent } });
    }
  } catch (error) {
    console.error('Customer create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
});

// =====================================================
// VENDORS (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/vendors', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get FP ID from multiple sources (same as properties route)
    let franchisePartnerId = req.franchisePartnerId || req.fpId || req.user?.franchisePartnerId || req.user?.fpId;
    
    // If still no fpId, try to get it from fp_employees table
    if (!franchisePartnerId && (req.user?.id || supervisorId)) {
      try {
        const [fpEmp] = await pool.execute(
          'SELECT franchise_partner_id FROM fp_employees WHERE id = ? OR user_id = ?',
          [req.user?.id || supervisorId, req.user?.id || supervisorId]
        );
        if (fpEmp.length > 0) {
          franchisePartnerId = fpEmp[0].franchise_partner_id;
        }
      } catch (e) { /* ignore */ }
    }
    
    console.log('[Supervisor Vendors] supervisorId:', supervisorId, 'franchisePartnerId:', franchisePartnerId, 'creatorEmail:', creatorEmail);

    // For FP employees, show zone-centric + own created vendors
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

      const vendorQuery = `
        SELECT ov.id, ov.vendor_id, ov.service_type, ov.service_verified,
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
               'fp' as vendor_type, FALSE as can_modify, FALSE as can_delete
        FROM onboarded_vendors ov
        LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id OR ov.created_by = fpe.email OR ov.created_by = fpe.username
        WHERE ov.franchise_partner_id = ?${zoneClause}
        ORDER BY ov.created_at DESC
      `;

      const [allVendors] = await pool.query(vendorQuery, [franchisePartnerId, ...zoneParams]);

      return res.json({
        success: true,
        data: {
          own: allVendors,
          assigned: [],
          all: allVendors
        }
      });
    }

    // For standalone supervisors - original logic
    const [ownVendors] = await pool.query(
      `SELECT v.*, COALESCE(v.company_name, v.owner_name) as company_name, 
              COALESCE(v.contact_person, v.owner_name) as contact_person,
              COALESCE(v.phone, v.owner_mobile) as phone,
              COALESCE(v.email, v.owner_email) as email,
              'own' as vendor_type, TRUE as can_modify, TRUE as can_delete
       FROM onboarded_vendors v
       WHERE v.supervisor_id = ?`,
      [supervisorId]
    );

    const [assignedVendors] = await pool.query(
      `SELECT v.*, COALESCE(v.company_name, v.owner_name) as company_name,
              COALESCE(v.contact_person, v.owner_name) as contact_person,
              COALESCE(v.phone, v.owner_mobile) as phone,
              COALESCE(v.email, v.owner_email) as email,
              'assigned' as vendor_type, sav.can_modify, sav.can_delete
       FROM onboarded_vendors v
       INNER JOIN supervisor_assigned_vendors sav ON v.id = sav.vendor_id
       WHERE sav.supervisor_id = ? AND sav.is_active = 1`,
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

    const vendorId = `VND-${Date.now()}`;

    const [result] = await pool.query(
      `INSERT INTO onboarded_vendors (vendor_id, company_name, contact_person, owner_name, email, owner_email, phone, owner_mobile, alternate_phone, 
        address, city, state, zip_code, gst_number, pan_number, supervisor_id, franchise_partner_id, service_type, is_active, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'General', TRUE, 'active')`,
      [vendorId, companyName, contactPerson || companyName, companyName, email, email, phone, phone, alternatePhone, address, city, state, zipCode, gstNumber, panNumber, supervisorId, franchisePartnerId]
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

router.put('/vendors/:id', requireSupervisorScope, validateOwnership('onboarded_vendors', 'id', true), async (req, res) => {
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

// Delete vendor - DISABLED for Supervisor role
router.delete('/vendors/:id', requireSupervisorScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// Get vendor assignments for supervisor (ZONE-CENTRIC)
router.get('/vendors/assignments', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
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
       WHERE (p.supervisor_id = ? OR op.supervisor_id = ?) AND pva.is_active = 1${zoneClause}
       ORDER BY pva.assigned_at DESC`,
      [supervisorId, supervisorId, ...zoneParams]
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
    console.error('Supervisor vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
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

    // Generate sequential employee code (EMP-001, EMP-002, EMP-003...)
    const [maxEmpCode] = await pool.query(
      `SELECT COUNT(*) as count FROM supervisor_employees WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );
    const nextSeq = (maxEmpCode[0].count || 0) + 1;
    const employeeCode = `EMP-${String(nextSeq).padStart(3, '0')}`;

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
// ESTIMATES - Supervisor sees zone-centric + own created estimates
// =====================================================
router.get('/estimates', requireSupervisorScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    let estimates = [];
    
    // If supervisor is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      // Get assigned zones
      const assignedZones = await getAssignedZones(employeeId);
      
      // Build zone + creator filter - match by created_by_id OR created_by_name (name, email, or username)
      let zoneClause = '';
      let zoneParams = [];
      if (assignedZones.length > 0) {
        const placeholders = assignedZones.map(() => '?').join(',');
        zoneClause = ` AND (e.zone IN (${placeholders}) OR e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [...assignedZones, supervisorId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
      } else {
        // No zones = only see own created (by ID or by name/email/username)
        zoneClause = ` AND (e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [supervisorId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
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

router.post('/estimates', requireSupervisorScope, async (req, res) => {
  try {
    const supervisorId = req.supervisorId;
    const franchisePartnerId = req.franchisePartnerId || 1;
    const {
      estimate_type, property_id, property_code, client_name, client_phone, client_email,
      property_name, property_type, zone, city, address, package_id, package_name, package_price,
      amc_package_description, package_services,
      addons, subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
      description
    } = req.body;

    const estimateId = `EST-${Date.now()}`;
    
    // property_id column is INT, so use null for string codes
    const numericPropertyId = parseInt(property_id);
    const propertyIdValue = isNaN(numericPropertyId) ? null : numericPropertyId;

    // Get creator name - check fp_employees first, then users table
    let creatorName = 'Supervisor';
    try {
      // Try fp_employees table first (for FP-created employees)
      const [[fpEmp]] = await pool.query(
        'SELECT first_name, last_name FROM fp_employees WHERE id = ? OR user_id = ?',
        [supervisorId, supervisorId]
      );
      if (fpEmp && (fpEmp.first_name || fpEmp.last_name)) {
        creatorName = `${fpEmp.first_name || ''} ${fpEmp.last_name || ''}`.trim() || 'Supervisor';
      } else {
        // Fall back to users table
        const [[userInfo]] = await pool.query('SELECT first_name, last_name, name FROM users WHERE id = ?', [supervisorId]);
        if (userInfo) creatorName = userInfo.first_name && userInfo.last_name ? `${userInfo.first_name} ${userInfo.last_name}`.trim() : userInfo.name || 'Supervisor';
      }
    } catch (e) { console.log('Creator name lookup error:', e.message); }

    // Add new columns if they don't exist
    try {
      await pool.query(`ALTER TABLE fp_estimates ADD COLUMN amc_package_description TEXT`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.query(`ALTER TABLE fp_estimates ADD COLUMN package_services TEXT`);
    } catch (e) { /* Column exists */ }

    const [result] = await pool.query(
      `INSERT INTO fp_estimates (
        estimate_id, franchise_partner_id, property_id, estimate_type,
        client_name, client_phone, client_email, property_name, property_code, property_type,
        zone, city, address, package_id, package_name, package_price, amc_package_description, package_services,
        subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
        addons_data, description, created_by_id, created_by_name, created_by_role, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW())`,
      [
        estimateId, franchisePartnerId, propertyIdValue, estimate_type || 'property_based',
        client_name || '', client_phone || '', client_email || '',
        property_name || '', property_code || property_id || '', property_type || '',
        zone || '', city || '', address || '',
        package_id || null, package_name || '', package_price || 0, amc_package_description || '', package_services ? JSON.stringify(package_services) : null,
        subtotal || 0, discount_percent || 0, discount_amount || 0,
        gst_percent || 0, gst_amount || 0, total_amount || 0,
        JSON.stringify(addons || []), description || '', supervisorId, creatorName, 'supervisor'
      ]
    );

    res.json({
      success: true,
      message: 'Estimate created successfully',
      data: { id: result.insertId, estimateId }
    });
  } catch (error) {
    console.error('Supervisor estimate create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create estimate: ' + error.message });
  }
});

// Archive estimate
router.put('/estimates/:id/archive', requireSupervisorScope, async (req, res) => {
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
router.put('/estimates/:id/restore', requireSupervisorScope, async (req, res) => {
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
// AMC PACKAGES - FP Supervisors use FP packages
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

router.get('/amc-packages', requireSupervisorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // FP Supervisors read from fp_amc_packages
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

router.get('/addons', requireSupervisorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // FP Supervisors read from fp_addons
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
    const [globalZones] = await pool.query('SELECT id, name FROM zones WHERE is_active = 1');
    
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

// =====================================================
// DIVISIONS - FP-specific divisions shared across employees
// =====================================================
router.get('/divisions', requireSupervisorScope, async (req, res) => {
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

router.post('/divisions', requireSupervisorScope, async (req, res) => {
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

router.delete('/divisions/:id', requireSupervisorScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE fp_divisions SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?', [id, req.franchisePartnerId]);
    res.json({ success: true, message: 'Division deleted' });
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
      `SELECT * FROM onboarded_vendors WHERE supervisor_id = ?`,
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
router.get('/fp-portal-links', requireSupervisorScope, async (req, res) => {
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
