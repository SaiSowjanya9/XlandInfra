/**
 * Payment Security Middleware
 * Comprehensive security middleware for payment-related routes
 * 
 * Features:
 * - Payment-specific rate limiting
 * - Amount validation
 * - Fraud detection
 * - Security audit logging
 * - Request fingerprinting
 */

const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');
const {
  validatePaymentAmount,
  generatePaymentFingerprint,
  analyzePaymentRisk,
  getClientIP,
  hashIP,
  verifyRazorpayWebhookSignature
} = require('../utils/paymentSecurity');

// =============================================================================
// RATE LIMITERS FOR PAYMENT OPERATIONS
// =============================================================================

/**
 * Payment Creation Rate Limiter
 * Prevents rapid payment attempts - 10 per 15 minutes per IP
 */
const paymentCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 payment creation attempts
  message: {
    success: false,
    message: 'Too many payment attempts. Please try again after 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + user ID for more precise limiting
    const ip = getClientIP(req);
    const userId = req.user?.id || 'anonymous';
    return `payment:create:${ip}:${userId}`;
  },
  skip: (req) => {
    // Skip rate limiting for admin/operations roles on internal operations
    return ['admin', 'operations_manager'].includes(req.user?.role);
  }
});

/**
 * Payment Link Generation Rate Limiter
 * Prevents abuse of payment link generation - 20 per hour
 */
const paymentLinkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 payment links per hour
  message: {
    success: false,
    message: 'Too many payment link requests. Please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIP(req);
    const userId = req.user?.id || 'anonymous';
    return `payment:link:${ip}:${userId}`;
  }
});

/**
 * QR Code Access Rate Limiter  
 * Prevents QR code scanning abuse - 30 per 5 minutes per IP
 */
const qrAccessLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 scans per 5 minutes (generous for legitimate use)
  message: {
    success: false,
    message: 'Too many requests. Please try again shortly.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `qr:access:${getClientIP(req)}`
});

/**
 * Webhook Rate Limiter
 * Prevents webhook flooding - 100 per minute from same IP
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute (Razorpay can send multiple)
  message: {
    success: false,
    message: 'Too many webhook requests'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `webhook:${getClientIP(req)}`
});

// =============================================================================
// PAYMENT VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Validate payment amount middleware
 * Ensures amount is valid and within acceptable range
 */
const validatePaymentAmountMiddleware = (options = {}) => {
  return (req, res, next) => {
    const amount = req.body.amount || req.body.totalAmount || req.body.balance_amount;
    
    if (amount !== undefined) {
      const validation = validatePaymentAmount(amount, options);
      
      if (!validation.valid) {
        // Log suspicious amount attempts
        logSecurityEvent(req, 'INVALID_AMOUNT', {
          attemptedAmount: amount,
          error: validation.error
        });
        
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }
      
      // Replace with sanitized amount
      if (req.body.amount !== undefined) req.body.amount = validation.sanitizedAmount;
      if (req.body.totalAmount !== undefined) req.body.totalAmount = validation.sanitizedAmount;
      if (req.body.balance_amount !== undefined) req.body.balance_amount = validation.sanitizedAmount;
    }
    
    next();
  };
};

// =============================================================================
// FRAUD DETECTION MIDDLEWARE
// =============================================================================

/**
 * Analyze payment request for fraud indicators
 * Logs suspicious activity but doesn't block (monitoring mode)
 */
const fraudDetectionMiddleware = async (req, res, next) => {
  try {
    const ip = getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const amount = req.body.amount || req.body.totalAmount || 0;
    
    // Generate request fingerprint
    const fingerprint = generatePaymentFingerprint({
      ip,
      userAgent,
      invoiceId: req.body.invoiceId || req.params.invoiceId || '',
      amount,
      timestamp: Date.now()
    });
    
    // Attach fingerprint to request for later use
    req.paymentFingerprint = fingerprint;
    
    // Analyze risk (we don't block, just log and flag)
    const riskAnalysis = analyzePaymentRisk({
      amount,
      ipAddress: ip,
      userAgent,
      timestamp: Date.now()
    });
    
    req.paymentRisk = riskAnalysis;
    
    if (riskAnalysis.suspicious) {
      // Log for review but don't block legitimate payments
      logSecurityEvent(req, 'SUSPICIOUS_PAYMENT', {
        riskScore: riskAnalysis.riskScore,
        reasons: riskAnalysis.reasons,
        fingerprint,
        amount
      });
    }
    
    next();
  } catch (error) {
    // Don't fail payment due to fraud detection error
    console.error('Fraud detection error:', error.message);
    next();
  }
};

// =============================================================================
// WEBHOOK SECURITY MIDDLEWARE
// =============================================================================

/**
 * Verify Razorpay webhook signature
 * Rejects requests with invalid signatures
 */
const verifyWebhookSignatureMiddleware = (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not configured');
    return res.status(500).json({
      success: false,
      message: 'Webhook verification not configured'
    });
  }
  
  if (!signature) {
    logSecurityEvent(req, 'WEBHOOK_MISSING_SIGNATURE', {});
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature'
    });
  }
  
  // Get raw body for signature verification
  const rawBody = req.rawBody || JSON.stringify(req.body);
  
  const isValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
  
  if (!isValid) {
    logSecurityEvent(req, 'WEBHOOK_INVALID_SIGNATURE', {
      providedSignature: signature.substring(0, 10) + '...'
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }
  
  next();
};

// =============================================================================
// SECURITY AUDIT LOGGING
// =============================================================================

/**
 * Log security events to database
 * @param {Object} req - Express request
 * @param {string} eventType - Type of security event
 * @param {Object} details - Event details
 */
const logSecurityEvent = async (req, eventType, details) => {
  try {
    const ip = getClientIP(req);
    const hashedIP = hashIP(ip);
    const userAgent = req.get('User-Agent') || '';
    const userId = req.user?.id || null;
    const userRole = req.user?.role || null;
    
    await pool.execute(`
      INSERT INTO payment_security_logs 
        (event_type, ip_hash, user_agent, user_id, user_role, request_path, request_method, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eventType,
      hashedIP,
      userAgent.substring(0, 500), // Truncate long user agents
      userId,
      userRole,
      req.path,
      req.method,
      JSON.stringify(details)
    ]);
  } catch (error) {
    // Don't fail request due to logging error
    console.error('Security logging error:', error.message);
  }
};

/**
 * Middleware to log all payment-related actions
 */
const paymentAuditMiddleware = (action) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Log after response is ready
      logPaymentAudit(req, action, data);
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Log payment audit trail
 */
const logPaymentAudit = async (req, action, responseData) => {
  try {
    const ip = getClientIP(req);
    const hashedIP = hashIP(ip);
    
    await pool.execute(`
      INSERT INTO payment_audit_trail 
        (action, user_id, user_role, ip_hash, invoice_id, payment_id, amount, success, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      action,
      req.user?.id || null,
      req.user?.role || null,
      hashedIP,
      req.body.invoiceId || req.params.invoiceId || null,
      responseData?.data?.paymentId || null,
      req.body.amount || null,
      responseData?.success ? 1 : 0,
      JSON.stringify({
        fingerprint: req.paymentFingerprint,
        riskScore: req.paymentRisk?.riskScore
      })
    ]);
  } catch (error) {
    console.error('Audit logging error:', error.message);
  }
};

// =============================================================================
// COMPOSITE MIDDLEWARE
// =============================================================================

/**
 * Full payment security stack for critical operations
 * Combines rate limiting, validation, and fraud detection
 */
const fullPaymentSecurity = [
  paymentCreationLimiter,
  validatePaymentAmountMiddleware(),
  fraudDetectionMiddleware,
  paymentAuditMiddleware('PAYMENT_ATTEMPT')
];

/**
 * Light payment security for less critical operations
 * Rate limiting and basic validation only
 */
const lightPaymentSecurity = [
  paymentLinkLimiter,
  validatePaymentAmountMiddleware({ minAmount: 0, allowZero: true })
];

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Rate limiters
  paymentCreationLimiter,
  paymentLinkLimiter,
  qrAccessLimiter,
  webhookLimiter,
  
  // Validation
  validatePaymentAmountMiddleware,
  
  // Security
  fraudDetectionMiddleware,
  verifyWebhookSignatureMiddleware,
  
  // Audit
  paymentAuditMiddleware,
  logSecurityEvent,
  
  // Composites
  fullPaymentSecurity,
  lightPaymentSecurity
};
