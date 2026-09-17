const { test } = require('node:test');
const assert = require('node:assert/strict');
const { propertyBelongsToFp } = require('./fpProperties');

const poolFor = (owned, missing = []) => ({
  queries: [],
  async execute(sql, params) {
    const table = sql.match(/FROM (\w+)/)[1];
    this.queries.push(table);
    if (missing.includes(table)) throw Object.assign(new Error(`Table '${table}' doesn't exist`), { code: 'ER_NO_SUCH_TABLE' });
    return [owned.filter(row => row.table === table && row.id === params[0] && row.fp === params[1]).map(row => ({ id: row.id }))];
  }
});

test('an FP estimate may only reference a property from its own scope', async () => {
  const owned = [{ table: 'properties', id: 11, fp: 8 }, { table: 'onboarded_properties', id: 12, fp: 8 }];
  const regular = poolFor(owned);
  assert.equal(await propertyBelongsToFp(regular, 11, 8), true);
  assert.deepEqual(regular.queries, ['properties'], 'a match in the first source short-circuits');
  const onboarded = poolFor(owned);
  assert.equal(await propertyBelongsToFp(onboarded, 12, 8), true, 'onboarded properties count as owned');
  assert.deepEqual(onboarded.queries, ['properties', 'onboarded_properties'], 'both sources are consulted');
  const foreign = poolFor(owned);
  assert.equal(await propertyBelongsToFp(foreign, 11, 9), false, 'another FP cannot borrow the property');
  assert.equal(await propertyBelongsToFp(foreign, 99, 8), false, 'unknown properties are rejected');
});

test('invalid identifiers are rejected without querying the database', async () => {
  const pool = poolFor([]);
  for (const [propertyId, fpId] of [[null, 8], [0, 8], ['abc', 8], [1.5, 8], [11, null], [11, 0], [11, 'all']]) {
    assert.equal(await propertyBelongsToFp(pool, propertyId, fpId), false);
  }
  assert.deepEqual(pool.queries, []);
});

test('a deployment missing both property tables still saves estimates', async () => {
  const bothMissing = poolFor([], ['properties', 'onboarded_properties']);
  assert.equal(await propertyBelongsToFp(bothMissing, 11, 8), true, 'an unverifiable property is not treated as foreign');
  const oneMissing = poolFor([{ table: 'onboarded_properties', id: 12, fp: 8 }], ['properties']);
  assert.equal(await propertyBelongsToFp(oneMissing, 12, 8), true);
  assert.equal(await propertyBelongsToFp(oneMissing, 13, 8), false, 'the surviving table is still enforced');
});
