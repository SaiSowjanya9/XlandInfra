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
-- Fix the vendor assignment triggers from schema_v22
--
-- Their bodies read fp_estimates.service_rows, but that table stores the
-- services in package_services. The column does not exist, so AFTER INSERT
-- aborted with "Unknown column 'service_rows' in 'field list'" and the whole
-- assignment INSERT was rolled back - the second reason Assign Vendor could
-- never save.
-- ============================================

DROP TRIGGER IF EXISTS after_vendor_assignment_insert;
DROP TRIGGER IF EXISTS after_vendor_assignment_update;

DELIMITER $$

CREATE TRIGGER after_vendor_assignment_insert
AFTER INSERT ON property_vendor_assignments
FOR EACH ROW
BEGIN
  DECLARE prop_fp_id INT;
  DECLARE est_id INT;
  DECLARE total_svc INT;
  DECLARE assigned_cnt INT;

  -- Get property's FP and estimate
  SELECT op.franchise_partner_id, fe.id INTO prop_fp_id, est_id
  FROM onboarded_properties op
  LEFT JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
  WHERE op.id = NEW.property_id
  LIMIT 1;

  -- Count total services from the estimate
  SELECT JSON_LENGTH(COALESCE(package_services, '[]')) INTO total_svc
  FROM fp_estimates WHERE property_id = NEW.property_id AND status = 'approved'
  LIMIT 1;

  -- Count assigned vendors
  SELECT COUNT(*) INTO assigned_cnt
  FROM property_vendor_assignments
  WHERE property_id = NEW.property_id AND is_active = 1;

  -- Only track properties that exist in onboarded_properties
  IF prop_fp_id IS NOT NULL THEN
    INSERT INTO pending_property_schedules (property_id, estimate_id, total_services, vendors_assigned, franchise_partner_id, scheduling_status)
    VALUES (NEW.property_id, est_id, COALESCE(total_svc, 0), assigned_cnt, prop_fp_id,
      CASE WHEN assigned_cnt >= COALESCE(total_svc, 0) THEN 'pending_schedule' ELSE 'pending_vendor' END
    )
    ON DUPLICATE KEY UPDATE
      vendors_assigned = assigned_cnt,
      scheduling_status = CASE WHEN assigned_cnt >= total_services THEN 'pending_schedule' ELSE 'pending_vendor' END,
      updated_at = NOW();
  END IF;
END $$

CREATE TRIGGER after_vendor_assignment_update
AFTER UPDATE ON property_vendor_assignments
FOR EACH ROW
BEGIN
  DECLARE assigned_cnt INT;
  DECLARE total_svc INT;

  SELECT COUNT(*) INTO assigned_cnt
  FROM property_vendor_assignments
  WHERE property_id = NEW.property_id AND is_active = 1;

  SELECT total_services INTO total_svc
  FROM pending_property_schedules
  WHERE property_id = NEW.property_id;

  UPDATE pending_property_schedules SET
    vendors_assigned = assigned_cnt,
    scheduling_status = CASE WHEN assigned_cnt >= COALESCE(total_svc, 0) THEN 'pending_schedule' ELSE 'pending_vendor' END,
    updated_at = NOW()
  WHERE property_id = NEW.property_id;
END $$

DELIMITER ;
