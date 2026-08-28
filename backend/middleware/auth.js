/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 * 
 * SECURITY: JWT_SECRET must be set via environment variable
 * - Production: Will not start without JWT_SECRET
 * - Development: Generates cryptographically random secret (per-session)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

// JWT Configuration - MUST be set in environment variables for production
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// SECURITY: Generate secure random secret for development
// This ensures tokens are invalid between server restarts in dev (safer behavior)
let EFFECTIVE_JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is not set!');
    console.error('Please set a secure random string (at least 64 characters) in your environment.');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  } else {
    // Development: Generate random secret per server instance
    // This invalidates tokens on restart, which is safer for development
    EFFECTIVE_JWT_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('⚠️  WARNING: No JWT_SECRET set. Generated random development secret.');
    console.warn('⚠️  Tokens will be invalidated on server restart.');
  }
} else {
  // Validate JWT_SECRET strength
  if (JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET is too short. Use at least 64 characters for production.');
  }
  EFFECTIVE_JWT_SECRET = JWT_SECRET;
}

// Generate JWT Token
const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    firstName: user.first_name || user.firstName,
    lastName: user.last_name || user.lastName
  };
  
  // Include FP-specific fields if present (check both camelCase and snake_case)
  const fpId = user.fpId || user.franchise_partner_id || user.franchisePartnerId;
  if (fpId) {
    payload.fpId = fpId;
    payload.franchisePartnerId = fpId;
  }
  if (user.userId || user.user_id) {
    payload.userId = user.userId || user.user_id;
  }
  // Include coordinatorId, managerId, supervisorId, executiveId if present
  if (user.coordinatorId) payload.coordinatorId = user.coordinatorId;
  if (user.managerId) payload.managerId = user.managerId;
  if (user.supervisorId) payload.supervisorId = user.supervisorId;
  if (user.executiveId) payload.executiveId = user.executiveId;
  
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT Token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, EFFECTIVE_JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    // Attach user info to request
    req.user = decoded;

    // Optionally verify user still exists and is active in database
    try {
      let user = null;
      
      if (decoded.role === ROLES.VENDOR) {
        try {
          const [vendors] = await pool.execute(
            'SELECT id, is_active FROM vendors WHERE id = ?',
            [decoded.id]
          );
          user = vendors[0];
        } catch (e) {
          console.log('Vendors table check skipped:', e.message);
          user = { id: decoded.id, is_active: 1 }; // Continue with token
        }
      } else if (decoded.role === ROLES.FRANCHISE_PARTNER) {
        // FPs - try franchise_partners table, fallback to users
        try {
          const [fps] = await pool.execute(
            'SELECT id, is_active FROM franchise_partners WHERE id = ?',
            [decoded.id]
          );
          user = fps[0];
        } catch (e) {
          console.log('franchise_partners table not found, trying users:', e.message);
          try {
            const [users] = await pool.execute(
              'SELECT id, is_active FROM users WHERE id = ?',
              [decoded.id]
            );
            user = users[0];
          } catch (e2) {
            console.log('Users table check also failed:', e2.message);
            user = { id: decoded.id, is_active: 1 }; // Continue with token
          }
        }
        // Set fpId on request for later use
        if (user || decoded.id) {
          req.fpId = decoded.id;
        }
      } else if (decoded.franchisePartnerId || decoded.fpId) {
        // FP employees (manager, coordinator, supervisor, executive)
        try {
          const [employees] = await pool.execute(
            'SELECT id, is_active, franchise_partner_id FROM fp_employees WHERE id = ?',
            [decoded.id]
          );
          user = employees[0];
          if (user) {
            req.fpId = user.franchise_partner_id;
          }
        } catch (e) {
          console.log('fp_employees table check skipped:', e.message);
          user = { id: decoded.id, is_active: 1 };
          req.fpId = decoded.franchisePartnerId || decoded.fpId;
        }
      } else {
        try {
          const [users] = await pool.execute(
            'SELECT id, is_active FROM users WHERE id = ?',
            [decoded.id]
          );
          user = users[0];
        } catch (e) {
          console.log('Users table check skipped:', e.message);
          user = { id: decoded.id, is_active: 1 }; // Continue with token
        }
      }

      // If user not found but we have valid token, continue with token data
      if (!user && decoded.id) {
        user = { id: decoded.id, is_active: 1 };
        if (decoded.fpId || decoded.franchisePartnerId) {
          req.fpId = decoded.fpId || decoded.franchisePartnerId;
        }
      }

      // Check if user is inactive
      if (user && (user.is_active === false || user.is_active === 0)) {
        return res.status(401).json({
          success: false,
          message: 'User account is inactive.'
        });
      }
    } catch (dbError) {
      // If database is not available, continue with token data and set fpId from token
      console.log('Database check skipped:', dbError.message);
      // Still set fpId from token if available
      if (decoded.fpId || decoded.franchisePartnerId) {
        req.fpId = decoded.fpId || decoded.franchisePartnerId;
      }
    }

    // Ensure fpId is set from token if not already set from database
    if (!req.fpId && (decoded.fpId || decoded.franchisePartnerId)) {
      req.fpId = decoded.fpId || decoded.franchisePartnerId;
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Check if user is authenticated (for internal use)
const isAuthenticated = (req) => {
  return !!req.user;
};

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  isAuthenticated,
  // SECURITY: JWT_SECRET is NOT exported - use verifyToken() instead
  // Only expose token expiry for informational purposes
  JWT_EXPIRES_IN
};
