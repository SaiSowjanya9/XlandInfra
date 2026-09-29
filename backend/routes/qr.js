const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Authentication middleware for admin endpoints
const { authenticate } = require('../middleware/auth');
// Rate limiting for scan endpoint
const rateLimit = require('express-rate-limit');
// Scan row construction and trend bucketing, with their own tests
const { SCAN_INSERT_SQL, buildScanParams, normalizeGeoLocation, scanWindow, fillScanSeries } = require('../utils/qrScan');

// Database pool will be passed from server.js
let pool;

const initializePool = (dbPool) => {
  pool = dbPool;
};

// SECURITY: Rate limiter for QR scan endpoint (prevent DoS)
const scanRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 scans per minute per IP
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// SECURITY: Validate URL to prevent open redirect attacks
const isValidUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    // Block localhost and internal IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
};

// Admin-only middleware (checks for admin role)
const adminOnly = (req, res, next) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Generate unique IDs
const generateQRId = () => `XLAND-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const generateScanId = () => `scan_${uuidv4()}`;
const generateSessionId = () => `sess_${uuidv4()}`;
const generateVisitorId = () => `vis_${crypto.randomBytes(16).toString('hex')}`;

// Hash IP for privacy
// The salt is chosen before concatenating: `ip + process.env.IP_SALT || 'xland-salt'` parses as
// `(ip + undefined) || 'xland-salt'`, which salted every hash with the string "undefined" instead.
const hashIP = (ip) => crypto.createHash('sha256').update(`${ip}${process.env.IP_SALT || 'xland-salt'}`).digest('hex').substring(0, 32);

// Generate device fingerprint from request headers
// This uniquely identifies a device/browser combination
const generateDeviceFingerprint = (req) => {
  const ua = req.headers['user-agent'] || '';
  const accept = req.headers['accept'] || '';
  const acceptLang = req.headers['accept-language'] || '';
  const acceptEnc = req.headers['accept-encoding'] || '';
  
  // Create a fingerprint from browser characteristics
  const fingerprintString = `${ua}|${accept}|${acceptLang}|${acceptEnc}`;
  return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 32);
};

// In-memory deduplication to prevent rapid re-scans from same device
const recentScans = new Map();
const SCAN_DEDUP_WINDOW = 30000; // 30 seconds

// Check if this is a duplicate scan within the dedup window
const isDuplicateScan = (deviceFingerprint, ipHash, slug) => {
  const now = Date.now();
  const key = `${deviceFingerprint}-${ipHash}-${slug}`;
  
  if (recentScans.has(key)) {
    const lastScan = recentScans.get(key);
    if (now - lastScan < SCAN_DEDUP_WINDOW) {
      return true;
    }
  }
  
  recentScans.set(key, now);
  return false;
};

// Clean up old dedup entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentScans) {
    if (now - timestamp > SCAN_DEDUP_WINDOW * 2) {
      recentScans.delete(key);
    }
  }
}, 60000);

// Parse User Agent
const parseUserAgent = (ua) => {
  if (!ua) return { device: 'unknown', os: 'unknown', browser: 'unknown' };
  
  const uaLower = ua.toLowerCase();
  
  // Device detection - order matters! Check mobile/tablet first, then default to desktop
  let device = 'desktop';
  let deviceBrand = '';
  let deviceModel = '';
  
  // Check for explicit mobile/tablet indicators first
  if (/iphone/i.test(ua)) {
    device = 'mobile';
    deviceBrand = 'Apple';
    deviceModel = 'iPhone';
  } else if (/ipad/i.test(ua)) {
    device = 'tablet';
    deviceBrand = 'Apple';
    deviceModel = 'iPad';
  } else if (/android/i.test(ua)) {
    device = /mobile/i.test(ua) ? 'mobile' : 'tablet';
    deviceBrand = 'Android';
    const match = ua.match(/android[^;]*;\s*([^;)]+)/i);
    deviceModel = match ? match[1].trim() : 'Android Device';
  } else if (/windows phone/i.test(ua)) {
    device = 'mobile';
    deviceBrand = 'Microsoft';
    deviceModel = 'Windows Phone';
  } else if (/macintosh|mac os x/i.test(ua) && !/mobile|iphone|ipad/i.test(ua)) {
    // Explicitly macOS desktop (not iPad in desktop mode)
    device = 'desktop';
    deviceBrand = 'Apple';
    deviceModel = 'Mac';
  } else if (/windows nt/i.test(ua)) {
    device = 'desktop';
    deviceBrand = 'Microsoft';
    deviceModel = 'PC';
  } else if (/linux/i.test(ua) && !/android/i.test(ua)) {
    device = 'desktop';
    deviceBrand = 'Linux';
    deviceModel = 'PC';
  }
  
  // OS detection
  let osName = 'unknown';
  let osVersion = '';
  
  if (/windows nt 10/i.test(ua)) { osName = 'Windows'; osVersion = '10'; }
  else if (/windows nt 11/i.test(ua)) { osName = 'Windows'; osVersion = '11'; }
  else if (/mac os x/i.test(ua)) {
    osName = 'macOS';
    const match = ua.match(/mac os x (\d+[._]\d+)/i);
    osVersion = match ? match[1].replace('_', '.') : '';
  } else if (/iphone os|ipad.*os/i.test(ua)) {
    osName = 'iOS';
    const match = ua.match(/os (\d+[._]\d+)/i);
    osVersion = match ? match[1].replace('_', '.') : '';
  } else if (/android/i.test(ua)) {
    osName = 'Android';
    const match = ua.match(/android (\d+\.?\d*)/i);
    osVersion = match ? match[1] : '';
  } else if (/linux/i.test(ua)) { osName = 'Linux'; }
  
  // Browser detection
  let browserName = 'unknown';
  let browserVersion = '';
  
  if (/edg\//i.test(ua)) {
    browserName = 'Edge';
    const match = ua.match(/edg\/(\d+)/i);
    browserVersion = match ? match[1] : '';
  } else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) {
    browserName = 'Chrome';
    const match = ua.match(/chrome\/(\d+)/i);
    browserVersion = match ? match[1] : '';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browserName = 'Safari';
    const match = ua.match(/version\/(\d+)/i);
    browserVersion = match ? match[1] : '';
  } else if (/firefox/i.test(ua)) {
    browserName = 'Firefox';
    const match = ua.match(/firefox\/(\d+)/i);
    browserVersion = match ? match[1] : '';
  } else if (/opera|opr\//i.test(ua)) {
    browserName = 'Opera';
  }
  
  return {
    device,
    deviceBrand,
    deviceModel,
    osName,
    osVersion,
    browserName,
    browserVersion
  };
};

// Bot detection - Enhanced to filter out common bots and crawlers
const isBot = (ua) => {
  if (!ua) return true;
  const uaLower = ua.toLowerCase();
  
  // Known bot user agents and patterns
  const botPatterns = [
    // Search engine bots
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
    /yandexbot/i, /sogou/i, /exabot/i, /facebot/i, /ia_archiver/i,
    // Social media crawlers
    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i, /pinterest/i,
    /whatsapp/i, /telegrambot/i, /slackbot/i, /discordbot/i,
    // Generic bot patterns
    /bot/i, /crawl/i, /spider/i, /scrape/i, /fetch/i,
    // Tools and libraries
    /curl/i, /wget/i, /python/i, /java\//i, /httpclient/i, /libwww/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
    // Preview generators. Narrow on purpose: /snap/i discarded every scan made from Snapchat's
    // in-app browser, and /preview/i, /thumb/i and /embed/i match nothing a person browses with.
    /snapshot/i, /thumbnail/i, /link-?preview/i,
    // Monitoring and uptime
    /pingdom/i, /uptimerobot/i, /statuscake/i, /newrelic/i, /datadog/i,
    // Other
    /mediapartners/i, /adsbot/i, /apis-google/i, /feedfetcher/i
  ];
  
  // Check if any pattern matches
  if (botPatterns.some(pattern => pattern.test(ua))) {
    return true;
  }
  
  // Additional checks for suspicious patterns
  if (uaLower.includes('http://') || uaLower.includes('https://')) return true;
  if (ua.length < 20) return true; // Very short user agents are often bots
  
  return false;
};

// Get client IP - improved detection for proxied requests
const getClientIP = (req) => {
  // Check multiple headers in order of reliability
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Get the first IP (client IP) from the chain
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    // Filter out private/local IPs and get the first public one
    const publicIP = ips.find(ip => !isPrivateIP(ip));
    if (publicIP) return publicIP;
    return ips[0];
  }
  
  return req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] || // Cloudflare
         req.headers['x-client-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

// Check if IP is private/local
const isPrivateIP = (ip) => {
  if (!ip) return true;
  // Remove IPv6 prefix if present
  ip = ip.replace(/^::ffff:/, '');
  
  // Private IPv4 ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
    /^::1$/,
    /^fe80:/i
  ];
  
  return privateRanges.some(range => range.test(ip));
};

// Get geo location from IP with multiple fallback services.
// Every branch returns the full set of geographic keys through normalizeGeoLocation, because the
// scan INSERT binds all of them: a service that answers without coordinates used to make the insert
// throw on `undefined` and the scan was lost. An unlocated scan says so with NULLs rather than
// claiming a city.
const UNKNOWN_LOCATION = normalizeGeoLocation({});

const getGeoLocation = async (ip) => {
  // Skip lookup for private IPs: a LAN address has no location to report
  if (isPrivateIP(ip) || ip === 'unknown') {
    console.log(`[GeoIP] Skipping private IP: ${ip}`);
    return UNKNOWN_LOCATION;
  }
  
  // Try multiple services in order of reliability
  const services = [
    // Service 1: ipwho.is (free, no key required, accurate)
    async () => {
      const res = await fetch(`https://ipwho.is/${ip}`);
      const data = await res.json();
      if (data.success) {
        return normalizeGeoLocation({
          country: data.country,
          countryCode: data.country_code,
          state: data.region,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone
        });
      }
      throw new Error('ipwho.is failed');
    },
    // Service 2: ip-api.com (free, 45 requests/min)
    async () => {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon,timezone`);
      const data = await res.json();
      if (data.status === 'success') {
        return normalizeGeoLocation(data);
      }
      throw new Error('ip-api.com failed');
    },
    // Service 3: ipapi.co (free, 1000/day)
    async () => {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await res.json();
      if (!data.error) {
        return normalizeGeoLocation({
          country: data.country_name,
          countryCode: data.country_code,
          state: data.region,
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone
        });
      }
      throw new Error('ipapi.co failed');
    }
  ];
  
  // Try each service until one succeeds
  for (const service of services) {
    try {
      const result = await service();
      console.log(`[GeoIP] Located ${ip}: ${result.city}, ${result.state}, ${result.country}`);
      return result;
    } catch (e) {
      continue; // Try next service
    }
  }
  
  console.log(`[GeoIP] All services failed for ${ip}; the scan is recorded without a location`);
  return UNKNOWN_LOCATION;
};

// ============================================
// QR REDIRECT ENDPOINT (Public - Main redirect service)
// SECURITY: Rate limited to prevent DoS attacks
// ============================================

router.get('/r/:slug', scanRateLimiter, async (req, res) => {
  const startTime = Date.now();
  const { slug } = req.params;
  
  try {
    // Get QR code
    const [[qr]] = await pool.execute(
      'SELECT * FROM qr_codes WHERE slug = ? AND is_active = 1',
      [slug]
    );
    
    if (!qr) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code Not Found - XLAND INFRA</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   display: flex; align-items: center; justify-content: center; min-height: 100vh; 
                   margin: 0; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: #fff; }
            .container { text-align: center; padding: 40px; }
            .logo { font-size: 2rem; font-weight: bold; color: #d4af37; margin-bottom: 20px; }
            h1 { font-size: 1.5rem; margin-bottom: 10px; }
            p { color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">XLAND INFRA</div>
            <h1>QR Code Not Found</h1>
            <p>This QR code is no longer active or does not exist.</p>
          </div>
        </body>
        </html>
      `);
    }
    
    // Check expiration
    if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
      return res.status(410).send('This QR code has expired.');
    }
    
    // Get request metadata
    const userAgent = req.headers['user-agent'] || '';
    const ip = getClientIP(req);
    const ipHash = hashIP(ip);
    const deviceFingerprint = generateDeviceFingerprint(req);
    
    // Bot detection - Skip logging for bots but still redirect them
    if (isBot(userAgent)) {
      console.log(`[QR Bot Filtered] Slug: ${slug}, UA: ${userAgent.substring(0, 100)}`);
      return res.redirect(302, qr.current_url);
    }
    
    // Check for rapid re-scan from same device (within 30 seconds)
    if (isDuplicateScan(deviceFingerprint, ipHash, slug)) {
      console.log(`[QR Dedup] Rapid re-scan blocked: ${slug} from same device within 30s`);
      return res.redirect(302, qr.current_url);
    }
    
    // Rate limiting check
    try {
      const [[rateLimit]] = await pool.execute(
        'SELECT * FROM qr_rate_limits WHERE ip_address = ? AND qr_id = ? AND window_start > DATE_SUB(NOW(), INTERVAL 1 MINUTE)',
        [ip, qr.id]
      );
      
      if (rateLimit && rateLimit.request_count > 30) {
        if (!rateLimit.is_blocked) {
          await pool.execute(
            'UPDATE qr_rate_limits SET is_blocked = TRUE, blocked_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE id = ?',
            [rateLimit.id]
          );
        }
        return res.redirect(302, qr.current_url); // Still redirect but don't log
      }
      
      // Update rate limit. The window has to roll, or the row keeps its original window_start
      // for ever: the SELECT above then never matches it again and the counter grows unbounded,
      // which is a limiter that both never fires and cannot be reasoned about.
      await pool.execute(
        `INSERT INTO qr_rate_limits (ip_address, qr_id, request_count, window_start)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           is_blocked = IF(window_start > DATE_SUB(NOW(), INTERVAL 1 MINUTE), is_blocked, FALSE),
           blocked_until = IF(window_start > DATE_SUB(NOW(), INTERVAL 1 MINUTE), blocked_until, NULL),
           request_count = IF(window_start > DATE_SUB(NOW(), INTERVAL 1 MINUTE), request_count + 1, 1),
           window_start = IF(window_start > DATE_SUB(NOW(), INTERVAL 1 MINUTE), window_start, NOW())`,
        [ip, qr.id]
      );
    } catch (e) {}
    
    // Parse user agent
    const uaData = parseUserAgent(userAgent);
    
    // Generate IDs - Use device fingerprint as visitor ID for accurate tracking
    const scanId = generateScanId();
    const sessionId = req.cookies?.qr_session || generateSessionId();
    const visitorId = deviceFingerprint; // Device fingerprint is the visitor ID
    
    // Check if unique user based on DEVICE FINGERPRINT (not just IP)
    // This allows multiple devices on same network to count as separate users
    let isUniqueUser = true;
    let isRepeatScan = false;
    
    try {
      const [[existingScan]] = await pool.execute(
        'SELECT id FROM qr_scans WHERE qr_id = ? AND visitor_id = ? LIMIT 1',
        [qr.id, deviceFingerprint]
      );
      if (existingScan) {
        isUniqueUser = false;
        isRepeatScan = true;
      }
      console.log(`[QR Scan] Device fingerprint: ${deviceFingerprint.substring(0, 8)}..., Unique: ${isUniqueUser}`);
    } catch (e) {
      console.error('[QR Scan] Error checking unique user:', e.message);
    }
    
    // Get geo data using multiple fallback services
    const geoData = await getGeoLocation(ip);
    
    // Log scan
    const redirectLatency = Date.now() - startTime;
    
    try {
      await pool.execute(SCAN_INSERT_SQL, buildScanParams({
        qrId: qr.id,
        scanId,
        visitorId,
        sessionId,
        ip,
        ipHash,
        isUniqueUser,
        isRepeatScan,
        userAgent,
        ua: uaData,
        geo: geoData,
        referrer: req.headers.referer,
        language: req.headers['accept-language']?.split(',')[0],
        redirectUrl: qr.current_url,
        latencyMs: redirectLatency
      }));
      
      // Mirror the scan into the daily roll-up. Nothing reads this to draw a figure -- every number
      // the dashboard shows is counted from qr_scans -- it is retention, so a purge of raw scans
      // still leaves a history behind. qr_reset_analytics.sql rebuilds it from qr_scans, so the two
      // can always be made to agree.
      await pool.execute(
        `INSERT INTO qr_analytics_daily (qr_id, date, total_scans, unique_users, repeat_users, mobile_scans, tablet_scans, desktop_scans)
         VALUES (?, CURDATE(), 1, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           total_scans = total_scans + 1,
           unique_users = unique_users + ?,
           repeat_users = repeat_users + ?,
           mobile_scans = mobile_scans + ?,
           tablet_scans = tablet_scans + ?,
           desktop_scans = desktop_scans + ?`,
        [
          qr.id,
          isUniqueUser ? 1 : 0,
          isRepeatScan ? 1 : 0,
          uaData.device === 'mobile' ? 1 : 0,
          uaData.device === 'tablet' ? 1 : 0,
          uaData.device === 'desktop' ? 1 : 0,
          isUniqueUser ? 1 : 0,
          isRepeatScan ? 1 : 0,
          uaData.device === 'mobile' ? 1 : 0,
          uaData.device === 'tablet' ? 1 : 0,
          uaData.device === 'desktop' ? 1 : 0
        ]
      );
      
      console.log(`[QR Scan] Recorded scan for ${slug} (QR ${qr.id}) - ${uaData.device}, new visitor: ${isUniqueUser}`);
    } catch (e) {
      // The visitor is still redirected below, but a scan that is not written is a scan the dashboard
      // will never show, so say so loudly enough to be found in the log.
      console.error(`[QR Scan] FAILED to record scan for ${slug} (QR ${qr.id}): ${e.message}`, e.code || '');
    }
    
    // Set cookies for visitor tracking with security options
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict', // SECURITY: Prevents CSRF
      secure: isProduction // SECURITY: HTTPS only in production
    };
    res.cookie('qr_visitor', visitorId, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
    res.cookie('qr_session', sessionId, { ...cookieOptions, maxAge: 30 * 60 * 1000 });
    
    // Redirect to destination
    res.redirect(302, qr.current_url);
    
  } catch (error) {
    console.error('QR redirect error:', error);
    res.redirect(302, 'https://www.xlandinfra.com');
  }
});

// ============================================
// COUNTING SCANS
// ============================================

/**
 * `qr_scans` is the only thing any figure is counted from.
 *
 * The flags written with each row (`is_unique_user`, `is_repeat_scan`) and the roll-up tables are
 * not read here: a flag is decided once, by whichever request happened to be first, and cannot be
 * corrected afterwards, while COUNT(DISTINCT visitor) can always be recomputed and always agrees
 * with the rows on the table. "Unique users" counted as `COUNT(*) WHERE is_unique_user` also silently
 * became "first scans", which is a different number as soon as two requests race.
 *
 * A visitor is a device fingerprint. A row that predates fingerprinting has none, so it stands for
 * one visitor of its own rather than being lumped in with every other unidentified row.
 */
const VISITOR = "COALESCE(s.visitor_id, CONCAT('scan:', s.id))";
// Mobile and tablet. A printed QR is scanned with a phone camera; a desktop hit on the same short
// link came from somewhere else, so the two are reported separately rather than being called "real".
const HANDHELD = "s.device_type IN ('mobile', 'tablet')";

// MySQL returns DECIMAL (and so mysql2 returns a string) for SUM; COUNT is BIGINT and comes back as a
// number. Counts are built with COUNT(CASE ...) for that reason, and forced through here regardless,
// so the API never emits "12" where the client will compare it with a number.
const toInt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const intFields = (row, fields) => {
  const out = { ...row };
  for (const field of fields) out[field] = toInt(row?.[field]);
  return out;
};

// ============================================
// QR MANAGEMENT ENDPOINTS (Admin)
// ============================================

// Get all QR codes
router.get('/codes', authenticate, adminOnly, async (req, res) => {
  try {
    const [qrCodes] = await pool.execute(`
      SELECT q.*,
        COUNT(s.id) as total_scans,
        COUNT(DISTINCT ${VISITOR}) as unique_visitors,
        COUNT(CASE WHEN ${HANDHELD} THEN 1 END) as handheld_scans,
        COUNT(CASE WHEN s.scanned_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END) as scans_last_5_min,
        MAX(s.scanned_at) as last_scan_at
      FROM qr_codes q
      LEFT JOIN qr_scans s ON s.qr_id = q.id
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `);
    
    res.json({
      success: true,
      data: qrCodes.map(qr => intFields(qr, ['total_scans', 'unique_visitors', 'handheld_scans', 'scans_last_5_min']))
    });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single QR code with full details
router.get('/codes/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ? OR qr_id = ? OR slug = ?', 
      [req.params.id, req.params.id, req.params.id]);
    
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // Get redirect history
    const [history] = await pool.execute(
      'SELECT * FROM qr_redirect_history WHERE qr_id = ? ORDER BY changed_at DESC LIMIT 10',
      [qr.id]
    );
    
    res.json({ success: true, data: { ...qr, redirect_history: history } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new QR code
router.post('/codes', authenticate, adminOnly, async (req, res) => {
  try {
    const { label, slug, url, description, qr_type, foreground_color, background_color, error_correction } = req.body;
    
    if (!label || !slug || !url) {
      return res.status(400).json({ success: false, message: 'Label, slug, and URL are required' });
    }
    
    // SECURITY: Validate URL to prevent open redirect attacks
    if (!isValidUrl(url)) {
      return res.status(400).json({ success: false, message: 'Invalid URL. Must be a valid http/https URL.' });
    }
    
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ success: false, message: 'Slug must contain only lowercase letters, numbers, and hyphens' });
    }
    
    // Check if slug exists
    const [[existing]] = await pool.execute('SELECT id FROM qr_codes WHERE slug = ?', [slug]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Slug already exists' });
    }
    
    const qrId = generateQRId();
    
    await pool.execute(
      `INSERT INTO qr_codes (qr_id, slug, label, description, current_url, original_url, qr_type, foreground_color, background_color, error_correction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [qrId, slug, label, description || '', url, url, qr_type || 'custom', foreground_color || '#000000', background_color || '#FFFFFF', error_correction || 'H']
    );
    
    const [[newQR]] = await pool.execute('SELECT * FROM qr_codes WHERE qr_id = ?', [qrId]);
    
    res.json({ success: true, data: newQR, message: 'QR code created successfully' });
  } catch (error) {
    console.error('Error creating QR code:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update QR code
router.put('/codes/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { label, current_url, description, is_active, foreground_color, background_color, change_reason } = req.body;
    
    // SECURITY: Validate URL if provided
    if (current_url && !isValidUrl(current_url)) {
      return res.status(400).json({ success: false, message: 'Invalid URL. Must be a valid http/https URL.' });
    }
    
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ?', [req.params.id]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // If URL is changing, log to history
    if (current_url && current_url !== qr.current_url) {
      await pool.execute(
        'INSERT INTO qr_redirect_history (qr_id, previous_url, new_url, change_reason) VALUES (?, ?, ?, ?)',
        [qr.id, qr.current_url, current_url, change_reason || 'URL updated']
      );
    }
    
    await pool.execute(
      `UPDATE qr_codes SET 
        label = COALESCE(?, label),
        current_url = COALESCE(?, current_url),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active),
        foreground_color = COALESCE(?, foreground_color),
        background_color = COALESCE(?, background_color),
        updated_at = NOW()
       WHERE id = ?`,
      [label, current_url, description, is_active, foreground_color, background_color, req.params.id]
    );
    
    const [[updated]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, data: updated, message: 'QR code updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete QR code
router.delete('/codes/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ?', [req.params.id]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // Soft delete by deactivating
    await pool.execute('UPDATE qr_codes SET is_active = 0 WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'QR code deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// QR ANALYTICS ENDPOINTS
// ============================================

// Get analytics overview for all QR codes
router.get('/analytics/overview', authenticate, adminOnly, async (req, res) => {
  try {
    // How many QR codes there are, from the table that holds them. This was
    // COUNT(DISTINCT qr_id) FROM qr_scans, which is how many codes have ever been scanned -- a
    // brand new code, or one nobody has scanned, was missing from the count of codes that exist.
    const [[codes]] = await pool.execute(`
      SELECT
        COUNT(*) as total_qr_codes,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_qr_codes
      FROM qr_codes
    `);
    
    // All-time scan totals
    const [[totals]] = await pool.execute(`
      SELECT
        COUNT(*) as total_scans,
        COUNT(DISTINCT ${VISITOR}) as unique_visitors,
        COUNT(CASE WHEN ${HANDHELD} THEN 1 END) as handheld_scans,
        COUNT(DISTINCT CASE WHEN ${HANDHELD} THEN ${VISITOR} END) as handheld_visitors,
        MAX(s.scanned_at) as last_scan_at
      FROM qr_scans s
    `);
    
    // Visitors who came back. This is a count of visitors with more than one scan, not of the scans
    // that were repeats: 1 visitor scanning 40 times is 1 returning visitor, and the old
    // SUM(is_repeat_scan) reported 39 of them.
    const [[repeat]] = await pool.execute(`
      SELECT COUNT(*) as repeat_visitors FROM (
        SELECT ${VISITOR} as visitor FROM qr_scans s GROUP BY visitor HAVING COUNT(*) > 1
      ) v
    `);
    
    // Today, by the calendar rather than by a rolling 24 hours
    const [[today]] = await pool.execute(`
      SELECT
        COUNT(*) as scans_today,
        COUNT(DISTINCT ${VISITOR}) as visitors_today
      FROM qr_scans s
      WHERE s.scanned_at >= CURDATE() AND s.scanned_at < CURDATE() + INTERVAL 1 DAY
    `);
    
    // Visitors whose *first ever* scan was today. That is what "new" means; it is counted from the
    // rows rather than read from the is_unique_user flag, which only ever described one row.
    const [[newToday]] = await pool.execute(`
      SELECT COUNT(*) as new_visitors_today FROM (
        SELECT ${VISITOR} as visitor, MIN(s.scanned_at) as first_scan
        FROM qr_scans s GROUP BY visitor
      ) v
      WHERE v.first_scan >= CURDATE() AND v.first_scan < CURDATE() + INTERVAL 1 DAY
    `);
    
    // The last five minutes, counted from the scans themselves. qr_active_sessions only ever moved
    // when a scan arrived -- no browser reports back afterwards -- so "active users" was already
    // "scanned within five minutes" wearing a name it could not live up to.
    const [[recent]] = await pool.execute(`
      SELECT
        COUNT(*) as scans_last_5_min,
        COUNT(DISTINCT ${VISITOR}) as visitors_last_5_min
      FROM qr_scans s
      WHERE s.scanned_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `);
    
    // Per QR breakdown, from qr_codes outwards so a code with no scans still appears, with a zero
    const [perQR] = await pool.execute(`
      SELECT 
        q.id, q.qr_id, q.slug, q.label, q.is_active,
        COUNT(s.id) as total_scans,
        COUNT(DISTINCT ${VISITOR}) as unique_visitors,
        COUNT(CASE WHEN ${HANDHELD} THEN 1 END) as handheld_scans,
        COUNT(CASE WHEN s.scanned_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END) as scans_last_5_min,
        MAX(s.scanned_at) as last_scan_at
      FROM qr_codes q
      LEFT JOIN qr_scans s ON q.id = s.qr_id
      GROUP BY q.id
      ORDER BY total_scans DESC, q.created_at DESC
    `);
    
    res.json({
      success: true,
      data: {
        totals: intFields({ ...codes, ...totals, ...repeat, ...today, ...newToday, ...recent }, [
          'total_qr_codes', 'active_qr_codes', 'total_scans', 'unique_visitors', 'handheld_scans',
          'handheld_visitors', 'repeat_visitors', 'scans_today', 'visitors_today',
          'new_visitors_today', 'scans_last_5_min', 'visitors_last_5_min'
        ]),
        per_qr: perQR.map(qr => intFields(qr, ['total_scans', 'unique_visitors', 'handheld_scans', 'scans_last_5_min']))
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get analytics for specific QR code
router.get('/analytics/:qrId', authenticate, adminOnly, async (req, res) => {
  try {
    const { qrId } = req.params;
    
    // Get QR
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ? OR slug = ?', [qrId, qrId]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // The window, and the buckets the trend is drawn in, decided in one place (utils/qrScan.js) and
    // bound as a timestamp. Whole days, so the first bucket is not a part-day the reader compares
    // with six full ones, and every query below uses this same boundary -- the cards, the trend, the
    // breakdowns and the scan list all describe exactly the same set of scans.
    const window = scanWindow(req.query.period);
    const since = window.start;
    
    const [[stats]] = await pool.execute(`
      SELECT 
        COUNT(*) as total_scans,
        COUNT(DISTINCT ${VISITOR}) as unique_visitors,
        COUNT(CASE WHEN ${HANDHELD} THEN 1 END) as handheld_scans,
        COUNT(DISTINCT CASE WHEN ${HANDHELD} THEN ${VISITOR} END) as handheld_visitors,
        COUNT(CASE WHEN s.scanned_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END) as scans_last_5_min,
        MAX(s.scanned_at) as last_scan_at
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
    `, [qr.id, since]);
    
    // Visitors who scanned this code more than once inside the window
    const [[repeat]] = await pool.execute(`
      SELECT COUNT(*) as repeat_visitors FROM (
        SELECT ${VISITOR} as visitor
        FROM qr_scans s
        WHERE s.qr_id = ? AND s.scanned_at >= ?
        GROUP BY visitor HAVING COUNT(*) > 1
      ) v
    `, [qr.id, since]);
    
    // Trend. SQL groups, JS fills the empty buckets: a series that omits the days nothing happened
    // on draws two scans a fortnight apart as neighbours.
    const bucketExpr = window.granularity === 'hour'
      ? "DATE_FORMAT(s.scanned_at, '%Y-%m-%d %H:00:00')"
      : "DATE_FORMAT(s.scanned_at, '%Y-%m-%d')";
    const [trendRows] = await pool.execute(`
      SELECT ${bucketExpr} as bucket,
        COUNT(*) as scans,
        COUNT(DISTINCT ${VISITOR}) as visitors
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `, [qr.id, since]);
    
    // Device breakdown
    const [deviceStats] = await pool.execute(`
      SELECT s.device_type, COUNT(*) as count
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
      GROUP BY s.device_type
      ORDER BY count DESC
    `, [qr.id, since]);
    
    // Browser breakdown
    const [browserStats] = await pool.execute(`
      SELECT s.browser_name, COUNT(*) as count
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
      GROUP BY s.browser_name
      ORDER BY count DESC
      LIMIT 5
    `, [qr.id, since]);
    
    // OS breakdown
    const [osStats] = await pool.execute(`
      SELECT s.os_name, COUNT(*) as count
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
      GROUP BY s.os_name
      ORDER BY count DESC
      LIMIT 5
    `, [qr.id, since]);
    
    // Where the scans came from, to the city. A country list on its own says "India" on every row
    // for a business that operates in one country, which tells the reader nothing they did not know.
    const [locationStats] = await pool.execute(`
      SELECT s.city, s.state, s.country, s.country_code, COUNT(*) as count
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
      GROUP BY s.city, s.state, s.country, s.country_code
      ORDER BY count DESC
      LIMIT 10
    `, [qr.id, since]);
    
    // The most recent scans *within the window*, so the list cannot contradict the cards above it
    const [recentScans] = await pool.execute(`
      SELECT s.scan_id, s.device_type, s.browser_name, s.os_name, s.country, s.state, s.city, s.scanned_at
      FROM qr_scans s
      WHERE s.qr_id = ? AND s.scanned_at >= ?
      ORDER BY s.scanned_at DESC
      LIMIT 20
    `, [qr.id, since]);
    
    res.json({
      success: true,
      data: {
        qr,
        period: { key: window.key, granularity: window.granularity, start: window.start.toISOString(), end: window.end.toISOString() },
        stats: intFields({ ...stats, ...repeat }, [
          'total_scans', 'unique_visitors', 'handheld_scans', 'handheld_visitors', 'scans_last_5_min', 'repeat_visitors'
        ]),
        trend: fillScanSeries(trendRows, window),
        devices: deviceStats.map(row => intFields(row, ['count'])),
        browsers: browserStats.map(row => intFields(row, ['count'])),
        operating_systems: osStats.map(row => intFields(row, ['count'])),
        locations: locationStats.map(row => intFields(row, ['count'])),
        recent_scans: recentScans
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export scans. One row per scan, so the reader can count them again themselves and arrive at the
// figures the dashboard shows -- which is the point of an export.
const EXPORT_COLUMNS = [
  'scan_id', 'scanned_at', 'visitor_id', 'device_type', 'device_brand', 'device_model',
  'os_name', 'os_version', 'browser_name', 'browser_version',
  'city', 'state', 'country', 'country_code'
];

router.get('/analytics/:qrId/export', authenticate, adminOnly, async (req, res) => {
  try {
    const { qrId } = req.params;
    const { format = 'json', period = '30d' } = req.query;
    
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ? OR slug = ?', [qrId, qrId]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // `all` means every scan there is, rather than ten years of them
    const all = period === 'all';
    const since = all ? null : scanWindow(period === '30d' ? '30d' : period).start;
    
    const [scans] = await pool.execute(
      `SELECT ${EXPORT_COLUMNS.join(', ')}
       FROM qr_scans
       WHERE qr_id = ?${all ? '' : ' AND scanned_at >= ?'}
       ORDER BY scanned_at DESC`,
      all ? [qr.id] : [qr.id, since]
    );
    
    if (format === 'csv') {
      // A fixed header, so an empty export still names its columns, and doubled quotes, so a value
      // containing one does not shift every later column by a field.
      const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = scans.map(row => EXPORT_COLUMNS.map(column => cell(row[column])).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=qr-scans-${qr.slug}-${period}.csv`);
      res.send([EXPORT_COLUMNS.join(','), ...rows].join('\n'));
    } else {
      res.json({ success: true, qr, period, total_records: scans.length, data: scans });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// A scan is a scan of a QR code: a request to /api/qr/r/:slug, which only a scanned code produces.
//
// There was a POST /track-visit here that wrote a row into qr_scans for anybody who opened the
// website, and the two were then added together and reported as "Total Scans". That is the data
// `backend/database/cleanup_fake_qr_scans.sql` was written to purge -- "only real QR scans will be
// tracked going forward" -- and it also counted staff browsing the site. It had been dead since the
// security audit put `authenticate` in front of it, because the public site calls it with no token:
// every visit answered 401 and the endpoint tracked nothing at all. It is gone, along with its
// caller in frontend/src/App.jsx.

// Prune expired rate-limit windows, and the session rows left by the retired session tracking
router.post('/maintenance/cleanup-sessions', authenticate, adminOnly, async (req, res) => {
  try {
    await pool.execute(`
      DELETE FROM qr_rate_limits 
      WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    await pool.execute(`
      DELETE FROM qr_active_sessions 
      WHERE last_activity < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, initializePool };
