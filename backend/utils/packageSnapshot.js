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

const packageServiceSnapshot = row => {
  const vendorCost = Number(row?.vendorCost);
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
    ...(Number.isFinite(vendorCost) && vendorCost >= 0 && row?.vendorCost !== '' && row?.vendorCost != null ? { vendorCost } : {}),
    ...(Number.isFinite(operatingCost) && operatingCost > 0 ? { operatingCost } : {})
  };
};

const loadPackageSnapshot = async (db, packageId, fpId) => {
  const [[pkg]] = await db.execute(
    'SELECT id, name, description, base_price AS price, services FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?', [packageId, fpId]);
  if (!pkg) return null;
  const stored = parse(pkg.services);
  const rows = Array.isArray(stored?.serviceRows) ? stored.serviceRows : Array.isArray(stored) ? stored : [];
  return { name: pkg.name, description: pkg.description || '', price: Number(pkg.price) || 0,
    billingDuration: stored?.billing_duration || null, services: rows.map(packageServiceSnapshot) };
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
    return Array.isArray(services) && services.some(service => service && typeof service === 'object' && !service.pricingMethod);
  });
  const cache = new Map();
  for (const est of wanting) {
    const key = `${est.package_id}:${est.franchise_partner_id ?? ''}`;
    if (!cache.has(key)) {
      try {
        const [[pkg]] = est.franchise_partner_id != null
          ? await db.execute('SELECT services FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?', [est.package_id, est.franchise_partner_id])
          : await db.execute('SELECT services FROM fp_amc_packages WHERE id = ?', [est.package_id]);
        const stored = parse(pkg?.services);
        const rows = Array.isArray(stored?.serviceRows) ? stored.serviceRows : Array.isArray(stored) ? stored : [];
        cache.set(key, new Map(rows.filter(row => row && typeof row === 'object').map(row => {
          const snap = packageServiceSnapshot(row);
          return [sameName(snap.name), snap];
        })));
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

module.exports = { attachPackageSnapshot, loadPackageSnapshot, packageServiceSnapshot, fillPackageServiceDetails };
