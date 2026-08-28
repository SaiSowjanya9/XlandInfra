-- Schema V22: Property Scheduling & Vendor Assignment Enhancement
-- Adds comprehensive scheduling support with vendor assignment per service

-- ============================================
-- PROPERTY SERVICE SCHEDULES TABLE
-- Tracks individual service scheduling per property (each service gets its own schedule)
-- ============================================
CREATE TABLE IF NOT EXISTS property_service_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id VARCHAR(50) UNIQUE NOT NULL,
  property_id INT NOT NULL,
  estimate_id INT,
  
  -- Service Details (from estimate service_rows)
  service_name VARCHAR(100) NOT NULL,
  service_category VARCHAR(100),
  frequency_type ENUM('daily', 'weekly', 'bi_weekly', 'monthly', 'every_2_months', 'quarterly', 'half_yearly', 'yearly', 'one_time') DEFAULT 'monthly',
  frequency_count INT DEFAULT 1,
  total_visits INT DEFAULT 1,
  
  -- Vendor Assignment
  vendor_id INT,
  vendor_assigned_at TIMESTAMP NULL,
  vendor_assigned_by INT,
  
  -- Schedule Details
  start_date DATE,
  end_date DATE,
  preferred_day VARCHAR(20),
  preferred_time_slot VARCHAR(50),
  schedule_notes TEXT,
  
  -- Recommended Dates (JSON array of suggested dates from vendor availability)
  recommended_dates JSON,
  
  -- Status
  status ENUM('pending_vendor', 'pending_schedule', 'scheduled', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'pending_vendor',
  scheduling_status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  
  -- Tracking
  franchise_partner_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_pss_property (property_id),
  INDEX idx_pss_vendor (vendor_id),
  INDEX idx_pss_status (status),
  INDEX idx_pss_fp (franchise_partner_id),
  INDEX idx_pss_service (service_name),
  
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (vendor_assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- SCHEDULED VISITS TABLE
-- Individual scheduled visits (generated from property_service_schedules)
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  visit_id VARCHAR(50) UNIQUE NOT NULL,
  service_schedule_id INT NOT NULL,
  property_id INT NOT NULL,
  vendor_id INT,
  
  -- Visit Details
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  visit_number INT DEFAULT 1,
  total_visits INT DEFAULT 1,
  
  -- Status
  status ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'rescheduled', 'cancelled', 'missed') DEFAULT 'scheduled',
  
  -- Work Order Reference (auto-generated before visit)
  work_order_id INT,
  work_order_generated_at TIMESTAMP NULL,
  
  -- Rescheduling
  original_date DATE,
  rescheduled_by INT,
  rescheduled_at TIMESTAMP NULL,
  reschedule_reason TEXT,
  
  -- Cancellation
  cancelled_by INT,
  cancelled_at TIMESTAMP NULL,
  cancellation_note TEXT,
  
  -- Customer Custom Scheduling
  customer_requested BOOLEAN DEFAULT FALSE,
  customer_preferred_date DATE,
  customer_preferred_time VARCHAR(50),
  customer_notes TEXT,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_sv_schedule (service_schedule_id),
  INDEX idx_sv_property (property_id),
  INDEX idx_sv_vendor (vendor_id),
  INDEX idx_sv_date (scheduled_date),
  INDEX idx_sv_status (status),
  
  FOREIGN KEY (service_schedule_id) REFERENCES property_service_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL
);

-- ============================================
-- PENDING PROPERTY SCHEDULES TABLE
-- Tracks properties ready for scheduling (after payment + vendor assignment)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_property_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL UNIQUE,
  estimate_id INT,
  
  -- Service Summary
  total_services INT DEFAULT 0,
  vendors_assigned INT DEFAULT 0,
  services_scheduled INT DEFAULT 0,
  
  -- Status
  scheduling_status ENUM('pending_vendor', 'pending_schedule', 'partially_scheduled', 'fully_scheduled') DEFAULT 'pending_vendor',
  
  -- Notifications
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP NULL,
  
  -- Tracking
  franchise_partner_id INT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_pps_property (property_id),
  INDEX idx_pps_status (scheduling_status),
  INDEX idx_pps_fp (franchise_partner_id),
  
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE
);

-- ============================================
-- IN-PORTAL NOTIFICATIONS TABLE
-- For real-time in-app notifications
-- ============================================
CREATE TABLE IF NOT EXISTS portal_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- Target
  user_id INT,
  franchise_partner_id INT,
  role_type ENUM('admin', 'manager', 'coordinator', 'supervisor', 'executive', 'fp', 'vendor') NOT NULL,
  
  -- Notification Content
  type ENUM('scheduling', 'vendor_assignment', 'payment', 'work_order', 'estimate', 'system', 'alert') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  
  -- Reference
  reference_type VARCHAR(50),
  reference_id INT,
  reference_data JSON,
  
  -- Action
  action_url VARCHAR(255),
  action_label VARCHAR(50),
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP NULL,
  
  -- Priority
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  
  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  
  INDEX idx_pn_user (user_id),
  INDEX idx_pn_fp (franchise_partner_id),
  INDEX idx_pn_role (role_type),
  INDEX idx_pn_type (type),
  INDEX idx_pn_read (is_read),
  INDEX idx_pn_created (created_at)
);

-- ============================================
-- VENDOR AVAILABILITY TABLE
-- Track vendor available dates/time slots
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  
  -- Availability Type
  availability_type ENUM('available', 'unavailable', 'preferred') DEFAULT 'available',
  
  -- Date/Time
  date DATE,
  day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
  time_slot_start TIME,
  time_slot_end TIME,
  
  -- Recurring
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50),
  
  -- Capacity
  max_visits_per_day INT DEFAULT 5,
  current_bookings INT DEFAULT 0,
  
  -- Notes
  notes TEXT,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_va_vendor (vendor_id),
  INDEX idx_va_date (date),
  INDEX idx_va_day (day_of_week),
  
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE CASCADE
);

-- ============================================
-- ADD service_capability to onboarded_vendors (if not exists)
-- ============================================
ALTER TABLE onboarded_vendors 
  ADD COLUMN IF NOT EXISTS service_capabilities JSON,
  ADD COLUMN IF NOT EXISTS max_daily_visits INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS preferred_zones JSON;

-- ============================================
-- ADD scheduling_ready flag to fp_estimates
-- ============================================
ALTER TABLE fp_estimates 
  ADD COLUMN IF NOT EXISTS scheduling_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduling_ready_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS all_vendors_assigned BOOLEAN DEFAULT FALSE;

-- ============================================
-- Trigger to auto-update pending_property_schedules on vendor assignment
-- ============================================
DELIMITER //

CREATE TRIGGER IF NOT EXISTS after_vendor_assignment_insert
AFTER INSERT ON property_vendor_assignments
FOR EACH ROW
BEGIN
  DECLARE prop_fp_id INT;
  DECLARE est_id INT;
  DECLARE total_svc INT;
  DECLARE assigned_cnt INT;
  
  -- Get property's FP and estimate
  SELECT op.franchise_partner_id, fe.id INTO prop_fp_id, est_id
  FROM onboarded_properties op
  LEFT JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
  WHERE op.id = NEW.property_id
  LIMIT 1;
  
  -- Count total services from estimate
  SELECT JSON_LENGTH(COALESCE(service_rows, '[]')) INTO total_svc
  FROM fp_estimates WHERE property_id = NEW.property_id AND status = 'approved'
  LIMIT 1;
  
  -- Count assigned vendors
  SELECT COUNT(*) INTO assigned_cnt
  FROM property_vendor_assignments
  WHERE property_id = NEW.property_id AND is_active = 1;
  
  -- Insert or update pending_property_schedules
  INSERT INTO pending_property_schedules (property_id, estimate_id, total_services, vendors_assigned, franchise_partner_id, scheduling_status)
  VALUES (NEW.property_id, est_id, COALESCE(total_svc, 0), assigned_cnt, prop_fp_id,
    CASE WHEN assigned_cnt >= COALESCE(total_svc, 0) THEN 'pending_schedule' ELSE 'pending_vendor' END
  )
  ON DUPLICATE KEY UPDATE
    vendors_assigned = assigned_cnt,
    scheduling_status = CASE WHEN assigned_cnt >= total_services THEN 'pending_schedule' ELSE 'pending_vendor' END,
    updated_at = NOW();
    
END//

CREATE TRIGGER IF NOT EXISTS after_vendor_assignment_update
AFTER UPDATE ON property_vendor_assignments
FOR EACH ROW
BEGIN
  DECLARE assigned_cnt INT;
  DECLARE total_svc INT;
  
  -- Count assigned vendors
  SELECT COUNT(*) INTO assigned_cnt
  FROM property_vendor_assignments
  WHERE property_id = NEW.property_id AND is_active = 1;
  
  -- Get total services
  SELECT total_services INTO total_svc
  FROM pending_property_schedules
  WHERE property_id = NEW.property_id;
  
  -- Update pending_property_schedules
  UPDATE pending_property_schedules SET
    vendors_assigned = assigned_cnt,
    scheduling_status = CASE WHEN assigned_cnt >= COALESCE(total_svc, 0) THEN 'pending_schedule' ELSE 'pending_vendor' END,
    updated_at = NOW()
  WHERE property_id = NEW.property_id;
    
END//

DELIMITER ;

-- ============================================
-- Insert sample vendor availability (for development)
-- ============================================
-- This will be populated by vendors through their portal

SELECT 'Schema V22: Property Scheduling & Vendor Assignment Enhancement - Complete' as status;
