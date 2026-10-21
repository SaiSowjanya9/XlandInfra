const { pool } = require('../config/database');

/**
 * What an invoice write may rely on in `invoices` beyond what the schema files create.
 *
 * `paid_at` is written whenever a payment completes -- by the shared verify route
 * (PUT /api/payments/:id/verify, behind every staff portal's Payments screen) and by
 * recordRazorpayPayment() -- but **no schema file or migration ever created it**. It is not in
 * schema_v17's CREATE TABLE, not in v18/v21/v22's ALTERs, and not in v46's drift repair, so this
 * is not the usual "the VPS is behind the repo": the column is missing everywhere.
 *
 * Both writes failed with "Unknown column 'paid_at' in 'field list'", and neither failed safely:
 *
 *   - the verify route updates `payments` and writes the history row first, so the payment was
 *     marked paid while its invoice kept its old amount_paid/balance/status. Scheduling was never
 *     triggered and no receipt was sent, because both sit after the invoice update.
 *   - recordRazorpayPayment runs inside the payment's own transaction, so the error rolled the
 *     whole thing back -- the customer paid through the customer portal or a payment link,
 *     Razorpay confirmed it, and nothing was recorded. The same way a truncated
 *     payment_history.action used to lose a payment (see utils/paymentHistoryAction.js).
 *
 * Resolved the way ensurePaymentColumns resolves its table: read information_schema once per
 * process, ALTER exactly what the migration would, and name the missing migration in the log.
 * A database that is already current pays one cached flag check.
 *
 * DDL commits implicitly in MySQL, so callers must await this BEFORE opening a transaction.
 */

const COLUMNS = {
  // schema_v53_invoice_paid_at.sql -- when the invoice was first settled in full
  paid_at: 'DATETIME NULL',
  // Same migration: the archive/restore routes used to ALTER these in on every request
  archived: 'TINYINT(1) DEFAULT 0',
  archived_at: 'TIMESTAMP NULL'
};

let ensured = null;

/**
 * The columns `invoices` has, after adding whatever was missing and could be added.
 * Resolves to an empty set when the table cannot be read at all -- see paidAtAssignment.
 */
const ensureInvoiceColumns = () => {
  if (!ensured) {
    ensured = (async () => {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'`
      );
      const existing = new Set(rows.map(row => row.name));
      for (const [column, definition] of Object.entries(COLUMNS)) {
        if (existing.has(column)) continue;
        try {
          await pool.execute(`ALTER TABLE invoices ADD COLUMN ${column} ${definition}`);
          existing.add(column);
          console.log(`[invoices] added ${column}; schema_v53_invoice_paid_at had not been applied`);
        } catch (error) {
          console.warn(`[invoices] could not add ${column} (${error.message}). ` +
            'Apply backend/database/migrations/schema_v53_invoice_paid_at.sql; until then the ' +
            'column is left out of the write rather than failing it.');
        }
      }
      return existing;
    })().catch(error => {
      // Do not cache a failed pass: the next write tries again rather than staying broken
      ensured = null;
      console.warn(`[invoices] column check failed (${error.message})`);
      return new Set();
    });
  }
  return ensured;
};

/**
 * The `paid_at` assignment for an invoice UPDATE's SET list, as SQL plus its parameter.
 *
 * Where the column could not be created -- the database user has no ALTER right, or the table
 * could not be read -- this is empty and the invoice is updated without it. A settlement
 * timestamp is worth far less than the payment: writing it unconditionally is what rolled a
 * Razorpay payment back and what left a verified payment's invoice stale.
 *
 * Splice `sql` into the SET list and `params` into the parameter array in the same position.
 */
const paidAtAssignment = async (status) => {
  const columns = await ensureInvoiceColumns();
  if (!columns.has('paid_at')) return { sql: '', params: [] };
  return { sql: `paid_at = IF(? = 'paid', IFNULL(paid_at, NOW()), paid_at),`, params: [status] };
};

// Tests need to forget what we learned about the table
const resetInvoiceColumnsCache = () => { ensured = null; };

module.exports = { ensureInvoiceColumns, paidAtAssignment, resetInvoiceColumnsCache };
