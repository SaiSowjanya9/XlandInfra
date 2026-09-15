-- Migration: Add visible_password + must_change_password to fp_employees
--
-- fp_employees was missing the admin-visible password column that users and
-- franchise_partners already have. Required by the FP employee email change
-- flow in routes/franchisePartner.js, which writes both columns.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS". Idempotency is achieved by checking
-- information_schema first, so this file is safe to re-run.

DELIMITER $$

DROP PROCEDURE IF EXISTS xland_add_fp_employee_password_cols $$
CREATE PROCEDURE xland_add_fp_employee_password_cols()
BEGIN
  DECLARE tbl_count INT DEFAULT 0;
  DECLARE col_count INT DEFAULT 0;

  SELECT COUNT(*) INTO tbl_count
    FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'fp_employees';

  IF tbl_count = 0 THEN
    SELECT 'skip: fp_employees table does not exist' AS result;
  ELSE
    SELECT COUNT(*) INTO col_count
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'fp_employees'
       AND column_name = 'visible_password';
    IF col_count = 0 THEN
      ALTER TABLE fp_employees ADD COLUMN visible_password VARCHAR(255) NULL;
      SELECT 'added: fp_employees.visible_password' AS result;
    END IF;

    SELECT COUNT(*) INTO col_count
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'fp_employees'
       AND column_name = 'must_change_password';
    IF col_count = 0 THEN
      ALTER TABLE fp_employees ADD COLUMN must_change_password BOOLEAN DEFAULT TRUE;
      SELECT 'added: fp_employees.must_change_password' AS result;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL xland_add_fp_employee_password_cols();
DROP PROCEDURE IF EXISTS xland_add_fp_employee_password_cols;
