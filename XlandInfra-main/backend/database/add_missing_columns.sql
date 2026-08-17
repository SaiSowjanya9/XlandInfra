-- Add missing columns to database
-- Run on VPS: mysql -u xland_user -p'YourStrongPassword123!' xland_pm < add_missing_columns.sql

-- Add estimate_type column to fp_estimates table
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS estimate_type VARCHAR(50) DEFAULT 'standard';

-- Add division column to fp_estimates table (CRITICAL - missing from original schema)
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS division VARCHAR(100) DEFAULT NULL AFTER zone;

-- Add action_token column to fp_estimates table
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS action_token VARCHAR(100) DEFAULT NULL;

-- Add sent_at column to fp_estimates table
ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP NULL DEFAULT NULL;

-- Add contact_person column to onboarded_properties table
ALTER TABLE onboarded_properties 
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255) DEFAULT NULL;

-- Add contact_phone column to onboarded_properties table (in case it's missing too)
ALTER TABLE onboarded_properties 
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50) DEFAULT NULL;

-- Add contact_email column to onboarded_properties table (in case it's missing too)
ALTER TABLE onboarded_properties 
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255) DEFAULT NULL;

-- Verify columns were added
DESCRIBE fp_estimates;
DESCRIBE onboarded_properties;
