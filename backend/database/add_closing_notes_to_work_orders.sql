-- Add closing_notes column to work_orders table
-- This column stores the technician/admin notes when completing a work order

USE xland_pm;

-- Add closing_notes column (no AFTER clause to avoid column reference errors)
ALTER TABLE work_orders ADD COLUMN closing_notes TEXT;

-- Verify the column was added
DESCRIBE work_orders;
