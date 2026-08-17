-- Invoice Auto-Generation Schema Updates
-- Version 19: Add invoice_type and source tracking for auto-generated invoices

-- Add invoice_type column to distinguish invoice sources
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_type ENUM('estimate', 'work_order', 'amc', 'manual') DEFAULT 'manual' AFTER invoice_id;

-- Add source estimate/work order ID tracking
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS source_estimate_id VARCHAR(50) AFTER estimate_id;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS source_work_order_id VARCHAR(50) AFTER work_order_id;

-- Add auto_generated flag
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE AFTER source_work_order_id;

-- Add email_sent_at tracking
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS email_sent_at DATETIME AFTER sent_at;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_source_estimate_id ON invoices(source_estimate_id);
CREATE INDEX IF NOT EXISTS idx_source_work_order_id ON invoices(source_work_order_id);
CREATE INDEX IF NOT EXISTS idx_auto_generated ON invoices(auto_generated);

-- Update existing invoices to have invoice_type based on existing data
UPDATE invoices 
SET invoice_type = 'estimate' 
WHERE estimate_id IS NOT NULL AND invoice_type = 'manual';

UPDATE invoices 
SET invoice_type = 'work_order' 
WHERE work_order_id IS NOT NULL AND estimate_id IS NULL AND invoice_type = 'manual';
