/**
 * XLAND INFRA QR Redirect Service
 * Production-ready standalone service for qr.xlandinfra.com
 * 
 * Routes:
 *   GET /:slug - Redirect to target URL with analytics tracking
 *   GET /health - Health check endpoint
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const UAParser = require('ua-parser-js');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.QR_SERVICE_PORT || 3500;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'customer_portal',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0
};

let pool = null;

// Initialize database pool
const initDB = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('✅ Database connected');
    conn.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// CORS - Allow all origins for QR redirects
app.use(cors());
app.use(express.json());

// Trust proxy for accurate IP detection behind load balancer
app.set('trust proxy', true);

// Bot detection patterns
const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python/i, /java\//i, /apache/i, /http/i, /fetch/i, /node/i,
  /phantom/i, /headless/i, /selenium/i, /puppeteer/i, /playwright/i
];

const isBot = (userAgent) => {
  if (!userAgent) return true;
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
};

// Hash IP for privacy
const hashIP = (ip) => {
  const salt = process.env.IP_SALT || 'xland-qr-2024';
  return crypto.createHash('sha256').update(ip + salt).digest('hex').substring(0, 16);
};

// Check if IP is private/local
const isPrivateIP = (ip) => {
  if (!ip) return true;
  ip = ip.replace(/^::ffff:/, '');
  const privateRanges = [
    /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
    /^127\./, /^localhost$/i, /^::1$/, /^fe80:/i
  ];
  return privateRanges.some(range => range.test(ip));
};

// Get geo location from IP with multiple fallback services
const getGeoLocation = async (ip) => {
  const defaultGeo = { country: 'India', countryCode: 'IN', state: 'Unknown', city: 'Unknown' };
  
  if (isPrivateIP(ip) || ip === 'unknown') {
    return defaultGeo;
  }
  
  const services = [
    // ipwho.is - most accurate
    async () => {
      const res = await fetch(`https://ipwho.is/${ip}`);
      const data = await res.json();
      if (data.success) {
        return { country: data.country, countryCode: data.country_code, state: data.region, city: data.city };
      }
      throw new Error('failed');
    },
    // ip-api.com fallback
    async () => {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`);
      const data = await res.json();
      if (data.status === 'success') {
        return { country: data.country, countryCode: data.countryCode, state: data.regionName, city: data.city };
      }
      throw new Error('failed');
    },
    // ipapi.co fallback
    async () => {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await res.json();
      if (!data.error) {
        return { country: data.country_name, countryCode: data.country_code, state: data.region, city: data.city };
      }
      throw new Error('failed');
    }
  ];
  
  for (const service of services) {
    try {
      const result = await service();
      console.log(`[GeoIP] ${ip} → ${result.city}, ${result.state}, ${result.country}`);
      return result;
    } catch (e) { continue; }
  }
  
  return defaultGeo;
};

// Generate device fingerprint from request headers
const generateDeviceFingerprint = (req) => {
  const ua = req.get('User-Agent') || '';
  const accept = req.get('Accept') || '';
  const acceptLang = req.get('Accept-Language') || '';
  const acceptEnc = req.get('Accept-Encoding') || '';
  
  // Create a fingerprint from browser characteristics
  const fingerprintString = `${ua}|${accept}|${acceptLang}|${acceptEnc}`;
  return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 32);
};

// Generate unique IDs
const generateId = () => crypto.randomBytes(16).toString('hex');

// Rate limiting in-memory store (use Redis in production cluster)
const rateLimits = new Map();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

// Scan deduplication store - prevent duplicate scans within 30 seconds
// Key: ip_hash + device_fingerprint + slug
const recentScans = new Map();
const SCAN_DEDUP_WINDOW = 30000; // 30 seconds - prevents rapid re-scans from same device

const checkRateLimit = (ip) => {
  const now = Date.now();
  const key = ip;
  
  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  const limit = rateLimits.get(key);
  if (now - limit.windowStart > RATE_WINDOW) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
};

// Clean up rate limits and recent scans periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimits) {
    if (now - value.windowStart > RATE_WINDOW * 2) {
      rateLimits.delete(key);
    }
  }
  // Clean up old scan dedup entries
  for (const [key, timestamp] of recentScans) {
    if (now - timestamp > SCAN_DEDUP_WINDOW * 2) {
      recentScans.delete(key);
    }
  }
}, 60000);

// Check if this is a duplicate scan (same device fingerprint + IP + slug within 30 seconds)
// This prevents rapid re-scans but allows different devices on same network
const isDuplicateScan = (ip, deviceFingerprint, slug) => {
  const now = Date.now();
  // Use device fingerprint + IP hash + slug for precise deduplication
  const key = `${deviceFingerprint}-${hashIP(ip)}-${slug}`;
  
  if (recentScans.has(key)) {
    const lastScan = recentScans.get(key);
    if (now - lastScan < SCAN_DEDUP_WINDOW) {
      console.log(`[QR Dedup] Rapid re-scan blocked: ${slug} from same device within ${SCAN_DEDUP_WINDOW/1000}s`);
      return true; // Duplicate scan within window
    }
  }
  
  recentScans.set(key, now);
  return false;
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'XLAND INFRA QR Redirect Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Favicon - return empty to prevent 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Main QR redirect endpoint
app.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const startTime = Date.now();
  
  // Get client info
  const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  const language = req.get('Accept-Language')?.split(',')[0] || 'en';
  
  // Rate limit check
  if (!checkRateLimit(ip)) {
    console.log(`⚠️ Rate limited: ${ip} for slug: ${slug}`);
    return res.status(429).json({ 
      error: 'Too many requests', 
      message: 'Please try again later' 
    });
  }
  
  // Bot check - still redirect but don't log analytics
  const isBotRequest = isBot(userAgent);
  
  try {
    if (!pool) {
      // Fallback redirects if database not available
      const fallbacks = {
        'main': 'https://www.xlandinfra.com',
        'admin': 'https://admin.xlandinfra.com'
      };
      
      if (fallbacks[slug]) {
        return res.redirect(302, fallbacks[slug]);
      }
      return res.status(404).json({ error: 'QR code not found' });
    }
    
    // Get QR code from database
    const [qrRows] = await pool.execute(
      'SELECT id, current_url, is_active, label FROM qr_codes WHERE slug = ? LIMIT 1',
      [slug]
    );
    
    if (qrRows.length === 0) {
      console.log(`❌ QR not found: ${slug}`);
      return res.status(404).json({ 
        error: 'QR code not found',
        message: 'This QR code does not exist'
      });
    }
    
    const qr = qrRows[0];
    
    // Check if QR is active
    if (!qr.is_active) {
      console.log(`⚠️ QR disabled: ${slug}`);
      return res.status(410).json({ 
        error: 'QR code disabled',
        message: 'This QR code has been deactivated'
      });
    }
    
    const redirectUrl = qr.current_url;
    const redirectLatency = Date.now() - startTime;
    
    // Generate device fingerprint for this request
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Log analytics (non-blocking, skip for bots and duplicates)
    const isDuplicate = isDuplicateScan(ip, deviceFingerprint, slug);
    if (!isBotRequest && !isDuplicate) {
      setImmediate(async () => {
        try {
          const parser = new UAParser(userAgent);
          const device = parser.getDevice();
          const os = parser.getOS();
          const browser = parser.getBrowser();
          
          // Determine device type
          let deviceType = 'desktop';
          if (device.type === 'mobile') deviceType = 'mobile';
          else if (device.type === 'tablet') deviceType = 'tablet';
          
          const scanId = generateId();
          const visitorId = deviceFingerprint; // Use device fingerprint as visitor ID
          const sessionId = generateId();
          const ipHash = hashIP(ip);
          
          // Check if unique user based on DEVICE FINGERPRINT (not just IP)
          // This allows multiple devices on same network to count as separate users
          const [existingScans] = await pool.execute(
            'SELECT id FROM qr_scans WHERE qr_id = ? AND visitor_id = ? LIMIT 1',
            [qr.id, deviceFingerprint]
          );
          const isUniqueUser = existingScans.length === 0;
          
          console.log(`[QR Scan] Device: ${deviceType}, Fingerprint: ${deviceFingerprint.substring(0,8)}..., Unique: ${isUniqueUser}`);
          
          // Get geo location
          const geoData = await getGeoLocation(ip);
          
          // Insert scan record
          await pool.execute(`
            INSERT INTO qr_scans (
              qr_id, scan_id, visitor_id, session_id, ip_hash,
              is_unique_user, is_repeat_scan, user_agent,
              device_type, device_brand, device_model,
              os_name, os_version, browser_name, browser_version,
              country, country_code, state, city,
              referrer_url, referrer_domain, language,
              redirect_url, redirect_success, redirect_latency_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            qr.id, scanId, visitorId, sessionId, ipHash,
            isUniqueUser, !isUniqueUser, userAgent,
            deviceType, device.vendor || null, device.model || null,
            os.name || null, os.version || null,
            browser.name || null, browser.version || null,
            geoData.country, geoData.countryCode, geoData.state, geoData.city,
            referer || null, referer ? new URL(referer).hostname : null,
            language, redirectUrl, true, redirectLatency
          ]);
          
          // Update daily analytics
          const today = new Date().toISOString().split('T')[0];
          await pool.execute(`
            INSERT INTO qr_analytics_daily (qr_id, date, total_scans, unique_users, repeat_users, mobile_scans, tablet_scans, desktop_scans)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              total_scans = total_scans + 1,
              unique_users = unique_users + ?,
              repeat_users = repeat_users + ?,
              mobile_scans = mobile_scans + ?,
              tablet_scans = tablet_scans + ?,
              desktop_scans = desktop_scans + ?
          `, [
            qr.id, today,
            isUniqueUser ? 1 : 0,
            !isUniqueUser ? 1 : 0,
            deviceType === 'mobile' ? 1 : 0,
            deviceType === 'tablet' ? 1 : 0,
            deviceType === 'desktop' ? 1 : 0,
            isUniqueUser ? 1 : 0,
            !isUniqueUser ? 1 : 0,
            deviceType === 'mobile' ? 1 : 0,
            deviceType === 'tablet' ? 1 : 0,
            deviceType === 'desktop' ? 1 : 0
          ]);
          
          // Create active session
          await pool.execute(`
            INSERT INTO qr_active_sessions (qr_id, session_id, visitor_id, device_type, browser, os)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [qr.id, sessionId, visitorId, deviceType, browser.name || 'Unknown', os.name || 'Unknown']);
          
          console.log(`✅ Scan logged: ${slug} → ${redirectUrl} (${deviceType}, unique=${isUniqueUser}, ${redirectLatency}ms})`);
        } catch (err) {
          console.error('Analytics logging error:', err.message);
        }
      });
    } else if (isBotRequest) {
      console.log(`🤖 Bot scan skipped: ${slug} from ${userAgent.substring(0, 50)}`);
    } else {
      console.log(`⏱️ Duplicate scan skipped: ${slug} (same device within ${SCAN_DEDUP_WINDOW/1000}s)`);
    }
    
    // Perform redirect
    res.redirect(302, redirectUrl);
    
  } catch (error) {
    console.error(`❌ Redirect error for ${slug}:`, error.message);
    
    // Fallback redirects
    const fallbacks = {
      'main': 'https://www.xlandinfra.com',
      'admin': 'https://admin.xlandinfra.com'
    };
    
    if (fallbacks[slug]) {
      return res.redirect(302, fallbacks[slug]);
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Unable to process redirect'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Invalid QR code path',
    validPaths: ['/:slug', '/health']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// Start server
const startServer = async () => {
  await initDB();
  
  app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('   XLAND INFRA QR Redirect Service');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   🚀 Server running on port ${PORT}`);
    console.log(`   📍 Health: http://localhost:${PORT}/health`);
    console.log(`   🔗 Redirect: http://localhost:${PORT}/:slug`);
    console.log('═══════════════════════════════════════════════════');
    console.log('   Production URLs:');
    console.log('   • https://qr.xlandinfra.com/main → Main Website');
    console.log('   • https://qr.xlandinfra.com/admin → Admin Portal');
    console.log('═══════════════════════════════════════════════════');
  });
};

startServer();
