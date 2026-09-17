-- Migration: schema_v33 - widen fp_estimates.estimate_type
--
-- schema_v8 creates fp_estimates.estimate_type as ENUM('property_based','direct'),
-- but application code writes two more values:
--
--   routes/franchisePartner.js      -> 'work_order' (work order estimates)
--   routes/managerServiceCatalog.js -> 'custom'     (catalog / custom estimates)
--
-- On a database with the narrow enum those inserts fail in strict mode with
-- "Data truncated for column 'estimate_type'", so the estimate is never saved.
-- The sibling estimates.estimate_type is a VARCHAR and needs no change.
--
-- Existing deployments may already have a widened column, which is why the live
-- site accepts these values. Safe to re-run: information_schema is checked first
-- and the current nullability and default are preserved.
--
-- IMPORTANT: written for MySQL 8. No DELIMITER / stored procedure is used, so
-- this file can also be applied by a plain statement-at-a-time runner.

SET @col_type = (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fp_estimates' AND COLUMN_NAME = 'estimate_type'
);
SET @is_nullable = (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fp_estimates' AND COLUMN_NAME = 'estimate_type'
);
SET @col_default = (
  SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fp_estimates' AND COLUMN_NAME = 'estimate_type'
);

-- Skip when the table/column is absent, when the column is not an ENUM (already
-- permissive), or when both missing values are present.
SET @ddl = IF(
  @col_type IS NULL
    OR @col_type NOT LIKE 'enum%'
    OR (@col_type LIKE '%''work_order''%' AND @col_type LIKE '%''custom''%'),
  'DO 0',
  CONCAT(
    'ALTER TABLE fp_estimates MODIFY COLUMN estimate_type ',
    'ENUM(''property_based'',''direct'',''work_order'',''custom'') ',
    IF(@is_nullable = 'YES', 'NULL', 'NOT NULL'),
    IF(@col_default IS NULL, '', CONCAT(' DEFAULT ''', @col_default, ''''))
  )
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
