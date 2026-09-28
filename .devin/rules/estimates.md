---
description: Rules for estimate creation, view modals, tables, and PDF exports across all admin portals
tags: estimates, addons, pricing, tables, pdf, portals, ui
---

# Estimate UI Rules

Applies to: `CreateEstimate.jsx`, `ManagerEstimates.jsx`, `CoordinatorEstimates.jsx`, `ExecutiveEstimates.jsx`, `SupervisorEstimates.jsx`, `FPEstimates.jsx`, and `Properties.jsx` view sections.

## Estimate Structure (Create Estimate)

Every create-estimate form opens with the shared `components/estimates/EstimateStructure.jsx` card — two equal tiles, **Select AMC Package** ("Choose a pre-built AMC package and customize") and **Build Custom Services** ("Add individual services as per requirement"), with the page's own package dropdown passed in as children and shown only in package mode. It is wired into FP (property-based and direct), Manager, Coordinator, Supervisor and Executive; the admin `CreateEstimate.jsx` keeps its own equivalent card.

- **Switching structure starts the other choice clean.** It clears the selected package, the hand-entered rows **and the services picked alongside either** — catalog rows and legacy ones — plus any row being edited. Clearing only the package and the custom rows is not enough: the configured-service picker is offered in both modes, so services added under a package reappeared under Build Custom Services as though the user had chosen them there. Neither a package price nor a service from the other mode may sit hidden in the total.
- **In package mode the configured-service dropdown sits beside the package dropdown**, so both ways of putting a service on the estimate are chosen in one place. `ServiceCatalogPicker` takes `inline` for this: it drops the blue panel and the `max-w-md` cap and matches the package dropdown's grey-bordered style. A form's package dropdown must be stacked (label above select) or it will not line up with the picker beside it.
- **Catalog access is the constraint, and only three endpoints exist**: `/api/admin/service-catalog` (`adminOnly`, which includes the Operations Manager), `/api/manager/service-catalog` and `/api/fp/service-catalog`. So the configured-service controls are wired in **FP, Manager and Admin/Ops Manager (`CreateEstimate.jsx`, both property-based and direct)**. **Coordinator, Supervisor and Executive have no catalog endpoint**; they get the plain Add Service button only. Giving them configured services needs new backend routes and an RBAC decision — do not add a picker there against a path that does not exist.
- Every portal with catalog access offers **edit as well as remove** on a configured-service row, through the picker's `editing` prop. A legacy add-on row keeps remove only: it carries a fixed price and no inputs to re-price. In `CreateEstimate.jsx` the two kinds share one `selectedAddons` array, so the edit action is gated on `addon.catalogServiceId`.
- The legacy add-on dropdown is labelled **"Add-on Service"**, never "Add Service" — that name belongs to the configured-service control alone, and having both caused exactly the confusion this rule exists to prevent.
- An unchosen dropdown renders in **grey** (`text-gray-400`) and switches to normal text once a value is picked, so it is not mistaken for one holding a value. Set the dark colour on the `<option>` elements explicitly or Firefox inherits the grey into the open list.
- A package estimate still requires its package. A custom estimate requires no package (`package_id` is sent as `null`) but at least one service.
- **A direct estimate has no property behind it, so every property field must fall back to what was typed.** A payload that reads `selectedProperty?.x` alone saves an empty column and the view modal then shows a dash — that is how Tower/Building Name, Flat Number and Plot Number went missing. Three traps, all found live: the tower input writes `blockName` while the payloads asked for `towerName`; **Villa, Flat and Plot share the single `villa_plot_number` column**, so send `villaNumber || flatNumber || plotNumber` and never one of them alone; and a modal must read that same column back rather than `flat_number` or `plot_number`, which do not exist. `fp_estimates` held all of these; the admin `estimates` table held none of them, so the Super Admin form collected a city, tower, block and unit count that no column could take — `schema_v37_estimate_property_fields.sql` adds them under the same names. `estimatesSync.js` writes only the columns the database actually has (`estimatePropertyColumns`), so a deployment that lags the migration still saves everything else instead of failing the whole estimate, and it maps the admin form's own names on the way in: `blockTower` → `tower_name`, `flatUnit` → `villa_plot_number`.
- **Number of Blocks can be emptied.** It starts blank and keeps whatever is typed, so backspace clears the field instead of snapping back to 1 — `parseInt(e.target.value) || 1` in the handler is what made the last digit impossible to delete. A blank count lists no block rows (`parseInt(…, 10) || 0`), and each payload sends `null` or its own fallback rather than `''`, which no INT column accepts. Applies to all six create-estimate forms.
- **Zone and City keep their type-or-select dropdowns** in FP and the admin `CreateEstimate.jsx`: `AutocompleteInput` with `allowCustom`, filled from `/api/onboarding/suggestions/zones` and `/cities`. They were briefly reduced to plain inputs to match Manager, Coordinator, Supervisor and Executive, and that was reverted — offering the zones and cities already in use is the point. Anything else those two forms ask about the property is a plain input.
- **Build Custom Services shows `components/estimates/CustomServicesTable.jsx`**: only real rows, added on request. Columns are `#`, Service, Input / Details, Frequency, Visits / Year, Customer Price (₹), Action. Deliberately absent, per the reference screenshots: Import Services, Method, Vendor Cost and Margin. The table no longer trails a permanently empty row — one that was numbered like a real row and had an empty Action cell, which kept being read as a service whose edit and delete were missing.
- **There is exactly one Add Service button, and it sits in the bar below the table**, not in the Action column — that column was too narrow and clipped the label in half. The Total Custom Services footer appears once there is a row.
- Where a portal has catalog access, that button is **the catalog menu, not a plain button**: `ServiceCatalogPicker` with `variant="menu"` renders it and lists **Custom** above the configured services. The menu is **drawn into `document.body` through a portal** with fixed coordinates measured from the button, because every card it sits inside clips its overflow — absolutely positioned, it was sliced mid-item and Custom was invisible entirely. It flips above or below the button depending on room, right-aligns, and closes on scroll or resize rather than drifting away from its anchor. Outside-click has to excuse the panel explicitly, since it is no longer inside the component's DOM subtree. Custom opens `CustomServiceDialog`; a configured service opens the usual pricing dialog. Pass it through the table's `addControl` prop. This replaces the separate Configured Service panel in custom mode, which offered the same list twice. Wired in FP; portals without catalog access get the default button, which appends a blank row directly.
- **Custom mode lists every service in one table, numbered straight through**, whichever way it was added. A catalog service picked from the Add Service menu appears in the Custom Services table after the typed rows, via the table's `extraRows` prop, and the package-side Services / Additional Services tables must not repeat it — gate them on a `tableCatalogAddons` that is empty in custom mode. The rows stay in the caller's own catalog array because the estimate payload prices them differently; only the display is unified. The footer is **Total Services** and covers both kinds.
- **Visits / Year is fixed by the frequency, never typed over it.** Each frequency carries its own annual count, so the field is read-only once one is chosen — a schedule and a visit count that disagree is not something an estimate should be able to say. **`Custom` is the single exception**: it has no count of its own, so picking it makes the field editable and keeps whatever figure was already there rather than resetting it. Use `isCustomFrequency` from `estimateStore.js`; `Custom` was previously called `Other`, and rows saved under that name behave identically.
- `Custom` belongs only where visits are **descriptive** — hand-entered services and package service rows. It must **not** appear in the service-configuration form or the catalog pricing dialog: `servicePricing.js` validates a catalog service's frequency against a fixed `FREQUENCIES` map and prices from the visit count, so an unknown frequency there fails `calculateServiceQuote`. Those screens already govern editability through the service's own **Allow Manual Visits** toggle. The backend's `normalizeManualService` accepts any frequency string up to 50 characters, which is why hand-entered services need no server change.
- A catalog row in that table is **not edited inline** — its figures come from the server — so the caller passes `renderExtraActions` to supply the pencil that reopens the pricing dialog, and the bin.
- A blank row (no name) **opens for typing by itself** — that is how `blankCustomService()` works, so a caller only has to append one. Discarding a row that was never filled in removes it rather than leaving it empty.
- Every row carries **edit and remove**. Edit reopens the six fields with confirm/cancel in the Action cell and keeps the row's `addonId` so it stays in place; cancel restores what was there. Working values are held locally, so a half-finished row never reaches the estimate. Enter confirms.
- **Add Service is never disabled.** A blank service still cannot be added, but pressing the button says what is missing ("Enter a service name.", "Enter a customer price for this service.") in the bar beside it. A greyed-out button here reads as broken rather than as waiting for input, so validate on the press instead of disabling.
- The entry row's fields carry **no box at rest** — transparent border and background, a faint border on hover so the cells stay discoverable, and a visible border plus ring only while focused. Number spinners are removed; they draw a second box inside the cell.
- Nothing else on a create-estimate screen may be labelled "Add Service". `ServiceCatalogPicker` is **Configured Service** (its default) everywhere — FP once overrode it to "Add Service", which put two identically named controls on the same card for two different actions: one commits a typed row, the other adds a catalog service.
- The table uses the page's neutral card style — white surface, `slate-50` header and footer bars, `gray-200` borders, `gray-500` uppercase column labels. It is not blue-themed; the earlier blue border/bar/header made it look like a different application.
- `title` is `null` wherever the hosting card header already reads "Custom Services" (FP, Coordinator, Supervisor, Executive), so the heading never appears twice. Manager's card has no header, so it keeps the default.
- Custom rows are **free text**, not catalog services: the Service name and description are typed and the customer price is entered directly, so there is no vendor rate, method or margin behind them. Picking a frequency fills Visits / Year from the shared `FREQUENCY_OPTIONS`.
- **A hand-entered service is filled in through `components/estimates/CustomServiceDialog.jsx`, not in the table row.** A row carries more than a row can hold: Service, Description (the column formerly headed Input / Details), Category, Quantity (Nos), Frequency, Visits / Year, Customer Price and a Vendor Required toggle. OK adds all of it as one row, and the row's Edit action reopens the same dialog on it. Category is the catalog's own list through `AutocompleteInput` with `allowCustom` and `showAllOnOpen`: a category typed here is offered for the rest of the session at once, is stored on the estimate, and comes back in the list afterwards because `serviceCategories.js` also reads the categories used by saved estimate services -- still no table of its own. Visits / Year follows the frequency and is read-only unless the frequency is Custom. Quantity describes what the entered price covers; it does not multiply it, because the price on a hand-entered row is the customer price as typed. `normalizeManualService` bounds quantity, category and the vendor flag on save alongside the name, description, frequency, visits and price. The dialog is opt-in through the table's `onEditRow` prop, so Manager, Coordinator, Supervisor and Executive keep adding a blank row and editing it in place.
- **A configured service settles nothing about itself on the estimate.** The pricing dialog asks only for the figure the method prices from, the frequency (behind the override checkbox) and the visits it implies. Quantity Based once also asked for Category and Vendor Required; both are gone from the dialog, so every field of a catalog row is rebuilt from the catalog on save and nothing about the service is read back from the request — that is what stops a client altering a saved service. Category comes from the service, and whether a vendor is assigned comes from its "Do Not Assign Vendor" configuration. A per-estimate Vendor Required answer exists on hand-entered rows only.
- The configured-service dialog states **only the Customer Price, in green**. Vendor Cost, XLAND Operating Cost, Actual Cost, Markup and Margin are internal to the service configuration and must not appear there — **including the XLAND Operating Cost input**, which was once allowed as an override and is no longer: what XLAND spends running a service is not something an estimate screen asks for. The service's configured `default_operating_cost` is still carried into the quote, just not shown or editable.
- The free-hand row belongs to custom mode only. In package mode, extra services come from the configured-service dropdown and its dialog, which remain available in both modes.
- Custom rows travel in the estimate's `addons` array shaped like a configured-service add-on (`addonId: 'CUSTOM-…'`, `customService: true`, `services[0].price` = per-visit), so the existing tables, view modals and PDFs render them unchanged. `isManualService` / `normalizeManualService` in `backend/utils/estimateData.js` bound the name, details, frequency, visits and price on save; the FP and Manager `validatePackageEstimate` middlewares now engage for them and add them to the server-computed subtotal, so a custom-only estimate still has its totals verified.

## Add-on Pricing Display

- Individual add-on prices **must not** be displayed in the Create Estimates section. The one exception is the Customer Price column of the Custom Services entry table above, where the price is the value being entered.
- **The payments dashboard carries a Cost & Margin panel**, above Quick Actions: Vendor Cost, XLAND Cost, Customer Price and Margin % across the **active property-based** estimates, with a row per estimate beneath. A direct estimate has no property to measure against and an archived or rejected one is not work we expect to bill, so neither is counted. `GET /api/payments/property-estimate-margins` aggregates it server-side from the pricing snapshot saved with each service (`backend/utils/estimateMargins.js`, tested), and an FP-scoped user sees only their own. **Admin, Operations Manager and Franchise Partner only** — `canViewEstimateMargins`, not `canViewPayments`, because a Manager, Supervisor, Executive or Coordinator may view payments and still has no business with vendor cost or margin. Those four get 403, verified by role; the panel is also not rendered or even requested for them, so hiding it is not the only thing stopping them. **The headline totals count only estimates that carry costs**: an estimate of hand-typed services has a price and no cost, so including it would report a margin approaching 100% for work with no cost evidence. Those are counted as `uncostedCount`, named in the panel and still listed.
- **The services table is drawn in the cream skin, not green.** Its header, footer, row numbers and method badges are warm tints (`bg-warm-section`, `bg-warm-accent-soft`, `border-warm-border`) and its figures read in `text-warm-text`, with the margin picked out in `text-warm-accent-hover` — red only when it has gone negative. The same goes for a selected service in `AMCPackage.jsx`. **Status tints stay as they are** (Approved green, Sent blue and so on): they are how a state is read at a glance. Solid calls to action also stay green, per the warm UI rules in AGENTS.md.
- **The estimate's services are listed by `components/estimates/EstimateServicesTable.jsx`**, one component for every screen that lists them. Columns: `#`, Service, Method, Input / Details, Frequency, Visits / Year, Customer Price, with the Total Services Price footer. Method and the measured amount come from `getServiceMethodLabel` / `getServiceInput` in `estimatePackageUtils.js` (tested in `estimateServiceColumns.test.js`); a hand-entered row has no configured method, so it shows a dash and its `Qty n`. Input / Details carries the amount measured at the property (`4 Lift`, `15,000 Sq Ft`) and **never the rate beside it** — a rate is a vendor cost. The caller keeps its own heading and wrapper and passes its own `decode`.
- **Internally, Input / Details is two lines**: the measured amount, and under it the rate it was priced at — `4 Lift` over `₹1,800 / Lift / Visit`, `15,000 Sq Ft` over `₹0.80 / Sq Ft / Visit`, `₹18,000 / Month` for monthly manpower. A Capacity Slab names the slab that decided the price instead (`Slab: 101 - 200 KVA`). That rate is the configured per-unit one from the snapshot, never the per-visit total, and it comes from `getServiceRate` (tested per method). **It is a vendor figure, so the customer-safe table renders the amount alone.**
- **`internal` adds Vendor Cost, XLAND Cost and Margin % to that table, and the category under the service name.** It is passed by Admin, Ops Manager, FP and Manager only. **Coordinator, Supervisor and Executive never pass it** — their tables state the customer's price alone, and they keep their view modals. A hand-entered row has no vendor behind it, so its cost cells read as a dash rather than zero: `getServiceVendorCost` and friends return `null`, which is not the same as costing nothing.
- **In Admin, Ops Manager, FP and Manager the view modal is gone.** Clicking an **Estimate ID** expands `components/estimates/EstimateDetailPanel.jsx` inside the row — the property it was written for (including a gated community's blocks and their unit counts), the package, the services table with costs, the Internal Cost & Profit Summary, the price summary, notes and terms — in both the active and the archived lists. The eye action was removed with the modal; one row is open at a time. FP keeps the `?viewEstimate=<id>` parameter as the source of truth, so an existing link still opens that estimate, expanded rather than as a modal.
- **The customer is named in the row, not in the panel**: the Client cell carries contact name, phone and email (and the property code where there is one), which is what the space freed by the eye button pays for. The panel therefore has no Customer Details section — repeating it there would state the same three fields twice.
- **`components/estimates/EstimateInternalSummary.jsx` is the Internal Cost & Profit Summary**, under its own heading and marked "(internal only)". It states exactly four figures: **Total Vendor Cost, XLAND Operating Cost, Customer Price, Gross Margin %**. Total Actual Cost, Est. Selling Price and Gross Profit were dropped as restatements of those — the mockup's `(A)` / `(B)` lettering went with them. `estimateInternalCosts` still returns `actualCost`, `sellingPrice` and `profit`, because the margin is derived from them. Figures come from `estimateInternalCosts` (tested in `estimateInternalCosts.test.js`), which reads the pricing snapshot saved with each service — so a panel reports what the estimate was **costed at**, not what today's catalog would say. The selling price is the estimate's own subtotal where it has one, since that is the figure the customer was quoted, package included.
- The panel is **read-only**. The reference mockup shows a frequency dropdown, an editable XLAND cost and a per-row ⋮ menu; re-pricing belongs to the edit flow, which is validated server-side, so none of those are here. It also shows a `SER-001` service code, which the catalog deliberately has no field for.
- Customer-facing documents are untouched by all of the above. The PDF and email tables keep their own customer-safe layout, with no vendor cost, margin or markup.
- Add-on dropdowns: show only the add-on name; do **not** show the price.
- **The AMC package dropdown shows the package name alone**, in every portal and in both the create form and the edit modal — no `- ₹60,000` suffix, whether it comes from `formatCurrency(pkg.price)`, `getPackagePrice` or `getNormalizedPackagePrice`. The selected package's cost is read from the Price Summary and the package card, which is where a figure belongs; repeating it inside the closed select also truncated the name it was meant to qualify.
- Selected add-ons table columns: **Service**, **Frequency**, **No. of Visits**, **Action**. Remove the **Price** column.
- Show only a **Total Add-ons Price** row at the bottom that displays the sum of all selected add-ons.
- The estimate's services are labelled **"Services"**, never "Additional Services" — in the view modals, the create forms, archived estimates, the property drawer and the invoice screens. The PDF already said `SERVICES`.
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
