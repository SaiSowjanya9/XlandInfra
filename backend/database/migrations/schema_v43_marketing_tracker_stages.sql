-- Migration: schema_v43 - marketing tracker follow-up workflow columns on fp_estimates
--
-- Second tracker batch: the manual pipeline stage (tracker_status, one of the Not Started ->
-- Approved/Rejected stages), coordinator review flag (Yes/No), the follow-up step
-- (Step 1 - Thank You .. Step 5B - Customer Visit, Closed) and the coordinator's name.
-- Approved/Rejected are still driven by the estimate's own `status`; tracker_status stores the
-- stages in between that the FP sets by hand.
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

CALL xland_add_column_if_missing('fp_estimates', 'tracker_status', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'coordinator_reviewed', 'VARCHAR(10) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'follow_up_stage', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'coordinator_name', 'VARCHAR(255) NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
