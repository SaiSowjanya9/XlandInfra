-- Schema V5: Extended Address Fields
-- Adds additional address columns to onboarded_properties table
-- Run this after schema_v4_onboarding.sql

USE customer_portal;

-- ============================================
-- ADD NEW ADDRESS COLUMNS
-- ============================================
ALTER TABLE onboarded_properties
  ADD COLUMN address_line1 VARCHAR(255) DEFAULT NULL AFTER address,
  ADD COLUMN apt_suite_unit VARCHAR(100) DEFAULT NULL AFTER address_line1,
  ADD COLUMN apt_suite_na BOOLEAN DEFAULT FALSE AFTER apt_suite_unit,
  ADD COLUMN city VARCHAR(100) DEFAULT NULL AFTER apt_suite_na,
  ADD COLUMN state VARCHAR(100) DEFAULT NULL AFTER city,
  ADD COLUMN postal_code VARCHAR(20) DEFAULT NULL AFTER state;

-- Add index on city for filtering
CREATE INDEX idx_onboarded_city ON onboarded_properties(city);
CREATE INDEX idx_onboarded_state ON onboarded_properties(state);
