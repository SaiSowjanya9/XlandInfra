-- Delete seed zone data from schema_v3.sql
-- Run this on your database to remove sample zones and divisions

-- First delete divisions that reference zones
DELETE FROM divisions WHERE zone_id IN (
  SELECT id FROM zones WHERE code IN ('NORTH', 'SOUTH', 'EAST', 'WEST')
);

-- Then delete the sample zones
DELETE FROM zones WHERE code IN ('NORTH', 'SOUTH', 'EAST', 'WEST');

-- If you want to delete ALL zones (be careful!)
-- DELETE FROM divisions;
-- DELETE FROM zones;

-- For FP-specific zones (fp_zones table), delete all if needed:
-- DELETE FROM fp_employee_zones;
-- DELETE FROM fp_zones;

SELECT 'Seed zones deleted successfully' AS status;
