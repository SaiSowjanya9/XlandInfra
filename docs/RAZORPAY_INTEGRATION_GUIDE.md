# Razorpay Payment Gateway Integration Guide

## For: XLAND INFRA PVT LTD
## Document Version: 1.0
## Last Updated: August 2026

---

# Table of Contents

1. [How Razorpay Payment Gateway Works](#1-how-razorpay-payment-gateway-works)
2. [Our Implementation Approach](#2-our-implementation-approach)
3. [Technical Flow Explained](#3-technical-flow-explained)
4. [Security Measures Implemented](#4-security-measures-implemented)
5. [Configuration Checklist](#5-configuration-checklist)
6. [Questions for Razorpay Team](#6-questions-for-razorpay-team)
7. [Troubleshooting Guide](#7-troubleshooting-guide)

---

# 1. How Razorpay Payment Gateway Works

## Simple Explanation

Think of Razorpay as a secure middleman between your customer and their bank. Here's what happens when a customer pays:

```
Customer clicks "Pay" 
    → Razorpay shows payment options (UPI, Card, NetBanking)
    → Customer enters details
    → Razorpay talks to the bank securely
    → Bank approves/rejects
    → Razorpay tells us the result
    → We update the invoice
```

## The Two Main Integration Methods

### Method 1: Checkout (Not Used by Us)
- Requires JavaScript SDK on your website
- Customer pays directly on your site
- More complex to implement
- Used for: E-commerce, instant checkout

### Method 2: Payment Links (What We Use) ✅
- We create a link, send it to customer
- Customer clicks link, pays on Razorpay's secure page
- Simpler and more secure
- Perfect for: Invoice-based B2B payments like ours

**Why Payment Links are better for XLAND INFRA:**
- No need to handle card details on our servers
- PCI compliance is Razorpay's responsibility
- Works with all payment methods (UPI, Cards, NetBanking, Wallets)
- Customer can pay anytime from any device
- Automatic payment reminders

---

# 2. Our Implementation Approach

## What Happens When We Generate a Payment Link

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT LINK FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin/Manager clicks "Generate Payment Link" for invoice     │
│           ↓                                                      │
│  2. Our server calls Razorpay API to create payment link         │
│           ↓                                                      │
│  3. Razorpay returns a short URL (e.g., rzp.io/l/abc123)        │
│           ↓                                                      │
│  4. We save this link in our database & show to user            │
│           ↓                                                      │
│  5. Link is sent to customer via Email/WhatsApp/SMS             │
│           ↓                                                      │
│  6. Customer clicks link → Pays on Razorpay's secure page       │
│           ↓                                                      │
│  7. Razorpay sends us a "webhook" notification                  │
│           ↓                                                      │
│  8. We verify the notification is genuine (signature check)      │
│           ↓                                                      │
│  9. We update invoice as "Paid" and record the payment          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components in Our System

| Component | File Location | Purpose |
|-----------|---------------|---------|
| Payment Link Creation | `backend/routes/razorpay.js` | Creates Razorpay payment links |
| Webhook Handler | `backend/routes/razorpay.js` | Receives payment notifications |
| Security Middleware | `backend/middleware/paymentSecurity.js` | Protects against fraud |
| Payment Success Page | `frontend/src/pages/PaymentSuccess.jsx` | Shows confirmation to customer |

---

# 3. Technical Flow Explained

## What is a Webhook?

**Simple Explanation:**
A webhook is like a phone call from Razorpay to our server saying "Hey, someone just paid!"

**Technical Explanation:**
When a payment happens, Razorpay makes an HTTP POST request to our server with payment details. This is more reliable than waiting for the customer's browser to tell us (the browser might close, internet might fail, etc.).

```
Customer pays on Razorpay
        ↓
Razorpay servers process payment
        ↓
Razorpay calls: POST https://xlandinfra.com/api/razorpay/webhook
        ↓
Our server receives payment details
        ↓
We verify it's really from Razorpay (signature check)
        ↓
We update our database
```

## What is Signature Verification?

**Simple Explanation:**
It's like checking if a letter really came from who it says it came from, using a secret code that only you and Razorpay know.

**Technical Explanation:**
Razorpay sends a "signature" with every webhook. This signature is created using:
- The webhook content (payment details)
- Your secret key (only you and Razorpay know this)
- A mathematical formula called HMAC-SHA256

We recalculate this signature on our end. If it matches, the webhook is genuine. If not, someone is trying to fake a payment!

```javascript
// How signature verification works (simplified)
Expected = HMAC-SHA256(webhook_body + your_secret_key)
Received = signature from Razorpay header

if (Expected === Received) {
    // Genuine webhook - process payment
} else {
    // FAKE! Reject immediately
}
```

## What is Timing-Safe Comparison?

**Simple Explanation:**
A hacker could measure how long our server takes to compare signatures. If we compare character by character and stop at the first mismatch, the hacker could figure out the correct signature over many attempts.

**Technical Explanation:**
Regular string comparison (`===`) stops early when it finds a difference. This creates a "timing attack" vulnerability. Timing-safe comparison always takes the same time regardless of where the mismatch is.

```javascript
// BAD (vulnerable to timing attacks)
if (signature === expectedSignature) { ... }

// GOOD (what we use - timing-safe)
crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
```

## What is Rate Limiting?

**Simple Explanation:**
It's like a bouncer at a club who says "you can only enter 10 times per hour" - prevents abuse.

**Technical Explanation:**
We limit how many requests can come from one IP address in a time period:
- Payment creation: 10 per 15 minutes
- Payment links: 20 per hour
- Webhooks: 100 per minute

This prevents:
- Brute force attacks
- API abuse
- Accidental infinite loops
- Denial of service attempts

---

# 4. Security Measures Implemented

## Security Layers (Defense in Depth)

```
┌─────────────────────────────────────────────────────────────┐
│                    INCOMING REQUEST                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Rate Limiting                                      │
│  "Is this IP making too many requests?" → Block if yes      │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Webhook Signature Verification                     │
│  "Is this really from Razorpay?" → Reject if no             │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Amount Validation                                  │
│  "Is the amount reasonable (₹1 to ₹1 crore)?" → Reject if no│
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Fraud Detection                                    │
│  "Does this look suspicious?" → Log and flag for review     │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Audit Logging                                      │
│  "Record everything for later investigation"                 │
├─────────────────────────────────────────────────────────────┤
│                    PROCESS PAYMENT                           │
└─────────────────────────────────────────────────────────────┘
```

## What Each Security Measure Protects Against

| Measure | Protects Against | Example Attack |
|---------|------------------|----------------|
| Rate Limiting | Brute force, DoS | Someone trying 10,000 fake payments |
| Signature Verification | Fake webhooks | Hacker sending "payment successful" without actual payment |
| Timing-Safe Comparison | Timing attacks | Measuring response time to guess secret key |
| Amount Validation | Negative amounts, overflow | Paying -₹10,000 (stealing money) |
| Fraud Detection | Suspicious patterns | Same IP making 50 payments in 1 minute |
| Audit Logging | Investigation, compliance | Tracking who did what and when |
| IP Hashing | Privacy | Logging activity without storing actual IPs |

## Our Fraud Detection Checks

When a payment request comes in, we check:

1. **Large Round Amounts** (Risk +10)
   - ₹100,000 exactly is more suspicious than ₹99,847

2. **Very Large Transactions** (Risk +20)
   - Amounts over ₹5,00,000 get flagged

3. **Rapid Successive Payments** (Risk +30)
   - More than 3 payment attempts in 5 minutes

4. **Suspicious User Agent** (Risk +15)
   - Missing or very short browser identifier

5. **Bot-like Patterns** (Risk +40)
   - User agent contains "bot", "curl", "python", etc.

**Total risk score over 30 = Suspicious (logged for review)**

---

# 5. Configuration Checklist

## Environment Variables Required

```env
# ═══════════════════════════════════════════════════════════
# RAZORPAY CONFIGURATION
# ═══════════════════════════════════════════════════════════

# API Keys (from Razorpay Dashboard → Settings → API Keys)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx        # Starts with rzp_live_ for production
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx  # Keep this SECRET!

# Webhook Secret (from Dashboard → Settings → Webhooks)
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# ═══════════════════════════════════════════════════════════
# PAYMENT SECURITY TOKENS (Generate your own - see below)
# ═══════════════════════════════════════════════════════════

# For QR code payment tokens
PAYMENT_TOKEN_SECRET=<64-character-random-string>
QR_TOKEN_SECRET=<64-character-random-string>

# For privacy-preserving IP logging
IP_HASH_SALT=<random-string>

# ═══════════════════════════════════════════════════════════
# URLS
# ═══════════════════════════════════════════════════════════
FRONTEND_URL=https://xlandinfra.com
```

## How to Generate Secure Secrets

Run this command in your terminal to generate secure random strings:

```bash
# Generate a 64-character secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it 3 times to get unique values for:
- `PAYMENT_TOKEN_SECRET`
- `QR_TOKEN_SECRET`
- `IP_HASH_SALT`

## Razorpay Dashboard Configuration

### Step 1: Get API Keys
1. Log in to https://dashboard.razorpay.com
2. Go to Settings → API Keys
3. Generate new keys (if not already done)
4. Copy `Key ID` and `Key Secret`

### Step 2: Configure Webhook
1. Go to Settings → Webhooks
2. Click "Add New Webhook"
3. Enter URL: `https://xlandinfra.com/api/razorpay/webhook`
4. Select events:
   - ✅ `payment_link.paid`
   - ✅ `payment_link.partially_paid`
   - ✅ `payment_link.expired`
   - ✅ `payment_link.cancelled`
   - ✅ `payment.captured`
   - ✅ `payment.failed`
   - ✅ `refund.created`
   - ✅ `refund.processed`
5. Copy the Webhook Secret
6. Click Save

### Step 3: Enable Auto-Capture
1. Go to Settings → Configuration
2. Enable "Auto Capture Payments"
3. This ensures payments are automatically captured without manual intervention

---

# 6. Questions for Razorpay Team

## Account Setup Questions

```
□ 1. Can you confirm our live API keys are active and working?

□ 2. Is our webhook URL configured correctly?
     URL: https://xlandinfra.com/api/razorpay/webhook

□ 3. Can you verify the webhook is receiving events?
     (Ask them to send a test webhook)

□ 4. Is auto-capture enabled on our account?

□ 5. What is our current settlement cycle? (T+2, T+3?)
     Can this be changed?
```

## Security Questions

```
□ 6. Can you provide the list of IP addresses that webhooks 
     originate from? We want to whitelist them on our firewall.

□ 7. Since we use Payment Links (not Checkout), confirm that 
     PCI-DSS compliance is handled entirely by Razorpay.

□ 8. What is the webhook retry policy?
     - How many times do you retry failed deliveries?
     - How long between retries?
     - How long are events retained?

□ 9. How are we notified of disputes/chargebacks?
     - Email notification?
     - Webhook event?
     - Dashboard alert?

□ 10. What is the maximum expiry time allowed for payment links?
      (We're currently using 7 days)
```

## Technical Questions

```
□ 11. What are the API rate limits for our account?
      - How many payment links can we create per day?
      - How many API calls per minute?

□ 12. Do you have a sandbox/test environment for webhook testing?

□ 13. How should we handle partial refunds?

□ 14. If a customer pays via Payment Link but the webhook fails,
      what is the recovery process?

□ 15. Can you confirm these webhook events are enabled:
      - payment_link.paid
      - payment_link.partially_paid
      - payment_link.expired
      - payment_link.cancelled
      - payment.captured
      - payment.failed
      - refund.created
      - refund.processed
```

## Business Questions

```
□ 16. What are the transaction fees for our account?
      - UPI transactions
      - Credit/Debit cards
      - NetBanking

□ 17. What is the support escalation process?
      - Email support response time?
      - Phone support availability?
      - Dedicated account manager?

□ 18. How do we request a production go-live review?

□ 19. Are there any compliance requirements we need to meet?
```

---

# 7. Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Webhook Not Receiving Events

**Symptoms:**
- Payments complete but invoice doesn't update
- No entries in `razorpay_webhooks` table

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Wrong webhook URL | Verify URL in Razorpay Dashboard |
| Server not reachable | Check if `https://xlandinfra.com/api/razorpay/webhook` is accessible |
| Firewall blocking | Whitelist Razorpay IPs |
| Events not selected | Enable required events in Dashboard |

**How to Test:**
```bash
# Test if your webhook endpoint is reachable
curl -X POST https://xlandinfra.com/api/razorpay/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return: {"success":false,"message":"Invalid signature"}
# (This is expected - it means the endpoint is working but rejecting unsigned requests)
```

### Issue 2: Signature Verification Failing

**Symptoms:**
- Webhooks received but rejected with "Invalid signature"
- Security logs show `WEBHOOK_INVALID_SIGNATURE` events

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Wrong webhook secret | Copy fresh secret from Dashboard |
| Body parsing issue | Already fixed in our code |
| Secret has extra spaces | Trim whitespace when copying |

### Issue 3: Payment Link Not Creating

**Symptoms:**
- "Razorpay is not configured" error

**Solution:**
Check environment variables are set:
```bash
# In your .env file, verify these are not empty:
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
```

### Issue 4: Customer Says Payment Failed but Shows as Pending

**Symptoms:**
- Customer sees error on their screen
- Payment link shows as "pending" in our system

**Explanation:**
This usually means the payment actually failed on the bank's side. The `payment.failed` webhook would have been sent. Check:
1. `razorpay_webhooks` table for `payment.failed` event
2. Customer's bank account (no money deducted = payment failed)

---

# Summary: What Makes Our Implementation Secure

```
┌────────────────────────────────────────────────────────────────┐
│                 XLAND INFRA PAYMENT SECURITY                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Webhook Signature Verification                              │
│     → Proves webhooks are from Razorpay, not hackers           │
│                                                                 │
│  ✅ Timing-Safe Comparison                                      │
│     → Prevents hackers from guessing our secret key            │
│                                                                 │
│  ✅ Rate Limiting                                               │
│     → Blocks abuse and denial-of-service attacks               │
│                                                                 │
│  ✅ Amount Validation                                           │
│     → Prevents negative amounts or unrealistic values          │
│                                                                 │
│  ✅ Fraud Detection                                             │
│     → Flags suspicious payment patterns for review             │
│                                                                 │
│  ✅ Audit Logging                                               │
│     → Complete trail for investigation and compliance          │
│                                                                 │
│  ✅ No Card Data on Our Servers                                 │
│     → Payment Links mean Razorpay handles all sensitive data   │
│                                                                 │
│  ✅ HTTPS Everywhere                                            │
│     → All data encrypted in transit                            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

# Contact Information

**Razorpay Support:**
- Email: support@razorpay.com
- Phone: 1800-123-0369 (India toll-free)
- Dashboard: https://dashboard.razorpay.com

**XLAND INFRA Technical Team:**
- Email: tech@xlandinfra.com
- Phone: 8500010111

---

*Document prepared for XLAND INFRA PVT LTD*
*For internal use and Razorpay onboarding discussions*
