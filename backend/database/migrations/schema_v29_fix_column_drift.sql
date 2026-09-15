-- Migration: schema_v29 - fix column drift
--
-- Adds columns that application code queries but no schema file ever created.
-- Discovered by rebuilding the database from scratch: each of these caused a
-- 500 or a silently empty list.
--
--   /api/estimates                    -> Unknown column 'e.approved_by'
--   /api/admin/all-employees          -> Unknown column 'zone_name'
--   /api/vendors                      -> Unknown column 'ov.created_by_id'
--   estimate expiry/archive cron      -> Unknown column 'sent_at' / 'archived_at'
--   category + subcategory seeding    -> Unknown column 'sort_order'
--
-- Existing deployments most likely already have these columns (added ad-hoc),
-- which is why the live site works. This migration exists so the schema can be
-- rebuilt from the repository alone.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". Idempotency is achieved by checking
-- information_schema before each ALTER, so this file is safe to re-run.

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

DELIMITER ;

-- Category ordering: schema.sql creates these tables without sort_order,
-- but schema_v2.sql seeds rows that include it.
CALL xland_add_column_if_missing('categories',    'sort_order', 'INT DEFAULT 0');
CALL xland_add_column_if_missing('subcategories', 'sort_order', 'INT DEFAULT 0');

-- Estimates lifecycle columns used by routes and the scheduled cleanup tasks
CALL xland_add_column_if_missing('estimates', 'sent_at',     'DATETIME NULL');
CALL xland_add_column_if_missing('estimates', 'archived_at', 'DATETIME NULL');
CALL xland_add_column_if_missing('estimates', 'approved_by', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'approved_at', 'DATETIME NULL');

-- Employee zone assignment reads zone_name directly
CALL xland_add_column_if_missing('fp_employee_zones', 'zone_name', 'VARCHAR(150) NULL');

-- Vendor ownership / portal assignment columns
CALL xland_add_column_if_missing('onboarded_vendors', 'created_by_id',        'INT NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'manager_id',           'INT NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'coordinator_id',       'INT NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'supervisor_id',        'INT NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'executive_id',         'INT NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
