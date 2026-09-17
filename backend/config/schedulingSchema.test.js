const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initSchedulingSchema } = require('./schedulingSchema');

const tables = ['schedule_series', 'schedule_occurrences', 'schedule_series_history', 'schedule_occurrence_history', 'vendor_zone_schedule', 'schedule_renewals', 'schedule_renewal_history', 'property_renewal_settings'];
const columns = ['auto_renewal_enabled', 'renewal_notice_days', 'renewal_status', 'renewal_notice_sent_at', 'renewed_from_series_id', 'renewed_to_series_id', 'renewal_approved_by', 'renewal_approved_at', 'renewal_declined_reason'];

function database(existingColumns = [], existingIndexes = []) {
  const state = { tables: new Set(), columns: new Set(existingColumns), indexes: new Set(existingIndexes), queries: [], releases: 0 };
  const connection = {
    async query(sql, params = []) {
      state.queries.push(sql);
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }]];
      if (sql.includes('information_schema.COLUMNS')) {
        assert.deepEqual(params, ['schedule_series']);
        assert.match(sql, /TABLE_SCHEMA = DATABASE\(\)/);
        return [[...state.columns].map(COLUMN_NAME => ({ COLUMN_NAME }))];
      }
      if (sql.includes('information_schema.STATISTICS')) {
        assert.deepEqual(params, ['schedule_series']);
        assert.match(sql, /TABLE_SCHEMA = DATABASE\(\)/);
        return [[...state.indexes].map(INDEX_NAME => ({ INDEX_NAME }))];
      }
      const table = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (table) {
        for (const parent of sql.matchAll(/REFERENCES (schedule_\w+)\(id\)/g)) {
          assert.ok(state.tables.has(parent[1]), `Missing parent ${parent[1]}`);
        }
        state.tables.add(table[1]);
        return [[]];
      }
      const column = sql.match(/ALTER TABLE schedule_series ADD COLUMN `(\w+)`/);
      if (column) {
        assert.ok(!state.columns.has(column[1]), 'Do not add existing columns');
        state.columns.add(column[1]);
        return [[]];
      }
      const index = sql.match(/ALTER TABLE schedule_series ADD INDEX `(\w+)`/);
      if (index) {
        assert.ok(!state.indexes.has(index[1]), 'Do not add existing indexes');
        state.indexes.add(index[1]);
        return [[]];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() { state.releases++; }
  };
  return { state, connection, pool: { getConnection: async () => connection } };
}

test('initializes all scheduling dependencies using MySQL 8 compatible additive DDL', async () => {
  const { state, pool } = database();
  await initSchedulingSchema(pool);
  assert.deepEqual([...state.tables], tables);
  assert.deepEqual([...state.columns], columns);
  assert.deepEqual([...state.indexes], ['idx_ss_renewal_status', 'idx_ss_auto_renewal']);
  assert.equal(state.releases, 1);
  for (const sql of state.queries) {
    assert.doesNotMatch(sql, /ADD (?:COLUMN|INDEX) IF NOT EXISTS|INSERT|UPDATE\s+\w+\s+SET|DELETE FROM|DROP TABLE|CREATE OR REPLACE VIEW/);
  }
});

test('repairs partially applied renewal schemas and is safe to rerun', async () => {
  const { state, pool } = database(columns.slice(0, 3), ['idx_ss_renewal_status']);
  await initSchedulingSchema(pool);
  assert.equal(state.columns.size, columns.length);
  state.queries = [];
  await initSchedulingSchema(pool);
  assert.equal(state.queries.filter(sql => sql.startsWith('ALTER')).length, 0);
  assert.equal(state.releases, 2);
});

test('propagates migration failure and releases its lock and connection', async () => {
  const { state, connection, pool } = database();
  const query = connection.query;
  connection.query = async sql => {
    if (sql.startsWith('CREATE TABLE')) throw new Error('DDL permission denied');
    return query(sql);
  };
  await assert.rejects(initSchedulingSchema(pool), /DDL permission denied/);
  assert.match(state.queries.at(-1), /RELEASE_LOCK/);
  assert.equal(state.releases, 1);
});

test('does not run DDL when another initializer holds the lock', async () => {
  const { state, connection, pool } = database();
  connection.query = async sql => {
    assert.match(sql, /GET_LOCK/);
    return [[{ acquired: 0 }]];
  };
  await assert.rejects(initSchedulingSchema(pool), /initialization lock/);
  assert.equal(state.tables.size, 0);
  assert.equal(state.releases, 1);
});

test('local MySQL schema initialization is repeatable and both scheduler queries prepare successfully', { skip: process.env.RUN_LOCAL_MYSQL_TESTS !== '1' }, async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.LOCAL_DB_HOST));
  assert.equal(process.env.LOCAL_DB_NAME, 'customer_portal_local');
  const pool = require('mysql2/promise').createPool({
    host: process.env.LOCAL_DB_HOST, port: process.env.LOCAL_DB_PORT || 3306,
    user: process.env.LOCAL_DB_USER, password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME
  });
  try {
    await initSchedulingSchema(pool);
    await initSchedulingSchema(pool);
    const [created] = await pool.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)', [tables]);
    assert.equal(created.length, tables.length);
    const [added] = await pool.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?)', ['schedule_series', columns]);
    assert.equal(added.length, columns.length);
    const source = fs.readFileSync(path.join(__dirname, '../services/autoRenewalService.js'), 'utf8');
    const query = source.match(/const \[seriesDueForRenewal\] = await connection.execute\(`([\s\S]*?)`\);/);
    assert.ok(query);
    await pool.query(`EXPLAIN ${query[1]}`);
    const scheduler = fs.readFileSync(path.join(__dirname, '../services/workOrderScheduler.js'), 'utf8');
    const visits = scheduler.match(/const \[upcomingVisits\] = await connection.execute\(`([\s\S]*?)`\);/);
    assert.ok(visits);
    await pool.query(`EXPLAIN ${visits[1]}`);
  } finally {
    await pool.end();
  }
});

test('scheduler registers no jobs until schema initialization succeeds', async t => {
  let fail = true;
  let ready = false;
  let registrations = 0;
  const modulePaths = ['node-cron', './database', '../services/emailService', '../services/autoRenewalService', './schedulingSchema', '../services/workOrderScheduler'].map(name => require.resolve(name));
  const cached = modulePaths.map(name => require.cache[name]);
  t.after(() => modulePaths.forEach((name, i) => {
    if (cached[i]) require.cache[name] = cached[i];
    else delete require.cache[name];
  }));
  require.cache[modulePaths[0]] = { exports: { schedule() { assert.equal(ready, true); registrations++; } } };
  require.cache[modulePaths[1]] = { exports: { pool: {} } };
  require.cache[modulePaths[2]] = { exports: { sendEmail: async () => {}, getWorkOrderNotificationRecipients: async () => [] } };
  require.cache[modulePaths[3]] = { exports: { processRenewals: async () => {}, getRenewalStats: () => ({}) } };
  require.cache[modulePaths[4]] = { exports: { initSchedulingSchema: async () => {
    await Promise.resolve();
    if (fail) throw new Error('Missing scheduling schema');
    ready = true;
  } } };
  delete require.cache[modulePaths[5]];
  const { initScheduler, getSchedulerStatus } = require('../services/workOrderScheduler');
  assert.equal(await initScheduler(), false);
  assert.equal(registrations, 0);
  assert.equal(getSchedulerStatus().isRunning, false);
  fail = false;
  assert.equal(await initScheduler(), true);
  assert.equal(registrations, 2);
  assert.equal(getSchedulerStatus().isRunning, true);
  await initScheduler();
  assert.equal(registrations, 2);
});
