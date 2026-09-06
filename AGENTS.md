# XlandInfra Project Conventions

## Deployment Context

- **MySQL database name on the VPS:** `xland_pm`

## Frontend API Conventions

All API calls in `admin-portal` and all employee portals must use the full `API_BASE` URL. Relative URLs resolve to `admin.xlandinfra.com` instead of `xlandinfra.com`.

```javascript
const API_BASE = import.meta.env.VITE_API_URL || '';

// Correct
fetch(`${API_BASE}/api/manager/dashboard`, { ... });

// Wrong
fetch('/api/manager/dashboard', { ... });
```

- Set `VITE_API_URL=https://xlandinfra.com` in `.env.production`.
- Applies to all employee portals: Manager, Coordinator, Supervisor, Executive, FP, Admin, Vendor.

## Naming Conventions

- Use **Customers**, not "Clients", throughout the application.

## Portal-Specific Rules

For detailed UI and behavior rules, see the files in `.devin/rules/`:

- `estimates.md` — estimate creation, tables, view modals, and PDF exports
- `work-orders.md` — work order forms, status options, and subcategory loading

## Module Skills

For reusable task instructions for major modules, see `.devin/skills/`:

- `billing-payments.md`
- `scheduling-module.md`

## Razorpay Integration

The project uses **Razorpay Payment Links** (hosted checkout) for online payments. UPI, cards, net banking, and wallets are all handled by Razorpay's hosted page.

### Environment Variables (Backend)
```
RAZORPAY_KEY_ID=rzp_test_xxx (test) or rzp_live_xxx (live)
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
```

### Webhook Configuration
- **URL:** `https://xlandinfra.com/api/razorpay/webhook`
- **Events to enable:** `payment_link.paid`, `payment_link.partially_paid`, `payment_link.expired`, `payment.captured`, `payment.failed`, `refund.processed`

### Database Migrations
Run schema files in order:
1. `schema_v17_payments.sql` - Base payments tables
2. `schema_v18_razorpay.sql` - Razorpay webhook tables
3. `schema_v21_payment_security.sql` - Security logs
4. `schema_v22_razorpay_fix.sql` - **Required fix for webhook tracking**
