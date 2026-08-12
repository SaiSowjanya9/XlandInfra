-- Migration: Update existing work order estimates with property details from work orders
-- This fills in missing property_name, property_code, property_type, zone for work order estimates

-- Update property details from work_orders -> onboarded_properties
UPDATE fp_estimates fe
JOIN work_orders wo ON fe.work_order_id = wo.work_order_id
LEFT JOIN onboarded_properties op ON wo.property_id = op.id
SET 
    fe.property_name = COALESCE(fe.property_name, op.community_name, wo.property_name),
    fe.property_code = COALESCE(fe.property_code, op.property_id),
    fe.property_type = COALESCE(fe.property_type, op.property_type),
    fe.zone = COALESCE(fe.zone, op.zone)
WHERE fe.estimate_type = 'work_order' 
  AND fe.work_order_id IS NOT NULL
  AND (fe.property_name IS NULL OR fe.property_name = '' OR fe.property_name = '-');

-- Also update from regular properties table as fallback
UPDATE fp_estimates fe
JOIN work_orders wo ON fe.work_order_id = wo.work_order_id
LEFT JOIN properties p ON wo.property_id = p.id
SET 
    fe.property_name = COALESCE(fe.property_name, p.name, wo.property_name),
    fe.property_code = COALESCE(fe.property_code, p.property_id),
    fe.property_type = COALESCE(fe.property_type, p.property_type)
WHERE fe.estimate_type = 'work_order' 
  AND fe.work_order_id IS NOT NULL
  AND (fe.property_name IS NULL OR fe.property_name = '' OR fe.property_name = '-');

-- Show updated records
SELECT fe.estimate_id, fe.work_order_id, fe.property_name, fe.property_code, fe.property_type, fe.zone
FROM fp_estimates fe
WHERE fe.estimate_type = 'work_order';
