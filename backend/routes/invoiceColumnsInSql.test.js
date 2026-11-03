const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * No query may read a column `invoices` does not have.
 *
 * `GET /api/razorpay/public/invoice/:invoiceId` — the page the Pay Now button in every invoice
 * email leads to — selected `i.property_name` from `invoices`. There is no such column: no
 * migration has ever created one, so a database built from this repo fails too, and this is not
 * the usual "the VPS is behind" drift. Every request answered 500 "Failed to load invoice
 * details" with `ER_BAD_FIELD_ERROR` in the log, so no customer could open the link they were
 * emailed. The token-verified variant of the same query had it too.
 *
 * The four names below all describe the **property**, and an invoice carries only its id and its
 * code; the name is joined (`PROPERTY_NAME_SELECT` / `PROPERTY_NAME_JOINS` in `routes/razorpay.js`,
 * matching the code before the row number, since a bare number is not unique across
 * `properties` and `onboarded_properties`).
 *
 * The check reads SQL only — the slice between `SELECT` and `FROM invoices i` — because the route
 * handlers legitimately write `i.property_name` in JavaScript when mapping a row whose SELECT
 * aliased a joined column to that name.
 *
 * Run: node --test backend/routes/invoiceColumnsInSql.test.js
 */

const root = path.join(__dirname, '..');
const ABSENT = ['property_name', 'property_type', 'zone', 'city'];

const sources = () => {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'uploads'].includes(entry.name)) walk(full);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        files.push(full);
      }
    }
  };
  walk(root);
  return files;
};

// Every `SELECT … FROM invoices i` in a file, as the text between the two
const invoiceSelects = source => {
  const found = [];
  const pattern = /FROM\s+invoices\s+i\b/gi;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const select = source.lastIndexOf('SELECT', match.index);
    if (select >= 0) found.push(source.slice(select, match.index));
  }
  return found;
};

test('nothing selects a property column off the invoices table', () => {
  const offenders = [];
  for (const file of sources()) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/FROM\s+invoices\s+i\b/i.test(source)) continue;
    for (const select of invoiceSelects(source)) {
      for (const column of ABSENT) {
        if (new RegExp(`\\bi\\.${column}\\b`).test(select)) {
          offenders.push(`${path.relative(root, file).replace(/\\/g, '/')}: i.${column}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [],
    `invoices has no such column - join the property instead:\n  ${offenders.join('\n  ')}`);
});

test('the public payment page joins the property for its name', () => {
  const source = fs.readFileSync(path.join(root, 'routes', 'razorpay.js'), 'utf8');
  assert.match(source, /const PROPERTY_NAME_SELECT\s*=/, 'the joined name is gone');
  // Both public invoice reads use it: the plain one and the token-verified one
  assert.equal((source.match(/\$\{PROPERTY_NAME_SELECT\}/g) || []).length, 2);
  assert.equal((source.match(/\$\{PROPERTY_NAME_JOINS\}/g) || []).length, 2);
  // The code is matched before the bare row number, which is not unique across the two tables
  const joins = source.slice(source.indexOf('const PROPERTY_NAME_JOINS'), source.indexOf('// Environment variables'));
  assert.ok(joins.indexOf('prop_by_code.property_id = i.property_code') < joins.indexOf('prop_by_id.id = i.property_id'),
    'the row-number join must be the fallback, not the first match');
});
