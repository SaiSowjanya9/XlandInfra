-- Schema V26: Add working hours columns to onboarded_vendors
-- Adds working_hours_from and working_hours_to fields for vendor's working hours range

USE xland_pm;

-- Add working_hours_from column
ALTER TABLE onboarded_vendors ADD COLUMN IF NOT EXISTS working_hours_from VARCHAR(10) DEFAULT NULL AFTER coverage_per_day;

-- Add working_hours_to column  
ALTER TABLE onboarded_vendors ADD COLUMN IF NOT EXISTS working_hours_to VARCHAR(10) DEFAULT NULL AFTER working_hours_from;

-- If schedule_time column exists, migrate data to new columns and drop it
-- (Run manually if needed:
--   UPDATE onboarded_vendors SET working_hours_from = schedule_time WHERE schedule_time IS NOT NULL;
--   ALTER TABLE onboarded_vendors DROP COLUMN schedule_time;
-- )
