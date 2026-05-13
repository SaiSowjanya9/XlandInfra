/**
 * Manager Scope Middleware
 * Ensures data isolation for Manager users
 * All data operations are scoped to the logged-in Manager
 */

const pool = require('../config/database');
const { ROLES, isManager } = require('../config/roles');

/**
 * Attach Manager ID to request
 * Extracts manager_id from authenticated user
 */
const attachManagerScope = (req, res, next) => {
  if (req.user && isManager(req.user.role)) {
    req.managerId = req.user.id;
    req.isManager = true;
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
 * Add Manager filter to SQL WHERE clause
 * @param {string} whereClause - Existing WHERE clause
 * @param {string} tableAlias - Table alias (optional)
 * @returns {string} - Modified WHERE clause
 */
const addManagerFilter = (whereClause, tableAlias = '') => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const managerCondition = `${prefix}manager_id = ?`;
  
  if (!whereClause || whereClause.trim() === '') {
    return `WHERE ${managerCondition}`;
  }
  
  return `${whereClause} AND ${managerCondition}`;
};

/**
 * Validate ownership of a record for Manager
 * Checks if the record belongs to the logged-in manager
 */
const validateManagerOwnership = async (tableName, recordId, managerId, idColumn = 'id') => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} = ? AND manager_id = ?`,
      [recordId, managerId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Ownership validation error:', error);
    return false;
  }
};

/**
 * Middleware factory for validating ownership
 * @param {string} tableName - Table to check
 * @param {string} paramName - Request param containing record ID
 * @param {string} idColumn - Column name for ID (default: 'id')
 */
const validateOwnership = (tableName, paramName = 'id', idColumn = 'id') => {
  return async (req, res, next) => {
    const recordId = req.params[paramName];
    const managerId = req.managerId;

    if (!managerId) {
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

    const isOwner = await validateManagerOwnership(tableName, recordId, managerId, idColumn);
    
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
 * Build scoped query with manager filter
 * @param {string} baseQuery - Base SQL query
 * @param {number} managerId - Manager ID
 * @param {string} tableAlias - Table alias for manager_id column
 * @returns {object} - { query, params }
 */
const buildScopedQuery = (baseQuery, managerId, tableAlias = '') => {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  // Check if query already has WHERE clause
  const hasWhere = baseQuery.toUpperCase().includes('WHERE');
  
  let modifiedQuery;
  if (hasWhere) {
    // Insert manager condition after WHERE
    modifiedQuery = baseQuery.replace(
      /WHERE/i,
      `WHERE ${prefix}manager_id = ? AND`
    );
  } else {
    // Add WHERE clause before ORDER BY, GROUP BY, LIMIT, or at end
    const insertPoint = baseQuery.search(/ORDER BY|GROUP BY|LIMIT|$/i);
    modifiedQuery = 
      baseQuery.slice(0, insertPoint) + 
      ` WHERE ${prefix}manager_id = ? ` + 
      baseQuery.slice(insertPoint);
  }
  
  return {
    query: modifiedQuery,
    params: [managerId]
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
  filterPricing
};
