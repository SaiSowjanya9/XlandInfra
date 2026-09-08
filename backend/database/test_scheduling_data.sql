-- ============================================
-- Test Data for Property Scheduling Workflow
-- Run this to add test properties with services for scheduling
-- ============================================

-- ============================================
-- STEP 1: Create Test Vendors (if not exist)
-- ============================================
INSERT IGNORE INTO onboarded_vendors (vendor_id, company_name, owner_name, owner_mobile, owner_email, service_type, zone, area_name, status, franchise_partner_id, max_daily_visits, rating, total_jobs_completed, created_at)
VALUES 
  ('VND-001', 'ABC HVAC Services', 'Rajesh Kumar', '9876543210', 'rajesh@abchvac.com', 'HVAC', 'Zone A', 'Koramangala', 'active', 1, 5, 4.5, 120, NOW()),
  ('VND-002', 'XYZ Plumbing Solutions', 'Suresh Reddy', '9876543211', 'suresh@xyzplumbing.com', 'Plumbing', 'Zone A', 'HSR Layout', 'active', 1, 6, 4.3, 95, NOW()),
  ('VND-003', 'Power Electrical Services', 'Mahesh Rao', '9876543212', 'mahesh@powerelec.com', 'Electrical', 'Zone B', 'Whitefield', 'active', 1, 4, 4.7, 150, NOW()),
  ('VND-004', 'PestFree Solutions', 'Anand Sharma', '9876543213', 'anand@pestfree.com', 'Pest Control', 'Zone A', 'Indiranagar', 'active', 1, 8, 4.6, 200, NOW()),
  ('VND-005', 'Aqua Tank Services', 'Vijay Kumar', '9876543214', 'vijay@aquatank.com', 'Water Tank', 'Zone B', 'Marathahalli', 'active', 1, 5, 4.4, 80, NOW()),
  ('VND-006', 'CleanPro Deep Cleaning', 'Ramesh Nair', '9876543215', 'ramesh@cleanpro.com', 'Cleaning', 'Zone A', 'Jayanagar', 'active', 1, 3, 4.8, 175, NOW()),
  ('VND-007', 'LiftCare AMC Services', 'Kiran Desai', '9876543216', 'kiran@liftcare.com', 'Lift AMC', 'Zone B', 'Electronic City', 'active', 1, 4, 4.5, 60, NOW()),
  ('VND-008', 'Garden Green Landscaping', 'Prakash Hegde', '9876543217', 'prakash@gardengreen.com', 'Landscaping', 'Zone A', 'JP Nagar', 'active', 1, 3, 4.2, 45, NOW());

-- ============================================
-- STEP 2: Create Test Properties (if not exist)
-- ============================================
INSERT IGNORE INTO onboarded_properties (property_id, community_name, property_type, zone, area_name, address, city, state, pincode, contact_person, contact_phone, contact_email, status, franchise_partner_id, created_at)
VALUES
  ('PROP-101', 'Green Valley Apartments', 'Apartment', 'Zone A', 'Koramangala', '123 Green Valley Road', 'Bangalore', 'Karnataka', '560034', 'Mr. Ramesh Kumar', '9876543001', 'ramesh@greenvalley.com', 'active', 1, NOW()),
  ('PROP-102', 'Sunrise Villas', 'Villa', 'Zone B', 'Whitefield', '456 Sunrise Layout', 'Bangalore', 'Karnataka', '560066', 'Mrs. Neha Singh', '9876543002', 'neha@sunrisevillas.com', 'active', 1, NOW()),
  ('PROP-103', 'Royal Heights', 'Apartment', 'Zone A', 'Indiranagar', '789 Royal Heights Complex', 'Bangalore', 'Karnataka', '560038', 'Mr. Amit Patel', '9876543003', 'amit@royalheights.com', 'active', 1, NOW()),
  ('PROP-104', 'Lake View Residency', 'Apartment', 'Zone B', 'HSR Layout', '321 Lake View Lane', 'Bangalore', 'Karnataka', '560102', 'Mrs. Priya Sharma', '9876543004', 'priya@lakeview.com', 'active', 1, NOW()),
  ('PROP-105', 'Paradise Towers', 'Apartment', 'Zone A', 'JP Nagar', '555 Paradise Main Road', 'Bangalore', 'Karnataka', '560078', 'Mr. Vikram Singh', '9876543005', 'vikram@paradisetowers.com', 'active', 1, NOW()),
  ('PROP-106', 'Silver Oak Estate', 'Villa', 'Zone B', 'Electronic City', '777 Silver Oak Enclave', 'Bangalore', 'Karnataka', '560100', 'Mrs. Divya Krishnan', '9876543006', 'divya@silveroak.com', 'active', 1, NOW()),
  ('PROP-107', 'Maple Gardens', 'Gated Community', 'Zone A', 'Jayanagar', '888 Maple Gardens Layout', 'Bangalore', 'Karnataka', '560041', 'Mr. Rahul Verma', '9876543007', 'rahul@maplegardens.com', 'active', 1, NOW()),
  ('PROP-108', 'Crystal Bay', 'Apartment', 'Zone B', 'Marathahalli', '999 Crystal Bay Complex', 'Bangalore', 'Karnataka', '560037', 'Mrs. Sneha Reddy', '9876543008', 'sneha@crystalbay.com', 'active', 1, NOW());

-- ============================================
-- STEP 3: Create Property Contacts
-- ============================================
INSERT IGNORE INTO property_contacts (property_id, name, phone, email, designation, is_primary)
SELECT id, contact_person, contact_phone, contact_email, 'Owner', 1
FROM onboarded_properties
WHERE property_id IN ('PROP-101', 'PROP-102', 'PROP-103', 'PROP-104', 'PROP-105', 'PROP-106', 'PROP-107', 'PROP-108');

-- ============================================
-- STEP 4: Create Estimates with Service Rows (KEY DATA)
-- ============================================

-- PROP-101: Green Valley Apartments - 5 services, all vendors assigned
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Apartment Basic' as package_name,
  'Annual Maintenance Package' as title,
  125000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "HVAC", "serviceType": "HVAC", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 30000},
    {"service": "Plumbing", "serviceType": "Plumbing", "frequencyType": "Every 2 Months", "frequencyCount": 6, "visits": 6, "amount": 18000},
    {"service": "Electrical", "serviceType": "Electrical", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 24000},
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Half-Yearly", "frequencyCount": 2, "visits": 2, "amount": 8000},
    {"service": "Water Tank", "serviceType": "Water Tank", "frequencyType": "Yearly", "frequencyCount": 1, "visits": 1, "amount": 5000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-101'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-101') AND status = 'approved');

-- PROP-102: Sunrise Villas - 4 services, 2 vendors assigned
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Villa Premium' as package_name,
  'Villa Maintenance Package' as title,
  180000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "Lift AMC", "serviceType": "Lift AMC", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 48000},
    {"service": "Plumbing", "serviceType": "Plumbing", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 36000},
    {"service": "Electrical", "serviceType": "Electrical", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 20000},
    {"service": "Landscaping", "serviceType": "Landscaping", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 24000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-102'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-102') AND status = 'approved');

-- PROP-103: Royal Heights - 6 services, 4 vendors assigned
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Premium Plus' as package_name,
  'Comprehensive AMC Package' as title,
  250000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "HVAC", "serviceType": "HVAC", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 45000},
    {"service": "Plumbing", "serviceType": "Plumbing", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 36000},
    {"service": "Electrical", "serviceType": "Electrical", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 40000},
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 16000},
    {"service": "Deep Cleaning", "serviceType": "Cleaning", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 28000},
    {"service": "Water Tank", "serviceType": "Water Tank", "frequencyType": "Half-Yearly", "frequencyCount": 2, "visits": 2, "amount": 6000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-103'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-103') AND status = 'approved');

-- PROP-104: Lake View Residency - 3 services, all vendors assigned
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Apartment Standard' as package_name,
  'Standard Maintenance Package' as title,
  85000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 36000},
    {"service": "Deep Cleaning", "serviceType": "Cleaning", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 24000},
    {"service": "Water Tank", "serviceType": "Water Tank", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 12000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-104'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-104') AND status = 'approved');

-- PROP-105: Paradise Towers - 5 services, 3 vendors assigned
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Tower Premium' as package_name,
  'Tower Maintenance Package' as title,
  195000.00 as total_amount,
  'approved' as status,
  'partial' as payment_status,
  '[
    {"service": "Lift AMC", "serviceType": "Lift AMC", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 60000},
    {"service": "HVAC", "serviceType": "HVAC", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 48000},
    {"service": "Electrical", "serviceType": "Electrical", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 36000},
    {"service": "Plumbing", "serviceType": "Plumbing", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 16000},
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 12000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-105'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-105') AND status = 'approved');

-- PROP-106: Silver Oak Estate - 4 services, 1 vendor assigned
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Villa Basic' as package_name,
  'Basic Villa Maintenance' as title,
  120000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "Landscaping", "serviceType": "Landscaping", "frequencyType": "Weekly", "frequencyCount": 52, "visits": 52, "amount": 52000},
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 24000},
    {"service": "Plumbing", "serviceType": "Plumbing", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 16000},
    {"service": "Electrical", "serviceType": "Electrical", "frequencyType": "Half-Yearly", "frequencyCount": 2, "visits": 2, "amount": 10000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-106'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-106') AND status = 'approved');

-- PROP-107: Maple Gardens - 7 services, 5 vendors assigned (Gated Community)
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Community Comprehensive' as package_name,
  'Gated Community Full AMC' as title,
  450000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "HVAC", "serviceType": "HVAC", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 72000},
    {"service": "Plumbing", "serviceType": "Plumbing", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 60000},
    {"service": "Electrical", "serviceType": "Electrical", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 72000},
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 48000},
    {"service": "Deep Cleaning", "serviceType": "Cleaning", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 60000},
    {"service": "Landscaping", "serviceType": "Landscaping", "frequencyType": "Weekly", "frequencyCount": 52, "visits": 52, "amount": 78000},
    {"service": "Water Tank", "serviceType": "Water Tank", "frequencyType": "Monthly", "frequencyCount": 12, "visits": 12, "amount": 24000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-107'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-107') AND status = 'approved');

-- PROP-108: Crystal Bay - 3 services, no vendors assigned yet
INSERT INTO fp_estimates (estimate_id, property_id, package_name, title, total_amount, status, payment_status, service_rows, franchise_partner_id, created_by, created_at)
SELECT 
  CONCAT('EST-', LPAD(FLOOR(RAND() * 100000), 5, '0')) as estimate_id,
  id as property_id,
  'Apartment Starter' as package_name,
  'Starter Maintenance Package' as title,
  65000.00 as total_amount,
  'approved' as status,
  'paid' as payment_status,
  '[
    {"service": "Pest Control", "serviceType": "Pest Control", "frequencyType": "Quarterly", "frequencyCount": 4, "visits": 4, "amount": 16000},
    {"service": "Deep Cleaning", "serviceType": "Cleaning", "frequencyType": "Half-Yearly", "frequencyCount": 2, "visits": 2, "amount": 20000},
    {"service": "Water Tank", "serviceType": "Water Tank", "frequencyType": "Yearly", "frequencyCount": 1, "visits": 1, "amount": 5000}
  ]' as service_rows,
  franchise_partner_id,
  1 as created_by,
  NOW()
FROM onboarded_properties WHERE property_id = 'PROP-108'
AND NOT EXISTS (SELECT 1 FROM fp_estimates WHERE property_id = (SELECT id FROM onboarded_properties WHERE property_id = 'PROP-108') AND status = 'approved');

-- ============================================
-- STEP 5: Create Vendor Assignments
-- ============================================

-- PROP-101: All 5 services have vendors assigned
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'HVAC', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-101' AND ov.vendor_id = 'VND-001';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Plumbing', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-101' AND ov.vendor_id = 'VND-002';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Electrical', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-101' AND ov.vendor_id = 'VND-003';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Pest Control', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-101' AND ov.vendor_id = 'VND-004';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Water Tank', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-101' AND ov.vendor_id = 'VND-005';

-- PROP-102: 2 of 4 services have vendors
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Lift AMC', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-102' AND ov.vendor_id = 'VND-007';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Plumbing', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-102' AND ov.vendor_id = 'VND-002';

-- PROP-103: 4 of 6 services have vendors
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'HVAC', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-103' AND ov.vendor_id = 'VND-001';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Plumbing', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-103' AND ov.vendor_id = 'VND-002';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Electrical', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-103' AND ov.vendor_id = 'VND-003';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Pest Control', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-103' AND ov.vendor_id = 'VND-004';

-- PROP-104: All 3 services have vendors
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Pest Control', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-104' AND ov.vendor_id = 'VND-004';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Deep Cleaning', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-104' AND ov.vendor_id = 'VND-006';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Water Tank', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-104' AND ov.vendor_id = 'VND-005';

-- PROP-105: 3 of 5 services have vendors
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Lift AMC', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-105' AND ov.vendor_id = 'VND-007';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'HVAC', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-105' AND ov.vendor_id = 'VND-001';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Electrical', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-105' AND ov.vendor_id = 'VND-003';

-- PROP-106: 1 of 4 services has vendor
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Landscaping', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-106' AND ov.vendor_id = 'VND-008';

-- PROP-107: 5 of 7 services have vendors
INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'HVAC', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-107' AND ov.vendor_id = 'VND-001';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Plumbing', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-107' AND ov.vendor_id = 'VND-002';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Electrical', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-107' AND ov.vendor_id = 'VND-003';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Pest Control', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-107' AND ov.vendor_id = 'VND-004';

INSERT IGNORE INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
SELECT op.id, ov.id, 'Deep Cleaning', 1, NOW(), 1
FROM onboarded_properties op, onboarded_vendors ov
WHERE op.property_id = 'PROP-107' AND ov.vendor_id = 'VND-006';

-- PROP-108: No vendors assigned yet (0 of 3)
-- (No inserts needed)

-- ============================================
-- STEP 6: Update Pending Property Schedules
-- ============================================
INSERT INTO pending_property_schedules (property_id, estimate_id, total_services, vendors_assigned, services_scheduled, franchise_partner_id, scheduling_status, created_at)
SELECT 
  op.id as property_id,
  fe.id as estimate_id,
  JSON_LENGTH(fe.service_rows) as total_services,
  (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) as vendors_assigned,
  0 as services_scheduled,
  op.franchise_partner_id,
  'pending_schedule' as scheduling_status,
  NOW()
FROM onboarded_properties op
INNER JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
WHERE op.property_id IN ('PROP-101', 'PROP-102', 'PROP-103', 'PROP-104', 'PROP-105', 'PROP-106', 'PROP-107', 'PROP-108')
  AND op.id NOT IN (SELECT property_id FROM pending_property_schedules)
ON DUPLICATE KEY UPDATE
  total_services = VALUES(total_services),
  vendors_assigned = VALUES(vendors_assigned),
  scheduling_status = 'pending_schedule',
  updated_at = NOW();

-- ============================================
-- STEP 7: Show Summary
-- ============================================
SELECT '=== TEST DATA SUMMARY ===' as info;

SELECT 
  'Properties' as category,
  COUNT(*) as count
FROM onboarded_properties 
WHERE property_id LIKE 'PROP-1%';

SELECT 
  'Estimates (Approved & Paid)' as category,
  COUNT(*) as count
FROM fp_estimates 
WHERE status = 'approved' AND (payment_status = 'paid' OR payment_status = 'partial');

SELECT 
  'Vendor Assignments' as category,
  COUNT(*) as count
FROM property_vendor_assignments 
WHERE is_active = 1;

SELECT 
  'Pending Schedules' as category,
  COUNT(*) as count
FROM pending_property_schedules 
WHERE scheduling_status = 'pending_schedule';

SELECT '=== PROPERTIES READY FOR SCHEDULING ===' as info;

SELECT 
  op.property_id,
  op.community_name as property_name,
  fe.package_name,
  JSON_LENGTH(fe.service_rows) as total_services,
  (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) as vendors_assigned,
  CASE 
    WHEN (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) = JSON_LENGTH(fe.service_rows) 
    THEN 'Ready to Schedule'
    WHEN (SELECT COUNT(*) FROM property_vendor_assignments pva WHERE pva.property_id = op.id AND pva.is_active = 1) > 0 
    THEN 'Partial Vendors'
    ELSE 'No Vendors'
  END as status
FROM onboarded_properties op
INNER JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
WHERE op.property_id LIKE 'PROP-1%'
ORDER BY op.property_id;
