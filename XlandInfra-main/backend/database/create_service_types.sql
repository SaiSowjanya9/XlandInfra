-- Create service_types table for storing vendor service types
CREATE TABLE IF NOT EXISTS service_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  franchise_partner_id INT NULL,
  is_global BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  INDEX idx_service_types_fp (franchise_partner_id),
  INDEX idx_service_types_global (is_global)
);

-- Insert default service types (global)
INSERT IGNORE INTO service_types (name, is_global, created_by) VALUES
('Plumbing', TRUE, 'System'),
('Electrical', TRUE, 'System'),
('HVAC', TRUE, 'System'),
('Cleaning', TRUE, 'System'),
('Security', TRUE, 'System'),
('Carpentry', TRUE, 'System'),
('Painting', TRUE, 'System'),
('Pest Control', TRUE, 'System'),
('Landscaping', TRUE, 'System'),
('General Maintenance', TRUE, 'System');
