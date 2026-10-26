-- Migration: schema_v60 - payments.invoice_id accepts NULL
--
-- DELETE /api/payments/invoices/:id (and delete-all of archived invoices) detaches an unpaid
-- invoice's pending/failed payment intents with `UPDATE payments SET invoice_id = NULL` so they
-- keep their audit value. schema_v17 declared payments.invoice_id NOT NULL, so that statement
-- failed with ER_BAD_NULL_ERROR and every such delete returned a 500. The backend also relaxes
-- the column at boot (config/database.js); this file is the same repair for a privileged user.
--
-- MySQL 8 has no "MODIFY ... IF"; the information_schema check keeps this safe to re-run.

SET @needs_change = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'payments'
     AND column_name = 'invoice_id' AND is_nullable = 'NO'
);
SET @ddl = IF(@needs_change > 0,
  'ALTER TABLE payments MODIFY COLUMN invoice_id INT NULL',
  'SELECT ''payments.invoice_id already nullable'' AS result');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
