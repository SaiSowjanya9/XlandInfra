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

const emptyScheduleStats = () => ({
  total: 0,
  scheduled: 0,
  upcoming: 0,
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

  const query = `
    SELECT
      SUM(CASE WHEN sv.status <> 'cancelled' THEN 1 ELSE 0 END) as total,
      SUM(CASE WHEN sv.status IN ('scheduled', 'confirmed', 'upcoming', 'work_order_created') THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN sv.status = 'work_order_created' THEN 1 ELSE 0 END) as workOrderCreated,
      SUM(CASE WHEN sv.status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN sv.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN sv.status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled,
      SUM(CASE WHEN sv.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN sv.status NOT IN ('completed', 'cancelled') AND sv.scheduled_date > CURDATE() THEN 1 ELSE 0 END) as upcoming,
      SUM(CASE WHEN sv.status NOT IN ('completed', 'cancelled') AND sv.scheduled_date < CURDATE() THEN 1 ELSE 0 END) as overdue
    FROM scheduled_visits sv
    JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
    JOIN onboarded_properties op ON op.id = sv.property_id
    LEFT JOIN onboarded_vendors ov ON ${vendorJoinOn}
    ${whereClause}
  `;

  try {
    const [[counts]] = await pool.execute(query, params);
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(counts?.[key]) || 0;
    });
  } catch (err) {
    console.log(`[${label}] Stats query failed:`, err.message);
  }

  return stats;
};

/**
 * SQL fragment for the list/count queries so a status filter of 'upcoming' or
 * 'overdue' matches the same visits the corresponding stat card counted.
 * Returns null for real statuses, which the caller then binds as a parameter.
 */
const derivedStatusFilter = (status) => {
  if (status === 'upcoming') {
    return ` AND sv.scheduled_date > CURDATE() AND sv.status NOT IN ('completed', 'cancelled')`;
  }
  if (status === 'overdue') {
    return ` AND sv.scheduled_date < CURDATE() AND sv.status NOT IN ('completed', 'cancelled')`;
  }
  return null;
};

module.exports = { fetchScheduleStats, derivedStatusFilter };
