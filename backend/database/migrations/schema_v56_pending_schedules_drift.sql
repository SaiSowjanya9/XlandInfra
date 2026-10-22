-- Migration: schema_v56 - pending_property_schedules column drift
--
-- schema_v22 creates pending_property_schedules with added_at / updated_at /
-- notification_sent / notification_sent_at, but CREATE TABLE IF NOT EXISTS never adds
-- columns to a table that already exists. Deployments where the table predates that
-- shape fail every write with:
--
--   ER_BAD_FIELD_ERROR: Unknown column 'added_at' in 'field list'
--
-- which rolls back markPaymentCompleted() — the payment stays verified, but the
-- property never enters the scheduling pipeline and the manager notification is lost.
-- The scheduling_status ENUM also lacks 'completed' / 'cancelled', which the property
-- cancellation route writes.
--
-- utils/pendingScheduleColumns.js performs the same repair at runtime when the app's
-- DB user has ALTER rights; this file is for applying it as a privileged user.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". Idempotency is achieved by checking information_schema
-- before each ALTER, so this file is safe to re-run.

DELIMITER $$

DROP PROCEDURE IF EXISTS xland_add_column_if_missing $$
CREATE PROCEDURE xland_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  DECLARE col_count INT DEFAULT 0;
  DECLARE tbl_count INT DEFAULT 0;

  SELECT COUNT(*) INTO tbl_count
    FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = p_table;

  IF tbl_count = 0 THEN
    SELECT CONCAT('skip (no table): ', p_table) AS result;
  ELSE
    SELECT COUNT(*) INTO col_count
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = p_table
       AND column_name = p_column;

    IF col_count = 0 THEN
      SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
      PREPARE stmt FROM @ddl;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
      SELECT CONCAT('added: ', p_table, '.', p_column) AS result;
    END IF;
  END IF;
END $$

CREATE TABLE IF NOT EXISTS pending_property_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL UNIQUE,
  estimate_id INT,
  total_services INT DEFAULT 0,
  vendors_assigned INT DEFAULT 0,
  services_scheduled INT DEFAULT 0,
  scheduling_status ENUM('pending_vendor','pending_schedule','partially_scheduled','fully_scheduled','completed','cancelled') DEFAULT 'pending_vendor',
  notification_sent TINYINT(1) DEFAULT 0,
  notification_sent_at TIMESTAMP NULL,
  franchise_partner_id INT,
  added_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pps_property (property_id),
  INDEX idx_pps_status (scheduling_status),
  INDEX idx_pps_fp (franchise_partner_id)
);

CALL xland_add_column_if_missing('pending_property_schedules', 'estimate_id',           'INT NULL');
CALL xland_add_column_if_missing('pending_property_schedules', 'total_services',        'INT DEFAULT 0');
CALL xland_add_column_if_missing('pending_property_schedules', 'vendors_assigned',      'INT DEFAULT 0');
CALL xland_add_column_if_missing('pending_property_schedules', 'services_scheduled',    'INT DEFAULT 0');
CALL xland_add_column_if_missing('pending_property_schedules', 'notification_sent',     'TINYINT(1) DEFAULT 0');
CALL xland_add_column_if_missing('pending_property_schedules', 'notification_sent_at',  'TIMESTAMP NULL');
CALL xland_add_column_if_missing('pending_property_schedules', 'franchise_partner_id',  'INT NULL');
CALL xland_add_column_if_missing('pending_property_schedules', 'added_at',              'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
CALL xland_add_column_if_missing('pending_property_schedules', 'updated_at',            'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

-- The v22 ENUM has no 'completed'/'cancelled' members; widen only if missing
DROP PROCEDURE IF EXISTS xland_widen_pps_status $$
CREATE PROCEDURE xland_widen_pps_status()
BEGIN
  DECLARE col_type TEXT;
  DECLARE col_count INT DEFAULT 0;

  SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'pending_property_schedules'
     AND column_name = 'scheduling_status';

  IF col_count = 0 THEN
    ALTER TABLE pending_property_schedules
      ADD COLUMN scheduling_status
      ENUM('pending_vendor','pending_schedule','partially_scheduled','fully_scheduled','completed','cancelled')
      DEFAULT 'pending_vendor';
    SELECT 'added: pending_property_schedules.scheduling_status' AS result;
  ELSE
    SELECT COLUMN_TYPE INTO col_type
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'pending_property_schedules'
       AND column_name = 'scheduling_status';

    IF col_type NOT LIKE '%cancelled%' THEN
      ALTER TABLE pending_property_schedules
        MODIFY COLUMN scheduling_status
        ENUM('pending_vendor','pending_schedule','partially_scheduled','fully_scheduled','completed','cancelled')
        DEFAULT 'pending_vendor';
      SELECT 'widened: pending_property_schedules.scheduling_status' AS result;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL xland_widen_pps_status();

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
DROP PROCEDURE IF EXISTS xland_widen_pps_status;
