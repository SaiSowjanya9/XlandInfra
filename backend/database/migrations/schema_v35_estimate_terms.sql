-- Migration: schema_v35 - Terms & Conditions on an estimate
--
-- An estimate now records whether its creator chose to include Terms &
-- Conditions, and the text they were shown when they made that choice. The
-- text is stored rather than only a flag so a sent estimate keeps reading
-- exactly as the customer received it after the default wording changes.
--
-- include_terms is NULL by default on purpose: an estimate created before this
-- feature recorded no choice and was never sent with any terms, so it must not
-- start printing them. Every new estimate writes 1 or 0 explicitly.
--
-- Both estimate tables are covered: fp_estimates (every portal's create) and
-- estimates (the sync/direct table used by /api/estimates-sync).
--
-- Safe to re-run: information_schema is checked first.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS".

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

CALL xland_add_column_if_missing('fp_estimates', 'include_terms', 'TINYINT(1) NULL DEFAULT NULL');
CALL xland_add_column_if_missing('fp_estimates', 'terms_conditions', 'TEXT NULL');
CALL xland_add_column_if_missing('estimates', 'include_terms', 'TINYINT(1) NULL DEFAULT NULL');
CALL xland_add_column_if_missing('estimates', 'terms_conditions', 'TEXT NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
