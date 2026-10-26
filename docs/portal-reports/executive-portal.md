# Executive Portal — Audit Report

**Who uses it:** field executives who work for a franchise partner (FP). They see their
partner's customers, properties, work orders, estimates and vendors **for the zones they have
been assigned** (plus anything they created themselves). Most screens are read-only for them by
design: they can add customers, raise work orders, create estimates and add vendors, but they
cannot delete things or manage employees.

## Important: how this audit was done

This audit was done by **reading the code**, not by clicking through a running copy of the app.
The tools I was given ran in a restricted mode that blocked starting the server, using the
database, sending test requests and building the website. So:

- Nothing below has been tried with real data yet. No test records (`TEST-EXEC-…`) were created
  and none need cleaning up.
- Every fix is small and follows how the same thing already works in the sister portals
  (Coordinator, Supervisor, Manager). But **someone should still click through the screens
  listed under "Please check"** before this goes live.
- The automated checks (regression tests and the website build) still need to be run — see the
  technical appendix.

---

## Sidebar sections

### 1. Dashboard
**What it does:** the home page — counts of properties, vendors, assigned zones and work orders,
plus charts of work orders and estimates.

**What was wrong:**
- The **Vendors** card always showed **0**, however many vendors there were. The page expected
  a plain list but the server sends the list in a slightly different wrapper, so the page threw
  it away.
- The **Zones** ("Assigned Zones") card always showed **0**. The server never sent the number,
  and the code that tried to work out the zone names looked them up the wrong way, so it never
  found any.

**Fixed:** both cards now show real numbers. An executive assigned to every zone sees "All".

### 2. Add Customer
**What it does:** adds a new property and its contact, and creates the customer's portal login
(sends the activation email).

**Result:** no problems found in the code. It follows the agreed rules for "one email, one
customer account" (existing accounts are linked rather than given a second activation).
**Not testable here:** the activation email itself (email is not set up on a local copy).

### 3. Property Management
**What it does:** lists the properties in the executive's zones; the eye icon opens the details,
the related estimates and the vendors assigned to the property.

**What was wrong:** the table's column headings did not line up with the data. There were two
"Customer Name" headings and one "Contacts" heading but only one column of data under them, so
every column after "City" sat under the wrong heading — the phone number was labelled
"Customer Name", the creator's name sat under a second "Customer Name", the date under
"Contacts", and the Status and Actions headings had nothing beneath them.

**Fixed:** the table now has one "Customer Name" column (the contact's name, which was not
shown at all before) and one "Contacts" column (their phone), and every heading sits over its
own data.

**Good to know:** this screen can only view. There is unused code for editing, deleting and
assigning vendors/employees on this page, but no buttons reach it, which fits the executive's
read-only role.

### 4. Work Orders
**What it does:** lists work orders and lets the executive raise a new one.

**What was wrong:**
- **Security:** any executive could change the status of *any* work order in the whole system
  (including other franchise partners'), just by knowing its number. **Fixed** — the server now
  checks that the work order belongs to the executive's own partner.
- An executive with **no zones assigned** could not see the work orders they had raised
  themselves. They were saved under the executive's email address, but the list looked for
  their username. **Fixed** for new work orders (older ones keep the email they were saved with).
- The status filter offered **"Closed"**, which the agreed rules say executives should not see,
  and the "Clear" action did not reset the status filter. **Fixed.**

**Still open (needs a decision / more work):**
- The create form lets you pick **photos to attach, but they are never uploaded** — they are
  quietly dropped when the work order is saved. The Entry Notes box is also not saved. Fixing
  this needs an upload feature on the server for this portal (the FP portal has one to copy).

### 5. Estimates / AMC
Sub-items: Dashboard · Create Estimate · All Estimates · AMC Packages · Add Service · Archived.

**What was wrong:**
- **Estimates → Dashboard did not exist.** Clicking it silently sent the executive back to the
  home page. **Fixed** — it now opens the shared Estimates dashboard, showing the executive's own
  estimates.
- **Security / privacy:** a mistake in the filter meant **every executive could see every
  estimate of their franchise partner**, in every zone, not just their own zones. **Fixed** — they
  now see estimates in their zones plus the ones they created (or everything, if assigned to all
  zones). Executives may notice their list gets shorter; that is the intended behaviour.
- An executive assigned to **"All zones"** saw only the estimates they had personally created
  (the same fault existed for vendors). **Fixed.**
- **Editing a direct estimate looked broken.** After pressing Save, the estimate *was* saved, but
  the page crashed silently: the dialog stayed open, no success message appeared, and the list did
  not refresh — so people would likely press Save again or think it failed. **Fixed** — the dialog
  closes and a confirmation appears.
- **Property-based estimates were not linked to their property.** The form sends the property
  code (e.g. "GC-…") and the server could only store a number, so it stored *nothing*. Anything
  that later looks the property up from the estimate — such as the list of paid properties waiting
  to be scheduled — would miss these estimates. **Fixed** for new estimates: the server now looks
  up the property by its code. *Older executive estimates still have no link; they would need a
  one-off repair if this matters.* (The Manager, Coordinator and Supervisor portals have the same
  issue — not changed by me, flagged for those owners.)
- The estimate's "created by" name could be **the name of a different employee** (two different
  ID numbers were being mixed up), and a fallback lookup used a database column that doesn't exist.
  **Fixed.**

**Works as designed:** AMC Packages and Add Service are view-only lists of the partner's
packages and services; executives cannot create them (agreed policy).

### 6. Schedules
Sub-item: Dashboard.

**What was wrong:** the Schedules Dashboard **did not exist at all** for executives — clicking it
sent them back to the home page, and the server had no schedule information for this portal.

**Fixed:** the Schedules Dashboard now opens and shows the partner's scheduled visits and the
"paid, waiting to be scheduled" properties, limited to the executive's zones (read-only).

**Still open (needs a decision):** the dashboard's "View All / View Today / Pending" links lead
to detailed schedule screens (calendar, pending properties, reschedule requests, cancelled) that
the executive portal does not have. For now those links simply keep the executive on the
schedules dashboard. Giving executives those screens is a permissions decision (should an
executive be able to reschedule or assign vendors?).

### 7. Vendor Management
Sub-items: Add New Vendor · Vendor Details · Assigned Vendors.

**What was wrong:**
- **Assigned Vendors was always empty** for executives working under a franchise partner. It only
  looked for properties personally tied to the executive, which partner properties never are.
  **Fixed** — it now shows the partner's vendor assignments within the executive's zones, the
  same way the Coordinator and Supervisor portals do.
- A vendor added by an executive **did not record who added it**, so an executive could not see a
  vendor they had just added if it was outside their zones. **Fixed** for new vendors.
- Executives assigned to "All zones" only saw vendors they had added themselves. **Fixed.**
- On the live website, the Assigned Vendors page would have called the wrong web address. This was
  already fixed by another agent while I was working.
- The Add Vendor form's "service type" list could, in rare cases, be scoped to the wrong partner
  (or show every partner's service types) because two different ID numbers were mixed up.
  **Fixed** — the server now uses the partner recorded in the executive's login.

### 8. Employee Zone Management
**What it does:** shows which zones each employee of the partner covers (view-only for
executives).

**What was wrong:**
- **The page was always empty.** It asked the *Manager* portal's server for the data, which
  refuses executives.
- It also showed **"Assign Zones / Modify Zones" buttons** that could never work for an executive.
- **Security:** the executive server's employee list sent **every colleague's password hash**
  (the scrambled form of their password) to the browser. **Fixed** — only names, contact details,
  roles and zones are sent now.

**Fixed:** the page now reads the executive portal's own data, shows each employee's zones, and
hides the edit buttons in view-only mode. (The Manager portal uses the same page and is unchanged.)

### 9. Marketing (only for executives under a franchise partner)
Sub-items: Dashboard · Tracker · Complaint Form · Archived.

**Result:** no problems found in the code. Executives can read the pipeline for their zones and
their own visits, and can write a note on a complaint the FP has assigned to them — exactly as
the agreed rules describe. Complaint emails are not testable on a local copy.

---

## Things I could not test locally
- **Emails** (customer activation, work-order notifications, complaint updates): email is not
  configured on the local copy.
- **Payments / Razorpay:** not part of the executive sidebar.
- **Everything at run time** — see the note at the top.

## Please check (click-through list)
1. Log in as an executive under a franchise partner.
2. Dashboard: Vendors and Zones cards show non-zero numbers.
3. Estimates → Dashboard and Schedules → Dashboard open (not the home page).
4. Edit a direct estimate → Save: dialog closes with a success message.
5. Create a property-based estimate → it shows on the property's details.
6. Vendor Management → Assigned Vendors lists assignments.
7. Employee Zone Management lists employees with their zones and no edit buttons.
8. Property Management: column headings line up.

---

## Technical appendix

**Files changed**

Frontend (`admin-portal/src`):
- `App.jsx` — executive routes for `estimates/dashboard`, `schedules/dashboard` (+ `schedules/*`
  redirect to it); `ManagerEmployeeZones` gets `apiPortal="executive"`.
- `pages/EstimatesDashboard.jsx` *(shared)* — `executive` added to the API path map.
- `pages/schedules/SchedulesDashboard.jsx` *(shared)* — `executive` added to API/base path maps.
- `pages/ManagerEmployeeZones.jsx` *(shared with Manager)* — new `apiPortal` prop (default
  `manager`), honours the `viewOnly` prop (hides Assign/Modify). Manager behaviour unchanged.
- `pages/ExecutiveDashboard.jsx` — reads `data.all` from `/vendors`.
- `pages/ExecutiveProperties.jsx` — table headers/cells aligned; unused assign call uses `API_BASE`.
- `pages/ExecutiveWorkOrders.jsx` — removed "Closed" filter option; `handleClear` resets status.
- `pages/ExecutiveEstimates.jsx` — defined the missing `showToast`; `loadData` → `fetchData`.

Backend:
- `backend/routes/executive.js`
  - `GET /dashboard`: `stats.zones`, `assignedZones` from zone names.
  - `POST /work-orders`: `created_by` = `getCreatorIdentifier` (matches the list filter).
  - `PATCH /work-orders/:id/status`: ownership check (FP, or creator when standalone).
  - `GET /vendors`, `GET /vendors/assignments`: `__ALL__` handled; assignments scoped by FP.
  - `POST /vendors`: stores `created_by`, `created_by_id`.
  - `GET /employees`, `/employees/:id`, `/export/employees`: no `fpe.*` (password_hash leak);
    zones read from `fp_employee_zones.zone_name`; manager-compatible shape.
  - `GET /estimates`: removed `created_by_name LIKE '%%'` leak; `__ALL__` handled; zone filter on
    the coalesced estimate/property zone.
  - `POST /estimates`: property code resolved to the property row id; creator name via
    `fpEmployeeId`; removed nonexistent `users.name`.
  - New `GET /schedules/all` and `GET /schedules/pending-properties` (read-only, zone-scoped,
    LIMIT/OFFSET inlined as clamped integers).
- `backend/routes/admin.js` *(shared)* — `GET/POST /service-types` prefer the token's
  `franchisePartnerId` before looking up `users` by id (fp_employees/users id collision).

No database migration was needed.

**Verification still to run** (blocked in this session):
```bash
node --check backend/routes/executive.js
node --check backend/routes/admin.js
node --test backend/routes/staffServiceCatalog.test.js backend/routes/marketing.test.js \
  backend/utils/workOrderId.test.js admin-portal/src/utils/marketingApi.test.js
cd admin-portal && npx vite build --outDir /tmp/build-exec
```

**Same issues seen in other portals (not changed — for those owners):**
- `SupervisorProperties.jsx` has the same misaligned headers (duplicate "Customer Name").
- Coordinator/Supervisor/Manager `POST /estimates` store `property_id` NULL for property codes.
- Coordinator `/vendors/assignments` treats the `__ALL__` zone marker as a literal zone.
- `coordinator.js` (~line 2279) and `supervisor.js` (~line 2320) estimate lists carry the same
  `created_by_name LIKE '%${req.user?.first_name}%'` term, which is `LIKE '%%'` because the token
  has no `first_name` — those portals also see every estimate of their partner.

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
