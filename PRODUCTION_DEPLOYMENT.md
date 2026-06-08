# Production Deployment Guide

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           XLAND INFRA PLATFORM                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Admin     │  │  FP Admin   │  │   Manager   │  │ Coordinator │     │
│  │  (Full)     │  │ (Franchise) │  │  (Scoped)   │  │  (Scoped)   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
│                    ┌──────────────▼──────────────┐                      │
│                    │     ONE ADMIN PORTAL        │                      │
│                    │   (React + Role-Based UI)   │                      │
│                    └──────────────┬──────────────┘                      │
│                                   │                                      │
│                    ┌──────────────▼──────────────┐                      │
│                    │      ONE BACKEND API        │                      │
│                    │   (Node.js + Express)       │                      │
│                    │   - Role Middleware         │                      │
│                    │   - Franchise Scoping       │                      │
│                    │   - Permission Control      │                      │
│                    └──────────────┬──────────────┘                      │
│                                   │                                      │
│                    ┌──────────────▼──────────────┐                      │
│                    │     ONE DATABASE            │                      │
│                    │   (MySQL - Cloud Hosted)    │                      │
│                    │   - All franchise data      │                      │
│                    │   - All city data           │                      │
│                    │   - All user data           │                      │
│                    └─────────────────────────────┘                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Role-Based Access Matrix

| Feature | Admin | FP Admin | Manager | Coordinator | Vendor |
|---------|-------|----------|---------|-------------|--------|
| **Data Scope** | All | Own Franchise | Assigned City/Zone | Assigned Zone | Own Work |
| **User Management** | Full | Franchise Users | View Only | View Only | ❌ |
| **Vendor Management** | Full | Franchise Vendors | Assigned | View | ❌ |
| **Employee Management** | Full | Franchise Employees | View Only | View Only | ❌ |
| **Work Orders** | All | Franchise | Assigned | Assigned | Own |
| **Estimates/AMC** | Full | Create/View | View | View | ❌ |
| **Properties** | All | Franchise | Assigned | Assigned | Assigned |
| **Export Data** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete Records** | ✅ | ❌ | ❌ | ❌ | ❌ |

## FP (Franchise Partner) Restrictions

When a user is created by a Franchise Partner:
- **FP Manager**: Cannot access Employee Management, Export, Delete
- **FP Coordinator**: Cannot add customers, modify vendors, access employees, create packages

## Database Scoping

```sql
-- All queries automatically filter by:
-- For FP Admin: WHERE franchise_partner_id = ?
-- For Manager: WHERE manager_id = ? OR city_id = ?
-- For Coordinator: WHERE coordinator_id = ? OR zone_id = ?
-- For Vendor: WHERE vendor_id = ?
```

## Deployment Steps

### 1. Set Up Cloud Database

**Option A: PlanetScale (Recommended - Free Tier)**
```bash
# Install PlanetScale CLI
pscale auth login
pscale database create customer_portal --region us-east
pscale branch create customer_portal main
pscale connect customer_portal main --port 3309
```

**Option B: Railway**
```bash
# Create MySQL instance on Railway dashboard
# Get connection string from Railway
```

**Option C: AWS RDS**
- Create MySQL instance in AWS Console
- Configure security groups
- Get endpoint hostname

### 2. Update Environment Variables

```bash
# Copy production template
cp backend/.env.production backend/.env

# Update with your cloud database credentials
DB_HOST=your-cloud-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=customer_portal
```

### 3. Run Database Migrations

```bash
cd backend
node setup-database.js
# Or import your schema
mysql -h your-cloud-host -u user -p customer_portal < schema.sql
```

### 4. Deploy Backend

**Option A: Railway/Render**
```bash
# Push to GitHub, connect to Railway/Render
# Set environment variables in dashboard
```

**Option B: DigitalOcean/AWS EC2**
```bash
# SSH to server
git clone your-repo
cd customer-portal/backend
npm install
pm2 start server.js --name "xland-api"
```

### 5. Deploy Frontend

**Option A: Netlify/Vercel**
```bash
cd admin-portal
npm run build
# Deploy dist folder
```

**Option B: Same Server**
```bash
cd admin-portal
npm run build
# Copy dist to nginx/apache public folder
```

### 6. Configure CORS & Security

```javascript
// backend/server.js
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

## Future Scalability

### Multi-City Expansion
```sql
-- Add new city
INSERT INTO cities (name, state, country) VALUES ('Mumbai', 'Maharashtra', 'India');

-- Assign manager to city
UPDATE managers SET city_id = 2 WHERE id = 5;
```

### Franchise Model
```sql
-- Add new franchise partner
INSERT INTO franchise_partners (name, email, city_id) VALUES ('XYZ Partner', 'xyz@email.com', 2);

-- All users created by this FP will be scoped to their franchise
```

### Mobile App Integration
- Same backend API works for mobile apps
- JWT authentication compatible
- Role-based endpoints remain same

## Latest Updates (June 8, 2026)

### PDF Export Updates
- **Add-ons Table**: Now includes "No. of Visits" column matching services table
- **New Header**: White background with gold logo, gold accent line, professional branding
- **New File**: `admin-portal/src/utils/logoBase64.js` - XLand Infra gold logo base64

### Files Changed
| File | Description |
|------|-------------|
| `admin-portal/src/utils/pdfExport.js` | Updated header design, add-ons table with No. of Visits |
| `admin-portal/src/utils/logoBase64.js` | New file - Gold logo base64 for PDF |

### Deploy Command (Admin Portal)
```bash
cd /var/www/app/admin && git pull origin main && npm install && npm run build
```

---

## Maintenance

### Database Backups
```bash
# Daily automated backup
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$(date +%Y%m%d).sql
```

### Monitoring
- Use PM2 for Node.js process management
- Set up health checks
- Monitor database connections

## Environment Variables Checklist

| Variable | Development | Production |
|----------|-------------|------------|
| DB_HOST | localhost | cloud-db-host |
| NODE_ENV | development | production |
| JWT_SECRET | dev-secret | strong-256-bit-key |
| FRONTEND_URL | localhost:3006 | https://your-domain.com |
| ALLOWED_ORIGINS | * | specific-domains |

---

**Your platform is production-ready with unified architecture!**
