/**
 * Replays Razorpay webhooks that were received but never processed.
 *
 * Every delivery is stored with its full payload before anything is attempted, so an event that
 * failed is not lost -- it just never produced a payment. That is what happened while
 * payment_history.action was still an ENUM: the insert was rejected, the transaction rolled back,
 * and the webhook answered 500. Once the column is widened the same payloads succeed, but Razorpay
 * only retries for a limited window, so anything older has to be replayed from here.
 *
 * Replaying is safe to repeat: recordRazorpayPayment is keyed on razorpay_payment_id, so an event
 * whose payment is already recorded is a no-op rather than a second charge.
 *
 *   node scripts/replayRazorpayWebhooks.js            # report what would be replayed
 *   node scripts/replayRazorpayWebhooks.js --apply    # replay them
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

const apply = process.argv.includes('--apply');

const main = async () => {
  const [rows] = await pool.execute(
    `SELECT id, event_id, event_type, payload, received_at
       FROM razorpay_webhooks
      WHERE status <> 'processed'
      ORDER BY id`
  );

  if (!rows.length) {
    console.log('Nothing to replay: every stored webhook is processed.');
    return;
  }

  console.log(`${rows.length} webhook(s) received but not processed:\n`);
  for (const row of rows) {
    console.log(`  #${row.id}  ${row.event_type.padEnd(28)} ${new Date(row.received_at).toISOString()}`);
  }

  if (!apply) {
    console.log('\nRe-run with --apply to replay them.');
    return;
  }

  // Required late: routes/razorpay.js reads the Razorpay keys when it loads
  const razorpayRouter = require('../routes/razorpay');
  console.log('\nReplaying...\n');
  let recorded = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    try {
      await razorpayRouter.dispatchWebhookEvent(payload.event, payload, row.id);
      await pool.execute('UPDATE razorpay_webhooks SET status = ?, processed_at = NOW(), error_message = NULL WHERE id = ?', ['processed', row.id]);
      console.log(`  #${row.id} ${row.event_type}: processed`);
      recorded += 1;
    } catch (error) {
      // Left unprocessed on purpose, so a later run picks it up once the cause is fixed
      await pool.execute('UPDATE razorpay_webhooks SET error_message = ? WHERE id = ?', [String(error.message).slice(0, 2000), row.id]);
      console.error(`  #${row.id} ${row.event_type}: FAILED - ${error.message}`);
      failed += 1;
    }
  }

  console.log(`\n${recorded} processed, ${failed} still failing.`);
  const [[{ total }]] = await pool.execute("SELECT COUNT(*) AS total FROM payments WHERE payment_method = 'razorpay'");
  console.log(`payments recorded against Razorpay: ${total}`);
};

main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
