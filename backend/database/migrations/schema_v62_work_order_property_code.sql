-- Migration: schema_v62 - work_orders.property_code
--
-- `work_orders.property_id` is a VARCHAR holding a bare row number, and there are two live
-- property tables whose numbers are independent:
--
--   properties             <- the FP portal's Add Customer
--   onboarded_properties   <- Manager / Coordinator / Supervisor / Executive Add Customer,
--                             and the admin portal's onboarding
--
-- schema_v28 copied `properties.id` into `onboarded_properties.id` deliberately, so the two
-- id spaces overlap and have been diverging ever since. `properties.id` 37 and
-- `onboarded_properties.id` 37 are two different communities, and nothing in a work order
-- row says which one its "37" meant.
--
-- The customer portal matches work orders on that number (`customerWorkOrderScope` in
-- routes/customers.js), so a newly added FP customer was shown the work orders of whichever
-- other community shared its row number -- another household's descriptions and entry
-- notes, and wrong Total/Pending/Completed counts on their dashboard. Invoices never had
-- this problem: `invoices` carries `property_code` beside `property_id` and
-- `customerInvoiceScope` refuses a numeric match that names a different code.
--
-- This adds the same second identifier to work orders. The code (GC-/APT-/V-/PL-/FL-) is
-- unique across both tables; the number is not.
--
-- After applying, fill in existing rows:
--   node backend/scripts/backfill-work-order-property-codes.js          (dry run)
--   node backend/scripts/backfill-work-order-property-codes.js --apply
--
-- A row with no code still matches on the number alone, so nothing disappears from a
-- customer's history between this migration and the backfill.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS" / "CREATE INDEX IF NOT EXISTS". Idempotency is achieved by
-- checking information_schema first, so this file is safe to re-run.

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

DROP PROCEDURE IF EXISTS xland_add_index_if_missing $$
CREATE PROCEDURE xland_add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  DECLARE idx_count INT DEFAULT 0;

  SELECT COUNT(*) INTO idx_count
    FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index;

  IF idx_count = 0 THEN
    SET @ddl = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('added index: ', p_table, '.', p_index) AS result;
  END IF;
END $$

DELIMITER ;

-- The property's unique code, e.g. GC-1793673531543. Set by every work order writer through
-- utils/workOrderPropertyCode.js; NULL only where the writer's property number existed in
-- both tables under different codes, which the backfill reports rather than guesses.
CALL xland_add_column_if_missing('work_orders', 'property_code', 'VARCHAR(50) DEFAULT NULL');

-- The customer portal filters on it on every dashboard load
CALL xland_add_index_if_missing('work_orders', 'idx_work_orders_property_code', '`property_code`');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
DROP PROCEDURE IF EXISTS xland_add_index_if_missing;
