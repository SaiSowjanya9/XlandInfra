-- Migration: schema_v48 - marketing tracker follow-up columns on fp_estimates
--
-- The columns the tracker shows after Follow-Up Stage, taken from the
-- "Xland PM - Marketing Follow-Up Tracker" workbook:
--
--   lead_status           where the lead stands (the workbook's 18-value Lead Status list)
--   last_contact_date     stamped with today in IST whenever a follow-up stage is picked
--   last_contact_method   WhatsApp / SMS-Text / Email / Phone Call / Field Visit / Portal Message / Other
--   customer_response     Received - Reviewing / Interested / ... / Not Interested
--   next_follow_up_date   four days after the last contact, and editable
--   next_action           Coordinator Review / Send Thank You Message / ... / Close Lead
--
-- Due Status is NOT stored. It is derived on read from next_follow_up_date and lead_status
-- (backend/utils/marketingFollowUp.js reproduces the workbook's column U formula), because a
-- stored "Due Today" is wrong by the following morning.
--
-- The two dates are DATE, not DATETIME: they are calendar days in IST, and a DATETIME would drag
-- a server timezone into a comparison that is purely about dates.
--
-- Safe to re-run: information_schema is checked before each ALTER.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". backend/routes/franchisePartner.js also adds these columns at
-- runtime (ensureMarketingTrackerColumns), so applying this file by hand is optional but keeps
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

DELIMITER ;

CALL xland_add_column_if_missing('fp_estimates', 'lead_status', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'last_contact_date', 'DATE NULL');
CALL xland_add_column_if_missing('fp_estimates', 'last_contact_method', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'customer_response', 'VARCHAR(60) NULL');
CALL xland_add_column_if_missing('fp_estimates', 'next_follow_up_date', 'DATE NULL');
CALL xland_add_column_if_missing('fp_estimates', 'next_action', 'VARCHAR(60) NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;

-- The dashboard counts Overdue / Due Today / Upcoming per partner off next_follow_up_date, so the
-- lookup is worth an index once a partner has a few hundred tracked estimates.
SET @idx := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'fp_estimates'
     AND index_name = 'idx_fp_estimates_next_follow_up'
);
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_fp_estimates_next_follow_up ON fp_estimates (franchise_partner_id, next_follow_up_date)',
  'SELECT ''index already present'' AS result');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
