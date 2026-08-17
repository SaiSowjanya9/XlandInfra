-- Work Orders Schema V6
-- PM Software - Work Orders with Categories & Subcategories
-- Run this after the base schema

USE customer_portal;

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SUBCATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subcategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ============================================
-- RESIDENTS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS residents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id VARCHAR(50) UNIQUE NOT NULL,
  unit_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  is_primary_resident BOOLEAN DEFAULT TRUE,
  lease_start_date DATE,
  lease_end_date DATE,
  is_registered BOOLEAN DEFAULT FALSE,
  registration_date TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- WORK ORDERS TABLE (Updated)
-- ============================================
CREATE TABLE IF NOT EXISTS work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id VARCHAR(50) UNIQUE NOT NULL,
  -- Resident/Customer Info
  resident_id INT,
  property_id INT,
  unit_id INT,
  -- Category Info
  category_id INT NOT NULL,
  subcategory_id INT,
  category_name VARCHAR(100),
  subcategory_name VARCHAR(100),
  -- Work Order Details
  description TEXT,
  permission_to_enter ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  entry_notes TEXT,
  has_pet ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  -- Status: pending, assigned, in_progress, completed, closed, cancelled
  status ENUM('pending', 'assigned', 'in_progress', 'completed', 'closed', 'cancelled') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  -- Assignment
  assigned_vendor_id INT,
  assigned_at TIMESTAMP NULL,
  assigned_by INT,
  -- Scheduling
  scheduled_date DATETIME,
  completed_date DATETIME,
  -- Notes
  admin_notes TEXT,
  vendor_notes TEXT,
  -- Source: customer (from resident portal), admin (from admin portal)
  source ENUM('customer', 'admin') DEFAULT 'customer',
  -- Tracking
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- WORK ORDER ATTACHMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS work_order_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INT,
  file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

-- ============================================
-- WORK ORDER STATUS HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS work_order_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by INT,
  changed_by_type ENUM('admin', 'vendor', 'system') DEFAULT 'admin',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
);

-- ============================================
-- ADMIN USERS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role ENUM('admin', 'manager', 'supervisor', 'executive') NOT NULL DEFAULT 'executive',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- INSERT DEFAULT CATEGORIES
-- ============================================
INSERT IGNORE INTO categories (id, name, sort_order) VALUES
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
(17, 'Hot Water Geyser', 17);

-- ============================================
-- INSERT SUBCATEGORIES
-- ============================================

-- Lifts (category_id = 1)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(101, 1, 'Stopped', 1),
(102, 1, 'Not moving', 2),
(103, 1, 'Door stuck', 3),
(104, 1, 'Unusual noise', 4),
(105, 1, 'Emergency alarm issue', 5),
(106, 1, 'Lift shaking / jerking', 6),
(199, 1, 'Other', 7);

-- Drainage (category_id = 2)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(201, 2, 'Drain blocked', 1),
(202, 2, 'Slow drainage', 2),
(203, 2, 'Drain overflow', 3),
(204, 2, 'Backflow issue', 4),
(205, 2, 'Rainwater not clearing', 5),
(206, 2, 'Pipe damage', 6),
(299, 2, 'Other', 7);

-- Septic Cleaning (category_id = 3)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(301, 3, 'Septic tank full', 1),
(302, 3, 'Bad smell', 2),
(303, 3, 'Overflow', 3),
(304, 3, 'Blockage', 4),
(305, 3, 'Slow outflow', 5),
(306, 3, 'Leakage around the tank', 6),
(307, 3, 'Cleaning required', 7),
(308, 3, 'Inspection required', 8),
(309, 3, 'Lid damage', 9),
(310, 3, 'Emergency service needed', 10),
(399, 3, 'Other', 11);

-- Generator (category_id = 4)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(401, 4, 'Not starting', 1),
(402, 4, 'Low power output', 2),
(403, 4, 'Fuel leakage', 3),
(404, 4, 'Battery problem', 4),
(405, 4, 'Unusual noise', 5),
(406, 4, 'Smoke issue', 6),
(407, 4, 'Auto start not working', 7),
(408, 4, 'Overheating', 8),
(409, 4, 'Service due', 9),
(410, 4, 'Electrical trip issue', 10),
(499, 4, 'Other', 11);

-- Water Tank Cleaning (category_id = 5)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(501, 5, 'Cleaning required', 1),
(502, 5, 'Dirty water', 2),
(503, 5, 'Bad smell', 3),
(504, 5, 'Algae formation', 4),
(505, 5, 'Tank leakage', 5),
(506, 5, 'Inlet problem', 6),
(507, 5, 'Outlet problem', 7),
(508, 5, 'Lid damage', 8),
(509, 5, 'Overflow issue', 9),
(599, 5, 'Other', 10);

-- AC (category_id = 6)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(601, 6, 'Not cooling', 1),
(602, 6, 'Low cooling', 2),
(603, 6, 'Water leakage', 3),
(604, 6, 'Not turning on', 4),
(605, 6, 'Unusual noise', 5),
(606, 6, 'Bad smell', 6),
(607, 6, 'Remote not working', 7),
(608, 6, 'Gas refill needed', 8),
(609, 6, 'Airflow issue', 9),
(610, 6, 'Service/maintenance required', 10),
(699, 6, 'Other', 11);

-- Electrical (category_id = 7)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(701, 7, 'Power outage', 1),
(702, 7, 'Switch not working', 2),
(703, 7, 'Socket not working', 3),
(704, 7, 'MCB tripping', 4),
(705, 7, 'Light not working', 5),
(706, 7, 'Fan not working', 6),
(707, 7, 'Wiring issue', 7),
(708, 7, 'Burning smell', 8),
(709, 7, 'Short circuit issue', 9),
(710, 7, 'New electrical work is needed', 10),
(799, 7, 'Other', 11);

-- Plumbing (category_id = 8)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(801, 8, 'Water leakage', 1),
(802, 8, 'Tap issue', 2),
(803, 8, 'Pipe burst', 3),
(804, 8, 'Low water pressure', 4),
(805, 8, 'Drain blockage', 5),
(806, 8, 'Flush not working', 6),
(807, 8, 'Sink problem', 7),
(808, 8, 'Toilet problem', 8),
(809, 8, 'Valve issue', 9),
(810, 8, 'New plumbing work is needed', 10),
(899, 8, 'Other', 11);

-- Appliances (category_id = 9)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(901, 9, 'Not working', 1),
(902, 9, 'Not turning on', 2),
(903, 9, 'Unusual noise', 3),
(904, 9, 'Button/control issue', 4),
(905, 9, 'Installation needed', 5),
(906, 9, 'Service required', 6),
(999, 9, 'Other', 7);

-- Building Exterior (category_id = 10)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1001, 10, 'Wall damage', 1),
(1002, 10, 'Roof leakage', 2),
(1003, 10, 'Window issue', 3),
(1004, 10, 'Door issue', 4),
(1005, 10, 'Parking area issue', 5),
(1006, 10, 'Gate/fence issue', 6),
(1007, 10, 'Lighting issue', 7),
(1099, 10, 'Other', 8);

-- Building Interior (category_id = 11)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1101, 11, 'Wall damage', 1),
(1102, 11, 'Ceiling issue', 2),
(1103, 11, 'Door issue', 3),
(1104, 11, 'Window issue', 4),
(1105, 11, 'Staircase issue', 5),
(1106, 11, 'Handrail issue', 6),
(1107, 11, 'Common area issue', 7),
(1199, 11, 'Other', 8);

-- Flooring (category_id = 12)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1201, 12, 'Tile broken', 1),
(1202, 12, 'Tile loose', 2),
(1203, 12, 'Floor uneven', 3),
(1204, 12, 'Grout issue', 4),
(1205, 12, 'Marble/granite damage', 5),
(1206, 12, 'Wooden floor issue', 6),
(1207, 12, 'Carpet issue', 7),
(1208, 12, 'Floor cleaning required', 8),
(1299, 12, 'Other', 9);

-- Locks / Keys (category_id = 13)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1301, 13, 'Lock not working', 1),
(1302, 13, 'Key lost', 2),
(1303, 13, 'Key broken', 3),
(1304, 13, 'Door jammed', 4),
(1305, 13, 'Lock replacement needed', 5),
(1306, 13, 'Smart lock issue', 6),
(1307, 13, 'Handle issue', 7),
(1308, 13, 'Latch issue', 8),
(1309, 13, 'Emergency lock opening', 9),
(1399, 13, 'Other', 10);

-- Painting (category_id = 14)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1401, 14, 'Repainting needed', 1),
(1402, 14, 'Paint peeling', 2),
(1403, 14, 'Wall stains', 3),
(1404, 14, 'Color fading', 4),
(1405, 14, 'Crack filling needed', 5),
(1406, 14, 'Exterior painting needed', 6),
(1407, 14, 'Interior painting needed', 7),
(1408, 14, 'Touch-up required', 8),
(1409, 14, 'Ceiling paint issue', 9),
(1499, 14, 'Other', 10);

-- Pest Control (category_id = 15)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1501, 15, 'Cockroach issue', 1),
(1502, 15, 'Mosquito issue', 2),
(1503, 15, 'Termite issue', 3),
(1504, 15, 'Bed bug issue', 4),
(1505, 15, 'General pest treatment needed', 5),
(1506, 15, 'Repeat treatment needed', 6),
(1507, 15, 'Outdoor pest issue', 7),
(1508, 15, 'Emergency infestation complaint', 8),
(1599, 15, 'Other', 9);

-- Water Purification (category_id = 16)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1601, 16, 'Purifier not working', 1),
(1602, 16, 'No water output', 2),
(1603, 16, 'Low water flow', 3),
(1604, 16, 'Water taste issue', 4),
(1605, 16, 'Filter replacement needed', 5),
(1606, 16, 'Leakage issue', 6),
(1607, 16, 'Power issue', 7),
(1608, 16, 'Service required', 8),
(1609, 16, 'Installation needed', 9),
(1699, 16, 'Other', 10);

-- Hot Water Geyser (category_id = 17)
INSERT IGNORE INTO subcategories (id, category_id, name, sort_order) VALUES
(1701, 17, 'Not heating', 1),
(1702, 17, 'Low hot water', 2),
(1703, 17, 'Water leakage', 3),
(1704, 17, 'Not turning on', 4),
(1705, 17, 'Thermostat issue', 5),
(1706, 17, 'Pressure issue', 6),
(1707, 17, 'Unusual noise', 7),
(1708, 17, 'Power issue', 8),
(1709, 17, 'Service required', 9),
(1710, 17, 'Replacement needed', 10),
(1799, 17, 'Other', 11);

-- ============================================
-- INSERT DEFAULT ADMIN USER
-- ============================================
INSERT IGNORE INTO admin_users (id, username, email, password_hash, first_name, last_name, role) VALUES
(1, 'admin', 'admin@example.com', '$2a$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'System', 'Admin', 'admin');

-- ============================================
-- CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_resident ON work_orders(resident_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_created ON work_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
