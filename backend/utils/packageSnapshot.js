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

const packageServiceSnapshot = row => {
  const vendorCost = Number(row?.vendorCost);
  return {
    name: row?.service || row?.name || 'Service',
    description: row?.description || '',
    ...(row?.category ? { category: row.category } : {}),
    frequencyType: row?.frequencyType || row?.frequency_type || 'Monthly',
    frequencyCount: Number(row?.frequencyCount ?? row?.frequency_count ?? 0) || 0,
    ...(Number.isFinite(vendorCost) && vendorCost >= 0 && row?.vendorCost !== '' && row?.vendorCost != null ? { vendorCost } : {})
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

module.exports = { attachPackageSnapshot, loadPackageSnapshot, packageServiceSnapshot };
