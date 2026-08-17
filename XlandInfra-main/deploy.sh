
#!/bin/bash

# XLand Infra Deployment Script
# Run this script on your VPS after uploading files

set -e  # Exit on error

echo "=========================================="
echo "  XLand Infra Deployment Script"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/app"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
ADMIN_DIR="$APP_DIR/admin"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider using a deploy user."
fi

# Step 1: Backend Deployment
echo ""
echo "Step 1: Deploying Backend..."
echo "-------------------------------------------"

cd $BACKEND_DIR

# Create logs directory
mkdir -p logs

# Install dependencies
print_status "Installing backend dependencies..."
npm install --production

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    print_error "Please edit $BACKEND_DIR/.env with your configuration!"
    echo "Run: nano $BACKEND_DIR/.env"
fi

# Create uploads directory
mkdir -p $APP_DIR/uploads
chmod 755 $APP_DIR/uploads

# Stop existing PM2 process if running
pm2 delete backend 2>/dev/null || true

# Start with PM2
print_status "Starting backend with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

print_status "Backend deployed successfully!"

# Step 2: Frontend Deployment (xlandinfra.com)
echo ""
echo "Step 2: Deploying Frontend (Customer Portal)..."
echo "-------------------------------------------"

cd $FRONTEND_DIR

print_status "Installing frontend dependencies..."
npm install

# Create production env file
echo "VITE_API_URL=" > .env.production
echo "VITE_APP_NAME=XLand Infra" >> .env.production

print_status "Building frontend for production..."
npm run build

print_status "Frontend deployed successfully!"

# Step 3: Admin Portal Deployment (admin.xlandinfra.com)
echo ""
echo "Step 3: Deploying Admin Portal..."
echo "-------------------------------------------"

cd $ADMIN_DIR

print_status "Installing admin portal dependencies..."
npm install

# Create production env file
echo "VITE_API_URL=" > .env.production
echo "VITE_APP_NAME=XLand Infra Admin" >> .env.production

print_status "Building admin portal for production..."
npm run build

print_status "Admin portal deployed successfully!"

# Step 4: Nginx Reload
echo ""
echo "Step 4: Reloading Nginx..."
echo "-------------------------------------------"

sudo nginx -t && sudo systemctl reload nginx
print_status "Nginx reloaded successfully!"

# Step 5: Verification
echo ""
echo "Step 5: Verification..."
echo "-------------------------------------------"

# Check PM2 status
pm2 status

# Test backend health
echo ""
echo "Testing backend health endpoint..."
curl -s http://localhost:5000/api/health | head -c 200
echo ""

# Final summary
echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "URLs:"
echo "  - Customer Portal: https://xlandinfra.com"
echo "  - Admin Portal:    https://admin.xlandinfra.com"
echo ""
echo "Commands:"
echo "  - View logs:    pm2 logs backend"
echo "  - Restart:      pm2 restart backend"
echo "  - Status:       pm2 status"
echo ""

# Reminder
print_warning "Don't forget to:"
echo "  1. Configure .env file: nano /var/www/app/backend/.env"
echo "  2. Run SSL setup: sudo certbot --nginx -d xlandinfra.com -d www.xlandinfra.com -d admin.xlandinfra.com"
echo "  3. Import database schema: mysql -u xlandinfra -p customer_portal < /var/www/app/backend/database/schema_v3.sql"
echo ""
