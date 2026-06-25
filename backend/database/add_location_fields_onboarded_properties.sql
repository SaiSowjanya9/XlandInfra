-- Migration: Add GPS location fields to onboarded_properties table
-- Required for property location capture and vendor navigation

USE xland_pm;

-- Add location columns to onboarded_properties
ALTER TABLE onboarded_properties ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE onboarded_properties ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) DEFAULT NULL;
ALTER TABLE onboarded_properties ADD COLUMN IF NOT EXISTS map_location JSON DEFAULT NULL;
-- map_location JSON structure: { lat, lng, address, googleMapsLink, savedBy, savedAt, accuracy }

-- Add location columns to properties if they don't exist
ALTER TABLE properties ADD COLUMN IF NOT EXISTS map_location JSON DEFAULT NULL;
-- map_location JSON structure: { lat, lng, address, googleMapsLink, savedBy, savedAt, accuracy }

-- Note: Run this migration on the VPS database
-- mysql -u root -p xland_pm < add_location_fields_onboarded_properties.sql
