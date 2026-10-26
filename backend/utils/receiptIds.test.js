const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Every confirmed payment carries an RCP- receipt number, whatever its method. Only the Razorpay
 * writer and POST /payments used to draw one, so cash, cheque and bank payments never had one.
 */

const loadWithPayments = ({ missing, failSelect = false }) => {
  const calls = [];
  let sequence = 41;
  const pool = {
    execute: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM payments') && sql.includes('receipt_id IS NULL')) {
        if (failSelect) throw new Error("Unknown column 'receipt_id'");
        return [missing];
      }
      if (sql.includes('MAX(current_number)')) return [[{ max_number: sequence }]];
      if (sql.includes('UPDATE receipt_sequence')) { sequence = params[0]; return [{}]; }
      if (sql.includes('UPDATE payments SET receipt_id')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  delete require.cache[require.resolve('../config/database')];
  delete require.cache[require.resolve('./paymentIds')];
  require.cache[require.resolve('../config/database')] = { exports: { pool } };
  return { ...require('./paymentIds'), pool, calls };
};

test('each confirmed payment without one gets the next RCP- number, oldest first', async () => {
  const { assignMissingReceiptIds, pool, calls } = loadWithPayments({
    missing: [{ id: 7, franchise_partner_id: 3 }, { id: 9, franchise_partner_id: 3 }]
  });
  assert.equal(await assignMissingReceiptIds(55, pool), 2);
  const select = calls.find(c => c.sql.includes('receipt_id IS NULL'));
  assert.match(select.sql, /status IN \('paid', 'completed'\)/);
  assert.match(select.sql, /ORDER BY payment_date, id/);
  const updates = calls.filter(c => c.sql.includes('UPDATE payments SET receipt_id'));
  assert.deepEqual(updates.map(c => c.params), [['RCP-00042', 7], ['RCP-00043', 9]]);
  // Never overwrites a number a concurrent writer already set
  assert.match(updates[0].sql, /receipt_id IS NULL OR receipt_id = ''/);
});

test('a receipt-number failure never blocks the settlement it runs inside', async () => {
  const { assignMissingReceiptIds, pool } = loadWithPayments({ missing: [], failSelect: true });
  assert.equal(await assignMissingReceiptIds(55, pool), 0);
});

test('resyncInvoiceSettlement numbers the payments it settles, on the caller\'s transaction', () => {
  const source = fs.readFileSync(path.join(__dirname, 'invoiceSettlement.js'), 'utf8');
  assert.match(source, /await assignMissingReceiptIds\(invoiceId, conn\)/);
});

test('receipts show the RCP- number beside the PAY- id', () => {
  const pdf = fs.readFileSync(path.join(__dirname, '..', 'services', 'pdfService.js'), 'utf8');
  assert.match(pdf, /\['RECEIPT NO\.', receiptId \|\| paymentId/);
  assert.match(pdf, /\['Payment ID', paymentId\]/);
  const email = fs.readFileSync(path.join(__dirname, '..', 'services', 'receiptEmail.js'), 'utf8');
  assert.match(email, /paymentData\.receiptId \|\| paymentData\.paymentId/);
});
