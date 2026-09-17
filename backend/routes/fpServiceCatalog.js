const express = require('express');
const { pool } = require('../config/database');
const { requireFPScope } = require('../middleware/fpScope');
const { calculateServiceQuote, normalizePropertyType } = require('../utils/servicePricing');
const { normalizeEstimateService } = require('../utils/estimateData');
const { parseService } = require('./serviceCatalog');
const router = express.Router();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const handleError = (res, error) => {
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

router.post('/:id/quote', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [req.params.id, req.catalogFpId]);
    if (!rows.length) fail('Service is outside your scope.', 404);
    const service = parseService(rows[0]);
    res.json({ success: true, data: { ...calculateServiceQuote(service, req.body, req.user.role), serviceId: service.id } });
  } catch (error) { handleError(res, error); }
});

router.post('/', (req, res) => res.status(403).json({ success: false, message: 'Service configuration is read-only for Franchise Partners.' }));
router.put('/:id', (req, res) => res.status(403).json({ success: false, message: 'Service configuration is read-only for Franchise Partners.' }));

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
        services: [{ name: config.service_name, description: config.description, frequencyType: quote.frequency, frequency: quote.visits, price: quote.totalPrice / quote.visits }],
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
