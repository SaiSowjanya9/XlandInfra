-- Schema V28: Auto Renewal System
-- Implements automatic renewal of schedule series when contracts expire or all visits are completed

-- ============================================
-- ADD AUTO-RENEWAL COLUMNS TO SCHEDULE_SERIES
-- ============================================
ALTER TABLE schedule_series
ADD COLUMN IF NOT EXISTS auto_renewal_enabled BOOLEAN DEFAULT TRUE COMMENT 'Whether auto-renewal is enabled for this series',
ADD COLUMN IF NOT EXISTS renewal_notice_days INT DEFAULT 30 COMMENT 'Days before contract end to trigger renewal notice',
ADD COLUMN IF NOT EXISTS renewal_status ENUM('not_applicable', 'pending', 'approved', 'declined', 'renewed') DEFAULT 'not_applicable' COMMENT 'Current renewal status',
ADD COLUMN IF NOT EXISTS renewal_notice_sent_at TIMESTAMP NULL COMMENT 'When renewal notice was sent',
ADD COLUMN IF NOT EXISTS renewed_from_series_id INT NULL COMMENT 'ID of the original series this was renewed from',
ADD COLUMN IF NOT EXISTS renewed_to_series_id INT NULL COMMENT 'ID of the new series created from this renewal',
ADD COLUMN IF NOT EXISTS renewal_approved_by INT NULL COMMENT 'User who approved the renewal',
ADD COLUMN IF NOT EXISTS renewal_approved_at TIMESTAMP NULL COMMENT 'When renewal was approved',
ADD COLUMN IF NOT EXISTS renewal_declined_reason TEXT NULL COMMENT 'Reason for declining renewal';

-- Add index for renewal queries
ALTER TABLE schedule_series
ADD INDEX IF NOT EXISTS idx_ss_renewal_status (renewal_status),
ADD INDEX IF NOT EXISTS idx_ss_auto_renewal (auto_renewal_enabled, contract_end_date);

-- ============================================
-- SCHEDULE RENEWALS TABLE
-- Tracks all renewal requests and their status
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_renewals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  renewal_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- Original Series
  original_series_id INT NOT NULL,
  original_series_code VARCHAR(50),
  
  -- New Series (created on approval)
  new_series_id INT NULL,
  new_series_code VARCHAR(50),
  
  -- Service Details (copied from original)
  property_id INT NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  service_category VARCHAR(100),
  vendor_id INT,
  vendor_name VARCHAR(100),
  frequency VARCHAR(50),
  total_visits INT DEFAULT 1,
  
  -- Renewal Period
  renewal_start_date DATE NOT NULL,
  renewal_end_date DATE,
  
  -- Pricing (optional - for estimates)
  renewal_amount DECIMAL(12, 2),
  
  -- Status
  status ENUM('pending_approval', 'approved', 'declined', 'auto_approved', 'expired') DEFAULT 'pending_approval',
  trigger_type ENUM('contract_expiry', 'visits_completed', 'manual') DEFAULT 'contract_expiry',
  
  -- Customer Response
  customer_notified_at TIMESTAMP NULL,
  customer_response ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
  customer_response_at TIMESTAMP NULL,
  customer_notes TEXT,
  
  -- Admin/FP Response
  admin_notified_at TIMESTAMP NULL,
  admin_response ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
  admin_response_at TIMESTAMP NULL,
  admin_response_by INT,
  admin_notes TEXT,
  
  -- Decline Reason
  decline_reason TEXT,
  
  -- Audit Trail
  franchise_partner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_sr_status (status),
  INDEX idx_sr_property (property_id),
  INDEX idx_sr_original_series (original_series_id),
  INDEX idx_sr_fp (franchise_partner_id),
  INDEX idx_sr_trigger (trigger_type),
  INDEX idx_sr_created (created_at),
  
  FOREIGN KEY (original_series_id) REFERENCES schedule_series(id) ON DELETE CASCADE,
  FOREIGN KEY (new_series_id) REFERENCES schedule_series(id) ON DELETE SET NULL,
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (admin_response_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- RENEWAL HISTORY TABLE
-- Tracks all changes to renewal requests
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_renewal_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  renewal_id INT NOT NULL,
  
  -- Change Details
  action ENUM('created', 'customer_notified', 'customer_approved', 'customer_declined', 
              'admin_notified', 'admin_approved', 'admin_declined', 'auto_approved', 
              'series_created', 'expired', 'cancelled') NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,
  
  -- Audit
  changed_by INT,
  changed_by_type ENUM('system', 'customer', 'admin', 'fp', 'manager') DEFAULT 'system',
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_srh_renewal (renewal_id),
  INDEX idx_srh_action (action),
  INDEX idx_srh_date (changed_at),
  
  FOREIGN KEY (renewal_id) REFERENCES schedule_renewals(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- RENEWAL SETTINGS TABLE (Per Property)
-- Allows customers to configure their renewal preferences
-- ============================================
CREATE TABLE IF NOT EXISTS property_renewal_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL UNIQUE,
  
  -- Auto Renewal Preferences
  auto_renewal_enabled BOOLEAN DEFAULT TRUE COMMENT 'Master switch for auto-renewal',
  auto_approve_renewals BOOLEAN DEFAULT FALSE COMMENT 'Auto-approve without customer confirmation',
  renewal_notice_days INT DEFAULT 30 COMMENT 'Days before contract end to send notice',
  
  -- Notification Preferences
  notify_by_email BOOLEAN DEFAULT TRUE,
  notify_by_sms BOOLEAN DEFAULT FALSE,
  notify_in_portal BOOLEAN DEFAULT TRUE,
  
  -- Contacts for Renewal Notifications
  renewal_contact_name VARCHAR(100),
  renewal_contact_email VARCHAR(255),
  renewal_contact_phone VARCHAR(20),
  
  -- Audit
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- VIEW: Pending Renewals Summary
-- ============================================
CREATE OR REPLACE VIEW v_pending_renewals AS
SELECT 
  sr.*,
  ss.series_id as original_series_code,
  ss.contract_start_date as original_start_date,
  ss.contract_end_date as original_end_date,
  ss.completed_visits,
  ss.total_visits as original_total_visits,
  op.community_name as property_name,
  op.property_id as property_code,
  op.zone,
  op.city,
  ov.company_name as vendor_company,
  ov.owner_name as vendor_contact,
  ov.owner_mobile as vendor_phone,
  pc.name as customer_name,
  pc.email as customer_email,
  pc.phone as customer_phone,
  DATEDIFF(ss.contract_end_date, CURDATE()) as days_until_expiry
FROM schedule_renewals sr
JOIN schedule_series ss ON sr.original_series_id = ss.id
LEFT JOIN onboarded_properties op ON sr.property_id = op.id
LEFT JOIN onboarded_vendors ov ON sr.vendor_id = ov.id
LEFT JOIN property_contacts pc ON pc.property_id = op.id AND pc.is_primary = 1
WHERE sr.status = 'pending_approval'
ORDER BY sr.created_at DESC;

-- ============================================
-- VIEW: Series Due for Renewal
-- ============================================
CREATE OR REPLACE VIEW v_series_due_for_renewal AS
SELECT 
  ss.*,
  op.community_name as property_name,
  op.property_id as property_code,
  op.zone,
  ov.company_name as vendor_company,
  DATEDIFF(ss.contract_end_date, CURDATE()) as days_until_expiry,
  (ss.completed_visits >= ss.total_visits) as all_visits_completed,
  CASE 
    WHEN ss.completed_visits >= ss.total_visits THEN 'visits_completed'
    WHEN DATEDIFF(ss.contract_end_date, CURDATE()) <= COALESCE(ss.renewal_notice_days, 30) THEN 'contract_expiring'
    ELSE 'not_due'
  END as renewal_trigger
FROM schedule_series ss
LEFT JOIN onboarded_properties op ON ss.property_id = op.id
LEFT JOIN onboarded_vendors ov ON ss.vendor_id = ov.id
WHERE ss.status = 'active'
  AND ss.auto_renewal_enabled = TRUE
  AND ss.renewal_status IN ('not_applicable', 'pending')
  AND (
    -- All visits completed
    ss.completed_visits >= ss.total_visits
    OR
    -- Contract end date approaching (within notice period)
    DATEDIFF(ss.contract_end_date, CURDATE()) <= COALESCE(ss.renewal_notice_days, 30)
  )
  -- Exclude already renewed or declined
  AND ss.renewed_to_series_id IS NULL
ORDER BY 
  CASE WHEN ss.completed_visits >= ss.total_visits THEN 0 ELSE 1 END,
  ss.contract_end_date ASC;
