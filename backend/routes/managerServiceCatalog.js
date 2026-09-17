const express = require('express');
const { randomUUID } = require('crypto');
const { pool } = require('../config/database');
const { requireRole } = require('../middleware/rbac');
const { requireManagerScope } = require('../middleware/managerScope');
const { getAssignedZones, getEmployeeIdForZoneLookup, getCreatorIdentifier, buildPropertyZoneOrCreatorFilter, buildOnboardedPropertyZoneOrCreatorFilter } = require('../middleware/zoneHelper');
const { calculateServiceQuote, normalizePropertyType } = require('../utils/servicePricing');
const { parseService, priceCustomEstimate, buildCatalogAddons } = require('./serviceCatalog');
const router = express.Router();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const handleError = (res, error) => res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to process the manager service catalog request.' });

router.use(requireRole('manager'), requireManagerScope, (req, res, next) => {
  const fpId = Number(req.franchisePartnerId) || 0;
  if (!Number.isSafeInteger(fpId) || fpId < 0 || (req.fpId && Number(req.fpId) !== fpId)) return res.status(403).json({ success: false, message: 'Invalid manager scope. Please sign in again.' });
  const requested = [req.query.fpId, req.body?.fpId, req.body?.franchise_partner_id];
  if (requested.some(value => value != null && value !== 'all' && Number(value) !== fpId)) return res.status(403).json({ success: false, message: 'The requested FP is outside your scope.' });
  req.catalogFpId = fpId;
  next();
});

const context = async req => {
  if (!req.catalogFpId) fail('A franchise partner assignment is required to create catalog estimates.', 403);
  const creator = getCreatorIdentifier(req);
  const zones = await getAssignedZones(await getEmployeeIdForZoneLookup(req, 'manager'), creator);
  return { fpId: req.catalogFpId, creator, zones };
};
const mapProperty = (property, source) => {
  let contact;
  try { contact = (typeof property.association_contacts === 'string' ? JSON.parse(property.association_contacts) : property.association_contacts)?.[0]; } catch {}
  return { ...property, source_table: source, entry_type: normalizePropertyType(property.entry_type || property.property_type),
    community_name: property.community_name || property.name, zone: property.zone || property.zone_id,
    division: property.division || property.division_id,
    customer_name: property.customer_name || contact?.name || property.contact_person || property.contact_name,
    customer_email: property.customer_email || contact?.email || property.contact_email,
    customer_phone: property.customer_phone || contact?.phone || property.contact_phone };
};
const propertiesForScope = async (scope, id, selectedSource) => {
  const sources = selectedSource ? [selectedSource] : ['onboarded_properties', 'properties'];
  const groups = await Promise.all(sources.map(async source => {
    if (!['onboarded_properties', 'properties'].includes(source)) fail('Select a valid property source.');
    const filter = source === 'properties' ? buildPropertyZoneOrCreatorFilter(scope.zones, scope.creator, 'p') : buildOnboardedPropertyZoneOrCreatorFilter(scope.zones, scope.creator, 'p');
    const sql = source === 'properties'
      ? `SELECT p.* FROM properties p WHERE p.franchise_partner_id = ? AND (p.status = 'active' OR p.status IS NULL)${id ? ' AND p.id = ?' : ''}${filter.clause}`
      : `SELECT p.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM onboarded_properties p
         LEFT JOIN property_contacts c ON c.id = (SELECT MIN(pc.id) FROM property_contacts pc WHERE pc.property_id = p.id)
         WHERE p.franchise_partner_id = ? AND (p.status = 'active' OR p.status IS NULL)${id ? ' AND p.id = ?' : ''}${filter.clause}`;
    const [rows] = await pool.execute(sql, [scope.fpId, ...(id ? [id] : []), ...filter.params]);
    return rows.map(row => mapProperty(row, source));
  }));
  return groups.flat().filter(property => ['APT', 'GC', 'FLAT', 'VILLA', 'IH', 'PLOT'].includes(property.entry_type));
};
const vendorsForScope = async (scope, ids) => {
  const filter = buildOnboardedPropertyZoneOrCreatorFilter(scope.zones, scope.creator, 'v');
  const [rows] = await pool.execute(`SELECT v.id, v.vendor_id, COALESCE(v.company_name, v.owner_name) AS name, v.service_type, v.franchise_partner_id
    FROM onboarded_vendors v WHERE v.franchise_partner_id = ? AND (v.status = 'active' OR v.status IS NULL)
    ${ids ? `AND v.id IN (${ids.map(() => '?').join(',')})` : ''}${filter.clause}`, [scope.fpId, ...(ids || []), ...filter.params]);
  return rows;
};
const quoteEstimate = async req => {
  const body = req.body;
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100) fail('Add between 1 and 100 service rows.');
  if (!Number.isSafeInteger(Number(body.property_id)) || Number(body.property_id) <= 0) fail('Select a property.');
  const ids = [...new Set(body.rows.map(row => Number(row?.vendor_id)))];
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) fail('Select a vendor for each service.');
  const scope = await context(req);
  const [properties, vendors] = await Promise.all([
    propertiesForScope(scope, Number(body.property_id), body.property_source || 'onboarded_properties'), vendorsForScope(scope, ids)
  ]);
  if (!properties.length) fail('Property is outside your assigned scope.', 403);
  if (ids.some(id => !vendors.some(vendor => Number(vendor.id) === id))) fail('A vendor is outside your assigned scope.', 403);
  return priceCustomEstimate({ ...body, fpId: scope.fpId }, 'manager', properties[0]);
};

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE scope_id IN (0, ?) ORDER BY created_at DESC, id DESC', [req.catalogFpId]);
    const services = rows.map(parseService).filter(service => !req.query.propertyType || service.applicable_property_types.includes(normalizePropertyType(req.query.propertyType)));
    res.json({ success: true, data: services });
  } catch (error) { handleError(res, error); }
});
router.get('/estimate-options', async (req, res) => {
  try {
    const scope = await context(req);
    const [properties, vendors] = await Promise.all([propertiesForScope(scope), vendorsForScope(scope)]);
    res.json({ success: true, data: { properties, vendors } });
  } catch (error) { handleError(res, error); }
});
router.post('/custom-estimates/quote', async (req, res) => {
  try { res.json({ success: true, data: await quoteEstimate(req) }); }
  catch (error) { handleError(res, error); }
});
router.post('/custom-estimates', async (req, res) => {
  try {
    if (typeof req.body.notes !== 'string' || req.body.notes.length > 2000) fail('Notes must be at most 2000 characters.');
    const result = await quoteEstimate(req);
    const { property, rows, summary } = result;
    const estimateId = `EST-${randomUUID()}`;
    const addons = buildCatalogAddons(rows, property);
    const [saved] = await pool.execute(`INSERT INTO fp_estimates (estimate_id, franchise_partner_id, property_id, property_code, estimate_type,
      client_name, client_email, client_phone, property_name, property_type, zone, division, city, address,
      subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount, addons_data, description,
      created_by_id, created_by_name, created_by_role, status, package_services, package_price)
      VALUES (?, ?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manager', 'draft', '[]', 0)`,
    [estimateId, req.catalogFpId, property.id, property.property_id || null, property.customer_name || property.community_name,
      property.customer_email || null, property.customer_phone || null, property.community_name, property.entry_type,
      property.zone || null, property.division || null, property.city || null, property.address || null,
      summary.subtotal, summary.discountPercent, summary.discount, summary.gstPercent, summary.gst, summary.total,
      JSON.stringify(addons), req.body.notes.trim(), req.managerId, getCreatorIdentifier(req) || req.user.username || 'Manager']);
    res.status(201).json({ success: true, data: { id: saved.insertId, estimateId, ...result } });
  } catch (error) { handleError(res, error); }
});
router.post('/:id/quote', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [req.params.id, req.catalogFpId]);
    if (!rows.length) fail('Service is outside your scope.', 404);
    const service = parseService(rows[0]);
    const quote = calculateServiceQuote(service, req.body, 'manager');
    res.json({ success: true, data: { ...quote, serviceId: service.id } });
  } catch (error) { handleError(res, error); }
});
router.post('/', (req, res) => res.status(403).json({ success: false, message: 'Service configuration is read-only for Managers.' }));
router.put('/:id', (req, res) => res.status(403).json({ success: false, message: 'Service configuration is read-only for Managers.' }));

router.validatePackageEstimate = async (req, res, next) => {
  const addons = req.body.addons;
  if (!Array.isArray(addons) || !addons.some(addon => addon?.catalogServiceId || String(addon?.addonId || '').startsWith('CAT-'))) return next();
  try {
    if (req.user?.role !== 'manager' || !req.managerId) fail('Manager access required.', 403);
    req.catalogFpId = Number(req.franchisePartnerId) || 0;
    if (req.fpId && Number(req.fpId) !== req.catalogFpId) fail('Invalid manager scope. Please sign in again.', 403);
    const scope = await context(req);
    if (addons.length > 100 || addons.some(addon => !addon || typeof addon !== 'object')) fail('Add at most 100 valid services.');
    let property;
    if (['property_based', 'property-based'].includes(req.body.estimate_type)) {
      const id = Number(req.body.catalog_property_id);
      if (!Number.isSafeInteger(id) || id <= 0) fail('Select a valid property.');
      [property] = await propertiesForScope(scope, id, req.body.catalog_property_source || 'onboarded_properties');
      if (!property) fail('Property is outside your assigned scope.', 403);
      req.body.property_id = property.id;
      req.body.property_code = property.property_id;
      req.body.property_type = property.entry_type;
    }
    const [[pkg]] = await pool.execute('SELECT id, price FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?', [req.body.package_id, scope.fpId]);
    if (!pkg) fail('Package is outside your FP scope.', 403);
    let subtotal = Number(pkg.price);
    const saved = [];
    const seen = new Set();
    for (const addon of addons) {
      if (addon.catalogServiceId || String(addon.addonId || '').startsWith('CAT-')) {
        const id = Number(addon.catalogServiceId);
        if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) fail('Invalid or duplicate configured service.');
        seen.add(id);
        const [[row]] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [id, scope.fpId]);
        if (!row) fail('Service is outside your scope.', 403);
        const config = parseService(row);
        const quote = calculateServiceQuote(config, { ...addon.pricingInputs, property_type: req.body.property_type }, 'manager');
        if (quote.requiresCustomQuote || !Number.isFinite(Number(addon.totalPrice)) || Math.abs(Number(addon.totalPrice) - quote.totalPrice) > 0.01) fail('Service pricing changed. Remove and re-add the configured service.');
        saved.push(...buildCatalogAddons([{ ...config, service_id: id, ...quote }], property));
        subtotal += quote.totalPrice;
      } else {
        const [[legacy]] = await pool.execute('SELECT * FROM fp_addons WHERE id = ? AND franchise_partner_id = ?', [addon.id, scope.fpId]);
        if (!legacy) fail('An additional service is outside your FP scope.', 403);
        const quantity = Number(addon.quantity ?? 1);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1e6) fail('Select a valid service quantity.');
        const price = Number(legacy.price) * quantity;
        saved.push({ ...addon, quantity, name: legacy.service_name, description: addon.description || legacy.description || '', price, frequency_type: addon.frequency_type || legacy.frequency_type, frequency_count: addon.frequency_count ?? legacy.frequency_count });
        subtotal += price;
      }
    }
    const discount = Number(req.body.discount_percent || 0);
    const gst = Number(req.body.gst_percent || 0);
    const discountAmount = subtotal * discount / 100;
    const gstAmount = (subtotal - discountAmount) * gst / 100;
    const total = subtotal - discountAmount + gstAmount;
    if (![subtotal, discount, gst, total].every(Number.isFinite) || total > 999999999.99 || discount < 0 || discount > 100 || gst < 0 || gst > 100 ||
      !Number.isFinite(Number(req.body.subtotal)) || !Number.isFinite(Number(req.body.total_amount)) ||
      Math.abs(Number(req.body.subtotal) - subtotal) > 0.01 || Math.abs(Number(req.body.total_amount) - total) > 0.01) fail('Estimate totals do not match the configured pricing.');
    Object.assign(req.body, { addons: saved, package_price: Number(pkg.price), subtotal, discount_percent: discount, discount_amount: discountAmount, gst_percent: gst, gst_amount: gstAmount, total_amount: total });
    next();
  } catch (error) { handleError(res, error); }
};

module.exports = router;
