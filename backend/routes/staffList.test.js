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
