-- Migration: schema_v30 - estimates section drift
--
-- Continuation of schema_v29. Rebuilding the database from the repository
-- leaves the Super Admin Estimates section unusable, because these objects
-- are queried by application code but created by no schema file:
--
--   /api/amc-packages   -> Table 'amc_packages' doesn't exist
--   /api/addons         -> Table 'addons' doesn't exist
--   /api/estimates-sync -> Unknown column 'is_active' in 'where clause'
--
-- The estimates table in schema.sql only has the invoice-style columns
-- (title, subtotal, tax_amount, ...) while routes/estimatesSync.js writes a
-- flat estimate (customer_*, property_*, services, addons, total, ...).
--
-- Existing deployments already have these (added ad-hoc), which is why the
-- live site works. Safe to re-run: information_schema is checked first.
--
-- IMPORTANT: written for MySQL 8, which does NOT support MariaDB's
-- "ADD COLUMN IF NOT EXISTS".

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

-- AMC packages catalogue (routes/amcPackages.js)
CREATE TABLE IF NOT EXISTS amc_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id VARCHAR(100) NOT NULL UNIQUE,
  package_name VARCHAR(255) NOT NULL,
  property_type VARCHAR(50) NULL,
  services TEXT NULL,
  service_rows JSON NULL,
  rate DECIMAL(12,2) DEFAULT 0,
  billing_duration VARCHAR(50) DEFAULT 'yearly',
  status VARCHAR(50) DEFAULT 'active',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_amc_packages_property_type (property_type),
  INDEX idx_amc_packages_is_active (is_active)
);

-- Add-on services catalogue (routes/addons.js)
CREATE TABLE IF NOT EXISTS addons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  addon_id VARCHAR(100) NOT NULL UNIQUE,
  property_type VARCHAR(50) NULL,
  property_type_name VARCHAR(100) NULL,
  service_name VARCHAR(255) NULL,
  frequency_count INT DEFAULT 1,
  frequency_type VARCHAR(50) DEFAULT 'Monthly',
  billing_cycle VARCHAR(50) DEFAULT 'Monthly',
  price DECIMAL(12,2) DEFAULT 0,
  total_price DECIMAL(12,2) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addons_property_type (property_type),
  INDEX idx_addons_is_active (is_active)
);

-- Lifecycle flags read by every estimates-sync query
CALL xland_add_column_if_missing('estimates', 'is_active',     'TINYINT(1) DEFAULT 1');
CALL xland_add_column_if_missing('estimates', 'is_archived',   'TINYINT(1) DEFAULT 0');
CALL xland_add_column_if_missing('estimates', 'estimate_type', "VARCHAR(30) DEFAULT 'direct'");
CALL xland_add_column_if_missing('estimates', 'action_token',  'VARCHAR(100) NULL');
CALL xland_add_column_if_missing('estimates', 'actioned_at',   'DATETIME NULL');

-- Customer / property snapshot written on estimate creation
CALL xland_add_column_if_missing('estimates', 'customer_name',    'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('estimates', 'customer_email',   'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('estimates', 'customer_phone',   'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('estimates', 'property_type',    'VARCHAR(50) NULL');
CALL xland_add_column_if_missing('estimates', 'property_name',    'VARCHAR(255) NULL');
CALL xland_add_column_if_missing('estimates', 'property_address', 'TEXT NULL');

-- Line items and totals (the flat shape used by the admin portal)
CALL xland_add_column_if_missing('estimates', 'services',         'LONGTEXT NULL');
CALL xland_add_column_if_missing('estimates', 'addons',           'LONGTEXT NULL');
CALL xland_add_column_if_missing('estimates', 'package_services', 'JSON NULL');
CALL xland_add_column_if_missing('estimates', 'discount',         'DECIMAL(12,2) DEFAULT 0');
CALL xland_add_column_if_missing('estimates', 'tax',              'DECIMAL(12,2) DEFAULT 0');
CALL xland_add_column_if_missing('estimates', 'total',            'DECIMAL(12,2) DEFAULT 0');
CALL xland_add_column_if_missing('estimates', 'notes',            'TEXT NULL');

DROP PROCEDURE IF EXISTS xland_add_column_if_missing;
