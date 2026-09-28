const { test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * A Razorpay payment must survive a database that never had schema_v27 applied. Its history row is
 * written inside the payment's own transaction, so an action value the column cannot hold used to
 * roll the payment back: the customer paid and nothing was recorded.
 */

const ENUM_TYPE = "enum('created','updated','status_changed','refunded','deleted')";

const loadWithColumn = ({ type, allowAlter = true }) => {
  const calls = [];
  const pool = {
    execute: async (sql) => {
      calls.push(sql.trim().split('\n')[0].trim());
      if (sql.includes('information_schema')) return [type ? [{ type }] : []];
      if (sql.includes('ALTER TABLE payment_history')) {
        if (!allowAlter) throw new Error('ALTER command denied to user');
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  delete require.cache[require.resolve('../config/database')];
  delete require.cache[require.resolve('./paymentHistoryAction')];
  require.cache[require.resolve('../config/database')] = { exports: { pool } };
  const module = require('./paymentHistoryAction');
  module.resetPaymentHistoryActionCache();
  return { ...module, calls };
};

test('a widened column takes the action as it is, and is asked about only once', async () => {
  const { paymentHistoryAction, calls } = loadWithColumn({ type: 'varchar(50)' });
  assert.equal(await paymentHistoryAction('razorpay_payment'), 'razorpay_payment');
  assert.equal(await paymentHistoryAction('failed'), 'failed');
  assert.equal(await paymentHistoryAction('refund'), 'refund');
  // One information_schema read for all three, and no ALTER: the column is already right
  assert.equal(calls.filter(sql => sql.includes('SELECT COLUMN_TYPE')).length, 1);
  assert.equal(calls.filter(sql => sql.includes('ALTER')).length, 0);
});

test('a column still on the old ENUM is widened, as the migration would', async () => {
  const { paymentHistoryAction, calls } = loadWithColumn({ type: ENUM_TYPE });
  assert.equal(await paymentHistoryAction('razorpay_payment'), 'razorpay_payment');
  assert.equal(calls.filter(sql => sql.includes('ALTER TABLE payment_history')).length, 1);
});

test('where it cannot be widened, the nearest legal value is written instead of losing the payment', async () => {
  const { paymentHistoryAction } = loadWithColumn({ type: ENUM_TYPE, allowAlter: false });
  // Each of the three values the ENUM never had, mapped to a member it does have
  assert.equal(await paymentHistoryAction('razorpay_payment'), 'status_changed');
  assert.equal(await paymentHistoryAction('failed'), 'status_changed');
  assert.equal(await paymentHistoryAction('refund'), 'refunded');
  // A value the ENUM always had is untouched either way
  assert.equal(await paymentHistoryAction('created'), 'created');
  assert.equal(await paymentHistoryAction(undefined), 'created');
});

test('an unreadable column falls back rather than risking the write', async () => {
  const { paymentHistoryAction } = loadWithColumn({ type: null });
  // No such column reported: nothing to correct for, so the value goes in as it is
  assert.equal(await paymentHistoryAction('razorpay_payment'), 'razorpay_payment');
});
