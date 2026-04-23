-- Schema V4: Onboarding Properties
-- Adds onboarded_properties table for the full onboarding form data
-- and a related property_contacts table for association/client contacts.

USE customer_portal;

-- ============================================
-- ONBOARDED PROPERTIES TABLE
-- Stores every field from the multi-step onboarding form
-- ============================================
CREATE TABLE IF NOT EXISTS onboarded_properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id VARCHAR(50) UNIQUE NOT NULL,       -- e.g. GC-AB12-20250422
  entry_type ENUM('GC','APT','VILLA','PLOT') NOT NULL,
  category VARCHAR(50) DEFAULT 'residential',     -- residential / commercial / vendor

  -- Step 1-5: Core fields
  zone VARCHAR(100) NOT NULL,
  area_name VARCHAR(255) NOT NULL,
  division VARCHAR(100) NOT NULL,
  property_type VARCHAR(255) NOT NULL,             -- sub-type from dropdown
  community_name VARCHAR(255) NOT NULL,

  -- Step 7: Type-specific fields
  number_of_blocks INT DEFAULT NULL,               -- GC only
  block_names JSON DEFAULT NULL,                   -- GC only  {"1":"Block A","2":"Block B"}
  units_per_block JSON DEFAULT NULL,               -- GC only  {"1":24,"2":30}
  block_info VARCHAR(255) DEFAULT NULL,            -- APT only
  block_na BOOLEAN DEFAULT FALSE,                  -- APT only
  number_of_units INT DEFAULT NULL,                -- APT only
  villa_plot_number VARCHAR(100) DEFAULT NULL,     -- VILLA / PLOT only

  -- Computed
  total_units INT DEFAULT 0,

  -- Step 8-9: Address & map
  address TEXT,
  landmark VARCHAR(255),
  map_lat DECIMAL(10,8) DEFAULT NULL,
  map_lng DECIMAL(11,8) DEFAULT NULL,
  map_address TEXT,

  -- Step 10: Notes
  notes TEXT,

  -- Tracking
  status VARCHAR(20) DEFAULT 'active',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- PROPERTY CONTACTS TABLE
-- Association / client contacts attached to onboarded properties
-- ============================================
CREATE TABLE IF NOT EXISTS property_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  country_code VARCHAR(10) DEFAULT '+91',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_onboarded_entry_type ON onboarded_properties(entry_type);
CREATE INDEX idx_onboarded_zone ON onboarded_properties(zone);
CREATE INDEX idx_onboarded_division ON onboarded_properties(division);
CREATE INDEX idx_onboarded_status ON onboarded_properties(status);
CREATE INDEX idx_property_contacts_prop ON property_contacts(property_id);
