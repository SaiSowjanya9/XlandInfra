-- FP-specific categories table
CREATE TABLE IF NOT EXISTS fp_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  franchise_partner_id INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fp_categories_fp_id (franchise_partner_id)
);

-- FP-specific subcategories table  
CREATE TABLE IF NOT EXISTS fp_subcategories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  franchise_partner_id INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fp_subcategories_category (category_id),
  INDEX idx_fp_subcategories_fp_id (franchise_partner_id)
);

-- Admin-level categories table (global)
CREATE TABLE IF NOT EXISTS admin_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin-level subcategories table
CREATE TABLE IF NOT EXISTS admin_subcategories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_subcategories_category (category_id)
);
