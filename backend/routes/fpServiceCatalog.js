const express = require('express');
const { pool } = require('../config/database');
const { requireFPScope, isFranchisePartner } = require('../middleware/fpScope');
const { validateService, calculateServiceQuote, normalizePropertyType } = require('../utils/servicePricing');
const { normalizeEstimateService } = require('../utils/estimateData');
const { categoryOptions } = require('../utils/serviceCategories');
const { parseService } = require('./serviceCatalog');
const router = express.Router();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const handleError = (res, error) => {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A service with this name already exists for your franchise.' });
  if (!error.status) console.error('FP service catalog error:', error.message);
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to access the service catalog. Please try again.' });
};
const isCatalogAddon = addon => addon?.catalogServiceId || String(addon?.addonId || '').startsWith('CAT-');

// The FP scope comes from the authenticated session only; a caller-supplied FP is never trusted.
const catalogScope = req => {
  const fpId = Number(req.fpId) || 0;
  if (!Number.isSafeInteger(fpId) || fpId <= 0) fail('A franchise partner assignment is required to use configured services.', 403);
  if ([req.query?.fpId, req.body?.fpId, req.body?.franchise_partner_id].some(value => value != null && value !== '' && value !== 'all' && Number(value) !== fpId)) {
    fail('The requested FP is outside your scope.', 403);
  }
  return fpId;
};

router.use(requireFPScope, (req, res, next) => {
  try {
    req.catalogFpId = catalogScope(req);
    next();
  } catch (error) { handleError(res, error); }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE scope_id IN (0, ?) ORDER BY created_at DESC, id DESC', [req.catalogFpId]);
    const services = rows.map(parseService).filter(service => !req.query.propertyType || service.applicable_property_types.includes(normalizePropertyType(req.query.propertyType)));
    res.json({ success: true, data: services });
  } catch (error) { handleError(res, error); }
});

// Suggestions for the category field: the shared list plus any category this scope already used,
// which is how a custom category typed on a saved service comes back in the dropdown.
router.get('/categories', async (req, res) => {
  try { res.json({ success: true, data: await categoryOptions(pool, req.catalogFpId) }); }
  catch (error) { handleError(res, error); }
});

router.post('/:id/quote', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [req.params.id, req.catalogFpId]);
    if (!rows.length) fail('Service is outside your scope.', 404);
    const service = parseService(rows[0]);
    res.json({ success: true, data: { ...calculateServiceQuote(service, req.body, req.user.role), serviceId: service.id } });
  } catch (error) { handleError(res, error); }
});

// FPs configure their own services. The scope is always their own FP, so a service can never be
// saved against another FP or made global, and admin-owned (scope 0) services stay read-only.
const saveService = async (req, res) => {
  try {
    // FP staff (manager, coordinator, supervisor, executive) may quote from the catalog but not author it
    if (!isFranchisePartner(req.user.role)) fail('Only the franchise partner can configure services.', 403);
    // The category may be typed rather than chosen, so it is validated as text, not against a list
    const config = validateService(req.body);
    if (req.params.id) {
      const [[existing]] = await pool.execute('SELECT id, scope_id FROM service_catalog WHERE id = ?', [req.params.id]);
      if (!existing) fail('Service not found.', 404);
      if (Number(existing.scope_id) !== req.catalogFpId) fail('Only services created for your franchise can be edited.', 403);
      await pool.execute('UPDATE service_catalog SET service_name = ?, configuration = ? WHERE id = ?', [config.service_name, JSON.stringify(config), req.params.id]);
      return res.json({ success: true, data: { ...config, id: Number(req.params.id), franchise_partner_id: req.catalogFpId } });
    }
    const [result] = await pool.execute('INSERT INTO service_catalog (service_name, scope_id, configuration, created_by) VALUES (?, ?, ?, ?)',
      [config.service_name, req.catalogFpId, JSON.stringify(config), req.user.id]);
    res.status(201).json({ success: true, data: { ...config, id: result.insertId, franchise_partner_id: req.catalogFpId } });
  } catch (error) { handleError(res, error); }
};
router.post('/', saveService);
router.put('/:id', saveService);

// Re-prices every configured service on the server so a saved FP estimate can never keep a
// client-supplied price, and rebuilds the stored snapshot from the current catalog definition.
router.validatePackageEstimate = async (req, res, next) => {
  const addons = req.body.addons;
  if (!Array.isArray(addons) || !addons.some(isCatalogAddon)) return next();
  try {
    const fpId = catalogScope(req);
    if (addons.length > 100 || addons.some(addon => !addon || typeof addon !== 'object')) fail('Add at most 100 valid services.');
    let subtotal = 0;
    if (req.body.package_id != null && req.body.package_id !== '') {
      const [[pkg]] = await pool.execute('SELECT id, price FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?', [req.body.package_id, fpId]);
      if (!pkg) fail('Package is outside your FP scope.', 403);
      req.body.package_price = Number(pkg.price);
      subtotal += Number(pkg.price);
    }
    const saved = [];
    const seen = new Set();
    for (const addon of addons) {
      if (!isCatalogAddon(addon)) {
        const [[legacy]] = await pool.execute('SELECT * FROM fp_addons WHERE id = ? AND franchise_partner_id = ?', [addon.id, fpId]);
        if (!legacy) fail('An additional service is outside your FP scope.', 403);
        const quantity = Number(addon.quantity ?? 1);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1e6) fail('Select a valid service quantity.');
        const price = Number(legacy.price) * quantity;
        saved.push({ ...addon, quantity, name: legacy.service_name, price, description: addon.description || legacy.description || '',
          frequency_type: addon.frequency_type || legacy.frequency_type, frequency_count: addon.frequency_count ?? legacy.frequency_count });
        subtotal += price;
        continue;
      }
      const id = Number(addon.catalogServiceId);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) fail('Invalid or duplicate configured service.');
      seen.add(id);
      const [[row]] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [id, fpId]);
      if (!row) fail('Service is outside your scope.', 403);
      const config = parseService(row);
      const quote = calculateServiceQuote(config, { ...addon.pricingInputs, property_type: req.body.property_type }, req.user.role);
      if (quote.requiresCustomQuote) fail(`Enter a custom quote for ${config.service_name}.`);
      if (!Number.isFinite(Number(addon.totalPrice)) || Math.abs(Number(addon.totalPrice) - quote.totalPrice) > 0.01) fail('Service pricing has changed. Remove and re-add the configured service before saving.');
      saved.push(normalizeEstimateService({
        addonId: `CAT-${id}`, catalogServiceId: id, name: config.service_name, service_name: config.service_name,
        description: config.description, frequency_type: quote.frequency, frequency_count: quote.visits,
        services: [{ name: config.service_name, description: config.description, frequencyType: quote.frequency, frequency: quote.visits, price: quote.visits ? quote.totalPrice / quote.visits : quote.totalPrice }],
        totalPrice: quote.totalPrice, price: quote.totalPrice, pricingInputs: quote.inputs, pricingSnapshot: { ...config, ...quote }
      }));
      subtotal += quote.totalPrice;
    }
    const discountPercent = Number(req.body.discount_percent || 0);
    const gstPercent = Number(req.body.gst_percent || 0);
    if (![discountPercent, gstPercent].every(Number.isFinite) || discountPercent < 0 || discountPercent > 100 || gstPercent < 0 || gstPercent > 100) fail('Discount and GST must be between 0 and 100.');
    const discountAmount = subtotal * discountPercent / 100;
    const gstAmount = (subtotal - discountAmount) * gstPercent / 100;
    const total = subtotal - discountAmount + gstAmount;
    if (total > 999999999.99) fail('Estimate total exceeds the supported limit.');
    if (!Number.isFinite(Number(req.body.subtotal)) || !Number.isFinite(Number(req.body.total_amount)) ||
      Math.abs(Number(req.body.subtotal) - subtotal) > 0.01 || Math.abs(Number(req.body.total_amount) - total) > 0.01) fail('Estimate totals do not match the configured service pricing.');
    Object.assign(req.body, { addons: saved, subtotal, discount_percent: discountPercent, discount_amount: discountAmount, gst_percent: gstPercent, gst_amount: gstAmount, total_amount: total });
    next();
  } catch (error) { handleError(res, error); }
};

module.exports = router;
