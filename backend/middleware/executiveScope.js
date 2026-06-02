/**
 * Executive Scope Middleware
 * Handles data isolation and ownership validation for Executive Portal
 */

const { pool } = require('../config/database');

/**
 * Attach executive scope to request
 * Extracts executive ID and franchise partner ID from authenticated user
 */
const attachExecutiveScope = (req, res, next) => {
  if (req.user && (req.user.role === 'executive' || req.user.executiveId)) {
    req.executiveId = req.user.executiveId || req.user.id;
    // Check both req.user.franchisePartnerId AND req.fpId (set by auth middleware)
    req.franchisePartnerId = req.user.franchisePartnerId || req.fpId || null;
    req.executiveScope = true;
    req.isFPExecutive = !!req.franchisePartnerId;
  }
  next();
};

/**
 * Require executive scope
 * Ensures request has valid executive context
 */
const requireExecutiveScope = (req, res, next) => {
  if (!req.executiveId) {
    return res.status(403).json({
      success: false,
      message: 'Executive access required'
    });
  }
  next();
};

/**
 * Get executive ID for insert operations
 */
const getExecutiveIdForInsert = (req) => {
  return req.executiveId || null;
};

/**
 * Add executive filter to query
 * Adds WHERE clause for executive_id
 */
const addExecutiveFilter = (baseQuery, executiveId, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  if (baseQuery.toLowerCase().includes('where')) {
    return `${baseQuery} AND ${prefix}executive_id = ?`;
  }
  return `${baseQuery} WHERE ${prefix}executive_id = ?`;
};

/**
 * Validate executive ownership of a record
 */
const validateExecutiveOwnership = async (tableName, recordId, executiveId, checkAssigned = false) => {
  try {
    // First check direct ownership
    const [rows] = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = ? AND executive_id = ?`,
      [recordId, executiveId]
    );
    
    if (rows.length > 0) {
      return { valid: true, accessType: 'own', canModify: true, canDelete: false };
    }
    
    // Check if assigned (for properties, vendors)
    if (checkAssigned) {
      const assignedTable = `executive_assigned_${tableName}`;
      try {
        const [assignedRows] = await pool.query(
          `SELECT can_modify, can_delete FROM ${assignedTable} WHERE executive_id = ? AND ${tableName.slice(0, -1)}_id = ?`,
          [executiveId, recordId]
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
    const executiveId = req.executiveId;
    
    if (!executiveId) {
      return res.status(403).json({
        success: false,
        message: 'Executive access required'
      });
    }
    
    const result = await validateExecutiveOwnership(tableName, recordId, executiveId, checkAssigned);
    
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
 * Build scoped query for executive
 * Handles both own and assigned records
 */
const buildScopedQuery = (baseQuery, executiveId, options = {}) => {
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
      query: `${baseQuery} WHERE (${prefix}executive_id = ? OR ${prefix}id IN (SELECT ${tableName.slice(0, -1)}_id FROM ${assignedTable} WHERE executive_id = ?))`,
      params: [executiveId, executiveId]
    };
  }
  
  // Only own records
  if (baseQuery.toLowerCase().includes('where')) {
    return {
      query: `${baseQuery} AND ${prefix}executive_id = ?`,
      params: [executiveId]
    };
  }
  
  return {
    query: `${baseQuery} WHERE ${prefix}executive_id = ?`,
    params: [executiveId]
  };
};

/**
 * Get executive permissions for a module
 */
const getExecutivePermissions = async (executiveId, module) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM executive_permissions WHERE executive_id = ? AND module = ?`,
      [executiveId, module]
    );
    
    if (rows.length > 0) {
      return rows[0];
    }
    
    // Return default permissions if not found (very restrictive for executive)
    return {
      can_view: true,
      can_create: module === 'customers',
      can_edit: false,
      can_delete: false,
      can_export: true,
      view_pricing: false
    };
  } catch (error) {
    // Table might not exist yet, return defaults
    return {
      can_view: true,
      can_create: module === 'customers',
      can_edit: false,
      can_delete: false,
      can_export: true,
      view_pricing: false
    };
  }
};

/**
 * Check if executive can view pricing
 */
const canViewPricing = async (executiveId, module) => {
  const permissions = await getExecutivePermissions(executiveId, module);
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
    const executiveId = req.executiveId;
    
    if (!executiveId) {
      return res.status(403).json({
        success: false,
        message: 'Executive access required'
      });
    }
    
    const permissions = await getExecutivePermissions(executiveId, module);
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
  attachExecutiveScope,
  requireExecutiveScope,
  getExecutiveIdForInsert,
  addExecutiveFilter,
  validateExecutiveOwnership,
  validateOwnership,
  buildScopedQuery,
  getExecutivePermissions,
  canViewPricing,
  filterPricing,
  checkPermission
};
