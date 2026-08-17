-- Reset FP ID sequence to start from XFP001
-- Run this on your production database after deleting FPs

-- Step 1: Check current state
SELECT id, fp_id, company_name FROM franchise_partners;

-- Step 2: Reset the auto_increment for the primary key
ALTER TABLE franchise_partners AUTO_INCREMENT = 1;

-- Step 3: If there are still FPs in the table that need renumbering, run this:
-- SET @counter = 0;
-- UPDATE franchise_partners 
-- SET fp_id = CONCAT('XFP', LPAD(@counter := @counter + 1, 3, '0')) 
-- ORDER BY id;

-- Verify the reset
SELECT 'FP sequence reset. Next FP will be XFP001' AS status;
