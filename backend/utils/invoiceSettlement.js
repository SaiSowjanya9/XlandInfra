const { pool } = require('../config/database');
const { paidAtAssignment } = require('./invoiceColumns');
const { ensureRefundTable, settledRefundTotal } = require('./refundLedger');

/**
 * One invoice's settlement fields, recomputed from the payments table -- the payments rows
 * are the truth and invoices.amount_paid/balance_amount/payment_status/status/paid_at are a
 * cache of them. Settled money is payments-minus-refunds: a partial refund leaves its payment
 * settled for the remainder only, which is what the payment_refunds ledger (schema_v55)
 * carries and what this subtracts. Four writers used to recompute this by hand and each
 * diverged a different way (the verify route once double-counted a payment it had just
 * marked; the refund path left a refunded row counted; a payment edit never resynced at all).
 *
 * `conn` is the transaction the caller is already inside; payments and invoice must commit
 * or roll back together. paid_at resolves before the UPDATE because its column check may
 * run DDL, and DDL commits implicitly -- it must not run inside the caller's transaction,
 * so callers invoke this after their DDL-ensuring step, and paidAtAssignment's own check
 * still runs on `pool`, outside `conn`.
 */
const resyncInvoiceSettlement = async (invoiceId, conn = pool) => {
  const [[totals]] = await conn.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments
     WHERE invoice_id = ? AND status IN ('paid', 'completed')`,
    [invoiceId]
  );
  const [[invoice]] = await conn.execute(
    'SELECT total_amount, status FROM invoices WHERE id = ?',
    [invoiceId]
  );
  if (!invoice) return null;

  // Processed refunds come back out of the settled total; on a schema that predates the
  // ledger (ensure failed) the refund is absent from the math rather than the resync failing
  const refunded = (await ensureRefundTable()) ? await settledRefundTotal(invoiceId, conn) : 0;
  const totalPaid = Math.max(0, (parseFloat(totals.total_paid) || 0) - refunded);
  const totalAmount = parseFloat(invoice.total_amount) || 0;
  const balanceAmount = Math.max(0, totalAmount - totalPaid);
  const paymentStatus =
    balanceAmount <= 0 && totalAmount > 0 ? 'paid'
    : totalPaid > 0 ? 'partially_paid'
    : 'pending';

  const paidAt = await paidAtAssignment(paymentStatus);
  await conn.execute(
    `UPDATE invoices SET
       amount_paid = ?,
       balance_amount = ?,
       payment_status = ?,
       status = CASE
         WHEN ? = 'paid' THEN 'paid'
         WHEN ? = 'partially_paid' THEN 'partially_paid'
         WHEN status IN ('paid', 'partially_paid') THEN 'sent'
         ELSE status
       END,
       ${paidAt.sql}
     WHERE id = ?`,
    [totalPaid, balanceAmount, paymentStatus, paymentStatus, paymentStatus, ...paidAt.params, invoiceId]
  );

  return { totalPaid, balanceAmount, paymentStatus };
};

module.exports = { resyncInvoiceSettlement };
