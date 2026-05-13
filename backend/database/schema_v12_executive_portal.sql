-- =====================================================
-- EXECUTIVE PORTAL SCHEMA
-- Version: 12
-- Description: Database schema additions for Executive Portal
-- This adds executive_id scoping to enable data isolation
-- =====================================================

-- =====================================================
-- 1. EXECUTIVE EMPLOYEES TABLE
-- Employees created/managed by executives
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_id INT NOT NULL,
    employee_code VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    role ENUM('exec_assistant', 'exec_helper') DEFAULT 'exec_assistant',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_executive_employees_executive (executive_id),
    INDEX idx_executive_employees_code (employee_code)
);

-- =====================================================
-- 2. EXECUTIVE EMPLOYEE ZONES TABLE
-- Zone assignments for executive employees
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_employee_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_employee_id INT NOT NULL,
    zone_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (executive_employee_id) REFERENCES executive_employees(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_exec_employee_zone (executive_employee_id, zone_id)
);

-- =====================================================
-- 3. EXECUTIVE ASSIGNED VENDORS TABLE
-- Vendors assigned to executives
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_assigned_vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_id INT NOT NULL,
    vendor_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    can_modify BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_exec_vendor (executive_id, vendor_id),
    INDEX idx_exec_assigned_vendors (executive_id)
);

-- =====================================================
-- 4. EXECUTIVE AMC PACKAGES TABLE
-- AMC packages created by executives
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_amc_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_months INT DEFAULT 12,
    base_price DECIMAL(12,2) DEFAULT 0,
    services JSON,
    terms_conditions TEXT,
    hide_pricing BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_exec_amc_packages (executive_id)
);

-- =====================================================
-- 5. EXECUTIVE ADDONS TABLE
-- Add-ons created by executives
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_addons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) DEFAULT 0,
    unit ENUM('per_service', 'per_hour', 'per_sqft', 'fixed') DEFAULT 'per_service',
    category_id INT,
    hide_pricing BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
    INDEX idx_exec_addons (executive_id)
);

-- =====================================================
-- 6. ADD EXECUTIVE_ID TO EXISTING TABLES
-- Enable executive-level data scoping
-- =====================================================

-- Add executive_id to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS executive_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_properties_executive (executive_id),
ADD CONSTRAINT fk_properties_executive 
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add executive_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS executive_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_clients_executive (executive_id),
ADD CONSTRAINT fk_clients_executive 
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add executive_id to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS executive_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_estimates_executive (executive_id),
ADD CONSTRAINT fk_estimates_executive 
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add executive_id to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS executive_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_work_orders_executive (executive_id),
ADD CONSTRAINT fk_work_orders_executive 
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add executive_id to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS executive_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_schedules_executive (executive_id),
ADD CONSTRAINT fk_schedules_executive 
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add executive_id to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS executive_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_vendors_executive (executive_id),
ADD CONSTRAINT fk_vendors_executive 
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- 7. EXECUTIVE ASSIGNED PROPERTIES TABLE
-- Properties assigned to executives (for view-only or limited access)
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_assigned_properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_id INT NOT NULL,
    property_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    can_modify BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_assign_vendor BOOLEAN DEFAULT FALSE,
    can_assign_employee BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_exec_property (executive_id, property_id),
    INDEX idx_exec_assigned_properties (executive_id)
);

-- =====================================================
-- 8. VIEWS FOR EXECUTIVE PORTAL
-- Optimized views for executive data access
-- =====================================================

-- View for executive properties (own + assigned)
CREATE OR REPLACE VIEW executive_properties_view AS
SELECT 
    p.*,
    CASE 
        WHEN p.executive_id IS NOT NULL THEN 'own'
        ELSE 'assigned'
    END as access_type,
    COALESCE(eap.can_modify, TRUE) as can_modify,
    COALESCE(eap.can_delete, FALSE) as can_delete,
    COALESCE(eap.can_assign_vendor, FALSE) as can_assign_vendor,
    COALESCE(eap.can_assign_employee, FALSE) as can_assign_employee
FROM properties p
LEFT JOIN executive_assigned_properties eap ON p.id = eap.property_id;

-- View for executive vendors (own + assigned)
CREATE OR REPLACE VIEW executive_vendors_view AS
SELECT 
    v.*,
    CASE 
        WHEN v.executive_id IS NOT NULL THEN 'own'
        ELSE 'assigned'
    END as vendor_type,
    COALESCE(eav.can_modify, TRUE) as can_modify,
    COALESCE(eav.can_delete, FALSE) as can_delete
FROM vendors v
LEFT JOIN executive_assigned_vendors eav ON v.id = eav.vendor_id;

-- =====================================================
-- 9. EXECUTIVE PERMISSIONS TABLE
-- Fine-grained permissions for executive actions
-- =====================================================
CREATE TABLE IF NOT EXISTS executive_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executive_id INT NOT NULL,
    module VARCHAR(50) NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT TRUE,
    view_pricing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (executive_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_exec_module_perm (executive_id, module),
    INDEX idx_exec_permissions (executive_id)
);

-- Insert default executive permissions
INSERT IGNORE INTO executive_permissions (executive_id, module, can_view, can_create, can_edit, can_delete, can_export, view_pricing)
SELECT 
    u.id,
    m.module,
    TRUE,  -- can_view
    CASE WHEN m.module IN ('customers', 'properties') THEN TRUE ELSE FALSE END,  -- can_create (limited)
    CASE WHEN m.module IN ('customers') THEN TRUE ELSE FALSE END,  -- can_edit (very limited)
    FALSE, -- can_delete (no delete for executive)
    TRUE,  -- can_export
    FALSE  -- view_pricing (hidden by default for executive)
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
WHERE u.role = 'executive'
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
