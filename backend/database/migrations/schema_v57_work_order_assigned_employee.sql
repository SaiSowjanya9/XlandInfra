-- Migration: schema_v57 - work_orders.assigned_employee_id
--
-- The Manager and Coordinator work-order lists both offer "Assign Employee", and both routes
-- (PATCH /api/manager/work-orders/:id/assign-employee, PATCH /api/coordinator/...) write
-- `work_orders.assigned_employee_id` -- a column no CREATE TABLE or migration ever created, so
-- the assignment failed with "Unknown column 'assigned_employee_id' in 'field list'". The
-- Manager route also ensures the column at runtime; this file is the same repair for a
-- privileged user.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". Idempotency is achieved by checking information_schema
-- before the ALTER, so this file is safe to re-run.

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

-- The fp_employees.id of the employee the work order is assigned to
CALL xland_add_column_if_missing('work_orders', 'assigned_employee_id', 'INT NULL');

-- properties.division: written by the Manager's POST /properties and read by its work-order
-- create (COALESCE(division_id, division)); only the FP property route ALTERed it in at runtime.
-- The backend now also ensures it at boot (config/database.js).
CALL xland_add_column_if_missing('properties', 'division', 'VARCHAR(100) NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
