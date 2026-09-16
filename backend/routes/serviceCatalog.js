const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { adminOnly, requireRole } = require('../middleware/rbac');
const { validateService, calculateServiceQuote, calculateEstimateSummary, normalizePropertyType } = require('../utils/servicePricing');
const { randomUUID } = require('crypto');
const router = express.Router();

const parseService = row => ({
  ...(typeof row.configuration === 'string' ? JSON.parse(row.configuration) : row.configuration),
  id: row.id, franchise_partner_id: row.scope_id || null, created_at: row.created_at
});
const scopeId = value => {
  if (value === undefined || value === null || value === 'all') return 0;
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 0) throw Object.assign(new Error('Invalid FP scope.'), { status: 400 });
  return Number(value);
};
const handleError = (res, error) => {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A service with this name already exists in this FP scope.' });
  if (!error.status) console.error('Service catalog error:', error.message);
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to access the service catalog. Please try again.' });
};

router.use(authenticate, adminOnly);

router.get('/', async (req, res) => {
  try {
    const scope = scopeId(req.query.fpId);
    const [rows] = await db.pool.execute(
      `SELECT * FROM service_catalog ${scope ? 'WHERE scope_id IN (0, ?)' : ''} ORDER BY created_at DESC, id DESC`, scope ? [scope] : []
    );
    let services = rows.map(parseService);
    if (req.query.propertyType) services = services.filter(service => service.applicable_property_types.includes(normalizePropertyType(req.query.propertyType)));
    res.json({ success: true, data: services });
  } catch (error) { handleError(res, error); }
});

const saveService = async (req, res) => {
  try {
    const config = validateService(req.body);
    const scope = scopeId(req.body.franchise_partner_id);
    const categories = require('../config/categories');
    let validCategory = categories.some(category => category.name === config.category);
    if (!validCategory) {
      const [rows] = await db.pool.execute('SELECT id FROM admin_categories WHERE name = ? AND is_active = 1', [config.category]);
      validCategory = rows.length > 0;
    }
    if (!validCategory) return res.status(400).json({ success: false, message: 'Select an existing category.' });
    if (scope) {
      const [partners] = await db.pool.execute('SELECT id FROM franchise_partners WHERE id = ?', [scope]);
      if (!partners.length) return res.status(400).json({ success: false, message: 'The selected franchise partner does not exist.' });
    }
    if (req.params.id) {
      const [existing] = await db.pool.execute('SELECT * FROM service_catalog WHERE id = ?', [req.params.id]);
      if (!existing.length) return res.status(404).json({ success: false, message: 'Service not found.' });
      if (existing[0].scope_id !== scope) return res.status(400).json({ success: false, message: 'An existing service cannot be moved to another FP scope.' });
      await db.pool.execute('UPDATE service_catalog SET service_name = ?, configuration = ? WHERE id = ?', [config.service_name, JSON.stringify(config), req.params.id]);
      return res.json({ success: true, data: { ...config, id: Number(req.params.id), franchise_partner_id: scope || null } });
    }
    const [result] = await db.pool.execute(
      'INSERT INTO service_catalog (service_name, scope_id, configuration, created_by) VALUES (?, ?, ?, ?)',
      [config.service_name, scope, JSON.stringify(config), req.user.id]
    );
    res.status(201).json({ success: true, data: { ...config, id: result.insertId, franchise_partner_id: scope || null } });
  } catch (error) { handleError(res, error); }
};
router.post('/', requireRole('admin'), saveService);
router.put('/:id', requireRole('admin'), saveService);

router.get('/estimate-options', async (req, res) => {
  try {
    const scope = scopeId(req.query.fpId);
    const [properties] = await db.pool.execute(
      `SELECT p.id, p.property_id, p.entry_type, p.community_name, p.zone, p.address, p.franchise_partner_id,
              c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM onboarded_properties p
       LEFT JOIN property_contacts c ON c.id = (SELECT MIN(pc.id) FROM property_contacts pc WHERE pc.property_id = p.id)
       WHERE (p.status = 'active' OR p.status IS NULL) ${scope ? 'AND p.franchise_partner_id = ?' : ''}
       ORDER BY p.community_name`, scope ? [scope] : []
    );
    const [vendors] = await db.pool.execute(
      `SELECT id, vendor_id, COALESCE(company_name, owner_name) AS name, service_type, franchise_partner_id
       FROM onboarded_vendors WHERE (status = 'active' OR status IS NULL)
       ${scope ? 'AND (franchise_partner_id = ? OR franchise_partner_id IS NULL)' : ''} ORDER BY name`, scope ? [scope] : []
    );
    res.json({ success: true, data: { properties: properties.filter(property => ['APT', 'GC', 'FLAT', 'VILLA', 'IH', 'PLOT'].includes(normalizePropertyType(property.entry_type))), vendors } });
  } catch (error) { handleError(res, error); }
});

const priceCustomEstimate = async (body, role) => {
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100) invalid('Add between 1 and 100 service rows.');
  if (!Number.isSafeInteger(Number(body.property_id)) || Number(body.property_id) <= 0) invalid('Select a property.');
  const [properties] = await db.pool.execute(
    `SELECT p.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
     FROM onboarded_properties p LEFT JOIN property_contacts c ON c.id = (SELECT MIN(pc.id) FROM property_contacts pc WHERE pc.property_id = p.id)
     WHERE p.id = ? AND (p.status = 'active' OR p.status IS NULL)`, [body.property_id]
  );
  if (!properties.length) invalid('Selected property is not available.');
  const property = properties[0];
  const scope = scopeId(body.fpId);
  if (scope && scope !== Number(property.franchise_partner_id)) invalid('Property belongs to another FP.');
  const rows = [];
  for (const row of body.rows) {
    if (!Number.isSafeInteger(Number(row?.service_id)) || Number(row.service_id) <= 0 || !Number.isSafeInteger(Number(row.vendor_id)) || Number(row.vendor_id) <= 0) invalid('Select a service and vendor for every row.');
    const [services] = await db.pool.execute('SELECT * FROM service_catalog WHERE id = ?', [row.service_id]);
    if (!services.length) invalid('A selected service no longer exists.');
    const config = parseService(services[0]);
    if (config.franchise_partner_id && config.franchise_partner_id !== Number(property.franchise_partner_id)) invalid('Service belongs to another FP.');
    const [vendors] = await db.pool.execute(
      `SELECT id, vendor_id, COALESCE(company_name, owner_name) AS name, franchise_partner_id FROM onboarded_vendors WHERE id = ? AND (status = 'active' OR status IS NULL)`, [row.vendor_id]
    );
    if (!vendors.length || (vendors[0].franchise_partner_id && vendors[0].franchise_partner_id !== Number(property.franchise_partner_id))) invalid('The selected vendor is not available for this property.');
    const quote = calculateServiceQuote(config, { ...row.inputs, property_type: property.entry_type }, role);
    if (quote.requiresCustomQuote) invalid(`${config.service_name} requires a custom quote for this capacity. Enter the total vendor cost for the service period.`);
    rows.push({ service_id: config.id, service_name: config.service_name, description: config.description, category: config.category, pricing_method: config.pricing_method, unit: config.unit, vendor_id: vendors[0].id, vendor_name: vendors[0].name, ...quote });
  }
  return {
    property: { id: property.id, property_id: property.property_id, entry_type: property.entry_type, community_name: property.community_name, zone: property.zone, address: property.address, franchise_partner_id: property.franchise_partner_id, customer_name: property.customer_name || property.community_name, customer_email: property.customer_email, customer_phone: property.customer_phone },
    rows, summary: calculateEstimateSummary(rows, body.discount_percentage ?? 0, body.gst_percentage ?? 18)
  };
};

router.post('/custom-estimates/quote', requireRole('admin'), async (req, res) => {
  try { res.json({ success: true, data: await priceCustomEstimate(req.body, req.user.role) }); }
  catch (error) { handleError(res, error); }
});

router.post('/custom-estimates', requireRole('admin'), async (req, res) => {
  try {
    const result = await priceCustomEstimate(req.body, req.user.role);
    const { property, rows, summary } = result;
    if (typeof req.body.notes !== 'string' || req.body.notes.length > 2000) return res.status(400).json({ success: false, message: 'Notes must be at most 2000 characters.' });
    const estimateId = `EST-${randomUUID()}`;
    const addons = rows.map((row, index) => ({
      addonId: `CAT-${row.service_id}-${index}`, catalogServiceId: row.service_id, name: row.service_name, service_name: row.service_name,
      description: row.description, frequency_type: row.frequency, frequency_count: row.visits, totalPrice: row.totalPrice,
      services: [{ name: row.service_name, description: row.description, frequencyType: row.frequency, frequency: row.visits, price: row.totalPrice / row.visits }],
      pricingInputs: row.inputs, pricingSnapshot: row
    }));
    await db.pool.execute(
      `INSERT INTO estimates (estimate_id, title, property_id, franchise_partner_id, customer_name, customer_email, customer_phone,
        property_type, property_name, property_address, services, addons, subtotal, discount, tax, total, total_amount,
        discount_percentage, discount_amount, tax_percentage, tax_amount, description, notes, status, created_by, is_active, estimate_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, 1, 'custom')`,
      [estimateId, `Custom Estimate - ${property.community_name}`, property.id, property.franchise_partner_id || null,
        property.customer_name, property.customer_email || null, property.customer_phone || null, property.entry_type, property.community_name,
        property.address || null, JSON.stringify([]), JSON.stringify(addons), summary.subtotal, summary.discount, summary.gst, summary.total,
        summary.total, summary.discountPercent, summary.discount, summary.gstPercent, summary.gst, req.body.notes.trim(), req.body.notes.trim(), req.user.id]
    );
    res.status(201).json({ success: true, data: { estimateId, ...result } });
  } catch (error) { handleError(res, error); }
});

router.post('/:id/quote', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.pool.execute('SELECT * FROM service_catalog WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Service not found.' });
    const service = parseService(rows[0]);
    const scope = scopeId(req.body.fpId);
    if (scope && service.franchise_partner_id && scope !== service.franchise_partner_id) return res.status(400).json({ success: false, message: 'Service belongs to another FP.' });
    const quote = calculateServiceQuote(service, req.body, req.user.role);
    res.json({ success: true, data: { ...quote, serviceId: service.id } });
  } catch (error) { handleError(res, error); }
});

const isCatalogAddon = addon => addon?.catalogServiceId || String(addon?.addonId || '').startsWith('CAT-');
const validateCatalogEstimate = (req, res, next) => {
  if (!Array.isArray(req.body.addons) || !req.body.addons.some(isCatalogAddon)) return next();
  authenticate(req, res, () => adminOnly(req, res, async () => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Only admins can create estimates using this catalog.' });
      const { addons } = req.body;
      const scope = scopeId(req.body.catalogScopeId);
      let catalogPrice = 0;
      const seen = new Set();
      for (let index = 0; index < addons.length; index++) {
        const addon = addons[index];
        if (!isCatalogAddon(addon)) continue;
        const id = Number(addon.catalogServiceId);
        if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) throw Object.assign(new Error('Invalid or duplicate catalog service.'), { status: 400 });
        seen.add(id);
        const [rows] = await db.pool.execute('SELECT * FROM service_catalog WHERE id = ?', [id]);
        if (!rows.length) throw Object.assign(new Error('A selected catalog service no longer exists.'), { status: 400 });
        const config = parseService(rows[0]);
        if (scope && config.franchise_partner_id && scope !== config.franchise_partner_id) throw Object.assign(new Error('Service belongs to another FP.'), { status: 400 });
        const quote = calculateServiceQuote(config, { ...addon.pricingInputs, property_type: req.body.propertyType }, req.user.role);
        if (quote.requiresCustomQuote) throw Object.assign(new Error(`Enter a custom quote for ${config.service_name}.`), { status: 400 });
        if (Math.abs(Number(addon.totalPrice) - quote.totalPrice) > 0.01 || !Number.isFinite(Number(addon.totalPrice))) throw Object.assign(new Error('Service pricing has changed. Remove and re-add the service before saving.'), { status: 400 });
        const service = { name: config.service_name, description: config.description, frequencyType: quote.frequency, frequency: quote.visits, price: quote.totalPrice / quote.visits };
        addons[index] = {
          addonId: `CAT-${id}`, catalogServiceId: id, name: config.service_name, service_name: config.service_name,
          frequency_type: quote.frequency, frequency_count: quote.visits, description: config.description,
          services: [service], totalPrice: quote.totalPrice, pricingInputs: quote.inputs,
          pricingSnapshot: { ...config, vendorCost: quote.vendorCost, totalPrice: quote.totalPrice }
        };
        catalogPrice += quote.totalPrice;
      }
      const legacyTotal = addons.filter(addon => !isCatalogAddon(addon)).reduce((sum, addon) => sum + (addon.services?.reduce((value, service) => value + (Number(service.price) || 0) * (Number(service.frequency) || 1), 0) || Number(addon.totalPrice) || 0), 0);
      const expectedSubtotal = Math.round((Number(req.body.packageRate) || 0) + legacyTotal + catalogPrice);
      const subtotal = Number(req.body.subtotal ?? req.body.subTotal);
      const discount = Number(req.body.discount || 0);
      const tax = Number(req.body.tax ?? req.body.gst ?? 0);
      const total = Number(req.body.total ?? req.body.totalPrice);
      if (![subtotal, discount, tax, total].every(Number.isFinite) || Math.abs(subtotal - expectedSubtotal) > 0.01 || discount < 0 || discount > subtotal || tax < 0 || Math.abs(total - (subtotal - discount + tax)) > 0.01) throw Object.assign(new Error('Estimate totals do not match the configured service pricing.'), { status: 400 });
      next();
    } catch (error) { handleError(res, error); }
  }));
};

module.exports = { router, validateCatalogEstimate };
