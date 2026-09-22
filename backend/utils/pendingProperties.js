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
const { assignVendorFilter } = require('./estimateScheduling');
const { fetchVendorlessServiceNames, serviceNeedsVendor } = require('./vendorlessServices');

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
const mapPendingServices = (services, propertyId, vendorMap, vendorlessNames = null) => {
  if (!Array.isArray(services)) return [];
  return services.map(s => {
    const name = s.service || s.name || s.serviceType || null;
    const vendorInfo = vendorMap?.get(`${propertyId}::${(name || '').toLowerCase().trim()}`) || {};
    return {
      name,
      frequency: s.frequencyType || s.frequency || null,
      frequencyCount: s.frequencyCount || 1,
      visits: s.frequencyCount || 1,
      // A service configured with "Do Not Assign Vendor" is arranged without one, so it is
      // never counted as awaiting a vendor and never scheduled
      vendorRequired: serviceNeedsVendor(name, vendorlessNames),
      vendorAssigned: !!vendorInfo.vendorId,
      vendorName: vendorInfo.vendorName || null,
      scheduleDate: vendorInfo.scheduleDate || null,
      targetDate: vendorInfo.targetDate || null
    };
  });
};

/**
 * Properties of one franchise partner that are paid but not fully scheduled yet.
 * Shared by the FP, Manager, Coordinator and Supervisor portals so every portal
 * shows the same rows, counts and per-service vendor state.
 *
 * @param {number} franchisePartnerId
 * @returns {Promise<Array>} rows in the shape the Pending Property Schedules page expects
 */
const fetchPendingPropertiesForFp = async (franchisePartnerId) => {
  if (!franchisePartnerId) return [];

  // An estimate that answered No to "Assign / Schedule Vendor" stays out of the queue
  const assignVendorSql = await assignVendorFilter('fe');

  // Covers both onboarded_properties (current) and properties (legacy)
  const query = `
    SELECT * FROM (
      SELECT DISTINCT
        op.id,
        op.property_id as propertyId,
        op.community_name as propertyName,
        op.property_type as propertyType,
        op.zone,
        op.area_name as areaName,
        op.created_at as addedOn,
        op.franchise_partner_id as fpId,
        fe.id as estimateId,
        fe.estimate_id as estimateCode,
        COALESCE(NULLIF(fe.package_name, ''), fpamc.name) as packageName,
        fe.estimate_type as estimateType,
        fe.total_amount as totalPrice,
        fe.status as estimateStatus,
        fe.payment_status as paymentStatus,
        fe.package_services as serviceRows,
        pc.name as customerName,
        pc.phone as customerPhone,
        pc.email as customerEmail,
        (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) as assignedVendors,
        (SELECT COUNT(*) FROM property_service_schedules pss WHERE pss.property_id = op.id AND pss.scheduling_status IN ('scheduled', 'completed')) as scheduledServiceCount,
        (SELECT COUNT(*) FROM scheduled_visits sv WHERE sv.property_id = op.id) as totalScheduledVisits,
        JSON_LENGTH(COALESCE(fe.package_services, '[]')) as totalServices,
        'onboarded' as source
      FROM onboarded_properties op
      INNER JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
      LEFT JOIN fp_amc_packages fpamc ON fpamc.id = fe.package_id AND fpamc.franchise_partner_id = fe.franchise_partner_id
      LEFT JOIN property_contacts pc ON pc.id = (SELECT pc2.id FROM property_contacts pc2 WHERE pc2.property_id = op.id ORDER BY pc2.id LIMIT 1)
      WHERE op.status = 'active'
        AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')${assignVendorSql}
        AND op.franchise_partner_id = ?

      UNION ALL

      SELECT DISTINCT
        p.id,
        p.property_id as propertyId,
        p.name as propertyName,
        p.property_type as propertyType,
        COALESCE(fe.zone, '') as zone,
        COALESCE(p.city, '') as areaName,
        p.created_at as addedOn,
        fe.franchise_partner_id as fpId,
        fe.id as estimateId,
        fe.estimate_id as estimateCode,
        COALESCE(NULLIF(fe.package_name, ''), fpamc.name) as packageName,
        fe.estimate_type as estimateType,
        fe.total_amount as totalPrice,
        fe.status as estimateStatus,
        fe.payment_status as paymentStatus,
        fe.package_services as serviceRows,
        fe.client_name as customerName,
        fe.client_phone as customerPhone,
        fe.client_email as customerEmail,
        (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = p.id AND pva.is_active = 1) as assignedVendors,
        (SELECT COUNT(*) FROM property_service_schedules pss WHERE pss.property_id = p.id AND pss.scheduling_status IN ('scheduled', 'completed')) as scheduledServiceCount,
        (SELECT COUNT(*) FROM scheduled_visits sv WHERE sv.property_id = p.id) as totalScheduledVisits,
        JSON_LENGTH(COALESCE(fe.package_services, '[]')) as totalServices,
        'legacy' as source
      FROM properties p
      INNER JOIN fp_estimates fe ON fe.property_id = p.id AND fe.status = 'approved'
      LEFT JOIN fp_amc_packages fpamc ON fpamc.id = fe.package_id AND fpamc.franchise_partner_id = fe.franchise_partner_id
      WHERE p.status = 'active'
        AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')${assignVendorSql}
        AND fe.franchise_partner_id = ?
        AND p.id NOT IN (SELECT id FROM onboarded_properties)
    ) combined
    WHERE scheduledServiceCount < totalServices OR totalServices = 0
    ORDER BY addedOn DESC
  `;

  const [properties] = await pool.execute(query, [franchisePartnerId, franchisePartnerId]);

  // Real per-service vendor details, so service rows are not all reported as unassigned
  const serviceVendorMap = await fetchServiceVendorMap(properties.map(p => p.id));
  // Services this FP arranges without a vendor: they never count as pending
  const vendorlessNames = await fetchVendorlessServiceNames(franchisePartnerId);

  return properties.map(p => {
    let services = [];
    let totalServices = 0;

    if (p.serviceRows) {
      try {
        services = typeof p.serviceRows === 'string' ? JSON.parse(p.serviceRows) : p.serviceRows;
        totalServices = Array.isArray(services) ? services.length : 0;
      } catch (e) {
        console.warn('Error parsing service rows:', e.message);
      }
    }

    const assignedVendors = p.assignedVendors || 0;
    const serviceRows = mapPendingServices(services, p.id, serviceVendorMap, vendorlessNames);

    return {
      id: p.id,
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      customerName: orNull(p.customerName),
      customerPhone: orNull(p.customerPhone),
      customerEmail: orNull(p.customerEmail),
      propertyType: orNull(p.propertyType),
      zone: orNull(p.zone),
      areaName: orNull(p.areaName),
      packageName: orNull(p.packageName),
      estimateType: orNull(p.estimateType),
      estimateId: p.estimateId,
      estimateCode: p.estimateCode,
      totalPrice: p.totalPrice,
      totalServices,
      assignedVendors: Math.min(assignedVendors, totalServices),
      // Counted from the rows, so a service arranged without a vendor never leaves the
      // property waiting for one
      pendingServices: serviceRows.filter(row => row.vendorRequired && !row.vendorAssigned).length,
      vendorlessServices: serviceRows.filter(row => !row.vendorRequired).length,
      paymentStatus: formatPaymentStatus(p.paymentStatus),
      addedOn: p.addedOn,
      fpId: p.fpId,
      isNew: isRecentlyAdded(p.addedOn),
      services: serviceRows
    };
  });
};

module.exports = {
  NEW_PROPERTY_WINDOW_DAYS,
  orNull,
  isRecentlyAdded,
  formatPaymentStatus,
  fetchServiceVendorMap,
  mapPendingServices,
  fetchPendingPropertiesForFp,
  fetchVendorlessServiceNames,
  serviceNeedsVendor
};
