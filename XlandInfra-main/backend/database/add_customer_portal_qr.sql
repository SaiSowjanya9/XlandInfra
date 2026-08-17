-- Add Customer Portal QR code for tracking
-- Run this on production database

INSERT INTO qr_codes (qr_id, slug, label, description, current_url, original_url, qr_type, foreground_color, background_color, error_correction, style_preset)
VALUES 
    ('XLAND-CUSTOMER-001', 'customer', 'Customer Portal', 'Customer portal QR code for work order requests - used on printed materials', 'https://customer.xlandinfra.com', 'https://customer.xlandinfra.com', 'website', '#1a1a1a', '#FFFFFF', 'H', 'luxury')
ON DUPLICATE KEY UPDATE 
    label = VALUES(label),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- Verify both QR codes exist
SELECT id, qr_id, slug, label, current_url FROM qr_codes WHERE slug IN ('main', 'customer');
