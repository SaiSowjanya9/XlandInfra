-- Units added straight from the service form's Unit / Capacity Unit box with its "Save" row, the
-- same way schema_v38 stores categories added from the Category box. A unit belongs to a unit type
-- (capacity, area, count, manpower, billing) rather than to one pricing method, so a capacity unit
-- saved on a Capacity Slab service is offered on Capacity Based too.
--
-- scope_id 0 is every FP, matching service_catalog; utf8mb4_unicode_ci is case-insensitive, so the
-- unique key also refuses "Litre" beside "litre". backend/utils/serviceUnits.js runs this same
-- statement the first time a unit is saved, so applying it by hand is optional.
CREATE TABLE IF NOT EXISTS service_units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_id INT UNSIGNED NOT NULL DEFAULT 0,
  unit_type VARCHAR(20) NOT NULL,
  name VARCHAR(40) NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_units_name_type_scope (name, unit_type, scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
