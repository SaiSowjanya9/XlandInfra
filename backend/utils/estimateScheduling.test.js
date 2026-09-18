const { test } = require('node:test');
const assert = require('node:assert/strict');

// The filter and the vendor writes both read the pool, so it is stubbed before the module loads
const queries = [];
let columnRows = [{ n: 1 }];
const pool = {
  execute: async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes('information_schema.columns')) return [columnRows];
    if (sql.includes('FROM onboarded_vendors WHERE id = ?')) return [params[0] === 99 ? [] : [{ id: params[0] }]];
    return [[]];
  }
};
require.cache[require.resolve('../config/database')] = { exports: { pool } };
const { normalizeAssignVendor, assignVendorFilter } = require('./estimateScheduling');

test('an unanswered toggle keeps the existing scheduling behaviour', () => {
  // Explicit answers
  for (const value of [true, 1, '1', 'true', 'yes']) assert.equal(normalizeAssignVendor(value), 1, String(value));
  for (const value of [false, 0, '0', 'false', 'no']) assert.equal(normalizeAssignVendor(value), 0, String(value));
  // Absent means "not answered", which must stay NULL so older estimates are not reinterpreted as No
  for (const value of [undefined, null, '']) assert.equal(normalizeAssignVendor(value), null, String(value));
});

test('the scheduling feeds exclude only an explicit No, and tolerate a missing column', async () => {
  const filter = await assignVendorFilter('fe');
  assert.match(filter, /fe\.assign_vendor IS NULL OR fe\.assign_vendor <> 0/);
  // The alias is honoured, since the feeds join the estimate under different names
  delete require.cache[require.resolve('./estimateScheduling')];
  assert.match(await require('./estimateScheduling').assignVendorFilter('est'), /est\.assign_vendor/);

  // A database without the migration must not get a query naming an unknown column
  columnRows = [{ n: 0 }];
  delete require.cache[require.resolve('./estimateScheduling')];
  assert.equal(await require('./estimateScheduling').assignVendorFilter('fe'), '');

  // The presence check is cached rather than run per request
  columnRows = [{ n: 1 }];
  delete require.cache[require.resolve('./estimateScheduling')];
  const module = require('./estimateScheduling');
  await module.assignVendorFilter('fe');
  const before = queries.filter(q => q.sql.includes('information_schema.columns')).length;
  await module.assignVendorFilter('fe');
  assert.equal(queries.filter(q => q.sql.includes('information_schema.columns')).length, before);
});
