-- Migration: schema_v47 - marketing complaint forms
--
-- The FP portal's Marketing > Complaint Form screen logs a customer complaint against a property:
-- property id, zone, responsible person, the concern category (with free text when it is "Other"),
-- contact person, phone and comments. archived_at is the soft delete: a deleted complaint leaves
-- the form's list and lands in Marketing > Archived under its own tab, restorable from there.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is supported on MySQL 8.
--
-- IMPORTANT: backend/routes/franchisePartner.js also creates this table at runtime
-- (ensureMarketingComplaintsTable), so applying this file by hand is optional but keeps the
-- schema explicit.

CREATE TABLE IF NOT EXISTS fp_marketing_complaints (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  franchise_partner_id INT NOT NULL,
  property_id VARCHAR(255) NOT NULL,
  zone VARCHAR(255) NOT NULL,
  responsible_person VARCHAR(255) NOT NULL,
  concern_with VARCHAR(100) NOT NULL,
  concern_with_other VARCHAR(255) NULL,
  contact_person_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  comments TEXT NOT NULL,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fp_marketing_complaints_fp (franchise_partner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
