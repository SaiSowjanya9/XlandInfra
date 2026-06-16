-- Fix existing estimate calculations in fp_estimates table
-- Formula: 
--   discount_amount = subtotal * (discount_percent / 100)
--   after_discount = subtotal - discount_amount
--   gst_amount = after_discount * (gst_percent / 100)
--   total_amount = after_discount + gst_amount

-- Update fp_estimates with correct calculations
UPDATE fp_estimates 
SET 
    discount_amount = ROUND(subtotal * (discount_percent / 100), 2),
    gst_amount = ROUND((subtotal - ROUND(subtotal * (discount_percent / 100), 2)) * (gst_percent / 100), 2),
    total_amount = ROUND(
        (subtotal - ROUND(subtotal * (discount_percent / 100), 2)) + 
        ROUND((subtotal - ROUND(subtotal * (discount_percent / 100), 2)) * (gst_percent / 100), 2), 
        2
    )
WHERE subtotal > 0;
