-- =============================================
-- MANAGER PORTAL SCHEMA
-- Version 9: Manager Data Scoping
-- =============================================

-- Manager-specific tables for data isolation
-- This schema adds manager_id to relevant tables
-- to scope data by logged-in manager

-- =============================================
-- 1. MANAGER EMPLOYEES TABLE
-- Employees created/managed by a specific manager
-- =============================================

CREATE TABLE IF NOT EXISTS manager_employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manager_id INT NOT NULL,
    employee_code VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    role ENUM('mgr_supervisor', 'mgr_executive') DEFAULT 'mgr_executive',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_manager_emp_manager (manager_id),
    INDEX idx_manager_emp_active (is_active)
);

-- =============================================
-- 2. MANAGER EMPLOYEE ZONES TABLE
-- Zone assignments for manager's employees
-- =============================================

CREATE TABLE IF NOT EXISTS manager_employee_zones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manager_employee_id INT NOT NULL,
    zone_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_employee_id) REFERENCES manager_employees(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_mgr_emp_zone (manager_employee_id, zone_id)
);

-- =============================================
-- 3. MANAGER ASSIGNED VENDORS TABLE
-- Vendors assigned to a specific manager
-- =============================================

CREATE TABLE IF NOT EXISTS manager_assigned_vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manager_id INT NOT NULL,
    vendor_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    UNIQUE KEY unique_mgr_vendor (manager_id, vendor_id),
    INDEX idx_mgr_assigned_vendor (manager_id)
);

-- =============================================
-- 4. MANAGER AMC PACKAGES TABLE
-- AMC packages created by a specific manager
-- =============================================

CREATE TABLE IF NOT EXISTS manager_amc_packages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manager_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_months INT DEFAULT 12,
    base_price DECIMAL(10, 2) DEFAULT 0.00,
    services JSON,
    terms_conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    hide_pricing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_mgr_amc_manager (manager_id)
);

-- =============================================
-- 5. MANAGER ADDONS TABLE
-- Add-ons created by a specific manager
-- =============================================

CREATE TABLE IF NOT EXISTS manager_addons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manager_id INT NOT NULL,
    category_id INT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) DEFAULT 0.00,
    unit ENUM('per_service', 'per_hour', 'per_sqft', 'fixed') DEFAULT 'per_service',
    is_active BOOLEAN DEFAULT TRUE,
    hide_pricing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_mgr_addon_manager (manager_id)
);

-- =============================================
-- 6. ADD MANAGER_ID TO EXISTING TABLES
-- Properties, Clients, Estimates, Work Orders
-- =============================================

-- Add manager_id to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS manager_id INT NULL,
ADD INDEX IF NOT EXISTS idx_prop_manager (manager_id),
ADD CONSTRAINT fk_prop_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add manager_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS manager_id INT NULL,
ADD INDEX IF NOT EXISTS idx_client_manager (manager_id),
ADD CONSTRAINT fk_client_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add manager_id to estimates table
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS manager_id INT NULL,
ADD INDEX IF NOT EXISTS idx_est_manager (manager_id),
ADD CONSTRAINT fk_est_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add manager_id to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS manager_id INT NULL,
ADD INDEX IF NOT EXISTS idx_wo_manager (manager_id),
ADD CONSTRAINT fk_wo_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add manager_id to schedules table  
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS manager_id INT NULL,
ADD INDEX IF NOT EXISTS idx_sched_manager (manager_id),
ADD CONSTRAINT fk_sched_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add manager_id to vendors table (for vendors created by manager)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS manager_id INT NULL,
ADD INDEX IF NOT EXISTS idx_vendor_manager (manager_id),
ADD CONSTRAINT fk_vendor_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- =============================================
-- 7. SAMPLE DATA FOR TESTING
-- =============================================

-- Note: Assuming a manager user exists with id = X
-- INSERT INTO manager_employees (manager_id, employee_code, first_name, last_name, email, phone, role)
-- VALUES (X, 'MGR-EMP-001', 'John', 'Supervisor', 'john.sup@example.com', '9876543210', 'mgr_supervisor');

-- =============================================
-- 8. VIEWS FOR MANAGER DATA ACCESS
-- =============================================

-- View for manager's properties with related info
CREATE OR REPLACE VIEW v_manager_properties AS
SELECT 
    p.*,
    z.name as zone_name,
    u.username as manager_name
FROM properties p
LEFT JOIN zones z ON p.zone_id = z.id
LEFT JOIN users u ON p.manager_id = u.id
WHERE p.manager_id IS NOT NULL;

-- View for manager's work orders with related info
CREATE OR REPLACE VIEW v_manager_work_orders AS
SELECT 
    wo.*,
    p.name as property_name,
    c.name as category_name,
    v.company_name as vendor_name,
    cl.name as client_name
FROM work_orders wo
LEFT JOIN properties p ON wo.property_id = p.id
LEFT JOIN categories c ON wo.category_id = c.id
LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
LEFT JOIN clients cl ON wo.client_id = cl.id
WHERE wo.manager_id IS NOT NULL;

-- View for manager's estimates
CREATE OR REPLACE VIEW v_manager_estimates AS
SELECT 
    e.*,
    p.name as property_name,
    cl.name as client_name
FROM estimates e
LEFT JOIN properties p ON e.property_id = p.id
LEFT JOIN clients cl ON e.client_id = cl.id
WHERE e.manager_id IS NOT NULL;

-- =============================================
-- END OF SCHEMA
-- =============================================
