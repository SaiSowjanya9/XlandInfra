-- Schema V23: Schedule Series & Schedule Occurrences Architecture
-- Implements proper hierarchy: Property → Estimate → Invoice → Payment → Property Service → Vendor Assignment → Schedule Series → Schedule Occurrences → Work Orders
-- This architecture allows rescheduling individual visits without affecting the full series

-- ============================================
-- SCHEDULE SERIES TABLE (Master Record)
-- Represents the full contract/schedule for a service
-- Example: "HVAC Monthly - 12 Visits - ABC HVAC - Sep 2026 to Aug 2027"
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  series_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- Relationship Chain
  property_id INT NOT NULL,
  estimate_id INT,
  invoice_id INT,
  package_id INT,
  service_id INT,
  
  -- Service Details
  service_name VARCHAR(100) NOT NULL,
  service_category VARCHAR(100),
  
  -- Vendor Assignment
  vendor_id INT,
  vendor_name VARCHAR(100),
  vendor_assigned_at TIMESTAMP NULL,
  vendor_assigned_by INT,
  
  -- Frequency & Visits
  frequency ENUM('daily', 'weekly', 'bi_weekly', 'monthly', 'every_2_months', 'quarterly', 'half_yearly', 'yearly', 'one_time', 'custom') DEFAULT 'monthly',
  frequency_details JSON,
  total_visits INT DEFAULT 1,
  completed_visits INT DEFAULT 0,
  
  -- Contract Period
  contract_start_date DATE NOT NULL,
  contract_end_date DATE,
  
  -- Scheduling Preferences
  preferred_day_of_week VARCHAR(20),
  preferred_time_slot VARCHAR(50),
  schedule_notes TEXT,
  
  -- Zone for vendor optimization
  zone_id INT,
  zone_name VARCHAR(100),
  
  -- Status
  status ENUM('draft', 'pending_vendor', 'pending_schedule', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
  
  -- Audit Trail
  franchise_partner_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_ss_property (property_id),
  INDEX idx_ss_vendor (vendor_id),
  INDEX idx_ss_status (status),
  INDEX idx_ss_fp (franchise_partner_id),
  INDEX idx_ss_service (service_name),
  INDEX idx_ss_contract_dates (contract_start_date, contract_end_date),
  INDEX idx_ss_zone (zone_id),
  
  FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (vendor_assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- SCHEDULE OCCURRENCES TABLE (Individual Visits)
-- Each row = one scheduled visit in the series
-- Example: SCH-001-01 → Sep 12, SCH-001-02 → Oct 11, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_occurrences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occurrence_id VARCHAR(50) UNIQUE NOT NULL,
  series_id INT NOT NULL,
  
  -- Visit Identification
  visit_number INT NOT NULL,
  
  -- Dates
  target_date DATE NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  
  -- Vendor (can differ from series if substituted)
  vendor_id INT,
  vendor_name VARCHAR(100),
  
  -- Zone
  zone_id INT,
  zone_name VARCHAR(100),
  
  -- Work Order (generated 7 days before)
  work_order_id INT,
  work_order_generated_at TIMESTAMP NULL,
  
  -- Status
  status ENUM('scheduled', 'confirmed', 'work_order_created', 'in_progress', 'completed', 'verified', 'rescheduled', 'cancelled', 'missed', 'skipped') DEFAULT 'scheduled',
  
  -- Rescheduling (preserves history)
  rescheduled_from_date DATE,
  rescheduled_from_time TIME,
  rescheduled_by INT,
  rescheduled_at TIMESTAMP NULL,
  reschedule_reason TEXT,
  reschedule_scope ENUM('this_visit_only', 'this_and_future') DEFAULT 'this_visit_only',
  
  -- Cancellation
  cancelled_by INT,
  cancelled_at TIMESTAMP NULL,
  cancellation_reason TEXT,
  
  -- Customer Request (for custom scheduling)
  customer_requested BOOLEAN DEFAULT FALSE,
  customer_preferred_date DATE,
  customer_preferred_time VARCHAR(50),
  customer_notes TEXT,
  
  -- Completion
  completed_at TIMESTAMP NULL,
  completed_by INT,
  completion_notes TEXT,
  
  -- Verification (by Manager/FP)
  verified_at TIMESTAMP NULL,
  verified_by INT,
  verification_notes TEXT,
  
  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_so_series (series_id),
  INDEX idx_so_vendor (vendor_id),
  INDEX idx_so_target_date (target_date),
  INDEX idx_so_scheduled_date (scheduled_date),
  INDEX idx_so_status (status),
  INDEX idx_so_work_order (work_order_id),
  INDEX idx_so_zone (zone_id),
  INDEX idx_so_visit (series_id, visit_number),
  
  FOREIGN KEY (series_id) REFERENCES schedule_series(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE SET NULL,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (rescheduled_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- SCHEDULE SERIES HISTORY TABLE
-- Tracks all changes to schedule series
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_series_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  series_id INT NOT NULL,
  
  -- Change Details
  action ENUM('created', 'vendor_assigned', 'vendor_changed', 'status_changed', 'dates_changed', 'cancelled', 'reactivated') NOT NULL,
  old_value JSON,
  new_value JSON,
  change_reason TEXT,
  
  -- Audit
  changed_by INT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_ssh_series (series_id),
  INDEX idx_ssh_action (action),
  INDEX idx_ssh_date (changed_at),
  
  FOREIGN KEY (series_id) REFERENCES schedule_series(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- SCHEDULE OCCURRENCE HISTORY TABLE
-- Tracks all changes to individual occurrences
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_occurrence_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occurrence_id INT NOT NULL,
  
  -- Change Details
  action ENUM('created', 'rescheduled', 'vendor_changed', 'confirmed', 'started', 'completed', 'verified', 'cancelled', 'missed') NOT NULL,
  old_value JSON,
  new_value JSON,
  change_reason TEXT,
  
  -- Audit
  changed_by INT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_soh_occurrence (occurrence_id),
  INDEX idx_soh_action (action),
  INDEX idx_soh_date (changed_at),
  
  FOREIGN KEY (occurrence_id) REFERENCES schedule_occurrences(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- VENDOR ZONE AVAILABILITY TABLE
-- Tracks vendor jobs per zone per date for smart recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_zone_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  zone_id INT,
  zone_name VARCHAR(100),
  scheduled_date DATE NOT NULL,
  
  -- Job Count
  job_count INT DEFAULT 0,
  
  -- Time Slots Booked
  booked_slots JSON,
  
  -- Created/Updated
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_vendor_zone_date (vendor_id, zone_id, scheduled_date),
  INDEX idx_vzs_vendor (vendor_id),
  INDEX idx_vzs_zone (zone_id),
  INDEX idx_vzs_date (scheduled_date),
  
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE CASCADE
);

-- ============================================
-- MIGRATION: Copy data from old tables to new structure
-- Run this only if property_service_schedules and scheduled_visits have data
-- ============================================

-- Migrate Schedule Series from property_service_schedules
INSERT IGNORE INTO schedule_series (
  series_id, property_id, estimate_id, service_name, service_category,
  vendor_id, vendor_assigned_at, vendor_assigned_by,
  frequency, total_visits, contract_start_date, contract_end_date,
  preferred_day_of_week, preferred_time_slot, schedule_notes,
  status, franchise_partner_id, created_by, created_at, updated_at
)
SELECT 
  schedule_id, property_id, estimate_id, service_name, service_category,
  vendor_id, vendor_assigned_at, vendor_assigned_by,
  frequency_type, total_visits, start_date, end_date,
  preferred_day, preferred_time_slot, schedule_notes,
  CASE status 
    WHEN 'pending_vendor' THEN 'pending_vendor'
    WHEN 'pending_schedule' THEN 'pending_schedule'
    WHEN 'scheduled' THEN 'active'
    WHEN 'active' THEN 'active'
    WHEN 'paused' THEN 'paused'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'draft'
  END,
  franchise_partner_id, created_by, created_at, updated_at
FROM property_service_schedules
WHERE NOT EXISTS (SELECT 1 FROM schedule_series WHERE schedule_series.series_id = property_service_schedules.schedule_id);

-- Migrate Schedule Occurrences from scheduled_visits
INSERT IGNORE INTO schedule_occurrences (
  occurrence_id, series_id, visit_number, target_date, scheduled_date,
  scheduled_time_start, scheduled_time_end, vendor_id,
  work_order_id, work_order_generated_at, status,
  rescheduled_from_date, rescheduled_by, rescheduled_at, reschedule_reason,
  cancelled_by, cancelled_at, cancellation_reason,
  customer_requested, customer_preferred_date, customer_preferred_time, customer_notes,
  created_at, updated_at
)
SELECT 
  sv.visit_id,
  ss.id,
  sv.visit_number,
  COALESCE(sv.original_date, sv.scheduled_date),
  sv.scheduled_date,
  sv.scheduled_time_start,
  sv.scheduled_time_end,
  sv.vendor_id,
  sv.work_order_id,
  sv.work_order_generated_at,
  CASE sv.status 
    WHEN 'scheduled' THEN 'scheduled'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'rescheduled' THEN 'rescheduled'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'missed' THEN 'missed'
    ELSE 'scheduled'
  END,
  sv.original_date,
  sv.rescheduled_by,
  sv.rescheduled_at,
  sv.reschedule_reason,
  sv.cancelled_by,
  sv.cancelled_at,
  sv.cancellation_note,
  sv.customer_requested,
  sv.customer_preferred_date,
  sv.customer_preferred_time,
  sv.customer_notes,
  sv.created_at,
  sv.updated_at
FROM scheduled_visits sv
JOIN schedule_series ss ON ss.series_id = (
  SELECT schedule_id FROM property_service_schedules WHERE id = sv.service_schedule_id
)
WHERE NOT EXISTS (SELECT 1 FROM schedule_occurrences WHERE schedule_occurrences.occurrence_id = sv.visit_id);

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- View: Full Schedule Details (Series + Property + Vendor)
CREATE OR REPLACE VIEW v_schedule_series_details AS
SELECT 
  ss.*,
  op.property_name,
  op.property_address,
  op.property_type,
  op.customer_name,
  op.customer_phone,
  ov.business_name AS vendor_business_name,
  ov.contact_name AS vendor_contact_name,
  ov.contact_phone AS vendor_phone,
  (SELECT COUNT(*) FROM schedule_occurrences so WHERE so.series_id = ss.id) AS total_occurrences,
  (SELECT COUNT(*) FROM schedule_occurrences so WHERE so.series_id = ss.id AND so.status = 'completed') AS completed_occurrences,
  (SELECT MIN(scheduled_date) FROM schedule_occurrences so WHERE so.series_id = ss.id AND so.status IN ('scheduled', 'confirmed', 'work_order_created')) AS next_occurrence_date
FROM schedule_series ss
LEFT JOIN onboarded_properties op ON ss.property_id = op.id
LEFT JOIN onboarded_vendors ov ON ss.vendor_id = ov.id;

-- View: Upcoming Occurrences (Next 30 days)
CREATE OR REPLACE VIEW v_upcoming_occurrences AS
SELECT 
  so.*,
  ss.service_name,
  ss.service_category,
  ss.frequency,
  ss.total_visits AS series_total_visits,
  op.property_name,
  op.property_address,
  op.customer_name,
  op.customer_phone,
  ov.business_name AS vendor_business_name,
  ov.contact_name AS vendor_contact_name,
  ov.contact_phone AS vendor_phone
FROM schedule_occurrences so
JOIN schedule_series ss ON so.series_id = ss.id
LEFT JOIN onboarded_properties op ON ss.property_id = op.id
LEFT JOIN onboarded_vendors ov ON so.vendor_id = ov.id
WHERE so.scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
  AND so.status IN ('scheduled', 'confirmed', 'work_order_created')
ORDER BY so.scheduled_date, so.scheduled_time_start;

-- View: Vendor Zone Jobs (for recommendation engine)
CREATE OR REPLACE VIEW v_vendor_zone_jobs AS
SELECT 
  so.vendor_id,
  ss.zone_name,
  so.scheduled_date,
  COUNT(*) AS job_count,
  GROUP_CONCAT(DISTINCT ss.service_name ORDER BY ss.service_name SEPARATOR ', ') AS services
FROM schedule_occurrences so
JOIN schedule_series ss ON so.series_id = ss.id
WHERE so.status IN ('scheduled', 'confirmed', 'work_order_created', 'in_progress')
GROUP BY so.vendor_id, ss.zone_name, so.scheduled_date
ORDER BY so.vendor_id, so.scheduled_date;
