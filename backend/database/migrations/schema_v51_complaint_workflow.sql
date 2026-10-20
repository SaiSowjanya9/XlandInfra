-- Migration: schema_v51 - the complaint workflow (assignment, status, note)
--
-- A complaint stopped being a record and became a piece of work: the FP assigns it to one
-- zone-centric employee, that employee works it and saves a note, and the FP or its manager
-- verifies and closes it -- at which point it lands in Marketing > Archived.
--
--   status                  Open -> Assigned -> In Progress -> Reviewed -> Closed
--   assigned_employee_*     the one dedicated assignee (fp_employees.id, with the name and role
--                           stamped at assignment so a renamed or removed employee still reads)
--   assigned_at/assigned_by who handed it over, and when
--   complaint_note          the remarks box behind the note bubble in the Actions column, the
--                           same feature the marketing tracker's tracker_note is
--   note_updated_*          who last saved that note, and when -- an FP reading an employee's
--   status_updated_*        notes needs to know whose they are; likewise for the status
--   closed_at/closed_by     closing also sets archived_at, so Closed and archived never disagree
--
-- complaint_note is TEXT, not VARCHAR(500): the stored form is HTML-escaped
-- (middleware/security.js escapes every request string), so 500 typed characters can arrive
-- longer -- the limit is judged on the decoded text in backend/utils/marketingComplaints.js.
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/utils/marketingComplaints.js also adds these columns at
-- runtime (ensureMarketingComplaintsTable), so applying this file by hand is optional but keeps
-- the schema explicit.

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

DROP PROCEDURE IF EXISTS xland_add_index_if_missing $$
CREATE PROCEDURE xland_add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  DECLARE idx_count INT DEFAULT 0;

  SELECT COUNT(*) INTO idx_count
    FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index;

  IF idx_count = 0 THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('added index: ', p_table, '.', p_index) AS result;
  END IF;
END $$

DELIMITER ;

CALL xland_add_column_if_missing('fp_marketing_complaints', 'status', "VARCHAR(40) NOT NULL DEFAULT 'Open'");
CALL xland_add_column_if_missing('fp_marketing_complaints', 'assigned_employee_id', 'INT NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'assigned_employee_name', 'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'assigned_employee_role', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'assigned_at', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'assigned_by', 'VARCHAR(150) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'complaint_note', 'TEXT NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'note_updated_by', 'VARCHAR(150) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'note_updated_by_role', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'note_updated_at', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'status_updated_by', 'VARCHAR(150) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'status_updated_by_role', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'status_updated_at', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'closed_at', 'TIMESTAMP NULL');
CALL xland_add_column_if_missing('fp_marketing_complaints', 'closed_by', 'VARCHAR(150) NULL');

-- The assignee's own portal lists complaints by this column, and an assignee sees their rows even
-- outside their zones, so it is read on its own rather than only beside franchise_partner_id.
CALL xland_add_index_if_missing('fp_marketing_complaints', 'idx_fp_marketing_complaints_assignee', '`assigned_employee_id`');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
DROP PROCEDURE IF EXISTS xland_add_index_if_missing;

-- ============================================
-- THE EMPLOYEE TABLES THE ASSIGNMENT READS
-- ============================================
--
-- Not strictly part of the complaint workflow, but it is what the assignment picker reads, and both
-- columns below are broken in ways that break features far older than this one. Found by running
-- the workflow against the local database, which still carried the original definitions.
--
-- 1. fp_employees.role -- ENUM -> VARCHAR
--
-- schema_v8 declared it ENUM('fp_manager','fp_supervisor','fp_executive') while the FP's Add
-- Employee form has long sent 'manager', 'coordinator', 'supervisor' and 'executive'. MySQL answers
-- WARN_DATA_TRUNCATED (errno 1265) for every one of them, so where the original column survives NO
-- employee can be created at all -- and a coordinator cannot exist even in principle, which would
-- leave the assignment picker empty. A VARCHAR holds every value the ENUM did.
SET @role_is_enum = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'fp_employees'
     AND column_name = 'role'
     AND data_type = 'enum'
);
SET @role_ddl = IF(@role_is_enum > 0,
  "ALTER TABLE fp_employees MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'executive'",
  'SELECT ''skip: fp_employees.role is already a VARCHAR'' AS result');
PREPARE stmt FROM @role_ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. fp_employee_zones.zone_id -- NOT NULL -> NULL
--
-- A zone is a *name* merged from several sources (see backend/utils/zoneDelete.js), so the zone
-- routes insert (franchise_partner_id, fp_employee_id, zone_name) and have no id to put in
-- zone_id -- which schema_v8 made NOT NULL with no default. Every assignment therefore failed with
-- ER_NO_DEFAULT_FOR_FIELD (errno 1364), which silently left zone-centric access inert: an employee
-- with no rows here falls back to "own records only" on every screen. schema_v29 added zone_name
-- but left zone_id alone. A nullable column still satisfies its foreign key.
SET @zone_id_required = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'fp_employee_zones'
     AND column_name = 'zone_id'
     AND is_nullable = 'NO'
);
SET @zone_ddl = IF(@zone_id_required > 0,
  'ALTER TABLE fp_employee_zones MODIFY COLUMN zone_id INT NULL',
  'SELECT ''skip: fp_employee_zones.zone_id is already nullable'' AS result');
PREPARE stmt FROM @zone_ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
