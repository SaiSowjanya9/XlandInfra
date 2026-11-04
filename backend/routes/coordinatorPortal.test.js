/**
 * Coordinator portal writer/reader agreement tests.
 *
 * Every check is static: the mocked-DB problem these prevent is a writer and a
 * reader disagreeing on what identifies a row's owner. The failures they catch
 * each already emptied a live screen:
 *
 *  - POST /work-orders stored the email in `created_by` and no `coordinator_id`,
 *    while the list and all five access checks matched on the username -- so a
 *    coordinator's work order vanished on create and every action 403ed.
 *  - GET /vendors matched `franchise_partner_id = ?` with NULL for a standalone
 *    coordinator, so Vendor Details was permanently empty.
 *  - GET /estimates only ran for `franchisePartnerId`, so a standalone
 *    coordinator's estimate list was empty however many they saved.
 *  - POST /zones never set `fp_zones.coordinator_id`, so a standalone
 *    coordinator's zone never came back in the list.
 *  - The Add Service form posted into `coordinator_addons`, a table nothing
 *    created, so every save 500ed; and the two Delete buttons in the same
 *    screens pointed at routes that did not exist.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'coordinator.js'), 'utf8');
const db = fs.readFileSync(path.join(__dirname, '..', 'config', 'database.js'), 'utf8');

test('POST /work-orders records owner in the columns the readers match', () => {
  // The list queries and all five access checks key on `coordinator_id` and on
  // `getCreatorIdentifier(req)` (the username) -- the writer must store both.
  assert.match(src, /const createdBy = getCreatorIdentifier\(req\)/,
    'work-order creator must come from getCreatorIdentifier, not req.user.email');
  assert.match(src, /INSERT INTO work_orders[^;]*coordinator_id/,
    'work_orders INSERT must set coordinator_id');
});

test('work-order creator-name joins match the username the writer now stores', () => {
  const joins = src.match(/LEFT JOIN users u ON wo\.created_by = u\.email OR wo\.created_by = u\.username OR CAST\(wo\.created_by AS UNSIGNED\) = u\.id/g) || [];
  assert.ok(joins.length >= 3,
    `expected the username join on every work-order list query, found ${joins.length}`);
});

test('GET /vendors scopes a standalone coordinator by coordinator_id, not a null FP', () => {
  assert.match(src, /ov\.coordinator_id = \? OR ov\.created_by = \? OR ov\.created_by_id = \?/,
    'vendors list needs a standalone branch; franchise_partner_id = NULL matches nothing');
});

test('GET /estimates scopes a standalone coordinator by authorship', () => {
  assert.match(src, /created_by_id = \? AND e\.created_by_role = 'coordinator'|created_by_id = \? AND created_by_role = 'coordinator'/,
    'estimates list needs an authorship scope when there is no franchise partner');
});

test('estimate mutations use the same scope as the list', () => {
  assert.match(src, /const estimateScope = \(req\)/, 'estimateScope helper missing');
  const scopes = src.match(/\$\{scope\.clause\}/g) || [];
  assert.ok(scopes.length >= 5,
    `archive/restore/edit/status/send-email should all share estimateScope, found ${scopes.length}`);
});

test('POST /zones marks coordinator-created zones so the list returns them', () => {
  assert.match(src, /INSERT INTO fp_zones \(name, franchise_partner_id, coordinator_id/,
    'zones INSERT must set coordinator_id for standalone coordinators');
  assert.match(src, /SELECT id, name FROM fp_zones WHERE coordinator_id = \? AND is_active = 1/,
    'zones GET must read coordinator_id rows for standalone coordinators');
});

test('POST /addons and DELETE routes exist for AMC packages and add-ons', () => {
  assert.match(src, /router\.delete\('\/amc-packages\/:id'/, 'DELETE /amc-packages/:id missing');
  assert.match(src, /router\.delete\('\/addons\/:id'/, 'DELETE /addons/:id missing');
  assert.match(src, /INSERT INTO coordinator_addons[^;]*service_name/,
    'Add Service must persist service_name/property_type/frequency, not just name and price');
});

test('coordinator_addons is created and drift-repaired at boot', () => {
  assert.match(db, /CREATE TABLE IF NOT EXISTS coordinator_addons/,
    'boot schema must create coordinator_addons -- schema_v10 fails partway on MySQL 8');
  assert.match(db, /TABLE_NAME = 'coordinator_addons'/,
    'boot must column-check coordinator_addons like fp_addons');
});

test('clients rows carry the property code and a numeric creator', () => {
  assert.match(src, /require\('\.\.\/utils\/clientPropertyLink'\)/,
    'coordinator Add Customer must use clientPropertyLink like the manager portal');
  assert.match(src, /clientCreatedBy\(req\.user\)/,
    'clients.created_by is an int on users(id), not a username');
});
