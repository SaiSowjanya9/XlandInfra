const { pool } = require('../config/database');

/**
 * What may be written to `payment_history.payment_method_details` on the database in front of us.
 *
 * schema_v22 adds the column as JSON, but a deployment where it was created narrower (a VARCHAR)
 * rejects the Razorpay audit blob with "Data too long for column 'payment_method_details'". That
 * row is written inside the payment's own transaction, so the error rolled the payment back: the
 * customer paid, Razorpay confirmed it, and nothing was recorded. This resolves the column the way
 * paymentHistoryAction resolves `action`:
 *
 *   - JSON or a TEXT type that holds it -> write the details as they are;
 *   - a bounded string type -> widen it to TEXT, as schema_v59 would, then write;
 *   - cannot widen it (no ALTER right) -> write a compact form that fits, or NULL.
 *
 * Call `ensurePaymentMethodDetailsColumn()` before `beginTransaction`: DDL commits implicitly.
 */

const BOUNDED = /^(var)?char|^tinytext/;

let columnState = null;

const ensurePaymentMethodDetailsColumn = async () => {
  if (columnState) return columnState;
  try {
    const [rows] = await pool.execute(`
      SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLength
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_history' AND COLUMN_NAME = 'payment_method_details'
    `);
    const dataType = rows[0]?.dataType ? String(rows[0].dataType).toLowerCase() : null;
    // No such column: let the insert speak for itself rather than guessing
    if (!dataType || !BOUNDED.test(dataType)) return (columnState = { maxLength: null });
    try {
      await pool.execute('ALTER TABLE payment_history MODIFY COLUMN payment_method_details TEXT NULL');
      console.log(`[payment_history] payment_method_details widened from ${dataType}(${rows[0].maxLength}) to TEXT; schema_v59 had not been applied`);
      return (columnState = { maxLength: null });
    } catch (alterError) {
      console.warn(`[payment_history] payment_method_details is ${dataType}(${rows[0].maxLength}) and could not be widened ` +
        `(${alterError.message}). Apply backend/database/migrations/schema_v59_payment_method_details_width.sql; ` +
        'until then the details are stored compacted or not at all.');
      return (columnState = { maxLength: Number(rows[0].maxLength) || 0 });
    }
  } catch (error) {
    // Unable to tell: assume the worst, so a payment is never lost to an audit column
    console.warn(`[payment_history] could not read payment_method_details (${error.message}); details will be compacted`);
    return (columnState = { maxLength: 0 });
  }
};

// The details serialised to fit the column: in full, without empty keys, or NULL.
const paymentMethodDetailsValue = async (details) => {
  const full = JSON.stringify(details);
  const { maxLength } = await ensurePaymentMethodDetailsColumn();
  if (maxLength === null || full.length <= maxLength) return full;
  const compact = JSON.stringify(Object.fromEntries(Object.entries(details).filter(([, value]) => value != null && value !== '')));
  return compact.length <= maxLength ? compact : null;
};

// Tests and boot-time schema work need to forget what we learned about the column
const resetPaymentMethodDetailsCache = () => { columnState = null; };

module.exports = { ensurePaymentMethodDetailsColumn, paymentMethodDetailsValue, resetPaymentMethodDetailsCache };
