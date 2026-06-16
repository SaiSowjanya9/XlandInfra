-- ============================================
-- Cleanup Script: Remove Fake QR Scan Data
-- ============================================
-- This removes all scan data that was incorrectly tracked
-- from direct website visits (not actual QR scans from printed copies)
-- 
-- After running this, only real QR scans (via qr.xlandinfra.com redirect)
-- will be tracked going forward.
-- ============================================

-- Step 1: Clear all scan records
DELETE FROM qr_scans;

-- Step 2: Clear daily analytics
DELETE FROM qr_analytics_daily;

-- Step 3: Clear hourly analytics
DELETE FROM qr_analytics_hourly;

-- Step 4: Clear active sessions
DELETE FROM qr_active_sessions;

-- Step 5: Clear geographic analytics (if table exists)
DELETE FROM qr_geo_analytics;

-- Step 6: Clear rate limits (optional - resets rate limiting)
DELETE FROM qr_rate_limits;

-- Step 7: Reset auto-increment counters (optional)
ALTER TABLE qr_scans AUTO_INCREMENT = 1;
ALTER TABLE qr_analytics_daily AUTO_INCREMENT = 1;
ALTER TABLE qr_analytics_hourly AUTO_INCREMENT = 1;
ALTER TABLE qr_active_sessions AUTO_INCREMENT = 1;

-- Verify cleanup
SELECT 'qr_scans' AS table_name, COUNT(*) AS records FROM qr_scans
UNION ALL
SELECT 'qr_analytics_daily', COUNT(*) FROM qr_analytics_daily
UNION ALL
SELECT 'qr_analytics_hourly', COUNT(*) FROM qr_analytics_hourly
UNION ALL
SELECT 'qr_active_sessions', COUNT(*) FROM qr_active_sessions;

-- ============================================
-- Done! QR analytics have been reset.
-- Only real scans from printed QR codes will be tracked now.
-- ============================================
