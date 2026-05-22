/**
 * Coordinator Scope Middleware
 * Handles data isolation and ownership validation for Coordinator Portal
 * FP-created Coordinators see FP's data (filtered by franchise_partner_id)
 * Standalone Coordinators see only their own data (filtered by coordinator_id)
 */

const { pool } = require('../config/database');

/**
 * Attach coordinator scope to request
 * For FP-created Coordinators: uses franchise_partner_id for filtering
 * For standalone Coordinators: uses coordinator_id for filtering
 */
const attachCoordinatorScope = (req, res, next) => {
  if (req.user && (req.user.role === 'coordinator' || req.user.coordinatorId)) {
    req.coordinatorId = req.user.coordinatorId || req.user.id;
    req.franchisePartnerId = req.user.franchisePartnerId || null;
    req.coordinatorScope = true;
    // Flag to indicate if this coordinator belongs to an FP
    req.isFPCoordinator = !!req.user.franchisePartnerId;
  }
  next();
};

/**
 * Get the appropriate scope ID for filtering
 * @param {object} req - Request object
 * @returns {number} - franchise_partner_id for FP coordinators, coordinator_id for standalone
 */
const getScopeId = (req) => {
  return req.isFPCoordinator ? req.franchisePartnerId : req.coordinatorId;
};

/**
 * Get the scope column name for SQL queries
 * @param {object} req - Request object
 * @returns {string} - 'franchise_partner_id' or 'coordinator_id'
 */
const getScopeColumn = (req) => {
  return req.isFPCoordinator ? 'franchise_partner_id' : 'coordinator_id';
};

/**
 * Require coordinator scope
 * Ensures request has valid coordinator context
 */
const requireCoordinatorScope = (req, res, next) => {
  if (!req.coordinatorId) {
    return res.status(403).json({
      success: false,
      message: 'Coordinator access required'
    });
  }
  next();
};

/**
 * Get coordinator ID for insert operations
 */
const getCoordinatorIdForInsert = (req) => {
  return req.coordinatorId || null;
};

/**
 * Add coordinator filter to query
 * Adds WHERE clause for coordinator_id
 */
const addCoordinatorFilter = (baseQuery, coordinatorId, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  if (baseQuery.toLowerCase().includes('where')) {
    return `${baseQuery} AND ${prefix}coordinator_id = ?`;
  }
  return `${baseQuery} WHERE ${prefix}coordinator_id = ?`;
};

/**
 * Validate coordinator ownership of a record
 */
const validateCoordinatorOwnership = async (tableName, recordId, coordinatorId, checkAssigned = false) => {
  try {
    // First check direct ownership
    const [rows] = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = ? AND coordinator_id = ?`,
      [recordId, coordinatorId]
    );
    
    if (rows.length > 0) {
      return { valid: true, accessType: 'own', canModify: true, canDelete: true };
    }
    
    // Check if assigned (for properties, vendors)
    if (checkAssigned) {
      const assignedTable = `coordinator_assigned_${tableName}`;
      try {
        const [assignedRows] = await pool.query(
          `SELECT can_modify, can_delete FROM ${assignedTable} WHERE coordinator_id = ? AND ${tableName.slice(0, -1)}_id = ?`,
          [coordinatorId, recordId]
        );
        
        if (assignedRows.length > 0) {
          return {
            valid: true,
            accessType: 'assigned',
            canModify: assignedRows[0].can_modify || false,
            canDelete: assignedRows[0].can_delete || false
          };
        }
      } catch (e) {
        // Table might not exist, continue
      }
    }
    
    return { valid: false };
  } catch (error) {
    console.error('Ownership validation error:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * Middleware factory for ownership validation
 */
const validateOwnership = (tableName, paramName = 'id', checkAssigned = false) => {
  return async (req, res, next) => {
    const recordId = req.params[paramName];
    const coordinatorId = req.coordinatorId;
    
    if (!coordinatorId) {
      return res.status(403).json({
        success: false,
        message: 'Coordinator access required'
      });
    }
    
    const result = await validateCoordinatorOwnership(tableName, recordId, coordinatorId, checkAssigned);
    
    if (!result.valid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Record does not belong to your account'
      });
    }
    
    // Attach access info to request
    req.accessType = result.accessType;
    req.canModify = result.canModify;
    req.canDelete = result.canDelete;
    
    next();
  };
};

/**
 * Build scoped query for coordinator
 * Handles both own and assigned records
 */
const buildScopedQuery = (baseQuery, coordinatorId, options = {}) => {
  const {
    tableName,
    tableAlias = '',
    includeAssigned = false,
    assignedTable = null
  } = options;
  
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  if (includeAssigned && assignedTable) {
    // Include both own and assigned records
    return {
      query: `${baseQuery} WHERE (${prefix}coordinator_id = ? OR ${prefix}id IN (SELECT ${tableName.slice(0, -1)}_id FROM ${assignedTable} WHERE coordinator_id = ?))`,
      params: [coordinatorId, coordinatorId]
    };
  }
  
  // Only own records
  if (baseQuery.toLowerCase().includes('where')) {
    return {
      query: `${baseQuery} AND ${prefix}coordinator_id = ?`,
      params: [coordinatorId]
    };
  }
  
  return {
    query: `${baseQuery} WHERE ${prefix}coordinator_id = ?`,
    params: [coordinatorId]
  };
};

/**
 * Get coordinator permissions for a module
 */
const getCoordinatorPermissions = async (coordinatorId, module) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM coordinator_permissions WHERE coordinator_id = ? AND module = ?`,
      [coordinatorId, module]
    );
    
    if (rows.length > 0) {
      return rows[0];
    }
    
    // Return default permissions if not found
    return {
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_export: true,
      view_pricing: false
    };
  } catch (error) {
    // Table might not exist yet, return defaults
    return {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      view_pricing: false
    };
  }
};

/**
 * Check if coordinator can view pricing
 */
const canViewPricing = async (coordinatorId, module) => {
  const permissions = await getCoordinatorPermissions(coordinatorId, module);
  return permissions.view_pricing;
};

/**
 * Filter pricing from response data
 * Hides pricing info based on hide_pricing flag and permissions
 */
const filterPricing = (data, canView = false) => {
  if (!Array.isArray(data)) {
    if (data && data.hide_pricing && !canView) {
      const { base_price, price, ...rest } = data;
      return { ...rest, price: null, base_price: null, pricing_hidden: true };
    }
    return data;
  }
  
  return data.map(item => {
    if (item.hide_pricing && !canView) {
      const { base_price, price, ...rest } = item;
      return { ...rest, price: null, base_price: null, pricing_hidden: true };
    }
    return item;
  });
};

/**
 * Middleware to check module permission
 */
const checkPermission = (module, action) => {
  return async (req, res, next) => {
    const coordinatorId = req.coordinatorId;
    
    if (!coordinatorId) {
      return res.status(403).json({
        success: false,
        message: 'Coordinator access required'
      });
    }
    
    const permissions = await getCoordinatorPermissions(coordinatorId, module);
    const permissionKey = `can_${action}`;
    
    if (!permissions[permissionKey]) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to ${action} in this module`
      });
    }
    
    req.permissions = permissions;
    next();
  };
};

module.exports = {
  attachCoordinatorScope,
  requireCoordinatorScope,
  getCoordinatorIdForInsert,
  addCoordinatorFilter,
  validateCoordinatorOwnership,
  validateOwnership,
  buildScopedQuery,
  getCoordinatorPermissions,
  canViewPricing,
  filterPricing,
  checkPermission,
  getScopeId,
  getScopeColumn
};
