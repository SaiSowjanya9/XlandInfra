-- Create Estimate asks whether this estimate needs a vendor assigned and its visits scheduled.
--
-- NULL means "not answered", which is how every estimate created before this column existed is
-- stored, and those must keep reaching Pending Property Schedules. Only an explicit 0 keeps a
-- property out of the scheduling queue, so the default is deliberately NULL rather than 0 or 1.
--
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS, so the column is checked in information_schema first.
-- Safe to re-run.

SET @add_column := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE fp_estimates ADD COLUMN assign_vendor TINYINT(1) NULL COMMENT ''1 = assign a vendor and schedule visits, 0 = no scheduling, NULL = answered before this column existed''',
    'SELECT ''fp_estimates.assign_vendor already exists'''
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'fp_estimates' AND column_name = 'assign_vendor'
);
PREPARE stmt FROM @add_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The scheduling feeds filter on it, so an index keeps those queries cheap
SET @add_index := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE fp_estimates ADD INDEX idx_fp_estimates_assign_vendor (assign_vendor)',
    'SELECT ''idx_fp_estimates_assign_vendor already exists'''
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'fp_estimates' AND index_name = 'idx_fp_estimates_assign_vendor'
);
PREPARE stmt FROM @add_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
