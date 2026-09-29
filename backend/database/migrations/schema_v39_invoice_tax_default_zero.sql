-- GST is whatever was set on the document; nothing set means none.
--
-- `invoices.tax_percentage` was created DEFAULT 18.00 while `fp_estimates.gst_percent` and the
-- other estimate tables are DEFAULT 0.00, and `calculateInvoiceAmounts` applied a hardcoded 18
-- regardless of what the estimate said. An estimate quoted, sent and approved at 0% GST was
-- therefore invoiced at 18%: the customer agreed to one figure and was billed another. The service
-- now passes the estimate's own rate, and this brings the column's default in line so a row
-- inserted without one is not silently taxed.
--
-- Existing invoices are left exactly as they are. Their tax_percentage is what was charged and
-- possibly already paid; rewriting it would falsify records. Only the default for future rows moves.
--
-- MySQL 8 has no `ALTER COLUMN IF`, and re-running an ALTER on an already-correct column is
-- harmless but noisy, so the change is made conditional through information_schema.
SET @needs_change := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'tax_percentage'
    AND (COLUMN_DEFAULT IS NULL OR CAST(COLUMN_DEFAULT AS DECIMAL(5,2)) <> 0.00)
);

SET @sql := IF(@needs_change > 0,
  'ALTER TABLE invoices ALTER COLUMN tax_percentage SET DEFAULT 0.00',
  'SELECT "invoices.tax_percentage already defaults to 0.00" AS note');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
