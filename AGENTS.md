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

Mistakes that fail silently and have each already broken live endpoints:

- **An AMC package's price column is `base_price`, not `price`.** `fp_amc_packages` (and the
  per-portal package tables) store `base_price`; every reader aliases it, as in
  `SELECT p.base_price as price`. A bare `price` raises "Unknown column 'price' in 'field list'",
  which reaches the client as a generic 500 — it broke saving any FP or Manager estimate that
  carried both a package and a configured or hand-entered service. A mocked-database test hides
  this, so a package mock must reject a query that selects `price` without `base_price`.
- **`pool.execute` cannot bind `LIMIT`.** A prepared statement with `LIMIT ?` fails with
  "Incorrect arguments to mysqld_stmt_execute", which surfaces as a 500 or, where the
  error is swallowed, as a permanently empty list. Inline a clamped integer instead:
  `` `... LIMIT ${Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)}` ``. `pool.query`
  is not prepared and does accept `LIMIT ?`, so only `execute` call sites matter.
- **`SHOW COLUMNS … LIKE ?` cannot bind either.** The same prepared-statement limit kills the
  runtime column checks: `SHOW COLUMNS FROM t LIKE ?` throws a syntax error, the surrounding
  `catch` swallows it, and the `ALTER` is skipped — so a missing column stays missing while the
  code looks like it self-heals. Check `information_schema.columns` with a bound `column_name = ?`
  instead; that is a plain SELECT and binds fine.
- **A `/:id` route swallows every static route declared after it.** Express matches in
  order, so `router.get('/:id')` above `router.get('/cancelled')` answers `/cancelled`
  with that handler's "not found". Declare the parameter route last, or guard it — the
  schedules router uses `(req, res, next) => /^\d+$/.test(req.params.id) ? next() : next('route')`.
  Regression test: `node --test backend/routes/schedulesRouting.test.js`.
- The `users` table has `first_name` and `last_name`, not `name`. Use
  `CONCAT(u.first_name, ' ', u.last_name)`.
- **A truncated column can cost a payment.** `payment_history.action` began as
  `ENUM('created','updated','status_changed','refunded','deleted')`; three of the values we
  write — `razorpay_payment`, `failed`, `refund` — are outside it, so on a deployment without
  `schema_v27_payment_history_action_fix.sql` MySQL raises `WARN_DATA_TRUNCATED` (errno 1265).
  The Razorpay history row is written inside the payment's own transaction, so that error rolled
  the payment back: the customer paid and nothing was recorded. Always resolve the value through
  `utils/paymentHistoryAction.js`, which widens the column as the migration would, or writes the
  nearest legal member when it cannot. Regression test:
  `node --test backend/utils/paymentHistoryAction.test.js`.
- A "Unknown column X in 'field list'" in the live log usually means the VPS is behind this repo,
  not that the code is wrong — the `assign_vendor` and `fp_amc_packages.price` errors were both
  fixed here well before they stopped appearing there. Check `git log` for the fix before chasing it.
  **But check that a migration creates the column at all before assuming that.** `invoices.paid_at`
  was written by every payment-completion path and created by nothing — not schema_v17's CREATE
  TABLE, not v18/v21/v22, not v46's drift repair — so it was missing on every deployment, including
  a database built from this repo. It failed differently in each path: `PUT /api/payments/:id/verify`
  (the Payments screen of all six staff portals) updates `payments` and writes the history row
  first, so the payment was marked paid while its invoice kept the old amount_paid/balance/status
  and neither scheduling nor the receipt email — both after the invoice update — ever ran;
  `recordRazorpayPayment` runs inside the payment's transaction, so there it rolled the payment
  back entirely, losing customer-portal and payment-link payments the way a truncated
  `payment_history.action` did. Never hard-code `paid_at` into an invoice `UPDATE`: splice
  `paidAtAssignment(status)` from `utils/invoiceColumns.js` into the SET list
  (`${paidAt.sql}` plus `...paidAt.params`), awaited **before** any `beginTransaction` because
  DDL commits implicitly. It adds the column as `schema_v53_invoice_paid_at.sql` would and
  returns empty SQL where it still cannot — a settlement timestamp must never be the reason a
  payment is lost. `ensureInvoiceColumns` is the same guard for `archived`/`archived_at`, which
  the invoice archive and restore routes used to `ALTER` in, and expect to fail, per request.
  Regression test: `node --test backend/utils/invoiceColumns.test.js`, which fails if a writer
  hard-codes the column, skips the splice, or runs the guard inside the transaction.
- **The invoice's payment-link columns are `razorpay_payment_link_id` and `razorpay_short_url`.**
  There are no `payment_link_id` / `payment_link_url` columns, so the customer portal's
  `POST /api/customers/invoices/:id/initiate-payment` created a real Razorpay link and then 500ed
  trying to record it, and its "existing valid link" check — reading the same non-columns — always
  missed, minting a fresh link per request.
- **Razorpay notes must carry `internal_invoice_id`.** `handlePaymentCaptured` and
  `resolveInvoiceIdForPayment` resolve the invoice from that key and give up without it. The two
  customer-portal routes used `invoice_db_id`, which nothing reads, so a Checkout payment whose
  browser never reached `/verify-payment` (tab closed, network dropped) was dropped by the
  `payment.captured` safety net with "no internal invoice ID".
- **A zone is a name merged from several sources, not one row.** The `GET …/zones` pickers
  union the global `zones` table, `fp_zones`, and zone text stored on properties
  (`onboarded_properties.zone`, `properties.zone_id`), stamping each row with a prefixed id
  (`fp-3`, `onboarded-North Zone`, `prop-…`). Deleting only one source made the zone resurface
  on the next fetch, so `DELETE …/zones/:id` goes through `backend/utils/zoneDelete.js`:
  `resolveZoneName` turns the prefixed id back into a name and `deleteZoneByName` removes it
  from every source (scoped to `franchisePartnerId` on portal routes; `includeGlobal` on
  admin's). A bare numeric id on a portal route is a company-wide zone and is refused.
  `onboarded_properties.zone` is NOT NULL — detach with `''`, not `NULL`.

## Work Order IDs

- **One format: `WO-` followed by digits** (the creation time in ms, e.g. `WO-1783455968280`). Always
  call `generateWorkOrderId()` from `backend/utils/workOrderId.js`; it also keeps IDs strictly
  increasing, because `work_order_id` is UNIQUE and the schedulers create several per millisecond.
  Eight places used to build their own, which is how base-36 IDs like `WO-MTWCEEFE-0P6H` (customer
  requests, visit schedulers) got mixed in. `node --test backend/utils/workOrderId.test.js` fails if
  any file builds a `WO-` ID itself.
- Older records are renumbered with `node backend/scripts/renumber-work-orders.js` (dry run) and
  `--apply`. Only `fp_estimates.work_order_id` and `invoices.source_work_order_id` refer to the code;
  every other reference uses `work_orders.id`.

## Stored Text Is HTML-Escaped

- **`middleware/security.js` escapes every string of every request** (`/` → `&#x2F;`, `&` →
  `&amp;`, `"` → `&quot;` …), so the database holds escaped text, and server-built emails and PDFs
  rely on that — there is no output escaping server-side. Do not store decoded text.
- **A form must decode what it loads before it is edited.** Loading `Parts&#x2F;major` into a field
  and saving it re-escapes it to `Parts&amp;#x2F;major`, growing it on every save and turning one
  category into two. Decode with `admin-portal/src/utils/text.js` (`decodeEntities` / `decodeDeep`)
  or `backend/utils/htmlEntities.js`. Both decode repeatedly, which also heals text already
  double-escaped.
- The service catalog does this server-side: `clientService` (decoded) answers the GETs a form
  reads, `parseService` (stored form) is what pricing and estimate snapshots use, and
  `prepareService` validates the decoded body (so length limits count characters, not entity codes)
  and stores it escaped exactly once. Category names are decoded in `utils/serviceCategories.js`.
  Regression tests: `node --test backend/utils/htmlEntities.test.js`.

## Service Form Rules

- **Description is required** on every service (`validateService`, and the form's `required`).
- **Units can be added from the Unit / Capacity Unit box**, like categories. `utils/serviceUnits.js`
  serves `GET/POST/DELETE <catalog>/units` (admin and FP author; Manager reads), stores them in
  `service_units` (created on first use; `schema_v41_service_units.sql` is the same statement) by
  **unit type** — a capacity unit added on Capacity Slab is offered on Capacity Based too, never on
  Area Based. `validateService(input, { customUnits })` accepts a saved unit in its saved spelling;
  a built-in unit of another type is still refused. A unit a saved service uses cannot be deleted.
- **A service marked Do Not Assign Vendor needs no vendor on a custom estimate**; every other
  service still does (`priceCustomEstimate`, and the Manager's `quoteEstimate`).
- The Override Frequency checkbox must not sit inside the Frequency select's `<label>`: a click on
  its text activates the label's first control — the disabled select — so the box never ticks.
- **Visits Per Year takes digits, not `type="number"`.** Once Override frequency unlocks the box, a
  number input accepts `n`, `e`, `-`, `+` and `.` and then reports `value` as `''` for all of them,
  so the field displayed text the component never saw and the service was quoted on no visits —
  or the quote failed with "Visits must be a valid number" over a field that looked filled in. Use
  `utils/visitsPerYear.js`: `sanitizeVisits` on change (digits, capped at 366) and `resolveVisits`
  on blur, with `getServiceSchedule(...).visits` as the fallback, so clearing it restores the
  frequency's own count and a 0 survives only for On Request. Both dialogs that offer the field —
  `ServiceCatalogPicker` and `CustomEstimateBuilder` — go through it. Regression test:
  `node --test admin-portal/src/utils/visitsPerYear.test.js`.

## AMC Package Rows

- Every portal's package form goes through `admin-portal/src/utils/packageRows.js`:
  `updatePackageRow` (new row objects, never `rows[i][field] = value`), `applyRowPatches` (a
  debounced quote is merged into the rows as they are *now*, so text typed while it was in flight
  survives), `packageRowFromSaved` / `packageRowForSave` (one saved shape; reopening brings back
  method, amount, price, `priceOverridden` and `vendorRequired`), `packageRowFromDialog` (a
  hand-typed row's vendor price is its price too — otherwise it added nothing without a markup) and
  `duplicatePackageName`. Regression test: `node --test admin-portal/src/utils/packageRows.test.js`.
- Editing a package opens the same create form, not a separate modal.

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
- **A dashboard's summary row is `components/common/DashboardSummaryCards.jsx`, never a copy.** Four
  dashboards had four designs for the same row: Payments (white card, coloured `border-l-4` edge,
  icon tile, label over a sublabel, the figure, "View All →"), Estimates (top border over a
  white-to-tint gradient, the figure at `text-2xl`), Work Orders (a tinted `bg-blue-50` card with
  the icon opposite the label, wrapping onto a second line at narrow widths) and Schedules (white
  with a plain grey border). **The Payments card is the agreed design** — it is the user's call —
  and it now lives in the shared component, so a page states only its figures.
- A card is `{ key, label, sublabel, value, title, icon, color, linkText, to, onClick }`: `to`
  renders a router link, `onClick` a button, neither means no action, and `linkText` defaults to
  "View All". `color` is a **named accent** (`blue`, `green`, `amber`, `red`, `rose`, `purple`,
  `indigo`, `pink`, `teal`, `orange`, `gray`), not a hex value — Tailwind is scanned statically, so
  the edge/tile/icon/link classes are spelled out in `ACCENTS` and the `2xl` column count in
  `COLUMNS`. A hex passed as `color` silently falls back to blue.
- **The figure is sized to its own length** (`valueSize`), because one row carries both a count like
  `13` and a total like `₹7,92,547`: a count set at the currency size looks lost in the card, and a
  total set at the count size overflows it. Pass the exact figure as `title` where `value` is
  abbreviated.
- The compact `components/common/DashboardStatCards.jsx` is a **different** component on purpose:
  Manager and FP use a 64px link-row with no sublabel and no action. Do not merge the two.
- **An Add Customer entry-type tile keeps its name on one line.** "Gated Community" wrapped to two,
  which made that one tile taller than the other four and left the row ragged. The label is
  `text-xs … whitespace-nowrap` and the tile is padded `px-1.5 py-4 md:py-5` — the narrow sides are
  what keep the longest name on one line at the tightest width the five columns ever get (lg, where
  the sidebar takes 288px). The six copies of this picker — `CreateCustomer`, `FPCustomers`,
  `ManagerCustomers`, `CoordinatorCustomers`, `SupervisorCustomers`, `ExecutiveCustomers` — are
  identical markup and must be changed together.
- **An Estimates header states its counts through `components/estimates/EstimateStatCards.jsx`.**
  The five portals each had their own header for the same four figures — bare centred numbers in
  Manager, Coordinator, Supervisor and Executive, three tinted chips in FP. The shared row is the
  agreed design: a 184×56 cream card (`bg-[#FFFAF0]`, `border-[#F1E3C6]`, `rounded-xl`) carrying a
  32px icon circle, the count at 20px semibold `#111827` and the label at 14px medium `#6B7280`,
  with the colour in the icon only — green `Circle` for Active Estimates, amber `Package` for AMC
  Packages, `PlusCircle` for Add Service and `Database` for Archived. A count passed as `undefined`
  is left out (FP has no Add Service card). Change the component, never a copy in a page.
- **The header around those cards is the same card in every portal too**: `bg-warm-section border
  border-warm-border rounded-xl shadow-warm px-5 py-4`, a `bg-warm-accent-soft` tile with a
  `text-warm-accent` `FileText`, the title in `text-warm-text` and the strapline in `text-warm-muted`
  — FP's header, now also the admin `Estimates` page's, Manager's, Coordinator's, Supervisor's and
  Executive's. The white
  full-width band those four used is gone, so the tab bar beneath is a card as well rather than a
  second band butted against the first. This is the one place the warm skin is deliberately used
  outside the FP portal.

## Every Sidebar Follows the FP Portal's Order

The FP portal's sidebar is the canonical order, and every other portal lists whichever of those
headings it has **in that same order**:

1. Dashboard · 2. Add Customer · 3. Property Management · 4. Work Orders · 5. Estimates / AMC ·
6. Billing & Payments · 7. Schedules · 8. Vendor Management · 9. Employee (Zone) Management ·
10. Marketing

- **Marketing is always last**, and **Employee (Zone) Management immediately before it** — the
  manager, coordinator and executive portals used to render that standalone item *after* Marketing.
  Where a portal's branch has no Marketing section at all (a standalone coordinator or executive,
  who has no franchise partner behind the pipeline), Employee Zone really is last.
- **Complaints have no heading of their own**, in any portal: they are reached inside Marketing, at
  `Marketing > Complaint Form`, because that is where the FP portal keeps them. The manager and
  admin portals used to carry a top-level **Complaints** item at position 3 — their read-only
  inboxes (`/manager/complaints`, `/employee/complaints`) are still routed but no longer linked,
  since `Marketing > Complaint Form` shows the same rows *and* the workflow.
- **The supervisor portal's one Marketing screen is still called Marketing**, in Marketing's slot,
  with the Complaint Form and Archived under it in the FP sub-order. A section named after its only
  child would have been the one portal whose headings read differently.
- Every portal's Marketing sub-items are already the FP's four in the FP's order — Dashboard,
  Tracker, Complaint Form, Archived — minus whatever that portal's mount refuses.
- The admin portal's **User Management** and **QR Management** have no FP counterpart and stay where
  they are, above Property Management.

## Work Orders Header

- **Every portal's Work Orders page uses `components/workorders/WorkOrdersHeader.jsx`.** Six pages
  had six headers for a title, three counts and a Create button — a blue-to-purple gradient tile in
  five of them and a bare heading in the sixth, with the counts living in the tab bar rather than
  the header. The shared one is the agreed "Elegant Gold Accent" design: a cream `#FFFAF0` bar on
  `#E8DFC9`, a 40px gold icon circle, the title at 24px semibold, a `#E8DFC9` rule, then the stats
  (`FileText`/gold Total Orders, `CheckCircle`/green Completed, `Lock`/amber Closed) and the gold
  `#B5812A` Create button against the right edge.
- `stats` is a list, so a page passes only the counts it keeps; `action` takes `{ label, onClick }`
  or `{ label, to }` (Coordinator navigates to a create page rather than switching a tab); and
  `children` ride in the same row — that is where the admin page's FP switcher sits.
- Gold `#B5812A`, not the lighter `warm-accent`, carries white button text: the tan accent does not
  meet contrast, which is the same rule the warm estimate screens follow.

## Customer Portal — Payments & Invoices

- **One list, filtered; not a tab per invoice kind.** `frontend/src/pages/Payment.jsx` opens on
  **All Invoices** with a select to narrow to AMC or Work Order. The two tabs it replaced defaulted
  to AMC, so a customer whose only unpaid invoice was a work order saw an empty-looking page — and
  the Total Invoices / Pending / Total Paid cards count the *displayed* invoices, so those figures
  had been reporting one kind while presenting themselves as the account total.
- A row's icon and tint come from `invoice.invoiceType`, never from the filter: on All the two
  kinds share one list, and the icon is what tells them apart.

## Half-Yearly Payments

- **A payment is either the whole balance or exactly half of it.** The AMC policy offers one split
  — half now, half before the next six-month service period — so there is no percentage dropdown
  and no free-text instalment. `backend/utils/halfPayment.js` owns it; `admin-portal/src/utils/
  halfPayment.js` mirrors it for the two screens and `halfPayment.test.js` compares them.
- **The amount is never read from the request.** A caller sends `portion: 'half'` (anything else is
  the full balance) and the route works the figure out from the balance it just read, because the
  customer's payment page has no login behind it. `resolvePaymentPortion` is the only way in, and
  `backend/utils/halfPayment.test.js` fails if any route destructures an `amount` from `req.body`.
- The second half is due **30 days before the next 6-month period**, i.e. first payment + 6 months
  − 30 days, with month-ends clamped (31 Aug + 6 months is 28 Feb). Nothing is stored: it is
  derived from the payment date, and written into the payment's remarks and the history row.
- An instalment's Razorpay link is **not** saved onto the invoice. `payment_link` /
  `razorpay_payment_link_id` are the invoice's own full-balance link, already emailed to the
  customer; the webhook matches on `notes.internal_invoice_id`, so a half payment still records.
- The option is a small text button in the summary panel on both screens (`PublicPayment`,
  `billing/MakePayments`) — never a highlighted panel of radio buttons at the top of the page.
  On cash and cheque it only prefills the amount box, which stays editable, and the instalment is
  noted on the payment only when the figure really is the half.

## Warm Beige UI System

The portals are being moved onto the warm beige skin. Page surfaces still vary (pages convert
one at a time, and `EstimateThemeProvider` keeps shared components byte-identical when no warm
theme is in play), but **one element is deliberately global: dialogs.** Every modal in every
portal — staff and customer — renders through `components/common/Modal.jsx` (copied to
`frontend/src/components/common/Modal.jsx`): the `bg-black/50` backdrop, the white `rounded-xl`
card with `border-warm-border shadow-warm`, Escape-to-close and backdrop-click close. Never
write a `fixed inset-0` shell by hand; pass `onClose`, `align`, `zIndex`, `padding`,
`overlayClassName` (e.g. `lg:pl-72` beside an expanded sidebar), `className` for the card's
size/scroll only, and `ariaLabelledBy`. What stays outside it: image lightboxes, full-screen
page takeovers, transparent dropdown dismiss-catchers and sidebar backdrops.

- The palette lives in `admin-portal/tailwind.config.js` as the `warm` colors — `page #FAF7F2`,
  `section #FFF9EE`, `border #EADFCF`, `accent #D4A574`, `accent-hover #C69250`,
  `accent-soft #FEF3E2`, `text #1F2937`, `muted #6B7280`, `success #ECFDF5`, `info #EEF4FF`,
  `warning #FEF3C7` — plus `shadow-warm` and `shadow-warm-hover`. Use these tokens, not raw hexes.
- Cards are `rounded-xl` (12px) with `border-warm-border shadow-warm`; inputs and buttons are
  `rounded-[10px]`.
- The tan accent carries icons, highlights, active states and totals. **Solid calls to action stay
  green** (`bg-emerald-700 hover:bg-emerald-800`): white text on the tan accent does not meet
  contrast.
- Empty states use `components/common/EmptyState.jsx` — the accent-soft icon tile, sparkles and
  bottom wave pattern. Pass a Lucide icon, title and description rather than rolling a new one.
- Components shared with other portals must never be restyled in place, or Manager, Coordinator,
  Supervisor, Executive and Admin change with them. `admin-portal/src/utils/estimateTheme.js` offers
  two ways in, both of which render byte-identical markup when no warm theme is in play:
  - `estimateSkin(theme)` for semantic keys (`panel`, `heading`, `muted`, `primary`, `field` …).
    Used by `EstimateStructure`, `CustomServicesTable`, `EstimateTerms`, `ServiceCatalogPicker`,
    `PackageServicePicker`, `ManpowerFields` and `common/AutocompleteInput`. Add any key you need to
    both skins, and keep the default value identical to the class the component already had.
  - `useSkinClasses()` for a whole screen: every `className` value is wrapped in `sk(...)`, and the
    warm class map rewrites the classes at render time. Used by the two large catalog screens,
    `AddServicePage` and `ServiceCatalogList`.
- A page announces its skin once with `<EstimateThemeProvider value="warm">` (see `FPEstimates`);
  everything below it, including dialogs rendered through portals, picks it up. An explicit `theme`
  prop still wins. Pages with no provider get the original look.
- Status and priority tints (`bg-blue-100 text-blue-700` for Sent and so on) stay as they are: they
  are how a state is read at a glance, and the warm palette has a single accent.

## Marketing Is One Router and One Set of Screens, Mounted Three Times

- **`backend/routes/marketing.js` serves the FP, Admin and Ops Manager portals.** It used to live
  inline in `franchisePartner.js`; the admin and manager portals had nothing but a read-only
  complaints inbox. The file exports `createMarketingRouter({ resolveScope })` and each portal
  mounts it: `/api/fp/marketing` (its own partner, FP account only), `/api/admin/marketing` (every
  partner, narrowed with `?fpId=`) and `/api/manager/marketing` (its partner, within its assigned
  zones). A change to a tracker field or a complaint rule therefore cannot reach one portal and
  miss another.
- **Six portals, not three.** FP, admin and Ops Manager edit; the **coordinator** reads and may
  set Coordinator Reviewed (nothing else); the **executive** reads only; the **supervisor** has the
  **Complaint Form and nothing else of Marketing** — no tracker, no marketing dashboard. Each
  portal's permissions are mirrored for the UI by `marketingPermissions` in
  `src/utils/marketingApi.js`; the server is the authority and refuses the rest regardless of what
  a screen renders.
- **The supervisor mount exists for the complaints alone.** Complaints are assigned to supervisors
  as they are to coordinators, so that portal needs the screen to read the assignment, report
  In Progress and save what was done — but the partner's lead pipeline is none of its business.
  `canReadTracker: false` on its scope is what refuses `GET /tracker`, `/tracker/archived` and
  `/dashboard`; leaving the router unmounted was the old answer, and a sidebar that does not link a
  screen is not a permission. `marketingHasTracker(portalType)` mirrors the same fact for the UI,
  which is why Archived shows that portal only its Complaint Forms tab — a screen that asked for the
  tracker anyway would put a 403 where the first tab should be.
- **The mount decides what is visible; the router never asks the role.** `resolveScope(req)`
  returns `fpIds` (`null` = every partner, `[]` = nothing), `writeFpId` (the partner a new
  complaint belongs to), `zones` (`null` = unrestricted), `creator` (see below), `canWrite`,
  `canReview` and `withPartnerName`. It may throw `{ status, message }` to refuse outright — that
  is how the FP mount keeps answering 403 to an FP's own staff, and how a standalone manager,
  coordinator or executive (no partner behind the tracker) is refused.
- **`canWrite: false, canReview: true` writes exactly one column.** The tracker PUT branches into
  a statement that names `coordinator_reviewed` and nothing else, rather than comparing the body
  against the stored row: the table re-sends the whole tracker payload on every inline edit, so
  anything less would let one of those through as a full edit. Verified — a coordinator posting
  `lead_status`, `next_action` and `tracker_status` changed none of them.
- **`scope.creator` is for `fp_estimates` only.** A coordinator or executive also sees the leads
  they entered, wherever the property sits, because an estimate's zone is the *property's* and not
  the author's — zone-only showed an executive an empty tracker for their own visits.
  `zoneFilter(scope, prefix, { withCreator: true })` is therefore opt-in: `fp_marketing_complaints`
  has a `zone` but no `created_by_id`, and asking for the clause there failed the whole statement
  with "Unknown column 'c.created_by_id'" — a 500 where the complaints list should have been.
- **An empty `fpIds` or `zones` list must become `AND 1 = 0`, never an omitted filter.** `IN ()` is
  not SQL, so the tempting shortcut is to skip the condition — which would show a zone manager
  every lead its partner has.
- **Writes are filtered by scope too.** The id in the URL is never trusted on its own: the `UPDATE`
  carries the partner (and zone) filter, so a 404 is what a caller gets for someone else's row.
- **`canWrite: false` is enforced here, not only in the sidebar.** That is what keeps the
  Operations Manager read-only on the admin mount even if a screen forgets to hide its buttons.
- **The four screens are shared too**: `admin-portal/src/pages/marketing/` with a `portalType`
  prop (default `franchise`), resolved through `src/utils/marketingApi.js` —
  `getMarketingApiPath`, `marketingFpId`, `withMarketingFp`, `canLogComplaint`. An unknown portal
  falls back to the **FP** prefix, which is scoped by the caller's own token, never to `admin`.
- **A complaint belongs to exactly one partner and the column is `NOT NULL`**, so the admin has to
  pick one before the form can save; the server answers 400 rather than letting MySQL raise a 500,
  and the New Complaint button stays disabled until a partner is selected.
- **Marketing is hidden from an FP's own manager inside the FP portal, but the `/manager` portal
  *is* that section for its own partner.** The guard is therefore
  `portalType === 'franchise' && role === 'manager'` — the portal, not the role alone.
- **The read-only Complaints inbox asks for `?includeArchived=true`.** It is one list with no
  Archived tab beside it, so filtering archived rows out would simply lose them.
- **The tracker's Last Updated By column is written by the server, never by the client.** Every
  tracker write — the inline field edit and both archive actions — stamps
  `tracker_updated_by` / `tracker_updated_by_role` / `tracker_updated_at` from `req.user`
  (`schema_v49_marketing_tracker_actor.sql`). A `tracker_updated_by` in the request body is
  ignored: a field the caller can set is worth nothing as a record of who changed the row.
  `fp_estimates.updated_at` is *not* this — it is the estimate's own column and moves for reasons
  unrelated to the tracker, which is why the tracker keeps its own timestamp.
- **The three portals' tokens disagree about names.** The FP's and an admin's carry
  `firstName`/`lastName`, but the manager login signs only `{ id, username, email, role,
  managerId, ... }`, so `trackerActor` falls back username → email → `Unknown user`. It never
  returns blank: a row that changed under somebody has to name someone. The **name** is stored
  rather than a user id because the portals authenticate against different tables
  (`users`, `franchise_partners`, `fp_employees`), so there is no single id to point at.
- The role is stored as its code and the readable label is resolved server-side into
  `tracker_updated_by_role_label`, because `config/roles.js` is CommonJS and the browser cannot
  import it — otherwise the portal would carry a fourth copy of the role names to keep in step.
- **Estimate Status moves itself along, and is derived rather than stored.** With no status chosen
  by hand a tracked lead reads `Created by Executive` for its first 24 hours, then
  `Pending Coordinator Review`, and stays there until somebody marks Coordinator Reviewed as Yes,
  which makes it `Reviewed by Coordinator` (`autoTrackerStatus`). A day is 24 hours from
  `created_at`, not the next calendar date — "after 1 day" must not mean "in an hour" for a lead
  entered at 11pm. Nothing is written, for the same reason Due Status is not: a stored
  "Pending Coordinator Review" is wrong the moment it is reviewed and nothing would correct it.
- **Only the two revision statuses are ever stored — everything else is locked to the
  automation.** `MANUAL_TRACKER_STATUSES` (`Revision Required`, `Revised Estimate Sent`) is the
  manual set; the dropdown lists the derived ones disabled so the current status still shows,
  and the PUT writes `NULL` for any submitted status outside the manual set. That matters twice
  over: the table re-sends the whole payload on every inline edit, including the *resolved*
  status it was given, so storing `Pending Coordinator Review` would freeze the lead there with
  the progression silently dead — and it also heals a row frozen by an older version, since the
  next edit clears the stale value. A hand-picked manual status still outranks the automation,
  so a lead is never dragged back from where somebody put it; the dropdown's `Auto` option
  (`''` → `NULL`) is the way back.
- **`coordinator_name` is not typed in either**: setting Reviewed to Yes records whoever did it.
  It is resolved **in the UPDATE**, `CASE WHEN ? = 'Yes' THEN COALESCE(NULLIF(coordinator_name,
  ''), ?) ELSE NULL END`, rather than in JavaScript — the table re-sends the whole payload on
  every inline edit, so recomputing it from the caller would hand the review to the next person
  who touched an unrelated cell. The first reviewer keeps the credit, and clearing the flag
  clears the name, so no review is left with a name nobody stands behind. The route ignores a
  `coordinator_name` in the body.
- Regression test: `node --test backend/routes/marketing.test.js` (scope isolation per portal,
  refused writes, the recorded editor, no bound `LIMIT`) and
  `node --test admin-portal/src/utils/marketingApi.test.js`.
- The guard tests in `utils/marketingDashboard.test.js` and `utils/marketingFollowUp.test.js` read
  **`routes/marketing.js`** now. If the marketing code moves again, repoint them.

## A Complaint Is a Piece of Work, Not Just a Record

`Open → Assigned → In Progress → Reviewed → Closed`, and **closing is what archives it**
(`schema_v51_complaint_workflow.sql`). A complaint is filed by an employee portal or by the
customer's own Contact page; the FP hands it to one zone-centric employee, that employee works it
and writes a note, and the FP or its manager verifies the note and closes it — at which point the
row lands in Marketing > Archived. The resident who filed it is emailed at every step
(`schema_v52`, below).

- **One policy function decides who may move a complaint where**:
  `resolveComplaintStatus` / `complaintStatusesFor` in `backend/utils/marketingComplaints.js`,
  mirrored for the screens by `admin-portal/src/utils/complaintStatus.js`. The assignee may set
  **`In Progress` and nothing else** — they report progress, they do not sign their own work off —
  and the FP and its manager may set anything **except `Assigned`**, because assigning is what
  produces that status: offered from the dropdown it would let a row claim an assignee nobody
  chose. `forbidden` on the result separates "no such status" (400) from "not yours to set" (403).
- **Assigning is the FP's alone; closing is the FP's and its manager's.** The admin portal may
  create and edit complaints but does neither. Per-portal in `marketingPermissions`
  (`canAssign`, `canClose`) and per-mount in `resolveScope` — the server refuses the rest.
- **The scope gained `assignee: { employeeId }`,** resolved per request by
  `resolveFpEmployee` in `backend/utils/fpEmployeeDirectory.js`. It does two things: the complaint
  lists add `OR assigned_employee_id = ?` (`zoneFilter(scope, prefix, { withAssignee: true })`), so
  an assignment is visible to the person who has to act on it even outside their zones — the FP
  picks the assignee, so it can legitimately be someone else's zone — and `assigneeOnly(scope)`
  holds a caller who cannot otherwise write to **that one row**. Without it an assignee could
  report on every complaint their zones cover.
- **Resolve an employee by `user_id`, then email/username — never by treating the token's `id` as
  an `fp_employees.id`.** Both are auto-increment sequences and collide constantly; a wrong match
  hands one employee another's assigned complaints.
- **Manager, coordinator, supervisor and executive can be assigned — nobody else.** The test is
  whether the role has the Complaint Form screen to read the assignment in and report back from;
  field staff have no portal of their own, so a complaint handed to one would go to a screen that
  does not exist. `ASSIGNABLE_ROLES` + `normalizeEmployeeRole`, which strips schema_v8's `fp_`
  prefix so `fp_manager` and `manager` describe the same person.
- **The picker lists the complaint's own zone and nobody else.** The zone is a *filter*, not a sort
  key: an employee is offered when their `fp_employee_zones` rows hold that zone or the literal
  `all`. Listing the rest of the roster alongside them made the FP read a dozen names and their
  zone lists to find the two people who actually cover the property, which is the opposite of what
  zone-centric assignment is for. Each row therefore carries **the name and the job role** — the
  zone is in the dialog's own header, so repeating every employee's zone list is noise.
- **A zone nobody covers offers nobody**, and the dialog says so and points at Employee Zone
  Management: the fix for "no one is assigned to Zone A" is to put somebody in Zone A, not to hand
  the complaint to whoever is on the list. A complaint with no zone at all cannot be narrowed, so
  that one does list everybody assignable.
- **The assign route stays permissive about the assignee's zone** — it checks the role and nothing
  else. The picker is where the zone rule lives, so an assignment already made survives the zone
  being renamed or taken away, and the complaints list still shows an assignee their own row from
  outside their zones.
- **The note is the tracker's note, for complaints**: one `complaint_note` capped at 500 *decoded*
  characters, its own `PUT …/complaints/:id/note`, a `MessageSquare` bubble in the Actions column
  that opens read-first (so a click meant only to read leaves no half-typed draft), and the same
  text read back in the detail modal with an Edit link onto the same lightbox. It stays readable in
  Marketing > Archived after closing — that note is the record of why the complaint was closed.
- **Notifications are sent after the write, outside any transaction, and never throw.**
  `services/complaintNotifications.js`: the assignee on assignment, the FP **and its managers** when
  the assignee reports progress or saves a note, the assignee when it is closed. A failed mail
  server must not undo the thing it was announcing — that is how a customer once paid and had the
  payment rolled back (see `payment_history.action`). Managers covering the zone are preferred but
  it **falls back to every active manager**: the review is what closes the complaint, so a complaint
  nobody is asked to verify would sit at In Progress for ever.
- Email HTML is written from the **stored, escaped** text (nothing is escaped on output
  server-side); the in-portal `portal_notifications` message is **decoded**, because the portals
  render it as text. Getting this backwards either un-escapes user input into a message or shows
  `GC&#x2F;1` in a notification.
- **`status` and `archived_at` must never disagree.** Closing sets `closed_at`, `closed_by` *and*
  `archived_at` together; restoring from Archived brings a `Closed` row back as **`Reviewed`** and
  clears both close stamps. In that `UPDATE` the `status` assignment comes **last**: MySQL evaluates
  a single-table UPDATE's assignments left to right and a later one sees what an earlier one wrote,
  so stamps written first would be testing the status the statement had already changed.
- **A row written before schema_v51 has no status**, so every reader defaults it to `Open` —
  `presentComplaintRow` server-side, `statusOf` in the screens. A blank cell where the workflow
  should be says nothing at all.
- The in-portal signal an assignee actually sees is the **"Assigned to me (n)"** chip on Marketing >
  Complaint Form plus the tinted rows, because `assigned_to_me` is stamped on each row by the
  server — the browser cannot work out which `fp_employees` row the caller is. The
  `portal_notifications` rows are written as well, but no portal renders a generic feed today
  (`SchedulingNotificationsPanel` is exported and never used).
- Regression tests: `node --test backend/utils/marketingComplaints.test.js`,
  `node --test backend/routes/marketing.test.js` and
  `node --test admin-portal/src/utils/complaintStatus.test.js` (which compares the browser's copy of
  the policy with the server's, so a portal cannot offer a status whose save answers 403).

### The Customer Hears About Their Own Complaint

The resident is the fifth audience: they are emailed when the complaint is **filed** and on **every**
status move through to **Closed**, and the same status is on their portal's Contact / Help page and
in its notification bell.

- **`customer_account_id` and `customer_email` are stamped when the complaint is filed**
  (`schema_v52_complaint_customer.sql`), not looked up on each update — a customer who changes their
  address still gets the updates on a complaint already under way, exactly as the assignee's name is
  stamped at assignment.
- **A complaint the FP files on a resident's behalf reaches that resident too**, through
  `utils/complaintCustomer.js`. The match is deliberately narrow: the property's account whose
  **phone** is the one on the complaint, or — failing that — the property's **single** account.
  Several households on one property code and no phone match means **nobody is told**. Telling the
  wrong household that *their* complaint is being worked on, and then that it is resolved, is worse
  than telling no one.
- **The field notes never leave the staff portals.** The customer is told the *state* of their
  complaint; `complaint_note` is the assignee's report for the FP and its manager to verify. Saving
  a note therefore sends the customer nothing, which `marketing.test.js` asserts explicitly.
- **`presentCustomerComplaint` decodes its text server-side**, which no staff list does. The customer
  portal has no `decodeEntities` of its own and shipping one there to read a status line is worse
  than decoding a display-only projection — but that payload must then never be fed back into a form
  or an email body, both of which rely on the stored, escaped form.
- **A `portal_notifications` row carrying only a franchise partner is visible to *every* customer of
  that partner.** The customer feed's original branch is "anything for the `customer` role whose
  partner owns my property", so a complaint — which concerns one household — is matched on
  `pn.user_id` (the `customer_accounts.id` that raised it) and **excluded from that branch**. One
  fragment, `utils/customerNotificationScope.js`, serves the list, its unread count and both
  mark-read routes, because they have to agree: a row a customer can see but not dismiss sticks in
  their bell for ever.
- **Those reads must not join `onboarded_properties`.** They used to
  `LEFT JOIN onboarded_properties op ON op.franchise_partner_id = pn.franchise_partner_id` and test
  `op.id = ?`, which matches one row per property the partner owns — so any notification the property
  condition did not narrow (a work order, and then a complaint) came back **once per property**: a
  customer with one unread update saw it ten times and the badge counted all ten. Every branch is now
  an `EXISTS`, which cannot multiply rows. Regression test:
  `node --test backend/utils/customerNotificationScope.test.js`.
- The bell navigates to `action_url`, and the customer portal's pages live under **`/dashboard`**
  (`frontend/src/App.jsx`) — `/contact` alone is the public marketing site's own route.
- Regression tests: `node --test backend/utils/complaintCustomer.test.js` and the customer hops in
  `backend/routes/marketing.test.js`.

### The Employee Tables Were Broken Underneath It

Both found by running the complaint workflow against the real local database, and both older than
it. `schema_v51` fixes them and `ensureFpEmployeeSchema` (`utils/fpEmployeeDirectory.js`, called
from `server.js` on boot) does the same thing at runtime.

- **`fp_employees.role` was `ENUM('fp_manager','fp_supervisor','fp_executive')`** while the FP's Add
  Employee form sends `manager`, `coordinator`, `supervisor`, `executive`. MySQL answers
  `WARN_DATA_TRUNCATED` (errno 1265) for every one of them, so where the original column survives
  **no employee can be created at all** — and a coordinator cannot exist even in principle.
- **`fp_employee_zones.zone_id` is `INT NOT NULL` with no default** while the zone routes insert
  `(franchise_partner_id, fp_employee_id, zone_name)` — a zone is a *name* merged from several
  sources, so there is no id to put there. Every assignment failed with
  `ER_NO_DEFAULT_FOR_FIELD` (errno 1364), which **silently left zone-centric access inert**: an
  employee with no rows in that table falls back to "own records only" on every screen.
  `schema_v29` added `zone_name` and left `zone_id` alone.
- **`portal_notifications.type` was an ENUM too**, with no `complaint` — so every complaint
  notification was refused with errno 1265 and dropped. `ensurePortalNotificationsSchema` now widens
  it the same way it widens `role_type`.
- **MySQL 8 answers `information_schema` queries with UPPERCASE column names** whatever case the
  SELECT is written in, so `SELECT data_type …` read as `row.data_type` is `undefined` — and a
  guard written that way reports nothing, changes nothing and looks like it ran. Alias what you
  read (`SELECT DATA_TYPE AS dataType`), as `utils/paymentColumns.js` does. The first version of
  `ensureFpEmployeeSchema` had exactly this bug; it was caught only by reverting the columns
  locally and watching the boot log. Regression test:
  `node --test backend/utils/fpEmployeeDirectory.test.js`.

## Franchise Partner Display Name Is Column-Drifted

- **`franchise_partners` has `company_name` and `owner_name` everywhere, but `contact_person` only
  on some deployments.** A hardcoded `COALESCE(fp.company_name, fp.owner_name, fp.contact_person)`
  fails the entire statement with "Unknown column 'fp.contact_person' in 'field list'". Always go
  through **`backend/utils/franchisePartnerName.js`**: `partnerNameExpression(pool, alias)` for a
  query that joins the table, `fetchPartnerName(pool, fpId)` for code that just needs the string.
  It reads `information_schema` once, caches, falls back to `company_name`, and `fetchPartnerName`
  never throws — it is usually filling a field on a record the user is trying to save.
  Regression test: `node --test backend/utils/franchisePartnerName.test.js`.
- This cost two live features before it was found, both silently: the admin Complaints inbox
  answered 500 instead of listing complaints, and **every** customer complaint filed from the
  customer portal's Contact page failed, because the lookup that fills `responsible_person` threw
  and the route's catch reported the generic "Failed to submit complaint". Nothing was stored, so
  nothing appeared in any portal and the feature looked merely empty rather than broken.
- A list that joins `franchise_partners` must **qualify its own columns**: both tables carry `id`,
  `status` and `created_at`, so an unqualified select is ambiguous, not merely untidy. That is why
  `trackerSelect(alias)` and `complaintSelect(prefix)` take a prefix.
- **`properties` and `onboarded_properties` are not interchangeable either.** `properties` keeps
  the division as **`division_id`** — a `VARCHAR` holding the *name*, exactly as `zone_id` holds a
  zone name — while only `onboarded_properties` has a `division` column. `p.division` in the
  customer complaint route was the second reason that form answered "Failed to submit complaint".
  When a query joins both tables, check each column against the right one.
- **A generic catch turns a schema error into a feature that looks empty.** Both bugs above were a
  500 behind a friendly message. Where a route derives fields from several tables, test it by
  actually calling it: `node --check` and a build will never find a missing column.

## A Blank Option Must Clear Its Own Free-Text Column

- The tracker's `maintenance_system`, `proposal_given` and `customer_decision` each pair with a
  `*_other` column. When the parent option arrives blank the loop sets the parent to `null` and
  `continue`s — and used to leave the `*_other` key **undefined**. mysql2 refuses an undefined
  bind ("Bind parameters must not contain undefined"), so saving a tracker row with no Current
  Maintenance System answered 500 with nothing in the portal to explain it. Only the required pair
  (`proposal_given`, `customer_decision`) failing validation first kept this rare.
- Clear the paired column in the same branch. Regression test: *an option left blank clears its own
  free-text column* in `backend/routes/marketing.test.js` asserts no bind parameter is `undefined`.

## Admin Portal Zones, Customers and Schedules

- **The admin portal's zones are `/api/admin/zones`, never `/api/fp/zones`.** `CreateCustomer.jsx`
  called the FP route, which requires a franchise scope an admin has not got: the GET quietly
  returned only the global zones (the FP route drops its other three sources into empty `catch`
  blocks) and the POST answered 400 "Zone creation requires FP scope". The page's response was to
  *skip saving for admins altogether*, so a zone typed into the box looked saved and was gone on
  reload. `POST /api/admin/zones` and `DELETE /api/admin/zones/:id` write the global `zones` table;
  a derived id (`fp-3`, `onboarded-North Zone`) is refused with a reason rather than silently
  doing nothing.
- **`is_active` and `is_activated` on `customer_accounts` are different things and the customer
  login reads both**: `is_active = 0` is refused as "invalid email or password", while
  `is_activated = 0` is told to use the activation link. So Disable/Enable controls access, and
  Resend activation issues the link — never conflate them. The FP portal's own
  `/customer-accounts/:id/activate` predates this: it writes a plaintext `temp_password` and a
  `password_hash` directly and sends no email (its "TODO: Send activation email" is still there).
- **`backend/utils/customerActivation.js` is the one implementation of "issue a token, hash the
  temporary password, email the link"**, shared by the customer portal's own resend and the admin
  Customers list. The temporary password is returned to the caller but never stored in clear text.
- **`GET /api/admin/customers` reads `customer_accounts` once and coalesces both property tables.**
  Selecting it once per property table — as the FP list does — lists a customer twice whenever ids
  collide across `properties` and `onboarded_properties`.
- **The admin schedule screens call `/api/admin/schedules/*`** via `getApiPath('admin')`. Five of
  those endpoints did not exist, so the notification bell read no count and no list, the vendor
  assignment modal 404ed on both its list and its save, and Rescheduled Requests could not restore
  a visit. They are implemented in `admin.js` now, unscoped by design. `SchedulingCalendar.jsx` is
  imported nowhere, so the bare `GET /api/admin/schedules` it would need was deliberately not added.
- **`adminOnly` admits the Operations Manager**, which is right for reading. Writes added to
  `admin.js` go through `adminWriteRoles` as well, because that role is view-only by policy — the
  same rule the estimates and service-catalog routers already apply.
- **A missing table is an empty list; every other failure is reported.** The manager's AMC package
  and add-on lists turned *any* error into `{ success: true, data: [] }`, so a broken query read as
  "no packages" with no way for the screen to say otherwise. Only `ER_NO_SUCH_TABLE` returns an
  empty list now.

## A Dropdown Closes When You Click Away

- **Use `components/common/DismissPanel.jsx`, not another hand-rolled listener.** Every floating
  panel — an FP picker, a zone or area suggestion list, a category dropdown, the customer portal's
  account menu — closes on an outside click and on Escape. 57 of them were written as
  `{open && <div className="absolute …">}` with nothing listening, so an open one stayed open while
  you worked elsewhere on the page and several could be open at once; a dozen screens had each
  grown their own `useRef` + `useEffect` + `mousedown` listener for the same thing.
- It is a drop-in, and the condition comes with it:
  `{open && rows.length > 0 && (<div className="absolute …">…</div>)}` becomes
  `<DismissPanel open={open && rows.length > 0} onDismiss={() => setOpen(false)} className="absolute …">…</DismissPanel>`.
- **No ref at the call site, deliberately.** The trigger is always a sibling inside the same
  positioned wrapper, so the panel's own `parentElement` is the anchor. That is what makes a click
  on the trigger count as *inside*: closing on its `mousedown` would let its `click` reopen the
  panel, and it would never shut. The decision lives in `utils/dismiss.js` so it can be tested
  without a browser — `node --test admin-portal/src/utils/dismiss.test.js`.
- `frontend` has its own copy of both files, as it does of `halfPayment.js`: the two apps are
  separate bundles with no shared source.
- **Not everything that opens is a dropdown.** A mobile sidebar (`sidebarOpen`) has its own
  backdrop, and a dialog passed `open={...}` is a modal — neither belongs here. The public
  marketing header's services menu toggles opacity rather than rendering conditionally, so it needs
  a different treatment and was left alone.

## A Fixed Overlay Must Not Inherit a Page's Spacing

- **`space-y-*` moves modals.** Almost every page is `<div className="p-6 space-y-6">` with its
  modals written at the end, which makes each overlay a *later sibling* — and Tailwind's rule is
  `.space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.5rem }`, applied purely by
  position, with no idea the child is `position: fixed`. A margin still applies to a fixed box, so
  `fixed inset-0` was being pushed 24px down and a strip of the page showed above **every**
  lightbox, in every portal. `space-x-*` does the same thing sideways.
- The fix is one rule in each app's `index.css` (`admin-portal` covers all the staff portals,
  `frontend` the customer one):
  `[class*="space-y-"] > .fixed.inset-0 { margin: 0 }`. It matches Tailwind's specificity — three
  class-level selectors, since `:not([hidden])` counts as one each — and is declared **after**
  `@tailwind utilities`, so it wins the tie on source order rather than with `!important`. Moving
  it above the directive, or dropping `.inset-0` from the selector, silently stops it working.
- A new full-screen overlay should therefore be `fixed inset-0`, not `fixed top-0 left-0 w-full
  h-full`: the rule keys off `.inset-0`. Bottom-anchored floating buttons (`fixed bottom-6
  right-6`) are unaffected — with no `top`, a stray `margin-top` moves nothing.

## Dates Are dd/mm/yyyy, in IST

- **`admin-portal/src/utils/dateFormat.js` is the only date formatter.** `formatDate` (dd/mm/yyyy),
  `formatDateTime` (dd/mm/yyyy with a 12-hour clock), `toDateInputValue` (the yyyy-mm-dd wire
  format), `maskTypedDate` / `parseTypedDate` (typing), `istTodayValue`. `formatDate` had been
  redefined in **fifty** files: 33 rendered "05 Aug 2026", 43 call sites used the **en-US** locale
  and so put the month first, nine were already dd/mm/yyyy and nine were the bare locale default —
  the same record read differently depending on which screen you opened.
- **A date-only value must never go through `new Date()` for display.**
  `new Date('2026-08-05')` is parsed as **UTC** midnight and `toLocaleDateString` then renders it
  in the browser's timezone, which is the previous day anywhere west of UTC. `formatDate` reads a
  `yyyy-mm-dd` from its own digits and resolves a real timestamp in `Asia/Kolkata`, so the day is
  the Indian day for every viewer. Same rule, same reason as `toDateOnly` / `istToday` in
  `backend/utils/marketingFollowUp.js`.
- **`<input type="date">` cannot be made to show dd/mm/yyyy.** Browsers take that format from the
  operating system's locale and ignore the `lang` attribute, so one screen read dd/mm/yyyy in India
  and mm/dd/yyyy on a machine set to en-US. Use
  **`admin-portal/src/components/common/DateField.jsx`**: it is a drop-in for the native input —
  same `value` (yyyy-mm-dd), and `onChange` receives `{ target: { name, value } }` carrying
  yyyy-mm-dd — with its own calendar, so every existing handler keeps working.
- **A date that does not exist is refused, not rolled forward.** `new Date('2026-02-31')` silently
  becomes 3 March, which stores a day the user never chose; `parseTypedDate` returns `''` instead.
- **Two patterns still hold 22 native date inputs**, in the estimate/billing filter rows: a visible
  dd/mm/yyyy text box with a transparent `type="date"` on top of it purely to borrow the browser's
  calendar, alongside 19 local copies of `formatDateIST` / `parseISTDate` / `handleDateInput`.
  Those already read dd/mm/yyyy, so they were left alone — but they are the same logic again, and
  converting one means replacing the **pair** with a single `DateField` and deleting the local
  helpers. Converting only the hidden overlay leaves an invisible field whose popover is invisible
  too.
- Chart axis labels keep their compact shape ("05 Aug", "Aug 26"); only the locale was corrected so
  the day comes first. Times stay 12-hour, because that is what those screens already showed.
- Regression test: `node --test admin-portal/src/utils/dateFormat.test.js`.
- **A missing import of a shared formatter is not a build error** — it is an undefined variable at
  runtime, and the bundler will happily ship it. After any bulk edit, check that every file calling
  `formatDate` / `formatDateTime` / `<DateField>` imports it, and that no file both imports and
  declares the same name (that one *is* a parse error). Rewriting the body of a helper that shares
  the name made `pdfExport.js` call itself.

## Marketing Tracker Follow-Up Fields

- **`backend/utils/marketingFollowUp.js` owns the workbook's follow-up columns**, and
  `admin-portal/src/utils/followUpDates.js` mirrors it for the tracker screen — the same
  arrangement `halfPayment.js` uses, because a browser cannot require the CommonJS module the
  server validates with. `followUpDates.test.js` compares the two option list by option list and
  branch by branch; if they drift, the tracker offers something the PUT rejects.
- **Due Status is derived on read, never stored.** A stored "Due Today" is wrong by the next
  morning. The rule is the workbook's column U formula exactly, and **the blank test comes first**:
  a finished lead with no next date reads `No Date`, not `Completed`. Getting that order backwards
  silently reclassifies every closed lead.
- **Dates are stamped in IST, not in the server's timezone.** `istToday()` goes through
  `Intl` with `Asia/Kolkata`. A server in UTC would file an evening contact under the previous day
  for 5.5 hours out of every 24. The columns are `DATE`, and `toDateOnly` reads a mysql2 `Date` by
  its *local* components — `toISOString()` there rolls the day back anywhere east of UTC.
- **Picking a Follow-Up Stage is what records a contact**: it stamps today and schedules the next
  follow-up `FOLLOW_UP_INTERVAL_DAYS` (4) later. Editing Last Contact Date re-schedules from it;
  Next Follow-Up Date then stays editable, so a deliberate date is never overwritten. The table
  and the modal both go through `contactStamp` / `nextFollowUpFrom` so they cannot disagree.
- **A Follow-Up Stage only moves forward.** The dropdown disables the steps behind the current
  one — and the blank option once a stage is set — and the PUT enforces the same rule against the
  stored row: a submission behind (or blank) keeps the stored stage rather than refusing, because
  the table re-sends the whole payload on every inline edit and the other cells are still worth
  saving. Regression test: `node --test backend/routes/marketing.test.js` ("a follow-up stage
  only moves forward").
- **An approved or rejected estimate answers Customer Response itself.** `effectiveCustomerResponse`
  resolves it on read — approving in All Estimates must move the tracker with it, and a stored copy
  would be right only until the estimate next changed. It overrules whatever the FP had chosen, so
  the tracker cannot claim the customer is still reviewing an estimate that is approved, and the
  portal shows a badge instead of the select from then on, exactly as Estimate Status does. The
  workbook's response list had `Approved` but no `Rejected`, because the sheet recorded a rejection
  as `Not Interested`; `Rejected` is added as a tenth option, since a rejected estimate is not the
  same answer as a customer who was never interested. Anything in `ESTIMATE_DRIVEN_RESPONSES` must
  stay inside `CUSTOMER_RESPONSES`, or the PUT would reject the value its own UI displays.
- **An inline edit resends the whole payload, built from `TRACKER_FIELDS`.** `proposal_given` and
  `customer_decision` are required by the PUT, so every save carries them. Listing the fields by
  hand is how a newly added column gets wiped by an unrelated edit in another cell.
- **The option check must decode before it compares.** `middleware/security.js` escapes `/` to
  `&#x2F;`, so `SMS/Text` arrives escaped and a raw `options.includes(value)` answers 400 — the
  Last Contact Method select just stops saving, with nothing in the log to explain it. Validate
  `decodeEntities(value)` and store the escaped form, so it is escaped exactly once. Of the 84
  options across the nine tracker lists, `SMS/Text` is currently the only one affected, which is
  precisely why this is easy to reintroduce. Regression test:
  `node --test backend/utils/marketingFollowUp.test.js`.

## Marketing Dashboard

- **The tracker's option lists live in `backend/utils/marketingDashboard.js`, not in the route.**
  `LEAD_SOURCES`, `PRIORITIES`, `CUSTOMER_DECISIONS`, `TRACKER_STATUSES` and `FOLLOW_UP_STAGES` are
  imported by `routes/marketing.js` to compose its `TRACKER_OPTIONS`, so a stage added once is
  accepted by `PUT /marketing/tracker/:id` *and* charted by the dashboard. They were declared in
  both files before, which is the same "keep in step" drift that bites elsewhere in this file.
  `node --test backend/utils/marketingDashboard.test.js` fails if the route re-declares them.
- **Every figure is aggregated in `buildMarketingDashboard`, never in SQL.**
  `GET /api/fp/marketing/dashboard` runs one query for the tracked, non-archived direct estimates
  and hands the rows to the util, so the counting rules are testable without a database. The rules
  that are easy to get wrong, and are each pinned by a test: *Estimates Sent* is cumulative (an
  approved lead still had its estimate shared); *Not Interested* counts a rejection **or** a
  declining `customer_decision` but never the same row twice; *Pending Coordinator Review* is
  anything not positively marked `Yes`; open pipeline value excludes approved and rejected rows,
  which are reported separately as approved value.
- **The dashboard reads the resolved status, not the raw column.** Rows go through
  `effectiveTrackerStatus` first, so an approved estimate counts as Approved even when nobody set
  `tracker_status` by hand — the same status the tracker list displays.
- **A zero divisor must read 0%, not `NaN%`.** An FP with no tracked estimates loads this page
  first; win rate and every funnel step guard their denominator.
- **Overdue / Due Today / Upcoming are judged against one "today" for the whole page.** The
  aggregation resolves `istToday()` once and passes it to every row, so a page built across
  midnight cannot split identical dates between two buckets.
- **A count chart draws every option, a money chart drops the empty ones.** The stage and status
  bars keep their zero entries so the pipeline holds its shape at low volume; nine zero-height
  rupee bars just read as broken, so `valueByStatus` is filtered.
- Charts are `recharts` (already a dependency, used by 14 other dashboards) and the page follows
  the warm beige skin, with gold `#B5812A` — not `warm-accent` — behind white button text.

## Chart Legends

- **A legend label wraps; it is never truncated.** Every dashboard had written its own legend and
  every one of them cut the labels off — "Ba…" for Bank Transfer, "Verifi…" for Verification
  Pending, "Partially P…" for Partially Paid — which leaves the reader unable to tell which slice
  is which. Use `components/common/ChartLegend.jsx`: items are `{ label, value, color }`, the label
  wraps and carries a `title`, the figure sits right-aligned and `whitespace-nowrap`, and the colour
  dot is nudged `mt-[0.3em]` so it sits on the label's first line rather than halfway down a
  two-line one. A `value` is formatted by the caller, since one chart counts and another totals money.
- **A chart library's own legend is not used where a data point can cross it.** Recharts ignored
  both the `payload` order and the reserved `height` on the Payments margin chart: the legend kept
  the order the shapes are painted in — Customer Price first, Margin % in the middle of the costs —
  and floated over the plot, where a 100% margin point was drawn straight through it. `ChartLegend`
  takes `layout="row"` for that case: the series named above the plot, outside it, in the order the
  reader meets them, with `line: true` on an item drawn as a line rather than filled.
- A donut and its legend **stack until `xl`**. A card in a three-column grid is narrow at every
  breakpoint below that, and a 130px chart beside a legend is what squeezed the labels in the first
  place. Where a label must keep a fixed column so bars line up, it wraps inside that column.

## Collection Trend

- **It is a charted trend, not a row of bare `div`s.** The bars had no axis, no gridline and no
  figure on them, so a tall blue bar beside a short green one said only "more than" — by how much
  was unanswerable without hovering, and an "All Time" range of two months looked like two random
  blocks. It is a recharts `ComposedChart` now: invoiced and collected side by side per period,
  against a money axis in `₹K`/`₹L`, with a grid and the shared hover card. The period buckets
  still come from `utils/collectionTrend.js` — by day up to a month, by month beyond it.
- **A figure is drawn over a bar only where the range is short enough** (eight buckets or fewer).
  Thirty days of labelled bars is an unreadable smear; the hover answers the rest. The plot scrolls
  sideways at ~44px a bucket rather than compressing a month into a 300px card.

## Chart Hover

- **Every bar, column and segment states its figure when it is pointed at.** Use
  `components/common/ChartTooltip.jsx`: `useChartTooltip()` for the charts drawn by hand —
  `{...chart.hover({ title, rows: [{ label, value, color }], footer })}` on the element and
  `{chart.node}` anywhere in the tree — and `<Tooltip content={<ChartTooltipContent />} />` for the
  charts recharts draws. `rows` are formatted by the caller, as `ChartLegend`'s values are.
- **The card is rendered into `document.body` and positioned against the viewport,** which is the
  whole point of it: a tooltip drawn inside its own card is clipped by anything between, and both
  failures had shipped. The shared `DonutChart` placed its card 60px above the chart, which put it
  outside every `overflow-hidden` card — hovering a segment on the Work Orders and Schedules
  dashboards displayed nothing — and the Collection Trend's plot area scrolls sideways, so a
  tooltip inside it would be cut off by its own chart. Do not reintroduce a `group-hover` card
  positioned with `bottom-full` inside a chart card.
- **Hover the column, not the bar.** The Collection Trend's column carries both of its series, so
  one hover reads the invoiced and the collected figure for that date together, and a bucket with
  nothing in it still answers rather than being unhoverable. The same holds for a day with two
  scans: the bar is 3px tall, the column is not.
- A recharts chart without a `<Tooltip>` is a chart with no readout at all. Five pie charts —
  Executive, Supervisor, Coordinator, Vendor and Customer — shipped that way. When adding one,
  guard it with the same emptiness check as the data, or the "No Data" placeholder slice reports
  itself as a work order.

## Property-Based Estimates — Cost & Margin

- **The panel is a chart, not a table.** It listed one row per estimate, which states a margin one
  line at a time and never puts the figures against each other. It is a `ComposedChart` of
  **grouped bars, one group per estimate, oldest first**: Vendor Cost, XLAND Cost and Customer
  Price side by side, each bar labelled with its own figure so the chart is read without hovering,
  and the margin as a line across them on its own right-hand axis — a percentage plotted against
  figures in lakhs is otherwise flat on the floor. **Total Actual Cost is deliberately absent**:
  with no operating cost it is the vendor cost again under another name. The x-axis names the
  estimate over the property; a long id keeps its tail (`EST-…24188`), which is what distinguishes
  one from another. The plot scrolls sideways at ~190px a group rather than squeezing three
  labelled bars into nothing. Do not reinstate the per-estimate table.
- **Nothing is labelled where something else is already drawn.** Bar figures are **compact**
  (`₹1.5L`, not `₹1,50,300`), because an exact figure is wider than the 40px bar it labels and runs
  into its neighbour — the exact figures are in the hover and in the cards above. **The margin is
  not labelled on its line at all**: the dot for an estimate sits at whatever height the percentage
  puts it, which for the middle bar of the group is repeatedly where that bar's own figure already
  is. Above it collided, below it landed on the bar, and a chip with a background only made an
  unreadable overlap a legible one. The figure is stated **under the axis** instead, on a third
  line of the tick beneath the estimate and its property, where nothing else is drawn; the line and
  the right-hand axis carry the shape. The legend is likewise the panel's own, above the plot —
  see the Chart Legends rules.
- **A calendar picks the timeline** (`DateRangeFilter`, the same control the other dashboards use)
  and everything in the panel follows it: the four summary cards are the range's totals, not the
  whole history, and the chart plots the estimates the range left. `utils/estimateMarginTrend.js`
  does the filtering, ordering and adding up — `estimatesInRange`, `estimateMarginSummary`,
  `estimateMarginChartRows`. Regression test:
  `node --test admin-portal/src/utils/estimateMarginTrend.test.js`.
- What enters the panel is still the server's decision: `GET /api/payments/property-estimate-margins`
  returns property-based estimates that are neither archived nor rejected, priced from the snapshot
  saved with each service, and now carries each estimate's `createdAt` so it can be plotted. The
  calendar only narrows that set — never widen it on the client.
- **An estimate with no cost behind it is plotted but never added up.** One whose services were all
  typed by hand has a price and no cost, so a chart that hid it would hide real money while the
  totals that included it would report a margin approaching 100%. So the bars show it — a customer
  price, no vendor bar, and the whole of it apparently margin — and the totals leave it out. The
  line under the heading states the estimate count for the range and nothing more: it used to name
  the uncosted ones too, which was a sentence of caveat above a chart that shows them plainly.
- **XLAND cost is the markup in rupees, not the `operating_cost` field.** ₹4,000 of vendor cost at
  30% earns ₹1,200 and the customer pays ₹5,200, which is what the service form's preview has
  always called XLAND's cost (`vendorCost × markup / 100`). This panel showed `operating_cost`
  instead — a separate overhead input that the service form hardcodes to 0 and no property-based
  estimate carries — so the card read ₹0 beside a margin of 28%, two figures that cannot both be
  true. It is derived, never entered: `xlandCost = customerPrice − vendorCost − operatingCost`,
  which makes it the profit, so margin is `xlandCost / customerPrice` and the parts add up: the
  vendor bar plus the XLAND bar is the customer price bar beside them.
- Markup and margin are different numbers and the UI must not conflate them: markup is charged on
  cost, margin is measured against price, so `margin% = markup / (100 + markup) × 100`. 30% markup
  is a 23.08% margin.

## QR Management

- **`qr_scans` is the only source of any figure on the screen**, and a row on it means one request to
  `/api/qr/r/:slug` — which only a scanned code produces. The per-row flags (`is_unique_user`,
  `is_repeat_scan`) are written but never read back: a flag is decided once, by whichever request was
  first, and cannot be corrected, whereas `COUNT(DISTINCT visitor_id)` can be recomputed and always
  agrees with the rows. Counting "unique users" as `COUNT(*) WHERE is_unique_user` quietly meant
  "first scans", and `SUM(is_repeat_scan)` reported one visitor's 40 scans as 39 returning visitors.
  A visitor is a device fingerprint, so `COALESCE(visitor_id, CONCAT('scan:', id))` keeps a row that
  predates fingerprinting as a visitor of its own instead of lumping them all together.
- **A website visit is not a scan.** `POST /api/qr/track-visit` used to write a `qr_scans` row for
  anyone who opened the site, staff included, and the total was reported as "Total Scans" — the very
  data `cleanup_fake_qr_scans.sql` existed to purge. It and its caller in `frontend/src/App.jsx` are
  gone; do not reintroduce page-visit tracking into this table.
- **Bind no `undefined`, and never swallow the failure.** Commit 70ef43a2 swapped a hardcoded
  `geoData` (which had `latitude`, `longitude` and `timezone` as null) for `getGeoLocation()`, which
  returns none of those keys, so mysql2 threw `Bind parameters must not contain undefined` on every
  scan insert and a `catch` only logged it: visitors were redirected and **not one scan was
  recorded**, for months, while the dashboard showed page visits instead. The row is built by
  `utils/qrScan.js` (`SCAN_INSERT_SQL` + `buildScanParams`) from one column list, a missing value
  becomes SQL NULL, and the test asserts no parameter is ever undefined.
  Regression test: `node --test backend/utils/qrScan.test.js`.
- **Order matters in user-agent parsing, and getting it wrong misreports rather than loses.** An
  iPhone sends "CPU iPhone OS 17_0 like Mac OS X", so a `/mac os x/` test above the iOS one filed
  every iPhone scan under macOS while the device panel called the same scan mobile. Windows 11 sends
  "Windows NT 10.0" and is not distinguishable, so no version is claimed rather than labelling it 10.
  Bot patterns must name what they mean: `/snap/i` discarded every scan from Snapchat's in-app
  browser. `parseUserAgent` and `isBot` live in `utils/qrScan.js` with their tests.
- **A label must match its query.** "Verified Scans — mobile only (real users)" counted tablets too
  and implied everything else was fake; it is "Phone & Tablet" of the same total now. "Active Now"
  came from `qr_active_sessions`, which nothing but a scan ever updated, so it was already "scanned
  in the last 5 minutes" — it says so. Total QR codes comes from `qr_codes`, not
  `COUNT(DISTINCT qr_id) FROM qr_scans`, which omitted every code nobody had scanned yet.
- **Send the token, and show the failure.** Every QR endpoint is `authenticate` + `adminOnly` since
  the security audit (11da8865), and `QRManagement.jsx` called them with no `Authorization` header:
  all three answered 401, every card fell back to `0`, and a dead page was indistinguishable from a
  quiet one. Requests go through the page's `qrFetch`, a failed load names itself in a banner, and no
  card invents a fallback figure. For the same reason the page is admin-only in the nav and has no FP
  route: `adminOnly` rejects `operations_manager` and franchise partners with a 403.
- The trend series is zero-filled server-side (`scanWindow` + `fillScanSeries`), by hour for `24h`
  and by whole calendar day otherwise, so the chart's bars add up to the card above it and an empty
  day is drawn as **no bar** — not as the 5%-tall stub the old floor gave it. Every query in
  `/analytics/:qrId` uses that same window, including the scan list, which used to ignore the period.
- `qr_analytics_daily` is retention only; `qr_analytics_hourly` and `qr_active_sessions` are no
  longer written at all. `backend/database/qr_reset_analytics.sql` inspects the table, purges legacy
  page-visit rows and rebuilds the daily roll-up from `qr_scans` so the two provably agree — run it
  by hand, step by step, after taking a dump.

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
- **A package's Service Configuration table is filled two ways, and both buttons sit in its header.** `Add Row` opens `CustomServiceDialog` -- the same dialog an estimate uses for a hand-entered service -- because a table row has no room for a category, a quantity, a schedule and a price. Its price field is labelled by `priceLabel`: an estimate sells to a customer and asks for the **Customer Price**, a package buys from a vendor and asks for the **Vendor Price**, which lands on the row as its vendor cost and counts towards the Internal figures. The row's customer price is the Price column, which is editable for every row. The same dialog either way, so the two cannot drift apart; `Add Service` opens `components/estimates/PackageServicePicker.jsx`, which lists the configured services covering any of the package's selected property types (never an equality check on one type) with search and checkboxes. **A service may be added as often as it is needed** -- the same service twice at different amounts is a legitimate package -- so the picker marks nothing as already added and disables nothing on that account, and the table starts empty: a row exists only because Add Service or Add Row put it there, and any row may be deleted, the last one included. Saving still refuses a package with no services, which is where that rule belongs. A picked service contributes its name, description, category, default frequency and default visits, **and how it is priced** — its `catalogServiceId`, pricing method and unit — and the row stays editable like any other.
- **A package's price is what its configured services add up to; it is no longer typed.** Each picked row asks for the amount its method measures (a quantity, an area, a capacity, a headcount), and `utils/packageServicePricing.js` prices it through the same `<catalog path>/:id/quote` endpoint the estimate screens use, so a package and an estimate can never price the same service differently. The amount is the package's own assumption rather than a property's, so it is saved with the row and the quoted price is what an estimate then uses. Price (₹) in the Price Summary is therefore read-only, and saving requires at least one priced service instead of a typed figure. **A row is priced at what the vendor charges, never at what the service sells for.** The quote returns both — `vendorCost`, the vendor rate across the visits, and `totalPrice`, that with the service's own markup on it — and `quotePackageRow` takes `vendorCost`. A package sets its own margin, so taking the marked-up price would charge a markup on a markup. (This supersedes the earlier rule that a row opened on the quoted customer price; the objection then was that a small package markup applied to cost *replaced* the service's markup and dropped the price, which was true while the base was the customer price and is not while the base is the cost.) The quote's own `marginPercentage` is therefore not stored on the row: it describes a price the row no longer carries. **The Price Summary's Markup (%) is XLAND's margin on that cost**: `price = vendor cost × (1 + markup/100)`, exactly as a service's own markup prices the service, so a markup can only raise a price. A hand-typed row is marked up from the vendor price entered on it, by the same rule. **Left blank, the package is sold at cost**, and the Price Summary says so rather than leaving it to be worked out. Packages saved before this keep the prices they were saved with; only a re-priced row picks up the new basis. The Price column, the package price and the Internal figures all follow. Left blank, each row keeps the price it already has: a configured row the quote made with its own service's markup, a hand-typed one what was entered. It is saved with the package, so reopening one does not silently re-price it. **Each row's own Price is editable**, though: a configured row opens on its quote and a hand-typed one on nothing, and either may be typed over -- `priceOverridden` then keeps the quote from writing the figure back, while still refreshing the costs behind it. Clearing the field hands the row back to the quote. A row added with `Add Row` **chooses its own pricing method** from the same six the service form offers, and its Input then asks for whatever that method measures — a quantity, an area, a capacity, a headcount, and nothing at all for Fixed Price. No catalog rate stands behind it, so nothing quotes it -- its Price is whatever is typed into the Price column, which is how such a row comes to count towards the package price at all. A configured row states its method rather than offering it, since the service decides that. **Each row is quoted against a property type its own service covers** (`quotePropertyType`): the first of the package's ticked types the service serves, failing that the service's own first type. Sending the package's first type blindly returned 400 -- "This service is not available for the selected property type" -- whenever no type was ticked yet or the first one did not match, so typing an amount produced no price and said nothing about why. The row therefore carries `applicablePropertyTypes` from the catalog, saved with it so a reopened package still prices. Covered by `packageServicePricing.test.js`.
- **The Internal figures are four cells, each with its label above its value**, not a row of
  label-value pairs. Laid out as pairs they ran together — `Annual Vendor Cost ₹1,200 XLAND Cost
  ₹360 Customer Price ₹1,560 Margin 23.08%` — and which figure belonged to which word was a guess,
  since the gap inside a pair was the same as the gap between them. Two columns on a phone, four
  from `sm`, each a bordered cell; label and value both truncate with a `title`, so a long label
  cannot push a figure out of view. The order is the arithmetic: vendor cost, plus XLAND cost, is
  the customer price, and the margin is what that makes.
- The package form reads **top to bottom**: Applicable Property Types as a full-width card of checkboxes, then Package Configuration, then the Price Summary beneath it — what the package applies to, what is in it, what it comes to. The checkboxes replaced a row of tiles that gated the form until one was chosen. **The Price Summary itself reads left to right: what decides the price, then what it comes to.** Markup (%) and Service Period stack in the left column, in the order they are answered, and a single card on the right states the price, the service count and the Total Rate. The three used to be interleaved across three columns — price, markup, period, then the totals again — so the figures were read before the fields that set them and the same amount appeared twice, a column apart. **The package's own name is not a line of that card**: the field that sets it is directly above the panel, so repeating it said nothing. The service table beneath has the room its Method, Input and Price columns need. Method and Input are **separate columns**: one states how the service is priced, the other takes the amount, so the row sizes its own columns from `PACKAGE_ROW_GRID` rather than dividing twelve. The Price Summary also states what the package costs XLAND — vendor cost, operating cost, customer price and margin — under an Internal heading, since this is an internal screen. Both apply to Admin, Ops Manager and FP only. The blank starter row is dropped when catalog rows are added. It is wired into the admin `AMCPackageManager` (create form and edit modal share one picker) and the FP package form; Manager, Coordinator and Supervisor package forms still have `Add Row` only, and Coordinator/Supervisor would need catalog endpoints before they could have more.
- **A Capacity Slab service shows every slab, wherever it is priced or read.** It is the one method whose price is a table rather than a rate, so showing only the matching band — or nothing, as the pricing dialogs did — leaves the reader unable to see where the boundaries fall or what the next band costs before typing a capacity. **A slab may be named** -- "Small generator", "Bulk tanker" -- in the Slab Name field of the service form; left blank, the range names it as before. `validateService` rebuilds every slab from a whitelist, so the name is listed there or it is dropped on save, trimmed to 80 characters, and wherever a slab is read it is called by its name with the range beside it. **A Capacity Slab service is priced by choosing a slab, never by typing a capacity** -- the slabs are the choices, so offering them beats asking for a number and leaving the reader to work out which band it falls in. `CapacitySlabSelect` in `CapacitySlabList.jsx` is that control, and it is used everywhere such a service takes an amount: the service form's Pricing Preview, the estimate pricing dialog (`ServiceCatalogPicker`), the custom estimate builder, and a package's service row in both package forms. Choosing a slab sets the lowest capacity that lands in that slab and no tighter one (`capacityForSlab`; its lower bound when slabs do not overlap), which is what the server then prices from. **A slab carries its own frequency and visit count, so choosing one takes them with it**, and a package row whose service forbids a frequency change has that dropdown locked: leaving the row on a different frequency had the quote refused with "Frequency override is disabled for this service" and the row stayed unpriced, which is what made a chosen slab produce no price. The row therefore carries `allowFrequencyOverride` and `defaultFrequency` too. A slab with no lower bound entered yet is not offered, because it cannot price anything. Note the consequence: an estimate no longer records the property's exact capacity, only the band it was priced in. `components/estimates/CapacitySlabList.jsx` renders them: range, price per visit, frequency and visits, with the band the typed capacity lands in marked **applies**, and a slab flagged `isCustomQuote` saying so instead of showing a price it has not got. Used by `ServiceCatalogPicker` (customer prices only, like the rest of that dialog) and `CustomEstimateBuilder`. `ServiceCatalogList` keeps its own expandable slab table, which already showed all of them. A package row picked from the catalog carries `capacitySlabs`, which is what fills its own dropdown after saving and reopening. **The package forms are the exception: they list no slab table at all.** Choosing a band in the row's Input column prices it, and that is the whole of the job there — a package is being assembled, not a service configured, so repeating every band of every slab row underneath the table was noise. Do not add it back to `AMCPackageManager` or the FP package form.
- Do not offer Commercial in the service catalog or custom-estimate property selectors. Applicable Property Types offers exactly five values in this order: Gated Community, Apartment, Flat, Villa, Plot. Independent House is withdrawn — `propertyTypeLabel` still resolves it so older services and IH properties read correctly, and a service saved with it shows an amber removable checkbox. `validateService` still accepts `IH` so such a service can be edited and re-saved.
- The catalog offers exactly six pricing methods: Fixed Price, Quantity Based, Area Based, Capacity Based, Capacity Slab and Manpower. `fixed_visit_custom` and `custom_quote` are retired — they are not in the dropdown and `validateService` rejects them, but `calculateServiceQuote` and `methodLabel` still handle them so services and estimate snapshots saved earlier keep pricing and displaying. This is separate from a Capacity Slab row marked `isCustomQuote`, which remains the supported way to require a custom quote for above-range capacity.
- Category on the service form is type-or-select (`AutocompleteInput`, the same control as Zone and City): pick a suggestion or type a new one. It passes `showAllOnOpen`, so clicking the arrow or focusing the field lists every category like a plain dropdown even when a value is already filled in, and typing filters from there. That prop is opt-in, so Zone and City keep their existing filter-as-you-type behaviour. It is validated as text, never against a list, so `saveService` has no "existing category" check. **Enter accepts the word as typed**, with the list open or shut. It used to be handled only while the list was open, so pressing Enter after typing a new category reached the form around the field and submitted the whole service form instead. With something highlighted by the arrows, Enter takes that; with an exact match in the list, it takes that; otherwise it takes what was typed. Suggestions come from `GET <catalog path>/categories` via `backend/utils/serviceCategories.js`, which merges the shared config categories, `admin_categories`, the distinct categories already stored on services in scope, **and those stored on estimates and on AMC package service rows** -- a category typed on a package row was saved and then never offered again until packages became a source — that last source is what makes a typed category reappear in the dropdown, with no effect on work-order categories. A blank category is still rejected.
- **A category typed into the box is saved from the box, and deleted from it.** Every source above is a side effect of saving something else, so a name typed and then abandoned was gone, and a misspelled one that reached a service could never be taken out. `service_categories` (`schema_v38_service_categories.sql`, created on boot beside `service_catalog`) is the one place a category is stored on its own: `POST <catalog path>/categories` writes it, `DELETE <catalog path>/categories/:id` removes it, and `addCategory`/`removeCategory` in `backend/utils/serviceCategories.js` are the only way in. Saving a name the list already offers stores nothing and is not an error — the box ends up holding what was typed, which is all the tick promises. **Only a row of that table that nothing else offers comes back as `removable`**, which is what puts a cross on it: a built-in category, or one a saved service, package or estimate carries, would reappear in the list the moment it was deleted, so deleting it is refused with a 409 rather than silently doing nothing. Scope follows the catalog — `scope_id` 0 is every FP, an FP sees the shared ones and its own, and the admin scope governs all of them.
- The tick and the cross live in `AutocompleteInput` behind `onCreateOption` and `onDeleteOption`: given neither, the control renders exactly as it did, which is why Zone and City are untouched. A save row appears at the top of the dropdown while the typed value is in no option, and Enter presses it. `canManage` on the `GET .../categories` response decides whether the handlers are passed at all — FP staff and the Operations Manager quote from the catalog but do not author it, and the Manager catalog is read-only, so their box has neither control. `hooks/useServiceCategories.js` holds the fetching for both the service form and `CustomServiceDialog`; do not re-implement it per screen. Regression tests: `node --test backend/utils/serviceCategories.test.js backend/routes/fpServiceCatalog.test.js`.
- Service form fields and toggles carry no helper text under them: labels stand alone, and `Field`/`Toggle` accept no `hint`. The word **"Example" is gone from the preview** along with the blue disclaimers that described a configured operating cost no longer collected: the panel is "Pricing Preview", its total is "Customer Price", and its inputs are "Total Area (Sq Ft)" and "Property Area (Sq Ft)". The figures are the service's real configured pricing, which is why they are stated plainly. The amount typed into the preview is still the property's at estimate time, so it is not saved with the service — only the rate, frequency, visits and markup are.
- **Allow Manual Visits is gone.** The frequency states how many visits a year it means, so the count is never typed over it: Default Visits Per Year on the service form, each capacity slab's visits, and Visits Per Year in the catalog pricing dialog and the custom estimate builder are all read-only and derived. The form always saves `allow_manual_visits: false`. The backend keeps the field — `validateService` and `calculateServiceQuote` still read it, which is exactly what enforces "visits must match the frequency" — so do not remove it there; a service saved earlier with it on keeps working until it is next saved. The one place a visit count is typed is a **Custom** frequency, which has no count of its own.
- Allow Frequency Override is **off** on a new service: the configured frequency is what the estimate uses. Turning it on permits a change at estimate time, and that change is still deliberate — the estimate's frequency dropdown stays locked behind an "Override frequency" checkbox in both `ServiceCatalogPicker` and `CustomEstimateBuilder`. Clearing the checkbox restores the service's own schedule (or the matching slab's). `calculateServiceQuote` rejects a changed frequency when the service forbids it, so the lock is enforced server-side too.
- The frequency list is fixed, in this order with these annual visit counts: On Request 0, Monthly 12, Every 2 Months 6, Quarterly 4, Every 4 Months 3, Half Yearly 2, Yearly 1, Weekly 52, Bi-Weekly 26. Note "Half Yearly" has no hyphen. It is defined once per layer — `FREQUENCY_OPTIONS` in `AddServicePage.jsx`, `FREQUENCY_TYPES`/`FREQUENCY_COUNT_MAP` in `estimateStore.js`, and `FREQUENCIES` in `servicePricing.js` — so add a frequency in all three. `Half-Yearly` and `One-time` are retired: not offered anywhere, but still accepted by the validator and resolvable in the count maps so services and estimates saved earlier keep working. Zero visits are valid only for a frequency whose count is zero, and anything dividing a total by the visit count must guard against zero.
- A service stores only its rate. The area, quantity, capacity or headcount belongs to the property and is entered on the estimate through `ServiceCatalogPicker`, which is where the vendor cost is actually computed. Every Pricing Preview therefore takes an editable example amount — area, quantity, capacity, slab capacity or manpower — and shows a dash rather than a figure when the amount or markup is blank, so an example is never mistaken for a real total. **Every whole-number preview input starts at 1** — quantity, capacity, slab capacity and manpower persons — never 10 or 2, so the preview totals read as the configured rate itself; only the area examples start at a realistic property size (10,000 and 1,500 Sq Ft).
- Every method's configuration section uses the same three-column grid: the vendor rate, Default Frequency and Default Visits Per Year on the first row, then Allow Frequency Override and Allow Manual Visits together on the row below, never mixed in with the fields. Capacity Slab has no service-level rate, so its first row is just frequency and visits. Markup and the manpower detail rows share the same columns so everything lines up.
- All pricing methods belong in the same Add Services form. The Pricing Method selector is a visible row of buttons in Basic Information — one per method, the active one highlighted — so the form is never mistaken for a single-method screen. **No method is preselected:** a new service opens with none chosen, the configuration, unit, markup and preview sections stay hidden behind a prompt, and Save Service is disabled until a method is picked. Editing an existing service selects its saved method. Selecting a method swaps the configuration section, unit list, section tabs, heading and preview. A service saved with a retired method shows an extra disabled amber button instead of silently matching nothing. Area Based and Capacity Based group their per-unit vendor rate, default frequency, visits, and override controls together; keep Default Markup separately. Do not display Formula Preview or the "How Area Based Works" / "How Capacity Based Works" boxes. Example pricing must be clearly distinguished from final estimate pricing, which includes XLAND operating costs. Capacity Based uses rate × total capacity × visits, independently of Capacity Slab pricing.
- Quantity Based uses vendor rate per unit × whole-number quantity × visits. Keep its rate, frequency, visits and override controls together, with Default Markup separately and a clearly labelled quantity example. Support Camera alongside the existing quantity units and apply the same exclusions as the other methods, including no Formula Preview or how-it-works box.
- Fixed Price uses a fixed vendor rate per visit × visits, with the rate and frequency controls grouped together and Default Markup separate. Its example preview has no area/capacity input. Fixed Price and Capacity Slab follow the same exclusions: no minimum-margin fields/approval, Tags, Included/Excluded section, Commercial, Formula Preview, or how-it-works boxes.
- New Manpower services use `manpower_basis: per_visit`; existing records without a basis keep their monthly calculation. Optional `manpower_ranges` automatically select the per-person rate from whole-number Sq Ft ranges and suggest the recommended minimum headcount. Ranges may overlap, leave gaps or start anywhere; an area takes the **tightest** range containing it (`narrowestRange` in `servicePricing.js`, mirrored by `admin-portal/src/utils/rangeMatch.js`), and an area no range covers falls back to the service's base `rate_per_person`. Only an inverted range (upper below lower) or a recommended max below its min is rejected. Headcount remains editable subject to `minimum_manpower`; recommended min/max values are guidance. Included working hours do not multiply the base visit rate; optional overtime is extra hours per person per visit. Keep the same UI exclusions as other pricing methods, and retain manpower basis, role, area range, headcount, and hours in saved snapshots and customer-safe service descriptions.
- **What XLAND takes is a margin, not a separate cost.** A vendor rate of ₹1,000 a visit at 35% earns ₹350, and the customer pays ₹1,350: `XLAND Margin = vendor cost × markup %` and `Customer Price = vendor cost + XLAND Margin`. It is called **XLAND Margin** on every service-side screen — the Add Service form field, all three Pricing Previews, and the Configured Services table with its slab dropdown. So a service configures only the vendor rate per method and `default_markup_percentage`; the form has no operating-cost input and always saves `default_operating_cost: 0`, showing the margin read-only instead. Capacity Slab shows no XLAND field at all, since it prices from its slabs. The Configured Services table derives XLAND Margin and Customer Price by scaling the vendor rate, which is why both work without a quantity.
- The arithmetic is unchanged, only the naming: with the operating cost at zero, `calculateServiceQuote` already returns `totalPrice = vendorCost × (1 + markup/100)` and a `profit` equal to the XLAND cost, which is what every preview now labels. `calculateServiceQuote` still honours `input.operating_cost ?? config.default_operating_cost ?? 0`, so a service saved before this change keeps pricing until it is re-saved, and the estimate-side inputs in `ServiceCatalogPicker` and `CustomEstimateBuilder` can still override it — leave them at zero or the customer price stops being vendor + markup. `ServiceCatalogPicker` quotes on the server as the inputs change (400ms debounce), which is what makes those values appear by themselves, and a test asserts `previewManpower` equals the backend quote.
- **Adding a configured service to an estimate happens in a dialog.** `ServiceCatalogPicker`'s panel holds only the dropdown; choosing a service opens a modal (`fixed inset-0 z-50 … bg-black/50`, the same shell as the other estimate dialogs) carrying the service name, method badge, its pricing inputs, the live server quote and a footer with Cancel and **OK**. OK adds exactly one row to the estimate's service table and closes. The dialog reports **only the Customer Price, in green** — vendor cost, operating cost, actual cost, markup and margin stay out of it; Cancel, the X and Escape leave nothing behind, so a service that was only being looked at is never half-added. OK stays disabled until the priced input (area/quantity/capacity/headcount, plus a required custom quote) is filled. Pricing errors surface inside the dialog; only a catalog load failure shows on the panel.
- Eight fields are common to **every** pricing method and must stay that way: Service Name, Category, Pricing Method, Unit (labelled "Capacity Unit" for Capacity Based and Capacity Slab), Primary Input, Default Markup Percentage, Applicable Property Types and Description. The unit list follows the method and its first option is selected when the method is picked, so the unit is never left stale.
- **The unit master is Unit Type + Unit Name.** `UNIT_TYPES` lists every unit under exactly one type — Count / Quantity, Area, Capacity, Manpower, Time / Billing, General — and `METHOD_UNITS` gives each pricing method the types it actually measures, so Area Based offers only area units and Manpower only headcount and billing units. It is defined twice, in `backend/utils/servicePricing.js` (which validates the unit on save) and `admin-portal/src/utils/estimatePackageUtils.js` (which feeds the dropdown through `unitOptionsFor` and `unitGroupsFor`, grouped under the type labels); add a unit to both or the form will offer one the API rejects — a test compares them. Fixed Price is the one method with an explicit list rather than whole types: it bills per Visit, Service or Job, because its unit is also its Primary Input. `Persons` is a capacity rating (a lift rated for 10 persons) and stays under Capacity; a headcount is `Person` under Manpower. The plural labels `Units`, `Lifts`, `Pumps`, `Tanks`, `Acres`, `Liters`, `KW`, `Guards` and `Personnel` are retired — absent from the dropdown but still accepted by `validateService`, the same way retired frequencies and methods are, so a service saved earlier stays editable. The form keeps an out-of-list unit selectable, marked "(no longer offered)", so editing such a service never silently changes it.
- **Primary Input is derived, never stored and never typed in.** The pricing method says what is measured and the service name says what it belongs to: "Generator" priced by capacity reads `Generator Capacity`, "Landscape" priced by area reads `Area`, Manpower reads `Headcount`, and a Fixed Price measures nothing so its billing unit (Visit / Service / Job) is the input. Capacity and Quantity are qualified by the service name because they do not say what is measured on their own; Area, Headcount and Visit already do, and the name is never repeated ("Generator Capacity", not "Generator Capacity Capacity"). It is computed by `primaryInputLabel` in `backend/utils/servicePricing.js` and its twin in `admin-portal/src/utils/estimatePackageUtils.js` — change both, a test compares them. The Add Service form shows it read-only; there is still no editable Primary Input field, Service ID, Status or Service Code.
- **The Configured Services list is a table**, one row per service: `#`, Service (name over category), Method, Input / Details (the derived primary input over that method's vendor rate), Frequency, Visits / Year, Markup %, Property Types, Scope, and Edit / Delete actions. It does not repeat an Add Service button, because the list sits on the Add Service screen, and a row no longer expands into a detail panel — the full configuration is one click away in Edit. Cost columns belong to an estimate, not here: a configured service has a rate but no quantity, so it has no vendor cost, customer price or margin until an estimate supplies the measured amount.
- Delete is a **hard delete** of the `service_catalog` row: `DELETE <catalog path>/:id`, admin-only on the admin path, restricted to an FP's own services on the FP path (scope 0 stays read-only), and 403 on the manager path, which is read-only throughout. No table references `service_catalog` and every saved estimate carries its own `pricingSnapshot`, so a deleted service leaves existing estimates pricing and reading exactly as before — it simply cannot be added to a new estimate. Actions are shown by the same `canEdit` predicate the host passes in, so whoever may edit may delete.
- One string describes a configured service everywhere it is read: `serviceDetails`/`details` from `normalizeEstimateService` (backend) and `getServiceDescription` (frontend, which returns the saved `details` when present). It carries Category, Pricing Method, `Primary Input: …`, the measured amount with its unit (or `Unit: …` when nothing is measured, as on a Fixed Price), the matched slab, the manpower basis/role/area/range/hours, and `Property Types: …`. That one string is what reaches every view modal, the frontend PDF exports, the customer email body and the email PDF attachment, so extending it is how a field reaches all four at once. Both twins must produce identical output.
- **Three of those segments are internal and never reach a customer: the Pricing Method label, `Primary Input: …` and `Property Types: …`.** How a service is billed, its derived input and the property types it is *configured* for are ours; the customer reads the service, its category, its schedule and what was measured at their own property. `customerServiceDetails` in `backend/utils/estimateData.js` filters them out of the finished line — so an estimate saved with them already in its `details` is cleaned on the way out too — and `normalizeEstimateService` exposes the result as `customerDetails`. `customerEstimateData` projects `customerDetails`, which is what the email body and the email PDF attachment print; the staff portals keep reading `details`. Markup stays out of both. `estimateDelivery.test.js` asserts the segments are absent from the email and the attachment, and `estimateData.test.js` asserts it for every pricing method.
- **The category is printed with the service name, not in its description.** It says what kind of service this is, so `customerEstimateData` carries it as its own `category` field and `customerDetails` leaves it out of the line: the email prints it under the service name and the PDF draws the Service cell as the name with the category beneath it. The Description column is then the description and the measured amount only. The frontend custom-services table already reads this way, with category, quantity and "No vendor" under the name.
- Saved estimates already hold every one of those fields: all three write paths store `pricingSnapshot: { ...config, ...quote }`, the full validated configuration. Read them from the snapshot; do not add new columns or ask the picker to resend them.
- **Default Markup is internal.** It may appear on the FP, Super Admin and Manager screens only — read it with `getServiceMarkup` — and must never reach a customer email, a customer PDF or `customerEstimateData`. Keep it out of the details line, which is customer-facing. Coordinator, Supervisor and Executive do not show it.
- Every pricing method carries three toggles, in this order: Allow Frequency Override, Allow Manual Visits and **Do Not Assign Vendor**. The third is about the vendor arrangement only, never about the service: switching it on leaves the service listed, quotable, priced and printed exactly as before, and only stops a vendor being assigned to it and visits being scheduled for it. It is `skip_vendor_assignment` inside the existing `configuration` JSON, so there is no migration; absent means off, which is how every service saved before it behaves.
- **The toggle belongs to the Add Service form and nowhere else.** It is set and read only there — no other screen shows it, labels it, or asks about it: not the Configured Services list, not the estimate service picker, not Pending Property Schedules, and not Create Estimate. Its effect is enforced entirely on the server, so a service simply stops appearing as work awaiting a vendor rather than being badged as excluded.
- The flag is enforced through `backend/utils/vendorlessServices.js`, resolved **by service name** because that is the only key the scheduling module has (`property_vendor_assignments.service_type`, `property_service_schedules.service_name` and the estimate service rows all hold a name, not a catalog id). It is applied in `mapPendingServices`, in all three Pending Property Schedules feeds (`utils/pendingProperties.js`, `routes/admin.js`, `routes/schedules.js`), in the property services feed the scheduling screen reads, and in `applyEstimateVendorAssignments`, which refuses to attach a vendor to such a service even if the estimate form sent one. Each row reports `vendorRequired`, and `pendingServices` is counted from those rows so a property is never held open waiting for a vendor that is never coming. A catalog read failure resolves to an empty set and one unreadable `configuration` row is skipped on its own, so scheduling continues as before rather than silently losing vendors.
- **The estimate's own Vendor Required answer outranks the service's flag, and it is the same one flag.** Vendor Required is settled per estimate on a **hand-entered** service only — `CustomServiceDialog` — which saves it as `skip_vendor_assignment` on the estimate row. A catalog service never asks: the configured-service pricing dialog carries no Vendor Required toggle and no Category dropdown for any method, Quantity Based included, so such a row takes the service's own configuration. `serviceRowNeedsVendor(row, vendorlessNames)` in `vendorlessServices.js` is what the scheduling feeds call: an answered row decides **in both directions** — the same service can need a vendor at one property and be arranged without one at another — and only an unanswered row falls back to the service's configuration, which is how every estimate saved before the question existed keeps behaving. Call it, not `serviceNeedsVendor`, wherever an estimate service row is in hand: `mapPendingServices` (which the FP, Manager, Coordinator, Supervisor and admin feeds all share) and both scheduling feeds in `routes/schedules.js`. `serviceNeedsVendor` stays for the name-only callers.
- Tests: `node --test backend/utils/vendorlessServices.test.js` (mocked database; scope, name matching, fail-open, the pending row counts, and that a row's own answer wins over the configuration in both directions) plus the "arranged without a vendor" case in `servicePricing.test.js`, which checks the toggle exists on all six methods, defaults to off, rejects a non-boolean, and does not change pricing.
- There is no minimum-margin field, threshold, approval rule, or save restriction. Profit and actual margin are informational only.
- Service pricing: vendor cost + XLAND operating cost = actual cost; apply markup to actual cost. Margin is profit divided by customer price, not markup percentage.
- A new service is never pre-filled with invented data: no sample capacity slabs or rates (the table starts as one empty row), no default markup, no default working hours. Only structural defaults remain — frequency and its matching visit count, which a select must hold, and a minimum manpower of 1, which is the lowest value the validator accepts. Adding a slab continues from the previous row only when that row holds a real number; otherwise it adds another empty row.
- **Capacity slabs carry no range restriction.** They may overlap (0–3, 0–6, 0+), leave gaps, start at any number, and an open-ended slab may sit in any row; the only rejected slab is an inverted one (upper below lower). A capacity is priced from the **tightest** slab containing it, so cumulative bands resolve correctly whatever order they are entered in — the server (`narrowestRange` in `servicePricing.js`, also used by `estimateData.js`) and the client (`utils/rangeMatch.js`) make the same choice. A capacity that falls in a gap, or above every bounded slab with no open one, requires a custom quote; one below the lowest slab is refused. **Choosing a slab must not set its lower bound as the capacity**: overlapping slabs share one (0–3, 0–6, 0+ all start at 0), so every choice resolved back to 0–3. `CapacitySlabSelect` keys its options by position and sets `capacityForSlab(slabs, slab)` from `utils/rangeMatch.js` — the lowest whole capacity whose tightest slab is the chosen one (0, 4, 7 above) — and the service form's preview does the same. Regression test: `node --test admin-portal/src/utils/rangeMatch.test.js`, which also checks the server prices the slab chosen. Regression test: `node --test backend/utils/servicePricing.test.js`.
- Capacity Slab uses a per-row vendor rate, `defaultFrequency`, and `defaultVisitsPerYear`; estimates use the matching slab's schedule before applying permitted overrides. Older slabs without these fields fall back to service-level defaults. Slab configuration is stored in the existing JSON, so no schema migration is needed. Keep the slab table and editable-capacity example preview in Add Services, without a "How Capacity Slab Works" box.
- Custom estimates do not require an AMC package. The internal service table may show vendor costs, operating costs, customer prices, and margin; customer previews must not expose internal costs or profit.
- **Every create-estimate form opens with the same Estimate Structure choice** — `components/estimates/EstimateStructure.jsx`, two tiles: Select AMC Package or Build Custom Services — wired into FP (property-based and direct), Manager, Coordinator, Supervisor and Executive, with the admin `CreateEstimate.jsx` keeping its own equivalent. Build Custom Services shows `CustomServicesTable.jsx`, whose last row is always empty and is where a free-text service is entered (Service, Input / Details, Frequency, Visits / Year, Customer Price, then Add Service). There is no Method, Vendor Cost, Margin or Import Services: a custom row has no configured rate behind it, so its customer price is typed in. Switching structure clears the other choice's data. `isManualService` / `normalizeManualService` in `backend/utils/estimateData.js` validate these rows on save, and the FP and Manager `validatePackageEstimate` middlewares add them to the server-computed subtotal while leaving their prices alone. Details are in `.devin/rules/estimates.md`.
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
9. `migrations/schema_v36_razorpay_payment_unique.sql` - **Required for online payments**: unique index on `payments.razorpay_payment_id`, which is what keeps two webhooks racing each other from recording the same payment twice

### Recording an Online Payment

- **`backend/services/razorpayPayment.js` is the only thing that writes a paid Razorpay invoice.** Three events announce one payment — the `payment_link.paid` webhook, the `payment.captured` webhook, and the customer's redirect to `/payment/success` — so `recordRazorpayPayment()` is idempotent on `razorpay_payment_id` and every caller may fire it. Do not add a fourth hand-written INSERT; that is how the previous three drifted apart.
- The callback fallback in `POST /api/razorpay/verify-payment-callback` existed for exactly this and never worked: it selected `invoices.balance_due` / `paid_amount` and inserted `payments.notes` / `created_by`, none of which exist (the columns are `balance_amount`, `amount_paid`, `remarks`, `received_by`), and every failure was swallowed behind `success: true`. Card payments were therefore only ever recorded if the webhook fired. When touching this code, check column names against the database, not against the surrounding code.
- The callback never trusts its query string: the signature is verified when present, and the amount and `captured` status are re-read from the Razorpay API before anything is written.
- Use **this** payment's amount (`payment.entity.amount`), never the link's `amount_paid`, which is cumulative and double-counts a second partial payment.
- Every Razorpay payment writes `payment_history.action = 'razorpay_payment'`. The Razorpay tab used to filter on that string while the webhook wrote `'paid'`, so it was always empty; both filters now match on `razorpay_payment_id` so older rows still appear.
- `PAY-`/`RCP-` numbers come from `backend/utils/paymentIds.js`, shared with `routes/payments.js`, so an online payment is numbered like every other one.
- **`Data truncated for column 'action' at row 1` (errno 1265) means v22/v27 were never applied to that database.** `payment_history.action` is still `schema_v17`'s `ENUM('created','updated','status_changed','refunded','deleted')`, so every value the Razorpay handlers write — `razorpay_payment`, `paid`, `failed`, `refund` — is rejected. The insert sits inside the payment transaction, so the whole thing rolls back and **the payment is not recorded at all**, while the webhook returns 500 and Razorpay retries forever. This is the first thing to check when online payments are missing but the webhook is clearly firing; the fix is `ALTER TABLE payment_history MODIFY COLUMN action VARCHAR(50) NOT NULL DEFAULT 'created'`, which is what `migrations/schema_v27_payment_history_action_fix.sql` does.
- **`RAZORPAY_WEBHOOK_SECRET not configured - webhook signature not verified`** is not cosmetic: with the secret unset the handler skips verification entirely and accepts any POST to `/api/razorpay/webhook`, so anyone who knows the URL can record a payment that never happened. Set it on the server and restart.
- **`razorpay_webhooks.event_id` is `<event>:<entity id>`, not the entity id alone.** Keyed on the entity id, `payment.captured` and `payment_link.paid` for the same payment collided on the unique index, so the second event updated the first's row instead of inserting — which made `payment_link.paid` look as though it never arrived. Razorpay's `x-razorpay-event-id` header is used when present. For the same reason the row id is re-read with a `SELECT`: on the duplicate-key path `insertId` is 0 and `affectedRows` is 2, so the old `insertId || affectedRows` marked **row 2** processed, an unrelated payment's row.
- **A stored webhook can be replayed**: `node scripts/replayRazorpayWebhooks.js` lists what was received but never processed, `--apply` runs it through the same dispatcher a live delivery uses. Safe to repeat, since recording is keyed on `razorpay_payment_id`. This is how payments are recovered after a failure that rolled the transaction back, since Razorpay only retries for a limited window.
- If online payments stop appearing, check `SELECT event_type, status, error_message FROM razorpay_webhooks ORDER BY id DESC` first. Note `received_at`/`processed_at` — there is no `created_at` on that table. No rows at all usually means the webhook is registered in the wrong Razorpay mode — **test and live mode have separate webhook configurations**, and a test payment never reaches a live-mode webhook.

### Cheque Payments

- A cheque keeps its own columns; do not smuggle its fields into `transaction_reference` or concatenate them into `remarks`. `POST /api/payments/payments` writes them and the payments list returns them, which is what lets the verification modal prefill what was recorded instead of asking for it twice.
- `transaction_id` was written by `PUT /api/payments/:id/verify` before any schema file created it, so verifying a payment failed with "Unknown column 'transaction_id'". It is created by v31.
- The bank list, the default payee (`XLAND INFRA PM SERVICES PVT LTD`, prefilled but always editable) and the payment-location label live once in `admin-portal/src/utils/chequePayment.js`. Both cheque screens — recording in `billing/MakePayments.jsx` and verifying in `billing/Payments.jsx` — import them, so they cannot offer different banks. Choosing "Other" reveals a text field; the word "Other" is never stored as the bank name.
- `mysql2` returns a DATE as a `Date` at local midnight, so `JSON.stringify` moves it to the previous day anywhere east of Greenwich. Map date-only columns through the `dateOnly` helper in `backend/routes/payments.js`.
