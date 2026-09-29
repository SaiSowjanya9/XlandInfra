const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categoryOptions, addCategory, removeCategory } = require('./serviceCategories');

// One in-memory service_categories table plus the read-only sources a category can also come from
const makePool = ({ rows = [], catalogCategories = [], estimateCategories = [], packageCategories = [] } = {}) => {
  const deleted = [];
  let nextId = Math.max(0, ...rows.map(row => row.id)) + 1;
  const pool = {
    deleted,
    rows,
    execute: async (sql, params = []) => {
      if (sql.includes('FROM admin_categories')) return [[]];
      if (sql.includes('JSON_EXTRACT(configuration')) return [catalogCategories.map(name => ({ name }))];
      if (sql.includes('JSON_TABLE(fp_estimates.addons_data')) return [estimateCategories.map(name => ({ name }))];
      if (sql.includes('JSON_TABLE(fp_amc_packages.services')) return [packageCategories.map(name => ({ name }))];
      if (sql.startsWith('INSERT INTO service_categories')) {
        const [scope, name] = params;
        if (rows.some(row => row.scope_id === scope && row.name.toLowerCase() === String(name).toLowerCase())) {
          throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
        }
        rows.push({ id: nextId, scope_id: scope, name });
        return [{ insertId: nextId++ }];
      }
      if (sql.startsWith('DELETE FROM service_categories')) {
        deleted.push(Number(params[0]));
        const index = rows.findIndex(row => row.id === Number(params[0]));
        if (index >= 0) rows.splice(index, 1);
        return [{ affectedRows: index >= 0 ? 1 : 0 }];
      }
      if (sql.includes('FROM service_categories WHERE id = ?')) return [rows.filter(row => row.id === Number(params[0]))];
      if (sql.includes('FROM service_categories WHERE name = ?')) {
        return [rows.filter(row => row.name.toLowerCase() === String(params[0]).toLowerCase() && row.scope_id === Number(params[1]))];
      }
      if (sql.includes('FROM service_categories WHERE scope_id IN')) {
        return [rows.filter(row => row.scope_id === 0 || row.scope_id === Number(params[0]))];
      }
      if (sql.includes('FROM service_categories')) return [rows];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  return pool;
};
const find = (options, name) => options.find(option => option.name.toLowerCase() === name.toLowerCase());

test('a category saved from the box is listed, and only an unused one carries a cross', async t => {
  await t.test('a name added here is offered straight away and can be deleted again', async () => {
    const pool = makePool();
    const added = await addCategory(pool, 8, '  slab   2 ', 5);
    assert.equal(added.name, 'slab 2', 'the name is trimmed and its inner spacing collapsed');
    assert.equal(added.removable, true);
    const options = await categoryOptions(pool, 8);
    assert.equal(find(options, 'slab 2').id, added.id, 'it is in the same dropdown without saving a service first');
    assert.equal(find(options, 'slab 2').removable, true);
    await removeCategory(pool, 8, added.id);
    assert.deepEqual(pool.deleted, [added.id]);
    assert.equal(find(await categoryOptions(pool, 8), 'slab 2'), undefined, 'a misspelled one leaves the list again');
  });

  await t.test('a built-in category and one already saved elsewhere are offered without a cross', async () => {
    const pool = makePool({ catalogCategories: ['Rope Access'], estimateCategories: ['Facade'], packageCategories: ['Terrace'] });
    const options = await categoryOptions(pool, 8);
    for (const name of ['Generator', 'Rope Access', 'Facade', 'Terrace']) {
      assert.equal(find(options, name).removable, false, `${name} has no row of its own to delete`);
      assert.equal(find(options, name).id, null);
    }
  });

  await t.test('saving a name the list already holds adds nothing and is not an error', async () => {
    const pool = makePool({ catalogCategories: ['Rope Access'] });
    assert.equal((await addCategory(pool, 8, 'generator')).name, 'Generator', 'the built-in spelling wins');
    assert.equal((await addCategory(pool, 8, 'Rope Access')).removable, false);
    assert.equal(pool.rows.length, 0, 'nothing is stored for a category that is already offered');
    const first = await addCategory(pool, 8, 'Slab 2');
    assert.equal((await addCategory(pool, 8, 'slab 2')).id, first.id, 'the same name in another case is the same category');
    assert.equal(pool.rows.length, 1);
  });

  await t.test('a category that something already uses keeps its place and refuses to be deleted', async () => {
    const pool = makePool({ catalogCategories: ['Slab 2'], rows: [{ id: 3, scope_id: 8, name: 'Slab 2' }] });
    const option = find(await categoryOptions(pool, 8), 'Slab 2');
    assert.equal(option.removable, false, 'deleting the row would not take the name out of the dropdown');
    await assert.rejects(() => removeCategory(pool, 8, 3), error => error.status === 409);
    assert.deepEqual(pool.deleted, []);
  });

  await t.test('an FP cannot delete a shared category or one belonging to another franchise', async () => {
    const pool = makePool({ rows: [{ id: 1, scope_id: 0, name: 'Shared' }, { id: 2, scope_id: 9, name: 'Other FP' }] });
    await assert.rejects(() => removeCategory(pool, 8, 1), error => error.status === 403);
    await assert.rejects(() => removeCategory(pool, 8, 2), error => error.status === 403);
    await assert.rejects(() => removeCategory(pool, 8, 404), error => error.status === 404);
    assert.deepEqual(pool.deleted, []);
    // The admin scope governs every FP, so it may remove either of them
    assert.equal((await removeCategory(pool, 0, 2)).name, 'Other FP');
  });

  await t.test('an FP sees the shared categories and its own, never another franchise', async () => {
    const pool = makePool({ rows: [{ id: 1, scope_id: 0, name: 'Shared' }, { id: 2, scope_id: 8, name: 'Mine' }, { id: 3, scope_id: 9, name: 'Theirs' }] });
    const options = await categoryOptions(pool, 8);
    assert.ok(find(options, 'Shared') && find(options, 'Mine'));
    assert.equal(find(options, 'Theirs'), undefined);
    assert.ok(find(await categoryOptions(pool, 0), 'Theirs'), 'the admin scope lists every one of them');
  });

  await t.test('a blank or overlong name is refused before anything is stored', async () => {
    const pool = makePool();
    await assert.rejects(() => addCategory(pool, 8, '   '), error => error.status === 400);
    await assert.rejects(() => addCategory(pool, 8, 'x'.repeat(101)), error => error.status === 400);
    assert.equal(pool.rows.length, 0);
  });
});
