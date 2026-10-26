/**
 * Gives every confirmed payment that has no RCP- receipt number one, in payment order.
 *
 * Until utils/paymentIds.js `assignMissingReceiptIds` ran from resyncInvoiceSettlement, only
 * Razorpay payments and POST /payments drew a receipt number; cash, cheque and bank payments that
 * were recorded, verified or edited to paid never got one. Numbers continue each partner's own
 * receipt_sequence (the same generateReceiptId the live writers use), oldest payment first.
 *
 *   node scripts/backfill-receipt-ids.js          # dry run: lists the payments that would be numbered
 *   node scripts/backfill-receipt-ids.js --apply  # assigns the numbers
 *
 * Uses the same database settings as the server (config/database.js), so on the VPS it runs
 * against production when NODE_ENV=production. Take a backup first. Safe to re-run: a payment
 * that already has a receipt number is never touched.
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { ensurePaymentColumns } = require('../utils/paymentColumns');
const { generateReceiptId, CONFIRMED_STATUSES } = require('../utils/paymentIds');

const apply = process.argv.includes('--apply');

(async () => {
  try {
    await ensurePaymentColumns();
    const [rows] = await pool.query(`
      SELECT id, payment_id, franchise_partner_id, payment_method, amount, payment_date
      FROM payments
      WHERE status IN ${CONFIRMED_STATUSES} AND (receipt_id IS NULL OR receipt_id = '')
      ORDER BY payment_date, id
    `);

    console.log(`${rows.length} confirmed payment(s) without a receipt number${apply ? '' : ' (dry run)'}`);
    for (const row of rows) {
      const date = row.payment_date ? new Date(row.payment_date).toISOString().slice(0, 10) : '-';
      const label = `${row.payment_id || `#${row.id}`}  ${date}  ${row.payment_method}  ₹${Number(row.amount).toLocaleString('en-IN')}  fp=${row.franchise_partner_id ?? '-'}`;
      if (!apply) {
        console.log(`  would number ${label}`);
        continue;
      }
      const receiptId = await generateReceiptId(row.franchise_partner_id || null);
      await pool.execute(
        "UPDATE payments SET receipt_id = ? WHERE id = ? AND (receipt_id IS NULL OR receipt_id = '')",
        [receiptId, row.id]
      );
      console.log(`  ${receiptId}  ${label}`);
    }
    if (!apply && rows.length) console.log('Re-run with --apply to assign them.');
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
