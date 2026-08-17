-- Create residents table if it doesn't exist
-- This table is used for the resident portal (customer app)

CREATE TABLE IF NOT EXISTS residents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id VARCHAR(50) UNIQUE NOT NULL,
  unit_id INT NULL,
  property_id INT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  is_primary_resident BOOLEAN DEFAULT TRUE,
  lease_start_date DATE,
  lease_end_date DATE,
  is_registered BOOLEAN DEFAULT FALSE,
  registration_date TIMESTAMP NULL,
  password_hash VARCHAR(255) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_residents_email (email),
  INDEX idx_residents_property (property_id)
);

-- Also create units table if needed
CREATE TABLE IF NOT EXISTS units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  unit_number VARCHAR(50) NOT NULL,
  floor_number INT,
  unit_type VARCHAR(50),
  bedrooms INT DEFAULT 1,
  bathrooms DECIMAL(3,1) DEFAULT 1,
  square_feet INT,
  rent_amount DECIMAL(10,2),
  is_occupied BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_units_property (property_id)
);
