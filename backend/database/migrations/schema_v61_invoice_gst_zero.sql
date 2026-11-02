-- Migration: schema_v61 - an invoice carries no GST
--
-- GST was removed from invoices entirely: the rate is 0 on every invoice, no screen sets one,
-- and no invoice document (screen, PDF, email) prints a GST line. An estimate's GST is the
-- estimate's alone and is never carried over.
--
-- Until now a draft raised from an approved estimate was inserted with `tax_percentage = NULL`
-- -- "an employee has not entered it yet" -- and `POST /invoices/:id/send` refused to send it
-- until they had. Those NULLs are a rate of 0 by another name (their `tax_amount` is 0), so
-- they are normalised to 0.00 and nothing else about the row moves.
--
-- A sent or settled invoice is never rewritten: its `tax_percentage`, `tax_amount` and
-- `total_amount` are what the customer was billed and may already have paid, so changing them
-- would falsify the record and leave the total contradicting the payments against it. Only an
-- unsent, unpaid draft -- which no customer has seen -- is recomputed, because its total would
-- otherwise keep a GST uplift that no screen, PDF or email explains any more. That is the same
-- figure `applyEstimateToDraftInvoice` now writes the next time its estimate is edited.
--
-- MySQL 8 (no "ALTER COLUMN IF"), idempotent, safe to re-run.

-- 1. A blank rate is a rate of zero.
UPDATE invoices
   SET tax_percentage = 0.00
 WHERE tax_percentage IS NULL;

-- 2. Untouched drafts lose the GST they were raised with, total included.
UPDATE invoices i
   SET i.tax_percentage = 0.00,
       i.tax_amount     = 0.00,
       i.total_amount   = i.subtotal - COALESCE(i.discount_amount, 0),
       i.balance_amount = i.subtotal - COALESCE(i.discount_amount, 0),
       i.updated_at     = NOW()
 WHERE (i.status IS NULL OR i.status = 'draft')
   AND i.sent_at IS NULL
   AND COALESCE(i.amount_paid, 0) = 0
   AND i.subtotal > 0
   AND (COALESCE(i.tax_percentage, 0) > 0 OR COALESCE(i.tax_amount, 0) > 0)
   AND NOT EXISTS (
     SELECT 1 FROM payments p
      WHERE p.invoice_id = i.id
        AND p.status IN ('paid', 'completed', 'verification_pending')
   );

-- 3. The column default, in case a deployment missed schema_v39 (it was DEFAULT 18.00 once,
--    which silently taxed any row inserted without a rate).
SET @needs_default := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'tax_percentage'
    AND (COLUMN_DEFAULT IS NULL OR CAST(COLUMN_DEFAULT AS DECIMAL(5,2)) <> 0.00)
);

SET @sql := IF(@needs_default > 0,
  'ALTER TABLE invoices ALTER COLUMN tax_percentage SET DEFAULT 0.00',
  'SELECT "invoices.tax_percentage already defaults to 0.00" AS note');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
