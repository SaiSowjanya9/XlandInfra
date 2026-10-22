const { pool } = require('../config/database');

/**
 * A refund is a fact about money that went back, not a change to the payment row — a partial
 * refund is the case that makes this obvious: the payment happened, the invoice's settled
 * figure is payments-minus-refunds, and neither column on `payments` can carry the residue.
 *
 * `payment_refunds` is that ledger (schema_v55_payment_refunds.sql). One row per Razorpay
 * refund, keyed on razorpay_refund_id so a retried refund.processed event cannot decrement
 * twice; `settledRefundTotal` is the half of "settled money" every SUM-of-payments reader
 * must subtract (see utils/invoiceSettlement.js).
 */

const TABLE_DDL = `CREATE TABLE IF NOT EXISTS payment_refunds (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensured = null;

const ensureRefundTable = () => {
  if (!ensured) {
    ensured = (async () => {
      const [rows] = await pool.execute(
        `SELECT TABLE_NAME AS name FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_refunds'`
      );
      if (rows.length === 0) {
        await pool.execute(TABLE_DDL);
        console.log('[payments] created payment_refunds; schema_v55 had not been applied');
      }
      return true;
    })().catch(error => {
      // Do not cache a failed pass: the next write tries again rather than staying broken
      ensured = null;
      console.warn(`[payments] payment_refunds check failed (${error.message})`);
      return false;
    });
  }
  return ensured;
};

/**
 * Upsert one Razorpay refund into the ledger — razorpay_refund_id is UNIQUE, so a retried
 * event updates in place rather than double-writing. Callers that need to know whether this
 * refund was already processed check findRefund() first.
 */
const recordRefund = async ({ paymentId, invoiceId, razorpayRefundId, razorpayPaymentId, amount, status, conn = pool }) => {
  await conn.execute(
    `INSERT INTO payment_refunds (payment_id, invoice_id, razorpay_refund_id, razorpay_payment_id, amount, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payment_id = VALUES(payment_id),
       invoice_id = VALUES(invoice_id),
       razorpay_payment_id = VALUES(razorpay_payment_id),
       amount = VALUES(amount),
       status = VALUES(status)`,
    [paymentId || null, invoiceId || null, razorpayRefundId, razorpayPaymentId || null, amount, status]
  );
};

const findRefund = async (razorpayRefundId, conn = pool) => {
  const [rows] = await conn.execute(
    'SELECT * FROM payment_refunds WHERE razorpay_refund_id = ?',
    [razorpayRefundId]
  );
  return rows[0] || null;
};

/** The processed-refund total for an invoice — the amount settled readers subtract. */
const settledRefundTotal = async (invoiceId, conn = pool) => {
  const [[row]] = await conn.execute(
    `SELECT COALESCE(SUM(amount), 0) AS refunded FROM payment_refunds
     WHERE invoice_id = ? AND status = 'processed'`,
    [invoiceId]
  );
  return parseFloat(row.refunded) || 0;
};

// Tests need to forget what we learned about the table
const resetRefundTableCache = () => { ensured = null; };

module.exports = { ensureRefundTable, recordRefund, findRefund, settledRefundTotal, TABLE_DDL, resetRefundTableCache };
