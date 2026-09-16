# XlandInfra Project Conventions

## Git Conventions

- Commit messages must NOT include generated-by or co-authored-by trailers.

## Deployment Context

- **MySQL database name on the VPS:** `xland_pm`

### Local Development Setup

Local development is fully independent of production — never point a local
frontend at `https://xlandinfra.com`, or local edits will mutate live data.

- `backend/.env` uses the `LOCAL_DB_*` variables (not `DB_*`); `DB_*` only
  applies when `NODE_ENV=production`.
- Local database: `customer_portal_local`. The backend creates the database,
  its tables and default users (`admin` / `Password@123`) on boot.
- `admin-portal/.env` and `.env.local` must use `VITE_API_URL=http://localhost:5000`.
  Only `.env.production` points at `https://xlandinfra.com`.

### Database Migration Syntax

The VPS runs MySQL 8, which does **not** support MariaDB's
`ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. Many older files in
`backend/database/` use that syntax and therefore fail to apply on MySQL 8.

For new migrations, check `information_schema` and use dynamic SQL instead —
see `backend/database/migrations/schema_v29_fix_column_drift.sql` and
`schema_v30_estimates_drift.sql` for the pattern. This keeps migrations
idempotent and safe to re-run.

Apply a migration to the local database with the MySQL 8 client (the repo's
`run_migrations.js` / `run-migration.js` scripts read `DB_*`, i.e. production
variables, so they must not be used for local work):

```bash
set -a; source <(grep -E '^LOCAL_DB_' backend/.env); set +a
mysql -h "$LOCAL_DB_HOST" -u "$LOCAL_DB_USER" -p"$LOCAL_DB_PASSWORD" \
  "$LOCAL_DB_NAME" < backend/database/migrations/<file>.sql
```

On Windows the client lives at
`C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`.

## Frontend API Conventions

All API calls in `admin-portal` and all employee portals must use the full `API_BASE` URL. Relative URLs resolve to `admin.xlandinfra.com` instead of `xlandinfra.com`.

```javascript
const API_BASE = import.meta.env.VITE_API_URL || '';

// Correct
fetch(`${API_BASE}/api/manager/dashboard`, { ... });

// Wrong
fetch('/api/manager/dashboard', { ... });
```

- Set `VITE_API_URL=https://xlandinfra.com` in `.env.production`.
- Applies to all employee portals: Manager, Coordinator, Supervisor, Executive, FP, Admin, Vendor.

## Naming Conventions

- Use **Customers**, not "Clients", throughout the application.

## Portal-Specific Rules

For detailed UI and behavior rules, see the files in `.devin/rules/`:

- `estimates.md` — estimate creation, tables, view modals, and PDF exports
- `work-orders.md` — work order forms, status options, and subcategory loading

## Service Catalog and Custom Estimates

- Keep Service Name, but do not add Service ID, Status, Primary Input, Service Code, tags, included/excluded panels, or slab explanation panels to the service form.
- Do not offer Commercial in the service catalog or custom-estimate property selectors.
- All pricing methods belong in the same Add Services form and are selected through the Pricing Method dropdown. Area Based and Capacity Based group their per-unit vendor rate, default frequency, visits, and override controls together; keep Default Markup separately. Do not display Formula Preview or the "How Area Based Works" / "How Capacity Based Works" boxes. Example pricing must be clearly distinguished from final estimate pricing, which includes XLAND operating costs. Capacity Based uses rate × total capacity × visits, independently of Capacity Slab pricing.
- Fixed Price uses a fixed vendor rate per visit × visits, with the rate and frequency controls grouped together and Default Markup separate. Its example preview has no area/capacity input. Fixed Price and Capacity Slab follow the same exclusions: no minimum-margin fields/approval, Tags, Included/Excluded section, Commercial, Formula Preview, or how-it-works boxes.
- There is no minimum-margin field, threshold, approval rule, or save restriction. Profit and actual margin are informational only.
- Service pricing: vendor cost + XLAND operating cost = actual cost; apply markup to actual cost. Margin is profit divided by customer price, not markup percentage.
- Capacity slabs accept consecutive whole-number ranges, including a first range beginning at 1 for lift capacity in Persons. Above-range capacity requires a custom quote.
- Capacity Slab uses a per-row vendor rate, `defaultFrequency`, and `defaultVisitsPerYear`; estimates use the matching slab's schedule before applying permitted overrides. Older slabs without these fields fall back to service-level defaults. Slab configuration is stored in the existing JSON, so no schema migration is needed. Keep the slab table and editable-capacity example preview in Add Services, without a "How Capacity Slab Works" box.
- Custom estimates do not require an AMC package. The internal service table may show vendor costs, operating costs, customer prices, and margin; customer previews must not expose internal costs or profit.
- `schema_v32_service_catalog.sql` creates the catalog and is also applied during backend table initialization. Existing deployments need the earlier estimate schema migrations as usual.
- Frontend verification: run `npm run build` in `admin-portal`.
- Pricing/API tests (no database needed): from the repository root run `node --test backend/utils/servicePricing.test.js backend/routes/serviceCatalog.test.js`.
- Optional local MySQL integration: run `node --test backend/utils/serviceCatalog.mysql.test.js` with `RUN_LOCAL_MYSQL_TESTS=1` and `NODE_ENV=development`. It verifies the local database name/host, applies the additive catalog migration, and rolls back its test records.

## Module Skills

For reusable task instructions for major modules, see `.devin/skills/`:

- `billing-payments.md`
- `scheduling-module.md`

## Razorpay Integration

The project uses **Razorpay Payment Links** (hosted checkout) for online payments. UPI, cards, net banking, and wallets are all handled by Razorpay's hosted page.

### Environment Variables (Backend)
```
RAZORPAY_KEY_ID=rzp_test_xxx (test) or rzp_live_xxx (live)
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
```

### Webhook Configuration
- **URL:** `https://xlandinfra.com/api/razorpay/webhook`
- **Events to enable:** `payment_link.paid`, `payment_link.partially_paid`, `payment_link.expired`, `payment.captured`, `payment.failed`, `refund.processed`

### Database Migrations
Run schema files in order:
1. `schema_v17_payments.sql` - Base payments tables
2. `schema_v18_razorpay.sql` - Razorpay webhook tables
3. `schema_v20_entity_linkage.sql` - Adds receipt_id, invoice_number, property_code columns and receipt_sequence table
4. `schema_v21_payment_security.sql` - Security logs
5. `schema_v22_razorpay_fix.sql` - **Required fix for webhook tracking**
6. `schema_v25_payment_status_fix.sql` - **Required for offline payment verification (bank transfer, cash, cheque)**
7. `schema_v27_payment_history_action_fix.sql` - **Required fix for payment_history action column truncation error**
