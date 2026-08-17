# VPS Deployment Guide - XLand Infra

**Last Updated:** May 11, 2026  
**Status:** ✅ Successfully Deployed  
**VPS Provider:** Hostinger KVM 2  
**Server IP:** 72.60.204.124

Complete deployment guide for xlandinfra.com

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Hostinger VPS KVM 2 Server                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Nginx Web Server                             │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │   │
│  │  │  xlandinfra.com         │  │  admin.xlandinfra.com           │  │   │
│  │  │  (Main Website +        │  │  (Employee Portal +             │  │   │
│  │  │   Customer Portal)      │  │   Vendor & Customer Portals)    │  │   │
│  │  │                         │  │                                  │  │   │
│  │  │  /var/www/app/frontend  │  │  /var/www/app/admin              │  │   │
│  │  └──────────┬──────────────┘  └──────────┬────────────────────────┘  │   │
│  │             │                            │                            │   │
│  │             └────────────┬───────────────┘                            │   │
│  │                          │ /api/* proxy                               │   │
│  │                          ▼                                            │   │
│  │              ┌───────────────────────┐                                │   │
│  │              │  Backend API          │                                │   │
│  │              │  localhost:5000       │                                │   │
│  │              │  (PM2 managed)        │                                │   │
│  │              └───────────┬───────────┘                                │   │
│  └──────────────────────────│───────────────────────────────────────────┘   │
│                             │                                                │
│                             ▼                                                │
│              ┌───────────────────────────┐                                  │
│              │  MySQL Database           │                                  │
│              │  customer_portal          │                                  │
│              │  (Shared by both portals) │                                  │
│              └───────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Domain Structure

| Domain | Purpose | Serves |
|--------|---------|--------|
| **xlandinfra.com** | Main website + Customer login | `/var/www/app/frontend/dist` |
| **admin.xlandinfra.com** | Employee/Admin Portal (Property mgmt, AMC, Vendors, Work Orders) | `/var/www/app/admin/dist` |
| **Both** → `/api/*` | Shared Backend API | `localhost:5000` (PM2) |

## Folder Structure on VPS

```
/var/www/app/
├── frontend/           # Customer Portal (xlandinfra.com)
│   ├── dist/           # Production build
│   ├── src/
│   ├── package.json
│   └── .env.production
│
├── admin/              # Admin Portal (admin.xlandinfra.com)
│   ├── dist/           # Production build
│   ├── src/
│   ├── package.json
│   └── .env.production
│
├── backend/            # Shared API Server
│   ├── server.js
│   ├── routes/
│   ├── config/
│   ├── middleware/
│   ├── .env
│   ├── ecosystem.config.js
│   └── logs/
│
└── uploads/            # Shared uploads directory
```

---

## Part 0: Hostinger DNS Configuration (Do This First!)

Before deploying, configure DNS in Hostinger to point to your VPS.

### 0.1 Get Your VPS IP Address
Find your VPS IP in Hostinger hPanel → VPS → Overview

### 0.2 Configure DNS Records in Hostinger

1. Go to **Hostinger hPanel** → **Domains** → **xlandinfra.com** → **DNS / Nameservers**
2. Add/Update the following **A Records**:

| Type | Host | Points to | TTL |
|------|------|-----------|-----|
| A | @ | YOUR_VPS_IP | 14400 |
| A | www | YOUR_VPS_IP | 14400 |
| A | admin | YOUR_VPS_IP | 14400 |

**Example:** If your VPS IP is `192.168.1.100`:
- `@` → `192.168.1.100`
- `www` → `192.168.1.100`  
- `admin` → `192.168.1.100`

### 0.3 Wait for DNS Propagation
- DNS changes take 5-30 minutes (up to 48 hours globally)
- Check propagation: https://dnschecker.org

### 0.4 Verify DNS
```bash
# Run from your local machine or VPS
dig xlandinfra.com +short
dig www.xlandinfra.com +short
dig admin.xlandinfra.com +short
```
All should return your VPS IP.

---

## Part 1: Initial Server Setup

### 1.1 Connect to VPS
```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Update System
```bash
apt update && apt upgrade -y
```

### 1.3 Create Deploy User (Recommended)
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

---

## Part 2: Install Required Software

### 2.1 Install Node.js 20.x LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2.2 Install PM2 Globally
```bash
sudo npm install -g pm2
```

### 2.3 Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.4 Install MySQL Server
```bash
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql
```

### 2.5 Install Certbot for SSL
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2.6 Install Git (for deployments)
```bash
sudo apt install -y git
```

---

## Part 3: Create Folder Structure

### 3.1 Create Application Directories
```bash
sudo mkdir -p /var/www/app/backend
sudo mkdir -p /var/www/app/customer
sudo mkdir -p /var/www/app/admin
sudo mkdir -p /var/www/app/uploads

# Set ownership
sudo chown -R $USER:$USER /var/www/app
chmod -R 755 /var/www/app
```

---

## Part 4: Upload Project Files

### 4.1 Option A: Upload via SCP (from local machine)

**Run these commands from your LOCAL machine (PowerShell/Terminal):**

```bash
# Upload backend
scp -r ./backend/* deploy@YOUR_VPS_IP:/var/www/app/backend/

# Upload customer portal (source files)
scp -r ./frontend/* deploy@YOUR_VPS_IP:/var/www/app/customer/

# Upload admin portal (source files)
scp -r ./admin-portal/* deploy@YOUR_VPS_IP:/var/www/app/admin/
```

### 4.2 Option B: Clone from Git Repository
```bash
cd /var/www/app

# Clone repository
git clone https://github.com/SaiSowjanya9/XlandInfra.git temp-repo

# Move files to correct locations
cp -r temp-repo/backend/* /var/www/app/backend/
cp -r temp-repo/frontend/* /var/www/app/customer/
cp -r temp-repo/admin-portal/* /var/www/app/admin/

# Cleanup
rm -rf temp-repo
```

---

## Part 5: MySQL Database Setup

### 5.1 Secure MySQL Installation
```bash
sudo mysql_secure_installation
```
- Set root password: **Yes**
- Remove anonymous users: **Yes**
- Disallow root login remotely: **Yes**
- Remove test database: **Yes**
- Reload privilege tables: **Yes**

### 5.2 Create Database and User
```bash
sudo mysql -u root -p
```

**Run inside MySQL:**
```sql
-- Create database
CREATE DATABASE customer_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user
CREATE USER 'xlandinfra'@'localhost' IDENTIFIED BY 'YOUR_SECURE_DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON customer_portal.* TO 'xlandinfra'@'localhost';
FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES;
SELECT User, Host FROM mysql.user;

EXIT;
```

### 5.3 Import Database Schema
```bash
cd /var/www/app/backend
mysql -u xlandinfra -p customer_portal < database/schema_v3.sql
```

---

## Part 6: Backend Deployment

### 6.1 Navigate to Backend Directory
```bash
cd /var/www/app/backend
```

### 6.2 Install Dependencies
```bash
npm install --production
```

### 6.3 Create Environment File
```bash
cp .env.example .env
nano .env
```

**Edit `.env` with your values:**
```env
# Database Configuration
DB_HOST=localhost
DB_USER=xlandinfra
DB_PASSWORD=YOUR_SECURE_DB_PASSWORD
DB_NAME=customer_portal
DB_PORT=3306

# Server Configuration
PORT=5000
NODE_ENV=production

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/var/www/app/uploads

# JWT Configuration (generate a secure key!)
JWT_SECRET=your-very-long-secure-random-jwt-secret-key-minimum-32-chars
JWT_EXPIRES_IN=24h

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
NOTIFICATION_EMAIL=notifications@xlandinfra.com

# Frontend URL (for activation links)
FRONTEND_URL=https://xlandinfra.com

# Demo Mode (set to false in production!)
DEMO_MODE=false
DEMO_PASSWORD_HASH=
```

### 6.4 Generate JWT Secret (Run this to generate)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 6.5 Start Backend with PM2
```bash
pm2 start server.js --name backend
```

### 6.6 Verify Backend is Running
```bash
pm2 status
pm2 logs backend
curl http://localhost:5000/api/admin/dashboard/stats
```

### 6.7 Save PM2 Process List
```bash
pm2 save
```

### 6.8 Enable PM2 Startup on Reboot
```bash
pm2 startup systemd
# Copy and run the command it outputs (example below)
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
pm2 save
```

---

## Part 7: Customer Portal Deployment (xlandinfra.com)

### 7.1 Navigate to Frontend Directory
```bash
cd /var/www/app/frontend
```

### 7.2 Install Dependencies
```bash
npm install
```

### 7.3 Create Production Environment File
```bash
nano .env.production
```

**Add:**
```env
# Leave empty - API calls use /api/ which Nginx proxies to backend
VITE_API_URL=
VITE_APP_NAME=XLand Infra
```

### 7.4 Build for Production
```bash
npm run build
```

### 7.5 Verify Build
```bash
ls -la dist/
```

---

## Part 8: Admin Portal Deployment (admin.xlandinfra.com)

### 8.1 Navigate to Admin Directory
```bash
cd /var/www/app/admin
```

### 8.2 Install Dependencies
```bash
npm install
```

### 8.3 Create Production Environment File
```bash
nano .env.production
```

**Add:**
```env
# Leave empty - API calls use /api/ which Nginx proxies to backend
VITE_API_URL=
VITE_APP_NAME=XLand Infra Admin
```

### 8.4 Build for Production
```bash
npm run build
```

### 8.5 Verify Build
```bash
ls -la dist/
```

---

## Part 9: Nginx Configuration

### 9.1 Remove Default Site
```bash
sudo rm /etc/nginx/sites-enabled/default
```

### 9.2 Create Customer Portal Config (xlandinfra.com)
```bash
sudo nano /etc/nginx/sites-available/xlandinfra.com
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name xlandinfra.com www.xlandinfra.com;

    root /var/www/app/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # React SPA fallback - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (if needed from same domain)
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### 9.3 Create Admin Portal Config (admin.xlandinfra.com)
```bash
sudo nano /etc/nginx/sites-available/admin.xlandinfra.com
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name admin.xlandinfra.com;

    root /var/www/app/admin/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # React SPA fallback - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (if needed from same domain)
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
        proxy_connect_timeout 90s;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### 9.4 Enable All Sites
```bash
sudo ln -s /etc/nginx/sites-available/xlandinfra.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.xlandinfra.com /etc/nginx/sites-enabled/
```

> **Note:** We're NOT using a separate api.xlandinfra.com subdomain. Both portals proxy `/api/*` requests to the backend through Nginx. This is simpler and avoids CORS issues.

### 9.6 Test Nginx Configuration
```bash
sudo nginx -t
```

### 9.7 Reload Nginx
```bash
sudo systemctl reload nginx
```

---

## Part 10: DNS Configuration (Already Done in Part 0)

If you followed Part 0, DNS should already be configured in Hostinger.

### 10.1 Required DNS Records

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_VPS_IP | 14400 |
| A | www | YOUR_VPS_IP | 14400 |
| A | admin | YOUR_VPS_IP | 14400 |

### 10.2 Verify DNS
```bash
dig xlandinfra.com +short
dig www.xlandinfra.com +short
dig admin.xlandinfra.com +short
```
All should return your VPS IP address.

---

## Part 11: SSL Certificate Setup (Certbot)

### 11.1 Obtain SSL Certificates
```bash
sudo certbot --nginx -d xlandinfra.com -d www.xlandinfra.com -d admin.xlandinfra.com
```

- Enter email address
- Agree to terms
- Choose whether to share email with EFF
- Select redirect HTTP to HTTPS (recommended: **Yes**)

### 11.2 Verify Auto-Renewal
```bash
sudo certbot renew --dry-run
```

### 11.3 Check SSL Status
```bash
sudo certbot certificates
```

---

## Part 12: Firewall Configuration (UFW)

### 12.1 Setup UFW
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Part 13: Final Verification

### 13.1 Check All Services
```bash
# Check Nginx
sudo systemctl status nginx

# Check PM2
pm2 status
pm2 logs backend --lines 50

# Check MySQL
sudo systemctl status mysql

# Check Ports
sudo netstat -tlnp | grep -E '80|443|5000|3306'
```

### 13.2 Test Endpoints
```bash
# Test Customer Portal
curl -I https://xlandinfra.com

# Test Admin Portal
curl -I https://admin.xlandinfra.com

# Test API (via Customer Portal)
curl https://xlandinfra.com/api/health

# Test API (via Admin Portal)
curl https://admin.xlandinfra.com/api/health
```

### 13.3 Browser Testing
- https://xlandinfra.com - Customer Portal (Main Website + Customer Login)
- https://admin.xlandinfra.com - Admin Portal (Employee, Vendor, Property Management)

---

## Part 14: Maintenance Commands

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs backend

# Restart backend
pm2 restart backend

# Stop backend
pm2 stop backend

# Delete and recreate
pm2 delete backend
pm2 start server.js --name backend
pm2 save
```

### Nginx Commands
```bash
# Test configuration
sudo nginx -t

# Reload (apply config changes)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### MySQL Commands
```bash
# Connect to database
mysql -u xlandinfra -p customer_portal

# Backup database
mysqldump -u xlandinfra -p customer_portal > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u xlandinfra -p customer_portal < backup.sql
```

### Update Deployment
```bash
# Pull latest code
cd /var/www/app/backend
git pull origin main
npm install --production
pm2 restart backend

# Rebuild frontends
cd /var/www/app/customer
git pull origin main
npm install
npm run build

cd /var/www/app/admin
git pull origin main
npm install
npm run build

# Reload nginx
sudo systemctl reload nginx
```

---

## Part 15: Troubleshooting

### Backend Not Starting
```bash
cd /var/www/app/backend
node server.js  # Run directly to see errors
pm2 logs backend --err
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
pm2 status
curl http://localhost:5000/api/admin/dashboard/stats

# Check nginx error log
sudo tail -50 /var/log/nginx/error.log
```

### Database Connection Issues
```bash
# Test MySQL connection
mysql -u xlandinfra -p -e "SHOW DATABASES;"

# Check .env file
cat /var/www/app/backend/.env | grep DB_
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/app
chmod -R 755 /var/www/app

# Fix uploads folder
chmod 777 /var/www/app/uploads
```

---

## Quick Reference - File Locations

| Item | Path |
|------|------|
| Backend | `/var/www/app/backend/` |
| Customer Portal | `/var/www/app/frontend/dist/` |
| Admin Portal | `/var/www/app/admin/dist/` |
| Uploads | `/var/www/app/uploads/` |
| Backend .env | `/var/www/app/backend/.env` |
| Nginx configs | `/etc/nginx/sites-available/` |
| SSL certificates | `/etc/letsencrypt/live/xlandinfra.com/` |
| Nginx logs | `/var/log/nginx/` |
| PM2 logs | `~/.pm2/logs/` |

---

## Security & Route Protection

### Domain Separation
- **Customer users** can ONLY access `xlandinfra.com`
- **Admin/Employee users** can ONLY access `admin.xlandinfra.com`
- Both domains share the same backend API (accessed via `/api/` proxy)

### Authentication Flow
1. **Customer Portal** (`xlandinfra.com`):
   - Uses `/api/customers/*` routes
   - JWT tokens scoped to customer role
   - Cannot access admin routes (401 Unauthorized)

2. **Admin Portal** (`admin.xlandinfra.com`):
   - Uses `/api/admin/*`, `/api/staff/*` routes
   - JWT tokens include role (admin, manager, supervisor, executive)
   - Role-based access control (RBAC) enforced by backend

### Backend Route Protection (Already Implemented)
```javascript
// middleware/rbac.js - Role checks
adminOnly        // Only admin role
managerOrAdmin   // Admin or manager
supervisorOrAbove // Supervisor, manager, admin
dataEntryRoles   // All staff roles
```

### Preventing Cross-Portal Access
- Customer tokens cannot access admin routes (role check fails)
- Admin routes require authentication middleware
- Each portal stores tokens in localStorage (domain-isolated)

### CORS Configuration
Backend only accepts requests from:
- `https://xlandinfra.com`
- `https://www.xlandinfra.com`
- `https://admin.xlandinfra.com`

---

## Security Checklist

- [x] MySQL uses auth_socket for root (secure)
- [x] Created dedicated MySQL user `xlandinfra` with limited privileges
- [x] Set strong JWT_SECRET in .env
- [x] DEMO_MODE=false in production
- [ ] UFW firewall enabled (recommended)
- [x] SSL certificates installed for all domains
- [x] File permissions set correctly (755 for dirs)
- [x] .env file is not in git repository
- [x] Admin portal only accessible via admin.xlandinfra.com
- [x] Both portals share same backend API securely

---

## Quick Deploy Commands (Copy-Paste Ready)

After uploading files to VPS, run these commands:

```bash
# 1. Setup Backend
cd /var/www/app/backend
npm install --production
nano .env  # Create and edit with your credentials
mkdir -p logs
pm2 start server.js --name backend
pm2 save
pm2 startup

# 2. Build Frontend (Customer Portal)
cd /var/www/app/frontend
npm install
echo "VITE_API_URL=" > .env.production
npm run build

# 3. Build Admin Portal
cd /var/www/app/admin
npm install
echo "VITE_API_URL=" > .env.production
npm run build

# 4. Setup Nginx & SSL
nginx -t
systemctl reload nginx
certbot --nginx -d xlandinfra.com -d www.xlandinfra.com -d admin.xlandinfra.com

# 5. Verify
pm2 status
curl https://xlandinfra.com/api/health
curl https://admin.xlandinfra.com/api/health
```

---

## Live URLs

| Portal | URL | Description |
|--------|-----|-------------|
| **Customer Portal** | https://xlandinfra.com | Main website + Customer login |
| **Admin Portal** | https://admin.xlandinfra.com | Employee, Vendor & Property Management |
| **API Health** | https://xlandinfra.com/api/health | Backend health check |

---

## Server Credentials (Keep Secure!)

| Item | Value |
|------|-------|
| VPS IP | `72.60.204.124` |
| SSH User | `root` |
| MySQL User | `xlandinfra` |
| MySQL Database | `customer_portal` |
| Backend Port | `5000` |
| PM2 Process | `backend` |
| SSL Expiry | `2026-08-09` (auto-renews) |

---

**Deployment Complete! 🚀**

Your XLand Infra platform is now live:
- **Customers**: https://xlandinfra.com
- **Employees/Admin**: https://admin.xlandinfra.com
