# Franchise Partner (FP) Portal — Audit Report

## Read this first: how this audit was done

My setup did not let me run any programs. Starting the server, calling it, opening the database,
running the automated tests and building the website were all blocked. Only file reading and
editing were allowed. So I could not log in as a franchise partner or click through the screens
with test data, and **I created no test data** (no `TEST-FP-` records exist).

What I did instead was trace every sidebar item through the code: the menu link, then the screen,
then each request the screen makes, then the server code that answers it, then the database
columns that code uses. I checked those columns against the table definitions in the code. Each
problem below comes from that reading. I fixed the clear-cut ones in a small, targeted way.

**Before release, someone needs to:** start the backend, run the frontend build
(`npx vite build`), and try each fix below once in a browser. None of the fixes has been run yet.

Several other people were changing the same shared files at the same time. All my changes were
small, and I checked afterwards that every one was still in place.

---

## Sidebar sections

### 1. Dashboard
- **What it does:** Summary counts (properties, vendors, work orders, estimates, employees) and
  the work-order "auto-delete" notifications.
- **Checked:** The screen's requests all match server routes. The server's summary is built so
  that one failing count shows 0 rather than breaking the page.
- **Status:** No broken links or requests found. One small quirk: the "customers" count reads an
  old `clients` table that FP customers aren't stored in, so it may always show 0. I couldn't
  confirm this without the database.

### 2. Add Customer
- **What it does:** Adds a property and its customer, and creates or links the customer's portal
  login.
- **Checked:** The requests match the server. This flow was reworked recently (the "one email,
  one account" rules) and the code follows those rules.
- **Status:** No new problems found. **Not testable locally:** activation and "you've been added"
  emails, because email (SMTP) isn't set up here.

### 3. Property Management
- **What it does:** Lists properties, edits, archives, restores, permanently deletes, and assigns
  vendors to each service on a property.
- **Broken → fixed:**
  - **Assigning a vendor failed for most properties.** Any property added through onboarding
    showed "Failed to assign vendor". The server asked the database for a `pincode` column that
    doesn't exist (the real name is `postal_code`).
  - One of the screen's two assign paths used a short web address. On the live site that
    address would go to the wrong server. I made it use the full server address like everything
    else.
- **Still open:** The server has an "assign employee to property" function that saves into a
  table nothing ever creates. The screen offers no button for it, so nobody can hit it today. It
  would need a decision before it is used.

### 4. Work Orders (Dashboard, All Work Orders)
- **What it does:** Create, view, edit, change status, assign a vendor or employee, delete, and
  (on completed orders) jump to the invoice.
- **Broken → fixed:**
  - **"Assign Employee" didn't work at all.** Clicking an employee showed "Route not found",
    because the server had no such function. I added it, matching the fix the Manager portal
    received for the same problem today. It saves the employee on the work order and moves a
    pending order to "assigned".
  - **"Assign Vendor" from the work-order list would have failed on the live site.** Same
    short-address problem as above; fixed.
  - **"Generate Invoice" on a completed order sent you back to the Dashboard.** It linked to a
    page that doesn't exist. It now opens **Billing › Generated Invoices**. A draft invoice is
    already created there automatically when a work order is marked completed.
- **Not testable locally:** The "work order completed" email.

### 5. Estimates / AMC (Dashboard, Create Estimate, All Estimates, AMC Packages, Add Service, Archived)
- **What it does:** Estimate creation (package or custom), sending, approving, archiving, AMC
  packages and the service catalogue.
- **Checked:** Every request on these screens matches a server route. The package price column
  is read correctly as `base_price`, and the "estimates for one property" filter works.
- **Status:** No broken requests found. **Not testable locally:** emailing an estimate to a
  customer.

### 6. Billing & Payments (Dashboard, Generated Invoices, Invoices, Make Payments, Payments, Payment History, Archived)
- **What it does:** Invoices, entering GST, sending invoices, recording and verifying payments,
  receipts, audit history and archived invoices.
- **Checked:** All requests from these shared screens match routes in the payments server code.
  Navigation stays inside the FP portal.
- **Status:** No broken requests found. The Generated Invoices file still contains an old,
  unused "create invoice" form that points at a server address that doesn't exist. It isn't
  shown anywhere, so it causes no harm, but it could be removed.
- **Not testable locally:** Razorpay payment links and online payments (no real keys), and the
  invoice and receipt emails.

### 7. Schedules (Dashboard, Pending Property Schedules, All Schedules, Calendar, Rescheduled Requests, Cancelled Schedules)
- **What it does:** Lists and manages service visits: scheduling, rescheduling, cancelling and
  restoring.
- **Broken → fixed:**
  - **Calendar never showed visits on the last day of a month.** The browser worked out the
    month's date range with a method that shifts dates back by one day in Indian time, so the
    range ended a day early.
  - **Restoring a cancelled visit didn't work.** Cancelled Schedules sent the restore to the
    wrong place, which handles an old, different kind of schedule. Users got "Failed to restore
    schedule", or in the worst case an unrelated old record was changed. It now restores the
    visit itself, back on the day it was booked for. **Shared:** this screen is used by every
    portal, so they all benefit.
  - **Rescheduling from "Rescheduled Requests" could fail.** The chosen time slot was sent as the
    label "09:00 AM - 10:00 AM", which the database's time field rejects. It is now sent as
    09:00 / 10:00.
  - **The reschedule mini-calendar had two problems.** Its day headings (Sun–Sat) didn't line up
    with the dates, because the week starts today rather than on a Sunday. Picking a day just
    after midnight could also book the previous day. Both are fixed.
  - **"This and future visits" rescheduling moved each later visit one day short** on a server
    running in Indian time. Fixed (server side).
- **Still open (needs a decision):** The reschedule panel's vendor availability dots and free or
  booked time slots are **random**. They are not real availability. A real availability function
  exists on the server but isn't connected to this panel.
- **Still open:** The "restore visit" server function doesn't check that the visit belongs to
  your franchise. This was already the case before this audit. Someone who knew another
  partner's visit number could restore it.

### 8. Vendor Management (Add New Vendor, Vendor Details, Assigned Vendors)
- **Broken → fixed:**
  - **"Archive selected" on Vendor Details always failed** with "Vendor not found or access
    denied". The server was checking that address against its "update one vendor" rule first,
    which treated the word "bulk-archive" as a vendor number. I reordered the rules so bulk
    archive is checked first.
  - **Assigned Vendors would have failed on the live site.** All its requests (list, change
    vendor, remove) used short addresses. Fixed. **Shared:** this page also serves the Manager,
    Coordinator, Supervisor and Executive portals, and they get the same fix.
- **Other actions checked** (add, edit, delete, restore, permanent delete, delete all archived):
  requests match the server.

### 9. Employee (Zone) Management (Add Employee, Employee Details, Employee Zone Management)
- **Checked:** The add, edit, activate/deactivate and delete requests, and saving zone
  assignments (zone names stored as text, as AGENTS.md requires), all match the server.
- **Status:** No broken requests found. **Not testable locally:** employee welcome emails.

### 10. Marketing (Dashboard, Tracker, Complaint Form, Archived)
- **Checked:** These screens share the server code used by the Admin and Manager portals. That
  code already has its own automated tests (which I could not run here).
- **Status:** No broken requests found. **Not testable locally:** complaint notification emails.

---

## What you need to do / decide
1. **Run the build and try the fixes** before release, since none of them has been run (see the
   top of this report).
2. **Apply database migration `schema_v57_work_order_assigned_employee.sql`** on the server. It
   adds the "assigned employee" column to work orders. Another auditor added it today. The new
   FP "Assign Employee" function also adds the column itself if it's missing.
3. **Decide** whether the reschedule panel should show real vendor availability instead of the
   random placeholder.
4. **Decide** whether "assign employee to a property" should exist. If yes, it needs a real
   table.
5. **Consider** adding a franchise ownership check to "restore visit".

---

## Technical appendix — files changed

| File | Change |
|---|---|
| `backend/routes/franchisePartner.js` | Moved `PUT /vendors/bulk-archive` above `PUT /vendors/:id` (route shadowing). `pincode` → `postal_code` in `POST /properties/:id/assign-vendor`. New `PATCH /work-orders/:id/assign-employee` (FP-scoped; checks for the column through information_schema and adds it if missing, same as the Manager route). |
| `backend/routes/schedules.js` | `POST /visits/:visitId/restore`: a cancelled visit with no `original_date` restores to its own `scheduled_date`. `PUT /visits/:visitId/reschedule` (this_and_future): shifted date formatted from local parts instead of `toISOString()`. |
| `admin-portal/src/pages/FPWorkOrders.jsx` | Assign request uses `${API_BASE}`. "Generate Invoice" → `/fp/billing/generate-invoices`. |
| `admin-portal/src/pages/FPProperties.jsx` | Assign request uses `${API_BASE}`. |
| `admin-portal/src/pages/AssignedVendors.jsx` (shared) | `apiPrefix` now includes `${API_BASE}`. |
| `admin-portal/src/pages/schedules/CancelledSchedulesPage.jsx` (shared) | Restore → `/api/schedules/visits/:id/restore`; success message updated. |
| `admin-portal/src/pages/schedules/ScheduleCalendar.jsx` | Month range built from year/month digits. |
| `admin-portal/src/pages/schedules/RescheduleServicePage.jsx` (shared) | Time slot sent as 24-hour `HH:MM` start and end; day keys via `toDateInputValue`; weekday headings follow the actual dates. |
| `docs/portal-reports/fp-portal.md` | This report. |

No migrations were written or applied by me. No data was created or deleted. No backend instance
was started, so there is none to stop on port 5003.

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
