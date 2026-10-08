-- Migration: schema_v42 - marketing tracker columns on fp_estimates
--
-- The FP portal's Marketing > Tracker screen attaches lead-tracking answers to a direct estimate:
-- lead source, priority, the customer's current maintenance system, whether a proposal was given
-- and the customer's decision. Each of the last three accepts "Other", whose free text needs its
-- own column so the option list stays a fixed set. tracked_at marks the row as tracked: the
-- tracker list reads it, and the "New" picker can tell an untouched estimate from a saved one.
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/routes/franchisePartner.js also adds these columns at
-- runtime (ensureMarketingTrackerColumns), so applying this file by hand is optional but keeps
-- the schema explicit.

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

CALL xland_add_column_if_missing('fp_estimates', 'lead_source', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'priority', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'maintenance_system', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'maintenance_system_other', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'proposal_given', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'proposal_given_other', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'customer_decision', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'customer_decision_other', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'tracked_at', 'TIMESTAMP NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
