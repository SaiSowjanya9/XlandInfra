/**
 * Repairs `invoices.amount_paid` / `balance_amount` / `payment_status` / `status` for invoices the
 * verify route's double-count inflated: `SUM(payments paid|completed)` was taken AFTER the payment
 * was already marked paid, then the payment's amount was added a second time. A ₹1,00,870
 * verification wrote amount_paid ₹2,01,740 with balance ₹0, so the invoice looked paid while
 * its PAID column read double.
 *
 * Every row is recomputed from the payments table, which is the truth. Rows whose amount_paid is
 * non-zero with NO confirmed payments are listed for review, not zeroed — an imported or
 * hand-settled invoice can legitimately have a figure no payment row explains.
 *
 *   node scripts/repair-invoice-paid-amounts.js          # dry run: lists what would change
 *   node scripts/repair-invoice-paid-amounts.js --apply  # rewrites the mismatched rows
 *
 * Uses the same database settings as the server (config/database.js), so on the VPS it runs
 * against production when NODE_ENV=production. Take a backup first.
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { ensureInvoiceColumns } = require('../utils/invoiceColumns');
const { ensureRefundTable } = require('../utils/refundLedger');

const apply = process.argv.includes('--apply');
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

(async () => {
  const hasPaidAt = (await ensureInvoiceColumns()).has('paid_at');
  const hasRefunds = await ensureRefundTable();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Invoices whose recorded figure disagrees with the confirmed payments behind them.
    // Settled money is payments-minus-processed-refunds — the same truth resync computes.
    const [mismatched] = await connection.query(`
      SELECT i.id, i.invoice_id, i.customer_name, i.total_amount, i.amount_paid, i.balance_amount, i.status,
             GREATEST(0, COALESCE(s.confirmed, 0) - COALESCE(r.refunded, 0)) AS confirmed_paid
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS confirmed FROM payments
        WHERE status IN ('paid', 'completed') GROUP BY invoice_id
      ) s ON s.invoice_id = i.id
      ${hasRefunds ? `LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS refunded FROM payment_refunds
        WHERE status = 'processed' GROUP BY invoice_id
      ) r ON r.invoice_id = i.id` : ''}
      WHERE COALESCE(i.amount_paid, 0) <> GREATEST(0, COALESCE(s.confirmed, 0) - COALESCE(r.refunded, 0))
      ORDER BY i.id FOR UPDATE`);

    // The ones with confirmed payments can be repaired outright
    const repairable = mismatched.filter((row) => parseFloat(row.confirmed_paid) > 0);
    // amount_paid > 0 with no confirmed payments: print, don't touch
    const unexplainable = mismatched.filter((row) => parseFloat(row.confirmed_paid) === 0);

    console.log(`${mismatched.length} invoice(s) disagree with their payments: ${repairable.length} repairable, ${unexplainable.length} with no confirmed payments.`);

    // Is the doubling from the verify bug (one payment row) or a duplicated insert (two rows
    // for one payment)? Two rows with the same amount, method and reference, minutes apart,
    // is one payment written twice — deleting a row, not zeroing, is the honest fix, so the
    // script reports rather than repairs it. Whether the customer was charged twice is a
    // bank/Razorpay statement question, not a table question.
    const [duplicates] = await connection.query(`
      SELECT p.invoice_id, i.invoice_id AS invoice_code,
             COUNT(*) AS n, GROUP_CONCAT(p.payment_id ORDER BY p.id) AS payment_codes,
             p.amount, p.payment_method, COALESCE(p.transaction_reference, '') AS ref
      FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE p.status IN ('paid', 'completed')
      GROUP BY p.invoice_id, p.payment_method, ref, p.amount
      HAVING n > 1`);
    for (const dup of duplicates) {
      console.log(`  REVIEW: ${dup.invoice_code} has ${dup.n} confirmed payments of ${money(dup.amount)} ` +
        `(${dup.payment_method}${dup.ref ? `, ref ${dup.ref}` : ''}): ${dup.payment_codes} — ` +
        `check whether the customer paid twice before deleting a duplicate`);
    }

    for (const row of repairable) {
      const confirmed = parseFloat(row.confirmed_paid);
      const balance = Math.max(0, parseFloat(row.total_amount || 0) - confirmed);
      const status = balance <= 0 ? 'paid' : 'partially_paid';
      console.log(`  ${row.invoice_id} (${row.customer_name || 'no name'}): ` +
        `paid ${money(row.amount_paid)} -> ${money(confirmed)}, ` +
        `balance ${money(row.balance_amount)} -> ${money(balance)}, status ${row.status} -> ${status}`);
      if (apply) {
        await connection.query(`
          UPDATE invoices SET
            amount_paid = ?, balance_amount = ?, payment_status = ?, status = ?,
            ${hasPaidAt ? "paid_at = IF(? = 'paid', IFNULL(paid_at, NOW()), NULL)," : ''}
            updated_at = NOW()
          WHERE id = ?
        `, hasPaidAt
          ? [confirmed, balance, status, status, status, row.id]
          : [confirmed, balance, status, status, row.id]);
      }
    }

    for (const row of unexplainable) {
      console.log(`  ${row.invoice_id} (${row.customer_name || 'no name'}): amount_paid ${money(row.amount_paid)} ` +
        `with no confirmed payments — left alone, review it by hand`);
    }

    if (apply) {
      await connection.commit();
      console.log(`Repaired ${repairable.length} invoice(s).`);
    } else {
      await connection.rollback();
      console.log(repairable.length ? 'Dry run only. Re-run with --apply to make these changes.' : 'Nothing to change.');
    }
  } catch (error) {
    await connection.rollback();
    console.error('Repair failed, nothing was changed:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
})();
