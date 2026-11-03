const { test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Which work orders are a customer's own.
 *
 * `customerWorkOrderScope` is the whole of the customer portal's isolation for work orders: four
 * grounds OR'd together, feeding the dashboard, the activity feed and the work-orders list.
 *
 * Account #52 on production (KKR Buildings `GC-1793673531543`, created 3 Nov 2026) was shown
 * WO-1783455968280 and WO-1783045326823 — two customer-raised work orders from July and October,
 * against the properties "PP" and "sdfsdfs". `scripts/diagnose-customer-work-orders.js` reported
 * `matched on: 4:email` for both: `work_orders.customer_email` is a snapshot of who to call, not a
 * link to an account, and the address had been freed by permanently deleting its previous
 * customer, so the new account inherited the old one's history.
 *
 * The rule that fixes it, asserted below: a **property** ground carries no date limit, because a
 * place keeps its history; an **identity** ground (`customer_email`, `resident_id`) is confined to
 * the account's own lifetime, because both identifiers can be reused.
 */

const sqlOf = scope => scope.sql.replace(/\s+/g, ' ');

const loadScope = ({ hasPropertyCode = true } = {}) => {
  const pool = {
    execute: async (sql) => {
      if (sql.includes('information_schema')) {
        return [hasPropertyCode ? [{ COLUMN_NAME: 'property_code' }] : []];
      }
      return [[]];
    },
    query: async () => [[]]
  };
  for (const id of ['../config/database', './customers', '../utils/workOrderPropertyCode']) {
    delete require.cache[require.resolve(id)];
  }
  require.cache[require.resolve('../config/database')] = { exports: { pool, isDbConnected: false } };
  return require('./customers').customerWorkOrderScope;
};

const ACCOUNT = {
  numericPropertyId: 63,
  propertyCode: 'GC-1793673531543',
  customerId: 52,
  email: 'customer@example.com',
  accountCreatedAt: '2026-11-03 02:38:51'
};

test('an email ground is bounded by the account lifetime and by having no property', async () => {
  const scope = await loadScope();
  const sql = sqlOf(await scope(ACCOUNT));

  // The bare `LOWER(wo.customer_email) = LOWER(?)` this used to be is what inherited the previous
  // holder's work orders. It must now be qualified on both counts.
  assert.match(sql, /LOWER\(wo\.customer_email\) = LOWER\(\?\) AND \(wo\.property_id IS NULL/);
  assert.match(sql, /customer_email[\s\S]*?wo\.created_at >= \?/,
    'an email match must be confined to the account\'s own lifetime');
  assert.doesNotMatch(sql, /OR LOWER\(wo\.customer_email\) = LOWER\(\?\)\)/,
    'an unqualified email ground claims a reused address\'s whole history');
});

test('a resident_id ground is bounded too -- it began as a legacy residents.id', async () => {
  const scope = await loadScope();
  const sql = sqlOf(await scope(ACCOUNT));
  assert.match(sql, /\(wo\.resident_id = \? AND wo\.created_at >= \?\)/);
});

test('a property ground is NOT date-bounded -- a place keeps its history', async () => {
  const scope = await loadScope();
  const sql = sqlOf(await scope(ACCOUNT));
  const propertyPart = sql.slice(0, sql.indexOf('wo.resident_id'));
  assert.doesNotMatch(propertyPart, /created_at/,
    'a request raised against the property before the account existed is still the customer\'s');
  // The unambiguous ground, from schema_v62
  assert.match(sql, /wo\.property_code = \?/);
});

test('the parameters line up with the placeholders, in order', async () => {
  const scope = await loadScope();
  const built = await scope(ACCOUNT);
  assert.equal(
    (sqlOf(built).match(/\?/g) || []).length, built.params.length,
    'a placeholder/parameter mismatch silently shifts every condition'
  );
  assert.deepEqual(built.params, [
    63, 'GC-1793673531543',          // number, narrowed by the code
    'GC-1793673531543',              // the code in property_id
    'GC-1793673531543',              // the code in property_code
    52, '2026-11-03 02:38:51',       // resident_id, within the lifetime
    'customer@example.com', '2026-11-03 02:38:51'
  ]);
});

test('an account whose creation time is unknown keeps only its property grounds', async () => {
  // Trusting an identity with no bound is exactly the leak; dropping it loses at most an
  // orphaned work order, which no other ground could find either.
  const scope = await loadScope();
  const sql = sqlOf(await scope({ ...ACCOUNT, accountCreatedAt: null }));
  assert.doesNotMatch(sql, /customer_email/);
  assert.doesNotMatch(sql, /resident_id/);
  assert.match(sql, /wo\.property_id = \?/);
});

test('no identifier at all returns nothing, never everything', async () => {
  const scope = await loadScope();
  const built = await scope({});
  assert.equal(built.sql, '1=0');
  assert.deepEqual(built.params, []);
});

test('a deployment without property_code still scopes, naming no missing column', async () => {
  const scope = await loadScope({ hasPropertyCode: false });
  const sql = sqlOf(await scope(ACCOUNT));
  assert.doesNotMatch(sql, /property_code/,
    'naming a column the table does not have fails the statement and empties the dashboard');
  assert.match(sql, /wo\.property_id = \?/);
  assert.match(sql, /customer_email/);
});
