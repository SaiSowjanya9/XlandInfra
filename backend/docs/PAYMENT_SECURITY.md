# Payment Security Implementation

This document describes the security measures implemented for the payment system in XlandInfra.

## Overview

The payment security system provides multiple layers of protection:

1. **Rate Limiting** - Prevents abuse and brute force attacks
2. **Token Security** - Cryptographically signed, time-limited tokens
3. **Amount Validation** - Prevents injection and invalid amounts
4. **Fraud Detection** - Monitors for suspicious patterns
5. **Audit Logging** - Complete trail of all payment actions
6. **Webhook Security** - Timing-safe signature verification

## Files Structure

```
backend/
├── utils/
│   └── paymentSecurity.js      # Core security utilities
├── middleware/
│   └── paymentSecurity.js      # Security middleware
├── database/
│   └── schema_v21_payment_security.sql  # Security tables
└── routes/
    ├── razorpay.js             # Payment link & QR endpoints
    └── payments.js             # Manual payment recording
```

## Security Features

### 1. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Payment Creation | 10 requests | 15 minutes |
| Payment Link Generation | 20 requests | 1 hour |
| QR Code Access | 30 requests | 5 minutes |
| Webhooks | 100 requests | 1 minute |

### 2. Payment Token Security

Tokens are signed using HMAC-SHA256 and include:
- Invoice ID
- Amount (sanitized)
- Timestamp
- Random nonce
- Expiration time (30 minutes default)

```javascript
// Generate token
const token = generatePaymentToken({
  invoiceId: 'INV-2025-00001',
  amount: 5000,
  customerId: 123
});

// Verify token
const result = verifyPaymentToken(token.token);
if (result.valid) {
  // Process payment
}
```

### 3. QR Payment Tokens

Shorter-lived tokens specifically for QR code payments:
- 15-minute expiration
- Compact encoding for QR codes
- Server-side validation
- One-time use tracking

### 4. Amount Validation

All payment amounts are validated for:
- Type correctness (numeric)
- Positive values only
- Range limits (₹1 to ₹1 crore)
- Precision (2 decimal places max)

### 5. Fraud Detection

The system monitors for:
- Large round amounts
- Very large transactions
- Rapid successive payments
- Suspicious user agents
- Bot-like behavior

### 6. Webhook Security

Razorpay webhooks are verified using:
- HMAC-SHA256 signature
- Timing-safe comparison (prevents timing attacks)
- Event logging
- Deduplication

## Database Tables

### payment_security_logs
Tracks security events (invalid attempts, suspicious activity)

### payment_audit_trail
Complete audit trail of all payment actions

### payment_token_blacklist
Tracks revoked/used one-time tokens

### suspicious_payment_patterns
Tracks and analyzes suspicious patterns

## Environment Variables

Required in production:

```env
PAYMENT_TOKEN_SECRET=<64-char-random-string>
QR_TOKEN_SECRET=<64-char-random-string>
IP_HASH_SALT=<random-string>
RAZORPAY_WEBHOOK_SECRET=<from-razorpay-dashboard>
```

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API Endpoints

### Generate QR Token
```
POST /api/razorpay/generate-qr-token
Authorization: Bearer <token>
Body: { invoiceId: 123 }

Response: {
  success: true,
  data: {
    token: "...",
    expiresAt: "...",
    expiresIn: 900
  }
}
```

### Verify QR Token
```
POST /api/razorpay/verify-qr-token
Body: { token: "..." }

Response: {
  success: true,
  data: {
    invoiceId: "INV-2025-00001",
    amount: "5000.00",
    currentBalance: 5000
  }
}
```

## Maintenance

### Cleanup Old Logs
Run periodically to clean old security logs:

```sql
CALL cleanup_payment_security_logs();
```

This removes:
- Security logs older than 90 days
- Audit trail older than 365 days
- Expired blacklist entries

## Best Practices

1. **Never log full tokens** - Only log hashes or prefixes
2. **Always use HTTPS** - All payment traffic must be encrypted
3. **Monitor security logs** - Regular review of suspicious patterns
4. **Rotate secrets periodically** - Update token secrets quarterly
5. **Test rate limits** - Ensure limits don't block legitimate traffic

## Incident Response

If a security breach is detected:

1. Check `payment_security_logs` for attack patterns
2. Review `suspicious_payment_patterns` for affected transactions
3. Add attacker IPs to `payment_rate_limit_overrides` (BLACKLIST)
4. Invalidate affected tokens via `payment_token_blacklist`
5. Notify affected customers if necessary

## Compliance

This implementation helps with:
- PCI DSS compliance (logging, access control)
- GDPR compliance (IP hashing for privacy)
- RBI guidelines for digital payments
