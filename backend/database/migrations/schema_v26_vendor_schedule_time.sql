-- Schema V26: Add schedule_time column to onboarded_vendors
-- Adds schedule_time field for vendor's preferred working hours

USE xland_pm;

-- Add schedule_time column to onboarded_vendors table
-- First check if column exists, if not add it
SET @dbname = 'xland_pm';
SET @tablename = 'onboarded_vendors';
SET @columnname = 'schedule_time';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT "Column already exists"',
  'ALTER TABLE onboarded_vendors ADD COLUMN schedule_time VARCHAR(20) DEFAULT NULL AFTER coverage_per_day'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
