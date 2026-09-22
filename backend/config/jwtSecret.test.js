const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveJwtSecret, MINIMUM_SECRET_LENGTH } = require('./jwtSecret');

const strong = 'a'.repeat(MINIMUM_SECRET_LENGTH);
const weak = 'a'.repeat(MINIMUM_SECRET_LENGTH - 1);

test('production accepts a long secret unchanged and without warnings', () => {
  const resolved = resolveJwtSecret({ secret: strong, isProduction: true });
  assert.deepEqual(resolved, { secret: strong, warnings: [] });
});

test('production refuses to resolve a missing or short secret', () => {
  for (const secret of [undefined, null, '', '   ']) {
    assert.throws(() => resolveJwtSecret({ secret, isProduction: true }), /JWT_SECRET is not set/);
  }
  assert.throws(() => resolveJwtSecret({ secret: weak, isProduction: true }),
    new RegExp(`JWT_SECRET is ${weak.length} characters; production requires at least ${MINIMUM_SECRET_LENGTH}`));
  assert.throws(() => resolveJwtSecret({ secret: weak, isProduction: true }), /randomBytes\(64\)/);
});

test('development generates a per-process secret when none is set', () => {
  const generated = [];
  const generate = () => {
    generated.push(`generated-${generated.length}`);
    return generated.at(-1);
  };
  const first = resolveJwtSecret({ secret: undefined, isProduction: false, generate });
  const second = resolveJwtSecret({ secret: undefined, isProduction: false, generate });
  assert.notEqual(first.secret, second.secret);
  assert.equal(first.warnings.length, 2);
  assert.match(first.warnings[1], /invalidated on server restart/);
  const real = resolveJwtSecret({ secret: undefined, isProduction: false });
  assert.match(real.secret, /^[0-9a-f]{128}$/);
});

test('development keeps a short secret but warns that production rejects it', () => {
  const resolved = resolveJwtSecret({ secret: weak, isProduction: false });
  assert.equal(resolved.secret, weak);
  assert.equal(resolved.warnings.length, 1);
  assert.match(resolved.warnings[0], new RegExp(`Production refuses to start below ${MINIMUM_SECRET_LENGTH}`));
  assert.deepEqual(resolveJwtSecret({ secret: strong, isProduction: false }).warnings, []);
});

test('auth middleware resolves the signing key here and nowhere else', () => {
  const source = fs.readFileSync(path.join(__dirname, '../middleware/auth.js'), 'utf8');
  assert.match(source, /require\('\.\.\/config\/jwtSecret'\)/);
  assert.match(source, /process\.exit\(1\)/);
  assert.doesNotMatch(source, /JWT_SECRET\.length|randomBytes/);
  assert.equal(source.match(/jwt\.sign\(/g).length, 1);
});
