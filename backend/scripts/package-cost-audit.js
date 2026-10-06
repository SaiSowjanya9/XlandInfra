#!/usr/bin/env node
// Read-only audit: for every AMC package, which of its services carry a cost, which the server can
// cost from the catalog, and which cannot be costed at all -- the ones that show dashes in the
// estimate view's Vendor Cost, XLAND Cost, Customer Price and Margin % columns.
//
//   node scripts/package-cost-audit.js            every package
//   node scripts/package-cost-audit.js "Gold"     packages whose name contains "Gold"
//
// It changes nothing. Uses the same database settings as the server (DB_* in production,
// LOCAL_DB_* otherwise).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../config/database');
const { loadPackageSnapshot } = require('../utils/packageSnapshot');

const parse = value => { if (value && typeof value === 'object') return value; try { return JSON.parse(value); } catch { return null; } };
const money = value => `Rs ${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

(async () => {
  const filter = process.argv[2] ? `%${process.argv[2]}%` : '%';
  const [packages] = await pool.execute(
    'SELECT id, name, franchise_partner_id, base_price AS price, services FROM fp_amc_packages WHERE name LIKE ? ORDER BY name', [filter]);
  let uncostable = 0;
  for (const pkg of packages) {
    const stored = parse(pkg.services);
    const rows = (Array.isArray(stored?.serviceRows) ? stored.serviceRows : Array.isArray(stored) ? stored : []).filter(row => row && typeof row === 'object');
    const snapshot = await loadPackageSnapshot(pool, pkg.id, pkg.franchise_partner_id);
    console.log(`\n${pkg.name} (id ${pkg.id}, FP ${pkg.franchise_partner_id}) -- package price ${money(pkg.price || 0)}`);
    rows.forEach((row, index) => {
      const snap = snapshot?.services?.[index] || {};
      const savedCost = row.vendorCost !== '' && row.vendorCost != null;
      const savedPrice = row.price !== '' && row.price != null;
      const how = !row.catalogServiceId && !row.pricingMethod ? 'typed by hand' : row.catalogServiceId ? `catalog #${row.catalogServiceId}` : 'catalog (no link)';
      let state;
      if (snap.vendorCost == null) { state = 'CANNOT BE COSTED'; uncostable++; }
      else state = savedCost ? 'cost saved' : 'cost from catalog';
      console.log(`  ${String(index + 1).padStart(2)}. ${row.service || row.name}  [${how}]  price ${savedPrice ? money(row.price) : 'none'}  ` +
        `vendor ${snap.vendorCost == null ? '-' : money(snap.vendorCost)}  share ${snap.packageShare == null ? '-' : money(snap.packageShare)}  => ${state}`);
    });
  }
  console.log(`\n${packages.length} package(s); ${uncostable} service(s) cannot be costed.`);
  if (uncostable) console.log('Fix: open each package in AMC Packages > Edit, replace those rows with services from Add Service (or give a typed row its vendor price), and save.');
  await pool.end();
})().catch(error => { console.error(error); process.exit(1); });
