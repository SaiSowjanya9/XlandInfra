# Admin Portal: audit report

**Scope:** the admin sidebar defined in `admin-portal/src/components/Layout.jsx`: Dashboard,
Create Customer, Property Management, Work Orders (Dashboard, All Work Orders), Billing &
Payments (7 screens), Schedules (6 screens) and Categories.

## Before you read: how this audit was done, and its limits

1. **I couldn't run anything.** This audit ran in a restricted background session that blocked
   every command it needed. Starting the server, curl, the MySQL client, `node --test` and the
   Vite build were all refused. So none of the test-data steps happened: no `TEST-ADMIN-` records
   were created, and nothing was deleted. **Every finding below comes from reading the code**,
   following each screen through to the server and the database. The fixes are small and were
   checked by careful reading, but nobody has clicked through them yet. See "What still needs
   doing" at the end.
2. **The sidebar in `Layout.jsx` is not the one your admins use.** Nothing in the app loads that
   file. It also links to addresses (`/create-customer`, `/work-orders`, `/categories`…) that
   don't exist. When you log in as `admin`, you go through the Employee login and land on the
   **`EmployeeLayout.jsx`** sidebar at `/employee/...`. That sidebar has the same sections plus
   Estimates, Vendors, Employees, User/QR Management and Marketing. So for each item in the old
   sidebar I audited the **live screen** it corresponds to under `/employee/...`. The Ops Manager
   report covers the same live sidebar from that role's side.
   - `Layout.jsx`, `pages/Login.jsx`, `pages/WorkOrders.jsx` and `pages/Categories.jsx` are
     unused leftovers. **Decision for you:** they could be deleted. I left them alone.

---

## Dashboard (`/employee`)

**What it does:** headline figures for the whole company (or one franchise partner chosen in
the picker): properties, vendors, employees, work orders, estimates and invoices. It also shows
charts and a notification bell.

**What I checked:** every request the page makes. All of them go to server routes that exist
and need a login, except the notification bell.

**What was broken**
- **Anyone could read the bell's figures without logging in.** It showed things like "12 work
  orders pending action", and anyone who knew the web address could see that too. Several
  similar admin addresses had the same problem, and some were much more sensitive (see Work
  Orders below). All of them now need an admin login, and the dashboard sends that login with its
  requests.
- **Picking a date range with nothing in it showed the all-time total.** For example, the
  "Total Properties" and "Total Vendors" cards would show every property ever, instead of 0.
  They now show 0.

**Status:** fixed (not yet clicked through).

---

## Create Customer / Add Customer (`/employee/create-customer`)

**What it does:** onboards a new property and its contacts, then creates customer-portal logins
for the contacts and emails them an activation link.

**What was broken**
- **The main contact got two activation emails, and the first one didn't work.** The server
  already creates the main contact's login and emails them while saving the property. The screen
  then asked the server to do it again. The second request issued a new password and link, which
  silently cancelled the ones in the first email. So a customer who opened the first email got
  "invalid link" or "wrong password". If the contact already had an account, they got two "you've
  been added" emails instead. Now the screen only creates logins for the *extra* contacts, and
  shows the server's own result for the main contact (sent / could not be sent / account linked).

**Not testable locally:** the emails themselves, because email (SMTP) isn't set up on this
machine.

**Status:** fixed (not yet clicked through).

---

## Property Management (`/employee/customer-submissions`)

**What it does:** lists every property with view, edit, deactivate, restore and permanent-delete
actions.

**What was broken**
1. **Deactivating, restoring or permanently deleting one customer could hit a different
   customer too.** Properties live in two tables (older ones and ones added through Add
   Customer), and each table numbers its rows separately. So "property no. 5" can mean two
   different customers. The server acted on *both* tables, so deactivating one customer could
   also deactivate an unrelated one and lock them out of the portal. A permanent delete could
   delete an unrelated property. The list already knows which table each row comes from, so it
   now tells the server, and only that row is touched. If that information is missing, the old
   behaviour still applies.
2. **Edits to customers added through Add Customer were silently thrown away.** If you changed
   the contact person, phone, email, notes, landmark, watchman or unit details and pressed Save,
   you saw "Property updated successfully", but only the name and address were actually saved.
   All of those fields are saved now.

**Still open (needs your decision):** a permanent delete also detaches invoices, payments and
work orders by that same number, so the shared-number problem can still reach those records.
The project notes already list this as an open item, and fixing it properly needs a decision
about what a permanent delete should do.

**Status:** items 1 and 2 fixed (not yet clicked through).

---

## Work Orders: Dashboard (`/employee/work-orders/dashboard`)

**What was broken**
- **Choosing a franchise partner in the picker changed nothing.** The dashboard always showed
  the whole company's work orders, because the server ignored the choice. It now filters by the
  selected partner.
- **Some work orders appeared twice.** A work order whose property name matched more than one
  property was listed once per match, which inflated the counts. Each work order now appears
  once.

**Status:** fixed (not yet clicked through).

## Work Orders: All Work Orders (`/employee/work-orders`)

**What it does:** list, create, edit, change status, assign a vendor or employee, delete.

**What was broken**
1. **Assign Vendor and Assign Employee never worked.** Every attempt failed with "Error updating
   work order", because the server wrote to a database column that doesn't exist. Vendors are now
   saved where the vendor portal reads them, so the vendor actually sees the job. Employees are
   saved in the employee column (the server adds that column if it's missing, as the Manager
   portal fix already does).
2. **Work orders the admin created didn't show up in the franchise partner's portal.** The server
   looked up the property's partner and then never saved it. New admin-created work orders now
   carry the partner. Work orders created before this fix stay unlinked.
3. **Serious privacy and security hole: the work-order system was open to the public.** Without
   logging in, anyone who knew the addresses could:
   - list every work order with the customers' names, emails and phone numbers;
   - mark work orders complete, which emails the customer and raises an invoice;
   - create work orders and upload files;
   - assign, close or reopen work orders.

   The property list behind Add Customer and Create Estimate, with every contact's name, email
   and phone, was open in the same way. All of these now need a staff login, and the screens send
   it.
4. **The "work orders awaiting verification" list couldn't be reached.** Another route in front
   of it caught the request and replied "work order not found". That's fixed.
5. **When a status change was refused, nothing told you.** The dialog just stayed open. It now
   shows the error.

**Status:** all fixed (not yet clicked through).

---

## Billing & Payments

The billing screens are shared by six portals and are covered by many existing safeguards
(settlement, GST, refunds, payment methods). I traced the admin's version of each screen. Every
request goes to a server route that exists. Two things were broken:

- **Generated Invoices, "Work Order" tab: always empty for the admin.** It asked the franchise
  partner part of the server, which can't work for an admin (the admin isn't tied to a partner),
  so the request failed. It now uses the admin's own work-order list, follows the partner picker,
  and leaves out work orders that already have an estimate.
- **Create Invoice (reached from Generated Invoices and Invoices): "Search Property" always said
  "Property not found".** It asked the server for an address that never existed. This affected
  all six portals. It now uses the payments property lookup, which searches both property tables
  and respects partner boundaries. That lookup also had its own bug: it read a "name" column that
  customer accounts don't have, so it crashed for any property that had a portal login. Fixed.
- **Create Invoice's "Select Work Order" list mixed customers together.** It showed every
  property's completed work orders, not just the selected property's, so you could attach the
  wrong customer's job. The rows also showed a bare number instead of the WO- code, plus a blank
  category and date. The list is now filtered to the property, and rows show the WO- code,
  category and date.

**Not testable locally:** online payments (Razorpay needs real keys), and the invoice, receipt
and payment-link emails (no email set up).

**Note:** the coordinator can't use the billing screens (including Create Invoice's lookup) by
existing design. That's a permission decision the project notes say not to change without
asking.

---

## Schedules (Dashboard, Pending Property Schedules, All Schedules, Calendar, Rescheduled Requests, Cancelled)

I traced all six screens and every request has a matching server route. No admin-specific bugs
found.

**Needs a decision (cross-portal):** two admin schedule lists (`/api/admin/schedules/all` and
`/schedules/pending-properties`) accept *any* logged-in user, not just admins. Some shared
schedule screens fall back to these admin addresses when they don't recognise the portal. For
example, All Schedules opened from the executive portal does this, so that executive sees the
whole company's schedules. I didn't lock these to admins, because that would break those
screens until each portal gets its own address. The Executive report mentions fixing part of
this.

---

## Categories

The old sidebar's Categories page **doesn't save anything**. It's a fixed list built into the
page, and any changes vanish when the page reloads. The live admin sidebar doesn't include it,
and the categories actually used for work orders come from a fixed server file. **Decision for
you:** delete the page, or build a real category editor.

---

## What still needs doing

1. **Click through each fix once with the server running.** In particular:
   - Assign Vendor and Assign Employee on a work order;
   - Generated Invoices, Work Order tab;
   - Create Invoice: property search and work-order picker;
   - Property Management: edit, deactivate and restore;
   - Add Customer with one contact (expect exactly one email in the server log).
2. Run `node --check` on the four backend files below, and run the admin build. These were
   blocked in my session.
3. A database check that I couldn't run: Create Invoice's work-order picker uses an older
   work-order list (`GET /api/work-orders`). Its database query may be rejected by MySQL 8's
   strict grouping rules. If the picker shows an error, that query needs rewriting.
4. Decisions listed above: delete the unused files; build or remove Categories; what permanent
   delete should do; restrict the admin schedule addresses.

---

## Technical appendix: files changed

**Backend**
- `backend/routes/admin.js` (shared)
  - Added `authenticate, adminOnly` to `GET /work-orders`, `/vendors`, `/employees`,
    `/vendors/assignments`, `/dashboard/stats`, `/dashboard/recent-activities`,
    `/notifications`, `PUT /notifications/:id/read` and `/notifications/read-all`.
  - Added `authenticate, adminWriteRoles` to `POST /migrate-estimate-names`.
  - `GET /work-orders`: honours `?fpId=` and `?excludeWithEstimates=true`, and dedupes rows by
    `wo.id`.
  - `PUT /work-orders/:id`: `assignedTo` + `assignType` now write `assigned_vendor_id` (plus
    `assigned_at`/`assigned_by`) or `assigned_employee_id` (ensured via information_schema),
    instead of the non-existent `assigned_to`.
  - New `propertySourceTables(req)` helper; `DELETE /properties/:id`, `PUT
    /properties/:id/restore` and `DELETE /properties/:id/permanent` honour `?sourceTable=`.
  - `PUT /properties/:id`: added the onboarded contact, notes and watchman columns to the
    allow-list; JSON-stringifies `association_contacts`; skips undefined binds.
- `backend/routes/workOrders.js` (shared)
  - Added `authenticate` to `GET /`, `GET /:id` and `GET /:id/history`.
  - Added `authenticate, managerOrAdmin` to `PATCH /:id/status`, `POST /admin/create` (before
    multer), and the first `POST /:id/assign`, `/:id/close` and `/:id/reopen`.
  - `GET /:id` is guarded to numeric ids so `/pending-verification` is reachable.
  - `GET /` honours `?propertyId=`.
  - `POST /admin/create` now writes `franchise_partner_id`.
  - Known leftover: a second, authenticated `POST /:id/close` (verify-and-close) further down is
    still unreachable behind the first.
- `backend/routes/onboarding.js` (shared): added `authenticate` to `GET /` and
  `GET /lookup/:propertyId`.
- `backend/routes/payments.js` (shared): `GET /properties/by-code/:code` now selects
  `CONCAT_WS(first_name,last_name)` instead of the non-existent `customer_accounts.name`, and
  also returns `state`.

**Frontend** (`admin-portal/src`)
- `pages/Dashboard.jsx`: sends the token on the notification calls; date-filtered
  property/vendor counts no longer fall back to the all-time totals.
- `utils/propertyStore.js` (shared with ServicePortal): `getProperties`/`getPropertyById` send
  the token; `createCustomerAccounts` skips the primary contact (and duplicate emails) and
  reports the onboarding result for it.
- `pages/EmployeeWorkOrders.jsx`: sends the token on `/api/onboarding`, the status PATCHes and
  `/work-orders/admin/create`; sends `assignType` on assign; shows refused status changes.
- `pages/CustomerSubmissions.jsx`: passes `sourceTable` on deactivate, restore, permanent delete
  and edit.
- `pages/billing/GeneratedInvoices.jsx` (shared): the admin Work Order tab reads
  `/api/admin/work-orders`.
- `pages/billing/CreateInvoice.jsx` (shared by all six portals): property search uses
  `/api/payments/properties/by-code/:code`; the work-order picker reads snake_case fields.

**No migration added.** `work_orders.assigned_employee_id` is covered by the existing
`schema_v57_work_order_assigned_employee.sql` (added by another agent) and by the runtime
check.

**Tests and builds:** none could be run in this session, because the command tool was denied.
The suites that should be run are:
- `node --test backend/routes/paymentsVerify.test.js backend/routes/paymentReceiptRoutes.test.js`
- `node --test backend/utils/workOrderId.test.js`
- `node --test backend/utils/customerPropertyLink.test.js`
- `cd admin-portal && npx vite build --outDir /tmp/build-admin`

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
