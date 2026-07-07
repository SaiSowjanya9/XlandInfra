/**
 * Zone-Centric Access Control Helper
 * 
 * This module provides utilities for filtering data based on employee's assigned zones.
 * FP assigns zones to employees (Manager, Coordinator, Supervisor, Executive).
 * Employees can only see data from their assigned zones.
 * If no zones are assigned, employees see NO data (must have zones assigned).
 */

const { pool } = require('../config/database');

/**
 * Get assigned zones for an FP employee
 * @param {number} employeeId - The employee's user ID or fp_employee ID
 * @param {string} email - Optional email for fallback lookup
 * @returns {Promise<string[]>} Array of zone names assigned to the employee
 */
async function getAssignedZones(employeeId, email = null) {
  if (!employeeId && !email) {
    console.log('[ZoneHelper] No employeeId or email provided');
    return [];
  }
  
  try {
    let zones = [];
    
    if (employeeId) {
      // First try direct lookup by fp_employee_id using zone_name directly
      console.log('[ZoneHelper] Looking up zones for fp_employee_id:', employeeId);
      [zones] = await pool.execute(
        `SELECT zone_name FROM fp_employee_zones WHERE fp_employee_id = ?`,
        [employeeId]
      );
      console.log('[ZoneHelper] Direct lookup result:', zones.length, 'zones');
      
      // If no zones found, try lookup via user_id in fp_employees table
      if (zones.length === 0) {
        console.log('[ZoneHelper] Trying user_id lookup for:', employeeId);
        [zones] = await pool.execute(
          `SELECT fez.zone_name 
           FROM fp_employee_zones fez
           INNER JOIN fp_employees fpe ON fez.fp_employee_id = fpe.id
           WHERE fpe.user_id = ?`,
          [employeeId]
        );
        console.log('[ZoneHelper] user_id lookup result:', zones.length, 'zones');
      }
    }
    
    // Final fallback: lookup by email/username in fp_employees table
    if (zones.length === 0 && email) {
      console.log('[ZoneHelper] Using email fallback for:', email);
      [zones] = await pool.execute(
        `SELECT fez.zone_name 
         FROM fp_employee_zones fez
         INNER JOIN fp_employees fpe ON fez.fp_employee_id = fpe.id
         WHERE fpe.email = ? OR fpe.username = ?`,
        [email, email]
      );
      console.log('[ZoneHelper] Email fallback result:', zones.length, 'zones');
    }
    
    const zoneNames = zones.map(z => z.zone_name).filter(Boolean);
    console.log('[ZoneHelper] Final zones for employeeId:', employeeId, 'email:', email, '=> zones:', zoneNames);
    return zoneNames;
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
  // zone_id stores zone name directly (no separate zones table)
  return {
    clause: ` AND ${tableAlias}.zone_id IN (${placeholders})`,
    params: [...zones]
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
 * @param {string} onboardedPropertyAlias - Onboarded property table alias (optional)
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildWorkOrderZoneFilter(zones, propertyAlias = 'p', workOrderAlias = 'wo', onboardedPropertyAlias = 'op') {
  if (!zones || zones.length === 0) {
    return { clause: '', params: [] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // zone_id stores zone name directly (no separate zones table)
  return {
    clause: ` AND (${propertyAlias}.zone_id IN (${placeholders}) OR ${onboardedPropertyAlias}.zone IN (${placeholders}))`,
    params: [...zones, ...zones]
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
  // zone_id stores zone name directly (no separate zones table)
  return {
    clause: ` AND (${clientAlias}.zone IN (${placeholders}) OR ${propertyAlias}.zone_id IN (${placeholders}))`,
    params: [...zones, ...zones]
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
 * If no zones assigned: deny access (require zone assignment)
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} tableAlias - Table alias (e.g., 'ov')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildVendorZoneOrCreatorFilter(zones, createdBy, tableAlias = 'ov') {
  // If no zones assigned, allow access to own created vendors only
  if (!zones || zones.length === 0) {
    console.log('[ZoneHelper] No zones assigned - allowing own created vendors only');
    return { clause: ` AND (${tableAlias}.created_by = ? OR ${tableAlias}.created_by_id = ?)`, params: [createdBy, createdBy] };
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
  // Priority: fpEmployeeId (from token) > user.id > specific role ID
  // fpEmployeeId is the fp_employees.id where zones are assigned
  return req.user?.fpEmployeeId || 
         req.fpEmployeeId ||
         req.user?.id || 
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
 * If no zones assigned: deny access (require zone assignment)
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} tableAlias - Table alias (e.g., 'p' for properties)
 * @param {string} zonesTableAlias - Zones table alias for JOIN (e.g., 'z')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildPropertyZoneOrCreatorFilter(zones, createdBy, tableAlias = 'p', zonesTableAlias = 'z') {
  // If no zones assigned, allow access to own created properties only
  if (!zones || zones.length === 0) {
    console.log('[ZoneHelper] No zones assigned - allowing own created properties only');
    return { clause: ` AND ${tableAlias}.created_by = ?`, params: [createdBy] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // Handle both: zone_id as zone name directly OR zone_id as numeric ID (via zones table JOIN)
  // COALESCE(z.name, p.zone_id) handles both cases
  return {
    clause: ` AND (${tableAlias}.zone_id IN (${placeholders}) OR COALESCE(${zonesTableAlias}.name, ${tableAlias}.zone_id) IN (${placeholders}) OR ${tableAlias}.created_by = ?)`,
    params: [...zones, ...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for onboarded_properties
 * If no zones assigned: deny access (require zone assignment)
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} tableAlias - Table alias (e.g., 'op')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildOnboardedPropertyZoneOrCreatorFilter(zones, createdBy, tableAlias = 'op') {
  // If no zones assigned, allow access to own created properties only
  if (!zones || zones.length === 0) {
    console.log('[ZoneHelper] No zones assigned - allowing own created properties only');
    return { clause: ` AND ${tableAlias}.created_by = ?`, params: [createdBy] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  return {
    clause: ` AND (${tableAlias}.zone IN (${placeholders}) OR ${tableAlias}.created_by = ?)`,
    params: [...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for work orders
 * If no zones assigned: deny access (require zone assignment)
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} propertyAlias - Property table alias
 * @param {string} workOrderAlias - Work order table alias
 * @param {string} onboardedPropertyAlias - Onboarded property table alias (optional)
 * @param {string} zonesTableAlias - Zones table alias for JOIN (e.g., 'z')
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildWorkOrderZoneOrCreatorFilter(zones, createdBy, propertyAlias = 'p', workOrderAlias = 'wo', onboardedPropertyAlias = 'op', zonesTableAlias = 'z') {
  // If no zones assigned, allow access to own created work orders only
  if (!zones || zones.length === 0) {
    console.log('[ZoneHelper] No zones assigned - allowing own created work orders only');
    return { clause: ` AND ${workOrderAlias}.created_by = ?`, params: [createdBy] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // Check zone_id/zone on properties and onboarded_properties, or created_by fallback
  // Handle both: zone_id as zone name directly OR zone_id as numeric ID (via zones table JOIN)
  return {
    clause: ` AND (
      ${propertyAlias}.zone_id IN (${placeholders}) 
      OR COALESCE(${zonesTableAlias}.name, ${propertyAlias}.zone_id) IN (${placeholders})
      OR ${onboardedPropertyAlias}.zone IN (${placeholders}) 
      OR ${workOrderAlias}.created_by = ?
    )`,
    params: [...zones, ...zones, ...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for clients/customers
 * If no zones assigned: deny access (require zone assignment)
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} clientAlias - Client table alias
 * @param {string} propertyAlias - Property table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildClientZoneOrCreatorFilter(zones, createdBy, clientAlias = 'c', propertyAlias = 'p') {
  // If no zones assigned, allow access to own created clients only
  if (!zones || zones.length === 0) {
    console.log('[ZoneHelper] No zones assigned - allowing own created clients only');
    return { clause: ` AND ${clientAlias}.created_by = ?`, params: [createdBy] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // zone_id stores zone name directly (no separate zones table)
  return {
    clause: ` AND (${propertyAlias}.zone_id IN (${placeholders}) OR ${clientAlias}.created_by = ?)`,
    params: [...zones, createdBy]
  };
}

/**
 * Build zone filter with "OR created_by" logic for estimates
 * If no zones assigned: deny access (require zone assignment)
 * @param {string[]} zones - Array of zone names
 * @param {string} createdBy - Creator identifier (email/username)
 * @param {string} estimateAlias - Estimate table alias
 * @param {string} propertyAlias - Property table alias
 * @returns {{ clause: string, params: string[] }} SQL clause and parameters
 */
function buildEstimateZoneOrCreatorFilter(zones, createdBy, estimateAlias = 'e', propertyAlias = 'p') {
  // If no zones assigned, allow access to own created estimates only
  if (!zones || zones.length === 0) {
    console.log('[ZoneHelper] No zones assigned - allowing own created estimates only');
    return { clause: ` AND ${estimateAlias}.created_by = ?`, params: [createdBy] };
  }
  
  const placeholders = zones.map(() => '?').join(',');
  // zone_id stores zone name directly (no separate zones table)
  return {
    clause: ` AND (${propertyAlias}.zone_id IN (${placeholders}) OR ${estimateAlias}.created_by = ?)`,
    params: [...zones, createdBy]
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
