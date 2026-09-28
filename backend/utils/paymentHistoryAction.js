const { pool } = require('../config/database');

/**
 * What may be written to `payment_history.action` on the database in front of us.
 *
 * The column started life as ENUM('created','updated','status_changed','refunded','deleted').
 * `schema_v27_payment_history_action_fix.sql` widens it to VARCHAR(50), but a deployment still on the
 * ENUM truncates anything outside that list -- MySQL raises WARN_DATA_TRUNCATED, errno 1265 -- and
 * three of the values we write are outside it: `razorpay_payment`, `failed` and `refund`.
 *
 * That mattered far more than an audit trail should. The Razorpay history row is written inside the
 * same transaction as the payment itself, so the truncation rolled back the payment: a customer paid,
 * Razorpay confirmed it, and nothing was recorded. This resolves the action instead:
 *
 *   - column already widened -> write the value as it is;
 *   - still an ENUM -> widen it, exactly as the migration would, then write the value;
 *   - cannot widen it (no ALTER right) -> write the nearest legal member and say so in the log.
 *
 * The Razorpay tab matches on `razorpay_payment_id IS NOT NULL` as well as on the action, so a
 * substituted value still lists the payment where it belongs.
 */

// Members of the original ENUM, i.e. what is safe on a database that has not been widened
const LEGACY_ACTIONS = new Set(['created', 'updated', 'status_changed', 'refunded', 'deleted']);
// Nearest legal member for each value the ENUM never had
const FALLBACKS = { razorpay_payment: 'status_changed', failed: 'status_changed', refund: 'refunded' };

// One lookup per process: the column does not change under a running server unless we change it
let columnState = null;

const readColumnType = async () => {
  const [rows] = await pool.execute(`
    SELECT COLUMN_TYPE AS type
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_history' AND COLUMN_NAME = 'action'
  `);
  return rows[0]?.type ? String(rows[0].type).toLowerCase() : null;
};

const resolveColumn = async () => {
  if (columnState) return columnState;
  try {
    const type = await readColumnType();
    // No such table or column yet: let the insert speak for itself rather than guessing
    if (!type) return (columnState = { widened: true });
    if (!type.startsWith('enum')) return (columnState = { widened: true });
    try {
      await pool.execute(`ALTER TABLE payment_history MODIFY COLUMN action VARCHAR(50) NOT NULL DEFAULT 'created'`);
      console.log('[payment_history] action widened to VARCHAR(50); schema_v27 had not been applied');
      return (columnState = { widened: true });
    } catch (alterError) {
      console.warn(`[payment_history] action is still ${type} and could not be widened (${alterError.message}). ` +
        'Apply backend/database/migrations/schema_v27_payment_history_action_fix.sql; until then the ' +
        'action is recorded as its nearest legal value.');
      return (columnState = { widened: false });
    }
  } catch (error) {
    // Unable to tell: assume the worst, so a payment is never lost to a truncated audit row
    console.warn(`[payment_history] could not read the action column (${error.message}); using legacy actions`);
    return (columnState = { widened: false });
  }
};

const paymentHistoryAction = async (action) => {
  const value = String(action || 'created');
  if (LEGACY_ACTIONS.has(value)) return value;
  const { widened } = await resolveColumn();
  return widened ? value : (FALLBACKS[value] || 'status_changed');
};

// Tests and boot-time schema work need to forget what we learned about the column
const resetPaymentHistoryActionCache = () => { columnState = null; };

module.exports = { paymentHistoryAction, resetPaymentHistoryActionCache, LEGACY_ACTIONS, FALLBACKS };
