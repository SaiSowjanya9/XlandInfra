-- Schema V13: User Management Enhancement
-- Adds user_id and must_change_password columns for employee account management

-- Add user_id column (unique identifier for each user)
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(20) UNIQUE AFTER id;

-- Add must_change_password flag for first login
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE AFTER password_hash;

-- Generate user_id for existing users who don't have one
UPDATE users SET user_id = CONCAT(
  CASE role
    WHEN 'admin' THEN 'ADM'
    WHEN 'operations_manager' THEN 'OPM'
    WHEN 'franchise_partner' THEN 'FRP'
    WHEN 'franchise' THEN 'FRP'
    WHEN 'manager' THEN 'MGR'
    WHEN 'coordinator' THEN 'CRD'
    WHEN 'supervisor' THEN 'SUP'
    WHEN 'executive' THEN 'EXE'
    ELSE 'USR'
  END,
  '-',
  UPPER(CONV(id + UNIX_TIMESTAMP(), 10, 36)),
  UPPER(LEFT(MD5(RAND()), 4))
) WHERE user_id IS NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
