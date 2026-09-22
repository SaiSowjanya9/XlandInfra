/**
 * JWT secret resolution.
 *
 * Every portal token is signed with JWT_SECRET, so a secret short enough to brute-force lets an
 * attacker mint an admin token. Production therefore refuses to boot with a weak or missing secret
 * instead of warning and serving requests anyway. Development keeps working without one by
 * generating a per-process random secret, which also invalidates tokens on restart.
 */

const crypto = require('crypto');

const MINIMUM_SECRET_LENGTH = 64;
const GENERATE_COMMAND = 'node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"';

// The secret is returned exactly as configured: trimming or normalizing it would change the
// signing key and log every user out.
function resolveJwtSecret({ secret, isProduction, generate = () => crypto.randomBytes(64).toString('hex') }) {
  const configured = typeof secret === 'string' && secret.trim() ? secret : null;

  if (isProduction) {
    if (!configured) {
      throw new Error(`JWT_SECRET is not set. Set a random string of at least ${MINIMUM_SECRET_LENGTH} characters. Generate one with: ${GENERATE_COMMAND}`);
    }
    if (configured.length < MINIMUM_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET is ${configured.length} characters; production requires at least ${MINIMUM_SECRET_LENGTH}. Generate one with: ${GENERATE_COMMAND} (rotating it logs every user out).`);
    }
    return { secret: configured, warnings: [] };
  }

  if (!configured) {
    return {
      secret: generate(),
      warnings: [
        '⚠️  WARNING: No JWT_SECRET set. Generated random development secret.',
        '⚠️  Tokens will be invalidated on server restart.'
      ]
    };
  }
  if (configured.length < MINIMUM_SECRET_LENGTH) {
    return {
      secret: configured,
      warnings: [`⚠️  WARNING: JWT_SECRET is ${configured.length} characters. Production refuses to start below ${MINIMUM_SECRET_LENGTH}.`]
    };
  }
  return { secret: configured, warnings: [] };
}

module.exports = { resolveJwtSecret, MINIMUM_SECRET_LENGTH };
