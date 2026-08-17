-- FP Portal Links Schema V16
-- Allows Franchise Partners to share up to 2 custom portal links with their assigned employees
-- Links can be any valid URL (Google Drive, Sheets, Docs, Forms, or external URLs)

-- ============================================
-- FP PORTAL LINKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fp_portal_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  franchise_partner_id INT NOT NULL,
  link_slot INT NOT NULL DEFAULT 1, -- 1 or 2 (max 2 slots per FP)
  heading VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
  UNIQUE KEY unique_fp_link_slot (franchise_partner_id, link_slot),
  INDEX idx_fp_portal_links_fp (franchise_partner_id),
  INDEX idx_fp_portal_links_active (franchise_partner_id, is_active)
);

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- Future scalability: To add more link blocks, simply increase the allowed link_slot values
-- The current design allows for easy expansion without schema changes
-- Just update the application validation logic to allow higher slot numbers
