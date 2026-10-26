-- Migration: schema_v58 - fp_addons column drift
--
-- schema_v8 created fp_addons as (addon_code NOT NULL, name NOT NULL, price, unit, ...), but every
-- reader and writer (GET/POST/PUT /api/fp/addons, PUT /api/admin/fp-addons/:id) uses
-- property_type, service_name, frequency_count, frequency_type and billing_cycle -- columns
-- nothing created. On such a database the FP Add-ons screen failed with
-- "Unknown column 'property_type' in 'field list'", and creating an add-on could never succeed
-- because the insert supplies neither addon_code nor name.
--
-- IMPORTANT: written for MySQL 8 (no "ADD COLUMN IF NOT EXISTS"); idempotency comes from
-- information_schema checks, so this file is safe to re-run.

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

DROP PROCEDURE IF EXISTS xland_make_nullable $$
CREATE PROCEDURE xland_make_nullable(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = p_table
                AND column_name = p_column AND is_nullable = 'NO') THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` MODIFY COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('nullable: ', p_table, '.', p_column) AS result;
  END IF;
END $$

DELIMITER ;

CALL xland_add_column_if_missing('fp_addons', 'property_type', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('fp_addons', 'service_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_addons', 'frequency_count', 'INT DEFAULT 1');
CALL xland_add_column_if_missing('fp_addons', 'frequency_type', "VARCHAR(50) DEFAULT 'Monthly'");
CALL xland_add_column_if_missing('fp_addons', 'billing_cycle', "VARCHAR(50) DEFAULT 'Monthly'");

-- The legacy columns are never supplied by the current insert
CALL xland_make_nullable('fp_addons', 'addon_code', 'VARCHAR(50) NULL');
CALL xland_make_nullable('fp_addons', 'name', 'VARCHAR(255) NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
DROP PROCEDURE IF EXISTS xland_make_nullable;
