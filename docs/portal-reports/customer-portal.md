# Customer Portal — Audit Report

## Before you read

**Which code this covers.** The audit brief named `admin-portal/src/components/CustomerLayout.jsx`
as the customer portal. That file is **not used anywhere**: nothing imports it, and the same goes for
`admin-portal/src/pages/CustomerDashboard.jsx`. Both are leftovers. The portal your residents
actually use is the separate **`frontend/`** app. Its menu is the bottom bar
(`frontend/src/components/BottomNav.jsx`) plus the header, and its pages live under `/dashboard`.
This report audits that app. The two leftover files are harmless but could be deleted. That is your
call.

**How it was checked.** This audit ran in a restricted mode. **No program could be run**: not the
backend server, not the database client, not `curl`, not the automated tests, and not the frontend
build. Every one was blocked. So I did not create a test customer, log in, or click through any
page. Everything below comes from reading the code line by line, from each screen through the
server route to the database query. Each query was compared with the table definitions the app
creates (`backend/config/database.js`, the schema files and migrations). The live database was not
available to compare against.
**All fixes below are therefore untested.** Before relying on them, someone should:

1. run `node --test backend/routes/customerSchedules.test.js backend/routes/customerPortalSecurity.test.js`;
2. build the portal (`cd frontend && npx vite build --outDir /tmp/build-cust`);
3. sign in as a customer and click through each section.

---

## Section by section

### Sign in / account activation (Login, Activate, Forgot / Reset Password)
*What it does:* the resident activates their account from the emailed link, sets a password, then
signs in.

*What I found:*
- **Sign-in could fail for every customer.** The sign-in step looks up the property's "division" in
  a database column that the app's own database setup never creates. On a database where that column
  is missing, every sign-in fails with a server error before the password is even checked. The
  complaint form had already hit and fixed the same mistake. The profile lookup had it too.
  **Fixed** by reading the column that does exist.
- **A customer could be shown the wrong property after signing in.** Properties are stored in two
  separate tables, and each numbers its rows from 1. The sign-in step matched on the number alone, so
  a customer of property #5 in one table could be shown property #5 from the other table: wrong name,
  wrong property ID on the welcome banner. **Fixed:** the property code, which is unique, is now used
  whenever the account has one.
- **Signing out left the login key behind in the browser.** Suppose a second person then signed in
  on the same browser through the old "residents" login, which stores no key of its own. They were
  shown the previous customer's invoices and work orders. **Fixed:** signing out, and starting a new
  sign-in, now clear the old key.
- Two "missing field" error replies left a database transaction open. That is harmless today but
  untidy. **Fixed.**
- *Not testable locally:* the activation and password-reset emails, because email is not configured
  locally.

### Home (Dashboard)
*What it does:* welcome banner with the property, a Work Orders summary, Upcoming Schedule,
Payments due, Recent Activity, and any service renewals waiting for approval.

*What I found:*
- **Staff logins were accepted as customer logins.** Staff and customers share the same kind of
  login key. Most customer screens checked that a key was genuine but not that it belonged to a
  customer. A staff member or vendor whose own user number was, say, 7 could therefore read customer
  #7's dashboard, invoices, work orders, schedule and complaints, and could even file a complaint as
  them. **Fixed** on every customer screen: only a customer login is accepted now. The "raise a work
  order" form already had this protection; the rest did not.
- **An expired login produced a server error** instead of "please log in again". **Fixed** by the
  same change.
- **Deactivated customers kept access for up to a day.** If staff removed a customer's property, the
  customer's existing login still worked on most screens until it expired. **Fixed:** inactive
  accounts are refused at once.
- **The same "two tables, same number" mix-up** could make a customer's dashboard count, or list,
  another household's work orders and invoices. **Partly fixed.** The customer's property is now
  identified by its unique code first. An invoice that carries a different property's code is never
  shown to them, even if the number matches. See "Still open" for the part that cannot be fixed in
  code alone.
- **Work order attachments did not open.** The link was built from the file's location on the
  server's hard disk, not from a web address. **Fixed** in the portal. The production web server also
  needs to pass `/uploads/` requests through to the backend. That is a one-line server setting
  (decision needed, see below).
- **Staff-only notes were sent to the customer's browser.** The work-order list sent the internal
  "admin notes" field. The screen never displayed it, but anyone looking at the raw data could read
  it. **Fixed:** it is no longer sent.
- Renewal approve/decline: the code looked correct. Not exercised.

### Work Orders (raise a request)
*What it does:* the resident picks a category, describes the problem, attaches photos and submits.

*What I found:*
- **Some customers could not raise a work order at all.** If the customer's property was added
  through the franchise partner's "Add Customer" screen, it sits in the second property table. The
  lookup for that table asked for the same missing "division" column as sign-in, so every request
  failed with "Database error". **Fixed.**
- **Requests could go to the wrong franchise partner.** Because of the two-tables mix-up, a request
  could be filed against another household's property, and so reach that property's franchise
  partner and zone team. **Fixed:** the unique property code is looked up first.
- *Not testable locally:* the notification emails to the partner, the zone staff and the customer.

### Payments
*What it does:* lists the customer's invoices (AMC and work-order). Each can be opened for detail.
The customer can pay online (Razorpay), or report a cash, cheque or bank-transfer payment for staff
to verify. Receipts can be viewed and downloaded once paid.

*What I found:*
- **The GST rate always read "GST (0%)".** This showed even when 18% had been charged, because the
  server read the rate from a column name that does not exist. The GST amount itself was right.
  **Fixed.**
- **A receipt could fail to open** on a database where no staff payment screen had run yet. It reads
  an "archived" column that nothing creates at start-up. **Fixed:** the check that adds the column
  now runs first.
- The invoice ownership checks now also refuse an invoice that carries a different property's code.
- Online payment and the "already paid" checks were reviewed against the rules in AGENTS.md:
  - Razorpay is told the invoice under the key its notifications read.
  - The amount comes from Razorpay, not from the browser.
  - A payment cannot be replayed against another invoice.

  No problems found.
- *Not testable locally:* Razorpay (it needs real keys), and the email that tells the partner an
  offline payment is waiting for verification.

### Schedules
*What it does:* a read-only list and calendar of the service visits booked for the property.

*What I found:*
- **A customer could see another property's visits.** Same two-tables mix-up: someone added through
  the franchise partner's screen could have the visit list of the household whose property number
  matched theirs. **Fixed:** the code is used first. A property that only exists in the second table
  (so it has no booked visits) now correctly shows an empty schedule.

### More → Contact / Help (complaints)
*What it does:* phone, email and address details, a form to file a complaint, and the status of the
customer's own complaints.

*What I found:*
- **Complaints could be filed against the wrong partner and zone** (two-tables mix-up again).
  **Fixed:** the code is matched first.
- The complaint list is correctly limited to the person who filed each complaint.
- *Not testable locally:* the acknowledgement and status emails.

### Notification bell
*What it does:* updates about the customer's work orders, complaints and so on.

*What I found:* it only shows notifications meant for this customer, and mark-as-read works on the
same set. No problems. The staff-login fix above applies here too.

---

## Still open / needs a decision

1. **Property numbers clash between the two property tables.** This is the root cause of several
   fixes above. Work orders store only the property *number*, with no code beside it. So a work order
   for property #5 in one table looks exactly like one for property #5 in the other. A customer can
   still be shown the other household's work orders when the numbers clash. The real fix is to record
   which table (or which code) every work order belongs to. That is a data-model change and needs
   your go-ahead.
2. **Attachments in production:** the web server only forwards `/api/` addresses to the backend.
   For attachment links to open, it also needs to forward `/uploads/`. This is a server-configuration
   change for whoever manages hosting.
3. **The staff portals' attachment links** (FP, Manager, Coordinator, Supervisor, Executive work
   orders) build their links from the same disk location, so they are probably broken too. I did not
   change them; they belong to other portals.
4. **One email = one property.** A resident with two properties only ever sees the most recently
   added one. This is already documented as a known limitation.
5. **Unused leftovers:** `admin-portal/src/components/CustomerLayout.jsx` and
   `admin-portal/src/pages/CustomerDashboard.jsx`. They could be removed.
6. **Everything in this report needs a real test run** (see "Before you read").

---

## Technical appendix — files changed

- `backend/routes/customers.js`
  - `isCustomerToken()` added. `authenticateCustomer` and the nine inline-auth routes now require
    `role === 'customer'`:
    - `/profile`, `/dashboard`, `/work-orders`, `/invoices`, `/invoices/:id`
    - `/invoices/:id/initiate-payment`, `/create-order`, `/verify-payment`,
      `/offline-payment-intent`
  - This also turns a `null` from `verifyToken`, which never throws, into a 401 instead of a 500.
  - The inline account lookups now add `AND is_active = 1`.
  - `resolveCustomerProperty` tries the property **code before the id**. `customerOwnsInvoice` and
    the inline copies in `/work-orders`, `/invoices/:id`, `/create-order` and
    `/offline-payment-intent` now call it. `/work-orders` also uses `customerWorkOrderScope`.
  - `resolveOnboardedPropertyId` (schedules, activity) is code-first, and returns `null` for a code
    that names a `properties` row.
  - `customerInvoiceScope` and every in-route invoice access check refuse a numeric `property_id`
    match when the invoice carries a different `property_code`.
  - `/login`: `p.division` became `p.division_id`, and the joins are made by code when the account
    has one.
  - `/profile`: same changes as `/login`.
  - `POST /complaints`: properties joined by code when present.
  - `taxPercentage` reads `tax_percentage` (it was the non-existent `tax_percent`), in the list and
    detail routes.
  - `wo.admin_notes` removed from the customer work-order list.
  - `loadCustomerPayment` awaits `ensurePaymentColumns()`.
  - `conn.rollback()` added before early 400s in `POST /create` and `POST /set-password`.
- `backend/routes/workOrders.js` (shared file; only the customer `POST /` changed)
  - The property is looked up code-first, with the numeric id bound only for all-digit values.
  - The `properties` fallback selects `division_id as division`, replacing the failing
    `COALESCE(division_id, division)`.
- `backend/routes/customerSchedules.test.js`
  - Test tokens now carry `role: 'customer'`.
  - Asserts that a staff token and a malformed token are refused with 401.
- `frontend/src/App.jsx`: logout removes `customerToken` from localStorage.
- `frontend/src/pages/Login.jsx`: a stale `customerToken` is cleared at the start of each sign-in.
- `frontend/src/pages/Dashboard.jsx`: the attachment URL is now `/uploads/<file_name>`; it was
  built from the server's file path.
- `frontend/vite.config.js`: dev proxy for `/uploads`.
- No migration was added and no data was created or deleted.
- Not verified (execution was blocked):
  - `node --test backend/routes/customerSchedules.test.js backend/routes/customerPortalSecurity.test.js backend/routes/loginCandidates.test.js backend/utils/invoiceColumns.test.js backend/utils/halfPayment.test.js backend/routes/razorpayRefund.test.js backend/routes/paymentReceiptRoutes.test.js`
  - the frontend build.
- The new `CASE … THEN p.property_id = ca.property_code` joins compare text columns across tables.
  On a production database whose tables were created with different collations, MySQL could reject
  them with "Illegal mix of collations". Locally every table uses the default collation.

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
