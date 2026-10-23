const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Guard for GET /api/staff?fpId=N.
 *
 * An fpId-scoped request must return that FP's own team — the franchise owner
 * plus fp_employees rows — and nothing else. The route used to inject every
 * company admin/operations_manager into the scoped list, so payment pickers
 * like "Received By" offered people who have nothing to do with that FP.
 *
 * Run: node --test backend/routes/staffList.test.js
 */

const src = fs.readFileSync(path.join(__dirname, 'staff.js'), 'utf8');
const listIdx = src.indexOf("router.get('/', authenticate");
const scopedStart = src.indexOf('if (effectiveFpId)');
const scopedEnd = src.indexOf('// Otherwise fetch from users table');
const scoped = src.slice(scopedStart, scopedEnd);

test('the fpId-scoped staff list contains no company admins', () => {
  assert.ok(listIdx > -1 && scopedStart > -1 && scopedEnd > scopedStart,
    'route shape changed — re-check this guard');
  assert.doesNotMatch(scoped, /role IN \('admin', 'operations_manager'\)/,
    'the fpId-scoped list must not inject company admins — it is that FP\'s team only');
});

test('the fpId-scoped list still carries the FP owner and fp_employees', () => {
  assert.match(scoped, /FROM franchise_partners WHERE id = \?/);
  assert.match(scoped, /FROM fp_employees e\s+WHERE e\.franchise_partner_id = \?/);
});

// One email = one login identity. The rsbhavani1 incident: an FP owner's email
// also lived in users with a different hash, and first-match logins rejected
// the correct FP password. Creation paths must refuse that split.
test('staff creation refuses an email already held by franchise_partners', () => {
  const createIdx = src.indexOf("router.post('/', authenticate, adminOnly");
  assert.ok(createIdx > -1, 'create-staff route not found');
  const createBlock = src.slice(createIdx, src.indexOf('INSERT INTO users', createIdx));
  assert.match(createBlock, /SELECT id FROM franchise_partners WHERE username = \? OR email = \?/,
    'franchise_partners check missing from staff creation');
  assert.doesNotMatch(createBlock, /if \(role === 'franchise_partner'.*fpExisting/s,
    'the franchise_partners check must run for every role, not only FP roles');
});

test('both unified logins try every identity table for an email', () => {
  const loginIdx = src.indexOf("router.post('/login'");
  assert.ok(loginIdx > -1);
  const loginBlock = src.slice(loginIdx, src.indexOf('// Fallback to demo users'));
  assert.match(loginBlock, /const candidates = \[\]/,
    'staff login must collect candidates from users AND franchise_partners');
});
