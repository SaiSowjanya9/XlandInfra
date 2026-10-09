-- Migration: schema_v44 - soft-delete flag for marketing tracker entries
--
-- Deleting a row in Marketing > Tracker must only remove it from the tracker (it lands in the
-- new Marketing > Archived screen and can be restored). It must NOT touch fp_estimates.is_archived,
-- which is the estimate's own archive flag used by All Estimates. tracker_archived_at is set on
-- archive and cleared on restore; the tracker list and New picker both filter on it.
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/routes/franchisePartner.js also adds this column at
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

CALL xland_add_column_if_missing('fp_estimates', 'tracker_archived_at', 'TIMESTAMP NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
