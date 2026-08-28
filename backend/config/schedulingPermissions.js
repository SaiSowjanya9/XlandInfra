/**
 * Scheduling Module Permissions Configuration
 * Defines role-based access control for all scheduling operations
 */

// Permission Actions
const ACTIONS = {
  // Schedule Series
  VIEW_SCHEDULES: 'view_schedules',
  CREATE_SCHEDULE: 'create_schedule',
  EDIT_SCHEDULE: 'edit_schedule',
  DELETE_SCHEDULE: 'delete_schedule',
  
  // Schedule Occurrences
  VIEW_OCCURRENCES: 'view_occurrences',
  RESCHEDULE: 'reschedule',
  CANCEL_OCCURRENCE: 'cancel_occurrence',
  
  // Vendor Assignment
  ASSIGN_VENDOR: 'assign_vendor',
  CHANGE_VENDOR: 'change_vendor',
  
  // Work Orders
  VIEW_WORK_ORDERS: 'view_work_orders',
  CREATE_WORK_ORDER: 'create_work_order',
  CLOSE_WORK_ORDER: 'close_work_order',
  VERIFY_WORK_ORDER: 'verify_work_order',
  
  // Calendar Views
  VIEW_CALENDAR: 'view_calendar',
  VIEW_VENDOR_CALENDAR: 'view_vendor_calendar',
  VIEW_PROPERTY_CALENDAR: 'view_property_calendar',
  VIEW_ZONE_CALENDAR: 'view_zone_calendar',
  
  // Cross-franchise
  VIEW_ALL_FRANCHISES: 'view_all_franchises',
  MANAGE_ALL_FRANCHISES: 'manage_all_franchises',
  
  // Requests
  RAISE_REQUEST: 'raise_request',
  APPROVE_REQUEST: 'approve_request',
  
  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports'
};

// Role Permissions Matrix
const ROLE_PERMISSIONS = {
  // Super Admin - Full access
  'super_admin': {
    permissions: Object.values(ACTIONS),
    scope: 'all', // Can access all franchises, cities, zones
    canOverride: true
  },

  // Operations Manager - Cross-franchise management
  'operations_manager': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.CREATE_SCHEDULE,
      ACTIONS.EDIT_SCHEDULE,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.RESCHEDULE,
      ACTIONS.CANCEL_OCCURRENCE,
      ACTIONS.ASSIGN_VENDOR,
      ACTIONS.CHANGE_VENDOR,
      ACTIONS.VIEW_WORK_ORDERS,
      ACTIONS.CREATE_WORK_ORDER,
      ACTIONS.CLOSE_WORK_ORDER,
      ACTIONS.VERIFY_WORK_ORDER,
      ACTIONS.VIEW_CALENDAR,
      ACTIONS.VIEW_VENDOR_CALENDAR,
      ACTIONS.VIEW_PROPERTY_CALENDAR,
      ACTIONS.VIEW_ZONE_CALENDAR,
      ACTIONS.VIEW_ALL_FRANCHISES,
      ACTIONS.MANAGE_ALL_FRANCHISES,
      ACTIONS.APPROVE_REQUEST,
      ACTIONS.VIEW_REPORTS,
      ACTIONS.EXPORT_REPORTS
    ],
    scope: 'assigned_franchises', // Can access only assigned franchises/cities
    canOverride: false
  },

  // Franchise Partner - Full control within franchise
  'franchise_partner': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.CREATE_SCHEDULE,
      ACTIONS.EDIT_SCHEDULE,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.RESCHEDULE,
      ACTIONS.CANCEL_OCCURRENCE,
      ACTIONS.ASSIGN_VENDOR,
      ACTIONS.CHANGE_VENDOR,
      ACTIONS.VIEW_WORK_ORDERS,
      ACTIONS.CREATE_WORK_ORDER,
      ACTIONS.CLOSE_WORK_ORDER,
      ACTIONS.VERIFY_WORK_ORDER,
      ACTIONS.VIEW_CALENDAR,
      ACTIONS.VIEW_VENDOR_CALENDAR,
      ACTIONS.VIEW_PROPERTY_CALENDAR,
      ACTIONS.VIEW_ZONE_CALENDAR,
      ACTIONS.APPROVE_REQUEST,
      ACTIONS.VIEW_REPORTS,
      ACTIONS.EXPORT_REPORTS
    ],
    scope: 'own_franchise', // Only within their franchise
    canOverride: false
  },

  // Manager - Operational management
  'manager': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.CREATE_SCHEDULE,
      ACTIONS.EDIT_SCHEDULE,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.RESCHEDULE,
      ACTIONS.CANCEL_OCCURRENCE,
      ACTIONS.ASSIGN_VENDOR,
      ACTIONS.CHANGE_VENDOR,
      ACTIONS.VIEW_WORK_ORDERS,
      ACTIONS.CREATE_WORK_ORDER,
      ACTIONS.CLOSE_WORK_ORDER,
      ACTIONS.VERIFY_WORK_ORDER,
      ACTIONS.VIEW_CALENDAR,
      ACTIONS.VIEW_VENDOR_CALENDAR,
      ACTIONS.VIEW_PROPERTY_CALENDAR,
      ACTIONS.VIEW_ZONE_CALENDAR,
      ACTIONS.APPROVE_REQUEST,
      ACTIONS.VIEW_REPORTS
    ],
    scope: 'assigned_zone', // Within assigned zones
    canOverride: false
  },

  // Coordinator - View and coordinate
  'coordinator': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.VIEW_WORK_ORDERS,
      ACTIONS.VIEW_CALENDAR,
      ACTIONS.VIEW_VENDOR_CALENDAR,
      ACTIONS.VIEW_PROPERTY_CALENDAR,
      ACTIONS.RAISE_REQUEST,
      ACTIONS.VIEW_REPORTS
    ],
    // Configurable additional permissions
    configurable: [
      ACTIONS.RESCHEDULE,
      ACTIONS.CANCEL_OCCURRENCE,
      ACTIONS.CREATE_SCHEDULE,
      ACTIONS.EDIT_SCHEDULE
    ],
    scope: 'assigned_zone',
    canOverride: false
  },

  // Supervisor - View and raise requests
  'supervisor': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.VIEW_WORK_ORDERS,
      ACTIONS.VIEW_CALENDAR,
      ACTIONS.RAISE_REQUEST,
      ACTIONS.VIEW_REPORTS
    ],
    scope: 'assigned_zone',
    canOverride: false
  },

  // Executive - Limited/view access
  'executive': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.VIEW_CALENDAR
    ],
    // All permissions are configurable for executives
    configurable: [
      ACTIONS.VIEW_WORK_ORDERS,
      ACTIONS.VIEW_REPORTS,
      ACTIONS.RAISE_REQUEST
    ],
    scope: 'configured',
    canOverride: false
  },

  // Vendor - Only assigned work
  'vendor': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES, // Only their assigned schedules
      ACTIONS.VIEW_OCCURRENCES, // Only their assigned occurrences
      ACTIONS.VIEW_WORK_ORDERS // Only their assigned work orders
    ],
    scope: 'own_assignments', // Only schedules/work orders assigned to them
    canOverride: false
  },

  // Admin (Employee Portal) - Same as Super Admin
  'admin': {
    permissions: Object.values(ACTIONS),
    scope: 'all',
    canOverride: true
  },

  // Employee - Default limited access
  'employee': {
    permissions: [
      ACTIONS.VIEW_SCHEDULES,
      ACTIONS.VIEW_OCCURRENCES,
      ACTIONS.VIEW_CALENDAR
    ],
    scope: 'configured',
    canOverride: false
  }
};

/**
 * Check if a user has a specific permission
 */
function hasPermission(userRole, action, userConfig = {}) {
  const roleConfig = ROLE_PERMISSIONS[userRole];
  if (!roleConfig) return false;

  // Check base permissions
  if (roleConfig.permissions.includes(action)) {
    return true;
  }

  // Check configurable permissions (if user has been granted them)
  if (roleConfig.configurable && roleConfig.configurable.includes(action)) {
    // Check if this permission was specifically granted to the user
    return userConfig.additionalPermissions?.includes(action) || false;
  }

  return false;
}

/**
 * Get all permissions for a role
 */
function getRolePermissions(userRole, userConfig = {}) {
  const roleConfig = ROLE_PERMISSIONS[userRole];
  if (!roleConfig) return [];

  let permissions = [...roleConfig.permissions];

  // Add configured permissions
  if (roleConfig.configurable && userConfig.additionalPermissions) {
    const granted = userConfig.additionalPermissions.filter(p => 
      roleConfig.configurable.includes(p)
    );
    permissions = [...permissions, ...granted];
  }

  return permissions;
}

/**
 * Get scope restriction for a role
 */
function getScopeRestriction(userRole) {
  const roleConfig = ROLE_PERMISSIONS[userRole];
  return roleConfig?.scope || 'none';
}

/**
 * Build SQL WHERE clause based on user's scope
 */
function buildScopeFilter(userRole, userId, userConfig = {}) {
  const scope = getScopeRestriction(userRole);
  
  switch (scope) {
    case 'all':
      return { where: '1=1', params: [] };
    
    case 'assigned_franchises':
      // User has assigned franchise IDs in their config
      const franchiseIds = userConfig.assignedFranchises || [];
      if (franchiseIds.length === 0) return { where: '1=0', params: [] };
      return {
        where: `franchise_partner_id IN (${franchiseIds.map(() => '?').join(',')})`,
        params: franchiseIds
      };
    
    case 'own_franchise':
      return {
        where: 'franchise_partner_id = ?',
        params: [userConfig.franchisePartnerId || userId]
      };
    
    case 'assigned_zone':
      const zoneIds = userConfig.assignedZones || [];
      if (zoneIds.length === 0) {
        // If no zones assigned, limit to their franchise
        return {
          where: 'franchise_partner_id = ?',
          params: [userConfig.franchisePartnerId || userId]
        };
      }
      return {
        where: `zone_id IN (${zoneIds.map(() => '?').join(',')})`,
        params: zoneIds
      };
    
    case 'own_assignments':
      // For vendors - only their assigned schedules
      return {
        where: 'vendor_id = ?',
        params: [userConfig.vendorId || userId]
      };
    
    case 'configured':
      // For executives - based on their specific configuration
      if (userConfig.scope) {
        return buildScopeFilter(userConfig.scope, userId, userConfig);
      }
      return { where: '1=0', params: [] }; // No access by default
    
    default:
      return { where: '1=0', params: [] };
  }
}

/**
 * Express middleware for checking scheduling permissions
 */
function requireSchedulingPermission(action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = user.role || user.userType || 'employee';
    const userConfig = {
      additionalPermissions: user.additionalPermissions || [],
      assignedFranchises: user.assignedFranchises || [],
      franchisePartnerId: user.franchise_partner_id || user.franchisePartnerId,
      assignedZones: user.assignedZones || [],
      vendorId: user.vendorId,
      scope: user.configuredScope
    };

    if (!hasPermission(userRole, action, userConfig)) {
      return res.status(403).json({ 
        success: false, 
        message: `Permission denied: ${action} is not allowed for ${userRole}` 
      });
    }

    // Attach scope filter for queries
    req.scopeFilter = buildScopeFilter(userRole, user.id, userConfig);
    req.userPermissions = getRolePermissions(userRole, userConfig);

    next();
  };
}

/**
 * Check if user can access a specific schedule/occurrence
 */
async function canAccessSchedule(user, scheduleId, pool) {
  const userRole = user.role || user.userType;
  const scope = getScopeRestriction(userRole);

  if (scope === 'all') return true;

  try {
    let query = '';
    let params = [];

    if (scope === 'own_assignments') {
      query = `SELECT id FROM schedule_series WHERE id = ? AND vendor_id = ?`;
      params = [scheduleId, user.vendorId || user.id];
    } else if (scope === 'own_franchise') {
      query = `SELECT id FROM schedule_series WHERE id = ? AND franchise_partner_id = ?`;
      params = [scheduleId, user.franchise_partner_id || user.franchisePartnerId];
    } else {
      // For other scopes, just check existence
      query = `SELECT id FROM schedule_series WHERE id = ?`;
      params = [scheduleId];
    }

    const [result] = await pool.execute(query, params);
    return result.length > 0;
  } catch (error) {
    console.error('Error checking schedule access:', error);
    return false;
  }
}

module.exports = {
  ACTIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  getScopeRestriction,
  buildScopeFilter,
  requireSchedulingPermission,
  canAccessSchedule
};
