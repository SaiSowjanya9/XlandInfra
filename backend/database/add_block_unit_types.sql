-- Migration: Add block_unit_types column for storing unit type breakdown per block
-- This stores data like: {"1": {"studio": 3, "oneBed": 2, "twoBed": 0, "threeBed": 0, "fourBed": 0}}

USE customer_portal;

-- Add block_unit_types column to properties table (used by FP customers)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS block_unit_types JSON DEFAULT NULL
COMMENT 'Unit type breakdown per block for GC: {"blockNum": {"studio": N, "oneBed": N, ...}}';

-- Add block_unit_types column to onboarded_properties table
ALTER TABLE onboarded_properties
ADD COLUMN IF NOT EXISTS block_unit_types JSON DEFAULT NULL
COMMENT 'Unit type breakdown per block for GC: {"blockNum": {"studio": N, "oneBed": N, ...}}';

-- Add block_unit_types column to fp_estimates table
ALTER TABLE fp_estimates
ADD COLUMN IF NOT EXISTS block_unit_types JSON DEFAULT NULL
COMMENT 'Unit type breakdown per block for GC estimates';

SELECT 'Migration completed: block_unit_types column added to properties, onboarded_properties and fp_estimates' AS status;
