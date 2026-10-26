-- Migration: schema_v59 - fp_zones
--
-- The zone pickers and "create zone" routes of the FP, Manager, Coordinator, Supervisor and
-- Executive portals all read and write fp_zones, and utils/zoneDelete.js deletes from it, but no
-- CREATE TABLE or migration ever created it. On a database built from this repo every
-- POST .../zones failed with "Table 'fp_zones' doesn't exist", so a zone typed into Add Customer
-- or a property form was never saved as a zone. The backend also creates it at boot
-- (config/database.js); this file is the same repair for a privileged user.
--
-- CREATE TABLE IF NOT EXISTS is valid MySQL 8 and safe to re-run.

CREATE TABLE IF NOT EXISTS fp_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  franchise_partner_id INT DEFAULT NULL,
  manager_id INT DEFAULT NULL,
  coordinator_id INT DEFAULT NULL,
  supervisor_id INT DEFAULT NULL,
  executive_id INT DEFAULT NULL,
  created_by VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fp_zones_fp (franchise_partner_id),
  INDEX idx_fp_zones_name (name)
);
