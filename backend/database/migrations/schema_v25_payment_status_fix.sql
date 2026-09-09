-- Payment Status ENUM Fix
-- Version 25: Add 'verification_pending' status to payments table
-- This is required for offline payments (cash, cheque, bank transfer) that need admin verification

-- =====================================================
-- UPDATE PAYMENTS STATUS ENUM
-- =====================================================

-- Add 'verification_pending' to the status ENUM in payments table
ALTER TABLE payments 
MODIFY COLUMN status ENUM('pending', 'verification_pending', 'completed', 'failed', 'refunded', 'paid') DEFAULT 'pending';

-- =====================================================
-- VERIFICATION QUERY (Run after migration)
-- =====================================================
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = DATABASE() 
--   AND TABLE_NAME = 'payments' 
--   AND COLUMN_NAME = 'status';
