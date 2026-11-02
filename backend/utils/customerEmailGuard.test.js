const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * One email, one customer account -- and a second entry is refused, never merged.
 *
 * Two things are checked here. The lookup itself: it must be case-insensitive, must
 * ignore a blank email, and must NOT filter on is_active / is_activated, because a
 * soft-deleted customer still owns its row and retyping the customer must not revive it.
 *
 * And, statically, that every Add Customer / onboarding route still calls the guard
 * *before* its first INSERT. That ordering is the whole promise: the portal routes write
 * the property and client rows before they ever look at the email, so a check that
 * drifts below them would leave a half-created customer behind the refusal.
 */

const { firstTakenCustomerEmail, customerEmailExists, customerEmailExistsResponse,
  CUSTOMER_EMAIL_EXISTS_MESSAGE } = require('./customerEmailGuard');

const fakePool = (taken = []) => {
  const queries = [];
  return {
    queries,
    execute: async (sql, params) => {
      queries.push({ sql, params });
      const hits = params.filter(p => taken.includes(p)).map(email => ({ email }));
      return [hits];
    }
  };
};

test('an email that already has an account is reported, whatever its case or padding', async () => {
  const pool = fakePool(['c@x.test']);
  assert.equal(await firstTakenCustomerEmail(pool, '  C@X.Test '), 'c@x.test');
  assert.equal(await customerEmailExists(pool, 'C@X.TEST'), true);
  // The address is normalized before it is bound, and compared with LOWER() on the column
  assert.deepEqual(pool.queries[0].params, ['c@x.test']);
  assert.match(pool.queries[0].sql, /LOWER\(email\) IN/);
});

test('a free email is not a conflict', async () => {
  const pool = fakePool(['taken@x.test']);
  assert.equal(await firstTakenCustomerEmail(pool, 'new@x.test'), null);
  assert.equal(await customerEmailExists(pool, 'new@x.test'), false);
});

test('the lookup does not filter is_active or is_activated', async () => {
  const pool = fakePool([]);
  await customerEmailExists(pool, 'c@x.test');
  // A soft-deleted (is_active = 0) or never-activated row must still block: reviving one
  // by retyping the customer is the silent relink this guard replaced
  assert.doesNotMatch(pool.queries[0].sql, /is_active/);
  assert.doesNotMatch(pool.queries[0].sql, /is_activated/);
});

test('every contact of a property is checked, deduped, and blanks are ignored', async () => {
  const pool = fakePool(['second@x.test']);
  const found = await firstTakenCustomerEmail(pool,
    ['first@x.test', 'SECOND@x.test', 'first@x.test', '', null, undefined]);
  assert.equal(found, 'second@x.test');
  assert.deepEqual(pool.queries[0].params, ['first@x.test', 'second@x.test']);
});

test('a contact with no email asks the database nothing', async () => {
  const pool = fakePool(['c@x.test']);
  assert.equal(await customerEmailExists(pool, ''), false);
  assert.equal(await customerEmailExists(pool, null), false);
  assert.equal(await customerEmailExists(pool, [null, '  ']), false);
  assert.equal(pool.queries.length, 0);
});

test('the refusal body is the same message in every portal', () => {
  const body = customerEmailExistsResponse();
  assert.equal(body.success, false);
  assert.equal(body.code, 'CUSTOMER_EMAIL_EXISTS');
  assert.equal(body.message, CUSTOMER_EMAIL_EXISTS_MESSAGE);
  assert.match(body.message, /already exists/i);
  assert.match(body.message, /admin/i);
});

// --- the routes, statically -------------------------------------------------------

const routeSource = (file) => fs.readFileSync(path.join(__dirname, '..', 'routes', file), 'utf8');

// The slice of a file between a route declaration and the next one
const handlerOf = (source, declaration) => {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `route not found: ${declaration}`);
  const next = source.indexOf('\nrouter.', start + declaration.length);
  return source.slice(start, next === -1 ? source.length : next);
};

const ADD_CUSTOMER_ROUTES = [
  ['onboarding.js', "router.post('/', authenticate"],
  ['customers.js', "router.post('/create', authenticate"],
  ['manager.js', "router.post('/customers', requireManagerScope"],
  ['coordinator.js', "router.post('/customers', requireCoordinatorScope"],
  ['supervisor.js', "router.post('/customers', requireSupervisorScope"],
  ['franchisePartner.js', "router.post('/customers', requireFPScope"],
  ['executive.js', "router.post('/customers', requireExecutiveScope"]
];

for (const [file, declaration] of ADD_CUSTOMER_ROUTES) {
  test(`${file} refuses a known email before it writes anything`, () => {
    const handler = handlerOf(routeSource(file), declaration);

    const guard = handler.indexOf('customerEmailExists(');
    assert.notEqual(guard, -1, `${file} does not call the guard`);

    const firstInsert = handler.search(/INSERT INTO/);
    if (firstInsert !== -1) {
      assert.ok(guard < firstInsert,
        `${file} writes before it checks the email -- the refusal would leave rows behind`);
    }
  });
}

test('a transactional route rolls back before answering', () => {
  // onboarding and /customers/create open their transaction before the body is read, so
  // the refusal has to release it -- an unanswered rollback holds the connection
  for (const [file, declaration] of ADD_CUSTOMER_ROUTES.slice(0, 2)) {
    const handler = handlerOf(routeSource(file), declaration);
    assert.match(handler, /customerEmailExists\([\s\S]{0,160}?rollback\(\)/,
      `${file} must roll back before it answers 409`);
  }
});

test('nothing re-points an existing account at a new property any more', () => {
  for (const [file] of ADD_CUSTOMER_ROUTES) {
    const source = routeSource(file);
    assert.doesNotMatch(source, /linkCustomerToProperty|notifyPropertyAdded/,
      `${file} still relinks an existing customer account`);
  }
});
