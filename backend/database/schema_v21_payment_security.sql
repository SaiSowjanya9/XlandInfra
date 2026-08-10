-- Payment Security Schema Updates
-- Version 21: Security logging and audit tables for payment system
-- Run this AFTER schema_v20

-- =====================================================
-- PAYMENT SECURITY LOGS TABLE
-- Tracks security events (suspicious activity, invalid attempts, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_security_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  
  -- Event details
  event_type VARCHAR(50) NOT NULL,
  severity ENUM('INFO', 'WARNING', 'CRITICAL') DEFAULT 'INFO',
  
  -- Request info (privacy-preserving)
  ip_hash VARCHAR(16) NOT NULL,  -- Hashed IP for privacy
  user_agent VARCHAR(500),
  
  -- User info (if authenticated)
  user_id INT,
  user_role VARCHAR(50),
  
  -- Request details
  request_path VARCHAR(255),
  request_method VARCHAR(10),
  
  -- Event details (JSON for flexibility)
  details JSON,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for querying
  INDEX idx_event_type (event_type),
  INDEX idx_severity (severity),
  INDEX idx_ip_hash (ip_hash),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- PAYMENT AUDIT TRAIL TABLE
-- Complete audit trail of all payment-related actions
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_audit_trail (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  
  -- Action details
  action VARCHAR(50) NOT NULL,
  
  -- Who performed the action
  user_id INT,
  user_role VARCHAR(50),
  ip_hash VARCHAR(16),
  
  -- Related records
  invoice_id VARCHAR(50),
  payment_id VARCHAR(50),
  
  -- Transaction details
  amount DECIMAL(12, 2),
  
  -- Result
  success TINYINT(1) DEFAULT 0,
  error_message TEXT,
  
  -- Additional context (JSON)
  details JSON,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_action (action),
  INDEX idx_user_id (user_id),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_payment_id (payment_id),
  INDEX idx_success (success),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- =====================================================
-- PAYMENT TOKEN BLACKLIST TABLE
-- Track revoked/used one-time payment tokens
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_token_blacklist (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  
  -- Token identifier (hash, not full token)
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  
  -- Why it was blacklisted
  reason ENUM('USED', 'REVOKED', 'EXPIRED', 'SUSPICIOUS') NOT NULL,
  
  -- Related records
  invoice_id VARCHAR(50),
  
  -- Timestamps
  blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,  -- For cleanup of old entries
  
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB;

-- =====================================================
-- PAYMENT RATE LIMIT OVERRIDES TABLE
-- Allow whitelisting/blacklisting of IPs for rate limiting
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_rate_limit_overrides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- IP or IP range (hashed)
  ip_hash VARCHAR(16) NOT NULL,
  
  -- Override type
  override_type ENUM('WHITELIST', 'BLACKLIST') NOT NULL,
  
  -- Reason for override
  reason TEXT,
  
  -- Who added this override
  added_by INT,
  added_by_name VARCHAR(255),
  
  -- Active status
  is_active TINYINT(1) DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,  -- NULL = permanent
  
  UNIQUE KEY unique_ip_type (ip_hash, override_type),
  INDEX idx_ip_hash (ip_hash),
  INDEX idx_override_type (override_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- =====================================================
-- SUSPICIOUS PAYMENT PATTERNS TABLE
-- Track and analyze suspicious payment patterns
-- =====================================================
CREATE TABLE IF NOT EXISTS suspicious_payment_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Pattern identifier
  pattern_type VARCHAR(50) NOT NULL,
  
  -- Pattern details
  ip_hash VARCHAR(16),
  user_id INT,
  invoice_id VARCHAR(50),
  
  -- Risk assessment
  risk_score INT DEFAULT 0,
  risk_reasons JSON,
  
  -- Pattern data
  occurrence_count INT DEFAULT 1,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  
  -- Status
  status ENUM('DETECTED', 'UNDER_REVIEW', 'CLEARED', 'BLOCKED') DEFAULT 'DETECTED',
  reviewed_by INT,
  review_notes TEXT,
  
  -- Timestamps
  first_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  
  INDEX idx_pattern_type (pattern_type),
  INDEX idx_ip_hash (ip_hash),
  INDEX idx_user_id (user_id),
  INDEX idx_risk_score (risk_score),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- =====================================================
-- ADD SECURITY FIELDS TO EXISTING PAYMENTS TABLE
-- =====================================================

-- Add security-related columns to payments table (ignore if exists)
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'ip_hash') = 0,
  'ALTER TABLE payments ADD COLUMN ip_hash VARCHAR(16)',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'user_agent_hash') = 0,
  'ALTER TABLE payments ADD COLUMN user_agent_hash VARCHAR(32)',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_fingerprint') = 0,
  'ALTER TABLE payments ADD COLUMN payment_fingerprint VARCHAR(32)',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'risk_score') = 0,
  'ALTER TABLE payments ADD COLUMN risk_score INT DEFAULT 0',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'risk_flags') = 0,
  'ALTER TABLE payments ADD COLUMN risk_flags JSON',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- ADD SECURITY FIELDS TO INVOICES TABLE
-- =====================================================

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_token_hash') = 0,
  'ALTER TABLE invoices ADD COLUMN payment_token_hash VARCHAR(64)',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'qr_token_generated_at') = 0,
  'ALTER TABLE invoices ADD COLUMN qr_token_generated_at TIMESTAMP',
  'SELECT 1'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- CLEANUP PROCEDURE FOR OLD SECURITY LOGS
-- Run periodically (e.g., monthly) to clean old logs
-- =====================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS cleanup_payment_security_logs()
BEGIN
  -- Delete security logs older than 90 days
  DELETE FROM payment_security_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
  
  -- Delete audit trail older than 365 days (keep for 1 year)
  DELETE FROM payment_audit_trail WHERE created_at < DATE_SUB(NOW(), INTERVAL 365 DAY);
  
  -- Delete expired blacklist entries
  DELETE FROM payment_token_blacklist WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  -- Delete cleared suspicious patterns older than 180 days
  DELETE FROM suspicious_payment_patterns 
    WHERE status = 'CLEARED' AND last_detected < DATE_SUB(NOW(), INTERVAL 180 DAY);
END //

DELIMITER ;

-- =====================================================
-- EVENT SCHEDULER FOR AUTOMATIC CLEANUP (Optional)
-- Uncomment to enable automatic cleanup
-- =====================================================
-- SET GLOBAL event_scheduler = ON;

-- CREATE EVENT IF NOT EXISTS cleanup_payment_security_logs_event
-- ON SCHEDULE EVERY 1 MONTH
-- STARTS CURRENT_DATE + INTERVAL 1 DAY
-- DO CALL cleanup_payment_security_logs();
