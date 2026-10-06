const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEstimateData, normalizeEstimateService, customerEstimateData, canEmailEstimate, enrichLegacyEstimateAddon, hasCatalogServices, normalizeManualService, billToParty } = require('./estimateData');

const addon = {
  catalogServiceId: 3, name: 'Generator Maintenance', description: 'Inspect and service generator', totalPrice: 11960.25,
  services: [{ name: 'Generator Maintenance', frequencyType: 'Quarterly', frequency: 4, price: 2990.0625 }],
  pricingInputs: { capacity: 75, frequency: 'Quarterly', visits: 4, operating_cost: 800, markup_percentage: 30 },
  pricingSnapshot: { pricing_method: 'capacity_slab', unit: 'KVA', vendorCost: 9200, profit: 2760.25,
    capacity_slabs: [{ capacityFrom: 51, capacityTo: 100, vendorRate: 2300 }] }
};

test('catalog rows retain saved pricing, frequency, visits and customer-safe method details', () => {
  const row = normalizeEstimateService(addon);
  assert.equal(row.price, 11960.25);
  assert.equal(row.frequencyCount, 4);
  assert.equal(row.frequency_type, 'Quarterly');
  assert.match(row.details, /Capacity Slab/);
  assert.match(row.details, /75 KVA/);
  assert.match(row.details, /51.*100 KVA/);
  assert.doesNotMatch(row.details, /9200|2300|800|2760|operating|markup|profit/i);
  assert.equal(normalizeEstimateService(row).details, row.details);
});

test('estimate aliases accept JSON arrays and keep zero GST and decimal totals', () => {
  const estimate = normalizeEstimateData({ estimate_id: 'EST-CUSTOM', estimate_type: 'custom', addons: JSON.stringify([addon]),
    services: '[]', customer_name: 'Customer', customer_email: 'customer@example.test', customer_phone: '123',
    tax_percentage: 0, tax_amount: 0, discount_percentage: 0, discount_amount: 0, subtotal: '11960.25', total: '11960.25' });
  assert.equal(estimate.addons[0].price, 11960.25);
  assert.equal(estimate.gst_percent, 0);
  assert.equal(estimate.totalPrice, 11960.25);
  assert.equal(estimate.customerName, 'Customer');
  assert.equal(estimate.customerPhone, '123');
  assert.deepEqual(estimate.services, []);
  assert.equal(normalizeEstimateData({ addons_data: JSON.stringify([addon]) }).addons.length, 1);
  assert.deepEqual(normalizeEstimateData({ addons: '{invalid' }).addons, []);
});

test('customer delivery drops internal snapshots but retains safe service information and total', () => {
  const estimate = customerEstimateData({ estimate_id: 'EST-CUSTOM', estimate_type: 'custom', addons: [addon],
    services: [], total: 11960.25, tax_percentage: 0, action_token: 'private-token', internalCost: 9200,
    customer_email: 'customer@example.test', property_code: 'PROP-1', created_at: '2026-09-16' });
  assert.equal(estimate.addons[0].frequencyCount, 4);
  // The measured amount reaches the customer in its own Input / Details field, with the method
  assert.match(estimate.addons[0].input, /75 KVA/);
  assert.ok(estimate.addons[0].method);
  assert.equal(estimate.total, 11960.25);
  assert.equal(estimate.gstPercent, 0);
  assert.equal(estimate.propertyCode, 'PROP-1');
  const serialized = JSON.stringify(estimate);
  assert.doesNotMatch(serialized, /pricingSnapshot|pricingInputs|vendorCost|operating_cost|markup_percentage|private-token|internalCost|profit/);
});

test('legacy services preserve visit counts, description, zero prices and frequency labels', () => {
  const row = normalizeEstimateService({ name: 'Cleaning', price: 0, totalPrice: 200, frequency: 6, frequencyType: '6x Every 2 Months', description: 'Clean shared areas' });
  assert.equal(row.price, 0);
  assert.equal(row.frequencyCount, 6);
  assert.equal(row.frequencyType, 'Every 2 Months');
  assert.equal(row.details, 'Clean shared areas');
});

test('saved property snapshots fill missing view and delivery metadata', () => {
  const estimate = normalizeEstimateData({ estimate_type: 'custom', property_id: 4, addons: [{ ...addon,
    propertySnapshot: { property_id: 'PROP-SAVED', zone: 'Saved Zone', city: 'Saved City', total_units: 50 } }] });
  assert.equal(estimate.propertyCode, 'PROP-SAVED');
  assert.equal(estimate.zone, 'Saved Zone');
  assert.equal(estimate.city, 'Saved City');
  assert.equal(estimate.total_units, 50);
  assert.equal(estimate.addonsTotal, 11960.25);
});

test('employee delivery remains restricted to the FP and assigned zone or creator', () => {
  const scope = { fpId: 8, zones: ['North'], creatorId: 2, role: 'manager', creatorNames: ['manager@example.test'] };
  const estimate = { franchise_partner_id: 8, zone: 'North', created_by_id: 99, created_by_role: 'executive' };
  assert.equal(canEmailEstimate(estimate, scope), true);
  assert.equal(canEmailEstimate({ ...estimate, franchise_partner_id: 9 }, scope), false);
  assert.equal(canEmailEstimate({ ...estimate, zone: 'South' }, scope), false);
  assert.equal(canEmailEstimate({ ...estimate, zone: 'South', created_by_id: 2 }, scope), false);
  assert.equal(canEmailEstimate({ ...estimate, zone: 'South', created_by_id: 2, created_by_role: 'manager' }, scope), true);
  assert.equal(canEmailEstimate({ ...estimate, zone: 'South', created_by_name: 'manager@example.test' }, scope), true);
  assert.equal(canEmailEstimate({ ...estimate, zone: 'South' }, { ...scope, zones: ['__ALL__'] }), true);
  assert.equal(canEmailEstimate({ ...estimate, franchise_partner_id: 9 }, { ...scope, zones: ['__ALL__'] }), false);
});

test('legacy editors identify configured-service snapshots without blocking ordinary legacy estimates', async () => {
  const frontend = await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  for (const record of [{ estimate_type: 'custom' }, { addons: [addon] }, { addons_data: JSON.stringify([addon]) }]) {
    assert.equal(hasCatalogServices(record), true);
    assert.equal(frontend.hasCatalogServices(record), true);
  }
  assert.equal(hasCatalogServices({ addons: [{ id: 1, price: 100 }] }), false);
  assert.equal(frontend.hasCatalogServices({ addons: [{ id: 1, price: 100 }] }), false);
  const property = normalizeEstimateData({ estimate_type: 'custom', zone: 'Joined wrong source', total_units: 999,
    addons: [{ ...addon, propertySnapshot: { zone: 'Saved Zone', total_units: 4 } }] });
  assert.equal(property.zone, 'Saved Zone');
  assert.equal(property.total_units, 4);
});

test('legacy enrichment fills only missing service fields and never replaces catalog snapshots', () => {
  const candidates = [{ id: 5, service_name: 'Cleaning', property_type: 'APT', description: 'Shared areas', frequency_type: 'Quarterly', frequency_count: 4 }];
  const row = enrichLegacyEstimateAddon({ id: 5, name: 'Cleaning', price: 500 }, candidates, 'Apartment');
  assert.equal(row.frequency_type, 'Quarterly');
  assert.equal(row.frequency_count, 4);
  assert.equal(row.description, 'Shared areas');
  assert.equal(row.price, 500);
  assert.equal(enrichLegacyEstimateAddon({ ...row, frequency_count: 7 }, candidates, 'APT').frequency_count, 7);
  assert.equal(enrichLegacyEstimateAddon(addon, candidates, 'APT'), addon);
  assert.equal(normalizeEstimateService({ name: 'No description' }).description, '');
  assert.deepEqual(normalizeEstimateData({ services: { services: {} } }).services, []);
});

test('frontend display and PDF helpers use saved totals and customer-safe descriptions', async () => {
  const { getEstimateAddons, getAddonPrice, getServiceDescription } = await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  const row = normalizeEstimateService(addon);
  assert.equal(getAddonPrice(addon), 11960.25);
  assert.equal(getAddonPrice({ price: 0, totalPrice: 500 }), 0);
  assert.equal(getAddonPrice({ services: [{ price: 100, frequency: 4 }] }), 400);
  assert.match(getServiceDescription(row), /75 KVA/);
  assert.doesNotMatch(getServiceDescription(row), /9200|2300|operating_cost|markup_percentage|profit/);
  assert.equal(getEstimateAddons({ addons: JSON.stringify([row]) }).length, 1);
  assert.equal(getEstimateAddons({ addons: [], addons_data: JSON.stringify([row]) }).length, 1);
  assert.deepEqual(getEstimateAddons({ addons: 'invalid' }), []);
});

test('every pricing method describes itself with category, primary input, unit and property types', async () => {
  const { getServiceDescription, getServiceMarkup } = await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  // The label each method carries in the internal line, and which the customer copy drops
  const METHOD_LABEL = { capacity_slab: 'Capacity Slab', area_based: 'Area Based', quantity_based: 'Quantity Based',
    capacity_based: 'Capacity Based', manpower: 'Manpower', fixed_price: 'Fixed Price' };
  // The snapshot a saved estimate holds is the whole validated configuration plus its quote
  const snapshot = { category: 'Generator', default_markup_percentage: 30, applicable_property_types: ['APT', 'GC'] };
  const services = {
    'capacity_slab': [{ name: 'Generator', unit: 'KVA', inputs: { capacity: 75 }, slabs: [{ capacityFrom: 51, capacityTo: 100, vendorRate: 2300 }] },
      ['Generator', 'Capacity Slab', 'Primary Input: Generator Capacity', 'Capacity: 75 KVA', 'Slab: 51–100 KVA']],
    'area_based': [{ name: 'Landscape', unit: 'Sq Ft', inputs: { area: 10000 } },
      ['Area Based', 'Primary Input: Area', 'Area: 10000 Sq Ft']],
    'quantity_based': [{ name: 'Camera Maintenance', unit: 'Camera', inputs: { quantity: 10 } },
      ['Quantity Based', 'Primary Input: Camera Maintenance Quantity', 'Quantity: 10 Camera']],
    'capacity_based': [{ name: 'Tank Cleaning', unit: 'KL', inputs: { capacity: 20 } },
      ['Capacity Based', 'Primary Input: Tank Cleaning Capacity', 'Capacity: 20 KL']],
    'manpower': [{ name: 'Housekeeping', unit: 'Persons', inputs: { personnel: 2 } },
      ['Manpower', 'Primary Input: Headcount', 'Personnel: 2 Persons']],
    // Nothing is measured on a fixed price, so its billing unit is the input and is still stated
    'fixed_price': [{ name: 'Pest Control', unit: 'Visit', inputs: {} }, ['Fixed Price', 'Primary Input: Visit']]
  };
  for (const [method, [service, expected]] of Object.entries(services)) {
    const saved = { catalogServiceId: 1, name: service.name, totalPrice: 1000,
      pricingInputs: { ...service.inputs, frequency: 'Quarterly', visits: 4, markup_percentage: 30 },
      pricingSnapshot: { ...snapshot, pricing_method: method, unit: service.unit, ...(service.slabs ? { capacity_slabs: service.slabs } : {}) } };
    const row = normalizeEstimateService(saved);
    for (const text of [...expected, 'Property Types: Apartment, Gated Community']) {
      assert.ok(row.details.includes(text), `${method}: ${text}`);
    }
    // The frontend twin builds the same line, so a modal, a PDF and the API agree
    assert.equal(getServiceDescription(saved), row.serviceDetails, method);
    // Markup is available to the staff screens but is not part of what a customer reads
    assert.equal(getServiceMarkup(saved), 30, method);
    assert.equal(row.markupPercentage, 30, method);
    assert.doesNotMatch(row.details, /markup|Markup/, method);
    const customer = customerEstimateData({ estimateType: 'custom', addons: [saved], total: 1000 });
    assert.doesNotMatch(JSON.stringify(customer), /markup|default_markup_percentage|2300/i, method);
    // How the service is priced, its derived input and the types it is configured for stay ours,
    // including when a saved row already carries them in its own details
    for (const internal of [METHOD_LABEL[method], 'Primary Input', 'Property Types']) {
      if (internal) assert.ok(!customer.addons[0].description.includes(internal), `${method}: ${internal}`);
    }
    // The category belongs with the service name, so it travels as its own field and is not part
    // of the description a customer document prints in its Description column
    assert.equal(customer.addons[0].category, row.category, method);
    assert.ok(!customer.addons[0].description.includes(row.category), `${method}: category in description`);
    // Re-normalizing a saved row must not change or duplicate the line
    assert.equal(normalizeEstimateService(row).details, row.details, method);
  }
});

test('manpower snapshots retain role, range and hours without disclosing rates or internal costs', async () => {
  const { getServiceDescription } = await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  const service = { catalogServiceId: 9, name: 'Housekeeping', description: 'Clean common areas', totalPrice: 15912,
    pricingInputs: { personnel: 2, area: 1500, frequency: 'Monthly', visits: 12, working_hours_per_visit: 2, overtime_hours_per_visit: 1,
      manpower_range: { areaFrom: 1001, areaTo: 2000, recommendedMin: 2, recommendedMax: 3 }, operating_cost: 876.54 },
    pricingSnapshot: { pricing_method: 'manpower', unit: 'Persons', manpower_basis: 'per_visit', role_designation: 'Housekeeping Staff',
      rate_per_person: 450, overtime_rate_per_hour: 60, minimum_manpower: 1, vendorCost: 12240, profit: 3672 } };
  const row = normalizeEstimateService(service);
  for (const text of ['Housekeeping Staff', 'Personnel: 2 Persons', 'Area: 1500 Sq Ft', '1001–2000 Sq Ft', 'Included Hours: 2', 'Overtime Hours: 1']) {
    assert.ok(row.details.includes(text), text);
    assert.ok(getServiceDescription(service).includes(text), text);
  }
  const customer = customerEstimateData({ estimateType: 'custom', addons: [service], total: 15912 });
  assert.equal(customer.addons[0].frequencyCount, 12);
  assert.doesNotMatch(JSON.stringify(customer), /rate_per_person|overtime_rate_per_hour|vendorCost|operating_cost|876.54|profit/);
  assert.equal(normalizeEstimateService(row).details, row.details);
});

test('a hand-entered service keeps an entered vendor cost and markup, bounded like its price', () => {
  // Vendor cost and markup are the same two figures a catalog service's snapshot holds, so a
  // costed typed row prices like any other service on the internal screens and the margins panel
  const row = normalizeManualService({ name: 'Tank Cleaning', description: '2 tanks', price: 5200,
    vendorCost: 4000, markup_percentage: 30, frequency_type: 'Quarterly', frequency_count: 4 });
  assert.equal(row.customService, true);
  assert.equal(row.vendorCost, 4000);
  assert.equal(row.markup_percentage, 30);

  // Optional both ways: absent and blank store nothing, and the camelCase spellings the dialog
  // sends are accepted too
  const uncosted = normalizeManualService({ name: 'A', price: 100 });
  assert.equal('vendorCost' in uncosted, false);
  assert.equal('markup_percentage' in uncosted, false);
  const camel = normalizeManualService({ name: 'A', price: 110, vendorCost: 100, markupPercentage: 10 });
  assert.equal(camel.markup_percentage, 10);

  // Out of bounds is a 400 like every other field's, not a stored figure
  for (const addon of [{ vendorCost: -5 }, { vendorCost: 1e9 }, { markup_percentage: 1200 }, { markup_percentage: -1 }]) {
    assert.throws(() => normalizeManualService({ name: 'A', price: 100, ...addon }), error => error.status === 400);
  }

  // And none of it reaches the customer: delivery carries name, details and price, never the cost
  const customer = customerEstimateData({ estimateType: 'custom', addons: [row], total: 5200 });
  assert.doesNotMatch(JSON.stringify(customer), /vendorCost|markup_percentage|4000|30/);
});

test('BILL TO headlines the property for a community, the customer for a home', () => {
  // GC and APT bill the property -- the customer drops to a Contact row
  for (const propertyType of ['GC', 'APT', 'Gated Community', 'apartment']) {
    const party = billToParty({ customerName: 'Sowjanya', propertyName: 'LKF Residency', propertyType });
    assert.equal(party.name, 'LKF Residency');
    assert.equal(party.contact, 'Sowjanya');
    assert.equal(party.property, '');
  }
  // Villa, flat and plot bill the person -- the property stays a row
  for (const propertyType of ['VILLA', 'FLAT', 'PLOT']) {
    const party = billToParty({ customerName: 'Sowjanya', propertyName: 'Villa 42', propertyType });
    assert.equal(party.name, 'Sowjanya');
    assert.equal(party.contact, '');
    assert.equal(party.property, 'Villa 42');
  }
  // A community estimate with no property name falls back to the customer, and snake_case rows work
  assert.equal(billToParty({ customer_name: 'Sowjanya', property_type: 'GC' }).name, 'Sowjanya');
  assert.equal(billToParty({ client_name: 'Sowjanya', property_name: 'LKF', property_type: 'APT' }).name, 'LKF');
});
