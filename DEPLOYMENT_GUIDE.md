# XLand Infra - Production Deployment Guide

## Overview

This guide will help you deploy the application with:
- **One Backend** (hosted on Railway/Render - FREE)
- **One Database** (Railway MySQL recommended for complex systems)
- **One Frontend** (hosted on Netlify/Vercel - FREE)
- **Real-time Sync** (WebSocket for instant data updates)

All users will access the same data in real-time.

---

## ⚠️ IMPORTANT: Database Recommendation

For your complex system with **6+ user roles**, **multi-tenancy**, and **15+ tables**:

| Provider | Recommended? | Why |
|----------|-------------|-----|
| **Railway MySQL** | ✅ **YES** | Full MySQL, simple setup, free tier |
| **DigitalOcean** | ✅ YES | Production-grade, $15/mo |
| **AWS RDS** | ✅ YES | Enterprise, 12mo free |
| **PlanetScale** | ⚠️ Maybe | Limited foreign keys |

**We recommend Railway MySQL for your system.**

---

## Step 1: Set Up PlanetScale Database (5 minutes)

### 1.1 Create Account
1. Go to [https://planetscale.com](https://planetscale.com)
2. Sign up with GitHub or Email
3. Verify your email

### 1.2 Create Database
1. Click **"Create a new database"**
2. Name: `xland-infra`
3. Region: Select closest to your users (e.g., `ap-south-1` for India)
4. Plan: **Hobby (FREE)**
5. Click **Create**

### 1.3 Get Connection String
1. Click **"Connect"** button
2. Select **"Connect with: Node.js"**
3. Copy the connection details:
   ```
   Host: aws.connect.psdb.cloud
   Username: xxxxxxxxxxxx
   Password: pscale_pw_xxxxxxxxxxxxx
   Database: xland-infra
   ```

### 1.4 Import Your Schema
1. Click **"Console"** in PlanetScale dashboard
2. Copy your local database schema and run it there
3. Or use the PlanetScale CLI to import

---

## Step 2: Deploy Backend to Railway (5 minutes)

### 2.1 Create Account
1. Go to [https://railway.app](https://railway.app)
2. Sign up with GitHub

### 2.2 Deploy Backend
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select your repository
4. Choose the `backend` folder as root

### 2.3 Add Environment Variables
In Railway dashboard, add these variables:

```
DB_HOST=aws.connect.psdb.cloud
DB_USER=your_planetscale_username
DB_PASSWORD=your_planetscale_password
DB_NAME=xland-infra
DB_PORT=3306
DB_SSL=true

NODE_ENV=production
JWT_SECRET=generate-a-strong-secret-key-256-bits
JWT_EXPIRES_IN=24h

EMAIL_USER=xlandinfra@gmail.com
EMAIL_PASS=updyemzzvmnqenus
NOTIFICATION_EMAIL=saisowjanya218@gmail.com
```

### 2.4 Get Your Backend URL
Railway will give you a URL like:
`https://xland-backend-production.up.railway.app`

---

## Step 3: Deploy Frontend to Netlify (5 minutes)

### 3.1 Build Frontend
```bash
cd admin-portal
npm run build
```

### 3.2 Deploy to Netlify
1. Go to [https://netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Drag & drop the `dist` folder
4. Or connect GitHub for auto-deploy

### 3.3 Update API URL
Before building, update `vite.config.js` or `.env`:
```
VITE_API_URL=https://xland-backend-production.up.railway.app
```

---

## Step 4: Update Local Development

For local development, you can also point to the cloud database:

### backend/.env (Local Development with Cloud DB)
```env
DB_HOST=aws.connect.psdb.cloud
DB_USER=your_planetscale_username
DB_PASSWORD=your_planetscale_password
DB_NAME=xland-infra
DB_PORT=3306

NODE_ENV=development
PORT=5000
```

---

## Architecture After Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                        USERS                                │
│  PC 1  │  PC 2  │  Mobile  │  Tablet  │  Any Browser       │
└────────┴────────┴──────────┴──────────┴─────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  NETLIFY (Frontend)     │
              │  https://xland.netlify.app
              └───────────┬─────────────┘
                          │ API Calls
                          ▼
              ┌─────────────────────────┐
              │  RAILWAY (Backend)      │
              │  https://xland-api.up.railway.app
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │  PLANETSCALE (Database) │
              │  MySQL - Cloud Hosted   │
              │  ONE database for ALL   │
              └─────────────────────────┘
```

---

## Data Access Control (Already Built)

| User Role | Data They See |
|-----------|---------------|
| Admin | ALL data |
| FP Admin | Only their franchise data |
| Manager | Only their assigned city/zone |
| Coordinator | Only their assigned zone |
| Vendor | Only their assigned work orders |

This is handled automatically by the backend middleware.

---

## Estimated Costs

| Service | Free Tier | Paid (if needed) |
|---------|-----------|------------------|
| PlanetScale | 5GB storage, 1B reads/month | $29/month |
| Railway | 500 hours/month | $5/month |
| Netlify | 100GB bandwidth | $19/month |

**For starting out: $0/month** with free tiers!

---

## Quick Commands

### Export local data to import to PlanetScale:
```bash
cd backend
mysqldump -u root -p customer_portal > database_export.sql
```

### Import to PlanetScale:
Use PlanetScale Console or CLI to run the SQL file.

---

## Support

- PlanetScale Docs: https://docs.planetscale.com
- Railway Docs: https://docs.railway.app
- Netlify Docs: https://docs.netlify.com
