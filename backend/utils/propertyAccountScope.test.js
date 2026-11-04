const test = require('node:test');
const assert = require('node:assert/strict');

const { propertyAccountScope } = require('./propertyAccountScope');

test('scope keys on the deleted property code, never a bare email or id', () => {
  const scope = propertyAccountScope([{ code: 'APT-1793641686695', email: 'shared@x.com' }], 62);
  assert.match(scope.sql, /property_code IN \(\?\)/);
  assert.ok(scope.sql.includes('property_id = ? AND email = ?'));
  assert.deepEqual(scope.params, ['APT-1793641686695', 62, 'shared@x.com']);
});

test('a row with no code still scopes by the id tied to its own email', () => {
  const scope = propertyAccountScope([{ code: null, email: 'A@X.com' }], 7);
  assert.equal(scope.sql, '((property_id = ? AND email = ?))');
  assert.deepEqual(scope.params, [7, 'a@x.com']);
});

test('rows in both tables each contribute their own code', () => {
  const scope = propertyAccountScope(
    [{ code: 'GC-1', email: null }, { code: 'APT-2', email: 'e@x.com' }], 9);
  assert.ok(scope.sql.includes('property_code IN (?, ?)'));
  assert.deepEqual(scope.params, ['GC-1', 'APT-2', 9, 'e@x.com']);
});

test('codeColumn:false leaves the code out -- a table missing the column cannot name it', () => {
  const scope = propertyAccountScope(
    [{ code: 'GC-1', email: 'e@x.com' }], 9, { codeColumn: false });
  assert.ok(!scope.sql.includes('property_code'));
  assert.deepEqual(scope.params, [9, 'e@x.com']);
});

test('nothing to match on produces a clause that selects nothing', () => {
  const scope = propertyAccountScope([{ code: null, email: null }], 62);
  assert.equal(scope.sql, '(0)');
  assert.deepEqual(scope.params, []);
});
