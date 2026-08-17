/**
 * Manager Scope Middleware
 * Ensures data isolation for Manager users
 * FP-created Managers see FP's data (filtered by franchise_partner_id)
 * Standalone Managers see only their own data (filtered by manager_id)
 */

const pool = require('../config/database');
const { ROLES, isManager } = require('../config/roles');

/**
 * Attach Manager scope to request
 * For FP-created Managers: uses franchise_partner_id for filtering
 * For standalone Managers: uses manager_id for filtering
 */
const attachManagerScope = (req, res, next) => {
  if (req.user && isManager(req.user.role)) {
    req.managerId = req.user.id;
    // Check both req.user.franchisePartnerId AND req.fpId (set by auth middleware)
    req.franchisePartnerId = req.user.franchisePartnerId || req.fpId || null;
    req.isManager = true;
    // Flag to indicate if this manager belongs to an FP
    req.isFPManager = !!req.franchisePartnerId;
  }
  next();
};

/**
 * Require Manager Scope
 * Ensures request has valid manager context
 */
const requireManagerScope = (req, res, next) => {
  if (!req.managerId) {
    return res.status(403).json({
      success: false,
      message: 'Manager access required'
    });
  }
  next();
};

/**
 * Get Manager ID for insert operations
 * Returns manager_id from request
 */
const getManagerIdForInsert = (req) => {
  return req.managerId || null;
};

/**
 * Add Manager/FP filter to SQL WHERE clause
 * For FP Managers: filters by franchise_partner_id
 * For standalone Managers: filters by manager_id
 * @param {string} whereClause - Existing WHERE clause
 * @param {string} tableAlias - Table alias (optional)
 * @param {boolean} isFPManager - Whether manager belongs to FP
 * @returns {string} - Modified WHERE clause
 */
const addManagerFilter = (whereClause, tableAlias = '', isFPManager = false) => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  // FP Managers filter by franchise_partner_id, standalone by manager_id
  const filterColumn = isFPManager ? 'franchise_partner_id' : 'manager_id';
  const condition = `${prefix}${filterColumn} = ?`;
  
  if (!whereClause || whereClause.trim() === '') {
    return `WHERE ${condition}`;
  }
  
  return `${whereClause} AND ${condition}`;
};

/**
 * Get the appropriate scope ID for filtering
 * @param {object} req - Request object
 * @returns {number} - franchise_partner_id for FP managers, manager_id for standalone
 */
const getScopeId = (req) => {
  return req.isFPManager ? req.franchisePartnerId : req.managerId;
};

/**
 * Get the scope column name for SQL queries
 * @param {object} req - Request object
 * @returns {string} - 'franchise_partner_id' or 'manager_id'
 */
const getScopeColumn = (req) => {
  return req.isFPManager ? 'franchise_partner_id' : 'manager_id';
};

/**
 * Validate ownership of a record for Manager
 * For FP Managers: checks franchise_partner_id
 * For standalone Managers: checks manager_id
 */
const validateManagerOwnership = async (tableName, recordId, scopeId, idColumn = 'id', scopeColumn = 'manager_id') => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} = ? AND ${scopeColumn} = ?`,
      [recordId, scopeId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Ownership validation error:', error);
    return false;
  }
};

/**
 * Middleware factory for validating ownership
 * Supports both FP-scoped and Manager-scoped validation
 * @param {string} tableName - Table to check
 * @param {string} paramName - Request param containing record ID
 * @param {string} idColumn - Column name for ID (default: 'id')
 */
const validateOwnership = (tableName, paramName = 'id', idColumn = 'id') => {
  return async (req, res, next) => {
    const recordId = req.params[paramName];
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);

    if (!scopeId) {
      return res.status(403).json({
        success: false,
        message: 'Manager access required'
      });
    }

    if (!recordId) {
      return res.status(400).json({
        success: false,
        message: 'Record ID is required'
      });
    }

    const isOwner = await validateManagerOwnership(tableName, recordId, scopeId, idColumn, scopeColumn);
    
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Record does not belong to your account'
      });
    }

    next();
  };
};

/**
 * Build scoped query with FP or Manager filter
 * @param {string} baseQuery - Base SQL query
 * @param {number} scopeId - Scope ID (franchise_partner_id or manager_id)
 * @param {string} tableAlias - Table alias for scope column
 * @param {string} scopeColumn - Column to filter by ('franchise_partner_id' or 'manager_id')
 * @returns {object} - { query, params }
 */
const buildScopedQuery = (baseQuery, scopeId, tableAlias = '', scopeColumn = 'manager_id') => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  // Check if query already has WHERE clause
  const hasWhere = baseQuery.toUpperCase().includes('WHERE');
  
  let modifiedQuery;
  if (hasWhere) {
    // Insert scope condition after WHERE
    modifiedQuery = baseQuery.replace(
      /WHERE/i,
      `WHERE ${prefix}${scopeColumn} = ? AND`
    );
  } else {
    // Add WHERE clause before ORDER BY, GROUP BY, LIMIT, or at end
    const insertPoint = baseQuery.search(/ORDER BY|GROUP BY|LIMIT|$/i);
    modifiedQuery = 
      baseQuery.slice(0, insertPoint) + 
      ` WHERE ${prefix}${scopeColumn} = ? ` + 
      baseQuery.slice(insertPoint);
  }
  
  return {
    query: modifiedQuery,
    params: [scopeId]
  };
};

/**
 * Check if manager has access to view pricing
 * Based on hide_pricing flag and manager permissions
 */
const canViewPricing = (req, hideFlag = false) => {
  // If pricing is not hidden, allow view
  if (!hideFlag) return true;
  
  // Check if manager has pricing permission
  // This can be extended based on specific permissions
  return req.user && req.user.canViewPricing === true;
};

/**
 * Filter out pricing from response if restricted
 */
const filterPricing = (data, hidePricing = false) => {
  if (!hidePricing) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => {
      const { price, base_price, unit_price, ...rest } = item;
      return rest;
    });
  }
  
  const { price, base_price, unit_price, ...rest } = data;
  return rest;
};

module.exports = {
  attachManagerScope,
  requireManagerScope,
  getManagerIdForInsert,
  addManagerFilter,
  validateManagerOwnership,
  validateOwnership,
  buildScopedQuery,
  canViewPricing,
  filterPricing,
  getScopeId,
  getScopeColumn
};
