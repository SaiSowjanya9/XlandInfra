-- Migration: schema_v46 - column drift repair for every table hit by MariaDB-only DDL
--
-- Many older files in backend/database/ use MariaDB-only "ADD COLUMN IF NOT EXISTS" /
-- "CREATE INDEX IF NOT EXISTS" / "ADD INDEX IF NOT EXISTS" / "ADD CONSTRAINT ... "
-- syntax that MySQL 8 rejects outright -- the statement errors and the column is never
-- added. schema_v45 repaired fp_estimates; this file does the same for every other
-- table those files targeted, so a deployment where they failed is healed by applying
-- one script.
--
-- Sources (all MariaDB-only or partially so):
--   schema_v8_franchise_partners.sql      -> *_id portal links on clients, estimates,
--                                          properties, schedules, vendors, work_orders
--   schema_v9/v10/v11/v12_*_portal.sql    -> manager/coordinator/supervisor/executive_id
--   schema_v13_user_management.sql,
--   schema_v15_fp_employee_onboarding.sql,
--   migration_fix_fp_columns.sql,
--   migrations/add_password_reset_columns.sql,
--   migrations/add_fp_employees_visible_password.sql -> auth/user columns
--   add_work_orders_columns.sql, migration_work_orders.sql,
--   add_cancellation_note_to_work_orders.sql          -> work_orders columns
--   add_missing_columns.sql, add_watchman_*.sql,
--   add_location_fields_onboarded_properties.sql,
--   add_block_unit_types.sql, fix_block_unit_types.sql,
--   add_property_extended_fields.sql,
--   add_association_contacts_to_properties.sql        -> property columns
--   schema_v19_invoice_auto_generation.sql,
--   schema_v20_generic_invoices.sql,
--   schema_v20_entity_linkage.sql                     -> invoices / payments columns
--   migration_onboarded_vendors_add_fields.sql,
--   migrations/schema_v26_vendor_schedule_time.sql,
--   migrations/schema_v22_property_scheduling.sql     -> onboarded_vendors columns
--   migrations/schema_v28_auto_renewal.sql            -> schedule_series columns
--   migrations/schema_v31_vendor_assignment_service.sql,
--   add_created_by_user_id.sql                        -> misc
--
-- Deliberately skipped: ADD CONSTRAINT / ADD UNIQUE INDEX (a drifting DB may have
-- duplicate or orphaned values; a failed index aborts the whole run) and MODIFY
-- COLUMN statements (handled by their own safe migrations, e.g. schema_v33).
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

-- ---------------------------------------------------------------------------
-- Portal role links (schema_v8 - v12): franchise_partner_id, manager_id,
-- coordinator_id, supervisor_id, executive_id on the six shared tables.
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('work_orders', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('work_orders', 'manager_id', 'INT NULL');
CALL xland_add_column_if_missing('work_orders', 'coordinator_id', 'INT NULL');
CALL xland_add_column_if_missing('work_orders', 'supervisor_id', 'INT NULL');
CALL xland_add_column_if_missing('work_orders', 'executive_id', 'INT NULL');

CALL xland_add_column_if_missing('estimates', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'manager_id', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'coordinator_id', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'supervisor_id', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'executive_id', 'INT NULL');

CALL xland_add_column_if_missing('clients', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('clients', 'manager_id', 'INT NULL');
CALL xland_add_column_if_missing('clients', 'coordinator_id', 'INT NULL');
CALL xland_add_column_if_missing('clients', 'supervisor_id', 'INT NULL');
CALL xland_add_column_if_missing('clients', 'executive_id', 'INT NULL');

CALL xland_add_column_if_missing('properties', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('properties', 'manager_id', 'INT NULL');
CALL xland_add_column_if_missing('properties', 'coordinator_id', 'INT NULL');
CALL xland_add_column_if_missing('properties', 'supervisor_id', 'INT NULL');
CALL xland_add_column_if_missing('properties', 'executive_id', 'INT NULL');

CALL xland_add_column_if_missing('schedules', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('schedules', 'manager_id', 'INT NULL');
CALL xland_add_column_if_missing('schedules', 'coordinator_id', 'INT NULL');
CALL xland_add_column_if_missing('schedules', 'supervisor_id', 'INT NULL');
CALL xland_add_column_if_missing('schedules', 'executive_id', 'INT NULL');

CALL xland_add_column_if_missing('vendors', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('vendors', 'manager_id', 'INT NULL');
CALL xland_add_column_if_missing('vendors', 'coordinator_id', 'INT NULL');
CALL xland_add_column_if_missing('vendors', 'supervisor_id', 'INT NULL');
CALL xland_add_column_if_missing('vendors', 'executive_id', 'INT NULL');

-- ---------------------------------------------------------------------------
-- work_orders detail columns (add_work_orders_columns.sql, migration_work_orders.sql,
-- add_cancellation_note_to_work_orders.sql)
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('work_orders', 'client_id', 'INT NULL');
CALL xland_add_column_if_missing('work_orders', 'customer_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('work_orders', 'customer_email', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('work_orders', 'customer_phone', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('work_orders', 'property_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('work_orders', 'property_type', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('work_orders', 'zone', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('work_orders', 'created_by_role', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('work_orders', 'title', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('work_orders', 'entry_notes', 'TEXT NULL');
CALL xland_add_column_if_missing('work_orders', 'cancellation_note', 'TEXT NULL');
CALL xland_add_column_if_missing('work_orders', 'cancelled_at', 'DATETIME NULL');
CALL xland_add_column_if_missing('work_orders', 'cancelled_by', 'INT NULL');

-- ---------------------------------------------------------------------------
-- estimates detail columns (migration_estimates_fields.sql)
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('estimates', 'community_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('estimates', 'description', 'TEXT NULL');
CALL xland_add_column_if_missing('estimates', 'division', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('estimates', 'no_of_visits', 'INT NULL');
CALL xland_add_column_if_missing('estimates', 'package_id', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('estimates', 'package_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('estimates', 'property_id', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('estimates', 'zone', 'VARCHAR(100) NULL');

-- ---------------------------------------------------------------------------
-- properties detail / block / location / watchman columns
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('properties', 'area_name', 'VARCHAR(200) NULL');
CALL xland_add_column_if_missing('properties', 'landmark', 'VARCHAR(500) NULL');
CALL xland_add_column_if_missing('properties', 'notes', 'TEXT NULL');
CALL xland_add_column_if_missing('properties', 'association_contacts', 'JSON NULL');
CALL xland_add_column_if_missing('properties', 'entry_type', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('properties', 'category', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('properties', 'number_of_units', 'INT NULL');
CALL xland_add_column_if_missing('properties', 'latitude', 'DECIMAL(10, 8) NULL');
CALL xland_add_column_if_missing('properties', 'longitude', 'DECIMAL(11, 8) NULL');
CALL xland_add_column_if_missing('properties', 'map_location', 'JSON NULL');
CALL xland_add_column_if_missing('properties', 'watchman_name', 'VARCHAR(200) NULL');
CALL xland_add_column_if_missing('properties', 'watchman_contact', 'VARCHAR(20) NULL');
CALL xland_add_column_if_missing('properties', 'villa_plot_number', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('properties', 'number_of_blocks', 'INT DEFAULT 1');
CALL xland_add_column_if_missing('properties', 'block_names', 'JSON NULL');
CALL xland_add_column_if_missing('properties', 'units_per_block', 'JSON NULL');
CALL xland_add_column_if_missing('properties', 'block_unit_types', 'JSON NULL');
CALL xland_add_column_if_missing('properties', 'block_info', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('properties', 'block_na', 'TINYINT(1) DEFAULT 0');
CALL xland_add_column_if_missing('properties', 'flat_block_info', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('properties', 'flat_block_na', 'TINYINT(1) DEFAULT 0');
CALL xland_add_column_if_missing('properties', 'plot_na', 'TINYINT(1) DEFAULT 0');

-- ---------------------------------------------------------------------------
-- onboarded_properties contact / location / watchman columns
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('onboarded_properties', 'contact_person', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'contact_phone', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'contact_email', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'watchman_name', 'VARCHAR(200) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'watchman_contact', 'VARCHAR(20) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'latitude', 'DECIMAL(10, 8) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'longitude', 'DECIMAL(11, 8) NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'map_location', 'JSON NULL');
CALL xland_add_column_if_missing('onboarded_properties', 'block_unit_types', 'JSON NULL');

-- ---------------------------------------------------------------------------
-- users / franchise_partners / fp_employees / customer_accounts auth columns
-- (user_id added without UNIQUE so legacy duplicate values cannot abort the run)
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('users', 'user_id', 'VARCHAR(20) NULL');
CALL xland_add_column_if_missing('users', 'must_change_password', 'BOOLEAN DEFAULT FALSE');
CALL xland_add_column_if_missing('users', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('users', 'reset_token', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('users', 'reset_token_expires', 'DATETIME NULL');
CALL xland_add_column_if_missing('users', 'reset_temp_password_hash', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('users', 'visible_password', 'VARCHAR(255) NULL');

CALL xland_add_column_if_missing('franchise_partners', 'fp_code', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('franchise_partners', 'owner_name', 'VARCHAR(200) NULL');
CALL xland_add_column_if_missing('franchise_partners', 'zip_code', 'VARCHAR(20) NULL');
CALL xland_add_column_if_missing('franchise_partners', 'must_change_password', 'BOOLEAN DEFAULT TRUE');
CALL xland_add_column_if_missing('franchise_partners', 'created_by', 'INT NULL');
CALL xland_add_column_if_missing('franchise_partners', 'reset_token', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('franchise_partners', 'reset_token_expires', 'DATETIME NULL');
CALL xland_add_column_if_missing('franchise_partners', 'reset_temp_password_hash', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('franchise_partners', 'visible_password', 'VARCHAR(255) NULL');

CALL xland_add_column_if_missing('fp_employees', 'country_code', "VARCHAR(10) DEFAULT '+91'");
CALL xland_add_column_if_missing('fp_employees', 'aadhaar', 'VARCHAR(20) NULL');
CALL xland_add_column_if_missing('fp_employees', 'user_id', 'INT NULL');
CALL xland_add_column_if_missing('fp_employees', 'visible_password', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_employees', 'must_change_password', 'BOOLEAN DEFAULT TRUE');

CALL xland_add_column_if_missing('customer_accounts', 'reset_token', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('customer_accounts', 'reset_token_expires', 'DATETIME NULL');
CALL xland_add_column_if_missing('customer_accounts', 'reset_temp_password_hash', 'VARCHAR(255) NULL');

-- ---------------------------------------------------------------------------
-- invoices / payments linkage columns
-- (invoice_type is added with the superset enum including 'generic' from schema_v20)
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('invoices', 'invoice_type', "ENUM('estimate', 'work_order', 'amc', 'manual', 'generic') DEFAULT 'manual'");
CALL xland_add_column_if_missing('invoices', 'source_estimate_id', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('invoices', 'source_work_order_id', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('invoices', 'auto_generated', 'BOOLEAN DEFAULT FALSE');
CALL xland_add_column_if_missing('invoices', 'email_sent_at', 'DATETIME NULL');
CALL xland_add_column_if_missing('invoices', 'customer_address', 'VARCHAR(500) NULL');
CALL xland_add_column_if_missing('invoices', 'property_code', 'VARCHAR(50) NULL');

CALL xland_add_column_if_missing('payments', 'receipt_id', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('payments', 'property_code', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('payments', 'invoice_number', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('payments', 'estimate_number', 'VARCHAR(50) NULL');

-- ---------------------------------------------------------------------------
-- onboarded_vendors login / KYC / capacity columns
-- (username added without UNIQUE for the same reason as users.user_id)
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('onboarded_vendors', 'username', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'password_hash', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'last_login', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'gst_number', 'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'pan_number', 'VARCHAR(20) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'license_number', 'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'rating', 'DECIMAL(3,2) DEFAULT 0.00');
CALL xland_add_column_if_missing('onboarded_vendors', 'total_jobs_completed', 'INT DEFAULT 0');
CALL xland_add_column_if_missing('onboarded_vendors', 'franchise_partner_id', 'INT NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'working_hours_from', 'VARCHAR(10) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'working_hours_to', 'VARCHAR(10) NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'service_capabilities', 'JSON NULL');
CALL xland_add_column_if_missing('onboarded_vendors', 'max_daily_visits', 'INT DEFAULT 5');
CALL xland_add_column_if_missing('onboarded_vendors', 'preferred_zones', 'JSON NULL');

-- ---------------------------------------------------------------------------
-- schedule_series auto-renewal columns (schema_v28)
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('schedule_series', 'auto_renewal_enabled', "BOOLEAN DEFAULT TRUE COMMENT 'Whether auto-renewal is enabled for this series'");
CALL xland_add_column_if_missing('schedule_series', 'renewal_notice_days', "INT DEFAULT 30 COMMENT 'Days before contract end to trigger renewal notice'");
CALL xland_add_column_if_missing('schedule_series', 'renewal_status', "ENUM('not_applicable', 'pending', 'approved', 'declined', 'renewed') DEFAULT 'not_applicable' COMMENT 'Current renewal status'");
CALL xland_add_column_if_missing('schedule_series', 'renewal_notice_sent_at', "TIMESTAMP NULL COMMENT 'When renewal notice was sent'");
CALL xland_add_column_if_missing('schedule_series', 'renewed_from_series_id', "INT NULL COMMENT 'ID of the original series this was renewed from'");
CALL xland_add_column_if_missing('schedule_series', 'renewed_to_series_id', "INT NULL COMMENT 'ID of the new series created from this renewal'");

-- ---------------------------------------------------------------------------
-- misc
-- ---------------------------------------------------------------------------
CALL xland_add_column_if_missing('property_vendor_assignments', 'service_type', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('service_types', 'created_by_user_id', 'INT NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
