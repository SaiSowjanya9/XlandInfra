-- ============================================
-- XLAND INFRA Dynamic QR Management System
-- Schema Version 14
-- ============================================

-- QR Codes Master Table
CREATE TABLE IF NOT EXISTS qr_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    current_url VARCHAR(2048) NOT NULL,
    original_url VARCHAR(2048) NOT NULL,
    qr_type ENUM('website', 'admin', 'campaign', 'event', 'custom') DEFAULT 'custom',
    is_active BOOLEAN DEFAULT TRUE,
    is_protected BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    
    -- QR Style Configuration
    foreground_color VARCHAR(7) DEFAULT '#000000',
    background_color VARCHAR(7) DEFAULT '#FFFFFF',
    logo_url VARCHAR(512),
    error_correction ENUM('L', 'M', 'Q', 'H') DEFAULT 'H',
    style_preset ENUM('classic', 'rounded', 'dots', 'luxury') DEFAULT 'luxury',
    
    -- Metadata
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    
    INDEX idx_qr_slug (slug),
    INDEX idx_qr_active (is_active),
    INDEX idx_qr_type (qr_type)
);

-- QR Redirect History (URL changes)
CREATE TABLE IF NOT EXISTS qr_redirect_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    previous_url VARCHAR(2048),
    new_url VARCHAR(2048) NOT NULL,
    changed_by INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_reason VARCHAR(500),
    
    FOREIGN KEY (qr_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    INDEX idx_redirect_qr (qr_id),
    INDEX idx_redirect_date (changed_at)
);

-- QR Scan Logs (Individual scan records)
CREATE TABLE IF NOT EXISTS qr_scans (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    scan_id VARCHAR(64) UNIQUE NOT NULL,
    
    -- User identification
    visitor_id VARCHAR(64),
    session_id VARCHAR(64),
    ip_address VARCHAR(45),
    ip_hash VARCHAR(64),
    is_unique_user BOOLEAN DEFAULT TRUE,
    is_repeat_scan BOOLEAN DEFAULT FALSE,
    
    -- Device information
    user_agent TEXT,
    device_type ENUM('mobile', 'tablet', 'desktop', 'unknown') DEFAULT 'unknown',
    device_brand VARCHAR(100),
    device_model VARCHAR(100),
    os_name VARCHAR(50),
    os_version VARCHAR(50),
    browser_name VARCHAR(50),
    browser_version VARCHAR(50),
    
    -- Geographic data
    country VARCHAR(100),
    country_code VARCHAR(3),
    state VARCHAR(100),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone VARCHAR(50),
    
    -- Scan metadata
    referrer_url VARCHAR(2048),
    referrer_domain VARCHAR(255),
    language VARCHAR(10),
    screen_resolution VARCHAR(20),
    
    -- Timestamps
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    session_duration INT DEFAULT 0,
    
    -- Redirect tracking
    redirect_url VARCHAR(2048),
    redirect_success BOOLEAN DEFAULT TRUE,
    redirect_latency_ms INT,
    
    FOREIGN KEY (qr_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    INDEX idx_scan_qr (qr_id),
    INDEX idx_scan_date (scanned_at),
    INDEX idx_scan_visitor (visitor_id),
    INDEX idx_scan_country (country_code),
    INDEX idx_scan_device (device_type),
    INDEX idx_scan_unique (qr_id, is_unique_user)
);

-- QR Daily Analytics (Aggregated daily stats)
CREATE TABLE IF NOT EXISTS qr_analytics_daily (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    date DATE NOT NULL,
    
    -- Scan counts
    total_scans INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    repeat_users INT DEFAULT 0,
    
    -- Device breakdown
    mobile_scans INT DEFAULT 0,
    tablet_scans INT DEFAULT 0,
    desktop_scans INT DEFAULT 0,
    
    -- Top metrics
    top_country VARCHAR(100),
    top_city VARCHAR(100),
    top_device VARCHAR(100),
    top_browser VARCHAR(50),
    top_os VARCHAR(50),
    
    -- Time metrics
    peak_hour TINYINT,
    avg_session_duration INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_qr_date (qr_id, date),
    FOREIGN KEY (qr_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    INDEX idx_analytics_date (date),
    INDEX idx_analytics_qr (qr_id)
);

-- QR Hourly Analytics (For real-time dashboard)
CREATE TABLE IF NOT EXISTS qr_analytics_hourly (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    hour_timestamp TIMESTAMP NOT NULL,
    
    total_scans INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_qr_hour (qr_id, hour_timestamp),
    FOREIGN KEY (qr_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    INDEX idx_hourly_timestamp (hour_timestamp)
);

-- QR Geographic Analytics
CREATE TABLE IF NOT EXISTS qr_geo_analytics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    date DATE NOT NULL,
    
    country VARCHAR(100),
    country_code VARCHAR(3),
    state VARCHAR(100),
    city VARCHAR(100),
    
    scan_count INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    
    UNIQUE KEY unique_qr_geo (qr_id, date, country_code, state, city),
    FOREIGN KEY (qr_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    INDEX idx_geo_qr (qr_id),
    INDEX idx_geo_date (date),
    INDEX idx_geo_country (country_code)
);

-- QR Active Sessions (Real-time tracking)
CREATE TABLE IF NOT EXISTS qr_active_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    qr_id INT NOT NULL,
    session_id VARCHAR(64) UNIQUE NOT NULL,
    visitor_id VARCHAR(64),
    
    ip_address VARCHAR(45),
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    
    country VARCHAR(100),
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (qr_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    INDEX idx_active_qr (qr_id),
    INDEX idx_active_session (session_id),
    INDEX idx_active_status (is_active)
);

-- QR Rate Limiting
CREATE TABLE IF NOT EXISTS qr_rate_limits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45) NOT NULL,
    qr_id INT,
    request_count INT DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP NULL,
    
    UNIQUE KEY unique_ip_qr (ip_address, qr_id),
    INDEX idx_rate_ip (ip_address),
    INDEX idx_rate_blocked (is_blocked)
);

-- QR Bot/Spam Detection
CREATE TABLE IF NOT EXISTS qr_bot_detections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    detection_type ENUM('bot', 'spam', 'suspicious', 'blocked') NOT NULL,
    confidence_score DECIMAL(5, 2),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_bot_ip (ip_address),
    INDEX idx_bot_type (detection_type)
);

-- Insert default XLAND INFRA QR codes
INSERT INTO qr_codes (qr_id, slug, label, description, current_url, original_url, qr_type, foreground_color, background_color, error_correction, style_preset)
VALUES 
    ('XLAND-MAIN-001', 'main', 'XLAND INFRA Website', 'Official XLAND INFRA main website QR code for marketing and promotional materials', 'https://www.xlandinfra.com', 'https://www.xlandinfra.com', 'website', '#1a1a1a', '#FFFFFF', 'H', 'luxury'),
    ('XLAND-CUSTOMER-001', 'customer', 'Customer Portal', 'Customer portal QR code for work order requests - used on printed materials', 'https://customer.xlandinfra.com', 'https://customer.xlandinfra.com', 'website', '#1a1a1a', '#FFFFFF', 'H', 'luxury')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
