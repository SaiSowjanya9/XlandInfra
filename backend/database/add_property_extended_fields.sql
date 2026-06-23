-- Migration: Add extended fields to properties table
-- Required for FP portal property edit/view functionality

USE customer_portal;

-- Add entry_type and category columns
ALTER TABLE properties ADD COLUMN entry_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN category VARCHAR(50) DEFAULT NULL;

-- Add area_name column
ALTER TABLE properties ADD COLUMN area_name VARCHAR(200) DEFAULT NULL;

-- Add block/unit related columns (for GC properties)
ALTER TABLE properties ADD COLUMN number_of_blocks INT DEFAULT 1;
ALTER TABLE properties ADD COLUMN block_names JSON DEFAULT NULL;
ALTER TABLE properties ADD COLUMN units_per_block JSON DEFAULT NULL;
ALTER TABLE properties ADD COLUMN number_of_units INT DEFAULT NULL;

-- Add villa/plot/flat specific columns
ALTER TABLE properties ADD COLUMN villa_plot_number VARCHAR(100) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN block_info VARCHAR(200) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN block_na BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN flat_block_info VARCHAR(200) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN flat_block_na BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN plot_na BOOLEAN DEFAULT FALSE;

-- Add location columns
ALTER TABLE properties ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN landmark VARCHAR(500) DEFAULT NULL;

-- Add notes column
ALTER TABLE properties ADD COLUMN notes TEXT DEFAULT NULL;

-- Add watchman columns (may already exist from previous migration)
ALTER TABLE properties ADD COLUMN watchman_name VARCHAR(200) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN watchman_contact VARCHAR(20) DEFAULT NULL;

-- Add association_contacts JSON column (may already exist from previous migration)
ALTER TABLE properties ADD COLUMN association_contacts JSON DEFAULT NULL;

-- Change property_type from ENUM to VARCHAR to support more types
ALTER TABLE properties MODIFY COLUMN property_type VARCHAR(100) DEFAULT 'residential';

-- Note: If you get "Duplicate column name" errors, those columns already exist and you can ignore them.
