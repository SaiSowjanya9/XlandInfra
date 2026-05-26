-- Migration: Add Password Reset Columns and Visible Password
-- Date: 2024
-- Description: Adds columns to support forgot password feature and admin-visible passwords

-- Add password reset columns to customer_accounts table
ALTER TABLE customer_accounts
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME NULL,
ADD COLUMN IF NOT EXISTS reset_temp_password_hash VARCHAR(255) NULL;

-- Add visible_password column to users table (for admin visibility)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS visible_password VARCHAR(255) NULL;

-- Add index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_customer_reset_token ON customer_accounts(reset_token);

-- Add password reset columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME NULL,
ADD COLUMN IF NOT EXISTS reset_temp_password_hash VARCHAR(255) NULL;

-- Add index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- Add password reset columns to franchise_partners table
ALTER TABLE franchise_partners
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME NULL,
ADD COLUMN IF NOT EXISTS reset_temp_password_hash VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS visible_password VARCHAR(255) NULL;

-- Add index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_fp_reset_token ON franchise_partners(reset_token);

-- Verify columns were added
SELECT 'customer_accounts columns:' as table_info;
SHOW COLUMNS FROM customer_accounts LIKE 'reset%';

SELECT 'users columns:' as table_info;
SHOW COLUMNS FROM users LIKE 'reset%';

SELECT 'franchise_partners columns:' as table_info;
SHOW COLUMNS FROM franchise_partners LIKE 'reset%';
