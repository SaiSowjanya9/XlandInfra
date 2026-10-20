/**
 * Looking an employee up, and the two columns that have to be repaired before any of it works.
 *
 * The schema guard is tested against the shape MySQL 8 really answers with -- UPPERCASE
 * information_schema column names -- because the first version of it read `row.data_type`, got
 * `undefined` for every column, and quietly decided there was nothing to fix. It logged nothing and
 * changed nothing, which is the worst way for a repair to fail.
 *
 * Run: node --test backend/utils/fpEmployeeDirectory.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

// marketingComplaints.js (required for the role rules) reaches for a connection to back-fill its
// table; nothing here touches a real database.
require.cache[require.resolve('../config/database')] = {
  exports: { pool: { execute: async () => [[{ n: 1 }]] } }
};

const {
  ensureFpEmployeeSchema, coversZone, resolveFpEmployee, listAssignableEmployees, employeeName
} = require('./fpEmployeeDirectory');

// MySQL 8 reports information_schema's own columns in upper case whatever case the SELECT is
// written in, so the aliases are what the code must read. This answers exactly as the server does.
const schemaPool = ({ roleType = 'enum', zoneIdNullable = 'NO', zoneName = true } = {}) => {
  const statements = [];
  return {
    statements,
    execute: async (sql, params) => {
      statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      const [table, column] = params;
      if (table === 'fp_employees' && column === 'role') return [[{ dataType: roleType, isNullable: 'NO' }]];
      if (table === 'fp_employee_zones' && column === 'zone_name') return [zoneName ? [{ dataType: 'varchar', isNullable: 'YES' }] : []];
      if (table === 'fp_employee_zones' && column === 'zone_id') return [[{ dataType: 'int', isNullable: zoneIdNullable }]];
      return [[]];
    },
    query: async (sql) => { statements.push({ sql }); return [[]]; }
  };
};

test('the drifted employee columns are repaired, and the repair is reported', async () => {
  const pool = schemaPool();
  const changed = await ensureFpEmployeeSchema(pool);
  assert.deepEqual(changed, [
    'fp_employees.role widened to VARCHAR(50)',
    'fp_employee_zones.zone_id made nullable'
  ]);
  // The ENUM holds only fp_manager/fp_supervisor/fp_executive, so every role the Add Employee form
  // sends is truncated (errno 1265) and no employee can be created at all.
  assert.ok(pool.statements.some((s) => /MODIFY COLUMN role VARCHAR\(50\)/.test(s.sql)));
  // zone_id is NOT NULL with no default while the zone routes insert a zone_name only (errno
  // 1364), which silently left every employee with no zones -- and so with no zone-centric access.
  assert.ok(pool.statements.some((s) => /MODIFY COLUMN zone_id INT NULL/.test(s.sql)));
  // MySQL 8 has no "MODIFY COLUMN IF", so nothing may lean on MariaDB's syntax.
  assert.ok(!pool.statements.some((s) => /IF (NOT )?EXISTS/.test(s.sql)));
});

test('a database already in the right shape is left alone', async () => {
  const pool = schemaPool({ roleType: 'varchar', zoneIdNullable: 'YES' });
  assert.deepEqual(await ensureFpEmployeeSchema(pool), []);
  assert.ok(!pool.statements.some((s) => /^ALTER/.test(s.sql)));
});

test('a deployment without zone_name gains it', async () => {
  const pool = schemaPool({ roleType: 'varchar', zoneIdNullable: 'YES', zoneName: false });
  assert.deepEqual(await ensureFpEmployeeSchema(pool), ['fp_employee_zones.zone_name added']);
});

test('an employee covers a zone by name, by "all", or not at all', () => {
  const decode = (value) => String(value).replace(/&#x2F;/g, '/');
  assert.equal(coversZone(['North Zone'], 'North Zone'), true);
  assert.equal(coversZone(['north zone'], 'North Zone'), true, 'compared case-folded');
  assert.equal(coversZone(['South Zone'], 'North Zone'), false);
  // 'all' is the every-zone assignment the Employee Zone screen writes as a single row.
  assert.equal(coversZone(['all'], 'Anything'), true);
  assert.equal(coversZone([], 'North Zone'), false);
  // A zone is a name merged from several sources and arrives HTML-escaped on the complaint.
  assert.equal(coversZone(['Hitech&#x2F;Gachibowli'], 'Hitech/Gachibowli', decode), true);
  // No zone on the complaint recommends nobody, rather than everybody.
  assert.equal(coversZone(['all'], ''), false);
});

test('the caller is resolved by user_id or email, never by the token id as an employee id', async () => {
  // fp_employees.id and users.id are both auto-increment sequences and collide constantly; matching
  // one against the other would hand an employee somebody else's assigned complaints.
  const calls = [];
  const pool = {
    execute: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (sql.includes('user_id = ?')) return [params[1] === 42 ? [{ id: 7, user_id: 42 }] : []];
      if (sql.includes('email = ?')) return [params[1] === 'priya@example.com' ? [{ id: 9 }] : []];
      return [[]];
    }
  };

  assert.equal((await resolveFpEmployee(pool, { franchisePartnerId: 8, userId: 42 })).id, 7);
  assert.ok(calls.every((call) => !/\bid = \?/.test(call.sql)), 'the token id is never read as an employee id');

  // Falls back to the login identity, which is all a manager's token carries.
  const byEmail = await resolveFpEmployee(pool, { franchisePartnerId: 8, userId: 99, email: 'priya@example.com' });
  assert.equal(byEmail.id, 9);

  // No partner, no employee -- and every lookup is scoped to one.
  assert.equal(await resolveFpEmployee(pool, { userId: 42 }), null);
  assert.equal(await resolveFpEmployee(pool, { franchisePartnerId: 8, userId: 1, email: 'nobody@example.com' }), null);
  assert.ok(calls.every((call) => call.params[0] === 8));
});

test('the picker offers every assignable employee, the zone\'s own first', async () => {
  const employees = [
    { id: 1, first_name: 'Ravi', last_name: 'M', role: 'fp_manager', email: 'ravi@x.com', user_id: 11 },
    { id: 2, first_name: 'Sita', last_name: 'B', role: 'supervisor', email: 'sita@x.com', user_id: 12 },
    { id: 3, first_name: 'Priya', last_name: 'N', role: 'coordinator', email: 'priya@x.com', user_id: 13 },
    { id: 4, first_name: 'Arun', last_name: 'K', role: 'executive', email: 'arun@x.com', user_id: 14 },
    // No portal of their own, so no screen to read an assignment in.
    { id: 5, first_name: 'Gopal', last_name: 'R', role: 'field_staff', email: 'gopal@x.com', user_id: 15 }
  ];
  const pool = {
    execute: async (sql) => {
      if (sql.includes('FROM fp_employees')) return [employees];
      if (sql.includes('FROM fp_employee_zones')) {
        return [[{ fp_employee_id: 3, zone_name: 'North Zone' }, { fp_employee_id: 1, zone_name: 'South Zone' }]];
      }
      return [[]];
    }
  };

  const listed = await listAssignableEmployees(pool, { franchisePartnerId: 8, zone: 'North Zone' });
  // Manager, coordinator, supervisor and executive all have the Complaint Form; field staff do not,
  // so they are never offered.
  assert.deepEqual(listed.map((e) => e.id), [3, 1, 2, 4]);
  assert.deepEqual(listed.map((e) => e.recommended), [true, false, false, false]);
  // schema_v8's fp_ prefix is dropped, so the screen reads one spelling.
  assert.equal(listed.find((e) => e.id === 1).role, 'manager');
  assert.equal(listed[0].name, 'Priya N');
  // A zone nobody holds still lists everybody: an empty picker would leave the FP unable to act on
  // the complaint at all.
  const elsewhere = await listAssignableEmployees(pool, { franchisePartnerId: 8, zone: 'East Zone' });
  assert.equal(elsewhere.length, 4);
  assert.ok(elsewhere.every((e) => !e.recommended));
  // Nothing from the employment record that a picker has no business showing.
  assert.ok(!Object.keys(listed[0]).includes('password_hash'));
});

test('an employee is never nameless', () => {
  assert.equal(employeeName({ first_name: 'Priya', last_name: 'N' }), 'Priya N');
  assert.equal(employeeName({ first_name: 'Priya' }), 'Priya');
  assert.equal(employeeName({ username: 'priya.n' }), 'priya.n');
  assert.equal(employeeName({ email: 'priya@x.com' }), 'priya@x.com');
  assert.equal(employeeName(null), '');
});
