// The in-portal notifications table, brought up to the shape the code reads and writes.
//
// `portal_notifications` was created on the VPS by an earlier version than
// `schema_v22_property_scheduling.sql`, without `role_type` -- and every customer notification read
// filters on it, so the customer dashboard's notifications failed on every request with
// "Unknown column 'pn.role_type' in 'where clause'". The writers have also drifted: the scheduling
// workflow stores `recipient_roles` and `vendor_id`, the rest `role_type`. Checked against
// information_schema rather than with `ADD COLUMN IF NOT EXISTS`, which MySQL 8 does not support.
//
// role_type is a VARCHAR, not v22's ENUM: that ENUM had no 'customer', so the customer filter could
// never match a row. An existing ENUM is widened to a VARCHAR, which keeps every value it holds.
const CREATE = `CREATE TABLE IF NOT EXISTS portal_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INT,
  franchise_partner_id INT,
  role_type VARCHAR(20) NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50),
  reference_id INT,
  reference_data JSON,
  action_url VARCHAR(255),
  action_label VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  recipient_roles JSON NULL,
  vendor_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  INDEX idx_pn_user (user_id),
  INDEX idx_pn_fp (franchise_partner_id),
  INDEX idx_pn_role (role_type),
  INDEX idx_pn_created (created_at)
)`;

// Every column a reader or writer uses, with the definition to add it by when it is missing
const COLUMNS = {
  user_id: 'INT NULL',
  franchise_partner_id: 'INT NULL',
  role_type: 'VARCHAR(20) NULL',
  reference_type: 'VARCHAR(50) NULL',
  reference_id: 'INT NULL',
  reference_data: 'JSON NULL',
  action_url: 'VARCHAR(255) NULL',
  action_label: 'VARCHAR(50) NULL',
  is_read: 'BOOLEAN DEFAULT FALSE',
  read_at: 'TIMESTAMP NULL',
  is_dismissed: 'BOOLEAN DEFAULT FALSE',
  dismissed_at: 'TIMESTAMP NULL',
  priority: "VARCHAR(20) DEFAULT 'normal'",
  recipient_roles: 'JSON NULL',
  vendor_id: 'INT NULL',
  expires_at: 'TIMESTAMP NULL'
};

const ensurePortalNotificationsSchema = async pool => {
  await pool.query(CREATE);
  const [columns] = await pool.query(
    'SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['portal_notifications']);
  const existing = new Map(columns.map(column => [column.COLUMN_NAME, String(column.DATA_TYPE).toLowerCase()]));
  const added = [];
  for (const [name, definition] of Object.entries(COLUMNS)) {
    if (!existing.has(name)) {
      await pool.query(`ALTER TABLE portal_notifications ADD COLUMN \`${name}\` ${definition}`);
      added.push(name);
    }
  }
  // v22's ENUM has no 'customer'; a VARCHAR holds every value the ENUM did, and 'customer' too
  if (existing.get('role_type') === 'enum') {
    await pool.query('ALTER TABLE portal_notifications MODIFY COLUMN role_type VARCHAR(20) NULL');
    added.push('role_type (widened)');
  }
  if (added.includes('role_type')) {
    const [indexes] = await pool.query(
      "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portal_notifications' AND INDEX_NAME = 'idx_pn_role'");
    if (!indexes.length) await pool.query('ALTER TABLE portal_notifications ADD INDEX idx_pn_role (role_type)');
  }
  return added;
};

module.exports = { ensurePortalNotificationsSchema };
