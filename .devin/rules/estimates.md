---
description: Rules for estimate creation, view modals, tables, and PDF exports across all admin portals
tags: estimates, addons, pricing, tables, pdf, portals, ui
---

# Estimate UI Rules

Applies to: `CreateEstimate.jsx`, `ManagerEstimates.jsx`, `CoordinatorEstimates.jsx`, `ExecutiveEstimates.jsx`, `SupervisorEstimates.jsx`, `FPEstimates.jsx`, and `Properties.jsx` view sections.

## Estimate Structure (Create Estimate)

Every create-estimate form opens with the shared `components/estimates/EstimateStructure.jsx` card — two equal tiles, **Select AMC Package** ("Choose a pre-built AMC package and customize") and **Build Custom Services** ("Add individual services as per requirement"), with the page's own package dropdown passed in as children and shown only in package mode. It is wired into FP (property-based and direct), Manager, Coordinator, Supervisor and Executive; the admin `CreateEstimate.jsx` keeps its own equivalent card.

- Switching structure clears what belongs to the other choice: going custom clears the selected package, going back to package clears the custom rows. Neither a package price nor a hand-entered row may sit hidden in the total.
- **In package mode the configured-service dropdown sits beside the package dropdown**, so both ways of putting a service on the estimate are chosen in one place. `ServiceCatalogPicker` takes `inline` for this: it drops the blue panel and the `max-w-md` cap and matches the package dropdown's grey-bordered style. A form's package dropdown must be stacked (label above select) or it will not line up with the picker beside it.
- **Catalog access is the constraint, and only three endpoints exist**: `/api/admin/service-catalog` (`adminOnly`, which includes the Operations Manager), `/api/manager/service-catalog` and `/api/fp/service-catalog`. So the configured-service controls are wired in **FP, Manager and Admin/Ops Manager (`CreateEstimate.jsx`, both property-based and direct)**. **Coordinator, Supervisor and Executive have no catalog endpoint**; they get the plain Add Service button only. Giving them configured services needs new backend routes and an RBAC decision — do not add a picker there against a path that does not exist.
- Every portal with catalog access offers **edit as well as remove** on a configured-service row, through the picker's `editing` prop. A legacy add-on row keeps remove only: it carries a fixed price and no inputs to re-price. In `CreateEstimate.jsx` the two kinds share one `selectedAddons` array, so the edit action is gated on `addon.catalogServiceId`.
- The legacy add-on dropdown is labelled **"Add-on Service"**, never "Add Service" — that name belongs to the configured-service control alone, and having both caused exactly the confusion this rule exists to prevent.
- An unchosen dropdown renders in **grey** (`text-gray-400`) and switches to normal text once a value is picked, so it is not mistaken for one holding a value. Set the dark colour on the `<option>` elements explicitly or Firefox inherits the grey into the open list.
- A package estimate still requires its package. A custom estimate requires no package (`package_id` is sent as `null`) but at least one service.
- **Build Custom Services shows `components/estimates/CustomServicesTable.jsx`**: only real rows, added on request. Columns are `#`, Service, Input / Details, Frequency, Visits / Year, Customer Price (₹), Action. Deliberately absent, per the reference screenshots: Import Services, Method, Vendor Cost and Margin. The table no longer trails a permanently empty row — one that was numbered like a real row and had an empty Action cell, which kept being read as a service whose edit and delete were missing.
- **There is exactly one Add Service button, and it sits in the bar below the table**, not in the Action column — that column was too narrow and clipped the label in half. The Total Custom Services footer appears once there is a row.
- Where a portal has catalog access, that button is **the catalog menu, not a plain button**: `ServiceCatalogPicker` with `variant="menu"` renders it and lists **Custom** above the configured services. Custom appends a blank row; a configured service opens the usual pricing dialog. Pass it through the table's `addControl` prop. This replaces the separate Configured Service panel in custom mode, which offered the same list twice. Wired in FP; portals without catalog access get the default button, which appends a blank row directly.
- A blank row (no name) **opens for typing by itself** — that is how `blankCustomService()` works, so a caller only has to append one. Discarding a row that was never filled in removes it rather than leaving it empty.
- Every row carries **edit and remove**. Edit reopens the six fields with confirm/cancel in the Action cell and keeps the row's `addonId` so it stays in place; cancel restores what was there. Working values are held locally, so a half-finished row never reaches the estimate. Enter confirms.
- **Add Service is never disabled.** A blank service still cannot be added, but pressing the button says what is missing ("Enter a service name.", "Enter a customer price for this service.") in the bar beside it. A greyed-out button here reads as broken rather than as waiting for input, so validate on the press instead of disabling.
- The entry row's fields carry **no box at rest** — transparent border and background, a faint border on hover so the cells stay discoverable, and a visible border plus ring only while focused. Number spinners are removed; they draw a second box inside the cell.
- Nothing else on a create-estimate screen may be labelled "Add Service". `ServiceCatalogPicker` is **Configured Service** (its default) everywhere — FP once overrode it to "Add Service", which put two identically named controls on the same card for two different actions: one commits a typed row, the other adds a catalog service.
- The table uses the page's neutral card style — white surface, `slate-50` header and footer bars, `gray-200` borders, `gray-500` uppercase column labels. It is not blue-themed; the earlier blue border/bar/header made it look like a different application.
- `title` is `null` wherever the hosting card header already reads "Custom Services" (FP, Coordinator, Supervisor, Executive), so the heading never appears twice. Manager's card has no header, so it keeps the default.
- Custom rows are **free text**, not catalog services: the Service name and details are typed and the customer price is entered directly, so there is no vendor rate, method or margin behind them. Picking a frequency fills Visits / Year from the shared `FREQUENCY_OPTIONS`, and it stays editable.
- The configured-service dialog states **only the Customer Price, in green**. Vendor Cost, XLAND Operating Cost, Actual Cost, Markup and Margin are internal to the service configuration and must not appear there — the XLAND Operating Cost input stays, since it is an override rather than a figure being reported.
- The free-hand row belongs to custom mode only. In package mode, extra services come from the configured-service dropdown and its dialog, which remain available in both modes.
- Custom rows travel in the estimate's `addons` array shaped like a configured-service add-on (`addonId: 'CUSTOM-…'`, `customService: true`, `services[0].price` = per-visit), so the existing tables, view modals and PDFs render them unchanged. `isManualService` / `normalizeManualService` in `backend/utils/estimateData.js` bound the name, details, frequency, visits and price on save; the FP and Manager `validatePackageEstimate` middlewares now engage for them and add them to the server-computed subtotal, so a custom-only estimate still has its totals verified.

## Add-on Pricing Display

- Individual add-on prices **must not** be displayed in the Create Estimates section. The one exception is the Customer Price column of the Custom Services entry table above, where the price is the value being entered.
- Add-on dropdowns: show only the add-on name; do **not** show the price.
- Selected add-ons table columns: **Service**, **Frequency**, **No. of Visits**, **Action**. Remove the **Price** column.
- Show only a **Total Add-ons Price** row at the bottom that displays the sum of all selected add-ons.
- View estimate modals: show add-on names and frequency only, with **Total Add-ons Price** at the bottom.
- AMC Package price and Total price must still be displayed.

## AMC Package Display

- Do **not** display the AMC package name in view modals or in create estimate forms after selection.
- The package section must show only **"Yearly Billing"** text and the price.
- The package selection dropdown may still show the package name for selection purposes.

## AMC Package Services Table (Create Estimate)

| Column | Width | Alignment |
|---|---|---|
| Service | 12% | left |
| Description | 53% | header center; cell center when empty (dash), left when content exists |
| Frequency | 20% | left |
| Visits | 15% | center |

## AMC Package View Modal (Services Included)

Use the following grid layout:

- `#`: `col-span-1`
- `Service`: `col-span-3`
- `Description`: `col-span-5`
- `Frequency`: `col-span-2`
- `Visits`: `col-span-1`

Header alignment:

- `#`, `Service`, `Frequency`, `Visits`: center
- `Description`: center

Row rules:

- Description cell: use `${!svc.description ? 'text-center' : ''}` so empty values show a centered dash.
- Frequency shows the **type only** (e.g., `Monthly`).
- Visits shows the **count only** (e.g., `12`).
- Never combine them into a single value such as `12x Monthly`.

## Add-ons Table

| Column | Width | Alignment |
|---|---|---|
| Service | 10% | left |
| Description | 48% | center (header) |
| Frequency | 18% | center |
| Visits | 14% | center |
| Action | 10% | center |

All headers are center-aligned except **Service**, which is left-aligned. Frequency and Visits cells are center-aligned in rows.

## Frequency Display Format

- In tables: use separate **Frequency** (type) and **Visits** (count) columns.
- In inline text: use `{frequencyType} - {count} visits`. Example: `Monthly - 12 visits`.
- Do **not** use `12x Monthly` or similar combined formats.

## PDF and Email

- Frequency column: type only. Strip any `Nx ` prefix if present.
- Visits column: count only.
- Email format: `Monthly - 12 visits`.

## View Modal and PDF Layout Order

1. Estimate Details (ID, Type, Created Date)
2. Property Details (with type-specific fields for GC, APT, VILLA, FLAT, PLOT)
3. Customer Details
4. AMC Package (price and description only; no package name)
5. Package Services table: `#`, Service, Description, Frequency, Visits
6. Add-on Services table: `#`, Service, Description, Frequency, Visits + Total Add-ons Price
7. Price Summary (Subtotal, Discount, GST, Total)
8. Description / Notes (after Price Summary)
9. Created By info

## Backend Requirements

All employee routes must parse the `addons_data` JSON and enrich add-ons with descriptions from the `fp_addons` table.
