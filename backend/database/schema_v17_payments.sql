-- Payment Module Schema
-- Version 17: Invoices, Payments, and Payment History

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(50) UNIQUE NOT NULL,           -- e.g., INV-2025-00001
  property_id INT,
  estimate_id INT,
  customer_id INT,
  franchise_partner_id INT,
  
  -- Customer details (auto-filled from property/customer)
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  
  -- Invoice details
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  -- Line items stored as JSON for flexibility
  line_items JSON,
  
  -- Amount calculations
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
  discount_amount DECIMAL(12, 2) DEFAULT 0.00,
  tax_percentage DECIMAL(5, 2) DEFAULT 18.00,       -- GST default 18%
  tax_amount DECIMAL(12, 2) DEFAULT 0.00,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  
  -- Payment tracking
  amount_paid DECIMAL(12, 2) DEFAULT 0.00,
  balance_amount DECIMAL(12, 2) DEFAULT 0.00,
  
  -- Invoice status: draft, sent, paid, partially_paid, overdue, cancelled
  status ENUM('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled') DEFAULT 'draft',
  payment_status ENUM('pending', 'partially_paid', 'paid') DEFAULT 'pending',
  
  -- Payment link (for online payments)
  payment_link VARCHAR(500),
  payment_link_created_at DATETIME,
  payment_link_expires_at DATETIME,
  
  -- Work order reference (if invoice is for a work order)
  work_order_id INT,
  
  -- Notes
  notes TEXT,
  terms_and_conditions TEXT,
  
  -- Audit fields
  created_by INT,
  created_by_role VARCHAR(50),
  sent_at DATETIME,
  sent_by INT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_property_id (property_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_franchise_partner_id (franchise_partner_id),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_due_date (due_date)
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(50) UNIQUE NOT NULL,           -- e.g., PAY-2025-00001
  invoice_id INT NOT NULL,
  property_id INT,
  estimate_id INT,
  customer_id INT,
  franchise_partner_id INT,
  
  -- Customer details (for quick reference)
  customer_name VARCHAR(255),
  
  -- Payment details
  amount DECIMAL(12, 2) NOT NULL,
  payment_method ENUM('cash', 'upi_manual', 'upi_online', 'bank_transfer', 'card_pos', 'razorpay', 'credit_card', 'debit_card', 'net_banking', 'wallet') NOT NULL,
  payment_type ENUM('manual', 'online') NOT NULL DEFAULT 'manual',
  
  -- Transaction details
  transaction_reference VARCHAR(100),               -- UTR number for UPI/Bank, Transaction ID for cards
  payment_date DATE NOT NULL,
  
  -- Payment proof (for manual payments)
  payment_proof_url VARCHAR(500),
  
  -- Status
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  
  -- For online payments (Razorpay)
  razorpay_payment_id VARCHAR(100),
  razorpay_order_id VARCHAR(100),
  razorpay_signature VARCHAR(255),
  
  -- Who received/recorded the payment
  received_by INT,
  received_by_name VARCHAR(255),
  received_by_role VARCHAR(50),
  
  -- Remarks
  remarks TEXT,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_payment_id (payment_id),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_property_id (property_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_franchise_partner_id (franchise_partner_id),
  INDEX idx_payment_method (payment_method),
  INDEX idx_status (status),
  INDEX idx_payment_date (payment_date),
  
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- =====================================================
-- PAYMENT HISTORY TABLE (Audit trail for all payment actions)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT,
  invoice_id INT,
  
  -- Action details
  action ENUM('created', 'updated', 'status_changed', 'refunded', 'deleted') NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  amount DECIMAL(12, 2),
  
  -- Description of the action
  description TEXT,
  
  -- Who performed the action
  performed_by INT,
  performed_by_name VARCHAR(255),
  performed_by_role VARCHAR(50),
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_payment_id (payment_id),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- =====================================================
-- UPI QR CODES TABLE (For static QR code management)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_qr_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT,
  
  -- UPI details
  upi_id VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  
  -- QR code image
  qr_code_url VARCHAR(500),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_franchise_partner_id (franchise_partner_id),
  INDEX idx_upi_id (upi_id),
  INDEX idx_is_active (is_active)
);

-- =====================================================
-- INVOICE SEQUENCE TABLE (For generating sequential invoice numbers)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_sequence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT,
  year INT NOT NULL,
  current_number INT DEFAULT 0,
  prefix VARCHAR(10) DEFAULT 'INV',
  
  UNIQUE KEY unique_fp_year (franchise_partner_id, year),
  INDEX idx_franchise_partner_id (franchise_partner_id)
);

-- =====================================================
-- PAYMENT SEQUENCE TABLE (For generating sequential payment numbers)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_sequence (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT,
  year INT NOT NULL,
  current_number INT DEFAULT 0,
  prefix VARCHAR(10) DEFAULT 'PAY',
  
  UNIQUE KEY unique_fp_year (franchise_partner_id, year),
  INDEX idx_franchise_partner_id (franchise_partner_id)
);
