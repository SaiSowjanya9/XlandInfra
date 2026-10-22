const { test } = require('node:test');
const assert = require('node:assert/strict');

// The "existing account" branch of every Add Customer route goes through these two
// helpers: linkCustomerToProperty re-points the account at the property it was just
// added to, and notifyPropertyAdded sends the "you've been added" email. A send or a
// link that fails must be reported, never thrown -- the property is already saved by
// the time this runs.

let sendCalls;
let sendResult;
let sendThrows;
let queries;

require.cache[require.resolve('../services/emailService')] = { exports: {
  sendPropertyAddedEmail: async (data) => {
    sendCalls.push(data);
    if (sendThrows) throw new Error('SMTP down');
    return sendResult;
  }
} };

const { linkCustomerToProperty, notifyPropertyAdded } = require('./customerPropertyLink');

const freshState = () => { sendCalls = []; sendResult = { success: true }; sendThrows = false; queries = []; };

test('linkCustomerToProperty re-points the account and reactivates it', async () => {
  freshState();
  const pool = { execute: async (sql, params) => { queries.push({ sql, params }); return [{ affectedRows: 1 }]; } };

  const linked = await linkCustomerToProperty(pool, 7, { propertyId: 42, propertyCode: 'APT-1', propertyName: 'DDR' });

  assert.equal(linked, true);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /property_id = \?, property_code = \?, property_name = \?, is_active = 1/);
  assert.deepEqual(queries[0].params, [42, 'APT-1', 'DDR', 7]);
});

test('a database without property_name still gets the link', async () => {
  freshState();
  let calls = 0;
  const pool = { execute: async (sql, params) => {
    calls++;
    if (calls === 1) throw new Error("Unknown column 'property_name' in 'field list'");
    queries.push({ sql, params });
    return [{ affectedRows: 1 }];
  } };

  const linked = await linkCustomerToProperty(pool, 7, { propertyId: 42, propertyCode: 'APT-1', propertyName: 'DDR' });

  assert.equal(linked, true);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /property_id = \?, property_code = \?, is_active = 1/);
  assert.doesNotMatch(queries[0].sql, /property_name/);
});

test('a link failure returns false, never throws', async () => {
  freshState();
  const pool = { execute: async () => { throw new Error('deadlock'); } };
  assert.equal(await linkCustomerToProperty(pool, 7, { propertyId: 42 }), false);
});

test('notifyPropertyAdded passes the fields through and returns the send flag', async () => {
  freshState();
  assert.equal(await notifyPropertyAdded({ email: 'c@x.test', firstName: 'C', propertyName: 'DDR', propertyCode: 'APT-1' }), true);
  assert.deepEqual(sendCalls, [{ email: 'c@x.test', firstName: 'C', propertyName: 'DDR', propertyCode: 'APT-1' }]);

  sendResult = { success: false, error: 'rejected' };
  assert.equal(await notifyPropertyAdded({ email: 'c@x.test' }), false);

  sendThrows = true;
  assert.equal(await notifyPropertyAdded({ email: 'c@x.test' }), false);
});
