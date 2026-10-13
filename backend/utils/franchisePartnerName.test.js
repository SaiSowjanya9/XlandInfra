/**
 * The partner name is read from two places -- the admin/manager marketing lists and the customer
 * portal's complaint form -- and both were written against a `franchise_partners` that has
 * `contact_person`. It does not exist on every deployment, and naming it fails the whole
 * statement: the admin list answered 500, and the customer's complaint form answered "Failed to
 * submit complaint" and stored nothing, so no complaint ever reached any portal.
 *
 * Run: node --test backend/utils/franchisePartnerName.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  partnerNameExpression, fetchPartnerName, availablePartnerNameColumns, resetPartnerNameCache,
  DEFAULT_PARTNER_NAME
} = require('./franchisePartnerName');

// A pool that knows which columns exist, and records what it was asked.
const poolWith = (columns, row = undefined, { failSchema = false, failSelect = false } = {}) => {
  const calls = [];
  return {
    calls,
    execute: async (sql, params = []) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (sql.includes('information_schema.columns')) {
        if (failSchema) throw Object.assign(new Error('no access'), { code: 'ER_DBACCESS_DENIED_ERROR' });
        return [columns.map((name) => ({ column_name: name }))];
      }
      if (failSelect) throw Object.assign(new Error("Unknown column 'x'"), { code: 'ER_BAD_FIELD_ERROR' });
      return [row === undefined ? [] : [row]];
    }
  };
};

test('only the columns the database has are ever named', async () => {
  resetPartnerNameCache();
  // The real schema: company_name and owner_name, no contact_person.
  const pool = poolWith(['company_name', 'owner_name']);
  const expression = await partnerNameExpression(pool, 'fpx');
  assert.equal(expression, 'COALESCE(fpx.company_name, fpx.owner_name)');
  assert.doesNotMatch(expression, /contact_person/);
});

test('a deployment that does have contact_person uses it as the last resort', async () => {
  resetPartnerNameCache();
  const pool = poolWith(['company_name', 'owner_name', 'contact_person']);
  assert.equal(
    await partnerNameExpression(pool, 'fp'),
    'COALESCE(fp.company_name, fp.owner_name, fp.contact_person)'
  );
});

test('one surviving column needs no COALESCE', async () => {
  resetPartnerNameCache();
  const pool = poolWith(['company_name']);
  assert.equal(await partnerNameExpression(pool, 'fp'), 'fp.company_name');
});

test('an unreadable schema falls back to the one column this table has always had', async () => {
  resetPartnerNameCache();
  // Answering with nothing would turn a drifted column into a missing name everywhere.
  const pool = poolWith([], undefined, { failSchema: true });
  assert.equal(await partnerNameExpression(pool, 'fp'), 'fp.company_name');
  resetPartnerNameCache();
  assert.deepEqual(await availablePartnerNameColumns(poolWith([], undefined, { failSchema: true })), ['company_name']);
});

test('the column list is resolved once, not on every query', async () => {
  resetPartnerNameCache();
  const pool = poolWith(['company_name', 'owner_name']);
  await partnerNameExpression(pool, 'fp');
  await partnerNameExpression(pool, 'fp');
  await partnerNameExpression(pool, 'fp');
  assert.equal(pool.calls.filter((c) => c.sql.includes('information_schema')).length, 1);
});

test('fetchPartnerName reads the name in preference order and skips blanks', async () => {
  resetPartnerNameCache();
  let pool = poolWith(['company_name', 'owner_name'], { company_name: 'Sample Franchise Co', owner_name: 'Asha' });
  assert.equal(await fetchPartnerName(pool, 1), 'Sample Franchise Co');

  // An empty column is not a name, so the next one answers.
  resetPartnerNameCache();
  pool = poolWith(['company_name', 'owner_name'], { company_name: '   ', owner_name: 'Asha' });
  assert.equal(await fetchPartnerName(pool, 1), 'Asha');

  // And the SELECT must not name a column that is missing.
  const select = pool.calls.find((c) => c.sql.startsWith('SELECT company_name'));
  assert.doesNotMatch(select.sql, /contact_person/);
});

test('fetchPartnerName never throws -- it is filling a field on a record being saved', async () => {
  // This is the whole point: the complaint form used to fail the save because this lookup threw.
  resetPartnerNameCache();
  assert.equal(await fetchPartnerName(poolWith(['company_name'], undefined, { failSelect: true }), 1), DEFAULT_PARTNER_NAME);
  resetPartnerNameCache();
  assert.equal(await fetchPartnerName(poolWith(['company_name'], undefined), 1), DEFAULT_PARTNER_NAME, 'no such partner');
  resetPartnerNameCache();
  assert.equal(await fetchPartnerName(poolWith(['company_name'], { company_name: null }), 1), DEFAULT_PARTNER_NAME, 'all blank');
  resetPartnerNameCache();
  assert.equal(await fetchPartnerName(poolWith(['company_name']), null), DEFAULT_PARTNER_NAME, 'no partner id');
});
