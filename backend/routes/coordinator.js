/**
 * Coordinator Portal API Routes
 * All routes are scoped to the logged-in coordinator's data
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

    // Get franchise_partner_id and fp_employee_id - needed for zone lookup
    let franchisePartnerId = user.franchise_partner_id || null;
    let fpEmployeeId = null;
    
    // Look up corresponding fp_employees record
    const [fpEmployee] = await pool.query(
      `SELECT id, franchise_partner_id FROM fp_employees WHERE (email = ? OR username = ?) AND is_active = 1`,
      [user.email, user.username]
    );
    if (fpEmployee.length > 0) {
      fpEmployeeId = fpEmployee[0].id;
      if (!franchisePartnerId && fpEmployee[0].franchise_partner_id) {
        franchisePartnerId = fpEmployee[0].franchise_partner_id;
      }
    }
    
    console.log('[Coordinator Login] fpEmployeeId:', fpEmployeeId, 'franchisePartnerId:', franchisePartnerId);

    // Generate JWT token (include fpEmployeeId for zone lookup)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        coordinatorId: user.id,
        fpEmployeeId: fpEmployeeId,
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
          coordinatorId: user.id,
          fpEmployeeId: fpEmployeeId,
          franchisePartnerId: franchisePartnerId,
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
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    const isFPCoordinator = !!franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    
    console.log('[Coordinator Dashboard] coordinatorId:', coordinatorId, 'fpId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);

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
       WHERE (p.franchise_partner_id = ? AND (p.status IS NULL OR p.status != 'deleted') AND (p.created_by = ? OR p.created_by = ? OR p.coordinator_id = ?${zoneCondition}))`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId, ...zoneParams]
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
       WHERE (op.franchise_partner_id = ? AND (op.created_by = ? OR op.created_by = ? OR op.coordinator_id = ?${onbZoneCondition}))`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId, ...onbZoneParams]
    );

    // Vendors - zone-centric + own created
    const [vendorsCount] = await pool.query(
      `SELECT COUNT(*) as count FROM onboarded_vendors 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ?${assignedZones.length > 0 ? ` OR zone IN (${assignedZones.map(() => '?').join(',')})` : ''})`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', ...assignedZones]
    );

    // Customers - zone-centric + own created
    const [customersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM clients 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR coordinator_id = ?)`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId]
    );

    // Employees under this FP
    const [employeesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?`,
      [franchisePartnerId]
    );

    // Work orders - zone-centric + own created
    const [workOrdersCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR coordinator_id = ?)`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId]
    );

    const [pendingWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR coordinator_id = ?)
       AND status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId]
    );

    const [completedWOCount] = await pool.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE franchise_partner_id = ? AND (created_by = ? OR created_by = ? OR coordinator_id = ?)
       AND status IN ('completed', 'closed')`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId]
    );

    // Estimates - by FP (non-archived only)
    const [estimatesCount] = await pool.query(
      `SELECT COUNT(*) as count FROM fp_estimates 
       WHERE franchise_partner_id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
      [franchisePartnerId]
    );

    // Get recent work orders (own created + zone-centric) with creator name lookup
    const [recentWorkOrders] = await pool.query(
      `SELECT wo.*, p.name as property_name, c.name as category_name,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                CONCAT(pma.first_name, ' ', COALESCE(pma.last_name, '')),
                CASE WHEN wo.created_by REGEXP '^[0-9]+$' THEN NULL ELSE wo.created_by END,
                'System'
              ) as created_by_name,
              COALESCE(fpe.role, pma.role, wo.created_by_role) as created_by_role
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN fp_employees fpe ON wo.created_by = fpe.id OR wo.created_by = fpe.email
       LEFT JOIN pm_admins pma ON wo.created_by = pma.id OR wo.created_by = pma.email
       WHERE wo.franchise_partner_id = ? AND (wo.created_by = ? OR wo.created_by = ? OR wo.coordinator_id = ?)
       ORDER BY wo.created_at DESC
       LIMIT 5`,
      [franchisePartnerId, creatorEmail, req.user?.username || '', coordinatorId]
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
// PROPERTIES - Coordinator sees their own + linked FP properties (ZONE-CENTRIC)
// =====================================================
router.get('/properties', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const isFPCoordinator = !!franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'p');

    console.log(`[Coordinator Properties] employeeId: ${employeeId}, coordinatorId: ${coordinatorId}, fpId: ${franchisePartnerId}, isFPCoordinator: ${isFPCoordinator}`);
    console.log(`[Coordinator Properties] assignedZones: ${JSON.stringify(assignedZones)}, creatorEmail: ${creatorEmail}`);

    // For FP Coordinators: primarily filter by franchise_partner_id
    // For standalone Coordinators: filter by coordinator_id
    let propQuery, propParams;
    
    if (isFPCoordinator) {
      // FP Coordinators see: zone-centric properties + their own created properties
      propQuery = `SELECT p.*,
          COALESCE(z.name, zn.name, p.zone_id) as zone_name,
          COALESCE(p.area_name, p.city) as area,
          COALESCE(fd.name, p.division_id) as division_name,
          p.division_id as division,
          1 as units,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            p.created_by, 'System'
          ) as created_by_name,
          'properties' as source_table
         FROM properties p
         LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
         LEFT JOIN zones zn ON p.zone_id = zn.name
         LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = p.franchise_partner_id
         LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username
         LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR CAST(p.created_by AS UNSIGNED) = u.id
         WHERE p.franchise_partner_id = ? AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
         ORDER BY p.created_at DESC`;
      propParams = [franchisePartnerId, ...zoneFilter.params];
    } else {
      // Standalone coordinator - check coordinator_id OR created_by matches
      propQuery = `SELECT p.*,
          COALESCE(z.name, zn.name, p.zone_id) as zone_name,
          COALESCE(p.area_name, p.city) as area,
          COALESCE(fd.name, p.division_id) as division_name,
          p.division_id as division,
          1 as units,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            p.created_by, 'System'
          ) as created_by_name,
          'properties' as source_table
         FROM properties p
         LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
         LEFT JOIN zones zn ON p.zone_id = zn.name
         LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = p.franchise_partner_id
         LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username
         LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR CAST(p.created_by AS UNSIGNED) = u.id
         WHERE (p.coordinator_id = ? OR p.created_by = ? OR p.created_by = ?) AND (p.status IS NULL OR p.status != 'deleted')${zoneFilter.clause}
         ORDER BY p.created_at DESC`;
      propParams = [coordinatorId, coordinatorId, req.user?.username || req.user?.email || '', ...zoneFilter.params];
    }
    
    const [regularProperties] = await pool.query(propQuery, propParams);
    console.log(`Found ${regularProperties.length} properties from properties table`);

    // Also fetch from onboarded_properties (with zone + creator filtering)
    let onboardedProperties = [];
    try {
      const onbZoneFilter = buildOnboardedPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'op');
      let onbQuery, onbParams;
      if (isFPCoordinator) {
        // FP Coordinators see: ALL FP properties (if no zones) or zone-centric
        onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type, op.entry_type,
                  op.zone as zone_name, op.area_name as area, 
                  COALESCE(fd.name, op.division) as division, COALESCE(fd.name, op.division) as division_name,
                  op.total_units as units, op.number_of_units,
                  op.number_of_blocks, op.block_names, op.units_per_block,
                  op.block_info, op.block_na, op.flat_block_info, op.flat_block_na,
                  op.villa_plot_number, op.plot_na,
                  op.address, op.city, op.state, op.postal_code as zip_code,
                  op.landmark, op.latitude, op.longitude,
                  op.association_contacts,
                  op.watchman_name, op.watchman_contact,
                  op.notes,
                  op.contact_person, op.contact_phone, op.contact_email as email,
                  COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                  op.created_at, op.status,
                  'onboarded_properties' as source_table
           FROM onboarded_properties op
           LEFT JOIN fp_divisions fd ON (CAST(op.division AS UNSIGNED) = fd.id OR op.division = fd.name) AND fd.franchise_partner_id = op.franchise_partner_id
           LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR CAST(op.created_by AS UNSIGNED) = u.id
           WHERE op.franchise_partner_id = ?${onbZoneFilter.clause}
           ORDER BY op.created_at DESC`;
        onbParams = [franchisePartnerId, ...onbZoneFilter.params];
      } else {
        onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type, op.entry_type,
                  op.zone as zone_name, op.area_name as area, 
                  COALESCE(fd.name, op.division) as division, COALESCE(fd.name, op.division) as division_name,
                  op.total_units as units, op.number_of_units,
                  op.number_of_blocks, op.block_names, op.units_per_block,
                  op.block_info, op.block_na, op.flat_block_info, op.flat_block_na,
                  op.villa_plot_number, op.plot_na,
                  op.address, op.city, op.state, op.postal_code as zip_code,
                  op.landmark, op.latitude, op.longitude,
                  op.association_contacts,
                  op.watchman_name, op.watchman_contact,
                  op.notes,
                  op.contact_person, op.contact_phone, op.contact_email as email,
                  COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                  op.created_at, op.status,
                  'onboarded_properties' as source_table
           FROM onboarded_properties op
           LEFT JOIN fp_divisions fd ON (CAST(op.division AS UNSIGNED) = fd.id OR op.division = fd.name) AND fd.franchise_partner_id = op.franchise_partner_id
           LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR CAST(op.created_by AS UNSIGNED) = u.id
           WHERE (op.coordinator_id = ? OR op.created_by = ? OR op.created_by = ?)${onbZoneFilter.clause}
           ORDER BY op.created_at DESC`;
        onbParams = [coordinatorId, coordinatorId, creatorEmail, ...onbZoneFilter.params];
      }
      const [rows] = await pool.execute(onbQuery, onbParams);
      onboardedProperties = rows;
      console.log(`Found ${onboardedProperties.length} properties from onboarded_properties table`);
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    // Combine both sources and sort by created_at DESC
    const allProperties = [...regularProperties, ...onboardedProperties]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

router.put('/properties/:id', requireCoordinatorScope, async (req, res) => {
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
// WORK ORDERS - Coordinator sees their own + linked FP work orders (ZONE-CENTRIC)
// =====================================================
router.get('/work-orders', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const isFPCoordinator = !!franchisePartnerId;
    const { status } = req.query;
    const creatorEmail = getCreatorIdentifier(req);
    const employeeId = getEmployeeIdForZoneLookup(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');

    // FP Coordinators: see zone-centric work orders + their own created
    // Standalone Coordinators: see zone-centric work orders + their own created
    let query, params;
    
    if (isFPCoordinator) {
      query = `
        SELECT wo.*, 
          COALESCE(p.name, wo.property_name, op.community_name) as property_name,
          COALESCE(p.property_id, op.property_id) as property_code,
          COALESCE(p.property_id, op.property_id) as actual_property_id,
          COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
          COALESCE(p.zone_id, op.zone) as zone,
          COALESCE(p.division_id, op.division) as division,
          COALESCE(p.address, op.address) as property_address,
          COALESCE(p.city, op.city) as property_city,
          COALESCE(p.state, op.state) as property_state,
          op.total_units, op.number_of_blocks as total_blocks, op.entry_type,
          c.name as category_name, v.company_name as vendor_name,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            wo.created_by, 'System'
          ) as created_by_name
        FROM work_orders wo
        LEFT JOIN properties p ON wo.property_id = p.id
        LEFT JOIN onboarded_properties op ON wo.property_id = op.id
        LEFT JOIN categories c ON wo.category_id = c.id
        LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
        LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username
        LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
        WHERE wo.franchise_partner_id = ?${zoneFilter.clause}
      `;
      params = [franchisePartnerId, ...zoneFilter.params];
    } else {
      query = `
        SELECT wo.*, 
          COALESCE(p.name, wo.property_name, op.community_name) as property_name,
          COALESCE(p.property_id, op.property_id) as property_code,
          COALESCE(p.property_id, op.property_id) as actual_property_id,
          COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
          COALESCE(p.zone_id, op.zone) as zone,
          COALESCE(p.division_id, op.division) as division,
          COALESCE(p.address, op.address) as property_address,
          COALESCE(p.city, op.city) as property_city,
          COALESCE(p.state, op.state) as property_state,
          op.total_units, op.number_of_blocks as total_blocks, op.entry_type,
          c.name as category_name, v.company_name as vendor_name,
          COALESCE(
            CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
            wo.created_by, 'System'
          ) as created_by_name
        FROM work_orders wo
        LEFT JOIN properties p ON wo.property_id = p.id
        LEFT JOIN onboarded_properties op ON wo.property_id = op.id
        LEFT JOIN categories c ON wo.category_id = c.id
        LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
        LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username
        LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
        WHERE (wo.coordinator_id = ? OR wo.created_by = ? OR wo.created_by = ?)${zoneFilter.clause}
      `;
      params = [coordinatorId, coordinatorId, creatorEmail, ...zoneFilter.params];
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
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    const isFPCoordinator = !!franchisePartnerId;
    const creatorEmail = getCreatorIdentifier(req);
    const employeeId = getEmployeeIdForZoneLookup(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    console.log('[Coordinator Pending WO] coordId:', coordinatorId, 'fpId:', franchisePartnerId, 'zones:', assignedZones, 'creator:', creatorEmail);

    let query, params;
    
    if (isFPCoordinator) {
      query = `SELECT wo.*, 
          COALESCE(p.name, wo.property_name, op.community_name) as property_name,
          COALESCE(p.property_id, op.property_id) as property_code,
          COALESCE(p.property_id, op.property_id) as actual_property_id,
          COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
          COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
          COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
          op.total_units, op.number_of_blocks as total_blocks,
          c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN onboarded_properties op ON wo.property_id = op.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE wo.franchise_partner_id = ?
           AND wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')${zoneFilter.clause}
         ORDER BY wo.created_at DESC`;
      params = [franchisePartnerId, ...zoneFilter.params];
    } else {
      query = `SELECT wo.*, 
          COALESCE(p.name, wo.property_name, op.community_name) as property_name,
          COALESCE(p.property_id, op.property_id) as property_code,
          COALESCE(p.property_id, op.property_id) as actual_property_id,
          COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
          COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
          COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
          op.total_units, op.number_of_blocks as total_blocks,
          c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN onboarded_properties op ON wo.property_id = op.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE (wo.coordinator_id = ? OR wo.created_by = ? OR wo.created_by = ?)
           AND wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')${zoneFilter.clause}
         ORDER BY wo.created_at DESC`;
      params = [coordinatorId, coordinatorId, creatorEmail, ...zoneFilter.params];
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
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    const isFPCoordinator = !!franchisePartnerId;
    const creatorEmail = getCreatorIdentifier(req);
    const employeeId = getEmployeeIdForZoneLookup(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');

    let query, params;
    
    if (isFPCoordinator) {
      query = `SELECT wo.*, 
          COALESCE(p.name, wo.property_name, op.community_name) as property_name,
          COALESCE(p.property_id, op.property_id) as property_code,
          COALESCE(p.property_id, op.property_id) as actual_property_id,
          COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
          COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
          COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
          op.total_units, op.number_of_blocks as total_blocks,
          c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN onboarded_properties op ON wo.property_id = op.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE wo.franchise_partner_id = ?
           AND wo.status IN ('completed', 'closed')${zoneFilter.clause}
         ORDER BY wo.created_at DESC`;
      params = [franchisePartnerId, ...zoneFilter.params];
    } else {
      query = `SELECT wo.*, 
          COALESCE(p.name, wo.property_name, op.community_name) as property_name,
          COALESCE(p.property_id, op.property_id) as property_code,
          COALESCE(p.property_id, op.property_id) as actual_property_id,
          COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
          COALESCE(p.zone_id, op.zone) as zone, COALESCE(p.division_id, op.division) as division,
          COALESCE(p.address, op.address) as property_address, COALESCE(p.city, op.city) as property_city,
          op.total_units, op.number_of_blocks as total_blocks,
          c.name as category_name, v.company_name as vendor_name,
          COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), wo.created_by, 'System') as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN onboarded_properties op ON wo.property_id = op.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN users u ON wo.created_by = u.email OR CAST(wo.created_by AS UNSIGNED) = u.id
         WHERE (wo.coordinator_id = ? OR wo.created_by = ? OR wo.created_by = ?)
           AND wo.status IN ('completed', 'closed')${zoneFilter.clause}
         ORDER BY wo.created_at DESC`;
      params = [coordinatorId, coordinatorId, creatorEmail, ...zoneFilter.params];
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
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    console.log('[Coordinator WO Create] CoordID:', coordinatorId, 'FP:', franchisePartnerId);
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
    const createdBy = req.user?.email || req.user?.username || `coordinator-${coordinatorId}`;

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
      createdBy: req.user?.username || req.user?.email || 'Coordinator',
      createdByRole: 'Coordinator',
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
// CUSTOMERS - Coordinator sees their own + linked FP customers (ZONE-CENTRIC + OWN CREATED)
// =====================================================
router.get('/customers', requireCoordinatorScope, async (req, res) => {
  try {
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);

    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildClientZoneOrCreatorFilter(assignedZones, creatorEmail, 'c', 'p');

    const query = `SELECT c.*, p.name as property_name, p.zone_id as zone
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.coordinator_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})${zoneFilter.clause}
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [coordinatorId, franchisePartnerId, ...zoneFilter.params] : [coordinatorId, ...zoneFilter.params];

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
      numberOfUnits, villaPlotNumber, blockInfo, blockNA, flatBlockInfo, flatBlockNA, plotNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      watchmanName, watchmanContact,
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
        `INSERT INTO onboarded_properties (
          property_id, community_name, property_type, address, city, state, postal_code,
          contact_person, contact_phone, contact_email, zone, division,
          coordinator_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info, block_na,
          flat_block_info, flat_block_na, plot_na,
          watchman_name, watchman_contact, association_contacts, total_units, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          propertyIdGen, communityName, entryType || propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          coordinatorId, franchisePartnerId, req.user?.username || req.user?.email || req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || '', blockNA ? 1 : 0,
          flatBlockInfo || '', flatBlockNA ? 1 : 0, plotNA ? 1 : 0,
          watchmanName || null, watchmanContact || null, JSON.stringify(associationContacts || []), numberOfUnits || null
        ]
      );

      // Also create a record in clients table for Property Management listing
      await pool.execute(
        `INSERT INTO clients (client_id, name, email, phone, address, city, state, zip_code, 
          property_id, coordinator_id, franchise_partner_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [clientId, contactName || communityName, contactEmail || '', `${contactCountryCode}${contactPhone || ''}`,
         address || '', city || '', state || '', postalCode || '',
         propertyResult.insertId, coordinatorId, franchisePartnerId, req.user?.username || req.user?.email || '']
      );

      let customerResult = null;
      let emailSent = false;
      console.log('📧 [Coordinator] Creating customer - contactEmail:', contactEmail);
      if (contactEmail) {
        const tempPassword = generateTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const [existing] = await pool.query('SELECT id, is_activated FROM customer_accounts WHERE email = ?', [contactEmail.toLowerCase()]);
        console.log('📧 [Coordinator] Existing customer check:', existing.length > 0 ? 'Found' : 'New customer');
        
        if (existing.length === 0) {
          [customerResult] = await pool.query(
            `INSERT INTO customer_accounts (
              customer_id, first_name, last_name, email, phone, temp_password_hash, property_id, property_code,
              activation_token, activation_expires, is_activated, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, contactName, '', contactEmail.toLowerCase(), `${contactCountryCode}${contactPhone}`,
              tempPasswordHash, propertyResult.insertId, propertyIdGen, activationToken, activationExpires, 0, 'coordinator']
          );
          
          // Send activation email
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 [Coordinator] Sending activation email to:', contactEmail.toLowerCase());
          console.log('📧 [Coordinator] Activation link:', activationLink);
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: contactEmail.toLowerCase(),
              firstName: contactName,
              tempPassword,
              activationLink,
              propertyName: communityName,
              propertyId: propertyIdGen
            });
            emailSent = emailResult.success;
            console.log('📧 [Coordinator] Email result:', emailResult);
          } catch (emailError) {
            console.error('📧 [Coordinator] Email sending failed:', emailError.message);
          }
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
          zip_code, client_type, company_name, property_id, gst_number, coordinator_id, franchise_partner_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber, coordinatorId, franchisePartnerId,
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
            [clientId, name, '', email.toLowerCase(), phone || '', tempPasswordHash, activationToken, activationExpires, 0, 'coordinator']
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Sending activation email (coordinator simple create) to:', email.toLowerCase());
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
// VENDORS (ZONE-CENTRIC - employees see data from their assigned zones + own created)
// =====================================================
router.get('/vendors', requireCoordinatorScope, async (req, res) => {
  try {
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get employee's assigned zones
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    
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
       WHERE ov.franchise_partner_id = ?
         AND (ov.status = 'active' OR ov.status IS NULL)${zoneClause}
       ORDER BY ov.created_at DESC`;
    
    const [vendors] = await pool.query(query, [req.franchisePartnerId, ...zoneParams]);

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

// Get vendor assignments (view-only for coordinators) (ZONE-CENTRIC)
router.get('/vendors/assignments', requireCoordinatorScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    if (!franchisePartnerId) {
      return res.json({ success: true, data: { propertyAssignments: [], serviceAssignments: [] } });
    }
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    
    // Build zone filter for vendor's zone
    let zoneClause = '';
    let zoneParams = [];
    if (assignedZones.length > 0) {
      const placeholders = assignedZones.map(() => '?').join(',');
      zoneClause = ` AND v.zone IN (${placeholders})`;
      zoneParams = assignedZones;
    }
    
    console.log('Coordinator Vendor Assignments Query - FP:', franchisePartnerId, 'Zones:', assignedZones);
    
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
       WHERE (p.franchise_partner_id = ? OR op.franchise_partner_id = ?) AND pva.is_active = 1${zoneClause}
       ORDER BY pva.assigned_at DESC`,
      [franchisePartnerId, franchisePartnerId, ...zoneParams]
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

    const vendorId = `VND-${Date.now()}`;

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
// ESTIMATES - Coordinator sees zone-centric + own created estimates
// =====================================================
router.get('/estimates', requireCoordinatorScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const coordinatorId = req.coordinatorId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    let estimates = [];
    
    // If coordinator is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      // Get assigned zones
      const assignedZones = await getAssignedZones(employeeId, creatorEmail);
      
      // Build zone + creator filter - match by created_by_id OR created_by_name (name, email, or username)
      let zoneClause = '';
      let zoneParams = [];
      if (assignedZones.length > 0) {
        const placeholders = assignedZones.map(() => '?').join(',');
        zoneClause = ` AND (e.zone IN (${placeholders}) OR e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [...assignedZones, coordinatorId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
      } else {
        // No zones = only see own created (by ID or by name/email/username)
        zoneClause = ` AND (e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
        zoneParams = [coordinatorId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
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
          `SELECT id, service_name, description, property_type FROM fp_addons WHERE franchise_partner_id = ?`,
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
            // Enrich addons with descriptions - match by property_type
            const estPropertyType = est.property_type?.toUpperCase();
            addons = addons.map(addon => {
              if (!addon.description) {
                const addonName = addon.name || addon.service_name || '';
                const addonId = addon.id || addon.addon_id;
                let foundAddon = fpAddons.find(a => a.id == addonId);
                if (!foundAddon || !foundAddon.description) {
                  foundAddon = fpAddons.find(a => 
                    (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                    a.property_type?.toUpperCase() === estPropertyType
                  );
                }
                if (foundAddon && foundAddon.description) addon.description = foundAddon.description;
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
    let creatorName = 'Coordinator';
    try {
      // Try fp_employees table first (for FP-created employees)
      const [[fpEmp]] = await pool.query(
        'SELECT first_name, last_name FROM fp_employees WHERE id = ? OR user_id = ?',
        [coordinatorId, coordinatorId]
      );
      if (fpEmp && (fpEmp.first_name || fpEmp.last_name)) {
        creatorName = `${fpEmp.first_name || ''} ${fpEmp.last_name || ''}`.trim() || 'Coordinator';
      } else {
        // Fall back to users table
        const [[userInfo]] = await pool.query('SELECT first_name, last_name, name FROM users WHERE id = ?', [coordinatorId]);
        if (userInfo) creatorName = userInfo.first_name && userInfo.last_name ? `${userInfo.first_name} ${userInfo.last_name}`.trim() : userInfo.name || 'Coordinator';
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
        JSON.stringify(addons || []), description || '', coordinatorId, creatorName, 'coordinator'
      ]
    );

    res.json({
      success: true,
      message: 'Estimate created successfully',
      data: { id: result.insertId, estimateId }
    });
  } catch (error) {
    console.error('Coordinator estimate create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create estimate: ' + error.message });
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

// =====================================================
// AMC PACKAGES - FP Coordinators use FP packages (read-only)
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

    res.json({ success: true, data: packages.map(transformPackage) });
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

    res.json({ success: true, data: addons.map(transformAddon) });
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
    const [globalZones] = await pool.query('SELECT id, name FROM zones WHERE is_active = 1');
    
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

// =====================================================
// DIVISIONS - FP-specific divisions shared across employees
// =====================================================
router.get('/divisions', requireCoordinatorScope, async (req, res) => {
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

router.post('/divisions', requireCoordinatorScope, async (req, res) => {
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

router.delete('/divisions/:id', requireCoordinatorScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE fp_divisions SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?', [id, req.franchisePartnerId]);
    res.json({ success: true, message: 'Division deleted' });
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
      'SELECT * FROM subcategories WHERE category_id = ? AND (is_active = 1 OR is_active = 1) ORDER BY sort_order, name',
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
    
    if (!fpId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP employees' });
    }
    
    // Get all employees for this FP
    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active
       FROM fp_employees e
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       ORDER BY e.first_name, e.last_name`,
      [fpId]
    );

    // Get zone assignments separately (using zone_name directly)
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?`,
      [fpId]
    );

    // Build a map of employee zones
    const employeeZonesMap = {};
    zoneAssignments.forEach(za => {
      if (!employeeZonesMap[za.fp_employee_id]) {
        employeeZonesMap[za.fp_employee_id] = [];
      }
      if (za.zone_name) {
        employeeZonesMap[za.fp_employee_id].push(za.zone_name);
      }
    });

    // Get all unique zones for reference
    const [allZones] = await pool.execute(
      `SELECT DISTINCT zone_name as name FROM fp_employee_zones WHERE franchise_partner_id = ? AND zone_name IS NOT NULL ORDER BY zone_name`,
      [fpId]
    );

    res.json({ 
      success: true, 
      data: {
        employees: employees.map(emp => {
          const zones = employeeZonesMap[emp.id] || [];
          return {
            ...emp,
            assigned_zones: zones,
            zone_names: zones.length > 0 ? zones.join(', ') : 'No zones assigned'
          };
        }),
        zones: allZones
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
router.get('/fp-portal-links', requireCoordinatorScope, async (req, res) => {
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
