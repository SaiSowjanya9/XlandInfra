-- Razorpay Integration Schema Updates
-- Version 18: Enhanced Razorpay Payment Link Support

-- Add Razorpay payment link fields to invoices table
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS razorpay_payment_link_id VARCHAR(100) AFTER payment_link_expires_at,
  ADD COLUMN IF NOT EXISTS razorpay_short_url VARCHAR(255) AFTER razorpay_payment_link_id,
  ADD COLUMN IF NOT EXISTS payment_link_status ENUM('created', 'sent', 'paid', 'expired', 'cancelled') DEFAULT NULL AFTER razorpay_short_url,
  ADD COLUMN IF NOT EXISTS payment_link_sent_via VARCHAR(50) AFTER payment_link_status,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at DATETIME AFTER payment_link_sent_via;

-- Add indexes for Razorpay fields
ALTER TABLE invoices
  ADD INDEX IF NOT EXISTS idx_razorpay_link_id (razorpay_payment_link_id),
  ADD INDEX IF NOT EXISTS idx_payment_link_status (payment_link_status);

-- Add Razorpay webhook logs table for debugging and audit
CREATE TABLE IF NOT EXISTS razorpay_webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(100) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  
  -- Related records
  invoice_id INT,
  payment_id INT,
  razorpay_payment_link_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  
  -- Processing status
  status ENUM('received', 'processed', 'failed', 'ignored') DEFAULT 'received',
  error_message TEXT,
  
  -- Audit
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  
  INDEX idx_event_type (event_type),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_razorpay_payment_link_id (razorpay_payment_link_id),
  INDEX idx_status (status),
  INDEX idx_received_at (received_at)
);

-- Razorpay configuration table (per franchise partner)
CREATE TABLE IF NOT EXISTS razorpay_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT,
  
  -- API credentials (encrypted in production)
  api_key_id VARCHAR(255) NOT NULL,
  api_key_secret VARCHAR(255) NOT NULL,
  webhook_secret VARCHAR(255),
  
  -- Business details for payment links
  business_name VARCHAR(255),
  business_logo_url VARCHAR(500),
  
  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  is_test_mode BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_fp (franchise_partner_id),
  INDEX idx_is_active (is_active)
);

-- Email templates for payment links
CREATE TABLE IF NOT EXISTS payment_email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT,
  
  template_type ENUM('payment_link', 'payment_reminder', 'payment_confirmation', 'payment_failed') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  
  -- Variables available: {{customer_name}}, {{invoice_id}}, {{amount}}, {{due_date}}, {{payment_link}}, {{property_name}}
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_fp_type (franchise_partner_id, template_type),
  INDEX idx_template_type (template_type)
);

-- Insert default email template for payment link
INSERT IGNORE INTO payment_email_templates (franchise_partner_id, template_type, subject, body)
VALUES (
  NULL,
  'payment_link',
  'Payment Request - Invoice {{invoice_id}} from XLAND INFRA',
  'Dear {{customer_name}},

We hope this message finds you well.

Please find below the payment details for your invoice:

Invoice Number: {{invoice_id}}
Property: {{property_name}}
Amount Due: ₹{{amount}}
Due Date: {{due_date}}

Click the link below to make a secure payment:
{{payment_link}}

Payment Options Available:
• UPI (GPay, PhonePe, Paytm, etc.)
• Credit Card / Debit Card
• Net Banking
• Digital Wallets

If you have any questions regarding this invoice, please feel free to contact us.

Thank you for your business!

Best regards,
XLAND INFRA PVT LTD
Phone: 8500010111
Email: info@xlandinfra.com'
);
