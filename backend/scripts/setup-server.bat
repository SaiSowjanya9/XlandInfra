@echo off
echo ============================================
echo    XLAND INFRA - Database Server Setup
echo ============================================
echo.

:: Get the IP address of this PC
echo Your PC's IP Address(es):
ipconfig | findstr /i "IPv4"
echo.

echo ============================================
echo STEP 1: Run MySQL commands
echo ============================================
echo.
echo Open MySQL command line and run:
echo   mysql -u root -p
echo.
echo Then paste these commands:
echo   CREATE USER IF NOT EXISTS 'xland_user'@'%%' IDENTIFIED BY 'XlandSecure@2024';
echo   GRANT ALL PRIVILEGES ON customer_portal.* TO 'xland_user'@'%%';
echo   FLUSH PRIVILEGES;
echo.

echo ============================================
echo STEP 2: Edit MySQL Config
echo ============================================
echo.
echo Open: C:\ProgramData\MySQL\MySQL Server 8.0\my.ini
echo Find:  bind-address = 127.0.0.1
echo Change to: bind-address = 0.0.0.0
echo.

echo ============================================
echo STEP 3: Restart MySQL Service
echo ============================================
echo.
set /p restart="Do you want to restart MySQL service now? (y/n): "
if /i "%restart%"=="y" (
    echo Stopping MySQL...
    net stop mysql80
    echo Starting MySQL...
    net start mysql80
    echo MySQL restarted!
)
echo.

echo ============================================
echo STEP 4: Allow MySQL through Firewall
echo ============================================
echo.
set /p firewall="Do you want to add firewall rule for MySQL port 3306? (y/n): "
if /i "%firewall%"=="y" (
    netsh advfirewall firewall add rule name="MySQL" dir=in action=allow protocol=TCP localport=3306
    echo Firewall rule added!
)
echo.

echo ============================================
echo DONE! Share this info with other PCs:
echo ============================================
echo.
echo Database Host: [Your IPv4 Address from above]
echo Database User: xland_user
echo Database Password: XlandSecure@2024
echo Database Name: customer_portal
echo Database Port: 3306
echo.
pause
