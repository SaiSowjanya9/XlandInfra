-- Schema V26: Add schedule_time column to onboarded_vendors
-- Adds schedule_time field for vendor's preferred working hours

USE xland_pm;

-- Add schedule_time column to onboarded_vendors table
ALTER TABLE onboarded_vendors
ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(20) DEFAULT NULL AFTER coverage_per_day;

-- Add index for schedule_time if needed
-- ALTER TABLE onboarded_vendors ADD INDEX idx_schedule_time (schedule_time);
