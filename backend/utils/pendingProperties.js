/**
 * Shared field helpers for the Pending Property Schedules feed.
 *
 * Every portal (admin, FP, manager) serves its own /schedules/pending-properties
 * endpoint. These helpers keep the row shape identical and, more importantly,
 * keep it honest: a missing zone / property type / package is returned as null so
 * the UI can show a dash, instead of being filled with a plausible-looking
 * default like 'Zone A' or 'Apartment'.
 */

const { pool } = require('../config/database');

// A property is badged "New" only while it is genuinely new
const NEW_PROPERTY_WINDOW_DAYS = 3;

// Empty strings come from COALESCE(..., '') in the legacy half of the UNION
const orNull = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed === '' ? null : trimmed;
};

const isRecentlyAdded = (addedOn) => {
  if (!addedOn) return false;
  const added = new Date(addedOn);
  if (isNaN(added.getTime())) return false;
  const days = (Date.now() - added.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= NEW_PROPERTY_WINDOW_DAYS;
};

// Report the payment status the estimate actually has
const formatPaymentStatus = (status) => {
  const value = orNull(status);
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

/**
 * property_vendor_assignments only records the service on deployments where the
 * column was added (it is missing from the schema this repo creates), so the
 * per-service half of the lookup has to be probed instead of assumed.
 * Resolved once per process.
 */
let pvaServiceColumnPromise = null;
const getPvaServiceColumn = () => {
  if (!pvaServiceColumnPromise) {
    pvaServiceColumnPromise = pool
      .execute(
        `SELECT column_name AS name FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'property_vendor_assignments'
           AND column_name IN ('service_type', 'service_name')
         LIMIT 1`
      )
      .then(([rows]) => rows[0]?.name || null)
      .catch(() => null);
  }
  return pvaServiceColumnPromise;
};

/**
 * Per-service vendor details for a set of properties, so each service row can
 * show whether it really has a vendor. Reads both the vendor assignment table
 * and the service schedules, since a vendor can be attached through either.
 *
 * @param {Array<number>} propertyIds
 * @returns {Promise<Map<string, Object>>} keyed `${propertyId}::${lowercased service name}`
 */
const fetchServiceVendorMap = async (propertyIds = []) => {
  const map = new Map();
  const ids = propertyIds.filter(id => id !== null && id !== undefined);
  if (ids.length === 0) return map;

  const placeholders = ids.map(() => '?').join(',');
  const key = (propertyId, serviceName) => `${propertyId}::${(serviceName || '').toLowerCase().trim()}`;

  // Only one of two known column names can reach the SQL below
  const serviceColumn = await getPvaServiceColumn();
  if (serviceColumn) {
    try {
      const [assignments] = await pool.execute(
        `SELECT pva.property_id, pva.${serviceColumn} as service_name, pva.vendor_id,
                COALESCE(ov.company_name, ov.owner_name) as vendor_name
         FROM property_vendor_assignments pva
         LEFT JOIN onboarded_vendors ov ON ov.id = pva.vendor_id
         WHERE pva.property_id IN (${placeholders}) AND pva.is_active = 1`,
        ids
      );
      assignments.forEach(row => {
        map.set(key(row.property_id, row.service_name), {
          vendorId: row.vendor_id,
          vendorName: row.vendor_name,
          scheduleDate: null,
          targetDate: null
        });
      });
    } catch (err) {
      console.log('[Pending Properties] Vendor assignment lookup failed:', err.message);
    }
  }

  try {
    // Schedules win over plain assignments - they also carry the planned dates
    const [schedules] = await pool.execute(
      `SELECT pss.property_id, pss.service_name, pss.vendor_id, pss.start_date, pss.end_date,
              COALESCE(ov.company_name, ov.owner_name) as vendor_name
       FROM property_service_schedules pss
       LEFT JOIN onboarded_vendors ov ON ov.id = pss.vendor_id
       WHERE pss.property_id IN (${placeholders})`,
      ids
    );
    schedules.forEach(row => {
      const existing = map.get(key(row.property_id, row.service_name)) || {};
      map.set(key(row.property_id, row.service_name), {
        vendorId: row.vendor_id || existing.vendorId || null,
        vendorName: row.vendor_name || existing.vendorName || null,
        scheduleDate: row.start_date || null,
        targetDate: row.end_date || null
      });
    });
  } catch (err) {
    console.log('[Pending Properties] Service schedule lookup failed:', err.message);
  }

  return map;
};

/**
 * Map the raw estimate service rows onto the shape the page expects, using real
 * vendor data from fetchServiceVendorMap.
 */
const mapPendingServices = (services, propertyId, vendorMap) => {
  if (!Array.isArray(services)) return [];
  return services.map(s => {
    const name = s.service || s.name || s.serviceType || null;
    const vendorInfo = vendorMap?.get(`${propertyId}::${(name || '').toLowerCase().trim()}`) || {};
    return {
      name,
      frequency: s.frequencyType || s.frequency || null,
      frequencyCount: s.frequencyCount || 1,
      visits: s.frequencyCount || 1,
      vendorAssigned: !!vendorInfo.vendorId,
      vendorName: vendorInfo.vendorName || null,
      scheduleDate: vendorInfo.scheduleDate || null,
      targetDate: vendorInfo.targetDate || null
    };
  });
};

module.exports = {
  NEW_PROPERTY_WINDOW_DAYS,
  orNull,
  isRecentlyAdded,
  formatPaymentStatus,
  fetchServiceVendorMap,
  mapPendingServices
};
