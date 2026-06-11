-- Fix missing columns in fp_estimates table
-- Run this migration to fix "Failed to save estimate" error
-- Command: mysql -u xland_user -p xland_pm < fix_fp_estimates_columns.sql

-- Add division column (CRITICAL - causes INSERT to fail if missing)
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS division VARCHAR(100) DEFAULT NULL AFTER zone;

-- Add action_token column
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS action_token VARCHAR(100) DEFAULT NULL AFTER valid_until;

-- Add sent_at column
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP NULL DEFAULT NULL AFTER action_token;

-- Add estimate_type if missing (should already exist but just in case)
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS estimate_type VARCHAR(50) DEFAULT 'property_based' AFTER property_id;

-- Verify the table structure
DESCRIBE fp_estimates;
