-- Add billing_duration column to fp_estimates table
-- Run this migration: mysql -u xland_user -p xland_pm < add_billing_duration_to_estimates.sql

ALTER TABLE fp_estimates 
ADD COLUMN IF NOT EXISTS billing_duration VARCHAR(50) DEFAULT 'yearly' AFTER package_services;

-- Verify
DESCRIBE fp_estimates;
