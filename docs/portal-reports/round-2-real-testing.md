# Round 2 — Real Testing (what was actually clicked, saved and paid)

The first round of agents could only read code. In this round everything was **run for real**
on the local copy of the system: real logins, real saves, real emails (caught in a fake mailbox),
simulated online payments, and an automated browser opening every page of every portal.

## How it was tested (in plain terms)

- **Saving, editing, deleting:** a robot user logged into each portal and did what staff do — added a
  customer, edited the property, created a vendor, raised a work order, assigned an employee and a
  vendor, moved it to In Progress and Completed, created invoices, recorded payments, verified them,
  archived and restored things. Everything it created is labelled `TEST-`.
- **Emails:** instead of sending real emails, the system was pointed at a "fake mailbox" on this PC
  that keeps every email. 154 emails were captured and checked for the right recipient, wording and links.
- **New staff accounts:** the Franchise Partner created a Manager, Coordinator, Supervisor and Executive.
  Their temporary passwords were read from the welcome emails, used to log in, and changed — exactly as
  a new employee would.
- **Online payments (Razorpay):** without your Razorpay keys, the system was sent correctly signed
  "payment received" and "refund" messages, the same way Razorpay sends them, to check that our side
  records the money correctly.
- **Browser:** an automated Edge browser logged into all 8 portals and opened every sidebar page,
  watching for crashes, blank pages, error messages and failed requests.

## Results

| Area | Checks | Result |
|---|---|---|
| Franchise Partner — customers, zones, employees, vendors, work orders | 25 | all pass |
| Billing — invoice, send, part payment, verify, receipt, archive, delete rules | 17 | all pass |
| Manager / Coordinator / Supervisor / Executive — same actions in each | 16–21 each | all pass (see "decisions") |
| Admin & Ops Manager — Add Customer, property edits, work orders, full payment | 27 | all pass |
| Customer — activation email, set password, sign in, every screen, raise work order, complaint, password reset | 17 | all pass |
| New employee accounts — welcome email, first login, change password | 18 | all pass |
| Online payments — fake/unsigned payment refused, payment, repeat delivery, partial refund, final settlement | 16 | all pass |
| Browser — every sidebar page in all 8 portals | 234 pages | no crashes or errors left |
| Automated tests | 494 | all pass |

## Problems found and fixed in this round

**Money**
1. **Verifying a payment always failed.** On every portal's Payments screen, pressing *Verify* returned
   an error and the invoice was never updated — the customer's payment stayed "pending" forever.
2. **Recording a payment could fail with a duplicate number.** Payment and invoice numbers are counted
   separately per franchise partner, but must be unique across the company. The second partner (or head
   office) to reach number 1 got an error — and for an online Razorpay payment, the payment was
   **thrown away**. Numbers now skip to the next free one.
3. **Anyone could fake an online payment.** If a "payment received" message arrived *without* Razorpay's
   security signature, the system accepted it and could mark any invoice as paid. It is now refused.
4. **Deleting an unpaid invoice failed** if the customer had started (but not finished) a payment.
5. **Invoice emails said "GST (0%)"** even when 18% GST was charged, and lines typed by hand showed as a
   blank "Service". The PDF had the same GST label problem.

**Staff portals**
6. **The Marketing Dashboard was a blank page** for Manager, Coordinator and Executive — any franchise
   with no tracked estimates yet (i.e. every new one).
7. **Executive → All Estimates would crash** as soon as there was an estimate to show.
8. **Creating a zone failed in every portal** — the database table for zones did not exist on a fresh
   system. Zones created by Coordinators, Supervisors and Executives also could not be deleted.
9. **A property added through FP "Add Customer" could not be edited**, and vendors could not be assigned
   to it, until it had an estimate.
10. **Manager and Coordinator "Add Vendor" ignored the Company Name** you typed.
11. **Coordinators saw every estimate of the franchise** instead of only their zones (same leak that was
    fixed for the other roles in round 1).
12. **Manager → Properties showed an "Assign Vendor" button that always failed** for franchise managers
    (the system does not allow it for them). The button is now hidden.
13. **Admin/Ops → Vendor Details → "Archive selected"** archived the vendors but then showed
    "Failed to archive vendors" and did not refresh.
14. **The Ops Manager could permanently delete work orders** through the system, although their screen
    hides the Delete button. Now only Admin can.
15. **New employees' welcome email said "role of Employee"** instead of Manager / Coordinator / etc.
16. The **Set Password** screen and the admin **Property Management** list used a short web address that
    only works because of how the live server is set up; they now use the full address like the rest.

## Database updates for the live server

Run these on the live database, in order (each is safe to run twice). The server also applies them
by itself when it starts, if its database user is allowed to:

- `schema_v57_work_order_assigned_employee.sql` (from round 1)
- `schema_v58_fp_addons_drift.sql` (from round 1)
- `schema_v59_fp_zones.sql` — creates the zones table
- `schema_v60_payments_invoice_id_nullable.sql` — lets an unpaid invoice be deleted

## Live server (xlandinfra.com) — checked without logging in

- Main site, customer login, admin site and admin login all load (under 1.2 seconds).
- All 10 private data addresses tested refuse visitors who are not logged in — so round 1's security
  fixes are live.
- **Not yet done:** logged-in checks and TEST- data on the live site — waiting for a live login. Note that
  the round 2 fixes above are **not on the live site yet**; they need to be pushed and deployed first,
  otherwise a live test would only re-find the same bugs.

## Still open / needs your decision

- **Real Razorpay** (creating payment links, the checkout window) needs your *test* keys.
- **"Closed" work-order status** is still accepted by the Manager and Coordinator systems. Decide whether
  "Closed" should exist (round 1 decision list).
- **Standalone Coordinators** (not under a franchise) are also refused "Assign Vendor" by the system while
  their screen shows the button.
- One automated test (`estimateDelivery.test.js`) occasionally fails only when all 494 tests run at once;
  it passes every time on its own. It is a timing issue in the test, not in the product.
- Small on-screen warnings (duplicate row keys on Employee Details, table spacing in Marketing Tracker)
  — cosmetic, no visible effect found.
