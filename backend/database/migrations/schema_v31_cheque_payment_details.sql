-- Migration: schema_v31 - cheque payment details on payments
--
-- A cheque carries more than a number: the bank and branch it is drawn on, the
-- payee it is made out to, the date written on it, and where it was collected.
-- Those were captured in the form but had nowhere to go: routes/payments.js
-- squeezed the cheque number into transaction_reference and concatenated the
-- rest into the free-text remarks column, so no cheque field could be read back
-- or searched. These columns give each one a home.
--
-- bank_name already existed on live deployments only because
-- POST /api/payments/record runs an ad-hoc ALTER at request time; it is
-- declared here so a database built from the repository has it too.
--
-- transaction_id is written by PUT /api/payments/:id/verify (it is where the
-- verified cheque number lands) but was created by no schema file, so verifying
-- a payment failed with "Unknown column 'transaction_id'".
--
-- payment_location applies to cash as well: both are collected either at the
-- office or at the property site.
--
-- Safe to re-run: information_schema is checked first.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS" (the syntax used by schema_v20_entity_linkage.sql).

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

-- The cheque itself
CALL xland_add_column_if_missing('payments', 'cheque_number', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('payments', 'cheque_date',   'DATE NULL');
CALL xland_add_column_if_missing('payments', 'bank_name',     'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('payments', 'branch_name',   'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('payments', 'payee_name',    'VARCHAR(255) NULL');

-- Where the cheque or cash was collected: 'office' or 'property_site'
CALL xland_add_column_if_missing('payments', 'payment_location', 'VARCHAR(30) NULL');

-- Written by the verification route for every offline method
CALL xland_add_column_if_missing('payments', 'transaction_id', 'VARCHAR(100) NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
