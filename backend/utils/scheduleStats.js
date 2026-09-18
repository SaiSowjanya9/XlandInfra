/**
 * Stat card counts for the All Schedules pages.
 *
 * Every portal (admin, FP, manager, coordinator, supervisor) serves its own
 * /schedules/all endpoint, so the counts live here to keep them identical.
 *
 * 'upcoming' and 'overdue' are NOT stored statuses - scheduled_visits.status is an
 * enum of scheduled / confirmed / work_order_created / in_progress / completed /
 * rescheduled / cancelled / missed. They are derived from scheduled_date on visits
 * that are still open, which is why they must be computed, not grouped by status.
 *
 * 'total' counts active visits only - cancelled visits are reported separately.
 */

const { pool } = require('../config/database');

// The business runs on IST, so "today" must be the Indian date even when the
// server clock is UTC - otherwise between 00:00 and 05:30 IST yesterday's visits
// are counted as due today instead of overdue.
const IST_OFFSET_MINUTES = 330;
const istToday = () => new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000)
  .toISOString()
  .slice(0, 10);

// Visits still awaiting work. The date buckets (overdue / today / upcoming) split
// exactly this set, so they add up to the Scheduled card instead of overlapping
// with the In Progress, Completed and Rescheduled cards.
const OPEN_STATUSES = `('scheduled', 'confirmed', 'work_order_created', 'missed')`;

const emptyScheduleStats = () => ({
  total: 0,
  scheduled: 0,
  upcoming: 0,
  today: 0,
  workOrderCreated: 0,
  inProgress: 0,
  completed: 0,
  rescheduled: 0,
  cancelled: 0,
  overdue: 0
});

/**
 * @param {Object} options
 * @param {string} options.whereClause - Scope filter, e.g. "WHERE op.franchise_partner_id = ?".
 *   Must not filter on sv.status, otherwise the other cards would be zeroed out.
 * @param {Array} options.params - Params for the where clause, in order.
 * @param {string} options.vendorJoinOn - ON condition for the onboarded_vendors join.
 * @param {string} options.label - Log prefix used when the query fails.
 * @returns {Promise<Object>} Counts keyed as the admin portal expects them.
 */
const fetchScheduleStats = async ({
  whereClause = 'WHERE 1=1',
  params = [],
  vendorJoinOn = 'ov.id = pss.vendor_id',
  label = 'All Schedules'
} = {}) => {
  const stats = emptyScheduleStats();

  // COUNT(DISTINCT sv.id) - the vendor join can match more than one row per visit,
  // and SUM(CASE ...) would then count the same visit several times.
  const query = `
    SELECT
      COUNT(DISTINCT CASE WHEN sv.status <> 'cancelled' THEN sv.id END) as total,
      COUNT(DISTINCT CASE WHEN sv.status IN ${OPEN_STATUSES} THEN sv.id END) as scheduled,
      COUNT(DISTINCT CASE WHEN sv.status = 'work_order_created' THEN sv.id END) as workOrderCreated,
      COUNT(DISTINCT CASE WHEN sv.status = 'in_progress' THEN sv.id END) as inProgress,
      COUNT(DISTINCT CASE WHEN sv.status = 'completed' THEN sv.id END) as completed,
      COUNT(DISTINCT CASE WHEN sv.status = 'rescheduled' THEN sv.id END) as rescheduled,
      COUNT(DISTINCT CASE WHEN sv.status = 'cancelled' THEN sv.id END) as cancelled,
      COUNT(DISTINCT CASE WHEN sv.status IN ${OPEN_STATUSES} AND sv.scheduled_date > ? THEN sv.id END) as upcoming,
      COUNT(DISTINCT CASE WHEN sv.status IN ${OPEN_STATUSES} AND sv.scheduled_date = ? THEN sv.id END) as today,
      COUNT(DISTINCT CASE WHEN sv.status IN ${OPEN_STATUSES} AND sv.scheduled_date < ? THEN sv.id END) as overdue
    FROM scheduled_visits sv
    JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
    JOIN onboarded_properties op ON op.id = sv.property_id
    LEFT JOIN onboarded_vendors ov ON ${vendorJoinOn}
    ${whereClause}
  `;

  try {
    const today = istToday();
    // Placeholders bind in order of appearance: the three SELECT dates precede the scope params
    const [[counts]] = await pool.execute(query, [today, today, today, ...params]);
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(counts?.[key]) || 0;
    });
  } catch (err) {
    console.log(`[${label}] Stats query failed:`, err.message);
  }

  return stats;
};

/**
 * Vendors that appear in existing schedules, for the All Schedules vendor filter.
 *
 * The vendor shown on a schedule row comes from property_service_schedules, with
 * scheduled_visits.vendor_id as a fallback - resolving it any other way lists
 * vendors that never appear in the table (or none at all, since sv.vendor_id is
 * frequently null).
 *
 * @param {Object} options
 * @param {string} options.whereClause - Scope filter, e.g. "WHERE op.franchise_partner_id = ?".
 * @param {Array} options.params - Params for the where clause, in order.
 * @param {string} options.label - Log prefix used when the query fails.
 * @returns {Promise<Array>} [{ id, vendor_id, company_name, owner_name, service_type }]
 */
const fetchScheduledVendors = async ({
  whereClause = 'WHERE 1=1',
  params = [],
  label = 'Schedule Vendors'
} = {}) => {
  const query = `
    SELECT DISTINCT ov.id, ov.vendor_id,
           COALESCE(ov.company_name, ov.owner_name) as company_name,
           ov.owner_name, ov.service_type
    FROM scheduled_visits sv
    JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
    JOIN onboarded_properties op ON op.id = sv.property_id
    JOIN onboarded_vendors ov ON ov.id = COALESCE(pss.vendor_id, sv.vendor_id)
    ${whereClause}
    ORDER BY company_name
  `;

  try {
    const [vendors] = await pool.execute(query, params);
    return vendors;
  } catch (err) {
    console.log(`[${label}] Scheduled vendors query failed:`, err.message);
    return [];
  }
};

/**
 * Services that appear in existing schedules, for the All Schedules service filter.
 *
 * @returns {Promise<Array>} [{ id, name, category }]
 */
const fetchScheduledServices = async ({
  whereClause = 'WHERE 1=1',
  params = [],
  label = 'Schedule Services'
} = {}) => {
  const query = `
    SELECT DISTINCT pss.service_name as name, pss.service_category as category
    FROM scheduled_visits sv
    JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
    JOIN onboarded_properties op ON op.id = sv.property_id
    ${whereClause}
    ORDER BY pss.service_name
  `;

  try {
    const [rows] = await pool.execute(query, params);
    return rows
      .filter(r => r.name)
      .map(r => ({ id: r.name, name: r.name, category: r.category || r.name }));
  } catch (err) {
    console.log(`[${label}] Scheduled services query failed:`, err.message);
    return [];
  }
};

/**
 * Zones that appear in existing schedules, for the All Schedules zone filter.
 *
 * @returns {Promise<Array>} [{ id, name }]
 */
const fetchScheduledZones = async ({
  whereClause = 'WHERE 1=1',
  params = [],
  label = 'Schedule Zones'
} = {}) => {
  const query = `
    SELECT DISTINCT op.zone as name
    FROM scheduled_visits sv
    JOIN onboarded_properties op ON op.id = sv.property_id
    ${whereClause}
      AND op.zone IS NOT NULL AND op.zone != ''
    ORDER BY op.zone
  `;

  try {
    const [rows] = await pool.execute(query, params);
    return rows.map(r => ({ id: `schedule-${r.name}`, name: r.name }));
  } catch (err) {
    console.log(`[${label}] Scheduled zones query failed:`, err.message);
    return [];
  }
};

/**
 * SQL fragment for the list/count queries so a status filter of 'upcoming' or
 * 'overdue' matches the same visits the corresponding stat card counted.
 * Returns null for real statuses, which the caller then binds as a parameter.
 */
const derivedStatusFilter = (status) => {
  // Date generated here as YYYY-MM-DD, so it is safe to inline
  const today = istToday();
  if (status === 'upcoming') {
    return ` AND sv.scheduled_date > '${today}' AND sv.status IN ${OPEN_STATUSES}`;
  }
  if (status === 'today') {
    return ` AND sv.scheduled_date = '${today}' AND sv.status IN ${OPEN_STATUSES}`;
  }
  if (status === 'overdue') {
    return ` AND sv.scheduled_date < '${today}' AND sv.status IN ${OPEN_STATUSES}`;
  }
  return null;
};

module.exports = {
  emptyScheduleStats,
  fetchScheduleStats,
  fetchScheduledVendors,
  fetchScheduledServices,
  fetchScheduledZones,
  derivedStatusFilter
};
