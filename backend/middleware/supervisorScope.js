/**
 * Supervisor Scope Middleware
 * Handles data isolation and ownership validation for Supervisor Portal
 */

const { pool } = require('../config/database');

/**
 * Attach supervisor scope to request
 * Extracts supervisor ID and franchise partner ID from authenticated user
 */
const attachSupervisorScope = (req, res, next) => {
  if (req.user && (req.user.role === 'supervisor' || req.user.supervisorId)) {
    req.supervisorId = req.user.supervisorId || req.user.id;
    req.franchisePartnerId = req.user.franchisePartnerId || null;
    req.supervisorScope = true;
  }
  next();
};

/**
 * Require supervisor scope
 * Ensures request has valid supervisor context
 */
const requireSupervisorScope = (req, res, next) => {
  if (!req.supervisorId) {
    return res.status(403).json({
      success: false,
      message: 'Supervisor access required'
    });
  }
  next();
};

/**
 * Get supervisor ID for insert operations
 */
const getSupervisorIdForInsert = (req) => {
  return req.supervisorId || null;
};

/**
 * Add supervisor filter to query
 * Adds WHERE clause for supervisor_id
 */
const addSupervisorFilter = (baseQuery, supervisorId, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  if (baseQuery.toLowerCase().includes('where')) {
    return `${baseQuery} AND ${prefix}supervisor_id = ?`;
  }
  return `${baseQuery} WHERE ${prefix}supervisor_id = ?`;
};

/**
 * Validate supervisor ownership of a record
 */
const validateSupervisorOwnership = async (tableName, recordId, supervisorId, checkAssigned = false) => {
  try {
    // First check direct ownership
    const [rows] = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = ? AND supervisor_id = ?`,
      [recordId, supervisorId]
    );
    
    if (rows.length > 0) {
      return { valid: true, accessType: 'own', canModify: true, canDelete: true };
    }
    
    // Check if assigned (for properties, vendors)
    if (checkAssigned) {
      const assignedTable = `supervisor_assigned_${tableName}`;
      try {
        const [assignedRows] = await pool.query(
          `SELECT can_modify, can_delete FROM ${assignedTable} WHERE supervisor_id = ? AND ${tableName.slice(0, -1)}_id = ?`,
          [supervisorId, recordId]
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
    const supervisorId = req.supervisorId;
    
    if (!supervisorId) {
      return res.status(403).json({
        success: false,
        message: 'Supervisor access required'
      });
    }
    
    const result = await validateSupervisorOwnership(tableName, recordId, supervisorId, checkAssigned);
    
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
 * Build scoped query for supervisor
 * Handles both own and assigned records
 */
const buildScopedQuery = (baseQuery, supervisorId, options = {}) => {
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
      query: `${baseQuery} WHERE (${prefix}supervisor_id = ? OR ${prefix}id IN (SELECT ${tableName.slice(0, -1)}_id FROM ${assignedTable} WHERE supervisor_id = ?))`,
      params: [supervisorId, supervisorId]
    };
  }
  
  // Only own records
  if (baseQuery.toLowerCase().includes('where')) {
    return {
      query: `${baseQuery} AND ${prefix}supervisor_id = ?`,
      params: [supervisorId]
    };
  }
  
  return {
    query: `${baseQuery} WHERE ${prefix}supervisor_id = ?`,
    params: [supervisorId]
  };
};

/**
 * Get supervisor permissions for a module
 */
const getSupervisorPermissions = async (supervisorId, module) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM supervisor_permissions WHERE supervisor_id = ? AND module = ?`,
      [supervisorId, module]
    );
    
    if (rows.length > 0) {
      return rows[0];
    }
    
    // Return default permissions if not found (restrictive)
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
      can_edit: false,
      can_delete: false,
      can_export: true,
      view_pricing: false
    };
  }
};

/**
 * Check if supervisor can view pricing
 */
const canViewPricing = async (supervisorId, module) => {
  const permissions = await getSupervisorPermissions(supervisorId, module);
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
    const supervisorId = req.supervisorId;
    
    if (!supervisorId) {
      return res.status(403).json({
        success: false,
        message: 'Supervisor access required'
      });
    }
    
    const permissions = await getSupervisorPermissions(supervisorId, module);
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
  attachSupervisorScope,
  requireSupervisorScope,
  getSupervisorIdForInsert,
  addSupervisorFilter,
  validateSupervisorOwnership,
  validateOwnership,
  buildScopedQuery,
  getSupervisorPermissions,
  canViewPricing,
  filterPricing,
  checkPermission
};
