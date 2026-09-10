-- Migration: Sync fp_estimates.payment_status with actual paid payments
-- This fixes existing records where payment was verified but fp_estimates was not updated
-- Date: 2026-09-10

-- Update fp_estimates.payment_status to 'paid' for properties that have fully paid invoices
UPDATE fp_estimates fe
SET 
  fe.payment_status = 'paid',
  fe.updated_at = NOW()
WHERE fe.status = 'approved'
  AND fe.payment_status IS NULL OR fe.payment_status NOT IN ('paid', 'partial')
  AND EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.property_id = fe.property_id 
    AND i.payment_status = 'paid'
  );

-- Update fp_estimates.payment_status to 'partial' for properties with partially paid invoices
UPDATE fp_estimates fe
SET 
  fe.payment_status = 'partial',
  fe.updated_at = NOW()
WHERE fe.status = 'approved'
  AND (fe.payment_status IS NULL OR fe.payment_status NOT IN ('paid', 'partial'))
  AND EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.property_id = fe.property_id 
    AND i.payment_status = 'partially_paid'
  );

-- Also sync based on payments table for cases where invoice status wasn't updated
UPDATE fp_estimates fe
SET 
  fe.payment_status = 'paid',
  fe.updated_at = NOW()
WHERE fe.status = 'approved'
  AND (fe.payment_status IS NULL OR fe.payment_status NOT IN ('paid', 'partial'))
  AND EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.property_id = fe.property_id 
    AND p.status = 'paid'
  );

-- Log affected rows
SELECT 
  fe.id,
  fe.estimate_id,
  fe.property_id,
  op.property_id as property_code,
  fe.status,
  fe.payment_status,
  i.invoice_id,
  i.payment_status as invoice_payment_status
FROM fp_estimates fe
LEFT JOIN onboarded_properties op ON op.id = fe.property_id
LEFT JOIN invoices i ON i.property_id = fe.property_id
WHERE fe.status = 'approved'
  AND fe.payment_status IN ('paid', 'partial');
