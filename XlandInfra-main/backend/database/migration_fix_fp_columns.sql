-- Migration to fix Franchise Partner table columns
-- Run this on production database to fix missing columns

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS franchise_partner_id INT DEFAULT NULL AFTER role;
CREATE INDEX IF NOT EXISTS idx_users_franchise_partner ON users(franchise_partner_id);

-- Add missing columns to franchise_partners table
ALTER TABLE franchise_partners ADD COLUMN IF NOT EXISTS fp_code VARCHAR(50) AFTER id;
ALTER TABLE franchise_partners ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200) AFTER company_name;
ALTER TABLE franchise_partners ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20) AFTER state;
ALTER TABLE franchise_partners ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE AFTER pan_number;
ALTER TABLE franchise_partners ADD COLUMN IF NOT EXISTS created_by INT DEFAULT NULL AFTER last_login;

-- Ensure fp_code is populated for existing records
UPDATE franchise_partners SET fp_code = CONCAT('FP-', id) WHERE fp_code IS NULL OR fp_code = '';

-- Make fp_code unique (if not already)
-- Note: This may fail if fp_code column doesn't exist yet - run after adding column
ALTER TABLE franchise_partners ADD UNIQUE INDEX IF NOT EXISTS idx_fp_code_unique (fp_code);

-- Verify the changes
SELECT 'Users table columns:' as info;
SHOW COLUMNS FROM users LIKE 'franchise_partner_id';

SELECT 'Franchise partners table columns:' as info;
SHOW COLUMNS FROM franchise_partners;
