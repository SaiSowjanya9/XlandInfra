-- Migration: schema_v53 - invoices.paid_at (and the archive columns)
--
-- `invoices.paid_at` is written whenever a payment completes but was never created by any
-- schema file: not by schema_v17's CREATE TABLE, not by v18/v21/v22's ALTERs, and not by
-- v46's drift repair. Unlike the usual drift this was missing on every deployment, so both
-- writers failed with "Unknown column 'paid_at' in 'field list'":
--
--   PUT /api/payments/:id/verify       -> the payment was marked paid but its invoice kept the
--      (every staff portal's Payments      old amount_paid/balance/status; scheduling and the
--       screen: admin, FP, manager,        receipt email sit after the invoice update and so
--       coordinator, supervisor,          never ran.
--       executive)
--   recordRazorpayPayment()            -> runs inside the payment's own transaction, so the
--      (customer portal verify-payment,    error rolled the payment back entirely: the customer
--       payment_link.paid /                paid, Razorpay confirmed it, and nothing was recorded.
--       payment.captured webhooks,
--       /payment/success callback)
--
-- `archived` / `archived_at` are the same story with a smaller blast radius: the invoice
-- archive and restore routes carried a bare `ALTER TABLE invoices ADD COLUMN ...` in a
-- try/catch, so every archive request ran a DDL statement that was expected to fail. They are
-- declared here and the routes now go through utils/invoiceColumns.js instead.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". Idempotency is achieved by checking information_schema
-- before each ALTER, so this file is safe to re-run.

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

-- When the invoice was first settled in full. Written as
-- `paid_at = IF(? = 'paid', IFNULL(paid_at, NOW()), paid_at)`, i.e. the first full settlement
-- wins and a later part payment never moves it.
CALL xland_add_column_if_missing('invoices', 'paid_at', 'DATETIME NULL');

-- Soft delete, previously ALTERed in from the archive route on every request
CALL xland_add_column_if_missing('invoices', 'archived',    'TINYINT(1) DEFAULT 0');
CALL xland_add_column_if_missing('invoices', 'archived_at', 'TIMESTAMP NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
