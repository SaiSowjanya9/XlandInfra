---
description: How to implement and navigate the Billing & Payments module
tags: billing, payments, invoices, payment_links, payment_history, module_flow
---

# Billing & Payments Module Flow

## Main Navigation

1. Generate Invoice
2. Invoices
3. Payments
4. Payment Link
5. Payment History
6. Dashboard (payments only)

### Additional Invoice Options

- **Create Invoice** — for other kinds of requirements
- **Work Order Invoice** — only related to work order submissions

## Payments Screen

Main payment management screen showing:

- Property ID
- Invoice ID
- Total Amount
- Paid Amount
- Balance Due
- Payment Method
- Status: `Pending`, `Partially Paid`, `Paid`, `Overdue`

### Record Payment Options

Cash, Bank Transfer, UPI, Payment Links.

## Payment Links

Online payment links generated for customers:

- FP/Manager clicks Generate/Send Payment Link.
- Customer receives the link by email/SMS.
- Customer opens the payment page and pays online.

Track statuses: `Generated`, `Sent`, `Expired`, `Paid`.

## Payment History

Transaction record showing individual payments separately.

Example: a ₹50,000 invoice may have:

- ₹25,000 paid on July 5
- ₹25,000 paid on August 5

Fields: Payment ID, Invoice ID, Date, Method, Amount, Reference Number, Received By.

## Overall Flow Structure

```
Billing & Payments
│
├── Generate Invoice
│   ├── Invoices
│   │   ├── Payments
│   │   │   ├── Payment Link
│   │   │   │   ├── Payment History
│   │   │   │   │   └── Dashboard (only for payments)
│
├── Create Invoice
│   └── (Invoices for other kinds of requirements)
│
└── Work Order Invoice
    └── (only related to WO submissions)
```
