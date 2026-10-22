/**
 * May this property's visits be scheduled yet?
 *
 * Confirming a schedule writes `scheduled_visits`, and the **customer portal shows those visits the
 * moment they exist** — service, date, time window, vendor, "visit 3 of 12" — on its Schedules page
 * and its home panel. Those visits are the agreement being carried out, so they must not precede
 * the agreement: the estimate has to be approved by the customer, and paid.
 *
 * That rule already existed, but only in the **queue** that feeds the scheduling screen:
 * `utils/pendingProperties.js` INNER JOINs `fe.status = 'approved'` and requires
 * `payment_status IN ('paid','partial')`. `POST /api/schedules/confirm` checked the caller's role
 * and the payload and nothing else — so a property reached any other way (a propertyId passed
 * straight to the route, a tab left open from before the estimate changed, a re-confirm) could have
 * visits written while its estimate was still Draft, Sent or Rejected. The resident then read a
 * booked service nobody had agreed to, and nothing retracted it if they went on to reject.
 *
 * **A property with no estimate at all is allowed through.** Older and directly-onboarded
 * properties have none, the queue cannot list them either, and refusing them would take away
 * scheduling that works today. This gate exists to stop scheduling *ahead of* an estimate, not to
 * require that one exists.
 *
 * Regression test: `node --test backend/utils/scheduleApproval.test.js`
 */

// The same two conditions `pendingProperties.js` applies, in one place so they cannot drift: the
// screen that lists a property and the route that schedules it must agree about what is ready.
const SCHEDULABLE_STATUS = 'approved';
const SCHEDULABLE_PAYMENT_STATUSES = new Set(['paid', 'partial']);

const normalize = (value) => String(value || '').trim().toLowerCase();

// 'draft' -> 'Draft', for a message a staff member has to act on
const titleCase = (value) => {
  const text = normalize(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'not set';
};

const label = (estimate) => (estimate?.code ? `Estimate ${estimate.code}` : 'This property\'s estimate');

/**
 * The decision, from the property's own estimate rows. Pure, so the rule can be tested without a
 * database and read without following a query.
 *
 * @param {Array<{id:number, code?:string, status?:string, payment_status?:string}>} estimates
 * @returns {{allowed:boolean, estimateId:number|null, reason:string|null}} `estimateId` is the
 *   estimate that authorises the schedule, which the caller stamps onto the schedule row.
 */
const resolveScheduleGate = (estimates = []) => {
  const rows = Array.isArray(estimates) ? estimates : [];
  // No estimate: nothing to be ahead of.
  if (rows.length === 0) return { allowed: true, estimateId: null, reason: null };

  const approved = rows.filter((row) => normalize(row.status) === SCHEDULABLE_STATUS);
  const settled = approved.find((row) => SCHEDULABLE_PAYMENT_STATUSES.has(normalize(row.payment_status)));
  if (settled) return { allowed: true, estimateId: settled.id ?? null, reason: null };

  // Approved but unpaid is a different problem from unapproved, and the fix is a different person's
  // job, so the two never share a message.
  if (approved.length > 0) {
    return {
      allowed: false,
      estimateId: null,
      reason: `${label(approved[0])} is approved but no payment has been recorded against it `
        + `(payment status: ${titleCase(approved[0].payment_status)}). Record the payment before scheduling its visits.`
    };
  }

  const states = [...new Set(rows.map((row) => titleCase(row.status)))].join(', ');
  return {
    allowed: false,
    estimateId: null,
    reason: `${label(rows[0])} has not been approved yet (${states}). The customer's visits can only be `
      + 'scheduled once the estimate is approved and paid — they appear in their portal as soon as they exist.'
  };
};

/**
 * The same decision, for a property identified the way the rest of the code identifies one.
 *
 * An estimate stores the numeric property id, but `property_code` is matched as well: the gate must
 * not fail *open* because a row happened to carry the code instead, which is the one mistake that
 * would make this guard pointless.
 */
const propertyScheduleGate = async (pool, property) => {
  const id = Number(property?.id) || 0;
  const code = property?.code ? String(property.code) : '';
  if (!id && !code) {
    return { allowed: false, estimateId: null, reason: 'A property is required before scheduling.' };
  }

  const [rows] = await pool.execute(
    `SELECT id, estimate_id AS code, status, payment_status
       FROM fp_estimates
      WHERE property_id = ? OR (? <> '' AND property_code = ?)
      ORDER BY id DESC`,
    [id, code, code]
  );
  return resolveScheduleGate(rows);
};

/**
 * Whether `property_service_schedules` has its `estimate_id` column.
 *
 * schema_v22 creates it and `services/schedulingService.js` fills it, but the two inserts behind the
 * Property Scheduling screen never did — so no one could tell which estimate a schedule came from,
 * which is what makes retracting the right visits on a rejection impossible. Checked once, because
 * naming a column a deployment lacks fails the whole insert.
 */
let estimateColumnPromise = null;

const hasScheduleEstimateColumn = (pool) => {
  if (!estimateColumnPromise) {
    estimateColumnPromise = pool
      .execute(
        `SELECT COUNT(*) AS n FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'property_service_schedules'
            AND column_name = 'estimate_id'`
      )
      .then(([rows]) => Number(rows?.[0]?.n) > 0)
      .catch(() => false);
  }
  return estimateColumnPromise;
};

module.exports = {
  SCHEDULABLE_STATUS,
  SCHEDULABLE_PAYMENT_STATUSES,
  resolveScheduleGate,
  propertyScheduleGate,
  hasScheduleEstimateColumn
};
