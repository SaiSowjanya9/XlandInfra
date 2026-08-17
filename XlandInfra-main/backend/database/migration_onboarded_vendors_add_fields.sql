-- Migration: Add login, business docs, and performance fields to onboarded_vendors
-- Run this on production database

USE customer_portal;

-- Add Login Credentials
ALTER TABLE onboarded_vendors 
ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE AFTER vendor_id,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) AFTER username,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL AFTER password_hash;

-- Add Business Documents
ALTER TABLE onboarded_vendors 
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50) AFTER poc_country_code,
ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20) AFTER gst_number,
ADD COLUMN IF NOT EXISTS license_number VARCHAR(100) AFTER pan_number;

-- Add Performance Tracking
ALTER TABLE onboarded_vendors 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0.00 AFTER coverage_per_day,
ADD COLUMN IF NOT EXISTS total_jobs_completed INT DEFAULT 0 AFTER rating;

-- Add franchise_partner_id for tracking which FP created the vendor
ALTER TABLE onboarded_vendors 
ADD COLUMN IF NOT EXISTS franchise_partner_id INT AFTER created_by_id;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_username ON onboarded_vendors(username);
CREATE INDEX IF NOT EXISTS idx_franchise_partner_id ON onboarded_vendors(franchise_partner_id);
