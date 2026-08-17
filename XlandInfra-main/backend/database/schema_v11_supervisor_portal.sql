-- =====================================================
-- SUPERVISOR PORTAL SCHEMA
-- Version: 11
-- Description: Database schema additions for Supervisor Portal
-- This adds supervisor_id scoping to enable data isolation
-- =====================================================

-- =====================================================
-- 1. SUPERVISOR EMPLOYEES TABLE
-- Employees created/managed by supervisors
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
    employee_code VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    role ENUM('sup_executive', 'sup_helper') DEFAULT 'sup_executive',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_supervisor_employees_supervisor (supervisor_id),
    INDEX idx_supervisor_employees_code (employee_code)
);

-- =====================================================
-- 2. SUPERVISOR EMPLOYEE ZONES TABLE
-- Zone assignments for supervisor employees
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_employee_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_employee_id INT NOT NULL,
    zone_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_employee_id) REFERENCES supervisor_employees(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sup_employee_zone (supervisor_employee_id, zone_id)
);

-- =====================================================
-- 3. SUPERVISOR ASSIGNED VENDORS TABLE
-- Vendors assigned to supervisors
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_assigned_vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
    vendor_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    can_modify BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_sup_vendor (supervisor_id, vendor_id),
    INDEX idx_sup_assigned_vendors (supervisor_id)
);

-- =====================================================
-- 4. SUPERVISOR AMC PACKAGES TABLE
-- AMC packages created by supervisors
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_amc_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
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
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sup_amc_packages (supervisor_id)
);

-- =====================================================
-- 5. SUPERVISOR ADDONS TABLE
-- Add-ons created by supervisors
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_addons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) DEFAULT 0,
    unit ENUM('per_service', 'per_hour', 'per_sqft', 'fixed') DEFAULT 'per_service',
    category_id INT,
    hide_pricing BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
    INDEX idx_sup_addons (supervisor_id)
);

-- =====================================================
-- 6. ADD SUPERVISOR_ID TO EXISTING TABLES
-- Enable supervisor-level data scoping
-- =====================================================

-- Add supervisor_id to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS supervisor_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_properties_supervisor (supervisor_id),
ADD CONSTRAINT fk_properties_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add supervisor_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS supervisor_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_clients_supervisor (supervisor_id),
ADD CONSTRAINT fk_clients_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add supervisor_id to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS supervisor_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_estimates_supervisor (supervisor_id),
ADD CONSTRAINT fk_estimates_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add supervisor_id to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS supervisor_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_work_orders_supervisor (supervisor_id),
ADD CONSTRAINT fk_work_orders_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add supervisor_id to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS supervisor_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_schedules_supervisor (supervisor_id),
ADD CONSTRAINT fk_schedules_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add supervisor_id to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS supervisor_id INT DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_vendors_supervisor (supervisor_id),
ADD CONSTRAINT fk_vendors_supervisor 
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- 7. SUPERVISOR ASSIGNED PROPERTIES TABLE
-- Properties assigned to supervisors (for view-only or limited access)
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_assigned_properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
    property_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    can_modify BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_assign_vendor BOOLEAN DEFAULT TRUE,
    can_assign_employee BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_sup_property (supervisor_id, property_id),
    INDEX idx_sup_assigned_properties (supervisor_id)
);

-- =====================================================
-- 8. VIEWS FOR SUPERVISOR PORTAL
-- Optimized views for supervisor data access
-- =====================================================

-- View for supervisor properties (own + assigned)
CREATE OR REPLACE VIEW supervisor_properties_view AS
SELECT 
    p.*,
    CASE 
        WHEN p.supervisor_id IS NOT NULL THEN 'own'
        ELSE 'assigned'
    END as access_type,
    COALESCE(sap.can_modify, TRUE) as can_modify,
    COALESCE(sap.can_delete, TRUE) as can_delete,
    COALESCE(sap.can_assign_vendor, TRUE) as can_assign_vendor,
    COALESCE(sap.can_assign_employee, TRUE) as can_assign_employee
FROM properties p
LEFT JOIN supervisor_assigned_properties sap ON p.id = sap.property_id;

-- View for supervisor vendors (own + assigned)
CREATE OR REPLACE VIEW supervisor_vendors_view AS
SELECT 
    v.*,
    CASE 
        WHEN v.supervisor_id IS NOT NULL THEN 'own'
        ELSE 'assigned'
    END as vendor_type,
    COALESCE(sav.can_modify, TRUE) as can_modify,
    COALESCE(sav.can_delete, TRUE) as can_delete
FROM vendors v
LEFT JOIN supervisor_assigned_vendors sav ON v.id = sav.vendor_id;

-- =====================================================
-- 9. SUPERVISOR PERMISSIONS TABLE
-- Fine-grained permissions for supervisor actions
-- =====================================================
CREATE TABLE IF NOT EXISTS supervisor_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supervisor_id INT NOT NULL,
    module VARCHAR(50) NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT TRUE,
    view_pricing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sup_module_perm (supervisor_id, module),
    INDEX idx_sup_permissions (supervisor_id)
);

-- Insert default supervisor permissions
INSERT IGNORE INTO supervisor_permissions (supervisor_id, module, can_view, can_create, can_edit, can_delete, can_export, view_pricing)
SELECT 
    u.id,
    m.module,
    TRUE,  -- can_view
    CASE WHEN m.module IN ('customers', 'work_orders', 'employees') THEN TRUE ELSE FALSE END,  -- can_create
    CASE WHEN m.module IN ('customers', 'employees') THEN TRUE ELSE FALSE END,  -- can_edit
    FALSE, -- can_delete (very limited)
    TRUE,  -- can_export
    FALSE  -- view_pricing (hidden by default for supervisor)
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
WHERE u.role = 'supervisor'
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
