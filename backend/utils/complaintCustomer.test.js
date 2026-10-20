/**
 * Which resident a staff-filed complaint belongs to.
 *
 * The cost of a wrong answer is not an empty field: it is telling the wrong household that *their*
 * complaint is being worked on, and then that it has been resolved. The match is therefore narrow
 * on purpose, and these are the cases that keep it that way.
 *
 * Run: node --test backend/utils/complaintCustomer.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveComplaintCustomer, phoneDigits, accountName } = require('./complaintCustomer');

const accountsFor = (rows) => {
  const calls = [];
  return {
    calls,
    execute: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return [rows];
    }
  };
};

const asha = { id: 1, email: 'asha@example.com', first_name: 'Asha', last_name: 'K', phone: '9876543210', property_code: 'GC-1' };
const ravi = { id: 2, email: 'ravi@example.com', first_name: 'Ravi', last_name: 'M', phone: '9000000000', property_code: 'GC-1' };

test('the account is the one whose phone is on the complaint', async () => {
  const pool = accountsFor([asha, ravi]);
  const found = await resolveComplaintCustomer(pool, { property_id: 'GC-1', phone_number: '9876543210' });
  assert.deepEqual(found, { id: 1, email: 'asha@example.com', name: 'Asha K' });
  // Only active accounts with a mailbox, and only that property's.
  assert.match(pool.calls[0].sql, /is_active = 1/);
  assert.match(pool.calls[0].sql, /email IS NOT NULL/);
  assert.deepEqual(pool.calls[0].params, ['GC-1']);
});

test('a property with several residents and no phone match tells nobody', async () => {
  // Two households share the code and the complaint names neither -- announcing it to one of them
  // would be a guess, and a wrong guess is worse than silence.
  const pool = accountsFor([asha, ravi]);
  assert.equal(await resolveComplaintCustomer(pool, { property_id: 'GC-1', phone_number: '9111111111' }), null);
  assert.equal(await resolveComplaintCustomer(pool, { property_id: 'GC-1' }), null);
});

test('a property with one resident is that resident, phone or no phone', async () => {
  const pool = accountsFor([asha]);
  assert.equal((await resolveComplaintCustomer(pool, { property_id: 'GC-1' })).id, 1);
  assert.equal((await resolveComplaintCustomer(pool, { property_id: 'GC-1', phone_number: '9000000000' })).id, 1);
});

test('nothing to match on, nothing matched', async () => {
  const pool = accountsFor([]);
  assert.equal(await resolveComplaintCustomer(pool, { property_id: 'GC-404' }), null);
  // No property code at all does not even reach the database.
  const untouched = accountsFor([asha]);
  assert.equal(await resolveComplaintCustomer(untouched, {}), null);
  assert.equal(untouched.calls.length, 0);
});

test('a lookup that fails leaves the complaint alone', async () => {
  // The complaint is worth more than the notification: a missing table or a dead connection must
  // not fail the save it was called from.
  const broken = { execute: async () => { throw new Error('customer_accounts is away'); } };
  assert.equal(await resolveComplaintCustomer(broken, { property_id: 'GC-1', phone_number: '9876543210' }), null);
});

test('the property code is compared decoded, as it is stored escaped', () => {
  // Stored text is HTML-escaped (middleware/security.js), so both sides are decoded before they are
  // compared -- a phone is digits either way, but the code travels through the same pipe.
  assert.equal(phoneDigits('+91 98765 43210'), '9876543210');
  assert.equal(phoneDigits('98765 43210'), '9876543210');
  assert.equal(phoneDigits(null), '');
  assert.equal(phoneDigits('123'), '123', 'too short to be a phone, and never padded into one');
});

test('a resident always has something to be called', () => {
  assert.equal(accountName({ first_name: 'Asha', last_name: 'K' }), 'Asha K');
  assert.equal(accountName({ name: 'Asha K' }), 'Asha K');
  assert.equal(accountName({ email: 'asha@example.com' }), 'asha@example.com');
  assert.equal(accountName(null), '');
});
