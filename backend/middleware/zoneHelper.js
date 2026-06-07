/**
 * Zone-Centric Access Control Helper
 * 
 * This module provides utilities for filtering data based on employee's assigned zones.
 * FP assigns zones to employees (Manager, Coordinator, Supervisor, Executive).
 * Employees can only see data from their assigned zones.
 * If no zones are assigned, they have access to ALL data.
 */

const { pool } = require('../config/database');

/**
 * Get assigned zones for an FP employee
 * @param {number} employeeId - The employee's user ID or fp_employee ID
 * @returns {Promise<string[]>} Array of zone names assigned to the employee
 */
async function getAssignedZones(employeeId) {
  if (!employeeId) return [];
  
  try {
    const [zones] = await pool.execute(
      `SELECT zone_name FROM fp_employee_zones WHERE fp_employee_id = ?`,
      [employeeId]
    );
    return zones.map(z => z.zone_name).filter(Boolean);
  } catch (e) {
    console.log('[ZoneHelper] Zone fetch error:', e.message);
    return [];
  }
}

/**
 * Build a SQL IN clause for zone filtering
 * @param {string[]} zones - Array of zone names
 * @param {string} columnName - The column to filter (e.g., 'zone', 'zone_id', 'zone_name')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildZoneFilterClause(zones, columnName = 'zone') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ${columnName} IN (${placeholders})`,
    params: zones
  };
}

/**
 * Apply zone filtering to a base query
 * Used for properties table where zone column might be 'zone_id' or zone name stored
 * @param {string[]} zones - Array of zone names
 * @param {string} tableAlias - Table alias (e.g., 'p' for properties)
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildPropertyZoneFilter(zones, tableAlias = 'p') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // Handle both zone_id (storing zone name) and properties that might have zone stored differently
  return {
    clause: ` AND (${tableAlias}.zone_id IN (${placeholders}) OR ${tableAlias}.zone IN (${placeholders}))`,
    params: [...zones, ...zones]
  };
}

/**
 * Apply zone filtering for onboarded_properties table
 * @param {string[]} zones - Array of zone names
 * @param {string} tableAlias - Table alias (e.g., 'op')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildOnboardedPropertyZoneFilter(zones, tableAlias = 'op') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ${tableAlias}.zone IN (${placeholders})`,
    params: zones
  };
}

/**
 * Apply zone filtering for work orders (joins with properties to get zone)
 * @param {string[]} zones - Array of zone names
 * @param {string} propertyAlias - Property table alias
 * @param {string} workOrderAlias - Work order table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildWorkOrderZoneFilter(zones, propertyAlias = 'p', workOrderAlias = 'wo') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // Work orders link to properties, so we filter by property's zone
  return {
    clause: ` AND (${propertyAlias}.zone_id IN (${placeholders}) OR ${propertyAlias}.zone IN (${placeholders}) OR ${workOrderAlias}.zone IN (${placeholders}))`,
    params: [...zones, ...zones, ...zones]
  };
}

/**
 * Apply zone filtering for clients/customers table
 * Clients are linked to properties, so we filter by property zone
 * @param {string[]} zones - Array of zone names
 * @param {string} clientAlias - Client table alias
 * @param {string} propertyAlias - Property table alias (joined)
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildClientZoneFilter(zones, clientAlias = 'c', propertyAlias = 'p') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // Clients may have direct zone or through property relationship
  return {
    clause: ` AND (${clientAlias}.zone IN (${placeholders}) OR ${propertyAlias}.zone_id IN (${placeholders}) OR ${propertyAlias}.zone IN (${placeholders}))`,
    params: [...zones, ...zones, ...zones]
  };
}

/**
 * Apply zone filtering for vendors (onboarded_vendors table)
 * @param {string[]} zones - Array of zone names
 * @param {string} tableAlias - Table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildVendorZoneFilter(zones, tableAlias = 'ov') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ${tableAlias}.zone IN (${placeholders})`,
    params: zones
  };
}

/**
 * Apply zone filtering for vendor assignments
 * @param {string[]} zones - Array of zone names
 * @param {string} vendorAlias - Vendor table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildVendorAssignmentZoneFilter(zones, vendorAlias = 'v') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ${vendorAlias}.zone IN (${placeholders})`,
    params: zones
  };
}

/**
 * Build zone filter with "OR created_by" logic for vendors
 * If no zones assigned: only show own created data
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} tableAlias - Table alias (e.g., 'ov')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildVendorZoneOrCreatorFilter(zones, createdBy, tableAlias = 'ov') {
  // If no zones assigned, only show own created data
  if (!zones || zones.length === 0) {
    return { 
      clause: ` AND (${tableAlias}.created_by = ? OR ${tableAlias}.created_by_id = ?)`, 
      params: [createdBy, createdBy] 
    };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND (${tableAlias}.zone IN (${placeholders}) OR ${tableAlias}.created_by = ? OR ${tableAlias}.created_by_id = ?)`,
    params: [...zones, createdBy, createdBy]
  };
}

/**
 * Get employee ID for zone lookup from request object
 * Handles different portal contexts (Manager, Coordinator, Supervisor, Executive)
 * @param {object} req - Express request object
 * @returns {number|null} Employee ID for zone lookup
 */
function getEmployeeIdForZoneLookup(req) {
  // Priority: user.id > specific role ID (managerId, coordinatorId, etc.)
  return req.user?.id || 
         req.managerId || 
         req.coordinatorId || 
         req.supervisorId || 
         req.executiveId || 
         null;
}

/**
 * Check if employee has any zone restrictions
 * @param {number} employeeId - Employee ID
 * @returns {Promise<boolean>} True if employee has zone restrictions
 */
async function hasZoneRestrictions(employeeId) {
  const zones = await getAssignedZones(employeeId);
  return zones.length > 0;
}

/**
 * Build zone filter with "OR created_by" logic for properties
 * Employees see: zone-centric data + their own created data
 * If no zones assigned: only show own created data
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} tableAlias - Table alias (e.g., 'p' for properties)
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildPropertyZoneOrCreatorFilter(zones, createdBy, tableAlias = 'p') {
  // If no zones assigned, only show own created data
  if (!zones || zones.length === 0) {
    return { 
      clause: ` AND ${tableAlias}.created_by = ?`, 
      params: [createdBy] 
    };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ((${tableAlias}.zone_id IN (${placeholders}) OR ${tableAlias}.zone IN (${placeholders})) OR ${tableAlias}.created_by = ?)`,
    params: [...zones, ...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for onboarded_properties
 * If no zones assigned: only show own created data
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} tableAlias - Table alias (e.g., 'op')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildOnboardedPropertyZoneOrCreatorFilter(zones, createdBy, tableAlias = 'op') {
  // If no zones assigned, only show own created data
  if (!zones || zones.length === 0) {
    return { 
      clause: ` AND ${tableAlias}.created_by = ?`, 
      params: [createdBy] 
    };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND (${tableAlias}.zone IN (${placeholders}) OR ${tableAlias}.created_by = ?)`,
    params: [...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for work orders
 * If no zones assigned: only show own created data
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} propertyAlias - Property table alias
 * @param {string} workOrderAlias - Work order table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildWorkOrderZoneOrCreatorFilter(zones, createdBy, propertyAlias = 'p', workOrderAlias = 'wo') {
  // If no zones assigned, only show own created data
  if (!zones || zones.length === 0) {
    return { 
      clause: ` AND ${workOrderAlias}.created_by = ?`, 
      params: [createdBy] 
    };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ((${propertyAlias}.zone_id IN (${placeholders}) OR ${propertyAlias}.zone IN (${placeholders})) OR ${workOrderAlias}.created_by = ?)`,
    params: [...zones, ...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for clients/customers
 * If no zones assigned: only show own created data
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} clientAlias - Client table alias
 * @param {string} propertyAlias - Property table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildClientZoneOrCreatorFilter(zones, createdBy, clientAlias = 'c', propertyAlias = 'p') {
  // If no zones assigned, only show own created data
  if (!zones || zones.length === 0) {
    return { 
      clause: ` AND ${clientAlias}.created_by = ?`, 
      params: [createdBy] 
    };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ((${propertyAlias}.zone_id IN (${placeholders}) OR ${propertyAlias}.zone IN (${placeholders})) OR ${clientAlias}.created_by = ?)`,
    params: [...zones, ...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for estimates
 * If no zones assigned: only show own created data
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} estimateAlias - Estimate table alias
 * @param {string} propertyAlias - Property table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildEstimateZoneOrCreatorFilter(zones, createdBy, estimateAlias = 'e', propertyAlias = 'p') {
  // If no zones assigned, only show own created data
  if (!zones || zones.length === 0) {
    return { 
      clause: ` AND ${estimateAlias}.created_by = ?`, 
      params: [createdBy] 
    };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND ((${propertyAlias}.zone_id IN (${placeholders}) OR ${propertyAlias}.zone IN (${placeholders})) OR ${estimateAlias}.created_by = ?)`,
    params: [...zones, ...zones, createdBy]
  };
}

/**
 * Get creator identifier from request object
 * @param {object} req - Express request object
 * @returns {string} Creator identifier (email/username)
 */
function getCreatorIdentifier(req) {
  return req.user?.username || req.user?.email || '';
}

module.exports = {
  getAssignedZones,
  buildZoneFilterClause,
  buildPropertyZoneFilter,
  buildOnboardedPropertyZoneFilter,
  buildWorkOrderZoneFilter,
  buildClientZoneFilter,
  buildVendorZoneFilter,
  buildVendorAssignmentZoneFilter,
  getEmployeeIdForZoneLookup,
  hasZoneRestrictions,
  // Zone + Creator filters (employees see zone data + their own created data)
  buildPropertyZoneOrCreatorFilter,
  buildOnboardedPropertyZoneOrCreatorFilter,
  buildWorkOrderZoneOrCreatorFilter,
  buildClientZoneOrCreatorFilter,
  buildVendorZoneOrCreatorFilter,
  buildEstimateZoneOrCreatorFilter,
  getCreatorIdentifier
};
