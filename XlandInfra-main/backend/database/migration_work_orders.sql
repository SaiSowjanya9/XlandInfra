-- Add property_name and property_type columns to work_orders table
-- Run this migration if the columns don't already exist

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS property_name VARCHAR(255) AFTER customer_phone;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS property_type VARCHAR(50) AFTER property_name;
