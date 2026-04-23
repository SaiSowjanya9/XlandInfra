-- Customer Portal Database Schema V2
-- Includes: Users, Units, Properties, Work Orders, Admin Roles

-- Create database
CREATE DATABASE IF NOT EXISTS customer_portal;
USE customer_portal;

-- Drop existing tables for clean setup (comment out in production)
-- DROP TABLE IF EXISTS attachments;
-- DROP TABLE IF EXISTS work_orders;
-- DROP TABLE IF EXISTS residents;
-- DROP TABLE IF EXISTS units;
-- DROP TABLE IF EXISTS properties;
-- DROP TABLE IF EXISTS admin_users;
-- DROP TABLE IF EXISTS subcategories;
-- DROP TABLE IF EXISTS categories;

-- Properties/Buildings table
CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Units table (apartments/units within properties)
CREATE TABLE IF NOT EXISTS units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  unit_number VARCHAR(50) NOT NULL,
  floor VARCHAR(20),
  bedrooms INT DEFAULT 1,
  bathrooms DECIMAL(3,1) DEFAULT 1,
  square_feet INT,
  is_occupied BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  UNIQUE KEY unique_unit (property_id, unit_number)
);

-- Admin Users table (Admin and Executive roles)
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('admin', 'executive') NOT NULL DEFAULT 'executive',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Residents table (Pre-registered residents by admin)
CREATE TABLE IF NOT EXISTS residents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id VARCHAR(50) UNIQUE NOT NULL,
  unit_id INT NOT NULL,
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
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Work Orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id VARCHAR(50) UNIQUE NOT NULL,
  property_id INT NOT NULL,
  unit_id INT NOT NULL,
  resident_id INT NOT NULL,
  category_id INT NOT NULL,
  subcategory_id INT NOT NULL,
  description TEXT,
  permission_to_enter ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  entry_notes TEXT,
  has_pet ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  assigned_to VARCHAR(255),
  scheduled_date DATETIME,
  completed_date DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

-- Audit Log table (for tracking admin actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100),
  record_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@customerportal.com', '$2b$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'System', 'Admin', 'admin'),
('executive1', 'executive@customerportal.com', '$2b$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'John', 'Executive', 'executive');

-- Insert sample property
INSERT INTO properties (property_id, name, address, city, state, zip_code) VALUES
('PROP-001', 'Sunrise Apartments', '123 Main Street', 'New York', 'NY', '10001'),
('PROP-002', 'Lakeside Residences', '456 Lake Avenue', 'Chicago', 'IL', '60601');

-- Insert sample units for Sunrise Apartments (property_id: 1)
INSERT INTO units (property_id, unit_number, floor, bedrooms, bathrooms, square_feet, is_occupied) VALUES
(1, '101', '1', 1, 1, 650, TRUE),
(1, '102', '1', 2, 1, 850, TRUE),
(1, '103', '1', 2, 2, 950, FALSE),
(1, '201', '2', 1, 1, 650, TRUE),
(1, '202', '2', 2, 1, 850, FALSE),
(1, '203', '2', 3, 2, 1100, TRUE),
(1, '301', '3', 1, 1, 650, FALSE),
(1, '302', '3', 2, 2, 950, TRUE);

-- Insert sample units for Lakeside Residences (property_id: 2)
INSERT INTO units (property_id, unit_number, floor, bedrooms, bathrooms, square_feet, is_occupied) VALUES
(2, 'A1', '1', 1, 1, 700, TRUE),
(2, 'A2', '1', 2, 1, 900, TRUE),
(2, 'B1', '2', 2, 2, 1000, FALSE),
(2, 'B2', '2', 3, 2, 1200, TRUE);

-- Insert sample residents (pre-registered by admin)
INSERT INTO residents (resident_id, unit_id, email, first_name, last_name, phone, is_registered, lease_start_date, lease_end_date) VALUES
('RES-001', 1, 'sam.wilson@email.com', 'Sam', 'Wilson', '555-0101', FALSE, '2024-01-01', '2025-01-01'),
('RES-002', 2, 'mary.jones@email.com', 'Mary', 'Jones', '555-0102', FALSE, '2024-02-01', '2025-02-01'),
('RES-003', 4, 'john.smith@email.com', 'John', 'Smith', '555-0104', FALSE, '2024-03-01', '2025-03-01'),
('RES-004', 6, 'alice.brown@email.com', 'Alice', 'Brown', '555-0106', FALSE, '2024-01-15', '2025-01-15'),
('RES-005', 8, 'bob.davis@email.com', 'Bob', 'Davis', '555-0108', FALSE, '2024-04-01', '2025-04-01'),
('RES-006', 9, 'carol.white@email.com', 'Carol', 'White', '555-0201', FALSE, '2024-02-15', '2025-02-15'),
('RES-007', 10, 'david.miller@email.com', 'David', 'Miller', '555-0202', FALSE, '2024-03-15', '2025-03-15'),
('RES-008', 12, 'emma.taylor@email.com', 'Emma', 'Taylor', '555-0204', FALSE, '2024-05-01', '2025-05-01');

-- Insert categories
INSERT INTO categories (id, name, sort_order) VALUES
(1, 'Lifts', 1),
(2, 'Drainage', 2),
(3, 'Septic Cleaning', 3),
(4, 'Generator', 4),
(5, 'Water Tank Cleaning', 5),
(6, 'AC', 6),
(7, 'Electrical', 7),
(8, 'Plumbing', 8),
(9, 'Appliances', 9),
(10, 'Building Exterior', 10),
(11, 'Building Interior', 11),
(12, 'Flooring', 12),
(13, 'Locks / Keys', 13),
(14, 'Painting', 14),
(15, 'Pest Control', 15),
(16, 'Water Purification', 16),
(17, 'Hot Water Geyser', 17),
(18, 'Other', 18);

-- Insert subcategories for all categories
-- Lifts
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(1, 'Elevator Maintenance', 1), (1, 'Lift Motor Repair', 2), (1, 'Door Mechanism', 3),
(1, 'Control Panel', 4), (1, 'Safety Sensors', 5), (1, 'Lift Cables', 6),
(1, 'Emergency Phone', 7), (1, 'Other', 8);

-- Drainage
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(2, 'Blocked Drain', 1), (2, 'Slow Drainage', 2), (2, 'Drain Cleaning', 3),
(2, 'Pipe Repair', 4), (2, 'Drain Inspection', 5), (2, 'Storm Drain', 6),
(2, 'Floor Drain', 7), (2, 'Other', 8);

-- Septic Cleaning
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(3, 'Septic Tank Pumping', 1), (3, 'Tank Inspection', 2), (3, 'Drain Field Repair', 3),
(3, 'Septic System Maintenance', 4), (3, 'Odor Issues', 5), (3, 'Backup Problems', 6), (3, 'Other', 7);

-- Generator
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(4, 'Generator Maintenance', 1), (4, 'Fuel System', 2), (4, 'Battery Replacement', 3),
(4, 'Electrical Connections', 4), (4, 'Noise Issues', 5), (4, 'Start-up Problems', 6),
(4, 'Transfer Switch', 7), (4, 'Other', 8);

-- Water Tank Cleaning
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(5, 'Tank Sanitization', 1), (5, 'Sediment Removal', 2), (5, 'Tank Inspection', 3),
(5, 'Leak Repair', 4), (5, 'Valve Replacement', 5), (5, 'Float Adjustment', 6), (5, 'Other', 7);

-- AC
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(6, 'AC Not Cooling', 1), (6, 'AC Not Turning On', 2), (6, 'Strange Noises', 3),
(6, 'Water Leakage', 4), (6, 'Gas Refilling', 5), (6, 'Filter Cleaning', 6),
(6, 'Compressor Issues', 7), (6, 'Thermostat Problems', 8), (6, 'Duct Cleaning', 9),
(6, 'Installation', 10), (6, 'Other', 11);

-- Electrical
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(7, 'Power Outage', 1), (7, 'Circuit Breaker', 2), (7, 'Wiring Issues', 3),
(7, 'Switch Replacement', 4), (7, 'Outlet Installation', 5), (7, 'Light Fixture', 6),
(7, 'Fan Installation', 7), (7, 'Electrical Panel', 8), (7, 'Grounding Issues', 9), (7, 'Other', 10);

-- Plumbing
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(8, 'Leaky Faucet', 1), (8, 'Clogged Toilet', 2), (8, 'Pipe Leak', 3),
(8, 'Water Heater', 4), (8, 'Low Water Pressure', 5), (8, 'Running Toilet', 6),
(8, 'Garbage Disposal', 7), (8, 'Sump Pump', 8), (8, 'Water Line', 9), (8, 'Other', 10);

-- Appliances
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(9, 'Oven', 1), (9, 'Refrigerator', 2), (9, 'Washer', 3), (9, 'Dryer', 4),
(9, 'Dishwasher', 5), (9, 'Microwave', 6), (9, 'Garbage Disposal', 7),
(9, 'Range Hood', 8), (9, 'Ice Maker', 9), (9, 'Freezer', 10), (9, 'Other', 11);

-- Building Exterior
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(10, 'Roof Repair', 1), (10, 'Gutter Cleaning', 2), (10, 'Siding Repair', 3),
(10, 'Window Repair', 4), (10, 'Door Repair', 5), (10, 'Deck/Patio', 6),
(10, 'Fence Repair', 7), (10, 'Driveway', 8), (10, 'Landscaping', 9), (10, 'Other', 10);

-- Building Interior
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(11, 'Wall Repair', 1), (11, 'Ceiling Repair', 2), (11, 'Door Adjustment', 3),
(11, 'Window Treatment', 4), (11, 'Cabinet Repair', 5), (11, 'Countertop', 6),
(11, 'Staircase', 7), (11, 'Handrail', 8), (11, 'Other', 9);

-- Flooring
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(12, 'Tile Repair', 1), (12, 'Hardwood Repair', 2), (12, 'Carpet Repair', 3),
(12, 'Laminate Flooring', 4), (12, 'Vinyl Flooring', 5), (12, 'Grout Repair', 6),
(12, 'Floor Polishing', 7), (12, 'Subfloor Issues', 8), (12, 'Other', 9);

-- Locks / Keys
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(13, 'Lock Replacement', 1), (13, 'Key Duplication', 2), (13, 'Lock Repair', 3),
(13, 'Deadbolt Installation', 4), (13, 'Smart Lock', 5), (13, 'Lockout Service', 6),
(13, 'Rekeying', 7), (13, 'Safe Opening', 8), (13, 'Other', 9);

-- Painting
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(14, 'Interior Painting', 1), (14, 'Exterior Painting', 2), (14, 'Touch-up Work', 3),
(14, 'Wallpaper Removal', 4), (14, 'Wallpaper Installation', 5), (14, 'Staining', 6),
(14, 'Primer Application', 7), (14, 'Other', 8);

-- Pest Control
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(15, 'Ants', 1), (15, 'Cockroaches', 2), (15, 'Termites', 3), (15, 'Rodents', 4),
(15, 'Bed Bugs', 5), (15, 'Mosquitoes', 6), (15, 'Flies', 7), (15, 'Spiders', 8),
(15, 'Wasps/Bees', 9), (15, 'General Inspection', 10), (15, 'Other', 11);

-- Water Purification
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(16, 'Filter Replacement', 1), (16, 'RO System Maintenance', 2), (16, 'UV Purifier', 3),
(16, 'Water Softener', 4), (16, 'Installation', 5), (16, 'Water Testing', 6),
(16, 'Membrane Replacement', 7), (16, 'Other', 8);

-- Hot Water Geyser
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(17, 'No Hot Water', 1), (17, 'Water Too Hot', 2), (17, 'Leaking', 3),
(17, 'Strange Noises', 4), (17, 'Thermostat Issues', 5), (17, 'Element Replacement', 6),
(17, 'Tank Replacement', 7), (17, 'Installation', 8), (17, 'Other', 9);

-- Other
INSERT INTO subcategories (category_id, name, sort_order) VALUES
(18, 'General Maintenance', 1), (18, 'Inspection Request', 2),
(18, 'Custom Request', 3), (18, 'Other', 4);
