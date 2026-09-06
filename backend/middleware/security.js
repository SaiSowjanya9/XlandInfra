/**
 * Security Middleware
 * Centralized security configuration for production
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// =============================================================================
// HELMET CONFIGURATION - HTTP Security Headers
// =============================================================================
const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React needs unsafe-eval in dev
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"], // WebSocket support
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  // X-Content-Type-Options: nosniff
  noSniff: true,
  // X-Frame-Options: DENY
  frameguard: { action: 'deny' },
  // X-XSS-Protection: 1; mode=block
  xssFilter: true,
  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // HSTS - Strict Transport Security (only in production with HTTPS)
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  } : false,
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  // IE No Open
  ieNoOpen: true,
  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

// =============================================================================
// RATE LIMITING CONFIGURATIONS
// =============================================================================

// General API Rate Limiter - 500 requests per 15 minutes per IP
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Uses req.ip by default (works with trust proxy setting)
  validate: { xForwardedForHeader: false }, // Disable strict validation for proxied requests
});

// Strict Login Rate Limiter - 5 attempts per 15 minutes
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  validate: { xForwardedForHeader: false }, // Disable strict validation for proxied requests
});

// Password Reset Rate Limiter - 3 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again after 1 hour.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// File Upload Rate Limiter - 100 uploads per hour
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 uploads per hour (property images, documents, etc.)
  message: {
    success: false,
    message: 'Too many file uploads. Please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict Rate Limiter for sensitive operations - 10 per hour
const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many requests for this operation. Please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// =============================================================================
// INPUT SANITIZATION
// =============================================================================

/**
 * Basic XSS sanitization for request body
 * Recursively sanitizes all string values in objects
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#96;');
};

const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
};

/**
 * XSS Sanitization Middleware
 * Sanitizes req.body, req.query, and req.params
 */
const xssSanitizer = (req, res, next) => {
  // Skip sanitization for file uploads (multer handles binary data)
  if (req.is('multipart/form-data')) {
    return next();
  }
  
  // Sanitize body (but preserve original for password fields)
  if (req.body) {
    const passwordFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword'];
    const preservedPasswords = {};
    
    // Preserve password fields before sanitization
    passwordFields.forEach(field => {
      if (req.body[field]) {
        preservedPasswords[field] = req.body[field];
      }
    });
    
    // Sanitize body
    req.body = sanitizeObject(req.body);
    
    // Restore password fields (they shouldn't be HTML-escaped)
    Object.keys(preservedPasswords).forEach(field => {
      req.body[field] = preservedPasswords[field];
    });
  }
  
  // Sanitize query params
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// =============================================================================
// SQL INJECTION PREVENTION - Parameter Validation
// =============================================================================

/**
 * Validates that ID parameters are safe integers
 */
const validateIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (id !== undefined) {
      // Check if it's a valid positive integer
      const parsedId = parseInt(id, 10);
      if (isNaN(parsedId) || parsedId < 0 || parsedId.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${paramName} parameter. Must be a positive integer.`
        });
      }
    }
    
    next();
  };
};

/**
 * Validates pagination parameters
 */
const validatePagination = (req, res, next) => {
  const { page, limit, offset } = req.query;
  
  if (page !== undefined) {
    const parsedPage = parseInt(page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page parameter. Must be a positive integer.'
      });
    }
    req.query.page = parsedPage;
  }
  
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter. Must be between 1 and 100.'
      });
    }
    req.query.limit = parsedLimit;
  }
  
  if (offset !== undefined) {
    const parsedOffset = parseInt(offset, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offset parameter. Must be a non-negative integer.'
      });
    }
    req.query.offset = parsedOffset;
  }
  
  next();
};

// =============================================================================
// REQUEST SIZE LIMITS
// =============================================================================

const bodyParserLimits = {
  json: { limit: '2mb' }, // Limit JSON body to 2MB (estimates, work orders with many items)
  urlencoded: { limit: '2mb', extended: true },
  raw: { limit: '10mb' }, // For file uploads through raw body
};

// =============================================================================
// SECURITY ERROR HANDLER
// =============================================================================

const securityErrorHandler = (err, req, res, next) => {
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Cross-origin request blocked.'
    });
  }
  
  // Rate limit error
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: err.message || 'Too many requests.'
    });
  }
  
  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload too large.'
    });
  }
  
  // JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.'
    });
  }
  
  // Pass to next error handler
  next(err);
};

// =============================================================================
// TRUSTED PROXY CONFIGURATION
// =============================================================================

/**
 * Configure Express to trust proxy headers
 * Required when behind Nginx reverse proxy
 */
const configureTrustProxy = (app) => {
  // Trust first proxy (Nginx)
  app.set('trust proxy', 1);
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Helmet
  helmetConfig,
  
  // Rate Limiters
  apiRateLimiter,
  loginRateLimiter,
  passwordResetLimiter,
  uploadRateLimiter,
  sensitiveOperationLimiter,
  
  // Sanitization
  xssSanitizer,
  sanitizeString,
  sanitizeObject,
  
  // Validation
  validateIdParam,
  validatePagination,
  
  // Body Parser Limits
  bodyParserLimits,
  
  // HPP (HTTP Parameter Pollution prevention)
  hpp: hpp(),
  
  // Error Handler
  securityErrorHandler,
  
  // Proxy Configuration
  configureTrustProxy,
};
