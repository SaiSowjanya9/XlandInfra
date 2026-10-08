import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { formatPlanDate, halfPaymentPlan, splitPaymentPlan } from './halfPayment.js';

const require = createRequire(import.meta.url);
const server = require('../../../backend/utils/halfPayment.js');

test('the two halves add back up to the balance, to the paisa', () => {
  for (const balance of [2, 1000, 1000.01, 999.99, 20000, 3333.33, 0.5, 7, 1e7 + 0.07]) {
    const plan = halfPaymentPlan(balance, '2026-10-01');
    if (!plan) continue;
    assert.equal(Math.round((plan.firstAmount + plan.secondAmount) * 100) / 100, Math.round(balance * 100) / 100, String(balance));
  }
  assert.deepEqual(
    (({ firstAmount, secondAmount }) => ({ firstAmount, secondAmount }))(halfPaymentPlan(1000.01, '2026-10-01')),
    { firstAmount: 500.01, secondAmount: 500 }
  );
});

test('a balance too small to halve has no plan, so the option is never offered', () => {
  // Razorpay refuses anything under ₹1, so ₹1.50 cannot be split into two payable halves
  for (const balance of [0, -500, 1, 1.5, null, undefined, 'abc']) {
    assert.equal(halfPaymentPlan(balance, '2026-10-01'), null, String(balance));
  }
  assert.ok(halfPaymentPlan(2, '2026-10-01'));
});

test('the second half is due 30 days before the next six-month period starts', () => {
  const plan = halfPaymentPlan(1000, '2026-10-01');
  assert.equal(plan.nextPeriodStart, '2027-04-01');
  assert.equal(plan.secondDueDate, '2027-03-02');
  // Month ends do not roll over into the following month: 31 Aug + 6 months is 28 Feb, not 3 March
  assert.equal(halfPaymentPlan(1000, '2026-08-31').nextPeriodStart, '2027-02-28');
  assert.equal(halfPaymentPlan(1000, '2027-08-31').nextPeriodStart, '2028-02-29');
});

test('a date is never read in the browser timezone and shifted a day', () => {
  assert.equal(formatPlanDate('2027-03-02'), '02 Mar 2027');
  assert.equal(formatPlanDate(null), '—');
  assert.equal(formatPlanDate('not a date'), '—');
});

test('the screens compute exactly what the server charges', () => {
  // The server owns every amount it is asked for; these must not drift apart
  for (const balance of [2, 7, 1000, 1000.01, 20000, 3333.33, 123456.78]) {
    for (const from of ['2026-01-31', '2026-08-31', '2026-10-01', '2027-02-28', '2027-12-15']) {
      assert.deepEqual(halfPaymentPlan(balance, from), server.halfPaymentPlan(balance, from), `${balance} @ ${from}`);
      for (const share of [0.25, 0.5, 0.75]) {
        assert.deepEqual(
          splitPaymentPlan(balance, balance * share, from),
          server.splitPaymentPlan(balance, balance * share, from),
          `${balance} @ ${share} @ ${from}`
        );
      }
    }
  }
  assert.equal(server.SERVICE_PERIOD_MONTHS, 6);
  assert.equal(server.SECOND_HALF_LEAD_DAYS, 30);
  assert.equal(server.MIN_INSTALMENT, 1);
});
