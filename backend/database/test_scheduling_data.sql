-- Test Data for Property Scheduling Workflow
-- Run this to add test properties with services for scheduling

-- First, let's check existing data and add test property service schedules
-- These will show up in Pending Property Schedules section

-- Get property IDs that have paid estimates
-- Insert test service schedules for properties that need scheduling

-- Add service schedules for existing properties with paid estimates
INSERT INTO property_service_schedules (schedule_id, property_id, service_name, service_category, frequency_type, total_visits, vendor_id, status, scheduling_status, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('SCH-', op.property_id, '-', FLOOR(RAND() * 10000)) as schedule_id,
  op.id as property_id,
  'Pest Control' as service_name,
  'Pest Control' as service_category,
  'monthly' as frequency_type,
  12 as total_visits,
  (SELECT id FROM onboarded_vendors WHERE status = 'active' LIMIT 1) as vendor_id,
  'pending_schedule' as status,
  'not_started' as scheduling_status,
  op.franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties op
INNER JOIN fp_estimates fe ON fe.property_id = op.id 
WHERE fe.status = 'approved' 
  AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
  AND op.id NOT IN (SELECT DISTINCT property_id FROM property_service_schedules WHERE service_name = 'Pest Control')
LIMIT 3;

-- Add Deep Cleaning service
INSERT INTO property_service_schedules (schedule_id, property_id, service_name, service_category, frequency_type, total_visits, vendor_id, status, scheduling_status, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('SCH-', op.property_id, '-DC-', FLOOR(RAND() * 10000)) as schedule_id,
  op.id as property_id,
  'Deep Cleaning' as service_name,
  'Cleaning' as service_category,
  'quarterly' as frequency_type,
  4 as total_visits,
  (SELECT id FROM onboarded_vendors WHERE status = 'active' ORDER BY RAND() LIMIT 1) as vendor_id,
  'pending_schedule' as status,
  'not_started' as scheduling_status,
  op.franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties op
INNER JOIN fp_estimates fe ON fe.property_id = op.id 
WHERE fe.status = 'approved' 
  AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
  AND op.id NOT IN (SELECT DISTINCT property_id FROM property_service_schedules WHERE service_name = 'Deep Cleaning')
LIMIT 3;

-- Add AC Service
INSERT INTO property_service_schedules (schedule_id, property_id, service_name, service_category, frequency_type, total_visits, vendor_id, status, scheduling_status, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('SCH-', op.property_id, '-AC-', FLOOR(RAND() * 10000)) as schedule_id,
  op.id as property_id,
  'AC Service' as service_name,
  'HVAC' as service_category,
  'quarterly' as frequency_type,
  4 as total_visits,
  (SELECT id FROM onboarded_vendors WHERE status = 'active' ORDER BY RAND() LIMIT 1) as vendor_id,
  'pending_schedule' as status,
  'not_started' as scheduling_status,
  op.franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties op
INNER JOIN fp_estimates fe ON fe.property_id = op.id 
WHERE fe.status = 'approved' 
  AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
  AND op.id NOT IN (SELECT DISTINCT property_id FROM property_service_schedules WHERE service_name = 'AC Service')
LIMIT 2;

-- Add Plumbing Service
INSERT INTO property_service_schedules (schedule_id, property_id, service_name, service_category, frequency_type, total_visits, vendor_id, status, scheduling_status, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('SCH-', op.property_id, '-PLB-', FLOOR(RAND() * 10000)) as schedule_id,
  op.id as property_id,
  'Plumbing Maintenance' as service_name,
  'Plumbing' as service_category,
  'half_yearly' as frequency_type,
  2 as total_visits,
  (SELECT id FROM onboarded_vendors WHERE status = 'active' ORDER BY RAND() LIMIT 1) as vendor_id,
  'pending_schedule' as status,
  'not_started' as scheduling_status,
  op.franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties op
INNER JOIN fp_estimates fe ON fe.property_id = op.id 
WHERE fe.status = 'approved' 
  AND (fe.payment_status = 'paid' OR fe.payment_status = 'partial')
  AND op.id NOT IN (SELECT DISTINCT property_id FROM property_service_schedules WHERE service_name = 'Plumbing Maintenance')
LIMIT 2;

-- Update pending_property_schedules table to reflect new services
INSERT INTO pending_property_schedules (property_id, estimate_id, total_services, vendors_assigned, services_scheduled, franchise_partner_id, scheduling_status, created_at)
SELECT 
  pss.property_id,
  fe.id as estimate_id,
  COUNT(DISTINCT pss.service_name) as total_services,
  COUNT(DISTINCT CASE WHEN pss.vendor_id IS NOT NULL THEN pss.id END) as vendors_assigned,
  0 as services_scheduled,
  pss.franchise_partner_id,
  'pending_schedule' as scheduling_status,
  NOW()
FROM property_service_schedules pss
INNER JOIN onboarded_properties op ON op.id = pss.property_id
LEFT JOIN fp_estimates fe ON fe.property_id = pss.property_id AND fe.status = 'approved'
WHERE pss.scheduling_status = 'not_started'
  AND pss.property_id NOT IN (SELECT property_id FROM pending_property_schedules)
GROUP BY pss.property_id, fe.id, pss.franchise_partner_id
ON DUPLICATE KEY UPDATE
  total_services = VALUES(total_services),
  vendors_assigned = VALUES(vendors_assigned),
  scheduling_status = 'pending_schedule',
  updated_at = NOW();

-- Show summary of test data added
SELECT 
  'Test Data Summary' as info,
  (SELECT COUNT(DISTINCT property_id) FROM property_service_schedules WHERE scheduling_status = 'not_started') as properties_pending_scheduling,
  (SELECT COUNT(*) FROM property_service_schedules WHERE scheduling_status = 'not_started') as total_services_to_schedule;
