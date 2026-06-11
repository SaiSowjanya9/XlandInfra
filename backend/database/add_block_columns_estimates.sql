-- Add block data columns to fp_estimates table
-- Run this migration: mysql -u xland_user -p xland_pm < add_block_columns_estimates.sql

-- Add block columns to fp_estimates
ALTER TABLE fp_estimates ADD COLUMN number_of_blocks INT DEFAULT 1 AFTER address;
ALTER TABLE fp_estimates ADD COLUMN units_per_block JSON AFTER number_of_blocks;
ALTER TABLE fp_estimates ADD COLUMN block_names JSON AFTER units_per_block;
ALTER TABLE fp_estimates ADD COLUMN total_units INT DEFAULT 0 AFTER block_names;

-- Verify
DESCRIBE fp_estimates;
