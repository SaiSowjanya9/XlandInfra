-- Schema V15: Employee Onboarding Enhancement
-- Adds columns for all employee account types (Admin, OPS Manager, FP Employees) 
-- with temporary password flow and first-time login password change

-- Add country_code column to fp_employees
ALTER TABLE fp_employees ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT '+91' AFTER phone;

-- Add aadhaar column to fp_employees  
ALTER TABLE fp_employees ADD COLUMN IF NOT EXISTS aadhaar VARCHAR(20) AFTER country_code;

-- Add user_id reference column (links to users table for login)
ALTER TABLE fp_employees ADD COLUMN IF NOT EXISTS user_id INT AFTER password_hash;

-- Add must_change_password column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE AFTER password_hash;

-- Add user_id column to users table if not exists  
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(20) UNIQUE AFTER id;

-- Update users table role ENUM to include FP employee roles
ALTER TABLE users 
MODIFY COLUMN role ENUM(
  'admin', 
  'operations_manager', 
  'manager', 
  'coordinator', 
  'supervisor', 
  'executive', 
  'franchise', 
  'franchise_partner',
  'fp_admin',
  'fp_manager',
  'fp_supervisor',
  'fp_executive'
) NOT NULL DEFAULT 'executive';

-- Add franchise_partner_id column to users table for FP employee context
ALTER TABLE users ADD COLUMN IF NOT EXISTS franchise_partner_id INT AFTER role;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fp_employees_email ON fp_employees(email);
CREATE INDEX IF NOT EXISTS idx_fp_employees_user_id ON fp_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON users(must_change_password);
CREATE INDEX IF NOT EXISTS idx_users_franchise_partner ON users(franchise_partner_id);
