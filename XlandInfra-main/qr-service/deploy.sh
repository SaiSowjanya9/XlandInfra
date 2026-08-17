#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# XLAND INFRA QR Service Deployment Script
# Production deployment for qr.xlandinfra.com
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "   XLAND INFRA QR Service Deployment"
echo "═══════════════════════════════════════════════════════════════"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root for nginx operations
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Note: Run with sudo for nginx configuration${NC}"
fi

# Step 1: Install dependencies
echo -e "\n${GREEN}[1/6] Installing Node.js dependencies...${NC}"
npm install --production

# Step 2: Create logs directory
echo -e "\n${GREEN}[2/6] Creating logs directory...${NC}"
mkdir -p logs

# Step 3: Copy environment file
if [ ! -f .env ]; then
    echo -e "\n${GREEN}[3/6] Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please update .env with your database credentials${NC}"
else
    echo -e "\n${GREEN}[3/6] .env file exists, skipping...${NC}"
fi

# Step 4: Install PM2 globally if not present
echo -e "\n${GREEN}[4/6] Checking PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Step 5: Start/Restart service with PM2
echo -e "\n${GREEN}[5/6] Starting QR service with PM2...${NC}"
pm2 delete xland-qr-service 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# Step 6: Setup PM2 startup (requires sudo)
echo -e "\n${GREEN}[6/6] Setting up PM2 startup...${NC}"
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || echo "Run 'sudo pm2 startup' manually"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "   ${GREEN}✅ QR Service deployed successfully!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Service Status:"
pm2 status xland-qr-service
echo ""
echo "Next steps:"
echo "  1. Update .env with database credentials"
echo "  2. Configure DNS (see README.md)"
echo "  3. Setup SSL certificate"
echo "  4. Configure Nginx"
echo ""
echo "Commands:"
echo "  pm2 logs xland-qr-service  - View logs"
echo "  pm2 restart xland-qr-service - Restart service"
echo "  pm2 monit - Monitor service"
echo ""
