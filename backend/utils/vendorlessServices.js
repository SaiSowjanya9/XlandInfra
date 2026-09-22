/**
 * Services configured with "Do Not Assign Vendor".
 *
 * The toggle lives on the service, not on the estimate: switching it on means that service is
 * arranged without a vendor, so no vendor is assigned to it and no visits are scheduled for it.
 * The service is otherwise unchanged - still listed, still quoted, still priced, still printed
 * on the estimate.
 *
 * The scheduling module keys on the service name (property_vendor_assignments.service_type and
 * property_service_schedules.service_name both hold it, and the estimate service rows carry only
 * a name), so the flag is resolved by name too rather than by id.
 *
 * A failure to read the catalog must never hide a service from scheduling, so it resolves to an
 * empty set and today's behaviour continues.
 */

const { pool } = require('../config/database');

const key = name => String(name ?? '').toLowerCase().trim();

/**
 * @param {number|string|null} fpId Restrict to the admin-wide catalog plus this FP's own services.
 *   Omit for every scope, which is what the admin feeds need.
 * @returns {Promise<Set<string>>} lowercased, trimmed service names
 */
const fetchVendorlessServiceNames = async (fpId = null) => {
  const names = new Set();
  try {
    const scoped = Number(fpId) > 0;
    const [rows] = await pool.execute(
      `SELECT service_name, configuration FROM service_catalog${scoped ? ' WHERE scope_id IN (0, ?)' : ''}`,
      scoped ? [Number(fpId)] : []
    );
    for (const row of rows) {
      // Parsed per row: one unreadable configuration must not discard every other service's flag
      try {
        const config = typeof row.configuration === 'string' ? JSON.parse(row.configuration) : row.configuration;
        if (config?.skip_vendor_assignment) names.add(key(config.service_name || row.service_name));
      } catch (error) {
        console.log(`[Vendorless Services] Skipped unreadable configuration for "${row.service_name}":`, error.message);
      }
    }
  } catch (error) {
    console.log('[Vendorless Services] Could not read the service catalog:', error.message);
  }
  return names;
};

/** False only for a service explicitly configured to be arranged without a vendor. */
const serviceNeedsVendor = (serviceName, vendorlessNames) =>
  !(vendorlessNames instanceof Set) || !vendorlessNames.has(key(serviceName));

module.exports = { fetchVendorlessServiceNames, serviceNeedsVendor };
