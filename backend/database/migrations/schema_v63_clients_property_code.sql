-- Migration: schema_v63 - clients.property_code
--
-- `clients` was built for the `properties` table and still carries its shape:
--
--   property_id  int  FOREIGN KEY -> properties(id)  ON DELETE SET NULL
--   created_by   int  FOREIGN KEY -> users(id)       ON DELETE SET NULL
--
-- The Manager / Coordinator / Supervisor / Executive Add Customer writes its property to
-- `onboarded_properties`, then wrote that row's id into `property_id` and its own *username*
-- into `created_by`. Both are rejected -- the id fails the foreign key, and the username fails
-- the column's type ("Incorrect integer value: 'test-manager-969675_mvphja5o' for column
-- 'created_by'") -- so the INSERT failed and the surrounding catch retried it with BOTH set to
-- NULL. Nothing surfaced: the request still answered 201 "created successfully".
--
-- The cost was a Customers screen that could never show a row. The reader claims a client on two
-- grounds -- the zone of its joined property, or `created_by` being this user -- and the retry
-- had emptied the columns both grounds read, so neither could ever match. A manager added a
-- customer, was told it had been created, and the list stayed empty for good.
--
-- `property_code` is the fix, for the same reason work_orders got one in schema_v62:
-- `properties.id` 37 and `onboarded_properties.id` 37 are two different communities, so a bare
-- row number cannot name a property, while GC-/APT-/V-/PL-/FL- is unique across both. It carries
-- no foreign key, so it can hold a property from either table.
--
-- backend/utils/clientPropertyLink.js adds this column at write time where it is missing, so a
-- deployment that has not run this file still works; applying it here just does it once, with a
-- privileged user, instead of on the first Add Customer.
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

-- The property's unique code, e.g. GC-1793673531543, from either property table.
CALL xland_add_column_if_missing('clients', 'property_code', 'VARCHAR(50) DEFAULT NULL');

-- Every portal's Customers list joins the property on it
CALL xland_add_index_if_missing('clients', 'idx_clients_property_code', '`property_code`');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
DROP PROCEDURE IF EXISTS xland_add_index_if_missing;
