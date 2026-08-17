-- Schema V7: Customer Portal Accounts
-- Adds customer_accounts table for portal login with activation flow

USE customer_portal;

-- ============================================
-- CUSTOMER ACCOUNTS TABLE
-- For customer portal login with activation workflow
-- ============================================
CREATE TABLE IF NOT EXISTS customer_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(50) UNIQUE NOT NULL,  -- e.g. CUST-XXXX-20250510
  
  -- Link to property contact
  property_contact_id INT,
  property_id INT,
  
  -- Account credentials
  email VARCHAR(255) UNIQUE NOT NULL,
  temp_password_hash VARCHAR(255),           -- Temporary password (bcrypt hashed)
  password_hash VARCHAR(255),                -- Final password after activation
  
  -- Activation
  activation_token VARCHAR(255) UNIQUE,      -- Unique token for activation link
  activation_expires TIMESTAMP NULL,          -- Token expiry (72 hours)
  is_activated BOOLEAN DEFAULT FALSE,        -- Account activated flag
  activated_at TIMESTAMP NULL,               -- When account was activated
  
  -- Customer details
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  country_code VARCHAR(10) DEFAULT '+91',
  
  -- Property info (denormalized for quick access)
  property_name VARCHAR(255),
  property_code VARCHAR(50),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  
  -- Tracking
  created_by VARCHAR(100) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (property_contact_id) REFERENCES property_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_customer_accounts_email ON customer_accounts(email);
CREATE INDEX idx_customer_accounts_token ON customer_accounts(activation_token);
CREATE INDEX idx_customer_accounts_active ON customer_accounts(is_active);
CREATE INDEX idx_customer_accounts_activated ON customer_accounts(is_activated);
CREATE INDEX idx_customer_accounts_property ON customer_accounts(property_id);

-- ============================================
-- CUSTOMER SESSIONS TABLE (optional - for JWT refresh tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  refresh_token VARCHAR(500),
  device_info VARCHAR(255),
  ip_address VARCHAR(45),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_sessions_customer ON customer_sessions(customer_id);
CREATE INDEX idx_customer_sessions_token ON customer_sessions(refresh_token(100));

-- ============================================
-- CUSTOMER ACTIVITY LOG
-- ============================================
CREATE TABLE IF NOT EXISTS customer_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,  -- login, logout, password_change, profile_update, etc.
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_activity_customer ON customer_activity_log(customer_id);
CREATE INDEX idx_customer_activity_action ON customer_activity_log(action);
