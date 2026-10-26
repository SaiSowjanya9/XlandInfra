# Coordinator Portal — Audit Report

**What this covers:** every item in the Coordinator portal's left-hand menu, checked from the
screen, through the server, down to the database. Where something was broken I have explained what
a coordinator would have seen, and what I changed.

## Important: how this audit was done

The automated environment for this audit **would not let me run any programs**: no server, no
`curl`, no database client, no automated tests and no frontend build. I could only read and edit
files. So:

- Everything below comes from **reading the code carefully** and tracing each screen to the server
  route and SQL it uses. **Nothing was clicked through or run against the local database.**
- I created **no** test data (`TEST-COORD-…`) and deleted nothing.
- **Before these fixes go live, someone needs to run the checks listed at the end** (start the
  server, try each screen, run the tests and the build). I kept each fix small and in the same
  style as the code around it, but none of it has been executed.

## Who uses this portal

Coordinators sign in on the normal Employee login page. There are two kinds:

- **Coordinators who belong to a franchise partner (FP)** — the normal case. They see the
  partner's data for their assigned zones, plus whatever they created themselves.
- **"Standalone" coordinators** (no franchise partner). The menu is the same apart from Marketing,
  but most screens show them very little (see "Needs a decision" below).

---

## Menu item by menu item

### 1. Dashboard
**What it does:** headline counts (properties, vendors, work orders, estimates), a work-order pie
chart and an estimates overview.
**What I checked:** the five data requests behind the page and the SQL behind each one.
**Status:** works. One fault was hidden in the server's answer: the "estimates by property type"
and "estimates by status" figures always came back as **zero**, because the database query named a
column that exists in three of the tables it joins, and the database refused it as ambiguous. The
page does not draw those two figures today, so nobody saw wrong numbers on screen, but the data was
wrong. **Fixed.**

### 2. Add Customer
**What it does:** adds a property, plus the customer's portal login.
**What I checked:** the form's request, the server route, and the "one email = one customer
account" rule (new / not yet activated / already activated).
**Status:** looks correct. It follows the agreed rule for all three cases.
**Not testable here:** the activation and "you've been added" emails (email is not set up on local
machines).

### 3. Property Management
**What it does:** lists properties, lets you view and edit them, and shows their estimates and
vendor assignments.
**What was broken (fixed):**
- **Saving an edit failed for every property created in the portal.** The edit window always sends
  "Active/Inactive", and the server tried to write it to a database column (`is_active`) that the
  property table doesn't have. The coordinator just saw "Failed to update property".
- **Inactive properties showed as "Active" in the edit window**, so saving any change (even a
  phone number) quietly made an inactive property active again. The window now reads the real
  status.
- **Security gap:** a coordinator could edit *any* property in the system if they knew its number,
  including another franchise's. Edits are now limited to the coordinator's own franchise (or, for
  a standalone coordinator, the properties they own).
- The "assign vendor / assign employee" buttons sent their request to the wrong web address
  (missing the server address), which would fail on the live site. Fixed. Note that the server
  deliberately refuses both actions for coordinators anyway, so the coordinator will see "not
  allowed for this role".

### 4. Work Orders
**What it does:** list, create, view, edit, change status, assign a vendor or employee, delete.
**What was broken (fixed):**
- **Edit (pencil icon) never worked.** The window saved to a server address that didn't exist, so
  every edit failed with "Failed to update work order". I added it, matching the Manager portal's.
  Marking a job **Completed** from the edit window is refused with a clear message. Completing has
  to go through the normal Completed action so the closing notes are recorded, the customer is
  emailed and the invoice is raised. Closed is never offered to coordinators.
- **Assign Employee always failed.** The server wrote to a database column that nothing creates.
  The server now adds the column if it is missing, checks the employee belongs to the same
  franchise, and only moves a *pending* job to "Assigned" (a job already in progress keeps its
  status).
- **Delete always failed** for the same reason (a missing "deleted at" column). Fixed. Note: for a
  coordinator, "delete" **cancels** the work order (it stays in the list as Cancelled), even though
  the message says "deleted". That has always been the intent. Whether coordinators should be able
  to really delete is your call.
- The assign button sent its request to the wrong web address (same issue as above). Fixed.
**Not testable here:** the "work order created/completed" emails.

### 5. Estimates / AMC
Sub-items: Dashboard · Create Estimate · All Estimates · AMC Packages · Add Service · Archived.

- **Dashboard did not open at all.** Clicking it bounced you back to the main coordinator
  dashboard, because the page was never connected for coordinators. **Fixed.** It now opens the
  shared Estimates dashboard showing the coordinator's own estimates.
- **Create Estimate / All Estimates / Archived:** creating, listing, archiving and restoring look
  correct.
  - **Fixed:** estimates were often credited to plain "Coordinator" instead of the person's name,
    because the name lookup asked for a column that doesn't exist. A second problem: it could pick
    **another employee's** name, because it confused two different ID numbers. It now finds the
    right person.
- **Editing a direct estimate wiped its services (fixed, important).** The edit window only knows
  about the old "add-on" list. Saving an estimate built from **custom services** or **configured
  services** erased those services and recalculated the total without them, often to ₹0 before
  GST. The edit window now keeps those services and their prices unchanged.
- **AMC Packages / Add Service:** for franchise coordinators these are read-only lists of the
  partner's packages and services. That works. Creating them is refused by design.
  - For **standalone** coordinators, both lists failed with an error if their tables were never set
    up, and that error blanked the whole Estimates screen. They now show an empty list instead.
    Their "create" requests also had mismatched fields, which lost the price and name and broke the
    database insert. I fixed the field matching. This is a rarely used path and still depends on
    the old tables existing (see "Needs a decision").

### 6. Schedules
Sub-items: Dashboard · All Schedules.
**What it does:** read-only view of upcoming and past service visits for the franchise.
**Status:** works. **Small fix:** if the coordinator's login token didn't carry the franchise
number, the schedules list and its vendor filter came back empty, while the services filter
worked. They now use the same fallback as the services filter.

### 7. Vendor Management
Sub-items: Add Vendor · Vendor Details · Assigned Vendors.
**Status:**
- **Add Vendor** — looks correct.
- **Vendor Details** — lists the vendors in the coordinator's zones plus the ones they created.
  Editing and deleting vendors is refused by design ("not allowed for this role"). The save button
  sent its request to the wrong web address on the live site. **Fixed.**
- **Assigned Vendors** — read-only list. Looks correct.

### 8. Employee Zone Management
**What it does:** read-only list of the franchise's employees and the zones each one covers.
**Status:** looks correct for franchise coordinators. The Add/Edit buttons are refused by design.
The save button's web address had the same live-site issue. **Fixed.**

### 9. Marketing (franchise coordinators only)
Sub-items: Dashboard · Tracker · Complaint Form · Archived.
**What it does:** read-only view of the partner's sales pipeline. A coordinator can only tick
"Coordinator Reviewed" and write the report note on complaints assigned to them.
**Status:** these are the shared Marketing screens and server, used by six portals and covered by
their own automated tests. I found nothing coordinator-specific to fix.
**Not testable here:** the complaint emails.

---

## Still broken or needs your decision

1. **Coordinators may see every estimate in the franchise, not just their zones.** The estimate
   list is meant to show "my zones + what I created". But one part of the filter compares against a
   name that is always blank, and a blank comparison matches *everything*. So every coordinator
   probably sees all of the partner's estimates. The same pattern is in the Manager, Supervisor and
   Executive portals. Fixing it will make some estimates disappear from people's lists, so it's a
   business decision. I did not change it.
2. **Standalone coordinators (no franchise partner) are half-supported.** Their estimate list is
   always empty, yet an estimate they create is filed under **franchise partner #1** (another
   partner's data). Their employee list relies on a table that may not exist. The same "#1" fallback
   is in the Manager, Supervisor and Executive portals. You need to decide whether standalone
   coordinators should exist at all. If not, block them at login. If yes, they need proper support.
3. **"Delete" on a work order only cancels it** (see Work Orders). Decide whether that's right.
4. **Billing pages** are reachable by typed web address but are not in the coordinator menu, and
   the server refuses coordinators. That matches the earlier decision documented in `AGENTS.md`.
   No change.
5. **Couldn't check against the real database:** a few columns used by these screens are created
   outside the repo's numbered migrations: the vendor `company_name`, the work order
   `closing_notes`, and the zone table's `coordinator_id`. If any is missing on a deployment, the
   matching screen would fail. Please confirm against the live database.
6. **Emails and Razorpay** can't be tested on a local machine (not configured). This covers
   activation, work-order and complaint emails.

## What needs to be run before release

Start a local server on a spare port, sign in as a coordinator, and try each item above. Then run:

- `node --test backend/routes/staffServiceCatalog.test.js backend/routes/marketing.test.js backend/utils/workOrderId.test.js backend/utils/customerPropertyLink.test.js`
- `cd admin-portal && npx vite build --outDir /tmp/build-coord` (checks the screens still compile)

---

## Technical appendix — files changed

**backend/routes/coordinator.js** (coordinator-only router)
- `GET /dashboard`: prefixed `estimate_type`/`property_type`/`status` with `fe.` in the two
  estimate-breakdown queries (they were ambiguous against `properties`/`onboarded_properties`).
- `PUT /properties/:id`: `isActive` now maps to `status` (`active`/`inactive`) for both tables, and
  `is_active` was removed from the `properties` whitelist. The UPDATE is scoped by
  `franchise_partner_id` (or `coordinator_id` when standalone) and returns 404 when no row matches.
- New `PUT /work-orders/:id`, modelled on the Manager route. ENUM values are whitelisted,
  `completed` is refused (it must go through `PATCH …/status`), and `closed` is never accepted.
- `PATCH /work-orders/:id/assign-employee`: validates the employee against `fp_employees` in the
  same FP. Ensures `work_orders.assigned_employee_id` via an `information_schema` check (same
  approach as the Manager route, and the Manager agent's planned `schema_v57`). The status changes
  only from `pending`/`requested`.
- `DELETE /work-orders/:id`: dropped the non-existent `deleted_at`. Still a soft cancel.
- `POST /estimates`: the creator name is resolved with `resolveFpEmployee` (user_id, then
  email/username) instead of `fp_employees.id = users.id`. The `users` fallback no longer selects a
  `name` column.
- `GET /schedules/all` and `GET /vendors?forSchedules=true`: fall back to `req.franchisePartnerId`.
- `GET /amc-packages`, `GET /addons`: return an empty list on `ER_NO_SUCH_TABLE`.
  `POST /amc-packages` and `POST /addons` (standalone only): accept the form's `price`,
  `property_type` and `service_name`, and stop naming the non-existent `franchise_partner_id`.

**admin-portal/src/App.jsx** (shared): added
`/coordinator/estimates/dashboard → <EstimatesDashboard portalType="coordinator" />`.

**admin-portal/src/pages/EstimatesDashboard.jsx** (shared): added `coordinator: 'coordinator'` to
the API path map. Other portals are unaffected.

**admin-portal/src/pages/CoordinatorEstimates.jsx**: the direct-estimate edit keeps the
custom/catalog rows (`customService`, `catalogServiceId`, `CUSTOM-`/`CAT-` ids) in `addons_data`,
decoded with `decodeDeep`, and adds their `totalPrice` to the subtotal.

**admin-portal/src/pages/CoordinatorProperties.jsx**: the edit modal's Active/Inactive is read from
`status`, and the assign request uses `API_BASE`.

**admin-portal/src/pages/CoordinatorWorkOrders.jsx, CoordinatorVendors.jsx,
CoordinatorEmployees.jsx**: the relative `fetch(url)` calls now use `${API_BASE}`.

No migrations were added and no database changes were made.

---

## Verification update (done afterwards by the coordinating agent)

The audit agent above could not run programs, so every fix was then checked for real on the local copy of the system:

- **Automated checks:** all 491 built-in tests pass (0 failures). Both websites (the staff portals and the customer portal) build without errors.
- **Live check:** the backend was started with all fixes, and each portal was logged into as its own role (admin, ops manager, franchise partner, manager, coordinator, supervisor, executive and a test customer). Every page-loading request in each portal's sections was called: **no server errors and no login failures** in any portal.
- **Security checks confirmed:** visitors who are not logged in are now turned away from work orders, vendors, dashboard figures and property lists. A staff login can no longer open customer data. The Ops Manager is blocked from deleting properties.
- **Two more problems found and fixed during this check:**
  1. **Franchise Partner → Add-ons** failed to open and add-ons could never be created, because the database table was missing several fields. It is now repaired automatically when the server starts, with a database update script (`schema_v58_fp_addons_drift.sql`). Creating, editing and deleting an add-on now work.
  2. An unused admin "employees list" request pointed at a table that doesn't exist. It now uses the correct one.
- **Database updates applied locally:** `schema_v57_work_order_assigned_employee.sql` and `schema_v58_fp_addons_drift.sql`. **Both need to be applied on the live server when this is deployed.**
- **Still not tested:** emails and Razorpay payments, which have no settings on this local copy. Screens were not clicked through in a browser, so a quick look through each portal before going live is still worth doing.
