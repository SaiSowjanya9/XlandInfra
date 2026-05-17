const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Database pool will be passed from server.js
let pool;

const initializePool = (dbPool) => {
  pool = dbPool;
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
const hashIP = (ip) => crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'xland-salt').digest('hex').substring(0, 32);

// Parse User Agent
const parseUserAgent = (ua) => {
  if (!ua) return { device: 'unknown', os: 'unknown', browser: 'unknown' };
  
  const uaLower = ua.toLowerCase();
  
  // Device detection
  let device = 'desktop';
  let deviceBrand = '';
  let deviceModel = '';
  
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

// Bot detection
const isBot = (ua) => {
  if (!ua) return true;
  const botPatterns = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python/i, /java\//i, /httpclient/i, /libwww/i, /headless/i
  ];
  return botPatterns.some(pattern => pattern.test(ua));
};

// Get client IP
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

// ============================================
// QR REDIRECT ENDPOINT (Public - Main redirect service)
// ============================================

router.get('/r/:slug', async (req, res) => {
  const startTime = Date.now();
  const { slug } = req.params;
  
  try {
    // Get QR code
    const [[qr]] = await pool.execute(
      'SELECT * FROM qr_codes WHERE slug = ? AND is_active = TRUE',
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
    
    // Bot detection
    if (isBot(userAgent)) {
      // Log bot but don't count in analytics
      try {
        await pool.execute(
          'INSERT INTO qr_bot_detections (ip_address, user_agent, detection_type, confidence_score) VALUES (?, ?, ?, ?)',
          [ip, userAgent.substring(0, 500), 'bot', 95.0]
        );
      } catch (e) {}
      
      // Still redirect bots
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
      
      // Update rate limit
      await pool.execute(
        `INSERT INTO qr_rate_limits (ip_address, qr_id, request_count, window_start)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
        [ip, qr.id]
      );
    } catch (e) {}
    
    // Parse user agent
    const uaData = parseUserAgent(userAgent);
    
    // Generate IDs
    const scanId = generateScanId();
    const sessionId = req.cookies?.qr_session || generateSessionId();
    const visitorId = req.cookies?.qr_visitor || generateVisitorId();
    
    // Check if unique user
    let isUniqueUser = true;
    let isRepeatScan = false;
    
    try {
      const [[existingScan]] = await pool.execute(
        'SELECT id FROM qr_scans WHERE qr_id = ? AND ip_hash = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
        [qr.id, ipHash]
      );
      if (existingScan) {
        isUniqueUser = false;
        isRepeatScan = true;
      }
    } catch (e) {}
    
    // Get geo data (simplified - in production use MaxMind or similar)
    let geoData = {
      country: 'Unknown',
      countryCode: 'XX',
      state: 'Unknown',
      city: 'Unknown',
      latitude: null,
      longitude: null,
      timezone: null
    };
    
    // Log scan
    const redirectLatency = Date.now() - startTime;
    
    try {
      await pool.execute(
        `INSERT INTO qr_scans (
          qr_id, scan_id, visitor_id, session_id, ip_address, ip_hash,
          is_unique_user, is_repeat_scan, user_agent, device_type, device_brand, device_model,
          os_name, os_version, browser_name, browser_version,
          country, country_code, state, city, latitude, longitude, timezone,
          referrer_url, referrer_domain, language, redirect_url, redirect_success, redirect_latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          qr.id, scanId, visitorId, sessionId, ip, ipHash,
          isUniqueUser, isRepeatScan, userAgent.substring(0, 500), uaData.device, uaData.deviceBrand, uaData.deviceModel,
          uaData.osName, uaData.osVersion, uaData.browserName, uaData.browserVersion,
          geoData.country, geoData.countryCode, geoData.state, geoData.city, geoData.latitude, geoData.longitude, geoData.timezone,
          req.headers.referer || null, req.headers.referer ? new URL(req.headers.referer).hostname : null,
          req.headers['accept-language']?.split(',')[0] || null,
          qr.current_url, true, redirectLatency
        ]
      );
      
      // Update daily analytics
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
      
      // Update hourly analytics
      await pool.execute(
        `INSERT INTO qr_analytics_hourly (qr_id, hour_timestamp, total_scans, unique_users)
         VALUES (?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'), 1, ?)
         ON DUPLICATE KEY UPDATE total_scans = total_scans + 1, unique_users = unique_users + ?`,
        [qr.id, isUniqueUser ? 1 : 0, isUniqueUser ? 1 : 0]
      );
      
      // Update active session
      await pool.execute(
        `INSERT INTO qr_active_sessions (qr_id, session_id, visitor_id, ip_address, device_type, browser, os, country, city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE last_activity = NOW(), is_active = TRUE`,
        [qr.id, sessionId, visitorId, ip, uaData.device, uaData.browserName, uaData.osName, geoData.country, geoData.city]
      );
      
    } catch (e) {
      console.error('Error logging scan:', e);
    }
    
    // Set cookies for visitor tracking
    res.cookie('qr_visitor', visitorId, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    res.cookie('qr_session', sessionId, { maxAge: 30 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    
    // Redirect to destination
    res.redirect(302, qr.current_url);
    
  } catch (error) {
    console.error('QR redirect error:', error);
    res.redirect(302, 'https://www.xlandinfra.com');
  }
});

// ============================================
// QR MANAGEMENT ENDPOINTS (Admin)
// ============================================

// Get all QR codes
router.get('/codes', async (req, res) => {
  try {
    const [qrCodes] = await pool.execute(`
      SELECT q.*, 
        (SELECT COUNT(*) FROM qr_scans WHERE qr_id = q.id) as total_scans,
        (SELECT COUNT(*) FROM qr_scans WHERE qr_id = q.id AND is_unique_user = TRUE) as unique_users,
        (SELECT COUNT(*) FROM qr_active_sessions WHERE qr_id = q.id AND is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) as active_users
      FROM qr_codes q
      ORDER BY q.created_at DESC
    `);
    
    res.json({ success: true, data: qrCodes });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single QR code with full details
router.get('/codes/:id', async (req, res) => {
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
router.post('/codes', async (req, res) => {
  try {
    const { label, slug, url, description, qr_type, foreground_color, background_color, error_correction } = req.body;
    
    if (!label || !slug || !url) {
      return res.status(400).json({ success: false, message: 'Label, slug, and URL are required' });
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
router.put('/codes/:id', async (req, res) => {
  try {
    const { label, current_url, description, is_active, foreground_color, background_color, change_reason } = req.body;
    
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
router.delete('/codes/:id', async (req, res) => {
  try {
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ?', [req.params.id]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // Soft delete by deactivating
    await pool.execute('UPDATE qr_codes SET is_active = FALSE WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'QR code deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// QR ANALYTICS ENDPOINTS
// ============================================

// Get analytics overview for all QR codes
router.get('/analytics/overview', async (req, res) => {
  try {
    // Total stats
    const [[totals]] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT qr_id) as total_qr_codes,
        COUNT(*) as total_scans,
        SUM(CASE WHEN is_unique_user = TRUE THEN 1 ELSE 0 END) as unique_users,
        SUM(CASE WHEN is_repeat_scan = TRUE THEN 1 ELSE 0 END) as repeat_scans
      FROM qr_scans
    `);
    
    // Today's stats
    const [[today]] = await pool.execute(`
      SELECT 
        COUNT(*) as scans_today,
        SUM(CASE WHEN is_unique_user = TRUE THEN 1 ELSE 0 END) as unique_today
      FROM qr_scans
      WHERE DATE(scanned_at) = CURDATE()
    `);
    
    // Active users now
    const [[active]] = await pool.execute(`
      SELECT COUNT(*) as active_now
      FROM qr_active_sessions
      WHERE is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `);
    
    // Per QR breakdown
    const [perQR] = await pool.execute(`
      SELECT 
        q.id, q.qr_id, q.slug, q.label,
        COUNT(s.id) as total_scans,
        SUM(CASE WHEN s.is_unique_user = TRUE THEN 1 ELSE 0 END) as unique_users,
        (SELECT COUNT(*) FROM qr_active_sessions WHERE qr_id = q.id AND is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) as active_now
      FROM qr_codes q
      LEFT JOIN qr_scans s ON q.id = s.qr_id
      GROUP BY q.id
    `);
    
    res.json({
      success: true,
      data: {
        totals: { ...totals, ...today, active_now: active.active_now },
        per_qr: perQR
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get analytics for specific QR code
router.get('/analytics/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const { period = '7d' } = req.query;
    
    // Get QR
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ? OR slug = ?', [qrId, qrId]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    // Calculate date range
    let daysBack = 7;
    if (period === '24h') daysBack = 1;
    else if (period === '7d') daysBack = 7;
    else if (period === '30d') daysBack = 30;
    else if (period === '90d') daysBack = 90;
    
    // Total stats for period
    const [[stats]] = await pool.execute(`
      SELECT 
        COUNT(*) as total_scans,
        SUM(CASE WHEN is_unique_user = TRUE THEN 1 ELSE 0 END) as unique_users,
        SUM(CASE WHEN is_repeat_scan = TRUE THEN 1 ELSE 0 END) as repeat_users,
        AVG(session_duration) as avg_session_duration
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [qr.id, daysBack]);
    
    // Daily breakdown
    const [dailyStats] = await pool.execute(`
      SELECT 
        DATE(scanned_at) as date,
        COUNT(*) as scans,
        SUM(CASE WHEN is_unique_user = TRUE THEN 1 ELSE 0 END) as unique_users
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(scanned_at)
      ORDER BY date ASC
    `, [qr.id, daysBack]);
    
    // Device breakdown
    const [deviceStats] = await pool.execute(`
      SELECT device_type, COUNT(*) as count
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY device_type
    `, [qr.id, daysBack]);
    
    // Browser breakdown
    const [browserStats] = await pool.execute(`
      SELECT browser_name, COUNT(*) as count
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY browser_name
      ORDER BY count DESC
      LIMIT 5
    `, [qr.id, daysBack]);
    
    // OS breakdown
    const [osStats] = await pool.execute(`
      SELECT os_name, COUNT(*) as count
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY os_name
      ORDER BY count DESC
      LIMIT 5
    `, [qr.id, daysBack]);
    
    // Geographic breakdown
    const [geoStats] = await pool.execute(`
      SELECT country, country_code, COUNT(*) as count
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY country, country_code
      ORDER BY count DESC
      LIMIT 10
    `, [qr.id, daysBack]);
    
    // City breakdown
    const [cityStats] = await pool.execute(`
      SELECT city, state, country, COUNT(*) as count
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY city, state, country
      ORDER BY count DESC
      LIMIT 10
    `, [qr.id, daysBack]);
    
    // Hourly breakdown (for heatmap)
    const [hourlyStats] = await pool.execute(`
      SELECT 
        DAYOFWEEK(scanned_at) as day_of_week,
        HOUR(scanned_at) as hour,
        COUNT(*) as count
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DAYOFWEEK(scanned_at), HOUR(scanned_at)
    `, [qr.id, daysBack]);
    
    // Recent scans
    const [recentScans] = await pool.execute(`
      SELECT scan_id, device_type, browser_name, os_name, country, city, scanned_at
      FROM qr_scans
      WHERE qr_id = ?
      ORDER BY scanned_at DESC
      LIMIT 20
    `, [qr.id]);
    
    // Active users now
    const [[activeNow]] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM qr_active_sessions
      WHERE qr_id = ? AND is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `, [qr.id]);
    
    res.json({
      success: true,
      data: {
        qr,
        stats,
        daily: dailyStats,
        devices: deviceStats,
        browsers: browserStats,
        operating_systems: osStats,
        geography: geoStats,
        cities: cityStats,
        hourly_heatmap: hourlyStats,
        recent_scans: recentScans,
        active_now: activeNow.count
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get real-time active users
router.get('/analytics/:qrId/realtime', async (req, res) => {
  try {
    const { qrId } = req.params;
    
    const [[qr]] = await pool.execute('SELECT id FROM qr_codes WHERE id = ? OR slug = ?', [qrId, qrId]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    const [activeSessions] = await pool.execute(`
      SELECT session_id, device_type, browser, os, country, city, latitude, longitude, started_at, last_activity
      FROM qr_active_sessions
      WHERE qr_id = ? AND is_active = TRUE AND last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      ORDER BY last_activity DESC
    `, [qr.id]);
    
    // Last hour stats
    const [hourlyTrend] = await pool.execute(`
      SELECT 
        DATE_FORMAT(scanned_at, '%H:%i') as time,
        COUNT(*) as scans
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY DATE_FORMAT(scanned_at, '%Y-%m-%d %H:%i')
      ORDER BY scanned_at ASC
    `, [qr.id]);
    
    res.json({
      success: true,
      data: {
        active_count: activeSessions.length,
        sessions: activeSessions,
        hourly_trend: hourlyTrend
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export analytics data
router.get('/analytics/:qrId/export', async (req, res) => {
  try {
    const { qrId } = req.params;
    const { format = 'json', period = '30d' } = req.query;
    
    const [[qr]] = await pool.execute('SELECT * FROM qr_codes WHERE id = ? OR slug = ?', [qrId, qrId]);
    if (!qr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }
    
    let daysBack = 30;
    if (period === '7d') daysBack = 7;
    else if (period === '90d') daysBack = 90;
    else if (period === 'all') daysBack = 3650;
    
    const [scans] = await pool.execute(`
      SELECT 
        scan_id, device_type, device_brand, device_model, os_name, os_version,
        browser_name, browser_version, country, country_code, state, city,
        scanned_at, session_duration, is_unique_user, is_repeat_scan
      FROM qr_scans
      WHERE qr_id = ? AND scanned_at > DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY scanned_at DESC
    `, [qr.id, daysBack]);
    
    if (format === 'csv') {
      const headers = Object.keys(scans[0] || {}).join(',');
      const rows = scans.map(row => Object.values(row).map(v => `"${v || ''}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=qr-analytics-${qr.slug}-${period}.csv`);
      res.send(`${headers}\n${rows}`);
    } else {
      res.json({ success: true, qr, period, total_records: scans.length, data: scans });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clean up old sessions
router.post('/maintenance/cleanup-sessions', async (req, res) => {
  try {
    // Mark inactive sessions
    await pool.execute(`
      UPDATE qr_active_sessions 
      SET is_active = FALSE 
      WHERE last_activity < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `);
    
    // Delete old sessions
    await pool.execute(`
      DELETE FROM qr_active_sessions 
      WHERE last_activity < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    // Clean up old rate limits
    await pool.execute(`
      DELETE FROM qr_rate_limits 
      WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, initializePool };
