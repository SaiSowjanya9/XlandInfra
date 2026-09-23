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

### Query and Route Gotchas

Two mistakes that fail silently and have each already broken live endpoints:

- **`pool.execute` cannot bind `LIMIT`.** A prepared statement with `LIMIT ?` fails with
  "Incorrect arguments to mysqld_stmt_execute", which surfaces as a 500 or, where the
  error is swallowed, as a permanently empty list. Inline a clamped integer instead:
  `` `... LIMIT ${Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)}` ``. `pool.query`
  is not prepared and does accept `LIMIT ?`, so only `execute` call sites matter.
- **A `/:id` route swallows every static route declared after it.** Express matches in
  order, so `router.get('/:id')` above `router.get('/cancelled')` answers `/cancelled`
  with that handler's "not found". Declare the parameter route last, or guard it — the
  schedules router uses `(req, res, next) => /^\d+$/.test(req.params.id) ? next() : next('route')`.
  Regression test: `node --test backend/routes/schedulesRouting.test.js`.
- The `users` table has `first_name` and `last_name`, not `name`. Use
  `CONCAT(u.first_name, ' ', u.last_name)`.

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

- Screenshots and mockups shared for this module are **design references only**, not specifications. Take layout and wording cues from them, but never reintroduce a field or panel this file excludes just because a reference shows it.
- The legacy add-on configuration (`fp_addons` and the per-portal equivalents) is being **retired: the old add-on config will be deleted**, not migrated into `service_catalog`. So do not build migration tooling for it, do not add features to it, and do not reintroduce a way to create new ones. Existing records stay readable so saved estimates still render until they are removed.
- Portal consolidation status: the FP portal is converged — configured services are the only service source in its Add Service page and in both estimate forms. Super Admin and Manager still show a legacy add-on dropdown beside the catalog picker, Manager also still has the legacy flat-price create form, and Coordinator, Supervisor and Executive have no catalog access at all. Converging those is agreed in principle but the scope and order are still to be decided; do not start it without confirmation.
- Keep Service Name, but do not add Service ID, Status, Primary Input, Service Code, tags, included/excluded panels, or slab explanation panels to the service form. There is no breadcrumb: the "Master Data › Service Master" trail described navigation that does not exist. There is also no numbered section bar above the form; the cards carry their own headings. `AddServicePage` takes `embedded`, which drops its own title and scope line when the hosting page already names the screen (the FP Add Service tab), leaving only the back arrow and the Cancel/Save actions.
- An AMC package applies to **one or more** property types, chosen as a multi-select, so the same package is never recreated per type — matching Applicable Property Types on the service form. No migration was needed: the list is stored as `property_types` inside the package's `services` JSON, and `property_type` keeps the first entry so older readers and SQL filters still work. `backend/utils/packagePropertyTypes.js` normalizes and validates the list on write (rejecting an empty one with 400), and `getPackagePropertyTypes` / `packageMatchesPropertyType` in `estimatePackageUtils.js` read it. Every package filter, counter and Create Estimate selector must use the matcher, never an equality check on a single type, or a multi-type package silently disappears from the package dropdown. Packages saved with one type keep working unchanged.
- Do not offer Commercial in the service catalog or custom-estimate property selectors. Applicable Property Types offers exactly five values in this order: Gated Community, Apartment, Flat, Villa, Plot. Independent House is withdrawn — `propertyTypeLabel` still resolves it so older services and IH properties read correctly, and a service saved with it shows an amber removable checkbox. `validateService` still accepts `IH` so such a service can be edited and re-saved.
- The catalog offers exactly six pricing methods: Fixed Price, Quantity Based, Area Based, Capacity Based, Capacity Slab and Manpower. `fixed_visit_custom` and `custom_quote` are retired — they are not in the dropdown and `validateService` rejects them, but `calculateServiceQuote` and `methodLabel` still handle them so services and estimate snapshots saved earlier keep pricing and displaying. This is separate from a Capacity Slab row marked `isCustomQuote`, which remains the supported way to require a custom quote for above-range capacity.
- Category on the service form is type-or-select (`AutocompleteInput`, the same control as Zone and City): pick a suggestion or type a new one. It passes `showAllOnOpen`, so clicking the arrow or focusing the field lists every category like a plain dropdown even when a value is already filled in, and typing filters from there. That prop is opt-in, so Zone and City keep their existing filter-as-you-type behaviour. It is validated as text, never against a list, so `saveService` has no "existing category" check. Suggestions come from `GET <catalog path>/categories` via `backend/utils/serviceCategories.js`, which merges the shared config categories, `admin_categories`, and the distinct categories already stored on services in scope — that last source is what makes a typed category reappear in the dropdown, with no extra table and no effect on work-order categories. A blank category is still rejected.
- Service form fields and toggles carry no helper text under them: labels stand alone, and `Field`/`Toggle` accept no `hint`. The word **"Example" is gone from the preview** along with the blue disclaimers that described a configured operating cost no longer collected: the panel is "Pricing Preview", its total is "Customer Price", and its inputs are "Total Area (Sq Ft)" and "Property Area (Sq Ft)". The figures are the service's real configured pricing, which is why they are stated plainly. The amount typed into the preview is still the property's at estimate time, so it is not saved with the service — only the rate, frequency, visits and markup are.
- Allow Frequency Override is **off** on a new service: the configured frequency is what the estimate uses. Turning it on permits a change at estimate time, and that change is still deliberate — the estimate's frequency dropdown stays locked behind an "Override frequency" checkbox in both `ServiceCatalogPicker` and `CustomEstimateBuilder`. Clearing the checkbox restores the service's own schedule (or the matching slab's). `calculateServiceQuote` rejects a changed frequency when the service forbids it, so the lock is enforced server-side too.
- The frequency list is fixed, in this order with these annual visit counts: On Request 0, Monthly 12, Every 2 Months 6, Quarterly 4, Every 4 Months 3, Half Yearly 2, Yearly 1, Weekly 52, Bi-Weekly 26. Note "Half Yearly" has no hyphen. It is defined once per layer — `FREQUENCY_OPTIONS` in `AddServicePage.jsx`, `FREQUENCY_TYPES`/`FREQUENCY_COUNT_MAP` in `estimateStore.js`, and `FREQUENCIES` in `servicePricing.js` — so add a frequency in all three. `Half-Yearly` and `One-time` are retired: not offered anywhere, but still accepted by the validator and resolvable in the count maps so services and estimates saved earlier keep working. Zero visits are valid only for a frequency whose count is zero, and anything dividing a total by the visit count must guard against zero.
- A service stores only its rate. The area, quantity, capacity or headcount belongs to the property and is entered on the estimate through `ServiceCatalogPicker`, which is where the vendor cost is actually computed. Every Pricing Preview therefore takes an editable example amount — area, quantity, capacity, slab capacity or manpower — and shows a dash rather than a figure when the amount or markup is blank, so an example is never mistaken for a real total.
- Every method's configuration section uses the same three-column grid: the vendor rate, Default Frequency and Default Visits Per Year on the first row, then Allow Frequency Override and Allow Manual Visits together on the row below, never mixed in with the fields. Capacity Slab has no service-level rate, so its first row is just frequency and visits. Markup and the manpower detail rows share the same columns so everything lines up.
- All pricing methods belong in the same Add Services form. The Pricing Method selector is a visible row of buttons in Basic Information — one per method, the active one highlighted — so the form is never mistaken for a single-method screen. **No method is preselected:** a new service opens with none chosen, the configuration, unit, markup and preview sections stay hidden behind a prompt, and Save Service is disabled until a method is picked. Editing an existing service selects its saved method. Selecting a method swaps the configuration section, unit list, section tabs, heading and preview. A service saved with a retired method shows an extra disabled amber button instead of silently matching nothing. Area Based and Capacity Based group their per-unit vendor rate, default frequency, visits, and override controls together; keep Default Markup separately. Do not display Formula Preview or the "How Area Based Works" / "How Capacity Based Works" boxes. Example pricing must be clearly distinguished from final estimate pricing, which includes XLAND operating costs. Capacity Based uses rate × total capacity × visits, independently of Capacity Slab pricing.
- Quantity Based uses vendor rate per unit × whole-number quantity × visits. Keep its rate, frequency, visits and override controls together, with Default Markup separately and a clearly labelled quantity example. Support Camera alongside the existing quantity units and apply the same exclusions as the other methods, including no Formula Preview or how-it-works box.
- Fixed Price uses a fixed vendor rate per visit × visits, with the rate and frequency controls grouped together and Default Markup separate. Its example preview has no area/capacity input. Fixed Price and Capacity Slab follow the same exclusions: no minimum-margin fields/approval, Tags, Included/Excluded section, Commercial, Formula Preview, or how-it-works boxes.
- New Manpower services use `manpower_basis: per_visit`; existing records without a basis keep their monthly calculation. Optional `manpower_ranges` automatically select the per-person rate from consecutive whole-number Sq Ft ranges and suggest the recommended minimum headcount. Headcount remains editable subject to `minimum_manpower`; recommended min/max values are guidance. No matching configured range is an error, not a fallback rate. Included working hours do not multiply the base visit rate; optional overtime is extra hours per person per visit. Keep the same UI exclusions as other pricing methods, and retain manpower basis, role, area range, headcount, and hours in saved snapshots and customer-safe service descriptions.
- **What XLAND takes is a margin, not a separate cost.** A vendor rate of ₹1,000 a visit at 35% earns ₹350, and the customer pays ₹1,350: `XLAND Margin = vendor cost × markup %` and `Customer Price = vendor cost + XLAND Margin`. It is called **XLAND Margin** on every service-side screen — the Add Service form field, all three Pricing Previews, and the Configured Services table with its slab dropdown. So a service configures only the vendor rate per method and `default_markup_percentage`; the form has no operating-cost input and always saves `default_operating_cost: 0`, showing the margin read-only instead. Capacity Slab shows no XLAND field at all, since it prices from its slabs. The Configured Services table derives XLAND Margin and Customer Price by scaling the vendor rate, which is why both work without a quantity.
- The arithmetic is unchanged, only the naming: with the operating cost at zero, `calculateServiceQuote` already returns `totalPrice = vendorCost × (1 + markup/100)` and a `profit` equal to the XLAND cost, which is what every preview now labels. `calculateServiceQuote` still honours `input.operating_cost ?? config.default_operating_cost ?? 0`, so a service saved before this change keeps pricing until it is re-saved, and the estimate-side inputs in `ServiceCatalogPicker` and `CustomEstimateBuilder` can still override it — leave them at zero or the customer price stops being vendor + markup. `ServiceCatalogPicker` quotes on the server as the inputs change (400ms debounce), which is what makes those values appear by themselves, and a test asserts `previewManpower` equals the backend quote.
- Eight fields are common to **every** pricing method and must stay that way: Service Name, Category, Pricing Method, Unit (labelled "Capacity Unit" for Capacity Based and Capacity Slab), Primary Input, Default Markup Percentage, Applicable Property Types and Description. The unit list follows the method and its first option is selected when the method is picked, so the unit is never left stale.
- **The unit master is Unit Type + Unit Name.** `UNIT_TYPES` lists every unit under exactly one type — Count / Quantity, Area, Capacity, Manpower, Time / Billing, General — and `METHOD_UNITS` gives each pricing method the types it actually measures, so Area Based offers only area units and Manpower only headcount and billing units. It is defined twice, in `backend/utils/servicePricing.js` (which validates the unit on save) and `admin-portal/src/utils/estimatePackageUtils.js` (which feeds the dropdown through `unitOptionsFor` and `unitGroupsFor`, grouped under the type labels); add a unit to both or the form will offer one the API rejects — a test compares them. Fixed Price is the one method with an explicit list rather than whole types: it bills per Visit, Service or Job, because its unit is also its Primary Input. `Persons` is a capacity rating (a lift rated for 10 persons) and stays under Capacity; a headcount is `Person` under Manpower. The plural labels `Units`, `Lifts`, `Pumps`, `Tanks`, `Acres`, `Liters`, `KW`, `Guards` and `Personnel` are retired — absent from the dropdown but still accepted by `validateService`, the same way retired frequencies and methods are, so a service saved earlier stays editable. The form keeps an out-of-list unit selectable, marked "(no longer offered)", so editing such a service never silently changes it.
- **Primary Input is derived, never stored and never typed in.** The pricing method says what is measured and the service name says what it belongs to: "Generator" priced by capacity reads `Generator Capacity`, "Landscape" priced by area reads `Area`, Manpower reads `Headcount`, and a Fixed Price measures nothing so its billing unit (Visit / Service / Job) is the input. Capacity and Quantity are qualified by the service name because they do not say what is measured on their own; Area, Headcount and Visit already do, and the name is never repeated ("Generator Capacity", not "Generator Capacity Capacity"). It is computed by `primaryInputLabel` in `backend/utils/servicePricing.js` and its twin in `admin-portal/src/utils/estimatePackageUtils.js` — change both, a test compares them. The Add Service form shows it read-only; there is still no editable Primary Input field, Service ID, Status or Service Code.
- **The Configured Services list is a table**, one row per service: `#`, Service (name over category), Method, Input / Details (the derived primary input over that method's vendor rate), Frequency, Visits / Year, Markup %, Property Types, Scope, and Edit / Delete actions. It does not repeat an Add Service button, because the list sits on the Add Service screen, and a row no longer expands into a detail panel — the full configuration is one click away in Edit. Cost columns belong to an estimate, not here: a configured service has a rate but no quantity, so it has no vendor cost, customer price or margin until an estimate supplies the measured amount.
- Delete is a **hard delete** of the `service_catalog` row: `DELETE <catalog path>/:id`, admin-only on the admin path, restricted to an FP's own services on the FP path (scope 0 stays read-only), and 403 on the manager path, which is read-only throughout. No table references `service_catalog` and every saved estimate carries its own `pricingSnapshot`, so a deleted service leaves existing estimates pricing and reading exactly as before — it simply cannot be added to a new estimate. Actions are shown by the same `canEdit` predicate the host passes in, so whoever may edit may delete.
- One string describes a configured service everywhere it is read: `serviceDetails`/`details` from `normalizeEstimateService` (backend) and `getServiceDescription` (frontend, which returns the saved `details` when present). It carries Category, Pricing Method, `Primary Input: …`, the measured amount with its unit (or `Unit: …` when nothing is measured, as on a Fixed Price), the matched slab, the manpower basis/role/area/range/hours, and `Property Types: …`. That one string is what reaches every view modal, the frontend PDF exports, the customer email body and the email PDF attachment, so extending it is how a field reaches all four at once. Both twins must produce identical output.
- Saved estimates already hold every one of those fields: all three write paths store `pricingSnapshot: { ...config, ...quote }`, the full validated configuration. Read them from the snapshot; do not add new columns or ask the picker to resend them.
- **Default Markup is internal.** It may appear on the FP, Super Admin and Manager screens only — read it with `getServiceMarkup` — and must never reach a customer email, a customer PDF or `customerEstimateData`. Keep it out of the details line, which is customer-facing. Coordinator, Supervisor and Executive do not show it.
- Every pricing method carries three toggles, in this order: Allow Frequency Override, Allow Manual Visits and **Do Not Assign Vendor**. The third is about the vendor arrangement only, never about the service: switching it on leaves the service listed, quotable, priced and printed exactly as before, and only stops a vendor being assigned to it and visits being scheduled for it. It is `skip_vendor_assignment` inside the existing `configuration` JSON, so there is no migration; absent means off, which is how every service saved before it behaves.
- **The toggle belongs to the Add Service form and nowhere else.** It is set and read only there — no other screen shows it, labels it, or asks about it: not the Configured Services list, not the estimate service picker, not Pending Property Schedules, and not Create Estimate. Its effect is enforced entirely on the server, so a service simply stops appearing as work awaiting a vendor rather than being badged as excluded.
- The flag is enforced through `backend/utils/vendorlessServices.js`, resolved **by service name** because that is the only key the scheduling module has (`property_vendor_assignments.service_type`, `property_service_schedules.service_name` and the estimate service rows all hold a name, not a catalog id). It is applied in `mapPendingServices`, in all three Pending Property Schedules feeds (`utils/pendingProperties.js`, `routes/admin.js`, `routes/schedules.js`), in the property services feed the scheduling screen reads, and in `applyEstimateVendorAssignments`, which refuses to attach a vendor to such a service even if the estimate form sent one. Each row reports `vendorRequired`, and `pendingServices` is counted from those rows so a property is never held open waiting for a vendor that is never coming. A catalog read failure resolves to an empty set and one unreadable `configuration` row is skipped on its own, so scheduling continues as before rather than silently losing vendors.
- Tests: `node --test backend/utils/vendorlessServices.test.js` (mocked database; scope, name matching, fail-open, and the pending row counts) plus the "arranged without a vendor" case in `servicePricing.test.js`, which checks the toggle exists on all six methods, defaults to off, rejects a non-boolean, and does not change pricing.
- There is no minimum-margin field, threshold, approval rule, or save restriction. Profit and actual margin are informational only.
- Service pricing: vendor cost + XLAND operating cost = actual cost; apply markup to actual cost. Margin is profit divided by customer price, not markup percentage.
- A new service is never pre-filled with invented data: no sample capacity slabs or rates (the table starts as one empty row), no default markup, no default working hours. Only structural defaults remain — frequency and its matching visit count, which a select must hold, and a minimum manpower of 1, which is the lowest value the validator accepts. Adding a slab continues from the previous row only when that row holds a real number; otherwise it adds another empty row.
- Capacity slabs accept consecutive whole-number ranges, including a first range beginning at 1 for lift capacity in Persons. Above-range capacity requires a custom quote.
- Capacity Slab uses a per-row vendor rate, `defaultFrequency`, and `defaultVisitsPerYear`; estimates use the matching slab's schedule before applying permitted overrides. Older slabs without these fields fall back to service-level defaults. Slab configuration is stored in the existing JSON, so no schema migration is needed. Keep the slab table and editable-capacity example preview in Add Services, without a "How Capacity Slab Works" box.
- Custom estimates do not require an AMC package. The internal service table may show vendor costs, operating costs, customer prices, and margin; customer previews must not expose internal costs or profit.
- `schema_v32_service_catalog.sql` creates the catalog and is also applied during backend table initialization. Existing deployments need the earlier estimate schema migrations as usual.
- FP, Super Admin, and Manager Property Estimate forms must show complete property/contact values with wrapping rather than clipped single-line read-only inputs. Its Property ID search grows with the content. Do not show the "AMC Package" heading or "Choose a pre-built AMC package for this property" subtitle above the package selector; keep the selector functional.
- Super Admin is the `admin` role. The `/manager` portal uses `/api/manager/service-catalog` for read-only configured services, quoting, package add-ons, and custom estimates. Managers cannot create/edit catalog definitions. Custom catalog estimates require a real FP assignment and are saved in `fp_estimates`; property and vendor access is restricted by FP plus assigned zones/creator. Never fall back to FP 1 or trust a caller-supplied FP ID. Property selectors distinguish `properties` and `onboarded_properties` IDs to prevent collisions.
- The `/fp` portal uses `/api/fp/service-catalog` (`backend/routes/fpServiceCatalog.js`) for configured services and quoting. Franchise Partners author their own services through the same six-method `AddServicePage` form (Estimates / AMC → Add Service → Create Service → Add Service), which is portal-agnostic via its `apiPath`, `scoped` and `scopeLabel` props; `ServiceCatalogList` gates authoring with `canCreate` and `canEdit`. Saved services always take `scope_id` from the session, so an FP can neither publish a global service nor touch another FP's; admin-owned `scope_id = 0` services stay read-only for them. Only the `franchise_partner` role may write — FP staff (manager, coordinator, supervisor, executive) keep read and quote access only. The FP scope comes from the authenticated session (`req.fpId`) only; a caller-supplied `fpId` is rejected unless it is `all` or the FP's own. `GET /api/fp/service-catalog/categories` returns exactly the categories `validateService` accepts, so the FP form never depends on an `/api/admin` route. Both FP create-estimate forms (property-based and direct) have exactly one service selector, the `ServiceCatalogPicker` labelled "Add Service", which lists configured services and is priced by `POST /api/fp/service-catalog/:id/quote`. The legacy `fp_addons` dropdown has been removed from both, so there is no second way to add a service; existing legacy add-ons still price and display on saved estimates. The FP Add Service page lands on **All Services** — the configured-service list where services are reviewed and edited, above the legacy `fp_addons` — with **Add Service** as a highlighted action on the right of that row, which opens `AddServicePage` in place, remounted on every click so it always opens a fresh form; saving or cancelling lands back on All Services. That create action belongs to the list row only: it is **not** repeated inside the form, whose action row is exactly back, Cancel, Save Service, with Save as its single filled primary. The page passes the list tab to the form's `leading` prop so the tab and those actions share one row instead of stacking, and a button handed to `leading` must set `type="button"`, since a bare button inside the form submits it. FP managers cannot author, so they get no create action and the configured-service list stays a plain tab. The old flat-price add-on creation form is gone; existing legacy add-ons remain editable and deletable under All Services. `POST /api/fp/estimates` runs `fpServiceCatalog.validatePackageEstimate`, which re-prices every catalog add-on, re-reads the package and legacy `fp_addons` prices from the database, recomputes the totals, and rejects mismatches. Custom quotes remain restricted to admin and manager roles, so an FP owner cannot price a `custom_quote` or above-slab service.
- Service and AMC package management always **lands on the list, never on a create form**: the service tab defaults to All Services and the AMC tab to All Packages in every portal (FP `FPEstimates.jsx`, Super Admin `AddonsManager.jsx` and `AMCPackageManager.jsx`). Creating is one highlighted solid-blue action on the right of that same row — "Add Service" / "Create Package" — which stays there while the form is open so it can reset to a fresh one, and is hidden for roles that cannot author (FP Manager, Operations Manager). Manager, Coordinator, Supervisor and Executive already land on their lists and have no create action; do not give them one. Super Admin's separate green "Quick Add" still opens the legacy flat-price add-on form, and its Add Service button is a route (`/employee/estimates/add-service`), so that dedicated page does not repeat the action in its header.
- `ServiceCatalogList` renders **nothing at all** when there are no configured services: no "Configured Services" header, count line or empty message, since an empty card is only noise on a page that stacks it above other lists. It still renders when it has services, when the fetch failed (the error must be visible), when it owns a create action (`canCreate`), or when the host passes `showWhenEmpty` because the list is that screen's whole content — which is why the FP Manager's Configured Services tab passes it.
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

## Assign / Schedule Vendor on Create Estimate

- **The question has been withdrawn from Create Estimate.** Both FP create-estimate forms (property-based and direct) no longer ask it, send `assign_vendor`, or send `vendor_assignments`, so a new estimate stores NULL and therefore reaches Pending Property Schedules — the behaviour that predates the toggle. Do not put the panel back. Vendors are attached in Pending Property Schedules, and what needs a vendor at all is decided per service by **Do Not Assign Vendor** on the service itself.
- Everything behind it is deliberately kept so nothing already saved changes: the column, `normalizeAssignVendor`, `assignVendorFilter` and `applyEstimateVendorAssignments` all stay, an estimate previously answered No stays out of the scheduling queue, and the route still honours `vendor_assignments` if a caller sends them (`Array.isArray` guards the absent case).
- Stored in `fp_estimates.assign_vendor` by `schema_v34_estimate_assign_vendor.sql`. The column is **nullable with no default on purpose**: NULL means the question predates the column, and those estimates must keep reaching Pending Property Schedules. Only an explicit `0` excludes a property, which is why `normalizeAssignVendor` maps an absent answer to NULL rather than 0.
- Scheduling feeds (`utils/pendingProperties.js`, `services/schedulingService.js`) filter through `assignVendorFilter()` in `backend/utils/estimateScheduling.js`, which checks once whether the column exists and returns an empty string when it does not — so a deployment that has not applied the migration keeps working instead of erroring on an unknown column. Never reference `assign_vendor` directly in a query.
- Vendor assignments go through the existing `upsertPropertyVendorAssignment`, so `pending_property_schedules` stays in step. `applyEstimateVendorAssignments` refuses a vendor belonging to another franchise and reports it in `vendorsSkipped` rather than failing the estimate.
- Test: `node --test backend/utils/estimateScheduling.test.js`.

## Customer Portal Schedules

- The customer portal (`frontend`) shows the same schedule the employee portals build, and is **read-only**: customers never schedule, reschedule or cancel a visit, so `frontend/src/pages/Schedule.jsx` has no action buttons and `GET /api/customers/schedules` is the only schedule route they have. The staff routes under `/api/schedules` stay off limits to them — they are role-gated and do not check property ownership.
- A visit shows the service name, the vendor name, its date, time, status and visit number only. Never send a customer vendor ids, work order references, reschedule or cancellation notes, or any cost.
- `scheduled_visits.property_id` is always `onboarded_properties.id`, while `customer_accounts` stores either that id or the property code, so the route resolves the property first (`resolveOnboardedPropertyId`) and then scopes on `sv.property_id`. A customer whose property is not onboarded gets an empty schedule with zero counts, not an error. The vendor is read as `COALESCE(pss.vendor_id, sv.vendor_id)`, matching the portals.
- Counts come from the shared `fetchScheduleStats` in `backend/utils/scheduleStats.js`, so the customer's cards agree with the employee portals; `emptyScheduleStats` is exported for the no-property case. Statuses keep their real values (including `work_order_created` and the derived overdue), and dates/times are formatted in SQL as `%Y-%m-%d` / `%H:%i` so a stored IST day is never shifted by a timezone. The page derives "today" with the same IST offset the stats query uses.
- The three list tabs are disjoint and cover every status: Upcoming holds the open ones plus `in_progress`, Past holds `completed` and `rescheduled`, Cancelled holds `cancelled`. Keep that split if a status is added.
- Test: `node --test backend/routes/customerSchedules.test.js` (mocked database; covers authentication, property resolution by id and code, cross-property isolation, the customer-safe payload, and the row cap). Frontend verification: `npm run build` in `frontend`.

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
8. `migrations/schema_v31_cheque_payment_details.sql` - **Required for cheque payments and for verifying any offline payment**: adds `cheque_number`, `cheque_date`, `bank_name`, `branch_name`, `payee_name`, `payment_location` and `transaction_id` to `payments`

### Cheque Payments

- A cheque keeps its own columns; do not smuggle its fields into `transaction_reference` or concatenate them into `remarks`. `POST /api/payments/payments` writes them and the payments list returns them, which is what lets the verification modal prefill what was recorded instead of asking for it twice.
- `transaction_id` was written by `PUT /api/payments/:id/verify` before any schema file created it, so verifying a payment failed with "Unknown column 'transaction_id'". It is created by v31.
- The bank list, the default payee (`XLAND INFRA PM SERVICES PVT LTD`, prefilled but always editable) and the payment-location label live once in `admin-portal/src/utils/chequePayment.js`. Both cheque screens — recording in `billing/MakePayments.jsx` and verifying in `billing/Payments.jsx` — import them, so they cannot offer different banks. Choosing "Other" reveals a text field; the word "Other" is never stored as the bank name.
- `mysql2` returns a DATE as a `Date` at local midnight, so `JSON.stringify` moves it to the previous day anywhere east of Greenwich. Map date-only columns through the `dateOnly` helper in `backend/routes/payments.js`.
