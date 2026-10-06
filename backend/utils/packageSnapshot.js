// The services of the AMC package an estimate is written on, copied from the package itself.
//
// Each portal's form used to send this list, and only the FP form did: an estimate made on a
// package from the Manager, Coordinator, Supervisor or Executive portal saved no package services,
// so its view, PDF and email named the package and nothing it covers. The FP's copy also left out
// what each service costs, which is why the profit summary counted a package estimate's price but
// none of its cost. The server now reads the list from the package, so every portal saves the same
// thing and the client cannot misstate it.
//
// Each service keeps its name, description, category and schedule, plus `vendorCost` for the
// internal figures. A per-service price is deliberately not stored: the customer buys the package
// at one price, and customerEstimateData never projects vendorCost onto a customer document.
const parse = value => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

// How the service is priced and what was entered for it -- the method, the amount (a capacity, an
// area, a headcount), its unit and, for a capacity slab, the slab bands -- so the estimate's view
// states Method and Input / Details for a package's services as it does for an added one. These
// were dropped, which left both columns blank for every package service. A slab keeps its name and
// range only: its rate is the vendor's price, and the estimate carries no per-service price.
const slabBands = slabs => (Array.isArray(slabs) ? slabs : [])
  .filter(slab => slab && slab.capacityFrom != null)
  .map(slab => ({ name: slab.name || '', capacityFrom: slab.capacityFrom, capacityTo: slab.capacityTo ?? null }));

// A package row is priced at the vendor's figure until a markup or a typed price changes it, so a row
// saved without a vendor cost, and whose price was not typed over, cost what it was priced at.
const rowVendorCost = row => {
  if (row?.vendorCost !== '' && row?.vendorCost != null && Number.isFinite(Number(row.vendorCost))) return Number(row.vendorCost);
  const price = Number(row?.price);
  return !row?.priceOverridden && Number.isFinite(price) && price >= 0 && row?.price !== '' && row?.price != null ? price : NaN;
};

// Each service's share of the package price, for the internal XLAND Cost and Margin % columns: the
// row's price with the package markup (a typed-over price is not marked up), scaled so the shares
// add up to exactly what the package sells for. Internal only -- no customer document projects it,
// and the customer still buys the package at its one price.
const packageShares = (rows, markup, packagePrice) => {
  const factor = 1 + (Number(markup) || 0) / 100;
  const priced = rows.map(row => {
    const price = Number(row?.price);
    if (!Number.isFinite(price) || price < 0 || row?.price === '' || row?.price == null) return null;
    return row?.priceOverridden ? price : price * factor;
  });
  const sum = priced.reduce((total, value) => total + (value || 0), 0);
  const target = Number(packagePrice);
  const scale = sum > 0 && Number.isFinite(target) && target > 0 ? target / sum : 1;
  return priced.map(value => (value == null ? null : Math.round(value * scale * 100) / 100));
};

const packageServiceSnapshot = (row, share = null) => {
  const vendorCost = rowVendorCost(row);
  const operatingCost = Number(row?.operatingCost);
  const slabs = slabBands(row?.capacitySlabs || row?.capacity_slabs);
  const method = row?.pricingMethod || row?.pricing_method || '';
  const input = row?.inputValue ?? row?.input_value;
  return {
    name: row?.service || row?.name || 'Service',
    description: row?.description || '',
    ...(row?.category ? { category: row.category } : {}),
    frequencyType: row?.frequencyType || row?.frequency_type || 'Monthly',
    frequencyCount: Number(row?.frequencyCount ?? row?.frequency_count ?? 0) || 0,
    ...(method ? { pricingMethod: method } : {}),
    ...(input !== undefined && input !== null && input !== '' ? { inputValue: input } : {}),
    ...(row?.unit ? { unit: row.unit } : {}),
    ...(slabs.length ? { capacitySlabs: slabs } : {}),
    ...(row?.catalogServiceId ? { catalogServiceId: row.catalogServiceId } : {}),
    ...(Number.isFinite(vendorCost) && vendorCost >= 0 ? { vendorCost } : {}),
    ...(Number.isFinite(operatingCost) && operatingCost > 0 ? { operatingCost } : {}),
    ...(share != null ? { packageShare: share } : {})
  };
};

// A configured service saved on the package with no price -- its quote never landed, as happened
// to rows added before they were priced on adding -- still costs the vendor what the catalog says.
// Its cost is read from the service's own configuration with the row's amount and schedule, so the
// estimate states it. The package price does not include it, so its share is 0: the view then
// shows what the package loses on it, rather than a dash that hides it.
const INPUT_KEY = { quantity_based: 'quantity', area_based: 'area', capacity_based: 'capacity', capacity_slab: 'capacity', manpower: 'personnel' };
const hasNumber = value => value !== '' && value != null && Number.isFinite(Number(value));
// The catalog service behind a row: by its id, or -- for a row saved without the link -- by name
// among the services this FP can use (its own and the shared ones).
const findCatalogService = async (db, row, fpId) => {
  if (row.catalogServiceId) {
    const [[byId]] = await db.execute('SELECT * FROM service_catalog WHERE id = ?', [row.catalogServiceId]);
    if (byId) return byId;
  }
  const name = String(row.service || row.name || '').trim();
  if (!name) return null;
  const [candidates] = await db.execute('SELECT * FROM service_catalog WHERE scope_id IN (0, ?)', [Number(fpId) || 0]);
  const { decodeEntities } = require('./htmlEntities');
  const { parseService } = require('../routes/serviceCatalog');
  const key = decodeEntities(name).toLowerCase();
  return (candidates || []).find(candidate => {
    try { return decodeEntities(String(parseService(candidate).service_name || '')).trim().toLowerCase() === key; } catch { return false; }
  }) || null;
};

// Priced from the service's configuration with the row's amount and schedule. Where the row's own
// figures are refused -- a schedule the service no longer allows, an amount outside today's slabs --
// it is priced on the service's own schedule, then on its first rated slab, rather than not at all.
// A row that still cannot be priced is logged with the reason, so the gap is visible in the logs.
const catalogVendorCost = async (db, row, packageTypes, fpId) => {
  try {
    const found = await findCatalogService(db, row, fpId);
    if (!found) {
      console.warn(`[package cost] No catalog service found for "${row.service || row.name}" (id ${row.catalogServiceId ?? 'none'})`);
      return null;
    }
    const { parseService } = require('../routes/serviceCatalog');
    const { calculateServiceQuote } = require('./servicePricing');
    const service = parseService(found);
    const allowed = Array.isArray(service.applicable_property_types) ? service.applicable_property_types : [];
    const propertyType = (packageTypes || []).find(type => allowed.includes(type)) || allowed[0];
    const method = service.pricing_method || row.pricingMethod;
    const key = INPUT_KEY[method];
    const amount = hasNumber(row.inputValue) ? { [key]: Number(row.inputValue) } : {};
    const firstSlab = method === 'capacity_slab'
      ? (service.capacity_slabs || []).find(slab => slab && !slab.isCustomQuote && hasNumber(slab.vendorRate)) : null;
    const schedule = { frequency: row.frequencyType, visits: Number(row.frequencyCount) };
    const attempts = [
      { ...schedule, ...(key ? amount : {}) },
      { ...(key ? amount : {}) },
      ...(firstSlab ? [{ ...schedule, capacity: Number(firstSlab.capacityFrom) }, { capacity: Number(firstSlab.capacityFrom) }] : [])
    ];
    let reason = '';
    for (const attempt of attempts) {
      try {
        const quote = calculateServiceQuote(service, { property_type: propertyType, ...attempt }, 'admin');
        if (hasNumber(quote?.vendorCost)) return Number(quote.vendorCost);
        reason = 'the quote has no vendor cost (custom quote)';
      } catch (error) {
        reason = error.message;
      }
    }
    console.warn(`[package cost] Could not price "${row.service || row.name}" from the catalog: ${reason}`);
    return null;
  } catch (error) {
    console.warn(`[package cost] Catalog lookup failed for "${row.service || row.name}": ${error.message}`);
    return null;
  }
};

const snapshotRows = async (db, stored, packagePrice, fpId) => {
  const rows = (Array.isArray(stored?.serviceRows) ? stored.serviceRows : Array.isArray(stored) ? stored : []).filter(row => row && typeof row === 'object');
  const shares = packageShares(rows, stored && !Array.isArray(stored) ? stored.markup_percentage : null, packagePrice);
  const anyPriced = shares.some(share => share != null);
  const packageTypes = stored && !Array.isArray(stored) ? stored.property_types || (stored.property_type ? [stored.property_type] : []) : [];
  return Promise.all(rows.map(async (row, index) => {
    const snap = packageServiceSnapshot(row, shares[index]);
    // A configured service with no cost on record -- no price saved, or a price typed over -- is
    // costed from the catalog. Only a row with no price at all is outside the package price (share 0).
    if (snap.vendorCost === undefined && (row.catalogServiceId || row.pricingMethod)) {
      const cost = await catalogVendorCost(db, row, packageTypes, fpId);
      if (cost != null) {
        snap.vendorCost = cost;
        if (anyPriced && snap.packageShare == null) snap.packageShare = 0;
      }
    }
    return snap;
  }));
};

const loadPackageSnapshot = async (db, packageId, fpId) => {
  const [[pkg]] = await db.execute(
    'SELECT id, name, description, base_price AS price, services FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?', [packageId, fpId]);
  if (!pkg) return null;
  const stored = parse(pkg.services);
  return { name: pkg.name, description: pkg.description || '', price: Number(pkg.price) || 0,
    billingDuration: stored?.billing_duration || null, services: await snapshotRows(db, stored, pkg.price, fpId) };
};

// Express middleware for the estimate create/update routes. `fpOf` reads the caller's FP from the
// request, since each role's scope middleware stores it under its own name.
const attachPackageSnapshot = (db, fpOf = req => req.fpId || req.franchisePartnerId) => async (req, res, next) => {
  const packageId = req.body?.package_id;
  if (packageId == null || packageId === '') return next();
  try {
    const snapshot = await loadPackageSnapshot(db, packageId, fpOf(req));
    if (!snapshot) return res.status(403).json({ success: false, message: 'Package is outside your FP scope.' });
    Object.assign(req.body, {
      package_services: snapshot.services,
      package_name: req.body.package_name || snapshot.name,
      package_price: snapshot.price,
      amc_package_description: req.body.amc_package_description || snapshot.description,
      ...(snapshot.billingDuration && !req.body.billing_duration ? { billing_duration: snapshot.billingDuration } : {})
    });
    next();
  } catch (error) {
    console.error('Package snapshot error:', error);
    res.status(500).json({ success: false, message: 'Unable to read the selected AMC package.' });
  }
};

// Estimates saved before the snapshot kept a service's method, amount and unit hold their package's
// services without them, so the view showed dashes. When a list is read, any such service is
// completed from its package -- matched by name, filling only what is missing, never overwriting
// what the estimate saved. Rows are changed in place and keep the type package_services came in.
const sameName = value => String(value || '').trim().toLowerCase();
const fillPackageServiceDetails = async (db, estimates) => {
  const wanting = (Array.isArray(estimates) ? estimates : []).filter(est => {
    if (!est?.package_id || !est.package_services) return false;
    const services = parse(est.package_services);
    return Array.isArray(services) && services.some(service => service && typeof service === 'object'
      && (!service.pricingMethod || service.packageShare == null || service.vendorCost == null));
  });
  const cache = new Map();
  for (const est of wanting) {
    const key = `${est.package_id}:${est.franchise_partner_id ?? ''}:${est.package_price ?? ''}`;
    if (!cache.has(key)) {
      try {
        const [[pkg]] = est.franchise_partner_id != null
          ? await db.execute('SELECT services, base_price AS price FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?', [est.package_id, est.franchise_partner_id])
          : await db.execute('SELECT services, base_price AS price FROM fp_amc_packages WHERE id = ?', [est.package_id]);
        // Shared out over the price this estimate sold the package at, not today's package price
        const snaps = await snapshotRows(db, parse(pkg?.services), Number(est.package_price) || pkg?.price, est.franchise_partner_id);
        cache.set(key, new Map(snaps.map(snap => [sameName(snap.name), snap])));
      } catch {
        cache.set(key, new Map());
      }
    }
    const byName = cache.get(key);
    if (!byName.size) continue;
    const wasString = typeof est.package_services === 'string';
    const services = parse(est.package_services).map(service => {
      const match = service && typeof service === 'object' ? byName.get(sameName(service.name || service.service)) : null;
      if (!match) return service;
      const filled = { ...service };
      for (const [field, value] of Object.entries(match)) if (filled[field] === undefined || filled[field] === null || filled[field] === '') filled[field] = value;
      return filled;
    });
    est.package_services = wasString ? JSON.stringify(services) : services;
  }
  return estimates;
};

module.exports = { attachPackageSnapshot, loadPackageSnapshot, packageServiceSnapshot, packageShares, fillPackageServiceDetails };
