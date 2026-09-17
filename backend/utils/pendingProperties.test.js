const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

/**
 * Package names on the Pending Property Schedules feed.
 *
 * Estimates store the AMC package as package_id plus a package_name copy, and the
 * write paths default that copy to '' (`package_name || ''`). The feed must still
 * report the package for those rows, and must keep reporting nothing for estimates
 * that genuinely have no package, such as custom catalog estimates.
 */
test('pending properties resolve the package from package_id and stay honest for custom estimates', { skip: process.env.RUN_LOCAL_MYSQL_TESTS !== '1' }, async () => {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.LOCAL_DB_HOST));
  assert.equal(process.env.LOCAL_DB_NAME, 'customer_portal_local');
  const connection = await require('mysql2/promise').createConnection({
    host: process.env.LOCAL_DB_HOST, port: process.env.LOCAL_DB_PORT || 3306,
    user: process.env.LOCAL_DB_USER, password: process.env.LOCAL_DB_PASSWORD,
    database: process.env.LOCAL_DB_NAME
  });
  require.cache[require.resolve('../config/database')] = { exports: { pool: connection } };
  const { fetchPendingPropertiesForFp } = require('./pendingProperties');
  try {
    await connection.beginTransaction();
    const suffix = Date.now();
    const franchisePartner = async label => {
      const [row] = await connection.execute(
        `INSERT INTO franchise_partners (fp_code, company_name, username, email, password_hash) VALUES (?, ?, ?, ?, 'x')`,
        [`TEST-FP-${label}-${suffix}`, `${label} Test FP`, `test-fp-${label}-${suffix}`, `test-fp-${label}-${suffix}@example.test`]
      );
      return row.insertId;
    };
    const fp = { insertId: await franchisePartner('PACKAGE') };
    const [pkg] = await connection.execute(
      `INSERT INTO fp_amc_packages (franchise_partner_id, package_code, name, base_price, services)
       VALUES (?, ?, 'Gated Community Gold AMC', 25000, '[]')`,
      [fp.insertId, `TEST-PKG-${suffix}`]
    );
    const property = async label => {
      const [row] = await connection.execute(
        `INSERT INTO onboarded_properties (property_id, entry_type, category, zone, area_name, division, property_type, community_name, status, franchise_partner_id)
         VALUES (?, 'GC', 'residential', 'Zone A', 'Test Area', 'Test Division', 'Gated Community', ?, 'active', ?)`,
        [`TEST-${label}-${suffix}`, `Package Test ${label}`, fp.insertId]
      );
      return row.insertId;
    };
    const estimate = async (propertyId, packageId, packageName, estimateType) => {
      await connection.execute(
        `INSERT INTO fp_estimates (estimate_id, franchise_partner_id, property_id, estimate_type, status, payment_status,
           package_id, package_name, package_services, total_amount, client_name)
         VALUES (?, ?, ?, ?, 'approved', 'paid', ?, ?, '[]', 25000, 'Package Test Customer')`,
        [`TEST-EST-${propertyId}-${suffix}`, fp.insertId, propertyId, estimateType, packageId, packageName]
      );
    };

    // Work order estimates never carry a package. Databases that predate
    // schema_v33 reject that value, so fall back to another package-less type.
    const [[{ COLUMN_TYPE: estimateTypeColumn }]] = await connection.execute(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fp_estimates' AND COLUMN_NAME = 'estimate_type'"
    );
    const packagelessType = /^enum/i.test(estimateTypeColumn) && !estimateTypeColumn.includes("'work_order'")
      ? 'direct'
      : 'work_order';

    const linkedId = await property('LINKED');
    const namedId = await property('NAMED');
    const noPackageId = await property('NOPACKAGE');
    // Package chosen in the UI, but only the id was stored
    await estimate(linkedId, pkg.insertId, '', 'property_based');
    // Older row that kept its own copy of the name
    await estimate(namedId, null, 'Legacy Stored Name AMC', 'property_based');
    // Estimate that genuinely has no AMC package, such as a work order estimate
    await estimate(noPackageId, null, '', packagelessType);

    const rows = await fetchPendingPropertiesForFp(fp.insertId);
    const byId = Object.fromEntries(rows.map(row => [row.id, row]));
    assert.equal(rows.length, 3);
    assert.equal(byId[linkedId].packageName, 'Gated Community Gold AMC');
    assert.equal(byId[namedId].packageName, 'Legacy Stored Name AMC');
    assert.equal(byId[noPackageId].packageName, null);
    // The UI labels the Package column from the estimate type, so it must survive the round trip
    assert.equal(byId[linkedId].estimateType, 'property_based');
    assert.equal(byId[noPackageId].estimateType, packagelessType);

    // A package belonging to another FP must never be borrowed to fill the column
    const otherFpId = await franchisePartner('OTHER');
    await connection.execute('UPDATE fp_estimates SET franchise_partner_id = ? WHERE property_id = ?', [otherFpId, linkedId]);
    await connection.execute('UPDATE onboarded_properties SET franchise_partner_id = ? WHERE id = ?', [otherFpId, linkedId]);
    const [borrowed] = await fetchPendingPropertiesForFp(otherFpId);
    assert.equal(borrowed.packageName, null);
  } finally {
    await connection.rollback();
    await connection.end();
  }
});
