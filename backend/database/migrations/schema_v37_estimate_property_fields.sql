-- Migration: schema_v37 - property detail columns on the admin estimates table
--
-- The Super Admin create-estimate form asks for a city, a tower/building, a
-- block number, a villa/flat/plot number and a unit count, and its view modal
-- has rows for all of them. The `estimates` table has none of those columns,
-- so routes/estimatesSync.js could not store them and every one of those rows
-- read blank, however carefully the form was filled in.
--
-- fp_estimates already carries the same set, which is why the FP, Manager,
-- Coordinator, Supervisor and Executive portals keep these details; this puts
-- the admin table on the same footing, with the same column names.
--
-- Safe to re-run: information_schema is checked before each ALTER.
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

CALL xland_add_column_if_missing('estimates', 'city', 'VARCHAR(100) NULL');
-- Apartment
CALL xland_add_column_if_missing('estimates', 'tower_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('estimates', 'block_number', 'VARCHAR(100) NULL');
-- Villa, Flat and Plot all identify their unit through this one column
CALL xland_add_column_if_missing('estimates', 'villa_plot_number', 'VARCHAR(100) NULL');
-- Gated community
CALL xland_add_column_if_missing('estimates', 'number_of_blocks', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'block_names', 'JSON NULL');
CALL xland_add_column_if_missing('estimates', 'units_per_block', 'JSON NULL');
CALL xland_add_column_if_missing('estimates', 'total_units', 'INT NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
