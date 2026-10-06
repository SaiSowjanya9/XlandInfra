const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensurePortalNotificationsSchema } = require('./portalNotificationsSchema');

// The VPS's portal_notifications predates role_type, which every customer notifications read
// filters on ("Unknown column 'pn.role_type' in 'where clause'"). Startup adds what is missing.
const fakePool = columns => {
  const statements = [];
  return {
    statements,
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('information_schema.COLUMNS')) return [columns.map(([COLUMN_NAME, DATA_TYPE]) => ({ COLUMN_NAME, DATA_TYPE }))];
      if (sql.includes('information_schema.STATISTICS')) return [[]];
      return [[]];
    }
  };
};

test('a table without role_type gains it, its index and the other columns the code uses', async () => {
  const pool = fakePool([['id', 'int'], ['notification_id', 'varchar'], ['type', 'varchar'], ['title', 'varchar'], ['reference_type', 'varchar'], ['reference_id', 'int']]);
  const added = await ensurePortalNotificationsSchema(pool);
  assert.ok(added.includes('role_type'));
  assert.ok(added.includes('recipient_roles') && added.includes('vendor_id') && added.includes('is_read'));
  assert.ok(pool.statements.some(sql => /ADD COLUMN `role_type` VARCHAR\(20\) NULL/.test(sql)));
  assert.ok(pool.statements.some(sql => /ADD INDEX idx_pn_role/.test(sql)));
  assert.ok(!pool.statements.some(sql => /IF NOT EXISTS/.test(sql) && /ALTER/.test(sql)), 'no MariaDB-only ALTER syntax');
});

test('an up-to-date table is left alone, and v22\'s ENUM role_type is widened to take customer', async () => {
  const all = ['user_id', 'franchise_partner_id', 'role_type', 'reference_type', 'reference_id', 'reference_data', 'action_url', 'action_label',
    'is_read', 'read_at', 'is_dismissed', 'dismissed_at', 'priority', 'recipient_roles', 'vendor_id', 'expires_at'];
  const current = fakePool(all.map(name => [name, 'varchar']));
  assert.deepEqual(await ensurePortalNotificationsSchema(current), []);
  assert.ok(!current.statements.some(sql => /^ALTER/.test(sql)));
  const enumTable = fakePool(all.map(name => [name, name === 'role_type' ? 'enum' : 'varchar']));
  assert.deepEqual(await ensurePortalNotificationsSchema(enumTable), ['role_type (widened)']);
  assert.ok(enumTable.statements.some(sql => /MODIFY COLUMN role_type VARCHAR\(20\) NULL/.test(sql)));
});
