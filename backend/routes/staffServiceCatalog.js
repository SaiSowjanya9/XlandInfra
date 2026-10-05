// The service catalog as the Coordinator, Supervisor and Executive portals see it: read-only, in
// their franchise's scope (its own services plus the shared ones). It is what puts the configured
// services in their estimate's Add Service menu, the same menu the FP and Manager forms have.
//
// The scope comes from the role's own attach*Scope middleware (req.franchisePartnerId); a caller-
// supplied FP is never trusted. A staff member with no franchise sees the shared (scope 0) services.
// Cost columns are not shown to these roles -- that is the frontend's `internal` flag, which their
// forms do not pass -- and the quote itself carries no more than the Manager's does.
const express = require('express');
const { pool } = require('../config/database');
const { calculateServiceQuote, normalizePropertyType } = require('../utils/servicePricing');
const { categoryOptions } = require('../utils/serviceCategories');
const { unitOptions } = require('../utils/serviceUnits');
const { isManualService, normalizeManualService } = require('../utils/estimateData');
const { parseService, clientService, buildCatalogAddons } = require('./serviceCatalog');

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const handleError = (res, error) => {
  if (!error.status) console.error('Staff service catalog error:', error.message);
  return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to access the service catalog. Please try again.' });
};
const fpScopeOf = req => {
  const fpId = Number(req.franchisePartnerId) || 0;
  if (!Number.isSafeInteger(fpId) || fpId < 0) fail('Invalid franchise scope. Please sign in again.', 403);
  const requested = [req.query?.fpId, req.body?.fpId];
  if (requested.some(value => value != null && value !== '' && value !== 'all' && Number(value) !== fpId)) fail('The requested FP is outside your scope.', 403);
  return fpId;
};
const isCatalogAddon = addon => addon?.catalogServiceId || String(addon?.addonId || '').startsWith('CAT-');

const createStaffCatalogRouter = role => {
  const router = express.Router();
  const readOnly = (req, res) => res.status(403).json({ success: false, message: `Service configuration is read-only for the ${role} role.` });
  router.use((req, res, next) => {
    try { req.catalogFpId = fpScopeOf(req); next(); } catch (error) { handleError(res, error); }
  });
  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE scope_id IN (0, ?) ORDER BY created_at DESC, id DESC', [req.catalogFpId]);
      const services = rows.map(clientService).filter(service => !req.query.propertyType
        || service.applicable_property_types.includes(normalizePropertyType(req.query.propertyType)));
      res.json({ success: true, data: services });
    } catch (error) { handleError(res, error); }
  });
  router.get('/categories', async (req, res) => {
    try { res.json({ success: true, data: await categoryOptions(pool, req.catalogFpId), canManage: false }); }
    catch (error) { handleError(res, error); }
  });
  router.get('/units', async (req, res) => {
    try { res.json({ success: true, data: await unitOptions(pool, req.catalogFpId, req.query.pricing_method), canManage: false }); }
    catch (error) { handleError(res, error); }
  });
  router.post('/:id/quote', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [req.params.id, req.catalogFpId]);
      if (!rows.length) fail('Service is outside your scope.', 404);
      const service = parseService(rows[0]);
      res.json({ success: true, data: { ...calculateServiceQuote(service, req.body, role), serviceId: service.id } });
    } catch (error) { handleError(res, error); }
  });
  router.post('/categories', readOnly);
  router.delete('/categories/:id', readOnly);
  router.post('/units', readOnly);
  router.delete('/units/:id', readOnly);
  router.post('/', readOnly);
  router.put('/:id', readOnly);
  router.delete('/:id', readOnly);
  return router;
};

// Runs before the role's own POST /estimates. A configured service's price is the server's to
// state, so every one on the estimate is priced again here and stored as the server priced it; a
// figure that no longer matches is refused rather than saved. Estimates with no configured service
// pass straight through, exactly as before.
const validateStaffCatalogEstimate = role => async (req, res, next) => {
  const addons = req.body?.addons;
  if (!Array.isArray(addons) || !addons.some(isCatalogAddon)) return next();
  try {
    const fpId = fpScopeOf(req);
    if (addons.length > 100 || addons.some(addon => !addon || typeof addon !== 'object')) fail('Add at most 100 valid services.');
    let property = null;
    let propertyType = normalizePropertyType(req.body.property_type);
    if (['property_based', 'property-based'].includes(req.body.estimate_type)) {
      const id = Number(req.body.catalog_property_id);
      if (!Number.isSafeInteger(id) || id <= 0) fail('Select a valid property before adding configured services.');
      // These portals look a property up in both tables, so an unstated source is tried in both
      const requested = req.body.catalog_property_source;
      const sources = requested === 'properties' || requested === 'onboarded_properties' ? [requested] : ['onboarded_properties', 'properties'];
      // The two tables number their rows independently, so where both hold this id the one whose
      // property code the estimate names is the property meant
      const found = [];
      for (const table of sources) {
        const [[match]] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?${fpId ? ' AND franchise_partner_id = ?' : ''}`, fpId ? [id, fpId] : [id]);
        if (match) found.push({ row: match, table });
      }
      const chosen = found.find(item => req.body.property_code && item.row.property_id === req.body.property_code) || found[0];
      const row = chosen?.row;
      const source = chosen?.table;
      if (!row) fail('Property is outside your franchise scope.', 403);
      property = { ...row, source_table: source, entry_type: normalizePropertyType(row.entry_type || row.property_type) };
      propertyType = property.entry_type;
    }
    if (!propertyType) fail('Select a property type before adding configured services.');
    const saved = [];
    const seen = new Set();
    for (const addon of addons) {
      if (!isCatalogAddon(addon)) { saved.push(isManualService(addon) ? normalizeManualService(addon) : addon); continue; }
      const id = Number(addon.catalogServiceId);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) fail('Invalid or duplicate configured service.');
      seen.add(id);
      const [[row]] = await pool.execute('SELECT * FROM service_catalog WHERE id = ? AND scope_id IN (0, ?)', [id, fpId]);
      if (!row) fail('Service is outside your scope.', 403);
      const config = parseService(row);
      const quote = calculateServiceQuote(config, { ...addon.pricingInputs, property_type: propertyType }, role);
      if (quote.requiresCustomQuote || !Number.isFinite(Number(addon.totalPrice)) || Math.abs(Number(addon.totalPrice) - quote.totalPrice) > 0.01) {
        fail('Service pricing changed. Remove and re-add the configured service.');
      }
      saved.push(...buildCatalogAddons([{ ...config, service_id: id, ...quote }], property));
    }
    req.body.addons = saved;
    next();
  } catch (error) { handleError(res, error); }
};

module.exports = { createStaffCatalogRouter, validateStaffCatalogEstimate };
