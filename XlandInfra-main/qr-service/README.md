# XLAND INFRA QR Redirect Service

Production-ready QR redirect service for `qr.xlandinfra.com`

## 🎯 Overview

This standalone service handles dynamic QR code redirects:
- `https://qr.xlandinfra.com/main` → `https://www.xlandinfra.com`
- `https://qr.xlandinfra.com/admin` → `https://admin.xlandinfra.com`

## 🚀 Quick Start (Development)

```bash
cd qr-service
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

Test locally:
- http://localhost:3500/health
- http://localhost:3500/main (redirects to xlandinfra.com)

---

## 📋 Production Deployment

### Step 1: DNS Configuration

Add these DNS records in your domain registrar (GoDaddy, Cloudflare, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | qr | YOUR_SERVER_IP | 300 |
| AAAA | qr | YOUR_SERVER_IPV6 | 300 (optional) |

**Example for different providers:**

#### Cloudflare
1. Go to DNS settings
2. Add record:
   - Type: `A`
   - Name: `qr`
   - IPv4 address: `YOUR_SERVER_IP`
   - Proxy status: DNS only (gray cloud) - important for direct connections

#### GoDaddy
1. Go to DNS Management
2. Add record:
   - Type: `A`
   - Name: `qr`
   - Value: `YOUR_SERVER_IP`
   - TTL: 1 Hour

#### AWS Route 53
1. Create record:
   - Record name: `qr`
   - Record type: `A`
   - Value: `YOUR_SERVER_IP`

### Step 2: Server Setup

SSH into your server and run:

```bash
# Clone or copy the qr-service folder
cd /var/www/xland-qr-service

# Run deployment script
chmod +x deploy.sh
./deploy.sh

# Edit environment variables
nano .env
```

### Step 3: SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d qr.xlandinfra.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

### Step 4: Nginx Configuration

```bash
# Copy nginx config
sudo cp nginx/qr.xlandinfra.com.conf /etc/nginx/sites-available/

# Enable site
sudo ln -s /etc/nginx/sites-available/qr.xlandinfra.com.conf /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 5: Verify Deployment

```bash
# Check service status
pm2 status

# Check nginx
curl -I https://qr.xlandinfra.com/health

# Test redirect
curl -I https://qr.xlandinfra.com/main
# Should return: HTTP/2 302 with Location: https://www.xlandinfra.com
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `QR_SERVICE_PORT` | Server port | 3500 |
| `DB_HOST` | MySQL host | localhost |
| `DB_USER` | MySQL user | root |
| `DB_PASSWORD` | MySQL password | - |
| `DB_NAME` | Database name | customer_portal |
| `DB_PORT` | MySQL port | 3306 |
| `IP_SALT` | Salt for IP hashing | - |

### PM2 Commands

```bash
pm2 start ecosystem.config.js --env production  # Start
pm2 restart xland-qr-service                    # Restart
pm2 stop xland-qr-service                       # Stop
pm2 logs xland-qr-service                       # View logs
pm2 monit                                        # Monitor
```

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:slug` | GET | Redirect to target URL |
| `/health` | GET | Health check |

### Response Codes

| Code | Description |
|------|-------------|
| 302 | Successful redirect |
| 404 | QR code not found |
| 410 | QR code disabled |
| 429 | Rate limited |
| 500 | Server error |

---

## 🔒 Security Features

- **Rate Limiting**: 60 requests/minute per IP
- **Bot Detection**: Filters automated requests from analytics
- **IP Hashing**: Privacy-preserving analytics
- **HTTPS Only**: All redirects use secure connections
- **Input Validation**: Sanitized slug parameters

---

## 📁 File Structure

```
qr-service/
├── server.js           # Main application
├── package.json        # Dependencies
├── ecosystem.config.js # PM2 configuration
├── .env.example        # Environment template
├── deploy.sh           # Deployment script
├── README.md           # This file
├── nginx/
│   └── qr.xlandinfra.com.conf  # Nginx config
└── logs/               # Application logs
```

---

## 🔄 Adding New QR Codes

QR codes are managed through the Admin Portal:
1. Go to Admin Portal → QR Management
2. Click "Create New QR Code"
3. Enter slug, label, and target URL
4. The new QR will be available at `qr.xlandinfra.com/{slug}`

Or directly in database:
```sql
INSERT INTO qr_codes (qr_id, slug, label, current_url, original_url, qr_type)
VALUES ('XLAND-NEW-001', 'newpage', 'New Page', 'https://www.xlandinfra.com/newpage', 'https://www.xlandinfra.com/newpage', 'custom');
```

---

## 🛠 Troubleshooting

### Service not starting
```bash
# Check logs
pm2 logs xland-qr-service --lines 50

# Check if port is in use
sudo lsof -i :3500
```

### Database connection failed
```bash
# Test MySQL connection
mysql -h localhost -u root -p customer_portal -e "SELECT 1"

# Check .env credentials
cat .env | grep DB_
```

### Nginx 502 Bad Gateway
```bash
# Check if service is running
pm2 status

# Check nginx error logs
sudo tail -f /var/log/nginx/qr.xlandinfra.com.error.log
```

### DNS not resolving
```bash
# Check DNS propagation
dig qr.xlandinfra.com
nslookup qr.xlandinfra.com

# Wait for propagation (up to 48 hours, usually minutes)
```

---

## 📞 Support

For issues, contact the XLAND INFRA development team.
