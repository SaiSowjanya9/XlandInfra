/**
 * "Assign / Schedule Vendor" on Create Estimate.
 *
 * Answering No keeps the property out of Pending Property Schedules; answering Yes is the existing
 * behaviour and also lets a vendor be attached to each service at creation time.
 *
 * fp_estimates.assign_vendor is NULL for every estimate created before the column existed, and
 * those must keep reaching the scheduling queue, so only an explicit 0 excludes a property.
 *
 * The column may be missing on a deployment that has not applied
 * schema_v34_estimate_assign_vendor.sql yet. Referencing it would break the dashboards outright,
 * so its presence is checked once and the filter is simply omitted until it exists.
 */

const { pool } = require('../config/database');

let columnPromise = null;

const hasAssignVendorColumn = () => {
  if (!columnPromise) {
    columnPromise = pool.execute(
      `SELECT COUNT(*) as n FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'fp_estimates' AND column_name = 'assign_vendor'`
    ).then(([rows]) => (rows[0]?.n || 0) > 0)
      .catch(error => {
        console.log('[Estimate Scheduling] Could not check assign_vendor:', error.message);
        columnPromise = null;
        return false;
      });
  }
  return columnPromise;
};

/** SQL to keep estimates answered "No" out of a scheduling feed, or '' when the column is absent. */
const assignVendorFilter = async (alias = 'fe') =>
  (await hasAssignVendorColumn()) ? ` AND (${alias}.assign_vendor IS NULL OR ${alias}.assign_vendor <> 0)` : '';

/** An unanswered toggle keeps today's behaviour, so only an explicit false becomes 0. */
const normalizeAssignVendor = value => {
  if (value === undefined || value === null || value === '') return null;
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' ? 1 : 0;
};

/**
 * Attach a vendor to each service named on the estimate. A vendor outside the FP's own set is
 * skipped and reported rather than assigned, and one bad row never fails the estimate itself.
 *
 * @param {{ propertyId: number, fpId: number, assignments: Array<{service?: string, serviceType?: string, vendorId?: number|string}>, assignedBy: number }}
 * @returns {Promise<{ assigned: number, skipped: string[] }>}
 */
const applyEstimateVendorAssignments = async ({ propertyId, fpId, assignments, assignedBy }) => {
  const { resolveVendor, upsertPropertyVendorAssignment } = require('./vendorAssignments');
  const { fetchVendorlessServiceNames, serviceNeedsVendor } = require('./vendorlessServices');
  const result = { assigned: 0, skipped: [] };
  // A service configured with "Do Not Assign Vendor" is arranged without one, so no vendor is
  // attached to it even if the estimate form offered one
  const vendorlessNames = await fetchVendorlessServiceNames(fpId);
  for (const row of assignments.slice(0, 100)) {
    const serviceType = String(row?.service ?? row?.serviceType ?? '').trim();
    const requested = row?.vendorId ?? row?.vendor_id;
    if (!serviceType || requested == null || requested === '') continue;
    if (!serviceNeedsVendor(serviceType, vendorlessNames)) continue;
    try {
      const vendor = await resolveVendor(requested);
      if (!vendor) {
        result.skipped.push(serviceType);
        continue;
      }
      // A vendor belonging to another franchise must never be attached to this property
      const [[owned]] = await pool.execute(
        `SELECT id FROM onboarded_vendors WHERE id = ? AND (franchise_partner_id = ? OR franchise_partner_id IS NULL)`,
        [vendor.id, fpId || null]
      );
      if (!owned) {
        result.skipped.push(serviceType);
        continue;
      }
      await upsertPropertyVendorAssignment({ propertyId, vendorId: vendor.id, serviceType, assignedBy });
      result.assigned += 1;
    } catch (error) {
      console.log(`[Estimate Scheduling] Could not assign a vendor for "${serviceType}":`, error.message);
      result.skipped.push(serviceType);
    }
  }
  return result;
};

module.exports = { assignVendorFilter, hasAssignVendorColumn, normalizeAssignVendor, applyEstimateVendorAssignments };
