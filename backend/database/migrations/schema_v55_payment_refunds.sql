-- schema_v55: the refund ledger.
--
-- A refund is a fact about money that went back, not a change to the payment row: a partial
-- refund leaves the payment settled for its remainder, which no single payments.status can
-- express. Settled money is now SUM(payments paid|completed) - SUM(payment_refunds processed);
-- every reader that computes it (utils/invoiceSettlement.js, the customer portal's amount_paid
-- subqueries, scripts/repair-invoice-paid-amounts.js) subtracts this table.

CREATE TABLE IF NOT EXISTS payment_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NULL,
  invoice_id INT NULL,
  razorpay_refund_id VARCHAR(100) NOT NULL,
  razorpay_payment_id VARCHAR(100) NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('created','processed','failed') NOT NULL DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_razorpay_refund (razorpay_refund_id),
  KEY idx_refund_invoice (invoice_id),
  KEY idx_refund_payment (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
