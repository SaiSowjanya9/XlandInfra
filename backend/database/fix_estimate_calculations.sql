-- Fix existing estimate calculations
-- Formula: 
--   discount_amount = subtotal * (discount_percent / 100)
--   after_discount = subtotal - discount_amount
--   gst_amount = after_discount * (gst_percent / 100)
--   total_amount = after_discount + gst_amount

-- Update estimates with correct calculations
UPDATE estimates 
SET 
    discount_amount = ROUND(subtotal * (discount_percent / 100), 2),
    gst_amount = ROUND((subtotal - ROUND(subtotal * (discount_percent / 100), 2)) * (gst_percent / 100), 2),
    total_amount = ROUND(
        (subtotal - ROUND(subtotal * (discount_percent / 100), 2)) + 
        ROUND((subtotal - ROUND(subtotal * (discount_percent / 100), 2)) * (gst_percent / 100), 2), 
        2
    )
WHERE subtotal > 0;

-- Verify the update
SELECT 
    id,
    estimate_id,
    subtotal,
    discount_percent,
    discount_amount,
    gst_percent,
    gst_amount,
    total_amount,
    -- Expected values for verification
    ROUND(subtotal * (discount_percent / 100), 2) as expected_discount,
    ROUND((subtotal - ROUND(subtotal * (discount_percent / 100), 2)) * (gst_percent / 100), 2) as expected_gst,
    ROUND(
        (subtotal - ROUND(subtotal * (discount_percent / 100), 2)) + 
        ROUND((subtotal - ROUND(subtotal * (discount_percent / 100), 2)) * (gst_percent / 100), 2), 
        2
    ) as expected_total
FROM estimates 
WHERE subtotal > 0
LIMIT 10;
