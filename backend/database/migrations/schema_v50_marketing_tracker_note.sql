-- Migration: schema_v50 - a free-text note on a marketing tracker row
--
--   tracker_note   the remarks box behind the note bubble in the tracker's Actions column
--
-- One note per tracked estimate, up to 500 characters. TEXT, not VARCHAR(500): the stored form
-- is HTML-escaped (middleware/security.js escapes every request string), so 500 typed characters
-- can arrive longer than 500 -- the limit is judged on the decoded text in
-- backend/routes/marketing.js, the same rule the *_other option fields follow.
--
-- It is its own PUT route (/tracker/:id/note), not a field on the tracker PUT: that route
-- re-sends the whole tracker payload and requires the visit answers, so a note saved through it
-- would fail on a row missing them, and a stale tab that lacks the field would wipe the note.
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/routes/marketing.js also adds this column at runtime
-- (ensureMarketingTrackerColumns), so applying this file by hand is optional but keeps the
-- schema explicit.

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

CALL xland_add_column_if_missing('fp_estimates', 'tracker_note', 'TEXT NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
