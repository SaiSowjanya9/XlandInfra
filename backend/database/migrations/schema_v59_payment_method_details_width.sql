-- Migration: schema_v59 - payment_history.payment_method_details width
--
-- schema_v22 adds payment_history.payment_method_details as JSON, but on a database where the
-- column was created as a short VARCHAR the Razorpay audit row fails with
-- "Data too long for column 'payment_method_details' at row 1". That row is written inside the
-- payment's own transaction, so the payment was rolled back: the customer paid through the
-- payment link and the invoice stayed unpaid. utils/paymentMethodDetails.js performs the same
-- repair at runtime; this file is for a privileged user.
--
-- IMPORTANT: written for MySQL 8; idempotent via information_schema, safe to re-run.

SET @needs_widen = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'payment_history'
     AND column_name = 'payment_method_details'
     AND data_type IN ('char', 'varchar', 'tinytext')
);

SET @ddl = IF(@needs_widen > 0,
  'ALTER TABLE payment_history MODIFY COLUMN payment_method_details TEXT NULL',
  'SELECT ''payment_method_details already wide enough (or absent)'' AS result');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
