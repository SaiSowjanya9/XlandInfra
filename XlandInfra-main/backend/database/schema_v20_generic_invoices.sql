-- Generic Invoice Schema Updates
-- Version 20: Add support for generic invoices (walk-in customers, ad-hoc services)

-- Modify invoice_type to include 'generic' option
ALTER TABLE invoices 
MODIFY COLUMN invoice_type ENUM('estimate', 'work_order', 'amc', 'manual', 'generic') DEFAULT 'manual';

-- Add customer_address column for generic invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS customer_address VARCHAR(500) AFTER customer_phone;

-- Add index for filtering generic invoices
CREATE INDEX IF NOT EXISTS idx_invoice_type_generic ON invoices(invoice_type);
