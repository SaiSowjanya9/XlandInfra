# Supervisor Portal — Audit Report

**Who uses it:** a supervisor working for a franchise partner (FP). They sign in at the employee
login page and see the FP's data, narrowed to the zones they are assigned to.

## Important: how this audit was done

I was **not able to run anything live** for this portal. The session I worked in did not allow me
to start the backend server, call it, open the database, run the automated tests or build the
website. Every program I needed (`node`, `curl`, the MySQL client, `npx`) was blocked. So:

- No test data was created. Nothing named `TEST-SUP-…` exists, so there is nothing to clean up.
- Every finding below comes from reading the code screen by screen. For each sidebar item I
  followed the screen → the call it makes to the server → the server code → the database query,
  and compared the columns against the table definitions in the repository.
- **Every fix needs a live check before it is trusted.** I could not confirm the build compiles or
  that the tests pass. The person who runs this next should run the checks at the end of this
  report.

---

## Section by section

### 1. Dashboard
**What it does:** headline numbers (properties, vendors, zones), work-order and estimate charts.

- **Broken, now fixed: the "Zones" card always showed 0.** The server never sent a zone count. It
  also looked up the supervisor's zone names as if they were ID numbers, which found nothing. It
  now sends the number of zones the supervisor covers. For a supervisor who covers all zones, it
  counts every zone the FP's properties are in.
- **Broken, now fixed: clicking the Zones card did nothing useful.** It pointed at a page that
  doesn't exist in this portal, so it bounced you back to the dashboard. It now opens Property
  Management.
- Other numbers: the queries look correct.

### 2. Add Customer
**What it does:** registers a new property with its contact person and creates their
customer-portal login.

- The form and the server agree on the data sent, and the required fields match.
- It follows the agreed rules for "one email = one customer account".
- **Not testable here:** the activation email. Email is not set up on local machines.

### 3. Property Management
**What it does:** lists the FP's properties in the supervisor's zones. Opens property details, the
property's estimates and its assigned vendors.

- **Possibly broken for everyone, now guarded: the property list could come back empty.** The
  list also reads from an old table (`supervisor_assigned_properties`). That table is set up by an
  old database script that stops with an error on MySQL 8 before it gets that far. So on most
  installs the table probably doesn't exist. When it is missing, the whole list fails, and every
  screen that picks a property fails with it (Work Orders, Estimates, Add Customer). The server now
  checks whether the table exists and skips it if not. I couldn't look at the database to confirm
  the table is missing, but either way the list now works.
- **Security hole, now fixed: a supervisor could edit any company's property.** The "save
  property" request never checked that the property belonged to the supervisor's FP. Anyone with
  the property's number could change it. It now refuses properties outside the supervisor's FP.
- **Also tightened: the list could show another FP's property.** The list matched on "this
  supervisor's ID". That ID can by chance equal the ID on another FP's property. It now matches on
  the FP only.
- **Broken, now fixed: saving an edited property failed.** For properties stored in the main
  property table, the Active on/off switch tried to write a column that doesn't exist, so every
  save failed. It now writes the "status" field, which is what the list actually filters on.
- **Broken, now fixed: "Assign Vendor" said it failed even when it worked.** The vendor was
  saved, then a second "old-style" update hit a column that doesn't exist. You saw "Failed to
  assign vendor", and trying again said "already assigned". That second update now only runs when
  the column exists, and only for the right kind of property.
- **Broken, now fixed: the Assign buttons pointed to the wrong web address.** They called the
  server without its full address, so on the live site they would hit the admin website instead.
  They now use the full address.
- **Broken, now fixed: the vendor panel on a property, and the Assigned Vendors page, were
  empty.** They only showed vendors on properties the supervisor had personally created. They now
  show the FP's assignments, the same way the coordinator portal does.
- **Note:** for an FP's supervisor (practically every supervisor), the screen hides Edit, Assign
  and Delete and shows View only. So most supervisors never hit the edit and assign bugs above.
  They mattered for standalone supervisors, and for anyone calling the server directly.
- **Needs a decision: "Assign Employee" to a property cannot work.** No database script creates
  the column that would hold it. The server now says so plainly instead of giving a generic error.
- **Needs a decision: editing contact details of an onboarded property does nothing.** For
  properties added through "Add Customer", contacts are stored in a separate contacts list. The
  edit form's contact fields are silently ignored for them. This needs a small design decision
  about which contact to overwrite.

### 4. Work Orders
**What it does:** list, create, change status, edit, and assign a vendor.

- **Broken, now fixed: Edit, Assign Vendor and Delete all failed.** The buttons existed, but the
  server had no matching functions, so every press ended in an error. Edit and Assign Vendor now
  work. Delete gives a clear "not allowed for this role" message, the same rule as for properties
  and vendors, and the Delete button is gone from the screen.
- **Edit form safeguard:** you can't complete or cancel a work order from the Edit form. Completing
  one also records closing notes, emails the customer and creates the invoice, and that only
  happens through the status menu in the list. The form tells you to use the status menu.
- **Broken, now fixed: work orders on some properties couldn't be created.** If the property was
  in the main property table (not added through "Add Customer"), creating a work order failed with
  a database error.
- **Broken, now fixed: a supervisor with no zones couldn't see work orders they had just
  created.** The order was saved under their email, but the list searched by their username.
- **Rule fix: "Closed" removed from the supervisor's status menus.** The written rules for this
  portal say supervisors mark work orders Completed, never Closed. I removed Closed from the filter,
  the status menu in the list and the Edit form, and the server now refuses it. A work order that is
  already Closed still shows as Closed.
- **Assign Vendor:** the vendor must belong to the same FP. Assigning a vendor no longer moves a
  completed work order back to "Assigned".
- **Needs a decision: "Assign Employee" on a work order.** There is nowhere in the database to
  store it, and the employee list it offers comes from an old, unused table, so it is normally
  empty. I left the button alone. It should be removed, or the feature built properly.
- **Not testable here:** the "work order created" and "work order completed" emails.

### 5. Estimates / AMC
- **Dashboard — broken, now fixed: the sidebar link went nowhere.** "Estimates / AMC → Dashboard"
  had no page behind it in this portal, so it sent you back to the main dashboard. It now opens the
  shared Estimates Dashboard, set up to read the supervisor's own estimates.
- **All Estimates — fixed: supervisors were seeing every estimate in the FP.** The zone filter
  had a typo-level bug that let every estimate through, so the zone rule never applied. It now
  shows estimates in the supervisor's zones (judged by the estimate's or the property's zone), plus
  their own. A supervisor set to "all zones" sees all of the FP's estimates. **Heads-up:** some
  supervisors will now see fewer estimates than before. That is the intended rule, and it matches
  the dashboard's counts.
- **Create Estimate — small fix:** the name saved as "created by" could be wrong (it could pick up
  another employee's name) or fall back to just "Supervisor". It now looks up the right person.
- **AMC Packages / Add Service:** these are view-only for supervisors, which is correct. The
  server would still have accepted "create package" and "create service" requests, writing them to
  a table nothing reads. It now refuses them, the same way the coordinator portal does.
- **Archived Estimates:** view only. Looks correct.

### 6. Billing & Payments
These screens are shared with the other portals, so I only checked what is specific to the
supervisor.

- **Dashboard — broken, now fixed: the sidebar link went nowhere.** "Billing & Payments →
  Dashboard" had no page behind it. It now opens the shared Payments Dashboard. Supervisors can't
  see vendor cost or margin figures there; that's existing policy and it holds.
- **Generated Invoices, Invoices, Payments, Payment History, Archived:** supervisors are allowed to
  view these. The server limits them to their own FP.
- **Needs a decision: Make Payments.** The page appears in the sidebar, but the server's rules
  don't let a supervisor record a payment or create a payment link. Any attempt ends with "Access
  denied. You cannot record or edit payments." Either remove the menu item for supervisors, or
  widen the permission. This is a business decision, so I didn't change it.
- **Not testable here:** Razorpay (no test keys locally) and receipt emails.

### 7. Schedules
- **Dashboard and All Schedules:** view only for supervisors (no reschedule or cancel). Looks
  correct.
- **Fixed: the list could come back empty.** If the login didn't carry the FP's ID, the server
  searched for "no FP" and found nothing. It now falls back to the FP found at sign-in, as the
  other schedule screens already did. The vendor filter for schedules got the same fix.

### 8. Vendor Management
- **Add New Vendor — broken, now fixed: a new vendor disappeared from the list right after
  saving.** The list shows vendors in the supervisor's zones, plus the ones they created. But the
  form never recorded who created the vendor, so a vendor outside their zones vanished as soon as
  it was saved. The creator is now recorded.
- **Vendor Details — fixed: an "all zones" supervisor saw only their own vendors.** The "all
  zones" setting was read as a zone literally called "all", which matches nothing. Now fixed. The
  same bug is fixed in All Estimates and Assigned Vendors.
- **Assigned Vendors:** see Property Management above. It now lists the FP's assignments.
  View only, which is correct for supervisors.

### 9. Marketing (Complaint Form, Archived)
- These screens are shared with the FP, admin, manager, coordinator and executive portals. The
  supervisor can read complaints in their zones plus complaints assigned to them, and save a note
  on their own assignment. They have no lead tracker. This matches the documented rules, and I
  found nothing supervisor-specific wrong.
- **Not testable here:** the complaint notification emails.

---

## Still open / needs a decision
1. **Make Payments** — supervisors see the page but are not allowed to use it. Hide it, or allow
   it?
2. **Assign Employee** (properties and work orders) — there is nowhere in the database to store it.
   Remove the buttons, or build the feature?
3. **Editing contacts of an onboarded property** — the changes are ignored. Decide whether the edit
   should overwrite the first contact in the contacts list.
4. **A standalone supervisor (one not linked to any FP)** — the billing screens filter by FP, so
   such a user could see every FP's invoices. This is shared billing code and other portals are
   affected too. Worth deciding whether standalone supervisors should exist at all.
5. **Everything in this report still needs a live check**, because nothing could be run in this
   session.

---

## Technical appendix

**Files changed (all minimal, targeted edits):**
- `admin-portal/src/App.jsx`: added the supervisor routes `estimates/dashboard` →
  `<EstimatesDashboard portalType="supervisor">` and `billing/dashboard` →
  `<PaymentsDashboard portalType="supervisor">`. Both sidebar items previously fell through to
  `*` and redirected to `/supervisor`.
- `admin-portal/src/pages/EstimatesDashboard.jsx` (**shared**): added `'supervisor': 'supervisor'`
  to `getApiPath`. Before, the fallback was `fp`, which answers 403 to a supervisor. Other portals
  are unaffected: it only adds a key.
- `admin-portal/src/pages/SupervisorWorkOrders.jsx`: the assign endpoint now uses `${API_BASE}`.
  `Closed` is removed from the filter, inline and edit status selects, and kept as a disabled
  option only on rows already closed. The Delete button is removed.
- `admin-portal/src/pages/SupervisorProperties.jsx`: the assign endpoint now uses `${API_BASE}`.
- `admin-portal/src/pages/SupervisorDashboard.jsx`: the Zones card now navigates to
  `/supervisor/properties` instead of the non-existent `/supervisor/employees/zones`.
- `backend/routes/supervisor.js`:
  - New helpers: `schemaHas(table, column?)`, an information_schema check that caches only
    positive answers, and `isUnrestricted(zones)`, which handles the `'__ALL__'` marker.
  - `GET /dashboard`: returns `stats.zones`. Zone names are no longer looked up as `zones.id`.
  - `GET /properties`: scoped by `franchise_partner_id` alone for FP supervisors. The
    `supervisor_assigned_properties` UNION runs only when that table exists.
  - `PUT /properties/:id`: now checks ownership (FP or supervisor) and carries that scope into the
    UPDATE. `isActive` maps to `status` for both tables, and `is_active` (not a column of
    `properties`) was removed from the allow-list.
  - `POST /properties/:id/assign-vendor`: rows carry `source_table`. The legacy
    `properties.assigned_vendor_id` UPDATE is guarded by `schemaHas`. The standalone UNION is
    guarded.
  - `POST /properties/:id/assign-employee`: returns 400 with a plain message when
    `properties.assigned_employee_id` is missing. The `supervisor_assigned_properties` UNION is
    guarded.
  - `POST /work-orders`: properties fallback uses `division_id AS division` (`properties` has no
    `division`). `created_by` uses `getCreatorIdentifier(req)`, the same key the list filters on.
  - `PATCH /work-orders/:id/status`: `'closed'` is no longer accepted.
  - New routes: `PATCH /work-orders/:id/assign-vendor`, `PUT /work-orders/:id` (ENUM-safe, refuses
    switching to completed or cancelled), `DELETE /work-orders/:id` (403, role policy). They share
    the helper `findSupervisorWorkOrder`.
  - `GET /vendors`: the `__ALL__` case means no zone filter. The second creator match is email,
    not a duplicate of username. `forSchedules` falls back to `req.franchisePartnerId`.
  - `POST /vendors`: writes `created_by` (`getCreatorIdentifier`) and `created_by_id`
    (`fpEmployeeId || id`).
  - `GET /vendors/assignments`: FP scope `(p|op).franchise_partner_id`, with `__ALL__` handled.
  - `GET /estimates`: the `LIKE '%%'` is gone (the name match is added only when a first name
    exists). `__ALL__` is handled. Zone matches `e.zone`, `op.zone` or `p.zone_id`.
  - `POST /estimates`: creator lookup uses `fpEmployeeId`. The query on `users` no longer selects
    the non-existent `name` column.
  - `POST /amc-packages`, `POST /addons`: return 403 for FP supervisors. They used to write to
    unread `supervisor_*` tables that lack `franchise_partner_id`.
  - `GET /divisions`: `properties.division` → `division_id`.
  - `GET /schedules/all`: FP falls back to `req.franchisePartnerId`.
- No migration was added. The missing legacy tables and columns are handled by runtime checks, and
  the database client could not be run to apply a migration anyway.

**Not changed, noted for other owners:**
- `coordinator.js` writes `work_orders.assigned_employee_id` and `work_orders.deleted_at`, and
  `manager.js` writes `properties.assigned_vendor_id` and `properties.assigned_employee_id`. No
  migration in the repo creates any of these.
- Every portal's `POST /estimates` re-`JSON.stringify`s a `block_names` the direct form has
  already stringified.

**Checks to run (I couldn't run them in this session):**
```bash
cd backend && node --check routes/supervisor.js
node --test backend/routes/staffServiceCatalog.test.js backend/routes/marketing.test.js \
  backend/utils/workOrderId.test.js backend/routes/schedulesRouting.test.js
node --test admin-portal/src/utils/billingRoutes.test.js admin-portal/src/utils/marketingApi.test.js
cd admin-portal && npx vite build --outDir /tmp/build-sup
```
Then sign in as a supervisor and check these by hand:
- Property Management lists properties.
- Editing a work order and assigning a vendor both succeed.
- A newly added vendor appears in Vendor Details.
- Both sidebar Dashboard links open their dashboards.

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
