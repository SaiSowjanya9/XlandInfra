-- Add association_contacts column to properties table
-- This stores multiple contacts as JSON array

USE customer_portal;

-- Add association_contacts column (will error if already exists - ignore if so)
-- For MySQL versions < 8.0.19 that don't support IF NOT EXISTS
ALTER TABLE properties ADD COLUMN association_contacts JSON DEFAULT NULL;

-- Note: If you get "Duplicate column name" error, the column already exists and you can ignore it.
-- association_contacts stores an array of contacts in JSON format:
-- [{"name": "John", "email": "john@example.com", "phone": "1234567890", "countryCode": "+91"}, ...]
