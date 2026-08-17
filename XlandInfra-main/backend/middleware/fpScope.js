/**
 * Franchise Partner Scope Middleware
 * Ensures all data access is restricted to the logged-in FP's data only
 */

const { pool } = require('../config/database');
const { ROLES, isFranchisePartner } = require('../config/roles');

/**
 * Middleware to attach FP ID to request if user is a franchise partner
 * This ensures all subsequent queries can be scoped to the FP's data
 */
const attachFPScope = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // If user is a franchise partner, attach their FP ID
    if (isFranchisePartner(req.user.role)) {
      // The FP ID should be stored in the user token or fetched from database
      if (req.user.franchisePartnerId) {
        req.fpId = req.user.franchisePartnerId;
      } else if (req.user.fpId) {
        req.fpId = req.user.fpId;
      } else {
        // Fetch from franchise_partners table using user info
        try {
          const [fps] = await pool.execute(
            'SELECT id FROM franchise_partners WHERE id = ? OR username = ? OR email = ?',
            [req.user.id, req.user.username, req.user.email]
          );
          if (fps.length > 0) {
            req.fpId = fps[0].id;
          }
        } catch (dbError) {
          console.error('Error fetching FP ID:', dbError.message);
        }
      }
    }
    
    // Also handle FP-created staff (manager, coordinator, supervisor, executive)
    // These users have franchise_partner_id in their record but role != 'franchise_partner'
    if (!req.fpId && req.user.franchisePartnerId) {
      req.fpId = req.user.franchisePartnerId;
    }

    next();
  } catch (error) {
    console.error('FP Scope middleware error:', error);
    next();
  }
};

/**
 * Middleware to require FP scope for protected routes
 * Returns 403 if user is FP but no FP ID is attached
 */
const requireFPScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (isFranchisePartner(req.user.role) && !req.fpId) {
    return res.status(403).json({
      success: false,
      message: 'Franchise Partner scope not found. Please contact administrator.'
    });
  }

  next();
};

/**
 * Helper function to add FP ID filter to SQL queries
 * @param {string} baseQuery - The base SQL query
 * @param {string} tableName - The table name (for prefixing column)
 * @param {object} req - Express request object
 * @returns {object} - { query: string, params: array }
 */
const addFPFilter = (baseQuery, tableName, req) => {
  if (isFranchisePartner(req.user?.role) && req.fpId) {
    const fpColumn = tableName ? `${tableName}.franchise_partner_id` : 'franchise_partner_id';
    
    // Check if query already has WHERE clause
    if (baseQuery.toLowerCase().includes('where')) {
      return {
        query: `${baseQuery} AND ${fpColumn} = ?`,
        fpParam: req.fpId
      };
    } else {
      return {
        query: `${baseQuery} WHERE ${fpColumn} = ?`,
        fpParam: req.fpId
      };
    }
  }
  
  return { query: baseQuery, fpParam: null };
};

/**
 * Helper to get FP ID for INSERT operations
 * @param {object} req - Express request object
 * @returns {number|null} - FP ID or null
 */
const getFPIdForInsert = (req) => {
  if (isFranchisePartner(req.user?.role)) {
    return req.fpId || null;
  }
  return null;
};

/**
 * Validate that a record belongs to the FP before allowing access
 * @param {string} tableName - Table to check
 * @param {number} recordId - Record ID to check
 * @param {object} req - Express request
 * @returns {Promise<boolean>} - Whether access is allowed
 */
const validateFPOwnership = async (tableName, recordId, req) => {
  // Non-FP users can access all records (based on their role permissions)
  if (!isFranchisePartner(req.user?.role)) {
    return true;
  }

  if (!req.fpId) {
    return false;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id FROM ${tableName} WHERE id = ? AND franchise_partner_id = ?`,
      [recordId, req.fpId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error(`Error validating FP ownership for ${tableName}:`, error.message);
    return false;
  }
};

/**
 * Middleware factory for validating FP ownership on specific routes
 * @param {string} tableName - Table to check
 * @param {string} paramName - Request parameter containing record ID (default: 'id')
 */
const validateOwnership = (tableName, paramName = 'id') => {
  return async (req, res, next) => {
    const recordId = req.params[paramName];
    
    if (!recordId) {
      return next();
    }

    const hasAccess = await validateFPOwnership(tableName, recordId, req);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own data.'
      });
    }

    next();
  };
};

/**
 * Build scoped query for FP users
 * For non-FP users, returns original query
 * For FP users, adds franchise_partner_id filter
 */
const buildScopedQuery = (req, tableName, baseConditions = '1=1') => {
  if (isFranchisePartner(req.user?.role) && req.fpId) {
    const prefix = tableName ? `${tableName}.` : '';
    return `${baseConditions} AND ${prefix}franchise_partner_id = ${pool.escape(req.fpId)}`;
  }
  return baseConditions;
};

module.exports = {
  attachFPScope,
  requireFPScope,
  addFPFilter,
  getFPIdForInsert,
  validateFPOwnership,
  validateOwnership,
  buildScopedQuery,
  isFranchisePartner
};
