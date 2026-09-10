-- Schema V28: Migrate Legacy Properties
-- Moves all data from 'properties' table to 'onboarded_properties'
-- This consolidates the two property tables into one

-- ============================================
-- STEP 1: Check current state
-- ============================================
-- Run these SELECT statements first to verify data:
-- SELECT COUNT(*) as legacy_count FROM properties;
-- SELECT COUNT(*) as new_count FROM onboarded_properties;
-- SELECT id, property_id, name FROM properties WHERE id NOT IN (SELECT id FROM onboarded_properties);

-- ============================================
-- STEP 2: Add missing columns to onboarded_properties if needed
-- ============================================
-- Note: Using separate ALTER statements and ignoring errors if column exists
ALTER TABLE onboarded_properties ADD COLUMN legacy_migrated TINYINT(1) DEFAULT 0;
ALTER TABLE onboarded_properties ADD COLUMN legacy_id INT DEFAULT NULL;

-- ============================================
-- STEP 3: Migrate legacy properties that don't exist in onboarded_properties
-- ============================================
INSERT INTO onboarded_properties (
    id,
    property_id,
    entry_type,
    category,
    zone,
    area_name,
    division,
    property_type,
    community_name,
    total_units,
    address,
    status,
    created_at,
    updated_at,
    created_by,
    legacy_migrated,
    legacy_id
)
SELECT 
    p.id,
    p.property_id,
    'GC' as entry_type,  -- Default to GC, can be updated later
    CASE 
        WHEN p.property_type = 'residential' THEN 'residential'
        WHEN p.property_type = 'commercial' THEN 'commercial'
        ELSE 'residential'
    END as category,
    COALESCE((SELECT z.name FROM zones z WHERE z.id = p.zone_id), 'Zone A') as zone,
    COALESCE(p.city, 'Unknown') as area_name,
    COALESCE((SELECT d.name FROM divisions d WHERE d.id = p.division_id), 'Default') as division,
    COALESCE(p.property_type, 'residential') as property_type,
    p.name as community_name,
    COALESCE(p.total_units, 0) as total_units,
    p.address,
    CASE WHEN p.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
    p.created_at,
    p.updated_at,
    p.created_by,
    1 as legacy_migrated,
    p.id as legacy_id
FROM properties p
WHERE p.id NOT IN (SELECT id FROM onboarded_properties)
ON DUPLICATE KEY UPDATE
    legacy_migrated = 1,
    legacy_id = p.id;

-- ============================================
-- STEP 4: Migrate contact info to property_contacts
-- ============================================
INSERT INTO property_contacts (
    property_id,
    name,
    phone,
    email,
    contact_type,
    is_primary,
    created_at
)
SELECT 
    p.id,
    COALESCE(p.contact_person, 'Primary Contact'),
    p.contact_phone,
    p.contact_email,
    'owner',
    1,
    p.created_at
FROM properties p
WHERE p.id NOT IN (SELECT id FROM onboarded_properties WHERE legacy_migrated = 0)
    AND (p.contact_person IS NOT NULL OR p.contact_phone IS NOT NULL OR p.contact_email IS NOT NULL)
    AND p.id NOT IN (SELECT property_id FROM property_contacts WHERE is_primary = 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================
-- STEP 5: Update fp_estimates to ensure property_id references are correct
-- (No change needed - they reference by id which is preserved)
-- ============================================

-- ============================================
-- STEP 6: Verify migration
-- ============================================
-- SELECT 'Legacy properties migrated:' as info, COUNT(*) as count FROM onboarded_properties WHERE legacy_migrated = 1;
-- SELECT 'Total onboarded properties:' as info, COUNT(*) as count FROM onboarded_properties;
-- SELECT 'Remaining in legacy table:' as info, COUNT(*) as count FROM properties WHERE id NOT IN (SELECT id FROM onboarded_properties);

-- ============================================
-- STEP 7: Rename old table (optional - do this after verifying everything works)
-- ============================================
-- RENAME TABLE properties TO properties_archived;

-- ============================================
-- STEP 8: Fix missing franchise_partner_id on properties
-- Updates properties that have NULL franchise_partner_id from their estimates
-- ============================================
UPDATE onboarded_properties op
SET franchise_partner_id = (
    SELECT fe.franchise_partner_id 
    FROM fp_estimates fe 
    WHERE fe.property_id = op.id 
      AND fe.franchise_partner_id IS NOT NULL 
    LIMIT 1
)
WHERE op.franchise_partner_id IS NULL
  AND EXISTS (
    SELECT 1 FROM fp_estimates fe 
    WHERE fe.property_id = op.id 
      AND fe.franchise_partner_id IS NOT NULL
  );

-- ============================================
-- NOTES:
-- After running this migration:
-- 1. All properties will be in onboarded_properties
-- 2. The legacy 'properties' table can be archived
-- 3. Code should only reference onboarded_properties going forward
-- 4. The UNION queries in schedules.js can be simplified to single table queries
-- 5. Properties without franchise_partner_id will get it from their estimates
-- ============================================
