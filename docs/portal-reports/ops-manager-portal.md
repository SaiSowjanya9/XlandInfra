# Operations Manager Portal — Audit Report

**Who this portal is for:** the Operations Manager (login role `operations_manager`, default local
account `ops_manager` / `Password@123`). They sign in at `/employee/login` and land in the same
"Employee Portal" the Super Admin uses, with a few items hidden (User Management, QR Management,
Create Estimate). By company policy this role **oversees everything but is mostly view-only**:
it can read every screen across all franchise partners, but should not change customers,
vendors, employees, estimates or marketing records. Billing and Schedules are the exception —
the screens give it full working rights there.

## Important note on how this audit was done

This audit ran as a background job that was **not allowed to start programs** — the backend
server, `curl`, the MySQL client, `node --test` and the frontend build were all blocked by the
permission system. So I could not log in and click through with real test data, and **no
`TEST-OPS-` records were created**. Everything below comes from reading every screen and the
server code behind it, line by line. The fixes are small and targeted, but **they still need a
build and a quick click-through** (commands at the end) before they go live.

---

## The biggest problem found: the "view-only" rules never applied

**What the Operations Manager experienced:** after a normal login they saw the *full admin
controls* on most screens: the Add Customer form, Add Vendor, Add Employee, edit / archive /
delete buttons on Vendor Details and Employee Details, the zone assignment button, and the
"Create Work Order" tab. These screens were built to show this role a read-only version, but
that never kicked in.

**Why:** the login screen saves "who is signed in" in the browser's *session* storage, but those
ten screens looked for it in a *different* storage area (the long-term one), found nothing, and
so treated the Operations Manager as an admin.

**Fixed:** one shared helper (`getCurrentUser`) now reads the right place (and still falls back
to the old one). All ten screens use it. Admins see no change; the Operations Manager now gets
the view-only version as designed.

## Second problem found: brand-new staff were locked out after setting their password

**What a user experienced:** someone logging in for the first time is asked to choose a new
password. Once they did, they got into the portal but **every screen failed to load**
(the server said "not logged in") until they logged out and back in.

**Why:** the "set your password" step saved the new login pass in the wrong storage area — the
one the rest of the app never reads.

**Fixed:** it now saves to the same place as the normal login. This applies to every staff
portal (anyone who logs in through `/employee/login`), not just the Operations Manager.

---

## Section by section

### 1. Dashboard
- **What it does:** headline counts (properties, work orders, estimates, invoices, vendors,
  employees) across all franchise partners or for one chosen partner, plus a notifications bell.
- **Checked:** every data source exists on the server and allows this role to read it.
- **Result:** works. (Another agent auditing the Admin portal added the missing login pass to the
  notifications bell at the same time — that also fixes it for this role.)

### 2. Add Customer
- **What it does:** creates a new customer/property.
- **Result:** the Operations Manager was shown the full form (see the main problem above).
  **Fixed:** they now see a "view-only access" notice, as intended.
- **Needs a decision:** the sidebar still shows "Add Customer" to this role even though it only
  opens a notice. You may prefer to hide it.

### 3. Property Management
- **What it does:** lists every customer property; view details, export, edit, assign a vendor
  or employee, deactivate, restore, and permanently delete.
- **What was broken:** this screen had **no view-only rule at all**, and the server accepted the
  changes too. An Operations Manager could edit any property, deactivate it — which also locks
  the customer out of their portal — or **permanently delete** a property, its customer login
  and its history.
- **Fixed:**
  - On screen: for this role, only View and Export remain; edit, assign, deactivate, restore and
    permanent-delete buttons (in the table and in the detail window) are hidden.
  - On the server: edit, deactivate, restore and permanent-delete now refuse this role with
    "You do not have permission to make this change", even if someone calls the server directly.
  - Admin is unaffected.

### 4. Work Orders (Dashboard, All Work Orders)
- **What it does:** work-order charts, and the list of all work orders across partners.
- **Result:** reading works. Because of the main problem, the "Create" tab and the edit/status
  controls used to appear for this role; **now hidden as designed**.
- **Still open (needs a decision):** the server would still accept a work-order edit or delete
  from this role if someone called it directly — the same server rules are shared with the FP
  Manager, so I didn't change them without your say-so.

### 5. Estimates / AMC (Dashboard, All Estimates, AMC Packages, Add Service, Archived)
- **What it does:** read every estimate, the AMC package list and the service catalog.
- **Result:** the screens already hid create/edit/archive buttons correctly for this role.
- **What was broken:** the server still *accepted* changes from this role: editing an estimate,
  bulk-archiving estimates, and creating, editing or deleting AMC packages and old-style
  add-ons. AGENTS.md says this role is view-only on estimates, and the rest of the estimate
  system already enforced that.
- **Fixed:** those server actions now refuse this role. Admin is unaffected; no other portal
  uses those addresses.

### 6. Billing & Payments (Dashboard, Generated Invoices, Invoices, Make Payments, Payments, Payment History, Archived)
- **What it does:** invoices, recording and verifying payments, the payment audit trail. This
  role *is* allowed to work here.
- **What was broken:** the **franchise-partner picker did nothing** for the Operations Manager.
  Choosing one partner still showed every partner's invoices, payments and history — so the
  billing dashboard totals, the invoice list and the payment list were always company-wide. The
  server only respected the picker for the Super Admin.
- **Fixed:** the server now respects the picker for the Operations Manager too (invoice list,
  payment list, payment history, online-payment history). The dashboard's margin figures already
  worked.
- **Still open:**
  - In **Generated Invoices**, the panel for "completed work orders waiting for an invoice" is
    always empty for Admin and the Operations Manager. It asks a franchise-partner-only server
    address that fails when there is no partner login behind it. Clicking a row would open
    "Create Estimate", which this role can't use anyway. Needs a decision: give the admin side
    its own list, or hide the panel there.
  - That same file also contains an old, unused "create invoice" form that points at a server
    address that doesn't exist. It is never shown, so no one is affected; it can be removed later.
  - **Not testable locally:** sending invoices and receipts (email isn't configured) and online
    payment links (Razorpay needs real keys).

### 7. Schedules (Dashboard, Pending Property Schedules, All Schedules, Calendar, Rescheduled Requests, Cancelled Schedules)
- **What it does:** turns approved, paid estimates into visit schedules; reschedule, cancel,
  restore.
- **Checked:** every screen's server address exists, the server treats this role like an admin
  for reading and writing, and the screens give it full rights. Links between the schedule
  screens stay inside `/employee`.
- **Result:** no problems found specific to this role. (Live behaviour couldn't be exercised —
  see the note at the top.)

### 8. Vendor Management (Add Vendor, Vendor Details, Assigned Vendors)
- **Result:** Add Vendor and Vendor Details showed full admin controls (main problem above);
  **fixed** — Add Vendor now shows the view-only notice, and Vendor Details hides edit, archive
  and restore. Assigned Vendors was already correctly read-only.
- **Also fixed on the server:** bulk-archiving vendors and "delete all archived vendors" through
  the admin addresses now refuse this role.
- **Still open:** the general vendor addresses (`/api/vendors/...`) used by Vendor Details still
  accept changes from this role if called directly; the buttons are hidden now. These addresses
  are shared with the franchise-partner portals, so changing them needs a decision.

### 9. Employee (Zone) Management (Add Employee, Employee Details, Employee Zone)
- **Result:** same main problem; **fixed**. Add Employee shows the view-only notice, Employee
  Details hides edit/disable/delete, and the zone "Assign" button is greyed out.
- **Also fixed on the server:** changing an employee's zones now refuses this role.
- **Still open:** like vendors, the staff addresses (`/api/staff/...`) would still accept a
  change if called directly.

### 10. Marketing (Dashboard, Tracker, Complaint Form, Archived)
- **What it does:** the sales-lead tracker and customer complaints across all partners.
- **What was broken:** the server correctly refuses every change from this role, but the screens
  still showed every editing control: the "New Complaint" button, tracker cells you could type
  into, archive/restore buttons, note editing. Every attempt failed with a permission error.
- **Fixed:** for the Operations Manager these screens now show the records read-only. The Admin,
  FP and other portals are unchanged.

---

## What still needs your decision (summary)
1. Should Add Customer / Add Vendor / Add Employee be hidden from this role's sidebar? Today they
   only open a "view-only" notice.
2. Work orders, vendors and staff: the server would still accept changes from this role if called
   directly (the buttons are hidden now). Those server rules are shared with the FP Manager, so
   I didn't tighten them.
3. Billing and Schedules are fully writable for this role. That matches the current design, but
   please confirm it is the policy you want.
4. Generated Invoices' "completed work orders" panel is always empty for Admin and the Operations
   Manager.

## Not testable locally
- Any email (activation, invoice, receipt, complaint notifications) — SMTP isn't configured.
- Razorpay payment links and online payments — no real keys.
- Live API calls, database checks and the build — this run was not permitted to execute
  programs (see the note at the top).

---

## Technical appendix

**Files changed**

| File | Change |
|---|---|
| `admin-portal/src/utils/safeStorage.js` | New `getCurrentUser()` — reads `pm_current_user` from sessionStorage (where every login writes it), falling back to localStorage. |
| `admin-portal/src/pages/{CreateCustomer,AddVendor,AddEmployee,VendorDetails,EmployeeDetails,EmployeeZoneManagement,EmployeeWorkOrders,Properties,QRManagement}.jsx` | `JSON.parse(safeStorage.getItem('pm_current_user'))` (localStorage, always empty) → `getCurrentUser()`. These are the existing `isOpsManager` guards; Admin behaviour unchanged. |
| `admin-portal/src/pages/CustomerSubmissions.jsx` | Added an `isOpsManager` guard; hides edit / assign vendor / assign employee / deactivate / restore / permanent delete in the table and the view-modal footer. |
| `admin-portal/src/pages/SetPassword.jsx` | Token and user are written with `safeSessionStorage` (was localStorage, which `getAuthToken()` never reads). Shared by every login that goes through `EmployeeLogin`. |
| `admin-portal/src/utils/marketingApi.js` | `marketingPermissions(portalType, role)` returns all-false for `operations_manager` on the admin mount; a single-argument call behaves exactly as before. |
| `admin-portal/src/pages/marketing/{MarketingTracker,MarketingComplaintForm,MarketingArchived}.jsx` | Pass `user?.role` to `marketingPermissions`. |
| `backend/routes/payments.js` | New `isCompanyWideRole(req)` (admin, super_admin, operations_manager). `GET /invoices`, `/payments`, `/history` and `/razorpay-history` now honour `?fpId=` for the Ops Manager. |
| `backend/routes/admin.js` | `adminWriteRoles` added to `DELETE /properties/:id`, `PUT /properties/:id/restore`, `DELETE /properties/:id/permanent`, `PUT /estimates/bulk-archive`, `PUT /estimates/:id`, `PUT /vendors/bulk-archive`, `DELETE /vendors/archived/delete-all`, `PUT /employees/:id/zones`, `POST/PUT/DELETE /amc-packages`, `DELETE /addons/:id`, `PUT/DELETE /fp-addons/:id`. `PUT /properties/:id` (managerOrAdmin) refuses `operations_manager` only. All of these are called only from admin-portal admin screens. |

**Shared-component impact:** `safeStorage.js`, `SetPassword.jsx`, `marketingApi.js`, the marketing
pages and `payments.js` are shared. The changes only alter behaviour for the
`operations_manager` role, except the SetPassword fix, which repairs first login for every staff
role. No schema change and no migration.

**Still to run (blocked for this agent):**
```bash
node --test admin-portal/src/utils/marketingApi.test.js admin-portal/src/utils/billingRoutes.test.js
node --test backend/routes/marketing.test.js backend/routes/paymentsVerify.test.js
cd admin-portal && npx vite build --outDir /tmp/build-ops
```
Then log in locally as `ops_manager` / `Password@123` and check that Property Management, Vendor
Details, Employee Details and Marketing show no edit controls, that the billing FP picker narrows
the Invoices and Payments lists, and that `curl -X DELETE …/api/admin/properties/<id>` with the
Ops Manager's token answers 403.

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
