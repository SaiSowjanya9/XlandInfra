/**
 * Drift repair for `pending_property_schedules`.
 *
 * schema_v22 creates the table with added_at / updated_at / notification_sent /
 * notification_sent_at, but CREATE TABLE IF NOT EXISTS never adds columns to a table
 * that already exists — deployments where the table predates v22 (or was created by
 * an older draft) fail every write with "Unknown column 'added_at' in 'field list'".
 * The scheduling_status ENUM is also missing 'completed' / 'cancelled', which
 * schedules.js writes when a property is cancelled.
 *
 * ensurePendingScheduleSchema() checks information_schema once per process and ALTERs
 * whatever is missing. If the DB user cannot ALTER, it logs the migration to apply
 * instead of breaking the scheduling workflow trigger.
 */
const { pool } = require('../config/database');

const TABLE = 'pending_property_schedules';

// status first: the ENUM needs MODIFY, not ADD COLUMN
const STATUS_ENUM = "ENUM('pending_vendor','pending_schedule','partially_scheduled','fully_scheduled','completed','cancelled') DEFAULT 'pending_vendor'";
const COLUMNS = {
  estimate_id: 'INT NULL',
  total_services: 'INT DEFAULT 0',
  vendors_assigned: 'INT DEFAULT 0',
  services_scheduled: 'INT DEFAULT 0',
  notification_sent: 'TINYINT(1) DEFAULT 0',
  notification_sent_at: 'TIMESTAMP NULL',
  franchise_partner_id: 'INT NULL',
  added_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
  updated_at: 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

const columnExists = async (name) => {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [TABLE, name]
  );
  return rows[0].n > 0;
};

const tableExists = async () => {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [TABLE]
  );
  return rows[0].n > 0;
};

let schemaReadyPromise = null;

const ensurePendingScheduleSchema = () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      try {
        if (!(await tableExists())) {
          await pool.query(`
            CREATE TABLE ${TABLE} (
              id INT AUTO_INCREMENT PRIMARY KEY,
              property_id INT NOT NULL UNIQUE,
              estimate_id INT,
              total_services INT DEFAULT 0,
              vendors_assigned INT DEFAULT 0,
              services_scheduled INT DEFAULT 0,
              scheduling_status ${STATUS_ENUM},
              notification_sent TINYINT(1) DEFAULT 0,
              notification_sent_at TIMESTAMP NULL,
              franchise_partner_id INT,
              added_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_pps_property (property_id),
              INDEX idx_pps_status (scheduling_status),
              INDEX idx_pps_fp (franchise_partner_id)
            )`);
          console.log(`  ✅ Created ${TABLE}`);
          return;
        }

        for (const [name, def] of Object.entries(COLUMNS)) {
          if (!(await columnExists(name))) {
            await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN ${name} ${def}`);
            console.log(`  ✅ Added ${TABLE}.${name}`);
          }
        }

        // The v22 ENUM has no 'cancelled'/'completed'; a cancel writes 'cancelled'
        if (!(await columnExists('scheduling_status'))) {
          await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN scheduling_status ${STATUS_ENUM}`);
          console.log(`  ✅ Added ${TABLE}.scheduling_status`);
        } else {
          const [typeRows] = await pool.execute(
            `SELECT COLUMN_TYPE FROM information_schema.columns
             WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'scheduling_status'`,
            [TABLE]
          );
          if (typeRows[0] && !/cancelled/.test(typeRows[0].COLUMN_TYPE)) {
            await pool.query(`ALTER TABLE ${TABLE} MODIFY COLUMN scheduling_status ${STATUS_ENUM}`);
            console.log(`  ✅ Widened ${TABLE}.scheduling_status (added completed/cancelled)`);
          }
        }
      } catch (err) {
        // Repairing needs ALTER rights, which a production DB user may not have.
        // Surface the migration instead of breaking the scheduling trigger.
        console.log('[Pending Schedules] Schema check could not complete:', err.message);
        console.log('[Pending Schedules] Apply backend/database/migrations/schema_v56_pending_schedules_drift.sql as a privileged user.');
        schemaReadyPromise = null;
      }
    })();
  }
  return schemaReadyPromise;
};

const resetPendingScheduleSchemaCache = () => { schemaReadyPromise = null; };

module.exports = { ensurePendingScheduleSchema, resetPendingScheduleSchemaCache };
