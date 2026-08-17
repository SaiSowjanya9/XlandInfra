-- Add created_by_user_id column to service_types table if it doesn't exist
ALTER TABLE service_types ADD COLUMN IF NOT EXISTS created_by_user_id INT DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_types_created_by_user_id ON service_types(created_by_user_id);
