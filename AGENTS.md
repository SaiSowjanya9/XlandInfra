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

## Dashboard UI

- Keep dashboard summary cards equal in width and height in a single row, with consistent icon sizing, spacing, and label/count alignment. On narrow screens, scroll the card row instead of wrapping cards or overflowing the page. Keep date, notification, and refresh controls compact on the row below.

## Customer Category UI

- Property Management and Add Customer category panels must use the shared `components/common/CategorySelection.jsx` design across portals. Keep equal white cards, matching icons and spacing, teal Residential styling, and the disabled Commercial "Coming Soon" badge. Preserve each page's existing category-selection handler.

## Naming Conventions

- Use **Customers**, not "Clients", throughout the application.

## Portal-Specific Rules

For detailed UI and behavior rules, see the files in `.devin/rules/`:

- `estimates.md` — estimate creation, tables, view modals, and PDF exports
- `work-orders.md` — work order forms, status options, and subcategory loading

## Service Catalog and Custom Estimates

- Keep Service Name, but do not add Service ID, Status, Primary Input, Service Code, tags, included/excluded panels, or slab explanation panels to the service form.
- Do not offer Commercial in the service catalog or custom-estimate property selectors.
- The catalog offers exactly six pricing methods: Fixed Price, Quantity Based, Area Based, Capacity Based, Capacity Slab and Manpower. `fixed_visit_custom` and `custom_quote` are retired — they are not in the dropdown and `validateService` rejects them, but `calculateServiceQuote` and `methodLabel` still handle them so services and estimate snapshots saved earlier keep pricing and displaying. This is separate from a Capacity Slab row marked `isCustomQuote`, which remains the supported way to require a custom quote for above-range capacity.
- All pricing methods belong in the same Add Services form. The Pricing Method selector is a visible row of buttons in Basic Information — one per method, the active one highlighted — so the form is never mistaken for a single-method screen. **No method is preselected:** a new service opens with none chosen, the configuration, unit, markup and preview sections stay hidden behind a prompt, and Save Service is disabled until a method is picked. Editing an existing service selects its saved method. Selecting a method swaps the configuration section, unit list, section tabs, heading and preview. A service saved with a retired method shows an extra disabled amber button instead of silently matching nothing. Area Based and Capacity Based group their per-unit vendor rate, default frequency, visits, and override controls together; keep Default Markup separately. Do not display Formula Preview or the "How Area Based Works" / "How Capacity Based Works" boxes. Example pricing must be clearly distinguished from final estimate pricing, which includes XLAND operating costs. Capacity Based uses rate × total capacity × visits, independently of Capacity Slab pricing.
- Quantity Based uses vendor rate per unit × whole-number quantity × visits. Keep its rate, frequency, visits and override controls together, with Default Markup separately and a clearly labelled quantity example. Support Camera alongside the existing quantity units and apply the same exclusions as the other methods, including no Formula Preview or how-it-works box.
- Fixed Price uses a fixed vendor rate per visit × visits, with the rate and frequency controls grouped together and Default Markup separate. Its example preview has no area/capacity input. Fixed Price and Capacity Slab follow the same exclusions: no minimum-margin fields/approval, Tags, Included/Excluded section, Commercial, Formula Preview, or how-it-works boxes.
- New Manpower services use `manpower_basis: per_visit`; existing records without a basis keep their monthly calculation. Optional `manpower_ranges` automatically select the per-person rate from consecutive whole-number Sq Ft ranges and suggest the recommended minimum headcount. Headcount remains editable subject to `minimum_manpower`; recommended min/max values are guidance. No matching configured range is an error, not a fallback rate. Included working hours do not multiply the base visit rate; optional overtime is extra hours per person per visit. Keep the same UI exclusions as other pricing methods, and retain manpower basis, role, area range, headcount, and hours in saved snapshots and customer-safe service descriptions.
- There is no minimum-margin field, threshold, approval rule, or save restriction. Profit and actual margin are informational only.
- Service pricing: vendor cost + XLAND operating cost = actual cost; apply markup to actual cost. Margin is profit divided by customer price, not markup percentage.
- Capacity slabs accept consecutive whole-number ranges, including a first range beginning at 1 for lift capacity in Persons. Above-range capacity requires a custom quote.
- Capacity Slab uses a per-row vendor rate, `defaultFrequency`, and `defaultVisitsPerYear`; estimates use the matching slab's schedule before applying permitted overrides. Older slabs without these fields fall back to service-level defaults. Slab configuration is stored in the existing JSON, so no schema migration is needed. Keep the slab table and editable-capacity example preview in Add Services, without a "How Capacity Slab Works" box.
- Custom estimates do not require an AMC package. The internal service table may show vendor costs, operating costs, customer prices, and margin; customer previews must not expose internal costs or profit.
- `schema_v32_service_catalog.sql` creates the catalog and is also applied during backend table initialization. Existing deployments need the earlier estimate schema migrations as usual.
- FP, Super Admin, and Manager Property Estimate forms must show complete property/contact values with wrapping rather than clipped single-line read-only inputs. Its Property ID search grows with the content. Do not show the "AMC Package" heading or "Choose a pre-built AMC package for this property" subtitle above the package selector; keep the selector functional.
- Super Admin is the `admin` role. The `/manager` portal uses `/api/manager/service-catalog` for read-only configured services, quoting, package add-ons, and custom estimates. Managers cannot create/edit catalog definitions. Custom catalog estimates require a real FP assignment and are saved in `fp_estimates`; property and vendor access is restricted by FP plus assigned zones/creator. Never fall back to FP 1 or trust a caller-supplied FP ID. Property selectors distinguish `properties` and `onboarded_properties` IDs to prevent collisions.
- The `/fp` portal uses `/api/fp/service-catalog` (`backend/routes/fpServiceCatalog.js`) for configured services and quoting. Franchise Partners author their own services through the same six-method `AddServicePage` form (Estimates / AMC → Add Service → Create Service → Add Service), which is portal-agnostic via its `apiPath`, `scoped` and `scopeLabel` props; `ServiceCatalogList` gates authoring with `canCreate` and `canEdit`. Saved services always take `scope_id` from the session, so an FP can neither publish a global service nor touch another FP's; admin-owned `scope_id = 0` services stay read-only for them. Only the `franchise_partner` role may write — FP staff (manager, coordinator, supervisor, executive) keep read and quote access only. The FP scope comes from the authenticated session (`req.fpId`) only; a caller-supplied `fpId` is rejected unless it is `all` or the FP's own. `GET /api/fp/service-catalog/categories` returns exactly the categories `validateService` accepts, so the FP form never depends on an `/api/admin` route. Configured services appear in both FP create-estimate forms. The FP Add Service page has two tabs: **Create Service**, which is the configured-service catalog and its Add Service form (labelled "Configured Services" and read-only for FP managers), and **All Services**, which lists the legacy `fp_addons`. The old flat-price add-on creation form is gone; existing legacy add-ons remain editable and deletable under All Services. `POST /api/fp/estimates` runs `fpServiceCatalog.validatePackageEstimate`, which re-prices every catalog add-on, re-reads the package and legacy `fp_addons` prices from the database, recomputes the totals, and rejects mismatches. Custom quotes remain restricted to admin and manager roles, so an FP owner cannot price a `custom_quote` or above-slab service.
- Shared estimate property controls live in `components/estimates/EstimateFields.jsx`; use wrapping read-only values and expanding Property ID searches. Saved configured-service estimates must not be rewritten by legacy editors that would drop their snapshots; changing their services currently requires a new estimate.
- Manager catalog integration checks: `node --test backend/routes/managerServiceCatalog.test.js` (mocked database; verifies role, FP, zone, property-source, pricing, and saved-data isolation).
- FP catalog integration checks: `node --test backend/routes/fpServiceCatalog.test.js` (mocked database; verifies authentication, FP scope, who may author, scope forced on save, quoting, custom-quote restriction, and estimate total re-pricing).
- Configured services may share a name across scopes (an admin-wide one and an FP's own), so `serviceOptionLabel` in `AddServicePage.jsx` appends `(All FPs)` or `(FP <id>)` in every service selector, but only when the name is ambiguous.
- An FP estimate may only reference a property belonging to that FP. `backend/utils/fpProperties.js` checks both `properties` and `onboarded_properties` (the payload carries only an id) and is applied in `POST /api/fp/estimates` whenever the session has an `fpId`. If neither table can be queried it reports true, so a deployment missing one does not block saving. Test: `node --test backend/utils/fpProperties.test.js`.
- `/api/estimates-sync` write routes (`POST /`, `PUT /:id`, archive, restore, all deletes, `POST /:id/send`) require `authenticate` + `requireRole('admin')`; Operations Manager keeps read access to `GET /` only, matching the read-only UI; only `POST /:id/action` and `GET /:id/status` stay public for the customer action page. `created_by` is the authenticated user, never a looked-up "first admin". `PUT /:id` refuses to rewrite an estimate whose add-ons hold configured-service snapshots. Any frontend call to these routes must send the bearer token.
- Frontend verification: run `npm run build` in `admin-portal`.
- Pricing/API tests (no database needed): from the repository root run `node --test backend/utils/servicePricing.test.js backend/routes/serviceCatalog.test.js`.
- Service field changes must stay connected through save/load, all authorized estimate views (including archived/property views), PDF exports, and email triggers. Preserve saved pricing snapshots rather than recomputing historical estimates from current catalog settings. Use `backend/utils/estimateData.js` for API/delivery normalization and its customer-safe projection; never send internal snapshots, vendor costs, operating costs, markup, or profit to customers.
- Estimate integration tests (mocked database and mail transport; no real emails): `node --test backend/utils/estimateData.test.js backend/routes/estimatesSync.test.js backend/routes/estimateEmail.test.js backend/services/estimateDelivery.test.js`. These cover legacy fields, customer-safe metadata, zero GST, decimal amounts, and failure-safe email status updates.
- Optional local MySQL integration: run `node --test backend/utils/serviceCatalog.mysql.test.js` with `RUN_LOCAL_MYSQL_TESTS=1` and `NODE_ENV=development`. It verifies the local database name/host, applies the additive catalog migration, and rolls back its test records.

## Module Skills

For reusable task instructions for major modules, see `.devin/skills/`:

- `billing-payments.md`
- `scheduling-module.md`

## Scheduling Schema Initialization

- `backend/config/schedulingSchema.js` initializes the eight schedule-series/occurrence/renewal tables before the work-order scheduler registers its jobs. It reuses only the table DDL from v23/v28, adds missing renewal columns/indexes through `information_schema` checks compatible with MySQL 8, and serializes initialization with a database advisory lock. Do not execute those legacy migration files wholesale at startup: they include legacy-data copies, invalid views, and MariaDB-only ALTER syntax.
- Initialization is additive and does not copy legacy schedules or change existing records. If it fails, scheduled work-order generation and renewal processing stay stopped until the database issue is resolved and the backend is restarted.
- Property contacts have no `is_primary` column; use the first contact ordered by `id`, matching the portal queries. Onboarded-property address fields are `apt_suite_unit` and `postal_code`, not `address_line2` and `pincode`.
- Scheduling regression tests: `node --test backend/config/schedulingSchema.test.js`. Set `RUN_LOCAL_MYSQL_TESTS=1` and `NODE_ENV=development` to also apply the additive initializer twice to the validated local database and EXPLAIN the scheduler queries without creating work orders, renewals, or emails.

## Pending Property Schedules

- Estimates keep the AMC package as `package_id` plus a `package_name` copy, and the write paths default that copy to `''` (`package_name || ''`). Every pending-properties query must therefore read `COALESCE(NULLIF(fe.package_name, ''), fpamc.name)` with `LEFT JOIN fp_amc_packages fpamc ON fpamc.id = fe.package_id AND fpamc.franchise_partner_id = fe.franchise_partner_id`. All package selectors read `fp_amc_packages`, and the FP scope prevents borrowing another partner's package name.
- Estimates with no package at all, such as catalog/custom ones, must keep showing a dash. Never substitute a plausible-looking placeholder for missing property, customer, zone, or package values.
- Work order estimates never have an AMC package, so the feed also returns `estimateType` and the Package column shows a muted "Work Order" chip for them instead of a dash. The frontend check normalizes the value, so `work_order`, `workOrder` and `work order` all match.
- Test: `node --test backend/utils/pendingProperties.test.js` with `RUN_LOCAL_MYSQL_TESTS=1` and `NODE_ENV=development` (creates and rolls back its own records in the local database).

## Estimate Types

`fp_estimates.estimate_type` is created by `schema_v8` as `ENUM('property_based','direct')`, but the application also writes `'work_order'` (FP work order estimates) and `'custom'` (manager catalog estimates). On a database with the narrow enum those inserts fail in strict mode with "Data truncated for column 'estimate_type'" and the estimate is never saved.

- `schema_v33_fp_estimate_type_enum.sql` widens the column to all four values. It is idempotent, preserves the existing nullability and default, and skips columns that are not an ENUM. It intentionally uses no `DELIMITER`/stored procedure, so a statement-at-a-time runner can apply it too.
- `estimates.estimate_type` is a VARCHAR and needs no migration.
- Test: `node --test backend/database/migrations/estimateTypeEnum.test.js` with `RUN_LOCAL_MYSQL_TESTS=1` (applies the migration to a scratch table, never to `fp_estimates`).
- Never widen an enum from inside a test transaction: DDL causes an implicit commit in MySQL and would leave test records behind.

## Property Scheduling Screen

- `handlePrepareConfirmation` and `handleShowFinalReview` take an optional override argument, so they must be wired as `onClick={() => handler()}`. Passing them directly hands React's click event to that parameter; both now ignore anything that is not an array, but keep the wrapper for clarity.
- "Review & Confirm" only opens the confirmation modal. The save happens in `handleConfirmSchedule` via `POST /api/schedules/confirm`, which writes one `property_service_schedules` row plus one `scheduled_visits` row per visit, converts display times such as `2:30 PM` to `14:30:00`, and replaces only visits still in `scheduled`/`confirmed` state so completed visits survive re-confirmation.
- Test: `node --test backend/routes/schedulesConfirm.test.js` with `RUN_LOCAL_MYSQL_TESTS=1` and `NODE_ENV=development` (runs the real route, rolls back its records).

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
