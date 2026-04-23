/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

const JWT_SECRET = process.env.JWT_SECRET || 'pm-software-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.first_name || user.firstName,
      lastName: user.last_name || user.lastName
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Verify JWT Token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
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
        const [vendors] = await pool.execute(
          'SELECT id, is_active FROM vendors WHERE id = ?',
          [decoded.id]
        );
        user = vendors[0];
      } else {
        const [users] = await pool.execute(
          'SELECT id, is_active FROM users WHERE id = ?',
          [decoded.id]
        );
        user = users[0];
      }

      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'User account is inactive or does not exist.'
        });
      }
    } catch (dbError) {
      // If database is not available, continue with token data
      console.log('Database check skipped:', dbError.message);
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
  JWT_SECRET,
  JWT_EXPIRES_IN
};
