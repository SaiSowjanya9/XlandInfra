-- ============================================
-- Schema v40: index qr_scans by visitor
-- ============================================
-- Every figure in QR Management is now counted from qr_scans rather than read from a flag or a
-- roll-up table -- COUNT(DISTINCT visitor_id) for visitors, and one lookup per scan to decide
-- whether this device has been seen before. Both need (qr_id, visitor_id) to be indexed.
--
-- schema_v14_qr_management.sql declares idx_scan_visitor (visitor_id), but the runtime
-- CREATE TABLE in backend/config/database.js never did, so a database created by the server on boot
-- has no index on the column at all.
--
-- MySQL 8 has no CREATE INDEX IF NOT EXISTS, so information_schema decides -- this is safe to
-- re-run. See schema_v29_fix_column_drift.sql for the pattern.
-- ============================================

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_scans' AND INDEX_NAME = 'idx_scan_visitor'
);

SET @sql := IF(@index_exists = 0,
  'CREATE INDEX idx_scan_visitor ON qr_scans (qr_id, visitor_id)',
  'SELECT "idx_scan_visitor already exists" AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- A visitor's first scan is looked up by time as well, when "new visitors today" is counted
SET @date_index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_scans' AND INDEX_NAME = 'idx_scan_date'
);

SET @sql := IF(@date_index_exists = 0,
  'CREATE INDEX idx_scan_date ON qr_scans (scanned_at)',
  'SELECT "idx_scan_date already exists" AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qr_scans'
GROUP BY INDEX_NAME;
