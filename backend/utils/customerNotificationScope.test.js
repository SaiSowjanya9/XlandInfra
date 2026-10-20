/**
 * A customer's notifications are their own.
 *
 * The broad branch of this filter — "anything addressed to the customer role by the partner that
 * owns this property" — matches **every** customer of that franchise partner, which is fine for a
 * partner-wide announcement and completely wrong for a complaint about one household. A complaint
 * notification is therefore matched on the account that raised it and excluded from that branch,
 * and this test is what keeps those two halves together: drop the exclusion and every resident of
 * the partner reads their neighbour's complaint.
 *
 * Run: node --test backend/utils/customerNotificationScope.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { customerNotificationScope } = require('./customerNotificationScope');

const customer = { id: 55, propertyId: 12, propertyCode: 'GC-1' };

test('a complaint is scoped to the account that raised it, never to the partner', () => {
  const { sql } = customerNotificationScope(customer);
  // Matched by its own account...
  assert.match(sql, /pn\.reference_type = 'complaint' AND pn\.user_id = \?/);
  // ...and kept out of the partner-wide branch, which is where the leak would be.
  assert.match(sql, /\(pn\.reference_type IS NULL OR pn\.reference_type <> 'complaint'\)/);
  // That exclusion belongs to the partner-wide branch and nothing else: it sits before the first
  // OR, so a complaint can only ever arrive through its own account.
  assert.ok(
    sql.indexOf("pn.reference_type <> 'complaint'") < sql.indexOf('OR (pn.role_type'),
    'the exclusion guards the partner-wide branch'
  );
});

test('the work order branch is untouched, and the property is still what scopes it', () => {
  const { sql } = customerNotificationScope(customer);
  assert.match(sql, /pn\.reference_type = 'work_order' AND EXISTS/);
  assert.match(sql, /wo\.id = pn\.reference_id AND wo\.property_id = \?/);
  // Nothing reaches a customer that was not addressed to the customer role in the first place.
  assert.equal(sql.match(/pn\.role_type = 'customer'/g).length, 3);
});

test('nothing joins onboarded_properties, because a join would duplicate the row', () => {
  // These reads used to LEFT JOIN onboarded_properties on the partner and test `op.id = ?`, which
  // matches one row per property that partner owns -- so any notification the property condition
  // did not narrow came back once per property. A customer with one unread update saw it a dozen
  // times, and the badge counted them all. A semi-join cannot multiply rows.
  const { sql } = customerNotificationScope(customer);
  assert.doesNotMatch(sql, /JOIN/);
  assert.match(sql, /EXISTS \(\s*SELECT 1 FROM onboarded_properties op/);
  assert.equal(sql.match(/EXISTS/g).length, 2, 'the partner-wide and work order branches are both semi-joins');
});

test('the three placeholders are bound in the order the SQL reads them', () => {
  // property, property, account -- a transposition here would quietly hand one customer another's
  // notifications, since both of the first two are the same value.
  assert.deepEqual(customerNotificationScope(customer).params, [12, 12, 55]);
  // Never undefined: mysql2 refuses an undefined bind, which would fail the whole bell.
  assert.deepEqual(customerNotificationScope({}).params, [null, null, null]);
  assert.deepEqual(customerNotificationScope().params, [null, null, null]);
});

test('every read uses the same fragment', () => {
  // The list, its unread count and both mark-read routes share one string: a row a customer can see
  // but not dismiss sticks in their bell for ever.
  const first = customerNotificationScope(customer).sql;
  const second = customerNotificationScope({ id: 1, propertyId: 2 }).sql;
  assert.equal(first, second, 'the SQL is constant; only the bound values differ');
});
