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
