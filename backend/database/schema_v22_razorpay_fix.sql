-- Razorpay Integration Fix Schema
-- Version 22: Add missing columns for Razorpay webhook payment tracking
-- Run this AFTER schema_v21

-- =====================================================
-- FIX PAYMENT_HISTORY TABLE FOR RAZORPAY WEBHOOKS
-- =====================================================

-- Add Razorpay-specific columns to payment_history table
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_history' AND COLUMN_NAME = 'razorpay_payment_id') = 0,
  'ALTER TABLE payment_history ADD COLUMN razorpay_payment_id VARCHAR(100)',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_history' AND COLUMN_NAME = 'razorpay_receipt_id') = 0,
  'ALTER TABLE payment_history ADD COLUMN razorpay_receipt_id VARCHAR(100)',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_history' AND COLUMN_NAME = 'payment_method_details') = 0,
  'ALTER TABLE payment_history ADD COLUMN payment_method_details JSON',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for Razorpay payment ID lookups
-- (Will fail silently if already exists)
-- CREATE INDEX idx_razorpay_payment_id ON payment_history(razorpay_payment_id);

-- =====================================================
-- FIX ACTION ENUM TO INCLUDE RAZORPAY ACTIONS
-- =====================================================
-- Note: Modifying ENUM in MySQL requires ALTER TABLE
-- This adds new valid action types for Razorpay payments

ALTER TABLE payment_history 
MODIFY COLUMN action VARCHAR(50) NOT NULL;

-- =====================================================
-- ADD PAYMENT LINK EXPIRY COLUMN TO INVOICES
-- =====================================================
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_link_expires_at') = 0,
  'ALTER TABLE invoices ADD COLUMN payment_link_expires_at DATETIME',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_link_created_at') = 0,
  'ALTER TABLE invoices ADD COLUMN payment_link_created_at DATETIME',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- VERIFICATION QUERY (Run after migration)
-- =====================================================
-- SELECT 
--   COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'payment_history'
-- ORDER BY ORDINAL_POSITION;
