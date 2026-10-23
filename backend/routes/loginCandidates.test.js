const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Guard for the login shadow bug class: one email/username can match several
 * account rows (duplicates in one table, or the same person in users AND
 * fp_employees AND franchise_partners), each with a different password hash.
 * A login that checks only the first row MySQL returns rejects the correct
 * password whenever a sibling row shadows it.
 *
 * Every login route must therefore collect ALL matching rows and try each
 * hash — never `rows[0]` — and role portals must treat fp_employees as a
 * login source, not just a post-auth lookup.
 *
 * Run: node --test backend/routes/loginCandidates.test.js
 */

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const loginBlock = (src) => {
  const start = src.indexOf("router.post('/login'");
  assert.ok(start > -1, 'login route not found');
  const next = src.indexOf('router.', start + 10);
  return next > start ? src.slice(start, next) : src.slice(start);
};

for (const file of ['admin.js', 'franchisePartner.js', 'vendors.js', 'residents.js', 'staff.js']) {
  test(`${file} login tries every matching row, not rows[0]`, () => {
    const block = loginBlock(read(file));
    assert.doesNotMatch(block, /= (admins|fps|residents|fpUsers|users|linkedUsers|customers|fpEmployees|fpSupervisors)\[0\]/,
      'login must iterate all matching rows — rows[0] shadows siblings');
    assert.match(block, /for \(const \w+ of \w+\)[\s\S]{0,200}bcrypt\.compare/,
      'expected a per-row bcrypt.compare loop');
  });
}

for (const file of ['coordinator.js', 'manager.js', 'executive.js', 'supervisor.js', 'employee.js']) {
  test(`${file} login collects candidates from users AND fp_employees`, () => {
    const block = loginBlock(read(file));
    assert.match(block, /const candidates = \[\]/);
    assert.match(block, /FROM fp_employees/,
      'fp_employees must be a login source, not only a post-auth lookup');
    assert.match(block, /for \(const \w+ of candidates\)[\s\S]{0,200}bcrypt\.compare/,
      'expected a per-candidate bcrypt.compare loop');
  });
}

test('executive.js fp_employees query selects password_hash — there is no password column', () => {
  const block = loginBlock(read('executive.js'));
  assert.doesNotMatch(block, /password as password_hash|fpSup\.password\b|fe\.password\b/,
    'fp_employees has no `password` column — this used to 500 every FP-created executive login');
});

test('customers.js login tries every account row under the email', () => {
  const block = loginBlock(read('customers.js'));
  assert.match(block, /for \(const c of unlocked\)[\s\S]{0,200}bcrypt\.compare/);
});

test('fp_employees role match accepts both spellings (manager AND fp_manager)', () => {
  for (const [file, roles] of [
    ['manager.js', /'manager', 'fp_manager'/],
    ['executive.js', /'executive', 'fp_executive'/],
    ['supervisor.js', /'supervisor', 'fp_supervisor'/],
  ]) {
    const block = loginBlock(read(file));
    assert.match(block, roles, `${file} must match both role spellings in fp_employees`);
  }
});
