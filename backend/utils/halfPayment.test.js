const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { halfPaymentPlan, resolvePaymentPortion, halfPaymentNote } = require('./halfPayment');

test('a full payment is the balance, and only the exact string half halves it', () => {
  assert.deepEqual(resolvePaymentPortion(undefined, 1000), { amount: 1000, plan: null });
  assert.deepEqual(resolvePaymentPortion('full', 1000), { amount: 1000, plan: null });
  // Anything that is not 'half' is the whole balance -- a number, a percentage, a stray amount
  for (const portion of [500, '500', 0.5, '50%', 'HALF', null, {}, ['half']]) {
    assert.deepEqual(resolvePaymentPortion(portion, 1000), { amount: 1000, plan: null }, JSON.stringify(portion));
  }
  const half = resolvePaymentPortion('half', 1000);
  assert.equal(half.amount, 500);
  assert.equal(half.plan.secondAmount, 500);
});

test('a balance that cannot be halved is refused, not quietly charged in full', () => {
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

test('no payment route reads an amount out of the request body', () => {
  // The whole point of resolvePaymentPortion: the customer's payment page has no login, so an
  // amount it could post is an amount an attacker could post. These routes take a portion only.
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'razorpay.js'), 'utf8');
  const bodies = source.match(/const \{[^}]*\} = req\.body;/g) || [];
  assert.ok(bodies.length >= 3);
  for (const body of bodies) {
    assert.ok(!/\bamount\b/.test(body), `a route destructures an amount from the body: ${body}`);
  }
  // And every charge is resolved through the helper
  assert.ok(source.split('resolvePaymentPortion(').length - 1 >= 2);
});
