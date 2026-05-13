-- =====================================================
-- COORDINATOR PORTAL SCHEMA
-- Version: 10
-- Description: Database schema additions for Coordinator Portal
-- This adds coordinator_id scoping to enable data isolation
-- =====================================================

-- =====================================================
-- 1. COORDINATOR EMPLOYEES TABLE
-- Employees created/managed by coordinators
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_id INT NOT NULL,
    employee_code VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    role ENUM('coord_supervisor', 'coord_executive') DEFAULT 'coord_executive',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_coordinator_employees_coordinator (coordinator_id),
    INDEX idx_coordinator_employees_code (employee_code)
);

-- =====================================================
-- 2. COORDINATOR EMPLOYEE ZONES TABLE
-- Zone assignments for coordinator employees
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_employee_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_employee_id INT NOT NULL,
    zone_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coordinator_employee_id) REFERENCES coordinator_employees(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coord_employee_zone (coordinator_employee_id, zone_id)
);

-- =====================================================
-- 3. COORDINATOR ASSIGNED VENDORS TABLE
-- Vendors assigned to coordinators
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_assigned_vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_id INT NOT NULL,
    vendor_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    can_modify BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_coord_vendor (coordinator_id, vendor_id),
    INDEX idx_coord_assigned_vendors (coordinator_id)
);

-- =====================================================
-- 4. COORDINATOR AMC PACKAGES TABLE
-- AMC packages created by coordinators
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_amc_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_months INT DEFAULT 12,
    base_price DECIMAL(12,2) DEFAULT 0,
    services JSON,
    terms_conditions TEXT,
    hide_pricing BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_coord_amc_packages (coordinator_id)
);

-- =====================================================
-- 5. COORDINATOR ADDONS TABLE
-- Add-ons created by coordinators
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_addons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) DEFAULT 0,
    unit ENUM('per_service', 'per_hour', 'per_sqft', 'fixed') DEFAULT 'per_service',
    category_id INT,
    hide_pricing BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
    INDEX idx_coord_addons (coordinator_id)
);

-- =====================================================
-- 6. ADD COORDINATOR_ID TO EXISTING TABLES
-- Enable coordinator-level data scoping
-- =====================================================

-- Add coordinator_id to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS coordinator_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_properties_coordinator (coordinator_id),
ADD CONSTRAINT fk_properties_coordinator 
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add coordinator_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS coordinator_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_clients_coordinator (coordinator_id),
ADD CONSTRAINT fk_clients_coordinator 
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add coordinator_id to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS coordinator_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_estimates_coordinator (coordinator_id),
ADD CONSTRAINT fk_estimates_coordinator 
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add coordinator_id to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS coordinator_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_work_orders_coordinator (coordinator_id),
ADD CONSTRAINT fk_work_orders_coordinator 
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add coordinator_id to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS coordinator_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_schedules_coordinator (coordinator_id),
ADD CONSTRAINT fk_schedules_coordinator 
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add coordinator_id to vendors table (for coordinators who create vendors)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS coordinator_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_vendors_coordinator (coordinator_id),
ADD CONSTRAINT fk_vendors_coordinator 
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- 7. COORDINATOR ASSIGNED PROPERTIES TABLE
-- Properties assigned to coordinators (for view-only or limited access)
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_assigned_properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_id INT NOT NULL,
    property_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    can_modify BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_assign_vendor BOOLEAN DEFAULT TRUE,
    can_assign_employee BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_coord_property (coordinator_id, property_id),
    INDEX idx_coord_assigned_properties (coordinator_id)
);

-- =====================================================
-- 8. VIEWS FOR COORDINATOR PORTAL
-- Optimized views for coordinator data access
-- =====================================================

-- View for coordinator properties (own + assigned)
CREATE OR REPLACE VIEW coordinator_properties_view AS
SELECT 
    p.*,
    CASE 
        WHEN p.coordinator_id IS NOT NULL THEN 'own'
        ELSE 'assigned'
    END as access_type,
    COALESCE(cap.can_modify, TRUE) as can_modify,
    COALESCE(cap.can_delete, TRUE) as can_delete,
    COALESCE(cap.can_assign_vendor, TRUE) as can_assign_vendor,
    COALESCE(cap.can_assign_employee, TRUE) as can_assign_employee
FROM properties p
LEFT JOIN coordinator_assigned_properties cap ON p.id = cap.property_id;

-- View for coordinator vendors (own + assigned)
CREATE OR REPLACE VIEW coordinator_vendors_view AS
SELECT 
    v.*,
    CASE 
        WHEN v.coordinator_id IS NOT NULL THEN 'own'
        ELSE 'assigned'
    END as vendor_type,
    COALESCE(cav.can_modify, TRUE) as can_modify,
    COALESCE(cav.can_delete, TRUE) as can_delete
FROM vendors v
LEFT JOIN coordinator_assigned_vendors cav ON v.id = cav.vendor_id;

-- =====================================================
-- 9. COORDINATOR PERMISSIONS TABLE
-- Fine-grained permissions for coordinator actions
-- =====================================================
CREATE TABLE IF NOT EXISTS coordinator_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coordinator_id INT NOT NULL,
    module VARCHAR(50) NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    view_pricing BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_coord_module_perm (coordinator_id, module),
    INDEX idx_coord_permissions (coordinator_id)
);

-- Insert default coordinator permissions (example)
-- These can be customized per coordinator by admin/manager
INSERT IGNORE INTO coordinator_permissions (coordinator_id, module, can_view, can_create, can_edit, can_delete, can_export, view_pricing)
SELECT 
    u.id,
    m.module,
    TRUE,  -- can_view
    CASE WHEN m.module IN ('customers', 'estimates', 'employees') THEN TRUE ELSE FALSE END,  -- can_create
    CASE WHEN m.module IN ('customers', 'estimates', 'employees') THEN TRUE ELSE FALSE END,  -- can_edit
    FALSE, -- can_delete (limited)
    TRUE,  -- can_export
    CASE WHEN m.module IN ('amc_packages', 'addons') THEN FALSE ELSE TRUE END  -- view_pricing
FROM users u
CROSS JOIN (
    SELECT 'properties' as module UNION ALL
    SELECT 'work_orders' UNION ALL
    SELECT 'customers' UNION ALL
    SELECT 'vendors' UNION ALL
    SELECT 'employees' UNION ALL
    SELECT 'estimates' UNION ALL
    SELECT 'amc_packages' UNION ALL
    SELECT 'addons'
) m
WHERE u.role = 'coordinator'
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
