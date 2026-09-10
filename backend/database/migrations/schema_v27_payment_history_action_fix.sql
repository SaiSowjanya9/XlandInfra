-- Migration: Fix payment_history action column size
-- The 'action' column was too small causing "Data truncated" errors

-- Modify the action column to accept larger values
ALTER TABLE payment_history 
MODIFY COLUMN action VARCHAR(50) NOT NULL DEFAULT 'created';

-- Also ensure new_status column is large enough
ALTER TABLE payment_history 
MODIFY COLUMN new_status VARCHAR(50) DEFAULT NULL;
