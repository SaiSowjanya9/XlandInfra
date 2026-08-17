-- Migration: Create ID Sequences Table
-- Purpose: Track the highest ever assigned user ID for each prefix to prevent ID reuse after deletions
-- Date: 2025-06-08

CREATE TABLE IF NOT EXISTS id_sequences (
    prefix VARCHAR(10) PRIMARY KEY,
    last_sequence INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize with current max values from existing users
-- This ensures existing IDs are not reused

-- For XFP (Franchise Partners)
INSERT INTO id_sequences (prefix, last_sequence)
SELECT 'XFP', COALESCE(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0)
FROM users WHERE user_id LIKE 'XFP%'
ON DUPLICATE KEY UPDATE last_sequence = GREATEST(last_sequence, VALUES(last_sequence));

-- For XAD (Admins)
INSERT INTO id_sequences (prefix, last_sequence)
SELECT 'XAD', COALESCE(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0)
FROM users WHERE user_id LIKE 'XAD%'
ON DUPLICATE KEY UPDATE last_sequence = GREATEST(last_sequence, VALUES(last_sequence));

-- For XOM (Operations Managers)
INSERT INTO id_sequences (prefix, last_sequence)
SELECT 'XOM', COALESCE(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0)
FROM users WHERE user_id LIKE 'XOM%'
ON DUPLICATE KEY UPDATE last_sequence = GREATEST(last_sequence, VALUES(last_sequence));

-- For XUS (Generic Users)
INSERT INTO id_sequences (prefix, last_sequence)
SELECT 'XUS', COALESCE(MAX(CAST(SUBSTRING(user_id, 4) AS UNSIGNED)), 0)
FROM users WHERE user_id LIKE 'XUS%'
ON DUPLICATE KEY UPDATE last_sequence = GREATEST(last_sequence, VALUES(last_sequence));

-- For Employee numeric IDs (no prefix)
INSERT INTO id_sequences (prefix, last_sequence)
SELECT 'EMP', COALESCE(MAX(CAST(user_id AS UNSIGNED)), 0)
FROM users WHERE role IN ('manager', 'coordinator', 'supervisor', 'executive') AND user_id REGEXP '^[0-9]+$'
ON DUPLICATE KEY UPDATE last_sequence = GREATEST(last_sequence, VALUES(last_sequence));
