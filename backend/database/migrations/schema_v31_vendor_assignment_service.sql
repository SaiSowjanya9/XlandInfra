-- Migration: schema_v31 - per-service vendor assignments
--
-- "Assign Vendor" on Pending Property Schedules saves one row per service, but
-- property_vendor_assignments as created by this repo could not store that:
--
--   POST /vendors/assignments -> Unknown column 'service_type' in 'where clause'
--
-- so every assignment failed with a 500 and the "Vendors Assigned" count never
-- moved. The UNIQUE KEY was also wrong: unique_property_vendor(property_id,
-- vendor_id) stops one vendor from covering two services of the same property,
-- which raises a duplicate-entry error on the second service.
--
-- Existing deployments may already have the column (added ad-hoc). Safe to
-- re-run: information_schema is checked first.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS" / "DROP INDEX IF EXISTS".

DELIMITER $$

DROP PROCEDURE IF EXISTS xland_fix_vendor_assignments $$
CREATE PROCEDURE xland_fix_vendor_assignments()
BEGIN
  DECLARE tbl_count INT DEFAULT 0;
  DECLARE col_count INT DEFAULT 0;
  DECLARE legacy_key_count INT DEFAULT 0;
  DECLARE service_key_count INT DEFAULT 0;

  SELECT COUNT(*) INTO tbl_count
    FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'property_vendor_assignments';

  IF tbl_count = 0 THEN
    SELECT 'skip (no table): property_vendor_assignments' AS result;
  ELSE
    -- 1. The service each assignment covers
    SELECT COUNT(*) INTO col_count
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'property_vendor_assignments'
       AND column_name = 'service_type';

    IF col_count = 0 THEN
      ALTER TABLE property_vendor_assignments ADD COLUMN service_type VARCHAR(255) NULL AFTER vendor_id;
      SELECT 'added: property_vendor_assignments.service_type' AS result;
    END IF;

    -- 2. Drop the key that allowed only one service per vendor+property
    SELECT COUNT(*) INTO legacy_key_count
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'property_vendor_assignments'
       AND index_name = 'unique_property_vendor';

    IF legacy_key_count > 0 THEN
      ALTER TABLE property_vendor_assignments DROP INDEX unique_property_vendor;
      SELECT 'dropped: unique_property_vendor' AS result;
    END IF;

    -- 3. Uniqueness that includes the service
    SELECT COUNT(*) INTO service_key_count
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'property_vendor_assignments'
       AND index_name = 'unique_property_vendor_service';

    IF service_key_count = 0 THEN
      ALTER TABLE property_vendor_assignments
        ADD UNIQUE KEY unique_property_vendor_service (property_id, vendor_id, service_type);
      SELECT 'added: unique_property_vendor_service' AS result;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL xland_fix_vendor_assignments();

DROP PROCEDURE IF EXISTS xland_fix_vendor_assignments;

-- ============================================
-- Remove the vendor assignment triggers from schema_v22
--
-- Their bodies read fp_estimates.service_rows, but that table stores the
-- services in package_services. The column does not exist, so AFTER INSERT
-- aborted with "Unknown column 'service_rows' in 'field list'" and the whole
-- assignment INSERT was rolled back - the second reason Assign Vendor could
-- never save.
--
-- They are dropped rather than rebuilt on purpose: CREATE TRIGGER on a server
-- with binary logging enabled requires SUPER
-- (ER_BINLOG_CREATE_ROUTINE_NEED_SUPER / errno 1419), which the application's
-- database user does not have. backend/utils/vendorAssignments.js now keeps
-- pending_property_schedules in step from the application after every
-- assignment, so no trigger is needed.
-- ============================================

DROP TRIGGER IF EXISTS after_vendor_assignment_insert;
DROP TRIGGER IF EXISTS after_vendor_assignment_update;
