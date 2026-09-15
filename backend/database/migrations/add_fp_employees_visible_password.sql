-- Migration: Add visible_password to fp_employees
-- Description: fp_employees was missing the admin-visible password column that
-- users and franchise_partners already have. Required by the FP employee email
-- change flow in routes/franchisePartner.js.

ALTER TABLE fp_employees
ADD COLUMN IF NOT EXISTS visible_password VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;

-- Verify columns were added
SELECT 'fp_employees columns:' as table_info;
SHOW COLUMNS FROM fp_employees LIKE '%password%';
