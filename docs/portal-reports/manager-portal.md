# Manager Portal – Audit Report

**What this covers:** every item in the Manager portal's left-hand menu, checked from the screen
through to the database.

## First, an important limit on this audit

This audit ran in a restricted mode. **I was not allowed to start the server, open the database, run
the automatic tests or build the website.** Every command of that kind was blocked. So:

- I could not log in as a manager, create `TEST-MGR-` records, or click through the screens with
  real data.
- Everything below comes from **reading the code line by line**. For each menu item I followed the
  screen to the server address it calls, and checked the database columns it uses against the files
  that create the database.
- The fixes are small and follow patterns that already work elsewhere in the app. But none of them
  has been run yet. **Before going live, someone needs to start the server, try each screen marked
  "Fixed" below, and run the checks listed at the end.**

No test data was created, so there is nothing to clean up.

---

## Menu item by menu item

### 1. Dashboard
**What it does:** shows the manager's headline numbers (properties, vendors, customers, work orders,
estimates), the recent work orders, and a bell that warns about closed work orders that will soon be
deleted automatically.

**What was wrong:**
- **The warning bell never worked.** The menu and the dashboard both ask the server for "work orders
  about to be deleted", but that request did not exist for managers. The bell always stayed empty, so
  a manager was never warned before a closed or cancelled work order disappeared.
- **The Vendors number was always 0** (same cause as the Vendor Details problem below).

**Fixed:** added the missing "about to be deleted" request for managers. It only shows the manager's
own franchise's work orders.

### 2. Add Customer
**What it does:** creates a property and its customer, and emails the customer an activation link.

**Result:** the code looks correct. It follows the agreed "one email, one customer account" rules.
The database columns it writes are all created when the server starts.
**Not testable here:** the activation email itself, because email is not set up on this computer.

### 3. Property Management
**What it does:** lists the manager's properties, lets them edit one, view its vendors and assign
vendors to its services.

**What was wrong:**
- **Saving an edited property and "Assign" went to the wrong website once live.** Those two buttons
  used an incomplete web address. On the live site they would have sent the request to
  `admin.xlandinfra.com` instead of the server, so the save quietly failed.
- **The Zone drop-down in the edit form saved a number instead of the zone's name.** Picking a zone
  could also create a junk zone called something like "3".
- **The vendor list inside this screen was empty** (same cause as Vendor Details below).

**Fixed:** all three.

### 4. Work Orders (Dashboard, All Work Orders)
**What it does:** lists work orders and lets the manager create, view, edit, change status, assign a
vendor or an employee, and delete.

**What was wrong:** four of the buttons on every work-order row did nothing useful:
- **Edit:** the server had nothing behind it, so every edit failed with an error.
- **Assign Employee:** nothing behind it on the server, the address was incomplete, and the database
  had nowhere to store the assigned employee.
- **Delete:** nothing behind it on the server, so delete always failed.
- **Assign Vendor:** worked on the server, but used an incomplete address, so it would fail on the live site.
- **Editing a description with a "/" or "&" in it** would have garbled the text a little more on
  every save.

**Fixed:** all of the above. A manager can only edit, assign or delete work orders that belong to
their own franchise (or that they created themselves, for a manager with no franchise). Assigning an
employee moves a pending work order to "Assigned" but never moves a finished one backwards.

**Needs a decision:** the delete is permanent, exactly like the Franchise Partner portal. If managers
should not be able to delete work orders at all, tell us and we will remove the button and refuse it
on the server.

### 5. Estimates / AMC (Dashboard, Create, All Estimates, AMC Packages, Add Service, Archived)
**What it does:** create and send estimates, view packages and services, archive old estimates.

**What was wrong:**
- **"Archive Selected" on All Estimates always failed:** there was nothing behind it on the server.
- **Managers could see estimates outside their zones.** The list is meant to show "my zones plus what
  I created". But a small mistake in the filter matched every estimate in the franchise. Those extra
  estimates then failed with "Estimate not available in your scope" when the manager tried to send
  them.
- **The "created by" name on a manager's estimate** could fall back to just "Manager", because the
  code asked the database for a column that does not exist.

**Fixed:** all three. **Please note:** after this fix some managers will see **fewer** estimates than
before. That is the intended behaviour (their own zones plus their own estimates). If you actually
want every manager to see the whole franchise, that is a business decision and we can change it.

**Fine as is:** AMC Packages and Add Service are read-only for franchise managers, by design.
**Not testable here:** emailing an estimate (email not set up).

### 6. Billing & Payments (Dashboard, Generated Invoices, Invoices, Make Payments, Payments, Payment History, Archived)
**What it does:** invoices and payments.

**Result:** these screens are shared with the Admin, Franchise Partner, Supervisor and Employee
portals. They go through the common payments server, and managers are on its list of allowed roles.
I found nothing manager-specific wrong.
**Not testable here:** online payment (needs real Razorpay keys) and receipt emails (email not set up).

### 7. Schedules (Dashboard, Pending Property Schedules, All Schedules, Calendar, Rescheduled Requests, Cancelled Schedules)
**What it does:** service visit planning.

**What was wrong:** **"Restore to original date" on Rescheduled Requests always failed** for
managers, because there was nothing behind it on the server.

**Fixed:** added it. It works the same way as the Franchise Partner version and only touches visits
belonging to the manager's franchise. The other schedule screens call server requests that exist.

### 8. Vendor Management (Add Vendor, Vendor Details, Assigned Vendors)
**What it does:** add vendors, list them, and see which vendor covers which property.

**What was wrong:** **Vendor Details was always empty, for every manager.** The server's vendor list
had a typo in a database column name (`poc_county_code` instead of `poc_country_code`). The database
rejected the whole request every time. The same list also feeds the vendor counts and pickers on the
Dashboard, Work Orders and Property Management screens, so all of those were empty too.

**Fixed:** corrected the column name. **This is probably the most visible fix in this report.**

**Fine as is:** editing or deleting vendors is turned off for managers on purpose (the Franchise
Partner does that).
**Small risk:** a manager who does not belong to a franchise can add a vendor but will never see it
in the list, because the list only shows franchise vendors.

### 9. Employee Zone Management
**What it does:** the manager chooses which zones each of the franchise's employees covers.

**What was wrong:** the zone lists used plain numbers for the franchise's own zones. So **deleting a
zone the manager had created was refused** with "This is a company-wide zone". Worse, a matching
number could point at a different, company-wide zone.

**Fixed:** franchise zones now carry their proper label, so deleting works and points at the right zone.
**Small issue, not fixed:** a manager with no franchise still sees this menu item. The page then
shows "not available", because only franchise managers have employees.

### 10. Marketing (Dashboard, Tracker, Complaint Form, Archived)
**What it does:** the franchise's lead tracker and complaints, limited to the manager's zones.
**Result:** uses the shared Marketing system, which has its own automatic tests. Nothing
manager-specific looked wrong. It is correctly hidden from managers with no franchise.

---

## Other things worth knowing (not fixed)
- **Hidden fault fixed in a shared ownership check:** the check that asks "does this record belong to
  this manager?" was wired to the database wrongly. Every such check refused access. Today it only
  guards actions that are switched off for managers anyway, so nobody noticed, but it would have
  broken any future feature that relied on it. Fixed.
- **Contact details could be looked up from another franchise's property.** When the estimate list
  fills in a missing customer phone or email, it can match a property by name alone, across all
  franchises. Property names are not unique. Not changed, because it needs a decision about
  company-created properties that franchises are meant to see.
- The work-order screens still offer a **"Closed"** status. The work-order rules say Closed should be
  removed from those drop-downs, but the agreed page header still shows a Closed count. I left it
  alone; this needs a decision.
- The Coordinator portal's "Assign Employee" on work orders also writes to the employee column that
  did not exist. The new database update below fixes that for them too.

## What still needs to be done by someone with full access
1. Apply the new database update to the local database (command below).
2. Start a manager server and try: Vendor Details (list should fill), work-order Edit / Assign
   Vendor / Assign Employee / Delete, estimates "Archive Selected", Restore on Rescheduled Requests,
   deleting a zone you created, and the Dashboard bell.
3. Run the automatic checks and the website build listed below.

---

## Technical appendix

**Files changed**
- `backend/routes/manager.js`
  - `GET /vendors`: `ov.poc_county_code` → `ov.poc_country_code` (the Unknown column error made the
    whole list fail).
  - New `GET /work-orders/approaching-deletion` (empty for a manager with no franchise).
  - New `PUT /work-orders/:id`, `PATCH /work-orders/:id/assign-employee`, `DELETE /work-orders/:id`.
    All use the new `managerOwnsWorkOrder` helper (the same rule as assign-vendor). The edit route
    only writes values that are valid for the ENUM columns. Assign-employee checks the column via
    `information_schema` and adds it if missing, as AGENTS.md recommends.
  - New `POST /estimates/bulk-archive` (accepts `estimateIds`, which is what the screen sends).
  - New `POST /schedules/:visitId/restore` (the FP route's logic, scoped to the manager's franchise).
  - `GET /estimates`: the `created_by_name LIKE '%<first_name>%'` parameter became `'%%'` because the
    manager token has no `first_name`, so it matched every row. It now binds NULL when there is no name.
  - `POST /estimates` creator lookup: removed the nonexistent `users.name` column.
  - `GET /zones`: `fp_zones` rows are now stamped `fp-<id>` (as `utils/zoneDelete.js` expects) instead
    of a bare number.
- `backend/middleware/managerScope.js`: `const pool = require(...)` → `const { pool } = require(...)`.
  The old line bound the module object, so `validateOwnership` always answered 403.
- `backend/config/database.js` (shared): boot now also makes sure `properties.division` exists.
  Manager code writes and reads it, but until now only the FP route added it, the first time it was
  used. Idempotent and harmless to other portals.
- `backend/database/migrations/schema_v57_work_order_assigned_employee.sql` (new): adds
  `work_orders.assigned_employee_id` and `properties.division` using the `information_schema`
  pattern. Safe to re-run.
- `admin-portal/src/pages/ManagerWorkOrders.jsx`: assign call now uses `API_BASE`; the edit form
  decodes stored HTML-escaped text (`decodeDeep`).
- `admin-portal/src/pages/ManagerProperties.jsx`: save and assign calls now use `API_BASE`; the zone
  `<option>` value is now the zone name.
- `admin-portal/src/pages/ManagerVendors.jsx`: save call now uses `API_BASE`.

**Shared-code note:** the only shared files touched are `config/database.js` (one added
boot-time column check) and the new migration. Everything else is manager-only.

**Not run (permission denied in this session)**
- Apply the migration:
  `"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h localhost -u root -p customer_portal_local < backend/database/migrations/schema_v57_work_order_assigned_employee.sql`
- `node --test backend/routes/loginCandidates.test.js backend/services/invoiceGstDelink.test.js backend/routes/managerServiceCatalog.test.js backend/utils/workOrderId.test.js`
- `cd admin-portal && npx vite build --outDir /tmp/build-mgr`
- The live API walk-through with `TEST-MGR-` data on port 5004.

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
