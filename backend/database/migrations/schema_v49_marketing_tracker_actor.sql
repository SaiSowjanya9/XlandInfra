-- Migration: schema_v49 - who last changed a marketing tracker row
--
--   tracker_updated_by       the person's name, as the portal shows it
--   tracker_updated_by_role  their role, so "Bhavani" is distinguishable from another Bhavani
--                            at a franchise
--   tracker_updated_at       when that change was made
--
-- The tracker is edited inline, cell by cell, by several people across three portals (FP, admin
-- and the Ops Manager portal), so a row that changed under somebody could not be traced to
-- anyone. These are written by the server from the caller's token on every tracker write --
-- the field edit and both archive actions -- and never taken from the request body, which would
-- make them worthless as a record of who did what.
--
-- fp_estimates.updated_at is NOT this: it is the estimate's own column and moves for reasons that
-- have nothing to do with the tracker (status changes, a re-send), so the tracker keeps its own
-- timestamp beside its own name.
--
-- The name is stored, not a user id, for the same reason created_by_name is: the three portals
-- authenticate against different tables (users, franchise_partners, fp_employees), so there is no
-- single id to point at, and a row must still name its editor after that account is removed.
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/routes/marketing.js also adds these columns at runtime
-- (ensureMarketingTrackerColumns), so applying this file by hand is optional but keeps the
-- schema explicit.

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

CALL xland_add_column_if_missing('fp_estimates', 'tracker_updated_by', 'VARCHAR(150) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'tracker_updated_by_role', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'tracker_updated_at', 'TIMESTAMP NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
