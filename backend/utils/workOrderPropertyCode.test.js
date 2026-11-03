const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * A work order's property, said unambiguously.
 *
 * `work_orders.property_id` is a bare row number and two live property tables number their rows
 * independently -- `properties.id` 37 and `onboarded_properties.id` 37 are different communities.
 * The customer portal matched on that number, so a newly added FP customer was shown another
 * household's work orders: their descriptions, their entry notes, and wrong counts on the
 * dashboard. `invoices` never had this because it carries `property_code` beside `property_id`;
 * schema_v62 gives `work_orders` the same second identifier.
 *
 * Checked here: the resolution rule (and that an ambiguous number resolves to *nothing* rather
 * than to a guess), that the column is never ALTERed on a request path, and -- statically --
 * that every writer records the code and that the customer scope still guards the numeric match.
 */

const backend = path.join(__dirname, '..');

const load = ({ columns = ['id', 'property_code'], properties = [], allowAlter = true } = {}) => {
  const calls = [];
  const pool = {
    execute: async (sql, params = []) => {
      calls.push({ sql: sql.trim().replace(/\s+/g, ' '), params });
      if (sql.includes('information_schema')) {
        return [columns.includes('property_code') ? [{ COLUMN_NAME: 'property_code' }] : []];
      }
      if (sql.startsWith('ALTER TABLE work_orders')) {
        if (!allowAlter) throw new Error('ALTER command denied to user');
        columns.push('property_code');
        return [{}];
      }
      if (sql.startsWith('CREATE INDEX')) return [{}];
      if (sql.includes('FROM onboarded_properties')) {
        return [properties.filter(row => row.id === params[0]).map(row => ({ code: row.code }))];
      }
      if (sql.startsWith('UPDATE work_orders')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  delete require.cache[require.resolve('../config/database')];
  delete require.cache[require.resolve('./workOrderPropertyCode')];
  require.cache[require.resolve('../config/database')] = { exports: { pool } };
  const module = require('./workOrderPropertyCode');
  module.resetWorkOrderPropertyCodeCache();
  return { ...module, calls };
};

// The UNION in resolveWorkOrderPropertyCode reads both tables in one statement, so the fake
// above answers it once with every candidate for the number
const withProperties = (rows) => load({ properties: rows });

test('a code is told from a row number by not being all digits', () => {
  const { isPropertyCode } = load();
  assert.equal(isPropertyCode('GC-1793673531543'), true);
  assert.equal(isPropertyCode('APT-17'), true);
  assert.equal(isPropertyCode('37'), false);
  assert.equal(isPropertyCode(37), false);
  assert.equal(isPropertyCode(''), false);
  assert.equal(isPropertyCode('  '), false);
  assert.equal(isPropertyCode('undefined'), false);
  assert.equal(isPropertyCode(null), false);
});

test('a known code is used as-is and the database is not consulted', async () => {
  const { resolveWorkOrderPropertyCode, calls } = load();
  assert.equal(
    await resolveWorkOrderPropertyCode({ propertyCode: ' GC-1 ', propertyId: 37 }),
    'GC-1'
  );
  assert.equal(calls.filter(call => call.sql.includes('onboarded_properties')).length, 0);
});

test('a number that belongs to one property resolves to its code', async () => {
  const { resolveWorkOrderPropertyCode } = withProperties([{ id: 37, code: 'GC-37' }]);
  assert.equal(await resolveWorkOrderPropertyCode({ propertyId: 37 }), 'GC-37');
  assert.equal(await resolveWorkOrderPropertyCode({ propertyId: '37' }), 'GC-37');
});

test('a number shared by two properties resolves to nothing, never to a guess', async () => {
  // This is the whole bug: properties.id 37 and onboarded_properties.id 37 are different
  // communities. Stamping either one would hand the work order to the wrong household
  // permanently, which is worse than leaving it to match on the number as it does today.
  const { resolveWorkOrderPropertyCode } = withProperties([
    { id: 37, code: 'GC-37' }, { id: 37, code: 'APT-99' }
  ]);
  assert.equal(await resolveWorkOrderPropertyCode({ propertyId: 37 }), null);
});

test('schema_v28 copied ids between the tables, so the same code twice is not ambiguous', async () => {
  const { resolveWorkOrderPropertyCode } = withProperties([
    { id: 37, code: 'GC-37' }, { id: 37, code: 'GC-37' }
  ]);
  assert.equal(await resolveWorkOrderPropertyCode({ propertyId: 37 }), 'GC-37');
});

test('a number that matches no property resolves to nothing', async () => {
  const { resolveWorkOrderPropertyCode } = withProperties([]);
  assert.equal(await resolveWorkOrderPropertyCode({ propertyId: 404 }), null);
  assert.equal(await resolveWorkOrderPropertyCode({}), null);
});

test('the stamp writes the code against the new work order', async () => {
  const { stampWorkOrderPropertyCode, calls } = load();
  assert.equal(await stampWorkOrderPropertyCode(7, { propertyCode: 'GC-7' }), 'GC-7');
  const update = calls.find(call => call.sql.startsWith('UPDATE work_orders'));
  assert.deepEqual(update.params, ['GC-7', 7]);
});

test('the stamp never alters the table -- DDL on a request path commits the transaction', async () => {
  const { stampWorkOrderPropertyCode, calls } = load({ columns: ['id'] });
  assert.equal(await stampWorkOrderPropertyCode(7, { propertyCode: 'GC-7' }), null);
  assert.equal(calls.filter(call => call.sql.startsWith('ALTER TABLE')).length, 0);
  assert.equal(calls.filter(call => call.sql.startsWith('UPDATE work_orders')).length, 0);
});

test('a stamp that fails does not fail the work order', async () => {
  const { stampWorkOrderPropertyCode } = load();
  const exploding = { execute: async () => { throw new Error('connection lost'); } };
  assert.equal(await stampWorkOrderPropertyCode(7, { propertyCode: 'GC-7' }, exploding), null);
});

test('ensure adds the column as the migration would, once', async () => {
  const { ensureWorkOrderPropertyCode, calls } = load({ columns: ['id'] });
  assert.equal(await ensureWorkOrderPropertyCode(), true);
  assert.equal(await ensureWorkOrderPropertyCode(), true);
  const alters = calls.filter(call => call.sql.startsWith('ALTER TABLE work_orders'));
  assert.equal(alters.length, 1);
  assert.match(alters[0].sql, /ADD COLUMN property_code/);
});

test('a database that refuses the ALTER degrades instead of breaking', async () => {
  const { ensureWorkOrderPropertyCode } = load({ columns: ['id'], allowAlter: false });
  assert.equal(await ensureWorkOrderPropertyCode(), false);
});

test('the reader tolerates a row that has not been stamped yet', async () => {
  const { propertyCodeAgreement } = load();
  const agreement = await propertyCodeAgreement('wo', 'GC-37');
  // NULL still matches: the backfill has not necessarily run, and dropping those rows would
  // empty a customer's history rather than merely unmix it
  assert.match(agreement.sql, /property_code IS NULL/);
  assert.match(agreement.sql, /wo\.property_code = \?/);
  assert.deepEqual(agreement.params, ['GC-37']);
});

test('the reader names no missing column -- that would empty the dashboard outright', async () => {
  const { propertyCodeAgreement } = load({ columns: ['id'] });
  assert.deepEqual(await propertyCodeAgreement('wo', 'GC-37'), { sql: '', params: [] });
  // And with no code to compare against there is nothing to add either
  const present = load();
  assert.deepEqual(await present.propertyCodeAgreement('wo', null), { sql: '', params: [] });
});

// --- the writers and the reader, statically ---------------------------------------

const sourceOf = (...parts) => fs.readFileSync(path.join(backend, ...parts), 'utf8');

// Every file that inserts a work order, and how many it inserts
const WRITERS = [
  ['routes', 'workOrders.js', 2],
  ['routes', 'franchisePartner.js', 1],
  ['routes', 'manager.js', 1],
  ['routes', 'coordinator.js', 1],
  ['routes', 'supervisor.js', 1],
  ['routes', 'executive.js', 1],
  ['routes', 'admin.js', 1],
  ['services', 'schedulingService.js', 1],
  ['services', 'schedulingWorkflow.js', 1],
  ['services', 'workOrderScheduler.js', 1]
];

for (const [dir, file, inserts] of WRITERS) {
  test(`${file} records the property code for every work order it creates`, () => {
    const source = sourceOf(dir, file);
    assert.equal(
      (source.match(/INSERT INTO work_orders/g) || []).length, inserts,
      `${file} gained or lost a work order INSERT -- each one needs its own stamp`
    );
    // The destructuring require is `{ stampWorkOrderPropertyCode }`, so only calls match
    assert.equal(
      (source.match(/stampWorkOrderPropertyCode\(/g) || []).length, inserts,
      `${file} does not stamp every work order it inserts`
    );
  });
}

test('the customer scope guards its numeric property match with the code', () => {
  const source = sourceOf('routes', 'customers.js');
  const scope = source.slice(
    source.indexOf('const customerWorkOrderScope'),
    source.indexOf('const customerInvoiceScope')
  );
  assert.notEqual(scope.length, 0, 'customerWorkOrderScope not found');
  assert.match(scope, /propertyCodeAgreement\('wo', propertyCode\)/,
    'a bare wo.property_id = ? match hands the customer another community\'s work orders');
  assert.match(scope, /wo\.property_id = \?\$\{agreement\.sql\}/,
    'the agreement must narrow the numeric condition, not sit beside it as another OR');

  // Every caller must await it, or `scope.sql` is a Promise and the WHERE clause is "[object
  // Promise]" -- which fails the statement and empties every customer's dashboard
  for (const call of source.match(/.*customerWorkOrderScope\(\{.*/g) || []) {
    assert.match(call, /await customerWorkOrderScope/, `not awaited: ${call.trim()}`);
  }
});

test('the migration and the boot repair agree on the column', () => {
  const migration = sourceOf('database', 'migrations', 'schema_v62_work_order_property_code.sql');
  assert.match(migration, /'work_orders', 'property_code', 'VARCHAR\(50\) DEFAULT NULL'/);
  // MySQL 8 has no ADD COLUMN / CREATE INDEX "IF NOT EXISTS" -- that is MariaDB, and files
  // using it silently fail to apply on the VPS. Idempotency comes from information_schema.
  // Comments are stripped first: this file names the MariaDB syntax in order to warn about it.
  const statements = migration.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(statements, /ADD COLUMN IF NOT EXISTS/i);
  assert.doesNotMatch(statements, /CREATE INDEX IF NOT EXISTS/i);
  assert.match(statements, /information_schema\.columns/i);

  const boot = sourceOf('config', 'database.js');
  assert.match(boot, /ALTER TABLE work_orders ADD COLUMN property_code VARCHAR\(50\) DEFAULT NULL/,
    'a deployment that never applies the migration must still self-heal at boot');
  assert.match(boot, /property_code VARCHAR\(50\) DEFAULT NULL,/,
    'a database created from scratch must have the column already');
});
