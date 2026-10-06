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
- **Build Custom Services shows `components/estimates/CustomServicesTable.jsx`**: only real rows, added on request. Columns are `#`, Service, Description, Input / Details, Frequency, Visits / Year, Action — no per-service price (see the rule below) — and **no cost columns**: while an estimate is being written, no portal's table shows Vendor Cost, XLAND Cost or Margin %, headers included (the user's call). Those figures are read in the saved estimate's view. Deliberately absent, per the reference screenshots: Import Services and Method. The table no longer trails a permanently empty row — one that was numbered like a real row and had an empty Action cell, which kept being read as a service whose edit and delete were missing.
- **Every portal builds custom services the same way** — FP, Manager, Coordinator, Supervisor and Executive: one `CustomServicesTable` whose Add Service menu (`ServiceCatalogPicker variant="menu"`) lists **Custom** above the configured services, Custom and a row's Edit both open `CustomServiceDialog` (`onEditRow`), and configured services sit in the same table as `extraRows`, numbered straight through. **No portal shows cost columns while creating**: the user asked for Vendor Cost, XLAND Cost and Margin % to be hidden, headers included, on every create screen, so no create screen passes the table's `internal` prop. They appear only in the saved estimate's view. Coordinator, Supervisor and Executive read the catalog through `routes/staffServiceCatalog.js` (`/api/<role>/service-catalog`: list, categories, units and quote, all read-only, in the role's franchise scope), and `validateStaffCatalogEstimate` re-prices every configured service on their `POST /estimates` and refuses a price that no longer matches, as the Manager's `validatePackageEstimate` does. Regression test: `node --test backend/routes/staffServiceCatalog.test.js`.
- The table decodes the text it shows (`decodeEntities`): a service description stored HTML-escaped read `parts&#x2F;replacement` in the row.
- **The Estimates dashboard carries a Profit & Margin Summary on the FP and Manager portals** (`portalType` `franchise` / `manager`), under the stat cards: Vendor Cost, XLAND Cost (Profit), Customer Price and Margin % across the estimates the cards count, following the dashboard's own date range. The user asked for it on both portals, so the Manager sees this aggregate even though the create form's per-row cost columns stay Admin/FP only. It is computed in `utils/estimateProfitSummary.js`, the client twin of `backend/utils/estimateMargins.js`, from the rows the dashboard already loads: rejected and archived estimates are left out, and an estimate with no cost behind it (all hand-typed rows) is counted as `uncostedCount` and named, never averaged in. Regression test: `node --test admin-portal/src/utils/estimateProfitSummary.test.js`, which runs both twins on the same rows.
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
- Custom rows are **free text**, not catalog services: the Service name and description are typed and the customer price is entered directly, so there is no vendor rate or method behind them. A row may carry a vendor cost and markup entered in its dialog, and where it does the XLAND cost and margin derive from them exactly as on a catalog service. Picking a frequency fills Visits / Year from the shared `FREQUENCY_OPTIONS`.
- **A hand-entered service is filled in through `components/estimates/CustomServiceDialog.jsx`, not in the table row.** A row carries more than a row can hold: Service, Description (the column formerly headed Input / Details), Category, Quantity (Nos), Frequency, Visits / Year, Customer Price and a Vendor Required toggle. OK adds all of it as one row, and the row's Edit action reopens the same dialog on it. Category is the catalog's own list through `AutocompleteInput` with `allowCustom` and `showAllOnOpen`: a category typed here is offered for the rest of the session at once, is stored on the estimate, and comes back in the list afterwards because `serviceCategories.js` also reads the categories used by saved estimate services -- still no table of its own. Visits / Year follows the frequency and is read-only unless the frequency is Custom. Quantity describes what the entered price covers; it does not multiply it, because the price on a hand-entered row is the customer price as typed. Where the dialog prices a customer (`priceLabel` is `Customer Price`) it also asks for **Vendor Cost and Markup %**: both entered, the customer price sets itself read-only to `vendor cost + vendor cost × markup/100`, and read-only XLAND Cost and Margin % fields state what the price makes; a vendor cost alone leaves the price typed with its margin shown live. `normalizeManualService` bounds quantity, category, vendor cost, markup and the vendor flag on save alongside the name, description, frequency, visits and price, and persists the cost pair so the internal cost columns and the payments margin panel price the row like a catalog service — the figures never reach a customer document. The dialog is opt-in through the table's `onEditRow` prop, so Manager, Coordinator, Supervisor and Executive keep adding a blank row and editing it in place; and where the dialog prices a **vendor** instead (a package's hand-typed row) the cost and markup fields stay out, since that price IS the vendor cost.
- **A configured service settles nothing about itself on the estimate.** The pricing dialog asks only for the figure the method prices from, the frequency (behind the override checkbox) and the visits it implies. Quantity Based once also asked for Category and Vendor Required; both are gone from the dialog, so every field of a catalog row is rebuilt from the catalog on save and nothing about the service is read back from the request — that is what stops a client altering a saved service. Category comes from the service, and whether a vendor is assigned comes from its "Do Not Assign Vendor" configuration. A per-estimate Vendor Required answer exists on hand-entered rows only.
- The configured-service dialog states **only the Customer Price, in green**. Vendor Cost, XLAND Operating Cost, Actual Cost, Markup and Margin are internal to the service configuration and must not appear there — **including the XLAND Operating Cost input**, which was once allowed as an override and is no longer: what XLAND spends running a service is not something an estimate screen asks for. The service's configured `default_operating_cost` is still carried into the quote, just not shown or editable.
- The free-hand row belongs to custom mode only. In package mode, extra services come from the configured-service dropdown and its dialog, which remain available in both modes.
- Custom rows travel in the estimate's `addons` array shaped like a configured-service add-on (`addonId: 'CUSTOM-…'`, `customService: true`, `services[0].price` = per-visit), so the existing tables, view modals and PDFs render them unchanged. `isManualService` / `normalizeManualService` in `backend/utils/estimateData.js` bound the name, details, frequency, visits and price on save; the FP and Manager `validatePackageEstimate` middlewares now engage for them and add them to the server-computed subtotal, so a custom-only estimate still has its totals verified.

## Add-on Pricing Display

- **Customer documents carry every column of the estimate view except the internal costs.** The downloaded/printed PDF, the emailed PDF and the email body list each service as #, Service (category under it), Description, **Input / Details**, **Method**, Frequency, Visits -- the **one order** for every list of an estimate's or package's services (view modal, create tables, package view, PDFs, email), with Vendor Cost, XLAND Cost and Margin % after Visits where they are shown -- never Vendor Cost, XLAND Cost or Margin % (the user's call). `customerEstimateData` projects `method` and `input` (a package capacity-slab service states its slab, "0 - 3 KL"); the description drops the segment that restates the amount. Primary Input and Property Types stay out.
- **No service states a price of its own, anywhere** -- create screens (property-based and direct), the estimate view, the downloaded/printed PDF, the emailed PDF and the email body. The user's call: the estimate is priced as a whole, in the Total Services Price line under the services table (with its small AMC-package note) and the Price Summary. A hand-entered service's price is still entered, in its dialog; it is simply not listed per row. The internal Vendor Cost, XLAND Cost and Margin % columns of the `internal` view are unaffected.
- **The payments dashboard carries a Cost & Margin panel**, above Quick Actions: Vendor Cost, XLAND Cost, Customer Price and Margin % across the **active property-based** estimates, with a row per estimate beneath. A direct estimate has no property to measure against and an archived or rejected one is not work we expect to bill, so neither is counted. `GET /api/payments/property-estimate-margins` aggregates it server-side from the pricing snapshot saved with each service (`backend/utils/estimateMargins.js`, tested), and an FP-scoped user sees only their own. **Admin, Operations Manager and Franchise Partner only** — `canViewEstimateMargins`, not `canViewPayments`, because a Manager, Supervisor, Executive or Coordinator may view payments and still has no business with vendor cost or margin. Those four get 403, verified by role; the panel is also not rendered or even requested for them, so hiding it is not the only thing stopping them. **The headline totals count only estimates that carry costs**: an estimate of hand-typed services has a price and no cost, so including it would report a margin approaching 100% for work with no cost evidence. Those are counted as `uncostedCount`, named in the panel and still listed.
- **The services table is drawn in the cream skin, not green.** Its header, footer, row numbers and method badges are warm tints (`bg-warm-section`, `bg-warm-accent-soft`, `border-warm-border`) and its figures read in `text-warm-text`, with the margin picked out in `text-warm-accent-hover` — red only when it has gone negative. The same goes for a selected service in `AMCPackage.jsx`. **Status tints stay as they are** (Approved green, Sent blue and so on): they are how a state is read at a glance. Solid calls to action also stay green, per the warm UI rules in AGENTS.md.
- **The estimate's services are listed by `components/estimates/EstimateServicesTable.jsx`**, one component for every screen that lists them. Columns: `#`, Service, Method, Input / Details, Frequency, Visits / Year -- no per-service price -- with the Total Services Price footer (package price plus added services). Method and the measured amount come from `getServiceMethodLabel` / `getServiceInput` in `estimatePackageUtils.js` (tested in `estimateServiceColumns.test.js`); a hand-entered row has no configured method, so it shows a dash and its `Qty n`. Input / Details carries the amount measured at the property (`4 Lift`, `15,000 Sq Ft`), and underneath it a **screen-only subline**: a capacity slab's band for everyone — a bracket, not a cost — and the ₹ vendor rate when `internal` is set. The subline is `print:hidden`, so a browser print of the modal drops it. With `internal` (the full-screen detail opened from Admin, Operations Manager or FP only — the same roles `canViewEstimateMargins` admits) the table adds **Vendor Cost, XLAND Cost and Margin %** before the customer figure, and folds the package's own services in with a `Package` tag, as the create form's draft table does. None of the subline ever reaches a document: `stripInternalServiceDetails` in `estimateData.js` / `estimatePackageUtils.js` drops the `Slab:`, `Rate:` and `₹… /` segments alongside `Property Types:` wherever `details`/`description` is printed, so the emailed and downloaded PDFs, the invoice and receipt PDFs and both email bodies cannot carry them. Manager, Coordinator, Executive, Supervisor, the PDFs and the emails render it without `internal`, so what they read is still what the customer receives. The caller keeps its own heading and wrapper and passes its own `decode`.
- The service's **category reads under its name** in that table, which is where the PDF and the email set it too.
- **No create form's services table states a cost.** `components/estimates/EstimateDraftServicesTable.jsx` lists the services on a draft estimate — package rows, saved add-ons and configured services together — as `#`, Service (category under the name; no `SER-nnn` code -- the user asked for the internal catalog ID to be removed), Method, Input / Details, Frequency, Visits / Year (no per-service price), with `internal` adding **Vendor Cost, XLAND Cost and Margin %** between XLAND and the customer figure. `internal` is no longer passed by any create form (`FPEstimates.jsx`, `CreateEstimate.jsx` included) — the user asked for the cost columns to be hidden, headers and all, while an estimate is written; Manager, Coordinator, Executive and Supervisor render the same table without the cost columns, and in that view the vendor rate never reads under the measured amount — only a capacity slab's band may. `EstimateInternalSummary.jsx` is still gone. The full-screen detail view matches this gate — Admin, Operations Manager and FP open it with `internal` (see the `EstimateServicesTable` rule above); the PDFs and the emails always show the customer's total and nothing else, since those reach the customer. What the work costs XLAND is otherwise answered by the **payments dashboard's Cost & Margin panel**, which is gated on `canViewEstimateMargins` and computed server-side from the pricing snapshots. `getServiceVendorCost`, `getServiceXlandCost`, `getServiceMarginPercent` and `getServiceRate` remain in `estimatePackageUtils.js` with their tests — the draft table is their only caller, and the cost figures ride on the draft row for display only: the save payload maps its own fields, so they never reach the estimate or a customer document.
- **Estimate details open full screen, never in a dropdown row or a centred modal.** Clicking anywhere on an estimate's **row** — not just its ID — leaves the list for the document — in Admin, Ops Manager, FP and Manager that is `components/estimates/EstimateDetailPanel.jsx`: the letterhead, the property it was written for (including a gated community's blocks and their unit counts), the package, the services table, the price summary, notes and terms — in both the active and the archived lists, behind a **Back** button that returns to the list it came from. One estimate is open at a time. The row's `onClick` carries `cursor-pointer`, and every cell that holds a control — the selection checkbox, the status select and the actions cell — stops propagation, so checking, re-stating or editing a row never opens it. FP keeps the `?viewEstimate=<id>` parameter as the source of truth, so an existing link still lands on that estimate's document. Coordinator, Executive and Supervisor open their own detail view the same way — a full-screen page with a Back button — rather than a `max-w-3xl` modal.
- The panel is **read-only**. Re-pricing belongs to the edit flow, which is validated server-side.
- **Printing an open estimate prints its PDF, never the page.** A browser print of the HTML stamps the tab title and URL on every sheet — chrome no stylesheet can remove — so both the **Print** button and a **Ctrl+P / Cmd+P** while a document is open go through `printEstimatePDF` in `utils/pdfExport.js`: the same `generatePDF` output as the download, loaded into a hidden frame and printed from the PDF viewer, which carries the document alone. `useEstimatePrint` (`utils/useEstimatePrint.js`) binds the key while a detail view is open and falls back to `window.print()` if the document cannot be built; the `.print-document` rules below are that fallback's cleanliness. `EstimateDetailPanel` and the staff portals' full-screen view mark their document root `.print-document`, and the `@media print` rules in `index.css` hide every element that neither is, contains, nor sits inside that subtree — navigation, the page header with its stat cards, the Back button and action controls never reach paper — while ancestors are unpinned and unclipped (`position: static; overflow: visible`) so a `fixed`/`overflow-y-auto` view modal still paginates its whole document. Internal figures never print even where `internal` shows them on screen: the Vendor Cost, XLAND Cost and Margin % cells and the Action column carry `print:hidden` in `EstimateServicesTable`, `EstimateDraftServicesTable` and `CustomServicesTable`, and the services grid drops back to 12 tracks on paper. The emailed PDFs and both email bodies need no print rule — they are generated server-side and never carry those fields at all.
- **Print and Download live on the opened estimate, not the list row.** Every detail view — `EstimateDetailPanel` callers (Admin/Ops `EstimatesList`, `ArchivedEstimates`, FP, Manager) and the staff portals' full-screen modal — pairs a `Print` button (`window.print()`, so it prints the `.print-document` subtree alone) with a `Download PDF` button (`exportEstimateToPDF`, the customer-safe exporter) beside the Back control; both sit outside the marked document so neither appears on paper. The per-row Download icon was removed from every list — it duplicated what the opened document already offers. The exporter resolves a stored estimate's rows itself: `package_services`, `packageServices`, `services_data` (as `serviceRows`, `services`, or a bare array), `serviceRows`, then `services` — so a staff portal hands it the raw estimate with no per-portal mapping. Toolbar exports (`Export All`, Excel) and unrelated row actions (email, edit, archive, restore, delete) are untouched.
- Add-on dropdowns: show only the add-on name; do **not** show the price.
- **The AMC package dropdown shows the package name alone**, in every portal and in both the create form and the edit modal — no `- ₹60,000` suffix, whether it comes from `formatCurrency(pkg.price)`, `getPackagePrice` or `getNormalizedPackagePrice`. The selected package's cost is read from the Price Summary and the package card, which is where a figure belongs; repeating it inside the closed select also truncated the name it was meant to qualify.
- The selected-services table is `EstimateDraftServicesTable.jsx` — the draft table described above. A legacy add-on that was never priced against the catalog shows its measured fields as a dash rather than a fabricated figure.
- Show only a **Total Services Price** row at the bottom that displays the sum of all selected add-ons.
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
- Visits column: count only. The email lists services in the same columned table as the PDF, so
  `Monthly - 12 visits` as a single inline string no longer appears there.
- The email body **lists the Terms & Conditions** as well as attaching the PDF, through the same
  `estimateTermsLines` helper, so a message and its attachment cannot state different terms.
- **Terms & Conditions is one block and never splits across pages.** Both PDF generators
  (`utils/pdfExport.js` for the download and `services/pdfService.js` for the attachment) wrap and
  measure every clause before anything is drawn, and move the whole section — heading included — to
  a fresh page when it does not fit below the summary. A block taller than a page is the one
  exception, since it cannot fit anywhere whole; the per-clause page check stays for that case. The
  screen version carries the same rule through `break-inside-avoid` on `EstimateTermsSection`, so the
  browser-print fallback paginates the same way.

## GST and Discount

- **GST defaults to nothing, everywhere.** Every create-estimate form starts the field empty with a
  `0` placeholder, the estimate columns are `DECIMAL(5,2) DEFAULT 0.00`, and a blank field saves and
  prints `GST (0%) → ₹0`. **Nothing may fill a blank rate with 18.** Three places used to: the admin
  form's Price Summary *label* read `GST ({gstRate || '18'}%)` beside a ₹0 figure, the catalog quote
  endpoint defaulted `gst_percentage ?? 18`, and `invoices.tax_percentage` was `DEFAULT 18.00`.
- **The invoice charges the rate its estimate carried.** `calculateInvoiceAmounts(subtotal,
  discountPercentage, taxPercentage)` takes the rate as an argument defaulting to 0, and
  `generateInvoiceFromEstimate` passes `estimate.gst_percent`. It previously applied a hardcoded
  `GST_RATE = 18` whatever the estimate said, so an estimate quoted, sent and **approved at 0% was
  billed at 18%** — the customer agreed to one figure and was charged another. `GST_RATE` is still
  exported as the statutory rate a screen may offer as a choice; it is not a fallback, and the test
  asserts as much. Regression test: `node --test backend/services/invoiceAmounts.test.js`.
- GST is charged on the subtotal **after** the discount, in every surface that computes it.
- Existing invoices keep the `tax_percentage` they were raised with: it is what was charged and
  possibly already paid, so `schema_v39_invoice_tax_default_zero.sql` moves the column default only
  and rewrites no rows.

## Terms & Conditions

- **Writing the clauses belongs to Admin, Operations Manager and FP; every other portal sends the
  standard wording.** `components/estimates/TermsConditionsField` takes `editable`: the default is
  the checkbox plus the textarea and the Reset to default link (admin `CreateEstimate.jsx`, which
  serves both Admin and the Operations Manager, and `FPEstimates`), and `editable={false}` is the
  same card with neither — the clauses are still listed under Preview, since a creator has to know
  what the customer will read, but there is nothing to change and no box to untick. Manager,
  Coordinator, Supervisor and Executive pass it, and Manager also passes `editableTerms={false}`
  to `CustomEstimateBuilder`, which the admin Estimates page shares with it.
- **A custom quote is priced by the portals that price estimates.** `calculateServiceQuote` in
  `backend/utils/servicePricing.js` accepts `custom_quote` from admin, manager, operations_manager
  and the FP side (`franchise_partner`, `franchise`, `fp_admin`, `fp_manager`) — coordinator,
  supervisor, executive and their `fp_*` mirrors are refused, so a field hidden on their screen is
  also refused at the route. `ServiceCatalogPicker` opens the vendor-quote field the moment a slab
  flagged `isCustomQuote` is picked rather than after a failed OK, and syncs it again from the
  preview quote's `requiresCustomQuote`.
- **The gate is the backend's.** `estimateTermsColumns(req.body, req.user.role)` returns the default
  clauses for any role outside `TERMS_EDITOR_ROLES` (admin, operations_manager, franchise_partner,
  franchise), whatever the request carried — a field missing from a screen is not what stops a
  client from posting its own terms, and `requireFPScope` does not even check the role, so the FP
  route is reachable by others. Pass `req.user.role` rather than the portal's own name for that
  reason. Regression test: `node --test backend/utils/estimateTerms.test.js`.
- **A restricted portal's estimate is never left bare.** Unable to choose is not the same as
  choosing "no terms", so the fixed result is `include_terms = 1` with the default text. The
  Manager's custom-estimate insert in `managerServiceCatalog.js` omitted both columns entirely and
  therefore sent estimates out with no Terms & Conditions at all while the form appeared to offer
  them; `managerServiceCatalog.test.js` now asserts the columns are written and that terms posted
  by a Manager are ignored.

## The Estimate Document — one layout, four surfaces

The **view modal, the expanded detail panel, the PDF download, the emailed PDF and the email body**
are the same document. A change to one belongs in all of them; a section added to only one is a
bug, because a colleague reading the estimate on screen is reading what the customer receives.

**Order, top to bottom:**

1. **Letterhead.** A gold rule across the head of the page, then two facing blocks: on the left the
   company, on the right a **BILL TO** card. **Who headlines it depends on the property type**: a
   gated community or an apartment is billed as the property — the association, not a person — so
   the property name takes the bold headline and the customer drops to a `Contact` row, while a
   villa, flat or plot is billed to the person and the property stays a `Property` row. `billToParty`
   decides — `utils/estimateStore.js` on screen and in the downloaded PDF, `utils/estimateData.js`
   for the emailed estimate, invoice and receipt and their PDF attachments — then phone, email,
   property code and city follow. The card is **flexible**: it widens to keep
   an email or property code on one line, capped so it never overlaps the company block; a value too
   long to sit beside its label drops to its own full-width line rather than snapping mid-word. The
   same goes for the on-screen card and the email table cell — keep emails `nowrap`, never fixed-width.
   The company block is **one centred stack**: the logo and `XLAND INFRA` share the first line, and
   the tagline, address and contact lines are centred **on the whole lockup** beneath them — every
   line measured and placed by hand in the PDFs, and one centred table per line in the email, since
   no mail client centres anything reliably but a table cell. They are **not** left-aligned under
   the name, which left them hanging to the right of the logo with the space beside it wasted.
   `PVT LTD` is **near-black, with near-black rules, centred on the name above it** — measured
   against that name's own width rather than aligned to its left edge, and not set in gold: the
   gold on this page is the top rule and the logo.
2. **The strip**, ruled top and bottom on a pale band: Estimate No., Date, Type and Billing (the
   email replaces Type with Valid Until), **sharing the width in four equal columns**, with the
   status chip at the right on screen. It does **not** announce the word ESTIMATE — what the
   document is is not in doubt, and the label only crowded four fields into the left half of a
   full-width bar. Nothing below restates any of these.
3. Property Details — **a ruled table, not a field grid**: the label in a cream cell, its value in
   the white cell beside it, **two pairs to a line**, with type-specific fields for GC, APT, VILLA,
   FLAT and PLOT, and the address (and a gated community's block list) on a line of their own.
   Empty fields are dropped before anything is placed, so the rest close up and an odd last pair
   closes its line with a plain cell rather than a half-empty one. The previous layout floated
   label-over-value pairs across three columns with no rules: each value found its own baseline,
   a missing Division left a hole in mid-air, and the block read as crooked beside the ruled
   tables under it. `detailTable` in `pdfService.js` and `emailService.js`, the same code inline
   in `pdfExport.js`, and `DetailTable` in `EstimateDetailPanel.jsx`.
4. AMC Package — price and description only; no package name (see AMC Package Display above).
5. `AMC PACKAGE - SERVICES INCLUDED`: `#`, Service (category beneath), Description, Frequency,
   Visits, Qty, Price. A package's services are covered by the package price, so **Price reads as a
   dash**, never as zero.
6. `SERVICES`: the same columns, priced, with the **Total Services Price** line under it.
7. **Price Summary**, in a card against the **right** edge: Subtotal, Discount (only when one was
   given), GST, and the Total on a black band in gold-on-white. Not a full-width list.
8. Notes.
9. Terms & Conditions, last, and only when the estimate carries them (see above).
10. Footer: the legal name, email and phone, centred — **and nothing else**. No
    "computer-generated document" note, no "do not reply to this automated email", no watermark
    of any kind. An estimate asks the customer to approve or reject it, so a disclaimer telling
    them it is machine-made or not to be replied to contradicts what the document is for. Do not
    reintroduce one. (Invoices and receipts keep their own notes; this rule is the estimate's.)

- **There is no Customer Details section.** The customer is in BILL TO at the head of the document,
  and in the Client cell of the list row; a third copy states the same three fields again.
- **Billing is stated once**, in the strip. The separate "Billing:" line above the services and the
  Billing row in the modals were removed as restatements of it.
- **The company block is not typed anywhere.** `backend/utils/companyInfo.js` and its twin
  `admin-portal/src/utils/companyInfo.js` hold the name, suffix, tagline, address lines, phone,
  email and website; `backend/utils/companyInfo.test.js` compares the two field by field, so
  changing one without the other fails the tests rather than the customer's copy.
- **The document is drawn in the portal's warm palette, not slate blue** — and that applies to the
  PDFs and the email as much as to the screen. Table headers and the Price Summary caption are
  `warm.section` `#FFF9EE` with `warm.muted` labels and `warm.border` `#EADFCF` rules; rows
  alternate white and `#FFFCF6`; BILL TO's cap is `warm.accent-soft` `#FEF3E2`; headings and
  figures are `warm.text` `#1F2937`. **The Total sits on the tan accent `#D4A574` in dark text** —
  never white on tan, which does not meet contrast, and no longer the black-and-gold band it was.
  The palette is duplicated as `WARM` in `pdfExport.js`, `pdfService.js` and `emailService.js`
  because none of the three can read a Tailwind config; keep the three in step. Only the estimate
  is warm — the package export and the invoice keep their slate and navy.
- **A table header is uppercase and takes its column's alignment.** jspdf-autotable applies
  `columnStyles` to the body only, so the estimate table passes a `didParseCell` hook to give each
  header the alignment its column already has; otherwise a centred `SERVICE` sits over a
  left-aligned column.
- **The contact lines carry icons, not letters** — a handset, an envelope and a globe in the tan
  accent, never `T` / `E` / `W`, which read as the initials of nothing. The kind is named by
  `COMPANY_CONTACT_LINES` (`phone`, `email`, `website`) and each surface draws it its own way:
  lucide `Phone` / `Mail` / `Globe` on screen, `drawContactIcon` from rectangles, lines and
  ellipses in both PDFs — Helvetica has no such glyph and a symbol font is not worth embedding for
  3mm of line art — and, in the email, the PNGs in `backend/assets/icons/`, attached and referenced
  by Content-ID because Gmail strips an inline SVG and Outlook never drew one.
- **The logo is the brand mark alone** (`backend/assets/logo-contract.png`, mirrored into
  `admin-portal/public/logo-icon.png` and, base64-encoded for jsPDF, into `utils/logoIconBase64.js`),
  because every layout sets the company name itself beside it. It is scaled to 314px: the 1.2MB
  original would be embedded in every emailed PDF. **The email attaches it and references it by
  Content-ID** — an `<img>` pointing at the website sits behind the "display images" prompt that
  Outlook and Gmail show by default, which left the letterhead headless.
- Implemented by `drawEstimateLetterhead` in `admin-portal/src/utils/pdfExport.js` (jsPDF, mm) and
  in `backend/services/pdfService.js` (PDFKit, points), by the letterhead table in
  `sendEstimateEmail`, and on screen by `components/estimates/EstimateDocumentHeader.jsx` with
  `EstimatePriceSummary.jsx`. The centred black brand strip (`drawPDFHeader`) is **not** used by an
  estimate any more — it leaves nowhere for the two facing blocks — but the package export and the
  invoice still use it.

## Backend Requirements

All employee routes must parse the `addons_data` JSON and enrich add-ons with descriptions from the `fp_addons` table.
