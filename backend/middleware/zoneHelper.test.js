const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getCreatorIdentifier,
  getCreatorIdentities,
  creatorIdentityList,
  buildWorkOrderZoneOrCreatorFilter
} = require('./zoneHelper');

// A manager's work order was invisible in their own list: the writer stamped the EMAIL
// (`req.user?.email || req.user?.username`) while every reader's "own created" ground compared
// `getCreatorIdentifier` (the USERNAME). The writer now uses getCreatorIdentifier, and readers
// match all of a user's identifiers so rows written either way come back.

test('getCreatorIdentifier: username first, then email', () => {
  assert.equal(getCreatorIdentifier({ user: { username: 'mgr_1', email: 'm@x.com' } }), 'mgr_1');
  assert.equal(getCreatorIdentifier({ user: { email: 'm@x.com' } }), 'm@x.com');
  assert.equal(getCreatorIdentifier({ user: {} }), '');
});

test('getCreatorIdentities: every identifier a row may carry', () => {
  assert.deepEqual(getCreatorIdentities({ user: { username: 'mgr_1', email: 'm@x.com' } }), ['mgr_1', 'm@x.com']);
  assert.deepEqual(getCreatorIdentities({ user: {} }), ['']);
});

test('creatorIdentityList: string or array, deduped, never empty', () => {
  assert.deepEqual(creatorIdentityList('a'), ['a']);
  assert.deepEqual(creatorIdentityList(['a', 'a', null, '', 'b']), ['a', 'b']);
  assert.deepEqual(creatorIdentityList([]), ['']);
});

test('work order filter matches creator on a list of identifiers', () => {
  const f = buildWorkOrderZoneOrCreatorFilter([], ['mgr_1', 'm@x.com'], 'p', 'wo');
  assert.match(f.clause, /wo\.created_by IN \(\?,\?\)/);
  assert.deepEqual(f.params, ['mgr_1', 'm@x.com']);
});

test('the manager work-order writer cannot stamp the email again', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'manager.js'), 'utf8');
  const post = src.indexOf("router.post('/work-orders'");
  const insert = src.indexOf('INSERT INTO work_orders', post);
  const section = src.slice(post, insert);
  assert.ok(
    !/req\.user\?\.email \|\| req\.user\?\.username/.test(section),
    'work_orders.created_by must be getCreatorIdentifier(req) -- email-first is what hid the row'
  );
});
