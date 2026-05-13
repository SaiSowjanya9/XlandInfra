-- Seed Users for Employee Portal
-- Run this after schema_v3.sql to create default users
-- Password for all users: Password@123

USE customer_portal;

-- Add 'franchise' role to the ENUM if not present
ALTER TABLE users 
MODIFY COLUMN role ENUM('admin', 'manager', 'supervisor', 'executive', 'franchise') NOT NULL DEFAULT 'executive';

-- Clear existing demo users (optional - comment out if you want to keep existing users)
-- DELETE FROM users WHERE username IN ('admin', 'opsmanager', 'franchise');

-- Insert default users
-- Password: Password@123 (bcrypt hash)
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active) VALUES
('admin', 'admin@pmportal.com', '$2a$10$8K1p/a0dL1LXMIgZ5BQqQOqIqVD8pYFkxqVhqJ5gK8NQVXZ5qV5Vy', 'System', 'Admin', '+91 9999999901', 'admin', TRUE),
('opsmanager', 'manager@pmportal.com', '$2a$10$8K1p/a0dL1LXMIgZ5BQqQOqIqVD8pYFkxqVhqJ5gK8NQVXZ5qV5Vy', 'Operations', 'Manager', '+91 9999999902', 'manager', TRUE),
('franchise', 'franchise@pmportal.com', '$2a$10$8K1p/a0dL1LXMIgZ5BQqQOqIqVD8pYFkxqVhqJ5gK8NQVXZ5qV5Vy', 'Franchise', 'Partner', '+91 9999999903', 'franchise', TRUE)
ON DUPLICATE KEY UPDATE 
  password_hash = VALUES(password_hash),
  is_active = TRUE;

-- Verify inserted users
SELECT id, username, email, first_name, last_name, role, is_active FROM users;
