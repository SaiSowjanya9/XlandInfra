-- Add cancellation_note column to work_orders table
-- This column stores the reason/note when a work order is cancelled

USE xland_pm;

-- Add cancellation_note column
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS cancellation_note TEXT NULL AFTER closing_notes;

-- Add cancelled_at timestamp column to track when it was cancelled
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS cancelled_at DATETIME NULL AFTER completed_at;

-- Add cancelled_by column to track who cancelled it
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS cancelled_by INT NULL AFTER cancelled_at;
