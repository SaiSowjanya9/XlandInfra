-- Migration: schema_v36 - one payment row per Razorpay payment
--
-- A paid payment link is announced three ways: the `payment_link.paid` webhook, the
-- `payment.captured` webhook, and the customer's redirect to /payment/success. They can
-- arrive at the same moment, so checking "have we recorded this yet?" in application code
-- is not enough on its own -- two requests can both read "no" before either writes.
-- This index is what makes recordRazorpayPayment() safe: the loser gets ER_DUP_ENTRY and
-- returns the row the winner wrote.
--
-- UNIQUE permits any number of NULLs in MySQL, so the manual payments (cash, cheque, bank
-- transfer), which have no razorpay_payment_id, are unaffected.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "CREATE INDEX IF NOT EXISTS". Idempotency comes from checking information_schema, and
-- the index is skipped (not failed) if duplicates already exist, so this is safe to re-run
-- and safe to apply to a database that recorded a payment twice before the fix.

SET @duplicate_razorpay_payments = (
  SELECT COUNT(*) FROM (
    SELECT razorpay_payment_id
      FROM payments
     WHERE razorpay_payment_id IS NOT NULL
     GROUP BY razorpay_payment_id
    HAVING COUNT(*) > 1
  ) AS duplicates
);

SET @index_exists = (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'payments'
     AND index_name = 'uniq_payments_razorpay_payment_id'
);

SET @sql = (
  SELECT CASE
    WHEN @index_exists > 0 THEN 'SELECT ''skip: index already exists'' AS result'
    WHEN @duplicate_razorpay_payments > 0 THEN 'SELECT ''skip: resolve duplicate razorpay_payment_id rows first'' AS result'
    ELSE 'ALTER TABLE payments ADD UNIQUE INDEX uniq_payments_razorpay_payment_id (razorpay_payment_id)'
  END
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The Razorpay tab reads payment_history by razorpay_payment_id; without this it is a scan.
SET @history_index_exists = (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'payment_history'
     AND index_name = 'idx_payment_history_razorpay_payment_id'
);

SET @sql = (
  SELECT IF(@history_index_exists > 0,
    'SELECT ''skip: index already exists'' AS result',
    'ALTER TABLE payment_history ADD INDEX idx_payment_history_razorpay_payment_id (razorpay_payment_id)'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
