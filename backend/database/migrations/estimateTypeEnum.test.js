const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * schema_v33 widens fp_estimates.estimate_type so 'work_order' and 'custom' can be
 * saved. It is checked against a scratch table rather than fp_estimates itself, so
 * the real table is never altered by the test run.
 */
const MIGRATION = path.join(__dirname, 'schema_v33_fp_estimate_type_enum.sql');

// The file targets fp_estimates by name; point it at a throwaway copy instead.
const statementsFor = table =>
  fs.readFileSync(MIGRATION, 'utf8')
    .replace(/fp_estimates/g, table)
    .split(';')
    .map(statement => statement.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);

test('the estimate_type migration widens narrow enums, is idempotent and preserves column settings', { skip: process.env.RUN_LOCAL_MYSQL_TESTS !== '1' }, async () => {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.equal(process.env.LOCAL_DB_NAME, 'customer_portal_local');
  const connection = await require('mysql2/promise').createConnection({
    host: process.env.LOCAL_DB_HOST, port: process.env.LOCAL_DB_PORT || 3306,
    user: process.env.LOCAL_DB_USER, password: process.env.LOCAL_DB_PASSWORD, database: process.env.LOCAL_DB_NAME
  });
  const table = `tmp_estimate_type_${Date.now()}`;
  const columnType = async () => {
    const [[row]] = await connection.execute(
      'SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, 'estimate_type']
    );
    return row;
  };
  const apply = async () => {
    for (const statement of statementsFor(table)) await connection.query(statement);
  };

  try {
    await connection.query(`CREATE TABLE ${table} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      estimate_type ENUM('property_based','direct') NULL DEFAULT 'property_based'
    )`);
    await connection.query(`INSERT INTO ${table} (estimate_type) VALUES ('direct'), ('property_based')`);

    await apply();
    const widened = await columnType();
    assert.equal(widened.COLUMN_TYPE, "enum('property_based','direct','work_order','custom')");
    assert.equal(widened.IS_NULLABLE, 'YES');
    assert.equal(widened.COLUMN_DEFAULT, 'property_based');

    // Existing rows keep their values and the new ones are now accepted
    await connection.query(`INSERT INTO ${table} (estimate_type) VALUES ('work_order'), ('custom')`);
    const [rows] = await connection.query(`SELECT estimate_type FROM ${table} ORDER BY id`);
    assert.deepEqual(rows.map(row => row.estimate_type), ['direct', 'property_based', 'work_order', 'custom']);

    // Re-running changes nothing
    await apply();
    assert.deepEqual(await columnType(), widened);

    // A NOT NULL column without a default keeps those settings
    await connection.query(`DELETE FROM ${table} WHERE estimate_type IN ('work_order','custom')`);
    await connection.query(`ALTER TABLE ${table} MODIFY COLUMN estimate_type ENUM('property_based','direct') NOT NULL`);
    await apply();
    const strict = await columnType();
    assert.equal(strict.COLUMN_TYPE, "enum('property_based','direct','work_order','custom')");
    assert.equal(strict.IS_NULLABLE, 'NO');
    assert.equal(strict.COLUMN_DEFAULT, null);

    // A column that is already permissive is left alone
    await connection.query(`ALTER TABLE ${table} MODIFY COLUMN estimate_type VARCHAR(30) NULL`);
    await apply();
    assert.equal((await columnType()).COLUMN_TYPE, 'varchar(30)');
  } finally {
    await connection.query(`DROP TABLE IF EXISTS ${table}`);
    await connection.end();
  }
});
