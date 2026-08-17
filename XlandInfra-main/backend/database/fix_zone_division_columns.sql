-- Migration: Fix zone_id and division_id columns to accept VARCHAR values
-- The FP portal stores zone and division names as strings, not IDs

USE customer_portal;

-- Change zone_id from INT to VARCHAR to store zone names
ALTER TABLE properties MODIFY COLUMN zone_id VARCHAR(100) DEFAULT NULL;

-- Change division_id from INT to VARCHAR to store division names  
ALTER TABLE properties MODIFY COLUMN division_id VARCHAR(100) DEFAULT NULL;

-- Drop foreign key constraints if they exist (they will fail with VARCHAR)
-- Note: If you get an error "Can't DROP; check that column/key exists", ignore it

-- This allows storing zone names like "Zone PP1" and division names like "Division C"
