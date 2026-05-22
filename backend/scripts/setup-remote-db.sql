-- ============================================
-- RUN THIS ON THE SERVER PC (Main Database PC)
-- ============================================

-- 1. Create a user that can connect from any IP
CREATE USER IF NOT EXISTS 'xland_user'@'%' IDENTIFIED BY 'XlandSecure@2024';

-- 2. Grant all privileges on customer_portal database
GRANT ALL PRIVILEGES ON customer_portal.* TO 'xland_user'@'%';

-- 3. Apply changes
FLUSH PRIVILEGES;

-- 4. Verify the user was created
SELECT user, host FROM mysql.user WHERE user = 'xland_user';

-- ============================================
-- IMPORTANT: You also need to edit MySQL config
-- ============================================
-- 
-- Windows: C:\ProgramData\MySQL\MySQL Server 8.0\my.ini
-- 
-- Find and change:
--   bind-address = 127.0.0.1
-- To:
--   bind-address = 0.0.0.0
--
-- Then restart MySQL service:
--   net stop mysql80
--   net start mysql80
--
