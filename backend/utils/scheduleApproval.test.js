/**
 * Visits are the one thing a customer sees the instant staff write it, so the rule that lets them be
 * written is worth pinning: approved **and** paid, the same two conditions the queue that lists
 * schedulable properties applies.
 *
 * Run: node --test backend/utils/scheduleApproval.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveScheduleGate, propertyScheduleGate, SCHEDULABLE_PAYMENT_STATUSES
} = require('./scheduleApproval');

const estimate = (overrides = {}) => ({
  id: 7, code: 'EST-1790615705772230', status: 'approved', payment_status: 'paid', ...overrides
});

test('approved and paid is what opens the gate, and it names the estimate that did', () => {
  const gate = resolveScheduleGate([estimate()]);
  assert.equal(gate.allowed, true);
  assert.equal(gate.estimateId, 7, 'the authorising estimate is handed back to be stamped on the schedule');
  assert.equal(gate.reason, null);

  // A part payment counts: the AMC policy bills in halves, so waiting for the whole balance would
  // stop every half-paid property from ever being scheduled.
  assert.equal(resolveScheduleGate([estimate({ payment_status: 'partial' })]).allowed, true);
  assert.deepEqual([...SCHEDULABLE_PAYMENT_STATUSES].sort(), ['paid', 'partial']);
});

test('an unapproved estimate refuses, whatever stage it is at', () => {
  for (const status of ['draft', 'sent', 'rejected']) {
    const gate = resolveScheduleGate([estimate({ status, payment_status: 'pending' })]);
    assert.equal(gate.allowed, false, status);
    assert.equal(gate.estimateId, null, status);
    assert.match(gate.reason, /has not been approved yet/, status);
    // The message names the state, because "not allowed" alone does not tell staff what to do
    assert.match(gate.reason, new RegExp(status, 'i'), status);
  }
});

test('approved but unpaid is its own refusal, not the unapproved one', () => {
  // Different problem, different person's job: one waits on the customer, one on a payment being
  // recorded. A shared message would send staff to the wrong screen.
  const gate = resolveScheduleGate([estimate({ payment_status: 'pending' })]);
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /approved but no payment/);
  assert.doesNotMatch(gate.reason, /has not been approved/);
});

test('a property with no estimate at all is allowed through', () => {
  // Older and directly-onboarded properties have none. The gate stops scheduling *ahead of* an
  // estimate; it does not require that one exists, or it would take away scheduling that works.
  for (const nothing of [[], undefined, null]) {
    const gate = resolveScheduleGate(nothing);
    assert.equal(gate.allowed, true);
    assert.equal(gate.estimateId, null);
  }
});

test('one approved and paid estimate is enough, among several', () => {
  // A property is re-estimated: the rejected and draft rows must not veto the approved one.
  const gate = resolveScheduleGate([
    estimate({ id: 9, status: 'draft', payment_status: 'pending' }),
    estimate({ id: 8, status: 'rejected', payment_status: 'pending' }),
    estimate({ id: 5, status: 'approved', payment_status: 'paid' })
  ]);
  assert.equal(gate.allowed, true);
  assert.equal(gate.estimateId, 5);
});

test('status and payment status are read case-insensitively', () => {
  // Five screens write these, and they do not agree on case: 'Approved' and 'approved' both occur.
  assert.equal(resolveScheduleGate([estimate({ status: 'Approved', payment_status: 'PAID' })]).allowed, true);
  assert.equal(resolveScheduleGate([estimate({ status: ' Draft ', payment_status: 'pending' })]).allowed, false);
});

test('the lookup matches the property code as well as the id', async () => {
  // An estimate stores the numeric property id, but the gate must not fail *open* because a row
  // carried the code instead -- that single omission would make the whole guard pointless.
  const calls = [];
  const pool = {
    execute: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return [[estimate()]];
    }
  };

  const gate = await propertyScheduleGate(pool, { id: 8, code: 'APT-1F2P-20260511' });
  assert.equal(gate.allowed, true);
  assert.match(calls[0].sql, /FROM fp_estimates/);
  assert.match(calls[0].sql, /property_id = \? OR \(\? <> '' AND property_code = \?\)/);
  assert.deepEqual(calls[0].params, [8, 'APT-1F2P-20260511', 'APT-1F2P-20260511']);
  // Newest first, so the estimate stamped onto the schedule is the current one
  assert.match(calls[0].sql, /ORDER BY id DESC/);
});

test('no property is a refusal, never an allow', async () => {
  const pool = { execute: async () => { throw new Error('must not query'); } };
  for (const property of [undefined, {}, { id: 0, code: '' }]) {
    const gate = await propertyScheduleGate(pool, property);
    assert.equal(gate.allowed, false);
    assert.match(gate.reason, /property is required/);
  }
});
