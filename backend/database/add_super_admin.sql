-- Add super admin protection to users table
-- Super admin accounts can only be deleted directly from the database

-- Step 1: Add is_super_admin column (ignore error if column already exists)
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Step 2: Set your-email@gmail.com as the Super Admin
UPDATE users SET is_super_admin = TRUE WHERE email = 'your-email@gmail.com';

-- Step 3: Verify the super admin was set
SELECT id, email, username, role, is_super_admin FROM users WHERE email = 'your-email@gmail.com';
