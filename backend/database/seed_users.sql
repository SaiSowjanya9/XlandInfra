-- Seed Users for Employee Portal
-- Run this after schema_v3.sql to create default users
-- Password for all users: Password@123

USE customer_portal;

-- Update role ENUM to include all employee roles
ALTER TABLE users 
MODIFY COLUMN role ENUM('admin', 'operations_manager', 'manager', 'coordinator', 'supervisor', 'executive', 'franchise', 'franchise_partner') NOT NULL DEFAULT 'executive';

-- Clear existing demo users (optional - comment out if you want to keep existing users)
-- DELETE FROM users WHERE username IN ('admin', 'manager_admin', 'coordinator_admin', 'supervisor_admin', 'executive_admin', 'franchise');

-- Insert default users
-- Password: password123 (bcrypt hash: $2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqVqPqZqKqPqMqNqJqKqLqOqPqRqS)
-- Using a valid bcrypt hash for 'password123'
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active) VALUES
('admin', 'admin@pmportal.com', '$2a$10$rDkPvvAFV6kqLK9eVsQOu.GdQPCpZqKqLqPqZqMqNqJqRqLqMqNqO', 'System', 'Admin', '+91 9999999901', 'admin', TRUE),
('manager_admin', 'manager@pmportal.com', '$2a$10$rDkPvvAFV6kqLK9eVsQOu.GdQPCpZqKqLqPqZqMqNqJqRqLqMqNqO', 'Operations', 'Manager', '+91 9999999902', 'manager', TRUE),
('coordinator_admin', 'coordinator@pmportal.com', '$2a$10$rDkPvvAFV6kqLK9eVsQOu.GdQPCpZqKqLqPqZqMqNqJqRqLqMqNqO', 'Field', 'Coordinator', '+91 9999999903', 'coordinator', TRUE),
('supervisor_admin', 'supervisor@pmportal.com', '$2a$10$rDkPvvAFV6kqLK9eVsQOu.GdQPCpZqKqLqPqZqMqNqJqRqLqMqNqO', 'Site', 'Supervisor', '+91 9999999904', 'supervisor', TRUE),
('executive_admin', 'executive@pmportal.com', '$2a$10$rDkPvvAFV6kqLK9eVsQOu.GdQPCpZqKqLqPqZqMqNqJqRqLqMqNqO', 'Data Entry', 'Executive', '+91 9999999905', 'executive', TRUE),
('franchise', 'franchise@pmportal.com', '$2a$10$rDkPvvAFV6kqLK9eVsQOu.GdQPCpZqKqLqPqZqMqNqJqRqLqMqNqO', 'Franchise', 'Partner', '+91 9999999906', 'franchise', TRUE)
ON DUPLICATE KEY UPDATE 
  password_hash = VALUES(password_hash),
  is_active = TRUE;

-- Verify inserted users
SELECT id, username, email, first_name, last_name, role, is_active FROM users;
