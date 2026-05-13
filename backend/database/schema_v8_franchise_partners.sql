-- Franchise Partner Portal Database Schema V8
-- PM Software - Franchise Partner Data Isolation
-- All FP-related data must be scoped by franchise_partner_id

-- ============================================
-- FRANCHISE PARTNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS franchise_partners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fp_code VARCHAR(50) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  -- Business Details
  gst_number VARCHAR(50),
  pan_number VARCHAR(20),
  agreement_start_date DATE,
  agreement_end_date DATE,
  territory_zones JSON,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP NULL,
  -- Tracking
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- ADD franchise_partner_id TO EXISTING TABLES
-- ============================================

-- Add to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS franchise_partner_id INT NULL;
ALTER TABLE properties ADD CONSTRAINT fk_properties_fp FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE SET NULL;

-- Add to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS franchise_partner_id INT NULL;
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_fp FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE SET NULL;

-- Add to clients/customers table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS franchise_partner_id INT NULL;
ALTER TABLE clients ADD CONSTRAINT fk_clients_fp FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE SET NULL;

-- Add to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS franchise_partner_id INT NULL;
ALTER TABLE estimates ADD CONSTRAINT fk_estimates_fp FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE SET NULL;

-- Add to work_orders table
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS franchise_partner_id INT NULL;
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_fp FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE SET NULL;

-- Add to schedules table
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS franchise_partner_id INT NULL;
ALTER TABLE schedules ADD CONSTRAINT fk_schedules_fp FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE SET NULL;

-- ============================================
-- FP EMPLOYEES TABLE (Staff under FP)
-- ============================================
CREATE TABLE IF NOT EXISTS fp_employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  employee_code VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  role ENUM('fp_manager', 'fp_supervisor', 'fp_executive') NOT NULL DEFAULT 'fp_executive',
  -- Login credentials (optional - for FP-level users)
  username VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  -- Zones assigned
  assigned_zones JSON,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  UNIQUE KEY unique_fp_employee_code (franchise_partner_id, employee_code)
);

-- ============================================
-- FP USERS TABLE (Portal users under FP)
-- ============================================
CREATE TABLE IF NOT EXISTS fp_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role ENUM('fp_admin', 'fp_manager', 'fp_supervisor', 'fp_executive') NOT NULL DEFAULT 'fp_executive',
  -- Permissions (can override role defaults)
  can_view BOOLEAN DEFAULT TRUE,
  can_create BOOLEAN DEFAULT NULL,
  can_edit BOOLEAN DEFAULT NULL,
  can_delete BOOLEAN DEFAULT NULL,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  UNIQUE KEY unique_fp_username (franchise_partner_id, username),
  UNIQUE KEY unique_fp_email (franchise_partner_id, email)
);

-- ============================================
-- FP ASSIGNED VENDORS (Vendors assigned to FP)
-- ============================================
CREATE TABLE IF NOT EXISTS fp_assigned_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  vendor_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_fp_vendor (franchise_partner_id, vendor_id)
);

-- ============================================
-- FP AMC PACKAGES (Custom AMC packages for FP)
-- ============================================
CREATE TABLE IF NOT EXISTS fp_amc_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  package_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_months INT DEFAULT 12,
  base_price DECIMAL(12,2) DEFAULT 0.00,
  services JSON,
  terms_conditions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  UNIQUE KEY unique_fp_package_code (franchise_partner_id, package_code)
);

-- ============================================
-- FP ADDONS (Custom add-ons for FP)
-- ============================================
CREATE TABLE IF NOT EXISTS fp_addons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  addon_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12,2) DEFAULT 0.00,
  unit VARCHAR(50) DEFAULT 'per_service',
  category_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  UNIQUE KEY unique_fp_addon_code (franchise_partner_id, addon_code)
);

-- ============================================
-- FP EMPLOYEE ZONES (Zone assignments for FP employees)
-- ============================================
CREATE TABLE IF NOT EXISTS fp_employee_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  fp_employee_id INT NOT NULL,
  zone_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  FOREIGN KEY (fp_employee_id) REFERENCES fp_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
  UNIQUE KEY unique_fp_employee_zone (fp_employee_id, zone_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_fp_active ON franchise_partners(is_active);
CREATE INDEX idx_fp_code ON franchise_partners(fp_code);
CREATE INDEX idx_properties_fp ON properties(franchise_partner_id);
CREATE INDEX idx_vendors_fp ON vendors(franchise_partner_id);
CREATE INDEX idx_clients_fp ON clients(franchise_partner_id);
CREATE INDEX idx_estimates_fp ON estimates(franchise_partner_id);
CREATE INDEX idx_work_orders_fp ON work_orders(franchise_partner_id);
CREATE INDEX idx_schedules_fp ON schedules(franchise_partner_id);
CREATE INDEX idx_fp_employees_fp ON fp_employees(franchise_partner_id);
CREATE INDEX idx_fp_users_fp ON fp_users(franchise_partner_id);
CREATE INDEX idx_fp_assigned_vendors_fp ON fp_assigned_vendors(franchise_partner_id);

-- ============================================
-- INSERT SAMPLE FRANCHISE PARTNER
-- ============================================
-- Note: Replace with actual bcrypt hash in production
-- Generate hash: node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"

INSERT INTO franchise_partners (fp_code, username, email, password_hash, company_name, owner_name, phone, city, state) VALUES
('FP001', 'franchise1', 'franchise1@pmportal.com', '$2a$10$PLACEHOLDER_REPLACE_WITH_REAL_HASH', 'Sample Franchise Co', 'John Franchise', '+91 9876543210', 'Mumbai', 'Maharashtra');
