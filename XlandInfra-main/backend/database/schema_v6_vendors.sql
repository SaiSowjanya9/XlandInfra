-- Schema V6: Onboarding Vendors
-- Adds onboarded_vendors table for the full vendor onboarding form data
-- Schema v6: Onboarded Vendors Tables
-- Run this for vendor management functionality

USE customer_portal;

-- Drop existing tables if they exist (for fresh schema)
DROP TABLE IF EXISTS vendor_contacts;
DROP TABLE IF EXISTS onboarded_vendors;

-- ============================================
-- Main vendors table (new vendor-specific schema)
-- ============================================
CREATE TABLE IF NOT EXISTS onboarded_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id VARCHAR(50) NOT NULL UNIQUE,  -- VND-XXXX-YYYYMMDD format
  
  -- Service Information
  service_type VARCHAR(100) NOT NULL,
  service_verified TINYINT(1) DEFAULT 0,
  
  -- Location & Division
  zone VARCHAR(100),
  area_name VARCHAR(255),
  division VARCHAR(100),
  
  -- Owner Details
  owner_name VARCHAR(255) NOT NULL,
  owner_mobile VARCHAR(20),
  owner_email VARCHAR(255),
  owner_aadhar VARCHAR(20),
  owner_country_code VARCHAR(10) DEFAULT '+91',
  
  -- Manager Contact
  manager_name VARCHAR(255),
  manager_mobile VARCHAR(20),
  manager_email VARCHAR(255),
  manager_country_code VARCHAR(10) DEFAULT '+91',
  
  -- Point of Contact
  poc_name VARCHAR(255),
  poc_mobile VARCHAR(20),
  poc_email VARCHAR(255),
  poc_country_code VARCHAR(10) DEFAULT '+91',
  
  -- Rate & Coverage
  rate_per_visit DECIMAL(10, 2) DEFAULT 0,
  coverage_per_day INT DEFAULT 0,
  
  -- Metadata
  created_by VARCHAR(100) DEFAULT 'Manager',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_service_type (service_type),
  INDEX idx_zone (zone),
  INDEX idx_division (division),
  INDEX idx_status (status)
);

-- ============================================
-- VENDOR CONTACTS TABLE
-- Contacts attached to onboarded vendors
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  country_code VARCHAR(10) DEFAULT '+91',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES onboarded_vendors(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_vendor_contacts_vendor ON vendor_contacts(vendor_id);
