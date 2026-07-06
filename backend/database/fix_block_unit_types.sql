-- Migration: Fix block_unit_types for existing GC and APT properties
-- Run this on the VPS database: mysql -u root -p xland_pm < fix_block_unit_types.sql

-- 1. Ensure columns exist in properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_unit_types JSON DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS number_of_blocks INT DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_names JSON DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS units_per_block JSON DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_info VARCHAR(255) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_na TINYINT(1) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS flat_block_info VARCHAR(255) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS flat_block_na TINYINT(1) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS villa_plot_number VARCHAR(100) DEFAULT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS plot_na TINYINT(1) DEFAULT 0;

-- 2. Update GC properties in onboarded_properties with empty block_unit_types if NULL
UPDATE onboarded_properties 
SET block_unit_types = JSON_OBJECT(
  '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (entry_type = 'GC' OR property_type = 'gated_community')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 3. Update APT properties in onboarded_properties with empty block_unit_types if NULL
UPDATE onboarded_properties 
SET block_unit_types = JSON_OBJECT(
  'apt', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (entry_type = 'APT' OR property_type = 'apartment')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 4. Update GC properties in properties table
UPDATE properties 
SET block_unit_types = JSON_OBJECT(
  '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'gated_community' OR property_type = 'GC')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 5. Update APT properties in properties table
UPDATE properties 
SET block_unit_types = JSON_OBJECT(
  'apt', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'apartment' OR property_type = 'APT')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 6. Update GC estimates in fp_estimates table
UPDATE fp_estimates 
SET block_unit_types = JSON_OBJECT(
  '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'gated_community' OR property_type = 'GC')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 7. Update APT estimates in fp_estimates table
UPDATE fp_estimates 
SET block_unit_types = JSON_OBJECT(
  'apt', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'apartment' OR property_type = 'APT')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- Summary query to check results
SELECT 'onboarded_properties GC' as table_type, COUNT(*) as count FROM onboarded_properties WHERE (entry_type = 'GC' OR property_type = 'gated_community') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'onboarded_properties APT', COUNT(*) FROM onboarded_properties WHERE (entry_type = 'APT' OR property_type = 'apartment') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'properties GC', COUNT(*) FROM properties WHERE (property_type = 'gated_community' OR property_type = 'GC') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'properties APT', COUNT(*) FROM properties WHERE (property_type = 'apartment' OR property_type = 'APT') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'fp_estimates GC', COUNT(*) FROM fp_estimates WHERE (property_type = 'gated_community' OR property_type = 'GC') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'fp_estimates APT', COUNT(*) FROM fp_estimates WHERE (property_type = 'apartment' OR property_type = 'APT') AND block_unit_types IS NOT NULL;

SELECT 'Migration completed: block_unit_types initialized for GC and APT properties' AS status;
