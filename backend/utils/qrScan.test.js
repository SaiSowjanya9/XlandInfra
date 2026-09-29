const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  SCAN_COLUMNS,
  SCAN_INSERT_SQL,
  normalizeGeoLocation,
  referrerDomain,
  buildScanParams,
  resolvePeriod,
  scanWindow,
  fillScanSeries
} = require('./qrScan');

/**
 * The bug these tests exist for: a geo lookup that answers without `latitude`, `longitude` or
 * `timezone` used to put `undefined` into the scan INSERT, mysql2 threw
 * `Bind parameters must not contain undefined`, and the throw was caught and logged. The visitor was
 * redirected, nothing was recorded, and QR Management reported a scan count that could not grow.
 */

const geoWithoutCoordinates = { country: 'India', countryCode: 'IN', state: 'Telangana', city: 'Hyderabad' };

const scan = (overrides = {}) => buildScanParams({
  qrId: 1,
  scanId: 'scan_abc',
  visitorId: 'f'.repeat(32),
  sessionId: 'sess_abc',
  ip: '49.37.1.1',
  ipHash: 'a'.repeat(32),
  isUniqueUser: true,
  isRepeatScan: false,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  ua: { device: 'mobile', deviceBrand: 'Apple', deviceModel: 'iPhone', osName: 'iOS', osVersion: '17.0', browserName: 'Safari', browserVersion: '17' },
  geo: geoWithoutCoordinates,
  redirectUrl: 'https://www.xlandinfra.com',
  latencyMs: 42,
  ...overrides
});

test('the insert never binds undefined, whatever the geo service left out', () => {
  for (const geo of [geoWithoutCoordinates, {}, undefined, { country: 'India', timezone: { id: 'Asia/Kolkata' } }]) {
    const params = scan({ geo });
    const undefinedAt = params
      .map((value, index) => (value === undefined ? SCAN_COLUMNS[index] : null))
      .filter(Boolean);
    assert.deepEqual(undefinedAt, [], `undefined bound for ${undefinedAt.join(', ')}`);
  }
});

test('placeholders, columns and values are the same length', () => {
  assert.equal(SCAN_INSERT_SQL.split('?').length - 1, SCAN_COLUMNS.length);
  assert.equal(scan().length, SCAN_COLUMNS.length);
});

test('a missing geographic field is SQL NULL, not an empty string or NaN', () => {
  const params = scan({ geo: {} });
  const value = (column) => params[SCAN_COLUMNS.indexOf(column)];
  for (const column of ['country', 'country_code', 'state', 'city', 'latitude', 'longitude', 'timezone']) {
    assert.equal(value(column), null, `${column} should be null`);
  }
});

test('coordinates and timezone are carried through however the service named them', () => {
  const ipwho = normalizeGeoLocation({ country: 'India', country_code: 'IN', region: 'Telangana', city: 'Hyderabad', latitude: 17.38, longitude: 78.48, timezone: { id: 'Asia/Kolkata' } });
  assert.deepEqual(ipwho, { country: 'India', countryCode: 'IN', state: 'Telangana', city: 'Hyderabad', latitude: 17.38, longitude: 78.48, timezone: 'Asia/Kolkata' });

  const ipApi = normalizeGeoLocation({ country: 'India', countryCode: 'IN', regionName: 'Telangana', city: 'Hyderabad', lat: 17.38, lon: 78.48, timezone: 'Asia/Kolkata' });
  assert.deepEqual(ipApi, ipwho);

  // A service that answers with junk coordinates stores nothing rather than 0,0 in the Gulf of Guinea
  assert.equal(normalizeGeoLocation({ latitude: 'unknown' }).latitude, null);
});

test('values are clipped to their column width and the device type always has a value', () => {
  const params = scan({ userAgent: 'x'.repeat(900), ua: {} });
  assert.equal(params[SCAN_COLUMNS.indexOf('user_agent')].length, 500);
  assert.equal(params[SCAN_COLUMNS.indexOf('device_type')], 'unknown');
});

test('a referrer that will not parse is null rather than a thrown insert', () => {
  assert.equal(referrerDomain('https://www.google.com/search?q=xland'), 'www.google.com');
  assert.equal(referrerDomain('not a url'), null);
  assert.equal(referrerDomain(undefined), null);
});

// ============================================
// Trend buckets
// ============================================

test('an unknown period falls back to 7 days rather than returning nothing', () => {
  assert.equal(resolvePeriod('7d').key, '7d');
  assert.equal(resolvePeriod('all-time').key, '7d');
  assert.equal(resolvePeriod(undefined).key, '7d');
});

test('a period covers whole days, or whole hours for 24h', () => {
  const now = new Date(2026, 8, 29, 14, 37, 12); // 29 Sep 2026, 14:37 local
  const week = scanWindow('7d', now);
  assert.equal(week.buckets.length, 7);
  assert.equal(week.buckets[0].key, '2026-09-23');
  assert.equal(week.buckets[6].key, '2026-09-29');
  assert.equal(week.start.getHours(), 0, 'the first day starts at midnight, not 14:37');

  const day = scanWindow('24h', now);
  assert.equal(day.buckets.length, 24);
  assert.equal(day.buckets[0].key, '2026-09-28 15:00:00');
  assert.equal(day.buckets[23].key, '2026-09-29 14:00:00');

  assert.equal(scanWindow('30d', now).buckets.length, 30);
  assert.equal(scanWindow('90d', now).buckets.length, 90);
});

test('a bucket nothing was scanned in is a zero, not a gap', () => {
  const now = new Date(2026, 8, 29, 9, 0, 0);
  const window = scanWindow('7d', now);
  const series = fillScanSeries([
    { bucket: '2026-09-29', scans: 3, visitors: 2 },
    { bucket: '2026-09-25', scans: 1, visitors: 1 }
  ], window);

  assert.equal(series.length, 7);
  assert.deepEqual(series.map(d => d.scans), [0, 0, 1, 0, 0, 0, 3]);
  assert.deepEqual(series.map(d => d.bucket), [
    '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'
  ]);
  // The total the chart draws is the total the cards report
  assert.equal(series.reduce((sum, d) => sum + d.scans, 0), 4);
});

test('a Date from the driver buckets the same as the string SQL grouped by', () => {
  const now = new Date(2026, 8, 29, 9, 0, 0);
  const window = scanWindow('7d', now);
  const series = fillScanSeries([{ bucket: new Date(2026, 8, 27), scans: 5, visitors: 4 }], window);
  assert.equal(series.find(d => d.bucket === '2026-09-27').scans, 5);
});

test('a scan outside the window is dropped rather than folded into an edge bucket', () => {
  const now = new Date(2026, 8, 29, 9, 0, 0);
  const series = fillScanSeries([
    { bucket: '2026-09-01', scans: 99, visitors: 99 },
    { bucket: '2026-09-29', scans: 2, visitors: 2 }
  ], scanWindow('7d', now));
  assert.equal(series.reduce((sum, d) => sum + d.scans, 0), 2);
});
