-- Migration: Add description columns for AMC package and addons in estimates
-- This stores the package description and addon descriptions at the time of estimate creation

-- Add amc_package_description column to fp_estimates
ALTER TABLE fp_estimates ADD COLUMN IF NOT EXISTS amc_package_description TEXT DEFAULT NULL;

-- Add package_services column to store the full service details with descriptions
ALTER TABLE fp_estimates ADD COLUMN IF NOT EXISTS package_services TEXT DEFAULT NULL;

-- MySQL compatible version (run these if above fails)
-- ALTER TABLE fp_estimates ADD COLUMN amc_package_description TEXT DEFAULT NULL;
-- ALTER TABLE fp_estimates ADD COLUMN package_services TEXT DEFAULT NULL;

-- Note: addon descriptions are already stored in addons_data JSON column
-- Each addon in the array should include: name, price, frequency, description
