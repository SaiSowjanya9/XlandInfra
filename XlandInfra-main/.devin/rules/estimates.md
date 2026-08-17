---
description: Rules for estimate creation, view modals, tables, and PDF exports across all admin portals
tags: estimates, addons, pricing, tables, pdf, portals, ui
---

# Estimate UI Rules

Applies to: `CreateEstimate.jsx`, `ManagerEstimates.jsx`, `CoordinatorEstimates.jsx`, `ExecutiveEstimates.jsx`, `SupervisorEstimates.jsx`, `FPEstimates.jsx`, and `Properties.jsx` view sections.

## Add-on Pricing Display

- Individual add-on prices **must not** be displayed in the Create Estimates section.
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
