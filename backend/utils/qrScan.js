/**
 * Writing and bucketing QR scans.
 *
 * A scan that is not written is a scan that never happened, and that is precisely what went wrong:
 * commit 70ef43a2 replaced a hardcoded `geoData` -- which carried `latitude`, `longitude` and
 * `timezone` as null -- with `getGeoLocation()`, which returns none of those three keys. The scan
 * INSERT still bound them, mysql2 threw `Bind parameters must not contain undefined`, and the throw
 * landed in a `catch` that only logged. Every real scan through /api/qr/r/:slug redirected the
 * visitor correctly and recorded nothing, so QR Management reported the scans it happened to have
 * from page-visit tracking and nothing else.
 *
 * So the row is built here, from one column list, and `qrScan.test.js` asserts that no value is ever
 * undefined and that the placeholders, columns and values stay the same length. A missing geo field
 * becomes SQL NULL, which is what the column means.
 */

// Columns written for every scan, in order. `scanned_at` is left to its DEFAULT CURRENT_TIMESTAMP.
const SCAN_COLUMNS = [
  'qr_id', 'scan_id', 'visitor_id', 'session_id', 'ip_address', 'ip_hash',
  'is_unique_user', 'is_repeat_scan', 'user_agent', 'device_type', 'device_brand', 'device_model',
  'os_name', 'os_version', 'browser_name', 'browser_version',
  'country', 'country_code', 'state', 'city', 'latitude', 'longitude', 'timezone',
  'referrer_url', 'referrer_domain', 'language', 'redirect_url', 'redirect_success', 'redirect_latency_ms'
];

const SCAN_INSERT_SQL =
  `INSERT INTO qr_scans (${SCAN_COLUMNS.join(', ')}) ` +
  `VALUES (${SCAN_COLUMNS.map(() => '?').join(', ')})`;

// SQL NULL for anything absent: a bound `undefined` is a thrown insert, an empty string is a lie
const orNull = (value) => (value === undefined || value === '' ? null : value);
// A number that is not a number is null rather than NaN, which MySQL would store as 0
const numberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
// VARCHAR columns truncate silently in a non-strict session; cut to the declared width ourselves
const clip = (value, length) => (typeof value === 'string' && value.length > length ? value.slice(0, length) : orNull(value));

/**
 * Every geographic key the scan row needs, whichever lookup service answered.
 * The services disagree on names (`region` vs `regionName`, `timezone` as a string or as `{ id }`),
 * and any of them may answer with nothing at all.
 */
const normalizeGeoLocation = (geo = {}) => ({
  country: clip(geo.country, 100),
  countryCode: clip(geo.countryCode || geo.country_code, 3),
  state: clip(geo.state || geo.region || geo.regionName, 100),
  city: clip(geo.city, 100),
  latitude: numberOrNull(geo.latitude ?? geo.lat),
  longitude: numberOrNull(geo.longitude ?? geo.lon ?? geo.lng),
  timezone: clip(typeof geo.timezone === 'object' && geo.timezone ? geo.timezone.id : geo.timezone, 50)
});

/** The referring host, or null: a referrer that will not parse is not worth a 500. */
const referrerDomain = (referrer) => {
  if (!referrer) return null;
  try {
    return clip(new URL(referrer).hostname, 255);
  } catch {
    return null;
  }
};

/**
 * Values for SCAN_INSERT_SQL, in SCAN_COLUMNS order.
 * `isUniqueUser` / `isRepeatScan` describe this row at the moment it was written; every figure the
 * dashboard shows is counted from visitor_id instead, so a wrong flag cannot move a total.
 */
const buildScanParams = ({
  qrId, scanId, visitorId, sessionId, ip, ipHash,
  isUniqueUser, isRepeatScan, userAgent, ua = {}, geo = {},
  referrer, language, redirectUrl, redirectSuccess = true, latencyMs
}) => {
  const location = normalizeGeoLocation(geo);
  return [
    qrId, scanId, clip(visitorId, 64), clip(sessionId, 64), clip(ip, 45), clip(ipHash, 64),
    isUniqueUser ? 1 : 0, isRepeatScan ? 1 : 0, clip(userAgent, 500),
    ua.device || 'unknown', clip(ua.deviceBrand, 100), clip(ua.deviceModel, 100),
    clip(ua.osName, 50), clip(ua.osVersion, 50), clip(ua.browserName, 50), clip(ua.browserVersion, 50),
    location.country, location.countryCode, location.state, location.city,
    location.latitude, location.longitude, location.timezone,
    clip(referrer, 2048), referrerDomain(referrer), clip(language, 10),
    clip(redirectUrl, 2048), redirectSuccess ? 1 : 0, numberOrNull(latencyMs) ?? 0
  ];
};

// ============================================
// What the scan was made with
// ============================================

/**
 * Device, OS and browser from a user agent.
 *
 * Order is the whole difficulty. An iPhone says "iPhone; CPU iPhone OS 17_0 like Mac OS X", so a
 * `/mac os x/` test placed above the iOS one claims every iPhone scan for macOS -- which is what the
 * OS panel used to report, while the device panel correctly called the same scan mobile. The checks
 * below go from the most specific to the least, and a UA that says nothing useful stays 'unknown'
 * rather than being assigned a plausible default.
 */
const parseUserAgent = (ua) => {
  const unknown = { device: 'unknown', deviceBrand: null, deviceModel: null, osName: null, osVersion: null, browserName: null, browserVersion: null };
  if (!ua) return unknown;

  const first = (pattern, transform = value => value) => {
    const match = ua.match(pattern);
    return match ? transform(match[1]) : null;
  };

  // --- Device ---
  let device = 'unknown';
  let deviceBrand = null;
  let deviceModel = null;

  if (/iphone|ipod/i.test(ua)) {
    device = 'mobile'; deviceBrand = 'Apple'; deviceModel = /ipod/i.test(ua) ? 'iPod' : 'iPhone';
  } else if (/ipad/i.test(ua)) {
    device = 'tablet'; deviceBrand = 'Apple'; deviceModel = 'iPad';
  } else if (/android/i.test(ua)) {
    // Android's UA says "Mobile" for a phone and omits it for a tablet
    device = /mobile/i.test(ua) ? 'mobile' : 'tablet';
    deviceBrand = 'Android';
    deviceModel = first(/android[^;)]*;\s*([^;)]+)/i, value => value.trim()) || 'Android Device';
  } else if (/windows phone/i.test(ua)) {
    device = 'mobile'; deviceBrand = 'Microsoft'; deviceModel = 'Windows Phone';
  } else if (/macintosh|mac os x/i.test(ua)) {
    // An iPad on iOS 13+ asks for desktop sites and sends this exact string, so some iPad scans are
    // counted as Mac. Nothing in the UA distinguishes them; it is not guessed at here.
    device = 'desktop'; deviceBrand = 'Apple'; deviceModel = 'Mac';
  } else if (/windows nt/i.test(ua)) {
    device = 'desktop'; deviceBrand = 'Microsoft'; deviceModel = 'PC';
  } else if (/cros/i.test(ua)) {
    device = 'desktop'; deviceBrand = 'Google'; deviceModel = 'Chromebook';
  } else if (/linux|x11/i.test(ua)) {
    device = 'desktop'; deviceBrand = 'Linux'; deviceModel = 'PC';
  }

  // --- OS: iOS and Android before the desktops, since both name another OS in passing ---
  let osName = null;
  let osVersion = null;

  if (/iphone os|ipad;|cpu os/i.test(ua)) {
    osName = 'iOS';
    osVersion = first(/os (\d+[._]\d+)/i, value => value.replace(/_/g, '.'));
  } else if (/android/i.test(ua)) {
    osName = 'Android';
    osVersion = first(/android (\d+(?:\.\d+)?)/i);
  } else if (/windows nt/i.test(ua)) {
    osName = 'Windows';
    // Windows 11 reports itself as "Windows NT 10.0" and there is no way to tell the two apart from
    // the UA. The old code had a `windows nt 11` branch that can never match, below one that labels
    // every Windows 11 machine "10"; the version is simply left unsaid.
    osVersion = first(/windows nt (\d+\.\d+)/i, value => (value === '10.0' ? null : value));
  } else if (/mac os x/i.test(ua)) {
    osName = 'macOS';
    osVersion = first(/mac os x (\d+[._]\d+)/i, value => value.replace(/_/g, '.'));
  } else if (/cros/i.test(ua)) {
    osName = 'ChromeOS';
  } else if (/linux|x11/i.test(ua)) {
    osName = 'Linux';
  }

  // --- Browser: every Chromium browser also says "Chrome", and every one of them says "Safari" ---
  let browserName = null;
  let browserVersion = null;

  if (/edg(?:e|a|ios)?\//i.test(ua)) {
    browserName = 'Edge'; browserVersion = first(/edg(?:e|a|ios)?\/(\d+)/i);
  } else if (/opr\/|opera/i.test(ua)) {
    browserName = 'Opera'; browserVersion = first(/(?:opr|opera)\/(\d+)/i);
  } else if (/samsungbrowser\//i.test(ua)) {
    // The default browser on a Samsung phone, which is a lot of phones in India
    browserName = 'Samsung Internet'; browserVersion = first(/samsungbrowser\/(\d+)/i);
  } else if (/firefox\/|fxios\//i.test(ua)) {
    browserName = 'Firefox'; browserVersion = first(/(?:firefox|fxios)\/(\d+)/i);
  } else if (/crios\//i.test(ua)) {
    // Chrome on iOS, which is Safari's engine wearing Chrome's name
    browserName = 'Chrome'; browserVersion = first(/crios\/(\d+)/i);
  } else if (/chromium\//i.test(ua)) {
    browserName = 'Chromium'; browserVersion = first(/chromium\/(\d+)/i);
  } else if (/chrome\//i.test(ua)) {
    browserName = 'Chrome'; browserVersion = first(/chrome\/(\d+)/i);
  } else if (/safari\//i.test(ua)) {
    browserName = 'Safari'; browserVersion = first(/version\/(\d+)/i);
  }

  return { device, deviceBrand, deviceModel, osName, osVersion, browserName, browserVersion };
};

/**
 * Bot detection. A scan wrongly called a bot is silently discarded, so the patterns name what they
 * mean: `/snap/i` matched Snapchat's in-app browser and threw away real scans, and `/preview/i`,
 * `/thumb/i` and `/embed/i` matched nothing a person browses with.
 */
const BOT_PATTERNS = [
  // Search engine bots
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /sogou/i, /exabot/i, /facebot/i, /ia_archiver/i,
  // Social media crawlers, including the ones that fetch a link to draw its preview card
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i, /pinterest/i,
  /whatsapp/i, /telegrambot/i, /slackbot/i, /discordbot/i, /skypeuripreview/i,
  // Generic bot patterns
  /bot\b/i, /crawl/i, /spider/i, /scrape/i,
  // Tools and libraries
  /curl/i, /wget/i, /python/i, /java\//i, /httpclient/i, /libwww/i, /okhttp/i, /go-http-client/i,
  /headless/i, /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
  /snapshot/i, /thumbnail/i, /link-?preview/i,
  // Monitoring and uptime
  /pingdom/i, /uptimerobot/i, /statuscake/i, /newrelic/i, /datadog/i,
  // Other
  /mediapartners/i, /adsbot/i, /apis-google/i, /feedfetcher/i
];

const isBot = (ua) => {
  if (!ua) return true;
  if (BOT_PATTERNS.some(pattern => pattern.test(ua))) return true;
  // A UA carrying a URL is a crawler naming its operator; one this short is not a browser
  if (/https?:\/\//i.test(ua)) return true;
  if (ua.length < 20) return true;
  return false;
};

// ============================================
// Trend buckets
// ============================================

/**
 * The window a period covers, and how the trend is bucketed inside it.
 *
 * `24h` is bucketed by hour -- a single bar labelled "today" is not a trend -- and everything longer
 * by calendar day, so "7d" means seven days including today rather than a rolling 168 hours whose
 * first and last bucket are both partial.
 */
const PERIODS = {
  '24h': { granularity: 'hour', hours: 24 },
  '7d': { granularity: 'day', days: 7 },
  '30d': { granularity: 'day', days: 30 },
  '90d': { granularity: 'day', days: 90 }
};

const DEFAULT_PERIOD = '7d';

const pad = (n) => String(n).padStart(2, '0');
// Local time, to match MySQL's DATE()/DATE_FORMAT() on the same host
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const hourKey = (date) => `${dayKey(date)} ${pad(date.getHours())}:00:00`;

const resolvePeriod = (period) => {
  const key = Object.prototype.hasOwnProperty.call(PERIODS, period) ? period : DEFAULT_PERIOD;
  return { key, ...PERIODS[key] };
};

/**
 * `{ key, granularity, start, end, buckets }` for a period, where `buckets` is every hour or day the
 * window contains -- including the ones nothing was scanned in. A trend that omits its empty buckets
 * draws two scans a fortnight apart as neighbours.
 */
const scanWindow = (period, now = new Date()) => {
  const { key, granularity, hours, days } = resolvePeriod(period);
  const buckets = [];
  let start;

  if (granularity === 'hour') {
    start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - (hours - 1));
    for (let i = 0; i < hours; i += 1) {
      const at = new Date(start);
      at.setHours(start.getHours() + i);
      buckets.push({ key: hourKey(at), at });
    }
  } else {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    for (let i = 0; i < days; i += 1) {
      const at = new Date(start);
      at.setDate(start.getDate() + i);
      buckets.push({ key: dayKey(at), at });
    }
  }

  return { key, granularity, start, end: now, buckets };
};

/**
 * The trend as one entry per bucket: `{ bucket, scans, visitors }`.
 * Rows are whatever SQL grouped, keyed by the same hour/day string; anything outside the window is
 * dropped rather than folded into an edge bucket.
 */
const fillScanSeries = (rows, window) => {
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.bucket instanceof Date
      ? (window.granularity === 'hour' ? hourKey(row.bucket) : dayKey(row.bucket))
      : String(row.bucket);
    byKey.set(key, row);
  }
  return window.buckets.map(({ key, at }) => {
    const row = byKey.get(key);
    return {
      bucket: key,
      at: at.toISOString(),
      scans: Number(row?.scans) || 0,
      visitors: Number(row?.visitors) || 0
    };
  });
};

module.exports = {
  SCAN_COLUMNS,
  SCAN_INSERT_SQL,
  normalizeGeoLocation,
  referrerDomain,
  buildScanParams,
  parseUserAgent,
  isBot,
  PERIODS,
  DEFAULT_PERIOD,
  resolvePeriod,
  scanWindow,
  fillScanSeries
};
