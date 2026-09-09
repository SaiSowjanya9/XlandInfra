-- Migration to add missing columns to fp_estimates table
-- Run this on the production database

-- Add title column
ALTER TABLE fp_estimates ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL;

-- Add payment_status column
ALTER TABLE fp_estimates ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'partial', 'paid') DEFAULT 'pending';

-- Add package_services column (JSON for storing service details)
ALTER TABLE fp_estimates ADD COLUMN IF NOT EXISTS package_services JSON DEFAULT NULL;

-- Add service_category column
ALTER TABLE fp_estimates ADD COLUMN IF NOT EXISTS service_category VARCHAR(100) DEFAULT NULL;

-- Create index for payment_status
CREATE INDEX IF NOT EXISTS idx_fp_estimates_payment_status ON fp_estimates(payment_status);

-- Update existing approved estimates to have payment_status = 'paid' (for migration)
UPDATE fp_estimates SET payment_status = 'paid' WHERE status = 'approved' AND payment_status IS NULL;
