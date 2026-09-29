-- Categories added straight from the service form's Category box. Every other source of a category
-- is a side effect of saving something else (a service, an estimate, a package), so a name typed
-- and saved on its own had nowhere to live: this table is that place, and it is the only source a
-- category can be deleted from again.
--
-- scope_id 0 is every FP, matching service_catalog; utf8mb4_unicode_ci is case-insensitive, so the
-- unique key also refuses "Slab 2" beside "slab 2".
CREATE TABLE IF NOT EXISTS service_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_id INT UNSIGNED NOT NULL DEFAULT 0,
  name VARCHAR(100) NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_categories_name_scope (name, scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
