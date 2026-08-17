-- Script to delete all employees from Charan FP portal
-- Run this on VPS: mysql -u xland_user -p'YourStrongPassword123!' xland_pm < delete_charan_employees.sql

-- First, let's see all franchise partners
SELECT id, company_name, username FROM franchise_partners;

-- Show employees for Charan FP (adjust the WHERE clause based on actual FP)
SELECT fp.id as fp_id, fp.company_name, 
       e.id as emp_id, e.first_name, e.last_name, e.email, e.user_id
FROM franchise_partners fp
LEFT JOIN fp_employees e ON e.franchise_partner_id = fp.id
WHERE fp.company_name LIKE '%charan%' OR fp.username LIKE '%charan%';

-- Delete all employee data for Charan FP
-- Replace <CHARAN_FP_ID> with the actual ID after running the SELECT above

-- Step 1: Delete zone assignments
DELETE FROM fp_employee_zones 
WHERE franchise_partner_id = (
  SELECT id FROM franchise_partners 
  WHERE company_name LIKE '%charan%' OR username LIKE '%charan%'
  LIMIT 1
);

-- Step 2: Get user_ids before deleting employees
SET @charan_fp_id = (
  SELECT id FROM franchise_partners 
  WHERE company_name LIKE '%charan%' OR username LIKE '%charan%'
  LIMIT 1
);

-- Step 3: Delete linked user accounts
DELETE FROM users 
WHERE franchise_partner_id = @charan_fp_id
AND role IN ('manager', 'coordinator', 'supervisor', 'executive');

-- Step 4: Delete employees
DELETE FROM fp_employees 
WHERE franchise_partner_id = @charan_fp_id;

-- Verify deletion
SELECT 'Remaining employees:' as status;
SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = @charan_fp_id;
