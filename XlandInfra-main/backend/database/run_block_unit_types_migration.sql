-- Run this on VPS: mysql -u root -p xland_pm < run_block_unit_types_migration.sql
-- Or copy-paste into MySQL console

-- 1. Update ALL GC properties in onboarded_properties
UPDATE onboarded_properties 
SET block_unit_types = CASE 
  WHEN number_of_blocks >= 2 THEN JSON_OBJECT(
    '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0),
    '2', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
  )
  ELSE JSON_OBJECT(
    '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
  )
END
WHERE (entry_type = 'GC' OR property_type = 'gated_community')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '' OR JSON_LENGTH(block_unit_types) = 0);

-- 2. Update ALL APT properties in onboarded_properties
UPDATE onboarded_properties 
SET block_unit_types = JSON_OBJECT(
  'apt', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (entry_type = 'APT' OR property_type = 'apartment')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '' OR JSON_LENGTH(block_unit_types) = 0);

-- 3. Update ALL GC properties in properties table  
UPDATE properties 
SET block_unit_types = JSON_OBJECT(
  '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'gated_community' OR property_type = 'GC')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 4. Update ALL APT properties in properties table
UPDATE properties 
SET block_unit_types = JSON_OBJECT(
  'apt', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'apartment' OR property_type = 'APT')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 5. Update ALL GC estimates in fp_estimates
UPDATE fp_estimates 
SET block_unit_types = JSON_OBJECT(
  '1', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'gated_community' OR property_type = 'GC')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- 6. Update ALL APT estimates in fp_estimates
UPDATE fp_estimates 
SET block_unit_types = JSON_OBJECT(
  'apt', JSON_OBJECT('studio', 0, 'oneBed', 0, 'twoBed', 0, 'threeBed', 0, 'fourBed', 0)
)
WHERE (property_type = 'apartment' OR property_type = 'APT')
AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '');

-- Verify the updates
SELECT 'onboarded_properties GC' AS table_type, COUNT(*) AS updated 
FROM onboarded_properties 
WHERE (entry_type = 'GC' OR property_type = 'gated_community') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'onboarded_properties APT', COUNT(*) 
FROM onboarded_properties 
WHERE (entry_type = 'APT' OR property_type = 'apartment') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'properties GC', COUNT(*) 
FROM properties 
WHERE (property_type = 'gated_community' OR property_type = 'GC') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'properties APT', COUNT(*) 
FROM properties 
WHERE (property_type = 'apartment' OR property_type = 'APT') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'fp_estimates GC', COUNT(*) 
FROM fp_estimates 
WHERE (property_type = 'gated_community' OR property_type = 'GC') AND block_unit_types IS NOT NULL
UNION ALL
SELECT 'fp_estimates APT', COUNT(*) 
FROM fp_estimates 
WHERE (property_type = 'apartment' OR property_type = 'APT') AND block_unit_types IS NOT NULL;

SELECT 'Migration completed!' AS status;
