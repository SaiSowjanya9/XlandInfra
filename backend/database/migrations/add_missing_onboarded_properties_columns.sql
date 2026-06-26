-- Migration: Add missing columns to onboarded_properties table
-- Required for Manager Portal property creation
-- Compatible with MySQL 5.7+

USE xland_pm;

-- Run each ALTER separately. If column already exists, it will error - just continue to next one.

ALTER TABLE onboarded_properties ADD COLUMN franchise_partner_id INT NULL;
ALTER TABLE onboarded_properties ADD COLUMN manager_id INT NULL;
ALTER TABLE onboarded_properties ADD COLUMN flat_block_info VARCHAR(200) DEFAULT NULL;
ALTER TABLE onboarded_properties ADD COLUMN flat_block_na TINYINT(1) DEFAULT 0;
ALTER TABLE onboarded_properties ADD COLUMN plot_na TINYINT(1) DEFAULT 0;
ALTER TABLE onboarded_properties ADD COLUMN association_contacts JSON DEFAULT NULL;

-- Add indexes (ignore errors if they already exist)
ALTER TABLE onboarded_properties ADD INDEX idx_onboarded_fp (franchise_partner_id);
ALTER TABLE onboarded_properties ADD INDEX idx_onboarded_manager (manager_id);
