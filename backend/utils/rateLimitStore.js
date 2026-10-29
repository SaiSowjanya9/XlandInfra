/**
 * MySQL-backed store for express-rate-limit.
 *
 * The default MemoryStore resets on restart and is per-process, so the login,
 * password-reset and payment limiters could be evaded by bouncing the process or
 * by spreading attempts across instances. This store keeps hit counts in the
 * rate_limit_hits table, so counts survive restarts and are shared across
 * instances using the MySQL the stack already runs — no Redis needed.
 *
 * It is attached only to the low-volume, brute-force-sensitive limiters; the
 * general API and upload limiters stay in memory (a DB write per request is not
 * worth it at dashboard-polling volume).
 *
 * If the database cannot be consulted the store fails open (allows the request):
 * rate limiting must never take the API down with it. For the login limiter this
 * is also harmless — no DB means no password verification, so logins fail anyway.
 */

const { pool } = require('../config/database');

const TABLE = 'rate_limit_hits';
let tableReady = false;
let ensuring = null;
let cleanupTimer = null;

const ensureTable = async () => {
  if (tableReady) return true;
  if (!pool) return false;
  if (!ensuring) {
    ensuring = pool.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        rate_key VARCHAR(191) PRIMARY KEY,
        hits INT NOT NULL DEFAULT 0,
        reset_at_ms BIGINT NOT NULL,
        INDEX idx_reset_at (reset_at_ms)
      ) ENGINE=InnoDB
    `).then(() => {
      tableReady = true;
      return true;
    }).catch((e) => {
      console.error('rate_limit_hits init failed:', e.message);
      return false;
    }).finally(() => { ensuring = null; });
  }
  return ensuring;
};

// One shared sweeper for all store instances; unref'd so it never holds the process open
const startCleanup = () => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    if (!tableReady || !pool) return;
    pool.execute(`DELETE FROM ${TABLE} WHERE reset_at_ms < ?`, [Date.now()]).catch(() => {});
  }, 15 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
};

class MySQLRateLimitStore {
  /**
   * @param {string} name - Limiter namespace; prefixes keys so two limiters
   *                        sharing this table never share a counter.
   */
  constructor(name = 'rl') {
    this.prefix = `${name}:`;
    this.windowMs = 15 * 60 * 1000; // overridden by init() with the limiter's own window
    startCleanup();
  }

  // express-rate-limit passes each limiter's options here when the middleware is built
  init(options) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }

  fallback() {
    return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
  }

  async increment(key) {
    if (!(await ensureTable())) return this.fallback();
    const now = Date.now();
    const resetAt = now + this.windowMs;
    const fullKey = this.prefix + key;
    try {
      await pool.execute(
        `INSERT INTO ${TABLE} (rate_key, hits, reset_at_ms)
         VALUES (?, 1, ?)
         ON DUPLICATE KEY UPDATE
           hits = IF(reset_at_ms <= ?, 1, hits + 1),
           reset_at_ms = IF(reset_at_ms <= ?, VALUES(reset_at_ms), reset_at_ms)`,
        [fullKey, resetAt, now, now]
      );
      const [rows] = await pool.execute(
        `SELECT hits, reset_at_ms FROM ${TABLE} WHERE rate_key = ?`, [fullKey]
      );
      const row = rows[0];
      return {
        totalHits: row ? row.hits : 1,
        resetTime: new Date(row ? Number(row.reset_at_ms) : resetAt)
      };
    } catch (e) {
      console.error('rate limit store increment failed:', e.message);
      return this.fallback();
    }
  }

  // Called by limiters configured with skipSuccessfulRequests / skipFailedRequests
  async decrement(key) {
    if (!tableReady || !pool) return;
    try {
      await pool.execute(
        `UPDATE ${TABLE} SET hits = GREATEST(hits - 1, 0) WHERE rate_key = ?`,
        [this.prefix + key]
      );
    } catch (_) { /* best-effort */ }
  }

  async resetKey(key) {
    if (!tableReady || !pool) return;
    try {
      await pool.execute(`DELETE FROM ${TABLE} WHERE rate_key = ?`, [this.prefix + key]);
    } catch (_) { /* best-effort */ }
  }
}

module.exports = { MySQLRateLimitStore };
