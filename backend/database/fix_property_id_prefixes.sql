-- Fix Property ID Prefixes Migration
-- Run this to correct existing properties with wrong GC- prefix

-- Fix Flat properties (should be FLT-)
UPDATE properties 
SET property_id = CONCAT('FLT-', SUBSTRING(property_id, 4)) 
WHERE (entry_type = 'FLAT' OR property_type = 'flat') 
AND property_id LIKE 'GC-%';

-- Fix Apartment properties (should be APT-)
UPDATE properties 
SET property_id = CONCAT('APT-', SUBSTRING(property_id, 4)) 
WHERE (entry_type = 'APT' OR property_type = 'apartment') 
AND property_id LIKE 'GC-%';

-- Fix Villa properties (should be VLA-)
UPDATE properties 
SET property_id = CONCAT('VLA-', SUBSTRING(property_id, 4)) 
WHERE (entry_type = 'VILLA' OR property_type = 'villa') 
AND property_id LIKE 'GC-%';

-- Fix Plot properties (should be PLT-)
UPDATE properties 
SET property_id = CONCAT('PLT-', SUBSTRING(property_id, 4)) 
WHERE (entry_type = 'PLOT' OR property_type = 'plot') 
AND property_id LIKE 'GC-%';

-- Also fix in onboarded_properties table if exists
UPDATE onboarded_properties 
SET property_id = CONCAT('FLT-', SUBSTRING(property_id, 4)) 
WHERE entry_type = 'FLAT' AND property_id LIKE 'GC-%';

UPDATE onboarded_properties 
SET property_id = CONCAT('APT-', SUBSTRING(property_id, 4)) 
WHERE entry_type = 'APT' AND property_id LIKE 'GC-%';

UPDATE onboarded_properties 
SET property_id = CONCAT('VLA-', SUBSTRING(property_id, 4)) 
WHERE entry_type = 'VILLA' AND property_id LIKE 'GC-%';

UPDATE onboarded_properties 
SET property_id = CONCAT('PLT-', SUBSTRING(property_id, 4)) 
WHERE entry_type = 'PLOT' AND property_id LIKE 'GC-%';

-- Verify the changes
SELECT property_id, entry_type, property_type, name FROM properties WHERE property_id LIKE 'GC-%' OR property_id LIKE 'FLT-%' OR property_id LIKE 'APT-%' OR property_id LIKE 'VLA-%' OR property_id LIKE 'PLT-%' LIMIT 20;
