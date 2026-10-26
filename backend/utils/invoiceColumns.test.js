const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * `invoices.paid_at` was written by two payment-completion paths and created by no schema file,
 * so both failed with "Unknown column 'paid_at' in 'field list'" on every deployment. The verify
 * route (every staff portal's Payments screen) left the payment paid and its invoice stale; the
 * Razorpay writer runs inside the payment's transaction, so there it rolled the payment back --
 * the customer paid and nothing was recorded.
 */

const backend = path.join(__dirname, '..');

const loadWithColumns = (columns, { allowAlter = true } = {}) => {
  const calls = [];
  const pool = {
    execute: async (sql) => {
      calls.push(sql.trim().split('\n')[0].trim());
      if (sql.includes('information_schema')) return [columns.map(name => ({ name }))];
      if (sql.includes('ALTER TABLE invoices')) {
        if (!allowAlter) throw new Error('ALTER command denied to user');
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  delete require.cache[require.resolve('../config/database')];
  delete require.cache[require.resolve('./invoiceColumns')];
  require.cache[require.resolve('../config/database')] = { exports: { pool } };
  const module = require('./invoiceColumns');
  module.resetInvoiceColumnsCache();
  return { ...module, calls };
};

const altered = calls => calls
  .filter(sql => sql.startsWith('ALTER TABLE invoices'))
  .map(sql => sql.split('ADD COLUMN ')[1].split(' ')[0]);

test('a table missing paid_at has it added, as the migration would', async () => {
  const { ensureInvoiceColumns, calls } = loadWithColumns(['id', 'invoice_id', 'status', 'archived', 'archived_at']);
  await ensureInvoiceColumns();
  assert.deepEqual(altered(calls), ['paid_at']);
});

test('a current table is left alone, and is asked about only once', async () => {
  const { ensureInvoiceColumns, calls } = loadWithColumns(['id', 'paid_at', 'archived', 'archived_at']);
  await ensureInvoiceColumns();
  await ensureInvoiceColumns();
  await ensureInvoiceColumns();
  assert.deepEqual(altered(calls), []);
  assert.equal(calls.filter(sql => sql.includes('information_schema')).length, 1);
});

test('the archive columns the archive route used to ALTER in per request are covered too', async () => {
  const { ensureInvoiceColumns, calls } = loadWithColumns(['id', 'invoice_id']);
  await ensureInvoiceColumns();
  assert.deepEqual(altered(calls), ['paid_at', 'archived', 'archived_at']);
});

test('a refused ALTER does not throw, so the payment is never lost to the audit column', async () => {
  const { ensureInvoiceColumns } = loadWithColumns(['id'], { allowAlter: false });
  await ensureInvoiceColumns();
});

test('an unreadable table is retried rather than cached as done', async () => {
  let asked = 0;
  const pool = {
    execute: async (sql) => {
      if (sql.includes('information_schema')) {
        asked += 1;
        throw new Error('connection lost');
      }
      return [{}];
    }
  };
  delete require.cache[require.resolve('../config/database')];
  delete require.cache[require.resolve('./invoiceColumns')];
  require.cache[require.resolve('../config/database')] = { exports: { pool } };
  const { ensureInvoiceColumns, resetInvoiceColumnsCache } = require('./invoiceColumns');
  resetInvoiceColumnsCache();
  await ensureInvoiceColumns();
  await ensureInvoiceColumns();
  assert.equal(asked, 2);
});

test('every column ensureInvoiceColumns adds is also declared in a migration', () => {
  const source = fs.readFileSync(path.join(__dirname, 'invoiceColumns.js'), 'utf8');
  const guarded = [...source.matchAll(/^\s{2}(\w+):\s*'/gm)].map(match => match[1]);
  assert.ok(guarded.includes('paid_at'), 'paid_at must stay guarded');

  const migrations = path.join(backend, 'database', 'migrations');
  const declared = fs.readdirSync(migrations)
    .filter(name => name.endsWith('.sql'))
    .map(name => fs.readFileSync(path.join(migrations, name), 'utf8'))
    .join('\n');
  for (const column of guarded) {
    assert.match(declared, new RegExp(`xland_add_column_if_missing\\('invoices',\\s*'${column}'`),
      `${column} is self-healed at runtime but no migration creates it`);
  }
});

test('the assignment is dropped where the column could not be created, not forced', async () => {
  const absent = loadWithColumns(['id', 'invoice_id'], { allowAlter: false });
  const dropped = await absent.paidAtAssignment('paid');
  assert.equal(dropped.sql, '');
  assert.deepEqual(dropped.params, []);

  const present = loadWithColumns(['id', 'paid_at']);
  const written = await present.paidAtAssignment('paid');
  assert.match(written.sql, /^paid_at = IF\(\?/);
  // Exactly one placeholder, so a caller splicing params in keeps the UPDATE's arity
  assert.equal((written.sql.match(/\?/g) || []).length, written.params.length);
  assert.deepEqual(written.params, ['paid']);
});

test('nothing hard-codes paid_at into an invoice UPDATE; writers go through paidAtAssignment', () => {
  const offenders = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'uploads', 'database'].includes(entry.name)) walk(file);
        continue;
      }
      if (!file.endsWith('.js') || file.endsWith('.test.js')) continue;
      // invoiceColumns.js is where the assignment is allowed to live
      if (file === path.join(__dirname, 'invoiceColumns.js')) continue;
      // The repair script clears paid_at when it reverts an inflated 'paid' -- something
      // paidAtAssignment deliberately never does -- and writes it only after its own
      // ensureInvoiceColumns() check
      if (file === path.join(backend, 'scripts', 'repair-invoice-paid-amounts.js')) continue;
      const text = fs.readFileSync(file, 'utf8');
      // A write, not a read: `paid_at =` only ever appears in an UPDATE's SET list
      if (/paid_at\s*=/.test(text)) offenders.push(path.relative(backend, file));
    }
  };
  walk(backend);
  assert.deepEqual(offenders, [],
    'use paidAtAssignment() from utils/invoiceColumns.js so the write survives a missing column');
});

test('both invoice settlement writers splice the assignment in', () => {
  for (const file of [path.join(backend, 'routes', 'payments.js'),
                      path.join(backend, 'services', 'razorpayPayment.js')]) {
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /paidAtAssignment\(/, `${path.basename(file)} must resolve the assignment`);
    assert.match(text, /\$\{paidAt\.sql\}/, `${path.basename(file)} must splice paidAt.sql`);
    assert.match(text, /\.\.\.paidAt\.params/, `${path.basename(file)} must splice paidAt.params`);
  }
});

test('the Razorpay writer resolves the assignment before it opens its transaction', () => {
  // DDL commits implicitly in MySQL, so running it inside the transaction would break atomicity
  const text = fs.readFileSync(path.join(backend, 'services', 'razorpayPayment.js'), 'utf8');
  assert.ok(text.indexOf('paidAtAssignment(') < text.indexOf('beginTransaction()'),
    'paidAtAssignment() must be awaited before beginTransaction()');
});

test('the customer portal tells Razorpay the invoice under the key the webhooks read', () => {
  const source = fs.readFileSync(path.join(backend, 'routes', 'customers.js'), 'utf8');
  // handlePaymentCaptured and resolveInvoiceIdForPayment both give up without this key
  assert.ok(!/invoice_db_id:\s*inv\./.test(source), 'notes must use internal_invoice_id, not invoice_db_id');
  assert.equal((source.match(/internal_invoice_id:/g) || []).length, 2,
    'both initiate-payment and create-order must carry internal_invoice_id');
});

test('no route writes the payment link columns schema_v18 never created', () => {
  const offenders = [];
  for (const name of ['customers.js', 'razorpay.js', 'payments.js']) {
    const text = fs.readFileSync(path.join(backend, 'routes', name), 'utf8');
    // razorpay_payment_link_id / razorpay_short_url are the real columns
    if (/\bpayment_link_(?:id|url)\s*=/.test(text)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], 'use razorpay_payment_link_id / razorpay_short_url');
});

test('paidAtAssignment is never the last assignment before WHERE', () => {
  // Its SQL ends in a comma, so it must be followed by another assignment. invoiceSettlement
  // spliced it last, and every payment verification failed with ER_PARSE_ERROR near 'WHERE id = ?'.
  const { paidAtAssignment } = loadWithColumns(['paid_at']);
  assert.ok(typeof paidAtAssignment === 'function');
  const offenders = [];
  for (const dir of ['routes', 'utils', 'services']) {
    for (const name of fs.readdirSync(path.join(backend, dir)).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))) {
      const lines = fs.readFileSync(path.join(backend, dir, name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/\$\{paidAt\w*\.sql\}/.test(line)) return;
        const next = lines.slice(i + 1).find(l => l.trim());
        if (!next || /^\s*WHERE\b/i.test(next)) offenders.push(`${dir}/${name}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(offenders, []);
});
