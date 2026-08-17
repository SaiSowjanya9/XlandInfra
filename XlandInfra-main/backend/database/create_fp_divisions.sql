-- Create fp_divisions table for FP-specific divisions
CREATE TABLE IF NOT EXISTS fp_divisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  franchise_partner_id INT,
  created_by VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fp_id (franchise_partner_id),
  INDEX idx_name (name),
  UNIQUE KEY unique_fp_division (name, franchise_partner_id)
);
