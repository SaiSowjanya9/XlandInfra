-- Fix service_types table - ensure all default types exist with is_global = 1

-- First, update any existing records to ensure is_global is TRUE (1)
UPDATE service_types SET is_global = 1 WHERE name IN (
  'Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Security',
  'Carpentry', 'Painting', 'Pest Control', 'Landscaping', 'General Maintenance'
);

-- Insert missing service types (if they don't exist)
INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Plumbing', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'plumbing' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Electrical', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'electrical' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'HVAC', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'hvac' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Cleaning', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'cleaning' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Security', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'security' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Carpentry', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'carpentry' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Painting', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'painting' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Pest Control', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'pest control' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'Landscaping', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'landscaping' AND is_active = 1);

INSERT INTO service_types (name, is_global, is_active, created_by) 
SELECT 'General Maintenance', 1, 1, 'System' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM service_types WHERE LOWER(name) = 'general maintenance' AND is_active = 1);

-- Verify results
SELECT * FROM service_types WHERE is_active = 1 ORDER BY name;
