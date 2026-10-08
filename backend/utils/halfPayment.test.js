const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { halfPaymentPlan, splitPaymentPlan, resolvePaymentPortion, halfPaymentNote } = require('./halfPayment');

test('a full payment is the balance; only recognised portions split it', () => {
  assert.deepEqual(resolvePaymentPortion(undefined, 1000), { amount: 1000, plan: null });
  assert.deepEqual(resolvePaymentPortion('full', 1000), { amount: 1000, plan: null });
  assert.deepEqual(resolvePaymentPortion('100', 1000), { amount: 1000, plan: null });
  // Anything unrecognised is the whole balance -- a number, a stray amount, a wrong string
  for (const portion of [500, '500', 0.5, '50%', 'HALF', null, {}, ['half']]) {
    assert.deepEqual(resolvePaymentPortion(portion, 1000), { amount: 1000, plan: null }, JSON.stringify(portion));
  }
});

test('the offered shares resolve against the balance, never a posted figure', () => {
  for (const [portion, share] of [['half', 0.5], ['50', 0.5], ['25', 0.25], ['75', 0.75]]) {
    const { amount, plan } = resolvePaymentPortion(portion, 1000);
    assert.equal(amount, 1000 * share, portion);
    assert.equal(Math.round((plan.firstAmount + plan.secondAmount) * 100) / 100, 1000, portion);
  }
  const half = resolvePaymentPortion('half', 1000);
  assert.equal(half.amount, 500);
  assert.equal(half.plan.secondAmount, 500);
});

test('a custom amount is charged only after it is validated against the balance', () => {
  // Valid: inside the balance, leaving at least ₹1 unpaid
  const part = resolvePaymentPortion('custom', 1000, 300);
  assert.equal(part.amount, 300);
  assert.equal(part.plan.secondAmount, 700);
  // Meeting or exceeding the balance is a full payment, not an error
  assert.deepEqual(resolvePaymentPortion('custom', 1000, 1000), { amount: 1000, plan: null });
  assert.deepEqual(resolvePaymentPortion('custom', 1000, 5000), { amount: 1000, plan: null });
  // Refused: nothing, too little, not a number, or a remainder under ₹1
  for (const [custom, balance] of [[0, 1000], [-5, 1000], [undefined, 1000], ['abc', 1000], [999.50, 1000]]) {
    const result = resolvePaymentPortion('custom', balance, custom);
    assert.ok(result.error, `custom=${custom} balance=${balance}`);
    assert.equal(result.amount, undefined);
  }
});

test('a balance that cannot be split is refused, not quietly charged in full', () => {
  const result = resolvePaymentPortion('half', 1.5);
  assert.match(result.error, /too small/);
  assert.equal(result.amount, undefined);
});

test('the note states the remaining amount and when it is due', () => {
  const plan = halfPaymentPlan(20000, '2026-10-01');
  const note = halfPaymentNote(plan);
  assert.match(note, /10,000/);
  assert.match(note, /2027-03-02/);
  assert.match(note, /2027-04-01/);
  assert.equal(halfPaymentNote(null), '');
});

test('the split plan keeps the instalment and the remainder payable', () => {
  // Both sides must clear Razorpay's ₹1 floor
  assert.equal(splitPaymentPlan(1000, 0.5), null);
  assert.equal(splitPaymentPlan(1000, 999.5), null);
  assert.equal(splitPaymentPlan('abc', 100), null);
  const plan = splitPaymentPlan(1000.01, 500.01, '2026-10-01');
  assert.deepEqual({ firstAmount: plan.firstAmount, secondAmount: plan.secondAmount }, { firstAmount: 500.01, secondAmount: 500 });
  assert.equal(plan.secondDueDate, '2027-03-02');
});

test('the custom amount the public page may post is always validated server-side', () => {
  // The customer's payment page has no login, so whatever amount it can post is an amount an
  // attacker can post. 'custom' is allowed, but resolvePaymentPortion bounds it to the invoice's
  // own balance — a caller can only ever underpay, never name a bigger charge.
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'razorpay.js'), 'utf8');
  // Every charge still goes through the resolver
  assert.ok(source.split('resolvePaymentPortion(').length - 1 >= 2);
  // The logged-in customer portal's own charges take the same path — its order, offline intent
  // and (crucially) verify-payment must never trust a posted figure
  const customerRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'customers.js'), 'utf8');
  assert.ok(customerRoutes.split('resolvePaymentPortion(').length - 1 >= 2);
  assert.match(customerRoutes, /rzpPayment\.amount/);
  // And the resolver itself is what checks a custom figure, not the routes trusting it
  const resolver = fs.readFileSync(path.join(__dirname, 'halfPayment.js'), 'utf8');
  assert.match(resolver, /customAmount/);
  assert.match(resolver, /amount >= total/);
});
