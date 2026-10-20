-- Migration: schema_v52 - the complainant, so a complaint can report back to them
--
--   customer_account_id  the customer_accounts row this complaint belongs to
--   customer_email       their mailbox, stamped when the complaint is filed
--
-- A complaint already knew the contact's name and phone but had no way to reach them: the customer
-- files one from their portal's Contact page and then hears nothing, and a complaint a franchise
-- partner files on a resident's behalf was invisible to that resident entirely. These two columns
-- are what the status emails and the customer portal's own notifications are addressed by.
--
-- The email is stamped at filing rather than looked up each time, for the same reason the assignee's
-- name is: a customer who changes their address later must still receive the updates on a complaint
-- that was already under way. `customer_account_id` is what the customer portal lists "my
-- complaints" by, and what scopes a complaint notification to the one customer it concerns -- a
-- `portal_notifications` row carrying only a franchise partner is visible to *every* customer of
-- that partner (see the customer notifications query in backend/routes/customers.js).
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/utils/marketingComplaints.js also adds these columns at
-- runtime (ensureMarketingComplaintsTable), so applying this file by hand is optional but keeps the
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
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('added index: ', p_table, '.', p_index) AS result;
  END IF;
END $$

DELIMITER ;

CALL xland_add_column_if_missing('fp_marketing_complaints', 'customer_account_id', 'INT NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'customer_email', 'VARCHAR(255) NULL');

-- The customer portal lists its own complaints by this column.
CALL xland_add_index_if_missing('fp_marketing_complaints', 'idx_fp_marketing_complaints_customer', '`customer_account_id`');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
DROP PROCEDURE IF EXISTS xland_add_index_if_missing;
