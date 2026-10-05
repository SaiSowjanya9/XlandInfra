const { test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeEntities, decodeDeep } = require('./htmlEntities');
const { sanitizeString } = require('../middleware/security');

test('text escaped by the request sanitizer comes back exactly as typed', () => {
  for (const typed of ['Parts/major repairs billed separately', 'AC & Ventilation', `Owner's "spare" key`, 'a\\b `c` <d>']) {
    assert.equal(decodeEntities(sanitizeString(typed)), typed);
  }
});

test('text escaped twice over -- loaded into a form and saved again -- is healed too', () => {
  assert.equal(decodeEntities(sanitizeString(sanitizeString('Lift/Elevator'))), 'Lift/Elevator');
  assert.equal(decodeEntities('Parts&amp;#x2F;major'), 'Parts/major');
});

test('anything that is not an entity is left alone', () => {
  assert.equal(decodeEntities('R&D; plain text'), 'R&D; plain text');
  assert.equal(decodeEntities('no entities'), 'no entities');
  assert.equal(decodeEntities(42), 42);
  assert.equal(decodeEntities(null), null);
});

test('decodeDeep reaches every string in a configuration', () => {
  const decoded = decodeDeep({ name: 'A&#x2F;B', rows: [{ name: 'C &amp; D', rate: 5 }], on: true, none: null });
  assert.deepEqual(decoded, { name: 'A/B', rows: [{ name: 'C & D', rate: 5 }], on: true, none: null });
});
