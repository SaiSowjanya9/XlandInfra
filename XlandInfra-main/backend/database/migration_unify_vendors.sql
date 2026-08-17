-- Migration: Unify vendors into onboarded_vendors table
-- This migrates all data from vendors to onboarded_vendors
-- Run this on production database
-- NOTE: Run each ALTER statement one by one. Skip any that fail with "Duplicate column" error.

USE xland_pm;

-- Step 1: Add missing columns to onboarded_vendors (run each separately, skip duplicates)
-- If column already exists, you'll get "Duplicate column name" error - that's OK, skip it

ALTER TABLE onboarded_vendors ADD COLUMN company_name VARCHAR(255) AFTER vendor_id;
ALTER TABLE onboarded_vendors ADD COLUMN contact_person VARCHAR(200) AFTER company_name;
ALTER TABLE onboarded_vendors ADD COLUMN phone VARCHAR(20) AFTER owner_country_code;
ALTER TABLE onboarded_vendors ADD COLUMN alternate_phone VARCHAR(20) AFTER phone;
ALTER TABLE onboarded_vendors ADD COLUMN email VARCHAR(255) AFTER alternate_phone;
ALTER TABLE onboarded_vendors ADD COLUMN address TEXT AFTER email;
ALTER TABLE onboarded_vendors ADD COLUMN city VARCHAR(100) AFTER address;
ALTER TABLE onboarded_vendors ADD COLUMN state VARCHAR(100) AFTER city;
ALTER TABLE onboarded_vendors ADD COLUMN zip_code VARCHAR(20) AFTER state;
ALTER TABLE onboarded_vendors ADD COLUMN zone_id INT AFTER zone;
ALTER TABLE onboarded_vendors ADD COLUMN vendor_type VARCHAR(100) AFTER service_type;
ALTER TABLE onboarded_vendors ADD COLUMN service_categories JSON AFTER vendor_type;
ALTER TABLE onboarded_vendors ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER status;
ALTER TABLE onboarded_vendors ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER is_active;
ALTER TABLE onboarded_vendors ADD COLUMN supervisor_id INT AFTER franchise_partner_id;
ALTER TABLE onboarded_vendors ADD COLUMN executive_id INT AFTER supervisor_id;

-- Step 2: Copy data from vendors to onboarded_vendors (skip duplicates by vendor_id)
INSERT INTO onboarded_vendors (
  vendor_id, username, password_hash, last_login,
  company_name, contact_person, phone, alternate_phone, email,
  address, city, state, zip_code,
  zone, zone_id, area_name,
  service_type, vendor_type, service_categories, service_verified,
  gst_number, pan_number, license_number,
  owner_name, owner_mobile, owner_email, owner_aadhar,
  manager_name, manager_mobile, manager_email,
  poc_name, poc_mobile, poc_email,
  rate_per_visit, coverage_per_day,
  rating, total_jobs_completed,
  status, is_active, is_verified,
  franchise_partner_id, supervisor_id,
  created_by, created_by_id, created_by_name,
  created_at, updated_at
)
SELECT 
  v.vendor_id, v.username, v.password_hash, v.last_login,
  v.company_name, v.contact_person, v.phone, v.alternate_phone, v.email,
  v.address, v.city, v.state, v.zip_code,
  v.zone_name, v.zone_id, v.area,
  COALESCE(v.service_type, 'General'), v.vendor_type, v.service_categories, v.service_verified,
  v.gst_number, v.pan_number, v.license_number,
  COALESCE(v.owner_name, v.company_name, v.contact_person), v.owner_mobile, v.owner_email, v.owner_aadhar,
  v.manager_name, v.manager_mobile, v.manager_email,
  v.poc_name, v.poc_mobile, v.poc_email,
  COALESCE(v.rate_per_visit, 0), COALESCE(v.coverage_per_day, 0),
  COALESCE(v.rating, 0), COALESCE(v.total_jobs_completed, 0),
  COALESCE(v.status, 'active'), COALESCE(v.is_active, TRUE), COALESCE(v.is_verified, FALSE),
  v.franchise_partner_id, v.supervisor_id,
  v.created_by_name, v.created_by, v.created_by_name,
  v.created_at, v.updated_at
FROM vendors v
WHERE v.vendor_id NOT IN (SELECT vendor_id FROM onboarded_vendors WHERE vendor_id IS NOT NULL);

-- Step 3: Create a mapping table to track old ID to new ID
CREATE TABLE IF NOT EXISTS vendor_id_mapping (
  old_vendor_id INT,
  new_vendor_id INT,
  vendor_code VARCHAR(50),
  PRIMARY KEY (old_vendor_id)
);

-- Populate mapping (vendors.id -> onboarded_vendors.id)
INSERT IGNORE INTO vendor_id_mapping (old_vendor_id, new_vendor_id, vendor_code)
SELECT v.id, ov.id, v.vendor_id
FROM vendors v
INNER JOIN onboarded_vendors ov ON v.vendor_id = ov.vendor_id;

-- Step 4: Update work_orders.assigned_vendor_id to use new IDs
UPDATE work_orders wo
INNER JOIN vendor_id_mapping vim ON wo.assigned_vendor_id = vim.old_vendor_id
SET wo.assigned_vendor_id = vim.new_vendor_id
WHERE wo.assigned_vendor_id IS NOT NULL;

-- Step 5: Update property_vendor_assignments.vendor_id to use new IDs  
UPDATE property_vendor_assignments pva
INNER JOIN vendor_id_mapping vim ON pva.vendor_id = vim.old_vendor_id
SET pva.vendor_id = vim.new_vendor_id
WHERE pva.vendor_id IS NOT NULL;

-- Step 6: Rename old vendors table as backup
RENAME TABLE vendors TO vendors_legacy;

-- Step 7: Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_company_name ON onboarded_vendors(company_name);
CREATE INDEX IF NOT EXISTS idx_email ON onboarded_vendors(email);
CREATE INDEX IF NOT EXISTS idx_is_active ON onboarded_vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_supervisor_id ON onboarded_vendors(supervisor_id);

-- Done! Old data preserved in vendors_legacy table
