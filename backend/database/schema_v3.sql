-- Customer Portal Database Schema V3
-- PM Software - Roles & Workflow Structure
-- Includes: Users with new roles, Vendors, Estimates, Schedules, Work Orders with full status flow

-- Create database
CREATE DATABASE IF NOT EXISTS customer_portal;
USE customer_portal;

-- ============================================
-- USERS TABLE (Staff: Admin, Manager, Supervisor, Executive)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role ENUM('admin', 'manager', 'supervisor', 'executive') NOT NULL DEFAULT 'executive',
  -- Permission overrides (NULL means use role defaults)
  can_view BOOLEAN DEFAULT NULL,
  can_create BOOLEAN DEFAULT NULL,
  can_edit BOOLEAN DEFAULT NULL,
  can_delete BOOLEAN DEFAULT NULL,
  can_approve BOOLEAN DEFAULT NULL,
  can_assign BOOLEAN DEFAULT NULL,
  can_close BOOLEAN DEFAULT NULL,
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- VENDORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id VARCHAR(50) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(200),
  phone VARCHAR(20),
  alternate_phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  -- Service categories (JSON array of category IDs)
  service_categories JSON,
  -- Documents
  gst_number VARCHAR(50),
  pan_number VARCHAR(20),
  license_number VARCHAR(100),
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_jobs_completed INT DEFAULT 0,
  last_login TIMESTAMP NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- MASTER DATA TABLES
-- ============================================

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Divisions
CREATE TABLE IF NOT EXISTS divisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_id INT,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL
);

-- Properties/Buildings table (Updated)
CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id VARCHAR(50) UNIQUE NOT NULL,
  zone_id INT,
  division_id INT,
  name VARCHAR(255) NOT NULL,
  property_type ENUM('residential', 'commercial', 'industrial', 'mixed') DEFAULT 'residential',
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  contact_person VARCHAR(200),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  total_units INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
  FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Priorities
CREATE TABLE IF NOT EXISTS priorities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) UNIQUE,
  color VARCHAR(20) DEFAULT '#000000',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Problem Types
CREATE TABLE IF NOT EXISTS problem_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  estimated_time_hours DECIMAL(5,2),
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Service Packages
CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id INT,
  base_price DECIMAL(12,2) DEFAULT 0.00,
  duration_days INT DEFAULT 1,
  frequency ENUM('one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly') DEFAULT 'one_time',
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- CLIENTS TABLE (For Data Entry)
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(50) UNIQUE NOT NULL,
  property_id INT,
  client_type ENUM('individual', 'company', 'association') DEFAULT 'individual',
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  gst_number VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- ESTIMATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id VARCHAR(50) UNIQUE NOT NULL,
  client_id INT,
  property_id INT,
  estimate_type ENUM('property_based', 'direct') DEFAULT 'property_based',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  -- Pricing
  subtotal DECIMAL(12,2) DEFAULT 0.00,
  tax_percentage DECIMAL(5,2) DEFAULT 18.00,
  tax_amount DECIMAL(12,2) DEFAULT 0.00,
  discount_percentage DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  -- Status
  status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'converted') DEFAULT 'draft',
  valid_until DATE,
  -- Approval
  approved_by INT,
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT,
  -- Tracking
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Estimate Line Items
CREATE TABLE IF NOT EXISTS estimate_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  estimate_id INT NOT NULL,
  package_id INT,
  category_id INT,
  description VARCHAR(500) NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(12,2) DEFAULT 0.00,
  total_price DECIMAL(12,2) DEFAULT 0.00,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================
-- SCHEDULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id VARCHAR(50) UNIQUE NOT NULL,
  estimate_id INT,
  package_id INT,
  property_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  -- Schedule details
  start_date DATE NOT NULL,
  end_date DATE,
  frequency ENUM('one_time', 'daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'yearly') DEFAULT 'one_time',
  frequency_details JSON,  -- e.g., {"days": ["monday", "wednesday"], "time": "09:00"}
  -- Status
  status ENUM('draft', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
  -- Tracking
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE SET NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- WORK ORDERS TABLE (Updated with full status flow)
-- ============================================
CREATE TABLE IF NOT EXISTS work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id VARCHAR(50) UNIQUE NOT NULL,
  -- References
  property_id INT NOT NULL,
  unit_id INT,
  client_id INT,
  schedule_id INT,
  category_id INT NOT NULL,
  subcategory_id INT,
  priority_id INT,
  -- Details
  title VARCHAR(255),
  description TEXT,
  permission_to_enter ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  entry_notes TEXT,
  has_pet ENUM('yes', 'no') NOT NULL DEFAULT 'no',
  -- Status Flow: draft -> requested -> under_review -> assigned -> accepted -> in_progress -> completed -> verified -> closed
  status ENUM('draft', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress', 'completed', 'verified', 'closed', 'cancelled') DEFAULT 'draft',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  -- Vendor Assignment
  assigned_vendor_id INT,
  assigned_at TIMESTAMP NULL,
  assigned_by INT,
  -- Vendor Response
  vendor_accepted_at TIMESTAMP NULL,
  vendor_started_at TIMESTAMP NULL,
  vendor_completed_at TIMESTAMP NULL,
  vendor_notes TEXT,
  -- Verification & Closure
  verified_by INT,
  verified_at TIMESTAMP NULL,
  verification_notes TEXT,
  closed_by INT,
  closed_at TIMESTAMP NULL,
  closure_notes TEXT,
  -- Scheduling
  scheduled_date DATETIME,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  -- Tracking
  requested_by INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id),
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Work Order Status History
CREATE TABLE IF NOT EXISTS work_order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id INT NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by INT,
  changed_by_role VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- PRICING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  subcategory_id INT,
  package_id INT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) DEFAULT 'per_job',  -- per_job, per_hour, per_sqft, etc.
  base_price DECIMAL(12,2) NOT NULL,
  min_price DECIMAL(12,2),
  max_price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  vendor_id INT,
  type VARCHAR(50) NOT NULL,  -- work_order, estimate, schedule, system
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50),  -- work_order, estimate, schedule
  reference_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

-- ============================================
-- AUDIT LOG TABLE (Updated)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  vendor_id INT,
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100),
  table_name VARCHAR(100),
  record_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@pmportal.com', '$2a$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'System', 'Admin', 'admin');

-- Insert sample manager (password: manager123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_by) VALUES
('manager1', 'manager@pmportal.com', '$2a$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'John', 'Manager', 'manager', 1);

-- Insert sample supervisor (password: supervisor123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_by) VALUES
('supervisor1', 'supervisor@pmportal.com', '$2a$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'Jane', 'Supervisor', 'supervisor', 1);

-- Insert sample executive (password: executive123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role, created_by) VALUES
('executive1', 'executive@pmportal.com', '$2a$10$rQZ5Q5Q5Q5Q5Q5Q5Q5Q5QOE5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5Q5', 'Bob', 'Executive', 'executive', 1);

-- Insert default priorities
INSERT INTO priorities (name, code, color, sort_order) VALUES
('Low', 'LOW', '#28a745', 1),
('Medium', 'MEDIUM', '#ffc107', 2),
('High', 'HIGH', '#fd7e14', 3),
('Urgent', 'URGENT', '#dc3545', 4);

-- Insert sample zones
INSERT INTO zones (name, code, description) VALUES
('North Zone', 'NORTH', 'Northern region'),
('South Zone', 'SOUTH', 'Southern region'),
('East Zone', 'EAST', 'Eastern region'),
('West Zone', 'WEST', 'Western region');

-- Insert sample divisions
INSERT INTO divisions (zone_id, name, code) VALUES
(1, 'North Division 1', 'N1'),
(1, 'North Division 2', 'N2'),
(2, 'South Division 1', 'S1'),
(3, 'East Division 1', 'E1'),
(4, 'West Division 1', 'W1');

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_vendors_active ON vendors(is_active);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_vendor ON work_orders(assigned_vendor_id);
CREATE INDEX idx_work_orders_property ON work_orders(property_id);
CREATE INDEX idx_work_orders_created ON work_orders(created_at);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_vendor ON notifications(vendor_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
