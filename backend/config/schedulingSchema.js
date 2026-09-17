const fs = require('node:fs');
const path = require('node:path');

const migrations = [
  ['schema_v23_schedule_series_occurrences.sql', [
    'schedule_series', 'schedule_occurrences', 'schedule_series_history',
    'schedule_occurrence_history', 'vendor_zone_schedule'
  ]],
  ['schema_v28_auto_renewal.sql', [
    'schedule_renewals', 'schedule_renewal_history', 'property_renewal_settings'
  ]]
];

const renewalColumns = {
  auto_renewal_enabled: 'BOOLEAN DEFAULT TRUE',
  renewal_notice_days: 'INT DEFAULT 30',
  renewal_status: "ENUM('not_applicable', 'pending', 'approved', 'declined', 'renewed') DEFAULT 'not_applicable'",
  renewal_notice_sent_at: 'TIMESTAMP NULL',
  renewed_from_series_id: 'INT NULL',
  renewed_to_series_id: 'INT NULL',
  renewal_approved_by: 'INT NULL',
  renewal_approved_at: 'TIMESTAMP NULL',
  renewal_declined_reason: 'TEXT NULL'
};

const renewalIndexes = {
  idx_ss_renewal_status: '(renewal_status)',
  idx_ss_auto_renewal: '(auto_renewal_enabled, contract_end_date)'
};

async function initSchedulingSchema(pool) {
  const statements = migrations.flatMap(([file, tables]) => {
    const sql = fs.readFileSync(path.join(__dirname, '../database/migrations', file), 'utf8');
    return tables.map(table => {
      const statement = sql.match(new RegExp(`^CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?^\\);`, 'm'));
      if (!statement) throw new Error(`Missing CREATE TABLE for ${table} in ${file}`);
      return statement[0];
    });
  });
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK(CONCAT('xland:scheduling:', MD5(DATABASE())), 30) AS acquired");
    if (Number(lock.acquired) !== 1) throw new Error('Could not acquire scheduling schema initialization lock');
    locked = true;
    for (const statement of statements) await connection.query(statement);

    const [columns] = await connection.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['schedule_series']
    );
    const existingColumns = new Set(columns.map(column => column.COLUMN_NAME));
    for (const [name, definition] of Object.entries(renewalColumns)) {
      if (!existingColumns.has(name)) await connection.query(`ALTER TABLE schedule_series ADD COLUMN \`${name}\` ${definition}`);
    }

    const [indexes] = await connection.query(
      'SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['schedule_series']
    );
    const existingIndexes = new Set(indexes.map(index => index.INDEX_NAME));
    for (const [name, definition] of Object.entries(renewalIndexes)) {
      if (!existingIndexes.has(name)) await connection.query(`ALTER TABLE schedule_series ADD INDEX \`${name}\` ${definition}`);
    }
  } finally {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK(CONCAT('xland:scheduling:', MD5(DATABASE())))");
    } finally {
      connection.release();
    }
  }
}

module.exports = { initSchedulingSchema };
