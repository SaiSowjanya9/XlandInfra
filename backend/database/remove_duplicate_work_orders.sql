-- Migration: Remove duplicate work orders
-- Keep only the first record (lowest id) for each work_order_id

-- First, let's see what duplicates exist
SELECT work_order_id, COUNT(*) as count 
FROM work_orders 
GROUP BY work_order_id 
HAVING COUNT(*) > 1;

-- Delete duplicate work orders, keeping the one with the lowest id
DELETE wo1 FROM work_orders wo1
INNER JOIN work_orders wo2
WHERE wo1.work_order_id = wo2.work_order_id
AND wo1.id > wo2.id;

-- Verify no duplicates remain
SELECT work_order_id, COUNT(*) as count 
FROM work_orders 
GROUP BY work_order_id 
HAVING COUNT(*) > 1;

-- Add unique constraint to prevent future duplicates (if not already exists)
-- Note: Run this only if the constraint doesn't exist
-- ALTER TABLE work_orders ADD UNIQUE INDEX idx_work_order_id_unique (work_order_id);
