-- ============================================
-- QR analytics: inspect, purge page visits, rebuild the roll-up
-- ============================================
-- Run this by hand, a step at a time, reading each report before running the step under it.
-- Steps 2 and 3 delete rows; nothing here is reversible, so take a dump first:
--
--   mysqldump -u USER -p xland_pm qr_scans qr_analytics_daily qr_analytics_hourly \
--     qr_active_sessions > qr-backup-$(date +%F).sql
--
-- Why there is anything to purge
-- -----------------------------
-- Two things were true at once until the QR accuracy fix:
--
--   * A real scan recorded nothing. /api/qr/r/:slug bound `undefined` for latitude, longitude and
--     timezone -- getGeoLocation() stopped returning those three keys in commit 70ef43a2 -- so
--     mysql2 threw on every insert and a `catch` swallowed it. The visitor was redirected and no
--     row was written.
--   * A page visit recorded a scan. POST /api/qr/track-visit wrote a qr_scans row for anyone who
--     opened the website, including staff on a desktop browsing the admin site.
--
-- So the rows on this table are page visits, not scans, which is what
-- cleanup_fake_qr_scans.sql was already written to remove ("only real QR scans will be tracked").
-- Step 1 shows you whether that is true of your database before anything is deleted.
-- ============================================

-- --------------------------------------------
-- Step 1: what is actually on the table
-- --------------------------------------------
-- A page visit was always written with redirect_latency_ms = 0, because /track-visit passed a
-- literal 0; a redirect scan records the time it really took, which includes a geo lookup and is
-- never 0. Desktop rows are page visits almost by definition: a printed QR is scanned with a phone.
SELECT
  COUNT(*)                                                     AS total_rows,
  COUNT(CASE WHEN redirect_latency_ms = 0 THEN 1 END)           AS looks_like_page_visit,
  COUNT(CASE WHEN redirect_latency_ms > 0 THEN 1 END)           AS looks_like_real_scan,
  COUNT(CASE WHEN device_type = 'desktop' THEN 1 END)           AS desktop_rows,
  COUNT(DISTINCT visitor_id)                                    AS distinct_visitors,
  MIN(scanned_at)                                               AS first_row,
  MAX(scanned_at)                                               AS last_row
FROM qr_scans;

-- The same split per QR code, so you can see which code the rows were attributed to
SELECT q.slug, q.label,
  COUNT(s.id)                                                   AS rows_total,
  COUNT(CASE WHEN s.redirect_latency_ms = 0 THEN 1 END)          AS page_visits,
  COUNT(CASE WHEN s.redirect_latency_ms > 0 THEN 1 END)          AS real_scans
FROM qr_codes q LEFT JOIN qr_scans s ON s.qr_id = q.id
GROUP BY q.id ORDER BY rows_total DESC;

-- --------------------------------------------
-- Step 2: delete the page visits
-- --------------------------------------------
-- If step 1 reported `looks_like_real_scan = 0`, every row is a page visit and this empties the
-- table, which is correct: no real scan was ever recorded. If it reported some, only the page
-- visits go and the real scans stay.
DELETE FROM qr_scans WHERE redirect_latency_ms = 0 OR redirect_latency_ms IS NULL;

-- --------------------------------------------
-- Step 3: clear what the code no longer maintains
-- --------------------------------------------
-- qr_analytics_hourly and qr_active_sessions are no longer written: nothing read them, and a
-- counter nothing reads is a number that quietly disagrees with the rows it was counted from.
-- "Scanned in the last 5 minutes" is now counted from qr_scans directly.
DELETE FROM qr_analytics_hourly;
DELETE FROM qr_active_sessions;
-- Rate-limit windows: stale rows, harmless to drop
DELETE FROM qr_rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- --------------------------------------------
-- Step 4: rebuild the daily roll-up from the scans that remain
-- --------------------------------------------
-- qr_analytics_daily is retention only -- no figure on screen is read from it -- so it is rebuilt
-- from qr_scans rather than trusted. After this the two agree exactly, which step 5 checks.
DELETE FROM qr_analytics_daily;

INSERT INTO qr_analytics_daily
  (qr_id, date, total_scans, unique_users, repeat_users, mobile_scans, tablet_scans, desktop_scans)
SELECT
  s.qr_id,
  DATE(s.scanned_at)                                            AS date,
  COUNT(*)                                                      AS total_scans,
  -- Visitors seen for the first time that day, counted from the rows rather than from the flag
  COUNT(DISTINCT CASE WHEN DATE(s.scanned_at) = DATE(f.first_scan) THEN s.visitor_id END) AS unique_users,
  COUNT(DISTINCT CASE WHEN DATE(s.scanned_at) > DATE(f.first_scan) THEN s.visitor_id END) AS repeat_users,
  COUNT(CASE WHEN s.device_type = 'mobile'  THEN 1 END)          AS mobile_scans,
  COUNT(CASE WHEN s.device_type = 'tablet'  THEN 1 END)          AS tablet_scans,
  COUNT(CASE WHEN s.device_type = 'desktop' THEN 1 END)          AS desktop_scans
FROM qr_scans s
LEFT JOIN (
  SELECT qr_id, visitor_id, MIN(scanned_at) AS first_scan
  FROM qr_scans GROUP BY qr_id, visitor_id
) f ON f.qr_id = s.qr_id AND f.visitor_id <=> s.visitor_id
GROUP BY s.qr_id, DATE(s.scanned_at);

-- --------------------------------------------
-- Step 5: verify
-- --------------------------------------------
-- Both columns must match, per QR code. They are the figures the dashboard shows and the rows they
-- were counted from; if they ever disagree, the roll-up is the one that is wrong.
SELECT q.slug,
  (SELECT COUNT(*) FROM qr_scans s WHERE s.qr_id = q.id)                   AS scans_on_table,
  COALESCE((SELECT SUM(d.total_scans) FROM qr_analytics_daily d WHERE d.qr_id = q.id), 0) AS scans_in_rollup
FROM qr_codes q ORDER BY q.slug;

-- ============================================
-- Done. From here a row in qr_scans is a scan of a printed QR code and nothing else, and every
-- figure in QR Management is counted from those rows.
-- ============================================
