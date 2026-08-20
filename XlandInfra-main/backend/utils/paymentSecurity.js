/**
 * Payment Security Utilities
 * Comprehensive security measures for payment processing
 * 
 * Features:
 * - Cryptographically signed payment tokens
 * - Payment amount validation
 * - QR code security tokens
 * - Fraud detection helpers
 * - Rate limiting utilities
 */

const crypto = require('crypto');

// =============================================================================
// CONFIGURATION
// =============================================================================

// Token expiration times
const PAYMENT_TOKEN_EXPIRY = 30 * 60 * 1000; // 30 minutes
const QR_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes for QR codes (shorter for security)
const PAYMENT_LINK_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days for payment links

// Secret keys - MUST be set via environment variables
// In production: Fail immediately if not set (security requirement)
// In development: Use JWT_SECRET as fallback for convenience
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  if (!process.env.PAYMENT_TOKEN_SECRET) {
    console.error('FATAL: PAYMENT_TOKEN_SECRET must be set in production!');
    console.error('Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }
  if (!process.env.QR_TOKEN_SECRET) {
    console.error('FATAL: QR_TOKEN_SECRET must be set in production!');
    console.error('Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }
}

// Use environment variables, fallback to JWT_SECRET only in development
const PAYMENT_TOKEN_SECRET = process.env.PAYMENT_TOKEN_SECRET || process.env.JWT_SECRET;
const QR_TOKEN_SECRET = process.env.QR_TOKEN_SECRET || process.env.JWT_SECRET;

if (!PAYMENT_TOKEN_SECRET || !QR_TOKEN_SECRET) {
  console.warn('WARNING: Payment secrets not fully configured. Set PAYMENT_TOKEN_SECRET and QR_TOKEN_SECRET in .env');
}

// =============================================================================
// SECURE TOKEN GENERATION (HMAC-SHA256)
// =============================================================================

/**
 * Generate a secure payment token for a transaction
 * Token contains: invoiceId, amount, timestamp, random nonce
 * @param {Object} paymentData - Payment details
 * @returns {Object} - Token and metadata
 */
const generatePaymentToken = (paymentData) => {
  const { invoiceId, amount, customerId, propertyId } = paymentData;
  
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = timestamp + PAYMENT_TOKEN_EXPIRY;
  
  // Create payload
  const payload = {
    inv: invoiceId,
    amt: parseFloat(amount).toFixed(2),
    cust: customerId || '',
    prop: propertyId || '',
    ts: timestamp,
    nonce: nonce,
    exp: expiresAt
  };
  
  // Create signature
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', PAYMENT_TOKEN_SECRET)
    .update(payloadString)
    .digest('hex');
  
  // Encode token (base64 encoded payload + signature)
  const token = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
  
  return {
    token,
    expiresAt: new Date(expiresAt),
    expiresIn: PAYMENT_TOKEN_EXPIRY / 1000 // seconds
  };
};

/**
 * Verify and decode a payment token
 * @param {string} token - The payment token to verify
 * @returns {Object} - { valid: boolean, data: Object|null, error: string|null }
 */
const verifyPaymentToken = (token) => {
  try {
    // Decode token
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const { payload, signature } = decoded;
    
    // Verify signature
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', PAYMENT_TOKEN_SECRET)
      .update(payloadString)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, data: null, error: 'Invalid token signature' };
    }
    
    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, data: null, error: 'Token expired' };
    }
    
    return {
      valid: true,
      data: {
        invoiceId: payload.inv,
        amount: payload.amt,
        customerId: payload.cust,
        propertyId: payload.prop,
        timestamp: payload.ts,
        expiresAt: payload.exp
      },
      error: null
    };
  } catch (error) {
    return { valid: false, data: null, error: 'Invalid token format' };
  }
};

// =============================================================================
// QR CODE SECURITY TOKENS
// =============================================================================

/**
 * Generate a secure QR code token for payment
 * Shorter expiry, includes device binding capability
 * @param {Object} qrData - QR code details
 * @returns {Object} - Token and metadata
 */
const generateQRPaymentToken = (qrData) => {
  const { invoiceId, amount, propertyCode, customerEmail } = qrData;
  
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex'); // Shorter nonce for QR
  const expiresAt = timestamp + QR_TOKEN_EXPIRY;
  
  // Create compact payload for QR (minimize data size)
  const payload = {
    i: invoiceId,
    a: parseFloat(amount).toFixed(2),
    p: propertyCode || '',
    t: timestamp,
    n: nonce,
    e: expiresAt
  };
  
  // Create signature
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', QR_TOKEN_SECRET)
    .update(payloadString)
    .digest('hex')
    .substring(0, 16); // Truncate for QR size optimization (still secure)
  
  // Create compact token
  const token = Buffer.from(JSON.stringify({ p: payload, s: signature })).toString('base64url');
  
  return {
    token,
    expiresAt: new Date(expiresAt),
    expiresIn: QR_TOKEN_EXPIRY / 1000
  };
};

/**
 * Verify a QR payment token
 * @param {string} token - The QR token to verify
 * @returns {Object} - { valid: boolean, data: Object|null, error: string|null }
 */
const verifyQRPaymentToken = (token) => {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const { p: payload, s: signature } = decoded;
    
    // Verify signature
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', QR_TOKEN_SECRET)
      .update(payloadString)
      .digest('hex')
      .substring(0, 16);
    
    if (signature !== expectedSignature) {
      return { valid: false, data: null, error: 'Invalid QR token signature' };
    }
    
    // Check expiration
    if (Date.now() > payload.e) {
      return { valid: false, data: null, error: 'QR token expired' };
    }
    
    return {
      valid: true,
      data: {
        invoiceId: payload.i,
        amount: payload.a,
        propertyCode: payload.p,
        timestamp: payload.t,
        expiresAt: payload.e
      },
      error: null
    };
  } catch (error) {
    return { valid: false, data: null, error: 'Invalid QR token format' };
  }
};

// =============================================================================
// PAYMENT AMOUNT VALIDATION
// =============================================================================

/**
 * Validate payment amount for security
 * Prevents negative amounts, unrealistic values, and injection attempts
 * @param {any} amount - Amount to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { valid: boolean, sanitizedAmount: number, error: string|null }
 */
const validatePaymentAmount = (amount, options = {}) => {
  const {
    minAmount = 1, // Minimum ₹1
    maxAmount = 10000000, // Maximum ₹1 crore
    allowZero = false,
    currency = 'INR'
  } = options;
  
  // Type check
  if (amount === null || amount === undefined) {
    return { valid: false, sanitizedAmount: null, error: 'Amount is required' };
  }
  
  // Convert to number and sanitize
  let numAmount;
  if (typeof amount === 'string') {
    // Remove any non-numeric characters except decimal point
    const sanitized = amount.replace(/[^0-9.]/g, '');
    numAmount = parseFloat(sanitized);
  } else {
    numAmount = parseFloat(amount);
  }
  
  // NaN check
  if (isNaN(numAmount)) {
    return { valid: false, sanitizedAmount: null, error: 'Invalid amount format' };
  }
  
  // Negative check
  if (numAmount < 0) {
    return { valid: false, sanitizedAmount: null, error: 'Amount cannot be negative' };
  }
  
  // Zero check
  if (!allowZero && numAmount === 0) {
    return { valid: false, sanitizedAmount: null, error: 'Amount cannot be zero' };
  }
  
  // Minimum check
  if (numAmount < minAmount && numAmount !== 0) {
    return { valid: false, sanitizedAmount: null, error: `Amount must be at least ${currency} ${minAmount}` };
  }
  
  // Maximum check (prevent unrealistic amounts)
  if (numAmount > maxAmount) {
    return { valid: false, sanitizedAmount: null, error: `Amount exceeds maximum allowed (${currency} ${maxAmount.toLocaleString()})` };
  }
  
  // Precision check (max 2 decimal places for INR)
  const sanitizedAmount = Math.round(numAmount * 100) / 100;
  
  return { valid: true, sanitizedAmount, error: null };
};

// =============================================================================
// FRAUD DETECTION HELPERS
// =============================================================================

/**
 * Generate a unique fingerprint for a payment request
 * Used for duplicate detection and fraud analysis
 * @param {Object} requestData - Request details
 * @returns {string} - Fingerprint hash
 */
const generatePaymentFingerprint = (requestData) => {
  const { ip, userAgent, invoiceId, amount, timestamp } = requestData;
  
  const fingerprintData = `${ip}|${userAgent}|${invoiceId}|${amount}|${Math.floor(timestamp / 60000)}`;
  
  return crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex')
    .substring(0, 32);
};

/**
 * Check for suspicious payment patterns
 * @param {Object} paymentData - Payment details
 * @returns {Object} - { suspicious: boolean, reasons: string[], riskScore: number }
 */
const analyzePaymentRisk = (paymentData) => {
  const reasons = [];
  let riskScore = 0;
  
  const { amount, ipAddress, userAgent, paymentHistory = [], timestamp } = paymentData;
  
  // Check for round amounts (common in fraud)
  const numAmount = parseFloat(amount);
  if (numAmount > 1000 && numAmount % 1000 === 0) {
    reasons.push('Large round amount');
    riskScore += 10;
  }
  
  // Check for very large amounts
  if (numAmount > 500000) {
    reasons.push('Very large transaction amount');
    riskScore += 20;
  }
  
  // Check for rapid successive payments
  const recentPayments = paymentHistory.filter(p => {
    const diff = timestamp - new Date(p.created_at).getTime();
    return diff < 300000; // Within 5 minutes
  });
  
  if (recentPayments.length > 3) {
    reasons.push('Multiple rapid payment attempts');
    riskScore += 30;
  }
  
  // Check for missing/suspicious user agent
  if (!userAgent || userAgent.length < 30) {
    reasons.push('Suspicious or missing user agent');
    riskScore += 15;
  }
  
  // Bot patterns in user agent
  const botPatterns = /bot|crawl|spider|scrape|curl|wget|python|java\//i;
  if (userAgent && botPatterns.test(userAgent)) {
    reasons.push('Bot-like user agent detected');
    riskScore += 40;
  }
  
  return {
    suspicious: riskScore >= 30,
    reasons,
    riskScore: Math.min(riskScore, 100)
  };
};

// =============================================================================
// RAZORPAY WEBHOOK SIGNATURE VERIFICATION (ENHANCED)
// =============================================================================

/**
 * Verify Razorpay webhook signature
 * Uses constant-time comparison to prevent timing attacks
 * @param {string} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} secret - Webhook secret
 * @returns {boolean} - Whether signature is valid
 */
const verifyRazorpayWebhookSignature = (body, signature, secret) => {
  if (!body || !signature || !secret) {
    return false;
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Webhook signature verification error:', error.message);
    return false;
  }
};

/**
 * Verify Razorpay payment signature (for payment verification)
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Payment signature
 * @param {string} secret - API key secret
 * @returns {boolean} - Whether signature is valid
 */
const verifyRazorpayPaymentSignature = (orderId, paymentId, signature, secret) => {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }
  
  try {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Payment signature verification error:', error.message);
    return false;
  }
};

// =============================================================================
// IP AND REQUEST UTILITIES
// =============================================================================

/**
 * Hash IP address for privacy-preserving logging
 * @param {string} ip - IP address
 * @returns {string} - Hashed IP (first 16 chars)
 */
const hashIP = (ip) => {
  const salt = process.env.IP_HASH_SALT || 'xland-payment-security';
  return crypto
    .createHash('sha256')
    .update(ip + salt)
    .digest('hex')
    .substring(0, 16);
};

/**
 * Extract real IP from request (handles proxies)
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Token generation & verification
  generatePaymentToken,
  verifyPaymentToken,
  generateQRPaymentToken,
  verifyQRPaymentToken,
  
  // Amount validation
  validatePaymentAmount,
  
  // Fraud detection
  generatePaymentFingerprint,
  analyzePaymentRisk,
  
  // Razorpay security
  verifyRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature,
  
  // IP utilities
  hashIP,
  getClientIP,
  
  // Constants
  PAYMENT_TOKEN_EXPIRY,
  QR_TOKEN_EXPIRY,
  PAYMENT_LINK_EXPIRY
};
