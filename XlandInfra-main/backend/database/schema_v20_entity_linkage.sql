-- Entity Linkage Schema Updates
-- Version 20: Complete property linkage chain
-- Property Code → Estimate ID → Invoice ID → Payment ID → Receipt ID

-- =====================================================
-- Add property_code to invoices for direct lookup
-- =====================================================
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS property_code VARCHAR(50) AFTER property_id;

CREATE INDEX IF NOT EXISTS idx_property_code ON invoices(property_code);

-- =====================================================
-- Add receipt_id to payments
-- =====================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS receipt_id VARCHAR(50) AFTER payment_id;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS property_code VARCHAR(50) AFTER property_id;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) AFTER invoice_id;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS estimate_number VARCHAR(50) AFTER estimate_id;

CREATE INDEX IF NOT EXISTS idx_receipt_id ON payments(receipt_id);
CREATE INDEX IF NOT EXISTS idx_payments_property_code ON payments(property_code);
CREATE INDEX IF NOT EXISTS idx_invoice_number ON payments(invoice_number);

-- =====================================================
-- Receipt Sequence Table
-- =====================================================
CREATE TABLE IF NOT EXISTS receipt_sequence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT,
  year INT NOT NULL,
  current_number INT DEFAULT 0,
  prefix VARCHAR(10) DEFAULT 'RCP',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_fp_year (franchise_partner_id, year)
);

-- =====================================================
-- Add cheque to payment_method enum if not exists
-- =====================================================
-- Note: Run this manually if needed
-- ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash', 'upi_manual', 'upi_online', 'bank_transfer', 'card_pos', 'razorpay', 'credit_card', 'debit_card', 'net_banking', 'wallet', 'cheque') NOT NULL;
