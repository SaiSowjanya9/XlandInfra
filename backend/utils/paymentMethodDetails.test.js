const { test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * A Razorpay payment must survive a payment_history.payment_method_details column narrower than
 * its audit blob. The history row is written inside the payment's own transaction, so
 * "Data too long for column 'payment_method_details'" rolled the payment back.
 */

const DETAILS = {
  method: 'card', card_last4: '1111', card_network: 'Visa', bank: null, wallet: null,
  email: 'customer@example.com', contact: '+919999999999', invoice_id: 'INV-00018',
  invoice_amount: 387384, amount_paid: 387384, balance_remaining: 0,
  payment_date: '2026-10-26T04:13:00.000Z', razorpay_payment_link_id: 'plink_TsZayE9I1xu7WR', recorded_by: 'callback'
};

const loadWithColumn = ({ dataType, maxLength = null, allowAlter = true }) => {
  const calls = [];
  const pool = {
    execute: async (sql) => {
      calls.push(sql);
      if (sql.includes('information_schema')) return [dataType ? [{ dataType, maxLength }] : []];
      if (sql.includes('ALTER TABLE payment_history')) {
        if (!allowAlter) throw new Error('ALTER command denied to user');
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  delete require.cache[require.resolve('../config/database')];
  delete require.cache[require.resolve('./paymentMethodDetails')];
  require.cache[require.resolve('../config/database')] = { exports: { pool } };
  const module = require('./paymentMethodDetails');
  module.resetPaymentMethodDetailsCache();
  return { ...module, calls };
};

test('a JSON column takes the details as they are, and is asked about only once', async () => {
  const { paymentMethodDetailsValue, calls } = loadWithColumn({ dataType: 'json' });
  assert.equal(await paymentMethodDetailsValue(DETAILS), JSON.stringify(DETAILS));
  await paymentMethodDetailsValue(DETAILS);
  assert.equal(calls.filter(sql => sql.includes('information_schema')).length, 1);
  assert.equal(calls.filter(sql => sql.includes('ALTER')).length, 0);
});

test('a short VARCHAR is widened to TEXT and then takes the full details', async () => {
  const { paymentMethodDetailsValue, calls } = loadWithColumn({ dataType: 'varchar', maxLength: 100 });
  assert.equal(await paymentMethodDetailsValue(DETAILS), JSON.stringify(DETAILS));
  assert.equal(calls.filter(sql => sql.includes('MODIFY COLUMN payment_method_details TEXT')).length, 1);
});

test('where it cannot be widened, a value that fits (or NULL) is written instead of losing the payment', async () => {
  const width = JSON.stringify(DETAILS).length - 1;
  const roomy = loadWithColumn({ dataType: 'varchar', maxLength: width, allowAlter: false });
  const compact = await roomy.paymentMethodDetailsValue(DETAILS);
  assert.ok(compact.length <= width);
  assert.equal(JSON.parse(compact).bank, undefined);
  assert.equal(JSON.parse(compact).invoice_id, 'INV-00018');

  const tiny = loadWithColumn({ dataType: 'varchar', maxLength: 50, allowAlter: false });
  assert.equal(await tiny.paymentMethodDetailsValue(DETAILS), null);
});

test('recordRazorpayPayment resolves the details before opening its transaction', () => {
  const source = require('node:fs').readFileSync(require.resolve('../services/razorpayPayment'), 'utf8');
  const resolved = source.indexOf('await paymentMethodDetailsValue(');
  assert.ok(resolved > 0, 'razorpayPayment must fit payment_method_details through paymentMethodDetailsValue');
  assert.ok(resolved < source.indexOf('beginTransaction'), 'the ALTER must run before beginTransaction');
  assert.doesNotMatch(source, /payment_method_details[\s\S]*JSON\.stringify\(\{\s*method:/);
});
