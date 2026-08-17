-- Migration: Add watchman fields to properties table
-- These fields are only applicable for GC (Gated Community) and APT (Apartment) property types

USE customer_portal;

-- Add watchman_name column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS watchman_name VARCHAR(200) DEFAULT NULL;

-- Add watchman_contact column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS watchman_contact VARCHAR(20) DEFAULT NULL;

-- Note: watchman_name and watchman_contact are used for GC and APT property types
