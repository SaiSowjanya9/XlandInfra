const { test } = require('node:test');
const assert = require('node:assert/strict');
const { COMPANY, COMPANY_CONTACT_LINES, COMPANY_FOOTER_LINE } = require('./companyInfo');

test('the letterhead names the company the same way wherever it is drawn', async () => {
  const portal = await import('../../admin-portal/src/utils/companyInfo.js');
  assert.deepEqual(portal.COMPANY, COMPANY);
  assert.deepEqual(portal.COMPANY_CONTACT_LINES, COMPANY_CONTACT_LINES);
  assert.equal(portal.COMPANY_FOOTER_LINE, COMPANY_FOOTER_LINE);
});

test('every line the letterhead prints has something in it', () => {
  // A blank field would print as a gap in the address block rather than being skipped
  assert.equal(COMPANY.legalName, `${COMPANY.name} ${COMPANY.suffix}`);
  assert.ok(COMPANY.addressLines.length && COMPANY.addressLines.every(line => line.trim()));
  // Each line names an icon every surface knows how to draw; an unknown kind would print nothing
  // beside the value on the PDFs, which draw theirs from primitives rather than from a font
  const drawable = new Set(['phone', 'email', 'website']);
  for (const [kind, value] of COMPANY_CONTACT_LINES) {
    assert.ok(drawable.has(kind), kind);
    assert.ok(String(value).trim(), kind);
  }
});
