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
// Rate limiting disabled
// const { loginRateLimiter } = require('../middleware/security');

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

    // Get franchise_partner_id and fp_employee_id - needed for zone lookup
    let franchisePartnerId = user.franchise_partner_id || null;
    let fpEmployeeId = null;
    
    // Look up corresponding fp_employees record
    const [fpEmployee] = await pool.execute(
      `SELECT id, franchise_partner_id FROM fp_employees WHERE (email = ? OR username = ?) AND is_active = 1`,
      [user.email, user.username]
    );
    if (fpEmployee.length > 0) {
      fpEmployeeId = fpEmployee[0].id;
      if (!franchisePartnerId && fpEmployee[0].franchise_partner_id) {
        franchisePartnerId = fpEmployee[0].franchise_partner_id;
      }
    }
    
    console.log('[Manager Login] fpEmployeeId:', fpEmployeeId, 'franchisePartnerId:', franchisePartnerId);

    // Generate token (include fpEmployeeId for zone lookup)
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      managerId: user.id,
      fpEmployeeId: fpEmployeeId,
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
          fpEmployeeId: fpEmployeeId,
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
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeTable = req.isFPManager ? 'fp_employees' : 'manager_employees';
    const employeeScopeCol = req.isFPManager ? 'franchise_partner_id' : 'manager_id';

    // Get employee ID and creator email for zone lookup
    const employeeId = await getEmployeeIdForZoneLookup(req, 'manager');
    const creatorEmail = getCreatorIdentifier(req);
    const rawZones = await getAssignedZones(employeeId, creatorEmail);
    
    // Check if employee has unrestricted access (__ALL__ marker)
    const hasUnrestrictedAccess = rawZones.includes('__ALL__');
    const assignedZones = hasUnrestrictedAccess ? [] : rawZones;
    const hasZones = assignedZones.length > 0 && !hasUnrestrictedAccess;
    
    console.log('[Manager Dashboard] managerId:', managerId, 'fpId:', franchisePartnerId, 'assignedZones:', assignedZones, 'unrestricted:', hasUnrestrictedAccess);

    // Build zone filter clause for properties (skip if unrestricted)
    let zoneClause = '';
    let zoneParams = [];
    if (hasZones) {
      const placeholders = assignedZones.map(() => '?').join(',');
      zoneClause = ` AND (p.zone_id IN (${placeholders}) OR p.zone_id IN (SELECT name FROM zones WHERE id IN (${placeholders})))`;
      zoneParams = [...assignedZones, ...assignedZones];
    }

    // Build zone filter for onboarded properties (skip if unrestricted)
    let onbZoneClause = '';
    let onbZoneParams = [];
    if (hasZones) {
      const placeholders = assignedZones.map(() => '?').join(',');
      onbZoneClause = ` AND (op.zone IN (${placeholders}) OR op.zone IN (SELECT name FROM zones WHERE id IN (${placeholders})))`;
      onbZoneParams = [...assignedZones, ...assignedZones];
    }

    // Helper function to safely get count
    const safeCount = (query, params) => {
      return pool.execute(query, params)
        .then(([result]) => result[0]?.count || 0)
        .catch((e) => {
          console.log(`Dashboard query error: ${e.message}`);
          return 0;
        });
    };

    // Run all queries in parallel - ZONE-FILTERED data based on employee's assigned zones
    const [
      propertiesCount,
      onboardedPropertiesCount,
      vendorsCount,
      customersCount,
      employeesCount,
      workOrderStats,
      directEstimatesCount,
      propertyEstimatesCount,
      estimatesByPropertyType,
      estimatesByStatus,
      recentWorkOrders
    ] = await Promise.all([
      // Properties count - Zone-filtered
      safeCount(
        `SELECT COUNT(*) as count FROM properties p
         WHERE p.franchise_partner_id = ? AND (p.status IS NULL OR p.status NOT IN ('deleted', 'inactive'))${zoneClause}`,
        [franchisePartnerId, ...zoneParams]
      ),
      
      // Onboarded Properties count - Zone-filtered
      safeCount(
        `SELECT COUNT(*) as count FROM onboarded_properties op
         WHERE op.franchise_partner_id = ? AND op.status = 'active'${onbZoneClause}`,
        [franchisePartnerId, ...onbZoneParams]
      ),
      
      // Vendors count - Zone-filtered via property association
      hasZones ? safeCount(
        `SELECT COUNT(DISTINCT ov.id) as count FROM onboarded_vendors ov
         LEFT JOIN property_vendor_assignments pva ON ov.id = pva.vendor_id
         LEFT JOIN properties p ON pva.property_id = p.id
         LEFT JOIN onboarded_properties op ON pva.property_id = op.id
         WHERE ov.franchise_partner_id = ? AND ov.status = 'active' AND ov.vendor_id NOT LIKE '%SEED%'
         AND (p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`,
        [franchisePartnerId, ...assignedZones, ...assignedZones]
      ) : safeCount(
        `SELECT COUNT(*) as count FROM onboarded_vendors WHERE franchise_partner_id = ? AND status = 'active' AND vendor_id NOT LIKE '%SEED%'`,
        [franchisePartnerId]
      ),
      
      // Customers count - Zone-filtered via property
      hasZones ? safeCount(
        `SELECT COUNT(DISTINCT c.id) as count FROM clients c
         LEFT JOIN properties p ON c.property_id = p.id
         LEFT JOIN onboarded_properties op ON c.property_id = op.id
         WHERE c.franchise_partner_id = ?
         AND (p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`,
        [franchisePartnerId, ...assignedZones, ...assignedZones]
      ) : safeCount(
        `SELECT COUNT(*) as count FROM clients WHERE franchise_partner_id = ?`,
        [franchisePartnerId]
      ),
      
      // Employees count - ALL FP employees (not zone-filtered)
      safeCount(
        `SELECT COUNT(*) as count FROM ${employeeTable} WHERE ${employeeScopeCol} = ? AND is_active = 1`,
        [scopeId]
      ),
      
      // Work orders - Zone-filtered with detailed status breakdown
      (async () => {
        let woQuery = `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN wo.status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN wo.status = 'under_review' THEN 1 ELSE 0 END) as under_review,
            SUM(CASE WHEN wo.status = 'assigned' THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN wo.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN wo.status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN wo.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN wo.status = 'closed' THEN 1 ELSE 0 END) as closed
          FROM work_orders wo
          LEFT JOIN properties p ON wo.property_id = p.id
          LEFT JOIN onboarded_properties op ON wo.property_id = op.id
          WHERE wo.franchise_partner_id = ?`;
        let woParams = [franchisePartnerId];
        
        if (hasZones) {
          woQuery += ` AND (p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`;
          woParams = [...woParams, ...assignedZones, ...assignedZones];
        }
        
        try {
          const [[r]] = await pool.execute(woQuery, woParams);
          return { 
            total: r.total || 0, 
            pending: r.pending || 0, 
            under_review: r.under_review || 0,
            assigned: r.assigned || 0,
            in_progress: r.in_progress || 0,
            completed: r.completed || 0,
            cancelled: r.cancelled || 0,
            closed: r.closed || 0
          };
        } catch (e) {
          console.log('Work order stats error:', e.message);
          return { total: 0, pending: 0, under_review: 0, assigned: 0, in_progress: 0, completed: 0, cancelled: 0, closed: 0 };
        }
      })(),
      
      // Direct Estimates count - Zone-filtered via property zone
      (async () => {
        let estQuery = `SELECT COUNT(*) as count FROM fp_estimates fe
           LEFT JOIN properties p ON fe.property_id = p.id
           LEFT JOIN onboarded_properties op ON fe.property_id = op.id
           WHERE fe.franchise_partner_id = ? 
           AND (fe.is_archived = 0 OR fe.is_archived IS NULL) AND fe.status NOT IN ('archived', 'rejected', 'deleted')
           AND fe.estimate_type = 'direct'`;
        let estParams = [franchisePartnerId];
        if (hasZones) {
          estQuery += ` AND (fe.zone IN (${assignedZones.map(() => '?').join(',')}) OR p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`;
          estParams = [...estParams, ...assignedZones, ...assignedZones, ...assignedZones];
        }
        return safeCount(estQuery, estParams);
      })(),
      
      // Property-based Estimates count - Zone-filtered
      (async () => {
        let estQuery = `SELECT COUNT(*) as count FROM fp_estimates fe
           LEFT JOIN properties p ON fe.property_id = p.id
           LEFT JOIN onboarded_properties op ON fe.property_id = op.id
           WHERE fe.franchise_partner_id = ?
           AND (fe.is_archived = 0 OR fe.is_archived IS NULL) AND fe.status NOT IN ('archived', 'rejected', 'deleted')
           AND (fe.estimate_type = 'property_based' OR fe.estimate_type = 'property-based')`;
        let estParams = [franchisePartnerId];
        if (hasZones) {
          estQuery += ` AND (fe.zone IN (${assignedZones.map(() => '?').join(',')}) OR p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`;
          estParams = [...estParams, ...assignedZones, ...assignedZones, ...assignedZones];
        }
        return safeCount(estQuery, estParams);
      })(),
      
      // Estimates breakdown - Zone-filtered
      (async () => {
        let estQuery = `SELECT 
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) = 'GC' OR LOWER(property_type) LIKE '%gated%') THEN 1 ELSE 0 END) as direct_gc,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('APT', 'AP') OR LOWER(property_type) LIKE '%apartment%') THEN 1 ELSE 0 END) as direct_apt,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('VILLA', 'VL') OR LOWER(property_type) LIKE '%villa%') THEN 1 ELSE 0 END) as direct_villa,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('FLAT', 'FL') OR LOWER(property_type) LIKE '%flat%') THEN 1 ELSE 0 END) as direct_flat,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('PLOT', 'PL') OR LOWER(property_type) LIKE '%plot%') THEN 1 ELSE 0 END) as direct_plot,
          SUM(CASE WHEN estimate_type = 'direct' AND (property_type IS NULL OR property_type = '' OR (UPPER(property_type) NOT IN ('GC', 'APT', 'AP', 'VILLA', 'VL', 'FLAT', 'FL', 'PLOT', 'PL') AND LOWER(property_type) NOT LIKE '%gated%' AND LOWER(property_type) NOT LIKE '%apartment%' AND LOWER(property_type) NOT LIKE '%villa%' AND LOWER(property_type) NOT LIKE '%flat%' AND LOWER(property_type) NOT LIKE '%plot%')) THEN 1 ELSE 0 END) as direct_other,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) = 'GC' OR LOWER(property_type) LIKE '%gated%') THEN 1 ELSE 0 END) as prop_gc,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('APT', 'AP') OR LOWER(property_type) LIKE '%apartment%') THEN 1 ELSE 0 END) as prop_apt,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('VILLA', 'VL') OR LOWER(property_type) LIKE '%villa%') THEN 1 ELSE 0 END) as prop_villa,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('FLAT', 'FL') OR LOWER(property_type) LIKE '%flat%') THEN 1 ELSE 0 END) as prop_flat,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('PLOT', 'PL') OR LOWER(property_type) LIKE '%plot%') THEN 1 ELSE 0 END) as prop_plot
        FROM fp_estimates fe
        LEFT JOIN properties p ON fe.property_id = p.id
        LEFT JOIN onboarded_properties op ON fe.property_id = op.id
        WHERE fe.franchise_partner_id = ? AND (fe.is_archived = 0 OR fe.is_archived IS NULL) AND fe.status NOT IN ('archived', 'rejected', 'deleted')`;
        let estParams = [franchisePartnerId];
        if (hasZones) {
          estQuery += ` AND (fe.zone IN (${assignedZones.map(() => '?').join(',')}) OR p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`;
          estParams = [...estParams, ...assignedZones, ...assignedZones, ...assignedZones];
        }
        try {
          const [[r]] = await pool.execute(estQuery, estParams);
          return {
            direct_gc: Number(r?.direct_gc) || 0, direct_apt: Number(r?.direct_apt) || 0, direct_villa: Number(r?.direct_villa) || 0, direct_flat: Number(r?.direct_flat) || 0, direct_plot: Number(r?.direct_plot) || 0, direct_other: Number(r?.direct_other) || 0,
            prop_gc: Number(r?.prop_gc) || 0, prop_apt: Number(r?.prop_apt) || 0, prop_villa: Number(r?.prop_villa) || 0, prop_flat: Number(r?.prop_flat) || 0, prop_plot: Number(r?.prop_plot) || 0
          };
        } catch (e) {
          console.log('Estimates by type error:', e.message);
          return { direct_gc: 0, direct_apt: 0, direct_villa: 0, direct_flat: 0, direct_plot: 0, direct_other: 0, prop_gc: 0, prop_apt: 0, prop_villa: 0, prop_flat: 0, prop_plot: 0 };
        }
      })(),
      
      // Estimates breakdown by status - Zone-filtered
      (async () => {
        let estQuery = `SELECT 
          SUM(CASE WHEN estimate_type = 'direct' AND LOWER(status) = 'draft' THEN 1 ELSE 0 END) as direct_draft,
          SUM(CASE WHEN estimate_type = 'direct' AND LOWER(status) = 'sent' THEN 1 ELSE 0 END) as direct_sent,
          SUM(CASE WHEN estimate_type = 'direct' AND LOWER(status) = 'approved' THEN 1 ELSE 0 END) as direct_approved,
          SUM(CASE WHEN estimate_type = 'direct' AND LOWER(status) = 'rejected' THEN 1 ELSE 0 END) as direct_rejected,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND LOWER(status) = 'draft' THEN 1 ELSE 0 END) as prop_draft,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND LOWER(status) = 'sent' THEN 1 ELSE 0 END) as prop_sent,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND LOWER(status) = 'approved' THEN 1 ELSE 0 END) as prop_approved,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND LOWER(status) = 'rejected' THEN 1 ELSE 0 END) as prop_rejected
        FROM fp_estimates fe
        LEFT JOIN properties p ON fe.property_id = p.id
        LEFT JOIN onboarded_properties op ON fe.property_id = op.id
        WHERE fe.franchise_partner_id = ? AND (fe.is_archived = 0 OR fe.is_archived IS NULL)`;
        let estParams = [franchisePartnerId];
        if (hasZones) {
          estQuery += ` AND (fe.zone IN (${assignedZones.map(() => '?').join(',')}) OR p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`;
          estParams = [...estParams, ...assignedZones, ...assignedZones, ...assignedZones];
        }
        try {
          const [[r]] = await pool.execute(estQuery, estParams);
          return {
            direct_draft: Number(r?.direct_draft) || 0, direct_sent: Number(r?.direct_sent) || 0, direct_approved: Number(r?.direct_approved) || 0, direct_rejected: Number(r?.direct_rejected) || 0,
            prop_draft: Number(r?.prop_draft) || 0, prop_sent: Number(r?.prop_sent) || 0, prop_approved: Number(r?.prop_approved) || 0, prop_rejected: Number(r?.prop_rejected) || 0
          };
        } catch (e) {
          console.log('Estimates by status error:', e.message);
          return { direct_draft: 0, direct_sent: 0, direct_approved: 0, direct_rejected: 0, prop_draft: 0, prop_sent: 0, prop_approved: 0, prop_rejected: 0 };
        }
      })(),
      
      // Recent work orders - Zone-filtered with creator name lookup
      (async () => {
        let woQuery = `SELECT wo.*, p.name as property_name, COALESCE(c.name, wo.category_name) as category_name, 
                v.company_name as vendor_name,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  CONCAT(pma.first_name, ' ', COALESCE(pma.last_name, '')),
                  CASE WHEN wo.created_by REGEXP '^[0-9]+$' THEN NULL ELSE wo.created_by END,
                  'System'
                ) as created_by_name,
                COALESCE(fpe.role, pma.role) as created_by_role
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN onboarded_properties op ON wo.property_id = op.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN fp_employees fpe ON wo.created_by = fpe.id OR wo.created_by = fpe.email
         LEFT JOIN users pma ON wo.created_by = pma.id OR wo.created_by = pma.email
         WHERE wo.franchise_partner_id = ?`;
        let woParams = [franchisePartnerId];
        if (hasZones) {
          woQuery += ` AND (p.zone_id IN (${assignedZones.map(() => '?').join(',')}) OR op.zone IN (${assignedZones.map(() => '?').join(',')}))`;
          woParams = [...woParams, ...assignedZones, ...assignedZones];
        }
        woQuery += ` ORDER BY wo.created_at DESC LIMIT 10`;
        try {
          const [rows] = await pool.execute(woQuery, woParams);
          return rows;
        } catch (e) {
          console.log('Recent work orders error:', e.message);
          return [];
        }
      })()
    ]);

    // Get zone names for display
    let zoneNames = [];
    if (hasZones) {
      try {
        const [zones] = await pool.execute(
          `SELECT id, name FROM zones WHERE id IN (${assignedZones.map(() => '?').join(',')})`,
          assignedZones
        );
        zoneNames = zones.map(z => z.name);
      } catch (e) {}
    }

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
          completedWorkOrders: workOrderStats.completed + workOrderStats.closed,
          directEstimates: directEstimatesCount,
          propertyEstimates: propertyEstimatesCount,
          estimatesByPropertyType,
          estimatesByStatus,
          workOrdersByStatus: {
            pending: workOrderStats.pending,
            under_review: workOrderStats.under_review,
            assigned: workOrderStats.assigned,
            in_progress: workOrderStats.in_progress,
            completed: workOrderStats.completed,
            cancelled: workOrderStats.cancelled,
            closed: workOrderStats.closed
          },
          totalWorkOrders: workOrderStats.total
        },
        recentWorkOrders,
        assignedZones: zoneNames,
        isZoneFiltered: hasZones
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
    const { status } = req.query; // 'active', 'inactive', or 'all'
    
    // Get assigned zones for zone-centric filtering (+ own created data)
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    console.log('[Manager Properties] managerId:', managerId, 'franchisePartnerId:', franchisePartnerId, 'assignedZones:', assignedZones, 'status:', status || 'active');
    
    // Build status filter clause
    let statusClause;
    if (status === 'inactive') {
      statusClause = `AND p.status = 'inactive'`;
    } else if (status === 'all') {
      statusClause = `AND (p.status IS NULL OR p.status IN ('active', 'inactive'))`;
    } else {
      // Default: active only
      statusClause = `AND (p.status IS NULL OR p.status = 'active')`;
    }
    
    // Build zone filter (zone-centric + own created)
    const zoneFilter = buildPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'p');
    
    // Fetch from properties table with creator name - filter by FP for FP employees
    let propQuery = `SELECT p.*,
        COALESCE(z.name, zn.name, p.zone_id) as zone_name,
        COALESCE(p.area_name, p.city) as area,
        COALESCE(fd.name, p.division_id) as division_name,
        COALESCE(fd.name, p.division_id) as division,
        COALESCE(p.total_units, p.number_of_units) as total_units,
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
       LEFT JOIN users u ON p.created_by = u.email OR CAST(p.created_by AS UNSIGNED) = u.id
       WHERE ${franchisePartnerId ? 'p.franchise_partner_id = ?' : 'p.manager_id = ?'} ${statusClause}${zoneFilter.clause}
       ORDER BY p.created_at DESC`;
    const propParams = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [managerId, ...zoneFilter.params];
    console.log('[Manager Properties] Params:', propParams);
    const [regularProperties] = await pool.execute(propQuery, propParams);
    console.log('[Manager Properties] Found:', regularProperties.length, 'properties');

    // Also fetch from onboarded_properties with creator name (zone-centric + own created)
    // Only fetch if franchisePartnerId exists (onboarded_properties doesn't have manager_id column)
    // Build status filter for onboarded_properties
    let onbStatusClause;
    if (status === 'inactive') {
      onbStatusClause = `AND op.status = 'inactive'`;
    } else if (status === 'all') {
      onbStatusClause = `AND (op.status IS NULL OR op.status IN ('active', 'inactive'))`;
    } else {
      onbStatusClause = `AND (op.status IS NULL OR op.status = 'active')`;
    }
    
    let onboardedProperties = [];
    if (franchisePartnerId) {
      try {
        const onbZoneFilter = buildOnboardedPropertyZoneOrCreatorFilter(assignedZones, creatorEmail, 'op');
        let onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type, op.entry_type,
                  op.zone as zone_name, op.area_name as area, 
                  COALESCE(fd.name, op.division) as division, COALESCE(fd.name, op.division) as division_name,
                  op.total_units, op.number_of_units,
                  op.number_of_blocks, op.block_names, op.units_per_block, op.block_unit_types,
                  op.block_info, op.block_na, op.flat_block_info, op.flat_block_na,
                  op.villa_plot_number, op.plot_na,
                  op.address, op.city, op.state, op.postal_code as zip_code,
                  op.landmark, COALESCE(op.latitude, op.map_lat) as latitude, COALESCE(op.longitude, op.map_lng) as longitude, op.map_address,
                  op.association_contacts,
                  op.watchman_name, op.watchman_contact,
                  op.notes,
                  op.contact_person, op.contact_phone, op.contact_email as email,
                  COALESCE(
                    CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                    CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                    op.created_by, 'System'
                  ) as created_by_name,
                  op.created_at, op.status,
                  'onboarded_properties' as source_table
           FROM onboarded_properties op
           LEFT JOIN fp_divisions fd ON (CAST(op.division AS UNSIGNED) = fd.id OR op.division = fd.name) AND fd.franchise_partner_id = op.franchise_partner_id
           LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR op.created_by = fpe.username
           LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
           WHERE op.franchise_partner_id = ? ${onbStatusClause}${onbZoneFilter.clause}
           ORDER BY op.created_at DESC`;
        const onbParams = [franchisePartnerId, ...onbZoneFilter.params];
        const [rows] = await pool.execute(onbQuery, onbParams);
        onboardedProperties = rows;
      } catch (e) {
        console.log('onboarded_properties fetch error:', e.message);
      }
    }

    // Helper to compute total_units from units_per_block JSON
    const computeTotalUnits = (prop) => {
      if (prop.total_units) return prop.total_units;
      if (prop.number_of_units) return prop.number_of_units;
      if (prop.units_per_block) {
        try {
          const upb = typeof prop.units_per_block === 'string' ? JSON.parse(prop.units_per_block) : prop.units_per_block;
          if (typeof upb === 'object' && upb !== null) {
            return Object.values(upb).reduce((sum, block) => {
              if (typeof block === 'number') return sum + block;
              if (typeof block === 'object' && block.total) return sum + block.total;
              return sum;
            }, 0);
          }
        } catch (e) { /* ignore */ }
      }
      return null;
    };

    // Combine both sources and sort by created_at DESC
    const allProperties = [...regularProperties, ...onboardedProperties]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(prop => {
        // Extract Contact 1 from association_contacts JSON as primary contact
        let contact_person = prop.contact_person || '';
        let contact_phone = prop.contact_phone || '';
        let contact_email = prop.contact_email || prop.email || '';
        
        if (prop.association_contacts) {
          try {
            const contacts = typeof prop.association_contacts === 'string' 
              ? JSON.parse(prop.association_contacts) 
              : prop.association_contacts;
            if (Array.isArray(contacts) && contacts.length > 0) {
              // Contact 1 is the primary contact
              contact_person = contacts[0].name || contact_person;
              contact_phone = contacts[0].phone || contact_phone;
              contact_email = contacts[0].email || contact_email;
            }
          } catch (e) { /* ignore parse errors */ }
        }
        
        return {
          ...prop,
          contact_person,
          contact_phone,
          contact_email,
          total_units: computeTotalUnits(prop)
        };
      });

    res.json({ success: true, data: allProperties });
  } catch (error) {
    console.error('[Manager Properties ERROR]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property - dual-tag with manager_id AND franchise_partner_id
router.post('/properties', requireManagerScope, async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId, division } = req.body;
    
    const propertyId = `PROP-${Date.now()}`;
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
        contact_person, contact_phone, contact_email, zone_id, division, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode, 
       contactPerson, contactPhone, contactEmail, zoneId || null, division || null, managerId, franchisePartnerId, creatorName]
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
      `SELECT p.*, p.division as division_name, p.contact_person, p.contact_phone, p.contact_email
       FROM properties p
       WHERE (p.id = ? OR p.property_id = ?) AND p.${scopeColumn} = ?`,
      [id, id, scopeId]
    );
    
    if (properties.length > 0) {
      return res.json({ success: true, data: properties[0] });
    }
    
    // Try onboarded_properties table
    const [onboarded] = await pool.execute(
      `SELECT op.*, op.community_name as name, op.division as division_name, 
              op.contact_person, op.contact_phone, op.contact_email
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

// Update property (handles both properties and onboarded_properties)
router.put('/properties/:id', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    const sourceTable = updates.sourceTable || updates.source_table;

    // Check which table the property belongs to
    let tableName = 'properties';
    
    if (sourceTable === 'onboarded_properties') {
      tableName = 'onboarded_properties';
    } else {
      const [propCheck] = await pool.execute(
        `SELECT id FROM properties WHERE id = ? AND ${scopeColumn} = ?`,
        [id, scopeId]
      );
      
      if (propCheck.length === 0) {
        const [onboardedCheck] = await pool.execute(
          `SELECT id FROM onboarded_properties WHERE id = ? AND ${scopeColumn} = ?`,
          [id, scopeId]
        );
        
        if (onboardedCheck.length > 0) {
          tableName = 'onboarded_properties';
        } else {
          return res.status(404).json({ success: false, message: 'Property not found or access denied' });
        }
      }
    }

    const allowedFieldsMap = {
      properties: [
        'name', 'property_type', 'address', 'city', 'state', 'zip_code',
        'contact_person', 'contact_phone', 'contact_email', 'zone_id', 'division_id', 'area_name', 'is_active',
        'notes', 'landmark', 'latitude', 'longitude',
        'number_of_blocks', 'block_names', 'units_per_block', 'block_unit_types',
        'number_of_units', 'villa_plot_number', 'block_info', 'block_na',
        'watchman_name', 'watchman_contact', 'association_contacts', 'total_units'
      ],
      onboarded_properties: [
        'community_name', 'property_type', 'address', 'city', 'state', 'postal_code',
        'zone', 'division', 'area_name', 'status', 'number_of_units', 'total_units',
        'notes', 'landmark', 'map_lat', 'map_lng', 'map_address',
        'number_of_blocks', 'block_names', 'units_per_block', 'block_unit_types',
        'villa_plot_number', 'block_info', 'block_na',
        'watchman_name', 'watchman_contact', 'association_contacts'
      ]
    };

    const fieldMapping = {
      name: tableName === 'onboarded_properties' ? 'community_name' : 'name',
      zipCode: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zip_code: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zoneId: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      zone_id: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      divisionId: tableName === 'onboarded_properties' ? 'division' : 'division_id',
      division_id: tableName === 'onboarded_properties' ? 'division' : 'division_id',
      numberOfBlocks: 'number_of_blocks',
      blockNames: 'block_names',
      unitsPerBlock: 'units_per_block',
      blockUnitTypes: 'block_unit_types',
      numberOfUnits: 'number_of_units',
      villaPlotNumber: 'villa_plot_number',
      blockInfo: 'block_info',
      blockNA: 'block_na',
      watchmanName: 'watchman_name',
      watchmanContact: 'watchman_contact',
      associationContacts: 'association_contacts',
      totalUnits: 'total_units',
      areaName: 'area_name'
    };

    const jsonFields = ['block_names', 'units_per_block', 'block_unit_types', 'association_contacts'];

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
      
      // Serialize JSON fields
      if (jsonFields.includes(dbKey) && finalValue && typeof finalValue === 'object') {
        finalValue = JSON.stringify(finalValue);
      }
      
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(finalValue);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(id, scopeId);
    await pool.execute(
      `UPDATE ${tableName} SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      values
    );

    res.json({ success: true, message: 'Property updated' });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ success: false, message: 'Failed to update property', error: error.message });
  }
});

// Delete property - DISABLED for Manager role
router.delete('/properties/:id', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// Assign vendor to property - DISABLED for FP Manager
router.post('/properties/:id/assign-vendor', requireManagerScope, async (req, res) => {
  // FP Managers cannot assign vendors
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Assign vendor not allowed for this role' });
  }
  try {
    const { id } = req.params;
    const { vendorId, serviceType } = req.body;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || req.fpId;

    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    // Verify property access
    let property = [];
    if (franchisePartnerId) {
      [property] = await pool.execute(
        `SELECT id, name FROM properties WHERE id = ? AND franchise_partner_id = ?
         UNION
         SELECT id, community_name as name FROM onboarded_properties WHERE id = ? AND franchise_partner_id = ?`,
        [id, franchisePartnerId, id, franchisePartnerId]
      );
    } else {
      [property] = await pool.execute(
        `SELECT id, name FROM properties WHERE id = ? AND manager_id = ?`,
        [id, managerId]
      );
    }

    if (property.length === 0) {
      return res.status(403).json({ success: false, message: 'Cannot assign vendor to this property' });
    }

    // Verify vendor exists and get details
    const [vendor] = await pool.execute(
      `SELECT id, owner_name, service_type FROM onboarded_vendors WHERE (id = ? OR vendor_id = ?)${franchisePartnerId ? ' AND franchise_partner_id = ?' : ''}`,
      franchisePartnerId ? [vendorId, vendorId, franchisePartnerId] : [vendorId, vendorId]
    );

    if (vendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const numericVendorId = vendor[0].id;
    const assignedServiceType = serviceType || vendor[0].service_type || 'General';

    // Check if this vendor is already assigned and active
    const [existingActive] = await pool.execute(
      `SELECT id FROM property_vendor_assignments WHERE property_id = ? AND vendor_id = ? AND is_active = 1`,
      [id, numericVendorId]
    );

    if (existingActive.length > 0) {
      return res.status(400).json({ success: false, message: 'This vendor is already assigned to this property' });
    }

    // Check if any assignment exists for this property + vendor (active or inactive)
    const [existingAny] = await pool.execute(
      `SELECT id FROM property_vendor_assignments WHERE property_id = ? AND vendor_id = ?`,
      [id, numericVendorId]
    );

    // Deactivate other vendors for this property + service type
    await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 0 WHERE property_id = ? AND service_type = ? AND is_active = 1 AND vendor_id != ?`,
      [id, assignedServiceType, numericVendorId]
    );

    if (existingAny.length > 0) {
      // Update existing record
      await pool.execute(
        `UPDATE property_vendor_assignments SET service_type = ?, assigned_by = ?, assigned_at = NOW(), is_active = 1 WHERE property_id = ? AND vendor_id = ?`,
        [assignedServiceType, req.user?.id || managerId, id, numericVendorId]
      );
    } else {
      // Create new assignment
      await pool.execute(
        `INSERT INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
         VALUES (?, ?, ?, ?, NOW(), TRUE)`,
        [id, numericVendorId, assignedServiceType, req.user?.id || managerId]
      );
    }

    // Also update the property's assigned_vendor_id for backward compatibility
    await pool.execute(
      `UPDATE properties SET assigned_vendor_id = ?, updated_at = NOW() WHERE id = ?`,
      [numericVendorId, id]
    );

    res.json({ success: true, message: 'Vendor assigned to property', data: { vendorName: vendor[0].owner_name } });
  } catch (error) {
    console.error('Assign vendor error:', error);
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
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    console.log('[Manager Work Orders] managerId:', managerId, 'franchisePartnerId:', franchisePartnerId, 'assignedZones:', assignedZones, 'creatorEmail:', creatorEmail);
    
    // Build zone filter for properties linked to work orders (zone-centric + own created)
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    // FP employees see FP work orders, standalone managers see their created work orders
    // Priority: onboarded_properties first, then properties (only if no match)
    let query = `SELECT wo.*, 
                        COALESCE(op.community_name, p.name, wo.property_name) as property_name,
                        COALESCE(op.property_id, p.property_id) as property_code,
                        COALESCE(op.property_id, p.property_id) as actual_property_id,
                        COALESCE(op.property_type, p.property_type, wo.property_type) as property_type,
                        COALESCE(op.zone, z.name, p.zone_id) as zone, 
                        COALESCE(op.division, p.division_id) as division,
                        COALESCE(op.address, p.address) as property_address, 
                        COALESCE(op.city, p.city) as property_city,
                        op.total_units, op.number_of_blocks as total_blocks,
                        COALESCE(c.name, wo.category_name) as category_name, v.company_name as vendor_name,
                        COALESCE(op.latitude, op.map_lat, p.latitude) as property_latitude,
                        COALESCE(op.longitude, op.map_lng, p.longitude) as property_longitude,
                        COALESCE(op.map_location, p.map_location) as property_map_location,
                        COALESCE(
                          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                          wo.created_by, 'System'
                        ) as created_by_name
                 FROM work_orders wo
                 LEFT JOIN onboarded_properties op ON wo.property_id = op.id
                 LEFT JOIN properties p ON wo.property_id = p.id AND op.id IS NULL
                 LEFT JOIN zones z ON CAST(COALESCE(op.zone, p.zone_id) AS UNSIGNED) = z.id OR COALESCE(op.zone, p.zone_id) = z.name
                 LEFT JOIN categories c ON wo.category_id = c.id
                 LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
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
    
    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }
    
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
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    // Priority: onboarded_properties first, then properties (only if no match)
    const query = `SELECT wo.*, 
              COALESCE(op.community_name, p.name, wo.property_name) as property_name,
              COALESCE(op.property_id, p.property_id) as property_code,
              COALESCE(op.property_id, p.property_id) as actual_property_id,
              COALESCE(op.property_type, p.property_type, wo.property_type) as property_type,
              COALESCE(op.zone, z.name, p.zone_id) as zone, 
              COALESCE(op.division, p.division_id) as division,
              COALESCE(op.address, p.address) as property_address, 
              COALESCE(op.city, p.city) as property_city,
              op.total_units, op.number_of_blocks as total_blocks,
              COALESCE(c.name, wo.category_name) as category_name, v.company_name as vendor_name,
              COALESCE(op.latitude, op.map_lat, p.latitude) as property_latitude,
              COALESCE(op.longitude, op.map_lng, p.longitude) as property_longitude,
              COALESCE(op.map_location, p.map_location) as property_map_location
       FROM work_orders wo
       LEFT JOIN onboarded_properties op ON wo.property_id = op.id
       LEFT JOIN properties p ON wo.property_id = p.id AND op.id IS NULL
       LEFT JOIN zones z ON CAST(COALESCE(op.zone, p.zone_id) AS UNSIGNED) = z.id OR COALESCE(op.zone, p.zone_id) = z.name
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status NOT IN ('completed', 'closed', 'cancelled')${zoneFilter.clause}
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];
    
    const [workOrders] = await pool.execute(query, params);
    
    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }
    
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
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    const zoneFilter = buildWorkOrderZoneOrCreatorFilter(assignedZones, creatorEmail, 'p', 'wo');
    
    // Priority: onboarded_properties first, then properties (only if no match)
    const query = `SELECT wo.*, 
              COALESCE(op.community_name, p.name, wo.property_name) as property_name,
              COALESCE(op.property_id, p.property_id) as property_code,
              COALESCE(op.property_id, p.property_id) as actual_property_id,
              COALESCE(op.property_type, p.property_type, wo.property_type) as property_type,
              COALESCE(op.zone, z.name, p.zone_id) as zone, 
              COALESCE(op.division, p.division_id) as division,
              COALESCE(op.address, p.address) as property_address, 
              COALESCE(op.city, p.city) as property_city,
              op.total_units, op.number_of_blocks as total_blocks,
              COALESCE(c.name, wo.category_name) as category_name, v.company_name as vendor_name,
              COALESCE(op.latitude, op.map_lat, p.latitude) as property_latitude,
              COALESCE(op.longitude, op.map_lng, p.longitude) as property_longitude,
              COALESCE(op.map_location, p.map_location) as property_map_location
       FROM work_orders wo
       LEFT JOIN onboarded_properties op ON wo.property_id = op.id
       LEFT JOIN properties p ON wo.property_id = p.id AND op.id IS NULL
       LEFT JOIN zones z ON CAST(COALESCE(op.zone, p.zone_id) AS UNSIGNED) = z.id OR COALESCE(op.zone, p.zone_id) = z.name
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('completed', 'closed')${zoneFilter.clause}
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId, ...zoneFilter.params] : [creatorEmail, ...zoneFilter.params];
    
    const [workOrders] = await pool.execute(query, params);
    
    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }
    
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create work order
router.post('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { propertyId, categoryId, subcategoryId, customSubcategory, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate,
            propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone } = req.body;
    
    // Get category details to check if it's "Other" category
    const categoriesConfig = require('../config/categories');
    const category = categoriesConfig.find(c => c.id === parseInt(categoryId) || c.id === categoryId);
    const isOtherCategory = category?.isCustom || category?.name === 'Other';

    // Backend validation - prevent empty work orders
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property is required' });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ success: false, message: 'Customer phone is required' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }
    // Validate subcategory - require customSubcategory for "Other" category
    if (isOtherCategory) {
      if (!customSubcategory || !customSubcategory.trim()) {
        return res.status(400).json({ success: false, message: 'Please enter a subcategory' });
      }
    } else if (!subcategoryId) {
      return res.status(400).json({ success: false, message: 'Subcategory is required' });
    }

    const workOrderId = `WO-${Date.now()}`;
    
    // For FP-created managers: store BOTH franchise_partner_id AND manager_id
    // So work order shows in both FP dashboard and Manager dashboard
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || req.fpId || null;
    console.log('[Manager WO Create] ManagerID:', managerId, 'FP:', franchisePartnerId);

    // Fetch property details if not provided - including actual property_id, zone, and division
    // Priority: onboarded_properties first (for FP context), then properties table
    let finalPropertyName = propertyName;
    let finalPropertyType = null;
    let actualPropertyId = null;
    let propertyZone = null;
    let propertyDivision = null;
    if (propertyId) {
      // First check onboarded_properties (FP context)
      const [onbProps] = await pool.execute(
        `SELECT community_name as name, property_type, property_id, zone, division FROM onboarded_properties WHERE id = ?`,
        [propertyId]
      );
      if (onbProps.length > 0) {
        finalPropertyName = finalPropertyName || onbProps[0].name;
        finalPropertyType = onbProps[0].property_type;
        actualPropertyId = onbProps[0].property_id;
        propertyZone = onbProps[0].zone;
        propertyDivision = onbProps[0].division;
      } else {
        // Fallback to properties table
        const [props] = await pool.execute(
          `SELECT name, property_type, property_id, zone_id as zone, COALESCE(division_id, division) as division FROM properties WHERE id = ?`,
          [propertyId]
        );
        if (props.length > 0) {
          finalPropertyName = finalPropertyName || props[0].name;
          finalPropertyType = props[0].property_type;
          actualPropertyId = props[0].property_id;
          propertyZone = props[0].zone;
          propertyDivision = props[0].division;
        }
      }
    }

    // Fetch zone name from zones table if zone_id exists
    let zoneName = propertyZone || null;
    if (propertyZone && !isNaN(parseInt(propertyZone))) {
      const [zoneData] = await pool.execute('SELECT name FROM zones WHERE id = ?', [parseInt(propertyZone)]);
      if (zoneData.length > 0) {
        zoneName = zoneData[0].name;
      }
    }

    // Fetch division name from fp_divisions table if division exists
    let divisionName = propertyDivision || null;
    if (propertyDivision && franchisePartnerId) {
      const [divData] = await pool.execute(
        'SELECT name FROM fp_divisions WHERE (id = ? OR name = ?) AND franchise_partner_id = ?',
        [parseInt(propertyDivision) || 0, propertyDivision, franchisePartnerId]
      );
      if (divData.length > 0) {
        divisionName = divData[0].name;
      }
    }

    // Get category and subcategory names - use customSubcategory for "Other" category
    let finalCategoryName = categoryName || category?.name;
    let finalSubcategoryName = subcategoryName;
    if (isOtherCategory && customSubcategory) {
      finalSubcategoryName = customSubcategory.trim();
    } else if (!finalSubcategoryName && subcategoryId && category?.subcategories) {
      const subcat = category.subcategories.find(s => s.id === parseInt(subcategoryId) || s.id === subcategoryId);
      if (subcat) finalSubcategoryName = subcat.name;
    }
    
    // Get creator identifier for zone-centric filtering
    const createdBy = req.user?.email || req.user?.username || `manager-${managerId}`;

    // Get the subcategory ID (use null for "Other" category with custom subcategory)
    const finalSubcategoryId = isOtherCategory ? null : (subcategoryId || null);
    
    const [result] = await pool.execute(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, subcategory_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, status, franchise_partner_id, created_by, created_at,
        property_name, category_name, subcategory_name, customer_name, customer_email, customer_phone, zone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [workOrderId, propertyId || null, categoryId || null, finalSubcategoryId, clientId || null, title || null, description || null,
       priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null,
       franchisePartnerId || null, createdBy,
       finalPropertyName || null, finalCategoryName || null, finalSubcategoryName || null,
       customerName || null, customerEmail || null, customerPhone || null, propertyZone]
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
      zoneName: zoneName,
      division: divisionName,
      categoryName: finalCategoryName,
      subcategoryName: finalSubcategoryName,
      priority,
      description,
      createdBy: req.user?.username || req.user?.email || 'Manager',
      createdByRole: 'Manager',
      franchisePartnerId: franchisePartnerId,
      propertyZone: propertyZone
    }).catch(err => console.error('Email notification error:', err));

    res.json({ success: true, message: 'Work order created', data: { id: result.insertId, workOrderId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update work order status - Manager can only update their own work orders
router.patch('/work-orders/:id/status', requireManagerScope, async (req, res) => {
  try {
    const { status, notes, closingNotes, cancelNote, cancellationNote } = req.body;
    const managerId = req.managerId;
    
    // Build update query - include notes if cancelling or closing notes if completing
    let updateQuery = `UPDATE work_orders SET status = ?, updated_at = NOW()`;
    const params = [status];
    
    if (status === 'cancelled') {
      const cancellationNoteValue = cancelNote || cancellationNote || notes || null;
      updateQuery += `, cancellation_note = ?, cancelled_at = NOW()`;
      params.push(cancellationNoteValue);
    }
    
    if (status === 'completed') {
      updateQuery += `, closing_notes = ?, completed_date = NOW()`;
      params.push(closingNotes || null);
    }
    
    updateQuery += ` WHERE id = ? AND (created_by = ? OR created_by LIKE ? OR franchise_partner_id = ?)`;
    params.push(req.params.id, req.user?.email || '', `manager-${managerId}`, req.fpId || 0);
    
    await pool.execute(updateQuery, params);

    // Send completion email if status is completed
    if (status === 'completed') {
      console.log('[Manager] Status changed to completed, sending email...');
      const [workOrder] = await pool.execute(
        `SELECT wo.work_order_id, wo.title, 
                COALESCE(p.name, op.community_name, wo.property_name) as property_name,
                COALESCE(p.property_id, op.property_id, wo.property_id) as property_code,
                wo.customer_name, wo.customer_email, wo.customer_phone, 
                wo.category_name, wo.subcategory_name, wo.description, wo.closing_notes, wo.franchise_partner_id,
                COALESCE(p.zone_id, op.zone) as property_zone,
                COALESCE(fd.name, fd2.name, p.division_id, op.division) as division
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN onboarded_properties op ON wo.property_id = op.id
         LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = wo.franchise_partner_id
         LEFT JOIN fp_divisions fd2 ON (CAST(op.division AS UNSIGNED) = fd2.id OR op.division = fd2.name) AND fd2.franchise_partner_id = wo.franchise_partner_id
         WHERE wo.id = ?`, [req.params.id]
      );
      console.log('[Manager] Work order data:', workOrder[0]);
      if (workOrder.length > 0) {
        // Fetch zone name from zones table
        let zoneName = workOrder[0].property_zone || null;
        if (workOrder[0].property_zone && !isNaN(parseInt(workOrder[0].property_zone))) {
          const [zoneData] = await pool.execute('SELECT name FROM zones WHERE id = ?', [parseInt(workOrder[0].property_zone)]);
          if (zoneData.length > 0) zoneName = zoneData[0].name;
        }
        
        const { sendWorkOrderCompletedNotification } = require('../services/emailService');
        try {
          await sendWorkOrderCompletedNotification({
            orderId: req.params.id,
            orderNumber: workOrder[0].work_order_id,
            title: workOrder[0].title,
            propertyName: workOrder[0].property_name,
            propertyId: workOrder[0].property_code,
            customerName: workOrder[0].customer_name,
            customerEmail: workOrder[0].customer_email,
            customerPhone: workOrder[0].customer_phone,
            zoneName: zoneName,
            division: workOrder[0].division,
            categoryName: workOrder[0].category_name,
            subcategoryName: workOrder[0].subcategory_name,
            description: workOrder[0].description,
            closingNotes: workOrder[0].closing_notes,
            completedBy: req.user?.username || req.user?.email || 'Manager',
            completedByRole: 'Manager',
            completedAt: new Date(),
            franchisePartnerId: workOrder[0].franchise_partner_id,
            propertyZone: workOrder[0].property_zone
          });
          console.log('[Manager] Completion email sent');
        } catch (err) {
          console.error('[Manager] Completion email error:', err);
        }
        
        // Auto-generate invoice for completed work order
        try {
          const { generateInvoiceFromWorkOrder } = require('../services/invoiceService');
          const invoiceResult = await generateInvoiceFromWorkOrder(req.params.id, req.user?.id);
          if (invoiceResult.success && !invoiceResult.alreadyExists && invoiceResult.invoiceId) {
            console.log(`[Manager] Auto-generated invoice ${invoiceResult.invoiceId} for work order`);
          }
        } catch (invoiceErr) {
          console.error('[Manager] Invoice generation error:', invoiceErr);
        }
      }
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign vendor to work order
router.patch('/work-orders/:id/assign-vendor', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || req.fpId;
    const creatorEmail = getCreatorIdentifier(req);

    // Validate access - FP managers use franchise_partner_id, others use manager_id/created_by
    let accessQuery, accessParams;
    if (franchisePartnerId) {
      accessQuery = 'SELECT id FROM work_orders WHERE id = ? AND franchise_partner_id = ?';
      accessParams = [id, franchisePartnerId];
    } else {
      accessQuery = 'SELECT id FROM work_orders WHERE id = ? AND (manager_id = ? OR created_by = ? OR created_by = ?)';
      accessParams = [id, managerId, managerId, creatorEmail];
    }
    
    const [accessCheck] = await pool.query(accessQuery, accessParams);
    if (accessCheck.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied: Record does not belong to your account' });
    }
    
    await pool.execute(
      `UPDATE work_orders SET assigned_vendor_id = ?, status = 'assigned', updated_at = NOW() WHERE id = ?`,
      [vendorId, id]
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
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
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
      numberOfUnits, villaPlotNumber, blockInfo, blockNA, flatBlockInfo, flatBlockNA, plotNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      watchmanName, watchmanContact,
      // Simple customer data (for backward compatibility)
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;

    // Check if this is a property form submission (has zone/communityName)
    if (zone && communityName) {
      // Generate IDs
      const prefixMap = { GC: 'GC', APT: 'APT', VILLA: 'V', PLOT: 'PL', FLAT: 'FL' };
      const prefix = prefixMap[entryType] || 'PROP';
      const propertyIdGen = `${prefix}-${Date.now()}`;
      const clientId = `CLT-${Date.now()}`;
      
      // Get contact info
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      // Create property in onboarded_properties (same as FP portal)
      const [propertyResult] = await pool.execute(
        `INSERT INTO onboarded_properties (
          property_id, community_name, property_type, address, city, state, postal_code,
          contact_person, contact_phone, contact_email, zone, division,
          manager_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info, block_na,
          flat_block_info, flat_block_na, plot_na,
          watchman_name, watchman_contact, association_contacts, total_units, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          propertyIdGen, communityName, entryType || propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          managerId, franchisePartnerId, req.user?.username || req.user?.email || req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || '', blockNA ? 1 : 0,
          flatBlockInfo || '', flatBlockNA ? 1 : 0, plotNA ? 1 : 0,
          watchmanName || null, watchmanContact || null, JSON.stringify(associationContacts || []), numberOfUnits || null
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
              customer_id, first_name, last_name, email, phone, temp_password_hash, property_id, property_code,
              activation_token, activation_expires, is_activated, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientId, contactName, '', contactEmail.toLowerCase(), `${contactCountryCode}${contactPhone}`,
              tempPasswordHash, propertyResult.insertId, propertyIdGen, activationToken, activationExpires, 0, 'manager'
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
              propertyName: communityName,
              propertyId: propertyIdGen
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
              propertyName: communityName,
              propertyId: propertyIdGen
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
      const clientId = `CLT-${Date.now()}`;
      
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
              propertyName: companyName || 'XLAND INFRA',
              propertyId: propertyId || clientId
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
              propertyName: companyName || 'XLAND INFRA',
              propertyId: propertyId || clientId
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

// Get vendor assignments for a specific property
router.get('/vendors/assignments/property/:propertyId', requireManagerScope, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property ID is required' });
    }

    // Verify property belongs to this FP
    const [property] = await pool.execute(
      `SELECT id FROM properties WHERE id = ? AND ${scopeColumn} = ?
       UNION
       SELECT id FROM onboarded_properties WHERE id = ? AND ${scopeColumn} = ?`,
      [propertyId, scopeId, propertyId, scopeId]
    );

    if (property.length === 0) {
      return res.status(403).json({ success: false, message: 'Property not found or access denied' });
    }

    // Get all active vendor assignments for this property
    const [assignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.service_type, pva.assigned_at, pva.is_active,
        ov.vendor_id as vendor_code, 
        COALESCE(ov.company_name, ov.owner_name) as vendor_name, 
        ov.service_type as vendor_service_type,
        COALESCE(ov.zone_name, ov.zone) as zone_name
       FROM property_vendor_assignments pva
       JOIN onboarded_vendors ov ON pva.vendor_id = ov.id
       WHERE pva.property_id = ? AND pva.is_active = 1
       ORDER BY pva.service_type`,
      [propertyId]
    );

    // Format for frontend
    const serviceAssignments = assignments.map(a => ({
      id: a.id,
      propertyId: a.property_id,
      vendorId: a.vendor_code,
      vendorDbId: a.vendor_id,
      vendorName: a.vendor_name,
      serviceType: a.service_type,
      vendorServiceType: a.vendor_service_type,
      zoneName: a.zone_name,
      assignedAt: a.assigned_at
    }));

    res.json({
      success: true,
      data: serviceAssignments
    });
  } catch (error) {
    console.error('Get property vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch property assignments', error: error.message });
  }
});

// Get vendor assignments for Manager portal (view-only) (ZONE-CENTRIC)
router.get('/vendors/assignments', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    // Get assigned zones for zone-centric filtering
    const assignedZones = await getAssignedZones(employeeId, creatorEmail);
    
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
      `SELECT pva.id, pva.property_id as numeric_property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        COALESCE(pva.service_type, v.service_type) as service_type,
        COALESCE(p.name, op.community_name) as property_name, 
        COALESCE(p.property_id, op.property_id) as property_code, 
        COALESCE(op.property_type, p.property_type) as property_type, 
        COALESCE(op.address, p.address) as address, 
        COALESCE(op.city, p.city) as city,
        v.owner_name as vendor_name, v.vendor_id as vendor_code,
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
    // IMPORTANT: propertyId must be the NUMERIC ID for filtering to work
    const serviceAssignments = propertyAssignments.map(a => ({
      id: a.id,
      propertyId: a.numeric_property_id,
      property_id: a.numeric_property_id,
      propertyCode: a.property_code,
      property_code: a.property_code,
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
    
    const vendorId = `VND-${Date.now()}`;
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

// Get all employees - For FP Managers, returns FP employees with zone assignments
router.get('/employees', requireManagerScope, async (req, res) => {
  try {
    // Only FP Managers can access employee data
    if (!req.isFPManager || !req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'Employee management not available for standalone managers' });
    }

    // Get all employees for this FP (including managers so they can modify their own zones and other managers' zones)
    // JOIN with users table to get the formatted user_id (MGR001, COORD001, etc.)
    const [employees] = await pool.execute(
      `SELECT e.id, u.user_id as employee_id, e.first_name, e.last_name, 
              CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.country_code, e.role, e.is_active
       FROM fp_employees e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       ORDER BY FIELD(e.role, 'manager', 'coordinator', 'supervisor', 'executive'), e.first_name, e.last_name`,
      [req.franchisePartnerId]
    );

    // Get zone assignments
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?`,
      [req.franchisePartnerId]
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

    // Transform employees with their zones
    const transformedEmployees = employees.map(emp => ({
      ...emp,
      assignedZones: employeeZonesMap[emp.id] || [],
      assigned_zones: employeeZonesMap[emp.id] || []
    }));

    res.json({ success: true, data: transformedEmployees });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create employee - DISABLED for Manager role (FP handles employee creation)
router.post('/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee creation is managed by the Franchise Partner' });
});

// Update employee - DISABLED for Manager role (FP handles employee updates)
router.put('/employees/:id', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee updates are managed by the Franchise Partner' });
});

// Update employee zones - For FP Managers to assign zones
router.put('/employees/:id/zones', requireManagerScope, async (req, res) => {
  try {
    // Only FP Managers can update zones
    if (!req.isFPManager || !req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'Zone management not available for standalone managers' });
    }

    const { id } = req.params;
    const { zones } = req.body;
    
    console.log('[Manager] Updating zones for employee:', id, 'FP:', req.franchisePartnerId, 'Zones:', zones);
    
    // Verify employee belongs to this FP
    const [empCheck] = await pool.execute(
      `SELECT id FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.franchisePartnerId]
    );
    
    if (empCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    // Delete existing zone assignments
    await pool.execute(
      `DELETE FROM fp_employee_zones WHERE fp_employee_id = ? AND franchise_partner_id = ?`,
      [id, req.franchisePartnerId]
    );
    
    // Insert new zone assignments - handle "all" zones case
    if (zones === 'all') {
      await pool.execute(
        `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name) VALUES (?, ?, ?)`,
        [req.franchisePartnerId, id, 'all']
      );
    } else if (Array.isArray(zones) && zones.length > 0) {
      for (const zoneName of zones) {
        await pool.execute(
          `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name) VALUES (?, ?, ?)`,
          [req.franchisePartnerId, id, zoneName]
        );
      }
    }
    
    res.json({ success: true, message: 'Employee zones updated successfully' });
  } catch (error) {
    console.error('[Manager] Update employee zones error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete employee - DISABLED for Manager role (FP handles employee deletion)
router.delete('/employees/:id', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee deletion is managed by the Franchise Partner' });
});

// View FP employee zone assignments (READ-ONLY for managers under FP) - ZONE-CENTRIC
router.get('/fp-employee-zones', requireManagerScope, async (req, res) => {
  try {
    // Only available for managers under FP
    if (!req.isFPManager || !req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP managers' });
    }

    // Get all employees for this FP
    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active
       FROM fp_employees e
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       ORDER BY e.first_name, e.last_name`,
      [req.franchisePartnerId]
    );

    // Get zone assignments separately (using zone_name directly, not zone_id)
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?`,
      [req.franchisePartnerId]
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
      [req.franchisePartnerId]
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

// ============================================
// ESTIMATES MANAGEMENT
// ============================================

// Get all manager estimates - Zone-centric + own created
router.get('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { archived, property_id } = req.query;
    const isArchived = archived === 'true';
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeId = getEmployeeIdForZoneLookup(req);
    const creatorEmail = getCreatorIdentifier(req);
    
    let estimates = [];
    
    // If manager is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      // Build property filter if property_id is provided
      let propertyClause = '';
      let propertyParams = [];
      if (property_id) {
        // Filter by property_code (the actual property ID like GC-xxx, APT-xxx, etc.)
        // property_id column is INT, so only compare property_code for string codes
        const numericId = parseInt(property_id);
        if (isNaN(numericId)) {
          // String property code like GC-xxx, APT-xxx
          propertyClause = ` AND e.property_code = ?`;
          propertyParams = [property_id];
        } else {
          // Numeric property ID
          propertyClause = ` AND (e.property_code = ? OR e.property_id = ?)`;
          propertyParams = [property_id, numericId];
        }
      } else {
        // Get assigned zones only when not filtering by property
        const assignedZones = await getAssignedZones(employeeId, creatorEmail);
        
        // Build zone + creator filter - match by created_by_id OR created_by_name (name, email, or username)
        if (assignedZones.length > 0) {
          const placeholders = assignedZones.map(() => '?').join(',');
          propertyClause = ` AND (e.zone IN (${placeholders}) OR e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
          propertyParams = [...assignedZones, managerId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
        } else {
          // No zones = only see own created (by ID or by name/email/username)
          propertyClause = ` AND (e.created_by_id = ? OR e.created_by_name = ? OR e.created_by_name = ? OR e.created_by_name LIKE ?)`;
          propertyParams = [managerId, creatorEmail, req.user?.username || '', `%${req.user?.first_name || ''}%`];
        }
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
         WHERE e.franchise_partner_id = ? AND ${isArchived ? 'e.is_archived = 1' : '(e.is_archived = 0 OR e.is_archived IS NULL)'}${propertyClause}
         ORDER BY e.created_at DESC`,
        [franchisePartnerId, ...propertyParams]
      );
      
      // Get FP addons for description lookup
      let fpAddons = [];
      try {
        const [addonResults] = await pool.execute(
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
                // Priority 1: Match by exact ID
                let foundAddon = fpAddons.find(a => a.id == addonId);
                // Priority 2: Match by name AND property_type
                if (!foundAddon || !foundAddon.description) {
                  foundAddon = fpAddons.find(a => 
                    (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                    a.property_type?.toUpperCase() === estPropertyType
                  );
                }
                if (foundAddon && foundAddon.description) {
                  addon.description = foundAddon.description;
                }
              }
              return addon;
            });
          } catch(e) {}
        }
        
        // Get original property_code and contact info from onboarded_properties or properties table
        let property_code = est.property_code;
        let client_phone = est.client_phone;
        let client_email = est.client_email;
        const propId = est.property_id;
        const propName = est.property_name || '';
        
        // Always try to fetch the original property_id and contact info from the property tables
        if (propId || propName) {
          try {
            // Try onboarded_properties first (admin-created properties visible to FP)
            let [props] = await pool.execute(
              `SELECT property_id as orig_code, contact_phone, contact_email, association_contacts FROM onboarded_properties 
               WHERE (id = ? OR community_name = ?) LIMIT 1`,
              [propId || 0, propName]
            );
            if (props.length > 0) {
              if (props[0].orig_code) property_code = props[0].orig_code;
              if (!client_phone && props[0].contact_phone) client_phone = props[0].contact_phone;
              if (!client_email && props[0].contact_email) client_email = props[0].contact_email;
              // Check association_contacts JSON if still missing
              if ((!client_phone || !client_email) && props[0].association_contacts) {
                try {
                  const contacts = typeof props[0].association_contacts === 'string' 
                    ? JSON.parse(props[0].association_contacts) : props[0].association_contacts;
                  if (Array.isArray(contacts) && contacts.length > 0) {
                    if (!client_phone && contacts[0].phone) client_phone = contacts[0].phone;
                    if (!client_email && contacts[0].email) client_email = contacts[0].email;
                  }
                } catch (e) {}
              }
            }
            
            // Try properties table (FP-created properties) if still missing
            if (!property_code || !client_phone || !client_email) {
              [props] = await pool.execute(
                `SELECT property_id as orig_code, contact_phone, contact_email, association_contacts FROM properties 
                 WHERE (id = ? OR name = ?) AND franchise_partner_id = ? LIMIT 1`,
                [propId || 0, propName, franchisePartnerId]
              );
              if (props.length > 0) {
                if (!property_code && props[0].orig_code) property_code = props[0].orig_code;
                if (!client_phone && props[0].contact_phone) client_phone = props[0].contact_phone;
                if (!client_email && props[0].contact_email) client_email = props[0].contact_email;
                // Check association_contacts JSON if still missing
                if ((!client_phone || !client_email) && props[0].association_contacts) {
                  try {
                    const contacts = typeof props[0].association_contacts === 'string' 
                      ? JSON.parse(props[0].association_contacts) : props[0].association_contacts;
                    if (Array.isArray(contacts) && contacts.length > 0) {
                      if (!client_phone && contacts[0].phone) client_phone = contacts[0].phone;
                      if (!client_email && contacts[0].email) client_email = contacts[0].email;
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (e) { console.log('Property lookup error:', e.message); }
        }
        
        return { ...est, addons, property_code, client_phone, client_email, created_by_name: est.created_by_name || 'Franchise Partner' };
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
      description, number_of_blocks, block_names, units_per_block, block_unit_types, total_units,
      tower_name, block_number, villa_plot_number, division,
      flat_number, villa_number, plot_number, billing_duration
    } = req.body;
    
    const estimateId = `EST-${Date.now()}`;
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
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN billing_duration VARCHAR(50) DEFAULT 'yearly'`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN block_unit_types JSON`);
    } catch (e) { /* Column exists */ }

    const [result] = await pool.execute(
      `INSERT INTO fp_estimates (
        estimate_id, franchise_partner_id, property_id, estimate_type,
        client_name, client_phone, client_email, property_name, property_code, property_type,
        zone, city, address, package_id, package_name, package_price, amc_package_description, package_services, billing_duration,
        subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
        addons_data, description, created_by_id, created_by_name, created_by_role, status,
        number_of_blocks, block_names, units_per_block, block_unit_types, total_units, tower_name, block_number, villa_plot_number, division,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        estimateId, franchisePartnerId, propertyIdValue, estimate_type || 'property_based',
        client_name || '', client_phone || '', client_email || '',
        property_name || '', property_code || property_id || '', property_type || '',
        zone || '', city || '', address || '',
        package_id || null, package_name || '', package_price || 0, amc_package_description || '', package_services ? JSON.stringify(package_services) : null, billing_duration || 'yearly',
        subtotal || 0, discount_percent || 0, discount_amount || 0,
        gst_percent || 0, gst_amount || 0, total_amount || 0,
        JSON.stringify(addons || []), description || '', managerId, creatorName, 'manager',
        number_of_blocks || null, block_names ? JSON.stringify(block_names) : null, 
        units_per_block ? JSON.stringify(units_per_block) : null, block_unit_types ? JSON.stringify(block_unit_types) : null, total_units || null,
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

// Update estimate details (for direct estimates)
router.put('/estimates/:id', requireManagerScope, async (req, res) => {
  try {
    const estimateId = req.params.id;
    const scopeId = getScopeId(req);
    
    // Verify estimate exists and belongs to this manager's scope
    let existing;
    if (req.isFPManager) {
      [[existing]] = await pool.execute(
        'SELECT * FROM fp_estimates WHERE id = ? AND franchise_partner_id = ?',
        [estimateId, scopeId]
      );
    } else {
      [[existing]] = await pool.execute(
        'SELECT * FROM estimates WHERE id = ? AND manager_id = ?',
        [estimateId, scopeId]
      );
    }
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Estimate not found' });
    }
    
    const {
      client_name, client_phone, client_email,
      property_name, property_type, zone, city, address,
      package_id, package_name, package_price, amc_package_description, package_services, billing_duration,
      subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
      addons_data, description
    } = req.body;
    
    const safeNum = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
    const packageServicesJson = package_services ? JSON.stringify(package_services) : null;
    const addonsJson = addons_data ? JSON.stringify(addons_data) : null;
    
    if (req.isFPManager) {
      await pool.execute(
        `UPDATE fp_estimates SET
          client_name = ?, client_phone = ?, client_email = ?,
          property_name = ?, property_type = ?, zone = ?, city = ?, address = ?,
          package_id = ?, package_name = ?, package_price = ?, amc_package_description = ?, package_services = ?, billing_duration = ?,
          subtotal = ?, discount_percent = ?, discount_amount = ?, gst_percent = ?, gst_amount = ?, total_amount = ?,
          addons_data = ?, description = ?, updated_at = NOW()
        WHERE id = ? AND franchise_partner_id = ?`,
        [
          client_name || existing.client_name, client_phone || existing.client_phone, client_email || existing.client_email,
          property_name || existing.property_name, property_type || existing.property_type, zone || existing.zone, city || existing.city, address || existing.address,
          package_id || existing.package_id, package_name || existing.package_name, safeNum(package_price, existing.package_price),
          amc_package_description || existing.amc_package_description, packageServicesJson || existing.package_services, billing_duration || existing.billing_duration,
          safeNum(subtotal, 0), safeNum(discount_percent, 0), safeNum(discount_amount, 0), safeNum(gst_percent, 0), safeNum(gst_amount, 0), safeNum(total_amount, 0),
          addonsJson || existing.addons_data, description !== undefined ? description : existing.description,
          estimateId, scopeId
        ]
      );
    } else {
      await pool.execute(
        `UPDATE estimates SET
          customer_name = ?, customer_phone = ?, customer_email = ?,
          property_name = ?, property_type = ?, zone = ?, city = ?, address = ?,
          package_id = ?, package_name = ?, package_price = ?,
          subtotal = ?, discount = ?, tax = ?, total = ?,
          addons = ?, notes = ?, updated_at = NOW()
        WHERE id = ? AND manager_id = ?`,
        [
          client_name || existing.customer_name, client_phone || existing.customer_phone, client_email || existing.customer_email,
          property_name || existing.property_name, property_type || existing.property_type, zone || existing.zone, city || existing.city, address || existing.address,
          package_id || existing.package_id, package_name || existing.package_name, safeNum(package_price, existing.package_price),
          safeNum(subtotal, 0), safeNum(discount_amount, 0), safeNum(gst_amount, 0), safeNum(total_amount, 0),
          addonsJson || existing.addons, description !== undefined ? description : existing.notes,
          estimateId, scopeId
        ]
      );
    }
    
    res.json({ success: true, message: 'Estimate updated successfully' });
  } catch (error) {
    console.error('Update estimate error:', error);
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
  frequency_count: addon.frequency_count ?? 1,
  price: parseFloat(addon.price) || 0,
  description: addon.description || '',
  billing_cycle: addon.billing_cycle || 'Monthly',
  // Transformed fields
  propertyType: addon.property_type === 'AP' ? 'APT' : addon.property_type === 'VL' ? 'VILLA' : addon.property_type === 'FL' ? 'FLAT' : addon.property_type === 'PL' ? 'PLOT' : addon.property_type,
  propertyTypeName: addon.property_type === 'GC' ? 'Gated Community' : addon.property_type === 'AP' || addon.property_type === 'APT' ? 'Apartment' : addon.property_type === 'VL' || addon.property_type === 'VILLA' ? 'Villa' : addon.property_type === 'FL' || addon.property_type === 'FLAT' ? 'Flat' : addon.property_type === 'PL' || addon.property_type === 'PLOT' ? 'Plot' : addon.property_type,
  services: [{ name: addon.service_name || addon.name || '', frequency: addon.frequency_count ?? 1, frequencyType: addon.frequency_type || 'Monthly', price: parseFloat(addon.price) || 0, description: addon.description || '' }],
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
    
    // Get zones from ACTIVE properties only (FP-scoped or manager-scoped)
    const scopeColumn = req.franchisePartnerId ? 'franchise_partner_id' : 'manager_id';
    const scopeId = req.franchisePartnerId || req.managerId;
    const [propertyZones] = await pool.execute(
      `SELECT DISTINCT zone_id as name FROM properties 
       WHERE ${scopeColumn} = ? AND zone_id IS NOT NULL AND zone_id != ''
       AND (status = 'active' OR status IS NULL)`,
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
    
    // Also get divisions from ACTIVE properties/vendors for this FP
    const [propertyDivisions] = await pool.execute(
      `SELECT DISTINCT division as name FROM properties 
       WHERE franchise_partner_id = ? AND division IS NOT NULL AND division != ''
       AND (status = 'active' OR status IS NULL)
       UNION
       SELECT DISTINCT division as name FROM onboarded_vendors 
       WHERE franchise_partner_id = ? AND division IS NOT NULL AND division != ''
       AND (status = 'active' OR status IS NULL)`,
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
      'SELECT * FROM work_orders WHERE created_by LIKE ? OR franchise_partner_id = ?',
      [`manager-${req.managerId}`, req.franchisePartnerId]
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

// ==================== SCHEDULING ROUTES ====================

// Get pending properties for scheduling
// Returns properties that are paid and have vendors assigned but not yet scheduled
router.get('/schedules/pending-properties', requireManagerScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    
    // Query to get properties with:
    // 1. Approved/paid estimates (payment_status = 'paid')
    // 2. Vendor assignments (from property_vendor_assignments)
    // 3. Not yet scheduled (no active schedule exists)
    const query = `
      SELECT DISTINCT
        op.id,
        op.property_id as propertyId,
        op.community_name as propertyName,
        op.property_type as propertyType,
        op.zone,
        op.area_name as areaName,
        op.created_at as addedOn,
        fe.id as estimateId,
        fe.estimate_id as estimateCode,
        fe.package_name as packageName,
        fe.total_price as totalPrice,
        fe.status as estimateStatus,
        fe.payment_status as paymentStatus,
        fe.service_rows as serviceRows,
        pc.name as customerName,
        pc.phone as customerPhone,
        pc.email as customerEmail,
        (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) as assignedVendors,
        (SELECT COUNT(*) FROM schedules s WHERE s.property_id = op.id AND s.status IN ('active', 'draft')) as existingSchedules
      FROM onboarded_properties op
      LEFT JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
      LEFT JOIN property_contacts pc ON pc.property_id = op.id
      WHERE op.status = 'active'
        AND fe.id IS NOT NULL
        AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
        AND op.franchise_partner_id = ?
      HAVING existingSchedules = 0
      ORDER BY op.created_at DESC
    `;

    const [properties] = await pool.execute(query, [franchisePartnerId]);

    // Parse service rows and calculate service counts
    const processedProperties = properties.map(p => {
      let services = [];
      let totalServices = 0;
      
      // Parse service_rows JSON
      if (p.serviceRows) {
        try {
          services = typeof p.serviceRows === 'string' ? JSON.parse(p.serviceRows) : p.serviceRows;
          totalServices = Array.isArray(services) ? services.length : 0;
        } catch (e) {
          console.warn('Error parsing service rows:', e);
        }
      }
      
      const assignedVendors = p.assignedVendors || 0;
      const pendingServices = Math.max(0, totalServices - assignedVendors);
      
      return {
        id: p.id,
        propertyId: p.propertyId,
        propertyName: p.propertyName,
        customerName: p.customerName || 'N/A',
        customerPhone: p.customerPhone || '',
        customerEmail: p.customerEmail || '',
        propertyType: p.propertyType || 'Apartment',
        zone: p.zone || 'Zone A',
        areaName: p.areaName,
        packageName: p.packageName || 'Custom Package',
        packageType: 'AMC',
        estimateId: p.estimateId,
        estimateCode: p.estimateCode,
        totalPrice: p.totalPrice,
        totalServices: totalServices,
        assignedVendors: Math.min(assignedVendors, totalServices),
        pendingServices: pendingServices,
        paymentStatus: p.paymentStatus === 'paid' ? 'Paid' : 'Partial',
        addedOn: p.addedOn,
        isNew: true,
        services: services.map(s => ({
          name: s.service || s.name || s.serviceType,
          frequency: s.frequencyType || 'Monthly',
          frequencyCount: s.frequencyCount || 1,
          visits: s.frequencyCount || 1,
          vendorAssigned: false,
          vendorName: null
        }))
      };
    });

    res.json({
      success: true,
      data: processedProperties
    });
  } catch (error) {
    console.error('Error fetching pending properties for scheduling:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending properties',
      error: error.message
    });
  }
});

// ============================================
// ENHANCED SCHEDULING ROUTES (V22)
// ============================================

const schedulingService = require('../services/schedulingService');

// Get pending schedules count (for badge)
router.get('/schedules/pending-count', requireManagerScope, async (req, res) => {
  try {
    const franchisePartnerId = req.franchisePartnerId;
    const count = await schedulingService.getPendingSchedulesCount(franchisePartnerId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ success: false, message: 'Error fetching pending schedules count', error: error.message });
  }
});

// Get eligible vendors for a service
router.get('/schedules/eligible-vendors', requireManagerScope, async (req, res) => {
  try {
    const { serviceCategory, zone, propertyId } = req.query;
    const vendors = await schedulingService.getEligibleVendors({ serviceCategory, zone, propertyId });
    
    if (vendors.length === 0) {
      return res.json({ success: true, data: [], message: 'No Vendor Available' });
    }
    
    res.json({
      success: true,
      data: vendors.map(v => ({
        id: v.id,
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        ownerName: v.owner_name,
        ownerMobile: v.owner_mobile,
        ownerEmail: v.owner_email,
        serviceType: v.service_type,
        zone: v.zone,
        areaName: v.area_name,
        ratePerVisit: v.rate_per_visit,
        rating: v.rating,
        totalJobsCompleted: v.total_jobs_completed,
        status: v.status
      }))
    });
  } catch (error) {
    console.error('Error fetching eligible vendors:', error);
    res.status(500).json({ success: false, message: 'Error fetching eligible vendors', error: error.message });
  }
});

// Assign vendor to a service
router.post('/schedules/assign-vendor', requireManagerScope, async (req, res) => {
  try {
    const { propertyId, vendorId, serviceType, serviceName, frequency, frequencyCount, totalVisits, estimateId } = req.body;
    
    if (!propertyId || !vendorId || !serviceName) {
      return res.status(400).json({ success: false, message: 'Property ID, Vendor ID, and Service Name are required' });
    }
    
    const result = await schedulingService.assignVendorToService({
      propertyId,
      vendorId,
      serviceType: serviceType || serviceName,
      serviceName,
      frequency,
      frequencyCount,
      totalVisits,
      estimateId,
      assignedBy: req.user.id,
      franchisePartnerId: req.franchisePartnerId
    });
    
    res.json({ success: true, message: `Vendor ${result.vendorName} assigned to ${serviceName}`, data: result });
  } catch (error) {
    console.error('Error assigning vendor:', error);
    res.status(500).json({ success: false, message: 'Error assigning vendor to service', error: error.message });
  }
});

// Get scheduling notifications
router.get('/schedules/notifications', requireManagerScope, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const notifications = await schedulingService.getUnreadNotifications(
      req.franchisePartnerId,
      req.user?.id,
      'manager',
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: notifications.map(n => ({
        id: n.id,
        notificationId: n.notification_id,
        type: n.type,
        title: n.title,
        message: n.message,
        referenceType: n.reference_type,
        referenceId: n.reference_id,
        referenceData: n.reference_data ? JSON.parse(n.reference_data) : null,
        actionUrl: n.action_url,
        actionLabel: n.action_label,
        priority: n.priority,
        isRead: n.is_read,
        createdAt: n.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
});

// Mark notification as read
router.put('/schedules/notifications/:notificationId/read', requireManagerScope, async (req, res) => {
  try {
    await schedulingService.markNotificationRead(req.params.notificationId);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Error marking notification as read', error: error.message });
  }
});

module.exports = router;
