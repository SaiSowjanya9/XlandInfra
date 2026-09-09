-- ============================================
-- MIGRATION: Fix scheduling_status ENUM values
-- ============================================
-- The scheduling_status column needs 'scheduled' value
-- Previously only had: 'not_started', 'in_progress', 'completed'
-- Adding 'scheduled' to represent when schedule is confirmed but work hasn't started
-- ============================================

-- Add 'scheduled' to property_service_schedules.scheduling_status ENUM
ALTER TABLE property_service_schedules 
MODIFY COLUMN scheduling_status ENUM('not_started', 'in_progress', 'scheduled', 'completed') DEFAULT 'not_started';

-- Verify the change
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'property_service_schedules' 
AND COLUMN_NAME = 'scheduling_status';

-- Update any existing 'completed' records that should be 'scheduled'
-- (Only if the work hasn't actually been done)
-- This is optional - run manually if needed:
-- UPDATE property_service_schedules 
-- SET scheduling_status = 'scheduled' 
-- WHERE scheduling_status = 'completed' 
-- AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.schedule_id = property_service_schedules.id AND wo.status = 'completed');
