-- Migration: Add missing columns to work_orders table
-- Run this on VPS: mysql -u root -p xland_pm < add_work_orders_columns.sql

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS property_name VARCHAR(255);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(50);

-- Modify created_by to VARCHAR to support email/username storage
ALTER TABLE work_orders MODIFY COLUMN created_by VARCHAR(255);
