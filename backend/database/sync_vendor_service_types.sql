-- Sync service types from existing vendors to service_types table
-- This ensures all previously used service types appear in the dropdown

-- Insert unique service types from onboarded_vendors (FP vendors)
INSERT IGNORE INTO service_types (name, is_global, is_active, created_by)
SELECT DISTINCT service_type, 1, 1, 'Migration'
FROM onboarded_vendors 
WHERE service_type IS NOT NULL 
  AND service_type != ''
  AND service_type NOT IN (SELECT name FROM service_types WHERE is_active = 1);

-- Insert unique service types from vendors table (if exists)
INSERT IGNORE INTO service_types (name, is_global, is_active, created_by)
SELECT DISTINCT service_type, 1, 1, 'Migration'
FROM vendors 
WHERE service_type IS NOT NULL 
  AND service_type != ''
  AND service_type NOT IN (SELECT name FROM service_types WHERE is_active = 1);

-- Also check fp_vendors table if it exists
INSERT IGNORE INTO service_types (name, is_global, is_active, created_by)
SELECT DISTINCT service_type, 1, 1, 'Migration'
FROM fp_vendors 
WHERE service_type IS NOT NULL 
  AND service_type != ''
  AND service_type NOT IN (SELECT name FROM service_types WHERE is_active = 1);

-- Show all service types now in the table
SELECT id, name, is_global, is_active, created_by FROM service_types WHERE is_active = 1 ORDER BY name;
