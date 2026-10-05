const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { generateWorkOrderId, isNumericWorkOrderId } = require('./workOrderId');

test('work order IDs are WO- followed by digits, and never repeat even within one millisecond', () => {
  const ids = Array.from({ length: 50 }, () => generateWorkOrderId(1783455968280));
  assert.ok(ids.every(isNumericWorkOrderId), ids.find(id => !isNumericWorkOrderId(id)));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(isNumericWorkOrderId('WO-MTWCEEFE-0P6H'), false);
  assert.equal(isNumericWorkOrderId('WO-1783455968280'), true);
});

test('no other code makes its own work order ID', () => {
  const offenders = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['node_modules', 'uploads', 'database'].includes(entry.name)) walk(file); continue; }
      if (!file.endsWith('.js') || file.endsWith('.test.js') || file.endsWith('workOrderId.js')) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/`WO-\$\{|generateId\('WO'\)|['"]WO-['"]\s*\+/.test(text)) offenders.push(path.relative(path.join(__dirname, '..'), file));
    }
  };
  walk(path.join(__dirname, '..'));
  assert.deepEqual(offenders, [], 'use generateWorkOrderId() from utils/workOrderId.js');
});
