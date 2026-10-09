-- Migration: schema_v45 - fp_estimates column drift repair
--
-- Several older files were meant to add columns to fp_estimates but use MariaDB-only
-- "ADD COLUMN IF NOT EXISTS" / "CREATE INDEX IF NOT EXISTS", which MySQL 8 rejects --
-- the whole statement fails and the column is never added:
--
--   add_missing_columns.sql                    -> estimate_type, division, action_token, sent_at
--   fix_fp_estimates_columns.sql               -> (same set)
--   migrations/add_missing_fp_estimates_columns.sql -> title, payment_status,
--                                                  package_services, service_category
--   add_estimate_descriptions.sql              -> amc_package_description, package_services
--   add_billing_duration_to_estimates.sql      -> billing_duration
--   add_block_columns_estimates.sql            -> number_of_blocks, units_per_block,
--                                                 block_names, total_units
--   add_block_unit_types.sql                   -> block_unit_types
--   migrations/schema_v22_property_scheduling.sql  -> scheduling_ready,
--                                                 scheduling_ready_at, all_vendors_assigned
--
-- A deployment where those files failed raises "Unknown column 'fe.<col>'" in
-- routes/schedules.js, routes/admin.js and routes/franchisePartner.js. The runtime
-- backfills in those routes heal some columns on some paths; this file brings every
-- post-v8 fp_estimates column into the schema explicitly so no path depends on which
-- migration happened to apply.
--
-- Safe to re-run: information_schema is checked before each ALTER.

DELIMITER $$

DROP PROCEDURE IF EXISTS xland_add_column_if_missing $$
CREATE PROCEDURE xland_add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  DECLARE col_count INT DEFAULT 0;
  DECLARE tbl_count INT DEFAULT 0;

  SELECT COUNT(*) INTO tbl_count
    FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = p_table;

  IF tbl_count = 0 THEN
    SELECT CONCAT('skip (no table): ', p_table) AS result;
  ELSE
    SELECT COUNT(*) INTO col_count
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = p_table
       AND column_name = p_column;

    IF col_count = 0 THEN
      SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
      PREPARE stmt FROM @ddl;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
      SELECT CONCAT('added: ', p_table, '.', p_column) AS result;
    END IF;
  END IF;
END $$

DELIMITER ;

-- In schema_v8 already, added here for tables created before those columns were
-- folded into the CREATE TABLE (estimate_type stays a permissive VARCHAR when added
-- by this path; schema_v33 widens the ENUM wherever it already exists).
CALL xland_add_column_if_missing('fp_estimates', 'estimate_type', "VARCHAR(50) DEFAULT 'property_based'");
CALL xland_add_column_if_missing('fp_estimates', 'division', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'action_token', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'sent_at', 'TIMESTAMP NULL');

-- add_missing_fp_estimates_columns.sql
CALL xland_add_column_if_missing('fp_estimates', 'title', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'payment_status', "ENUM('pending', 'partial', 'paid') DEFAULT 'pending'");
CALL xland_add_column_if_missing('fp_estimates', 'package_services', 'JSON NULL');
CALL xland_add_column_if_missing('fp_estimates', 'service_category', 'VARCHAR(100) NULL');

-- add_estimate_descriptions.sql / add_billing_duration_to_estimates.sql
CALL xland_add_column_if_missing('fp_estimates', 'amc_package_description', 'TEXT NULL');
CALL xland_add_column_if_missing('fp_estimates', 'billing_duration', "VARCHAR(50) DEFAULT 'yearly'");

-- add_block_columns_estimates.sql / add_block_unit_types.sql
CALL xland_add_column_if_missing('fp_estimates', 'number_of_blocks', 'INT DEFAULT 1');
CALL xland_add_column_if_missing('fp_estimates', 'units_per_block', 'JSON NULL');
CALL xland_add_column_if_missing('fp_estimates', 'block_names', 'JSON NULL');
CALL xland_add_column_if_missing('fp_estimates', 'total_units', 'INT DEFAULT 0');
CALL xland_add_column_if_missing('fp_estimates', 'block_unit_types', 'JSON NULL');

-- Property-detail columns the FP estimate routes add at runtime
CALL xland_add_column_if_missing('fp_estimates', 'tower_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'block_number', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'villa_plot_number', 'VARCHAR(100) NULL');

-- schema_v22 scheduling flags (the file's ALTER is MariaDB-only syntax)
CALL xland_add_column_if_missing('fp_estimates', 'scheduling_ready', 'BOOLEAN DEFAULT FALSE');
CALL xland_add_column_if_missing('fp_estimates', 'scheduling_ready_at', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('fp_estimates', 'all_vendors_assigned', 'BOOLEAN DEFAULT FALSE');

-- schema_v34 / schema_v35 (already MySQL 8-safe; listed so one file heals every gap)
CALL xland_add_column_if_missing('fp_estimates', 'assign_vendor', "TINYINT(1) NULL COMMENT '1 = assign a vendor and schedule visits, 0 = no scheduling, NULL = answered before this column existed'");
CALL xland_add_column_if_missing('fp_estimates', 'include_terms', 'TINYINT(1) NULL DEFAULT NULL');
CALL xland_add_column_if_missing('fp_estimates', 'terms_conditions', 'TEXT NULL');

-- Work order estimate columns the FP routes add at runtime
CALL xland_add_column_if_missing('fp_estimates', 'work_order_id', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'work_order_category', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'work_order_subcategory', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'work_order_description', 'TEXT NULL');
CALL xland_add_column_if_missing('fp_estimates', 'work_order_priority', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'work_order_status', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'work_order_services', 'TEXT NULL');

-- schema_v42 / v43 / v44 marketing tracker columns (already MySQL 8-safe; same purpose)
CALL xland_add_column_if_missing('fp_estimates', 'lead_source', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'priority', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'maintenance_system', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'maintenance_system_other', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'proposal_given', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'proposal_given_other', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'customer_decision', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'customer_decision_other', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'tracked_at', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('fp_estimates', 'tracker_status', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'coordinator_reviewed', 'VARCHAR(10) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'follow_up_stage', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'coordinator_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'tracker_archived_at', 'TIMESTAMP NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
