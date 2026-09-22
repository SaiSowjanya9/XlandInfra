const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateService, calculateServiceQuote, calculateEstimateSummary, primaryInputLabel, propertyTypeLabel,
  UNIT_TYPES, unitOptionsFor } = require('./servicePricing');

const config = (overrides = {}) => ({
  service_name: 'Generator Maintenance', category: 'Generator', pricing_method: 'fixed_price', unit: 'Visit',
  applicable_property_types: ['APT', 'GC'], default_frequency: 'Monthly', default_visits_per_year: 12,
  allow_frequency_override: true, allow_manual_visits: false, default_markup_percentage: 50,
  description: '', fixed_price: 100, ...overrides
});
const quote = (overrides, inputs = {}) => calculateServiceQuote(validateService(config(overrides)), { property_type: 'APT', ...inputs }, 'admin');

test('lift reference calculates slab, operating cost, customer price and profit exactly', () => {
  const lift = { pricing_method: 'capacity_slab', unit: 'Persons', default_markup_percentage: 35, capacity_slabs: [
    { capacityFrom: 1, capacityTo: 6, vendorRate: 500 },
    { capacityFrom: 7, capacityTo: 10, vendorRate: 750 },
    { capacityFrom: 11, capacityTo: 15, vendorRate: 1000 },
    { capacityFrom: 16, capacityTo: 20, vendorRate: 1250 },
    { capacityFrom: 21, capacityTo: null, isCustomQuote: true }
  ] };
  const result = quote(lift, { capacity: 10, operating_cost: 1800 });
  assert.equal(result.vendorRatePerVisit, 750);
  assert.equal(result.vendorCost, 9000);
  assert.equal(result.actualCost, 10800);
  assert.equal(result.totalPrice, 14580);
  assert.equal(result.profit, 3780);
  assert.equal(result.marginPercentage, 25.93);
  assert.equal(calculateEstimateSummary([result]).gst, 2624);
  assert.equal(calculateEstimateSummary([result]).total, 17204);
  assert.equal(quote(lift, { capacity: 21 }).requiresCustomQuote, true);
  assert.throws(() => quote(lift, { capacity: 0 }), /below the first/i);
  assert.equal(calculateEstimateSummary([result], 50).profit, -3510);
  assert.equal(quote(lift, { capacity: 10, markup_percentage: 0 }).profit, 0);
  assert.throws(() => quote(lift, { capacity: 10, operating_cost: -1 }), /operating cost/i);
});

test('fixed-price reference charges per visit with markup on vendor and operating costs', () => {
  const fixed = { fixed_price: 1000, default_markup_percentage: 35 };
  const result = quote(fixed);
  assert.equal(result.visits, 12);
  assert.equal(result.vendorRatePerVisit, 1000);
  assert.equal(result.vendorCost, 12000);
  assert.equal(result.totalPrice, 16200);
  assert.equal(result.profit, 4200);
  assert.equal(result.marginPercentage, 25.93);
  assert.equal(quote(fixed, { operating_cost: 1000 }).totalPrice, 17550);
  assert.equal(quote(fixed, { frequency: 'Quarterly' }).vendorCost, 4000);
  assert.equal(quote(fixed, { frequency: 'One-time' }).vendorCost, 1000);
  assert.equal(quote({ ...fixed, allow_manual_visits: true }, { visits: 5 }).vendorCost, 5000);
  assert.equal(quote(fixed, { markup_percentage: 0 }).profit, 0);
  assert.equal(quote(fixed, { capacity: 75, area: 10000, quantity: 5 }).vendorCost, 12000);
  assert.throws(() => quote({ ...fixed, allow_frequency_override: false }, { frequency: 'Quarterly' }), /frequency override/i);
  assert.throws(() => quote(fixed, { visits: 5 }), /manual visits/i);
});

test('quantity-based camera reference applies rate times quantity times visits', () => {
  const camera = { pricing_method: 'quantity_based', unit: 'Camera', rate_per_quantity: 250,
    default_frequency: 'Quarterly', default_visits_per_year: 4, default_markup_percentage: 35 };
  const result = quote(camera, { quantity: 10 });
  assert.equal(result.vendorCost, 10000);
  assert.equal(result.totalPrice, 13500);
  assert.equal(result.profit, 3500);
  assert.equal(result.marginPercentage, 25.93);
  assert.equal(quote(camera, { quantity: 10, operating_cost: 1000 }).totalPrice, 14850);
  assert.equal(quote(camera, { quantity: 10, frequency: 'Monthly' }).vendorCost, 30000);
  assert.equal(quote({ ...camera, allow_manual_visits: true }, { quantity: 10, visits: 5 }).vendorCost, 12500);
  assert.equal(quote(camera, { quantity: 10, markup_percentage: 0 }).totalPrice, 10000);
  for (const quantity of [undefined, '', 0, -1, 1.5, Infinity]) assert.throws(() => quote(camera, { quantity }), /quantity/i);
  assert.throws(() => quote({ ...camera, allow_frequency_override: false }, { quantity: 10, frequency: 'Monthly' }), /frequency override/i);
  assert.throws(() => quote(camera, { quantity: 10, visits: 5 }), /manual visits/i);
  for (const unit of [...unitOptionsFor('quantity_based'), 'Units', 'Lifts', 'Pumps', 'Tanks']) assert.equal(quote({ ...camera, unit }, { quantity: 10 }).vendorCost, 10000, unit);
});

const manpower = { pricing_method: 'manpower', unit: 'Persons', manpower_basis: 'per_visit', rate_per_person: 450,
  working_hours_per_visit: 2, overtime_rate_per_hour: 60, minimum_manpower: 1, role_designation: 'Housekeeping Staff', default_markup_percentage: 30,
  manpower_ranges: [
    { areaFrom: 0, areaTo: 1000, recommendedMin: 1, recommendedMax: 1, ratePerPerson: 450 },
    { areaFrom: 1001, areaTo: 2000, recommendedMin: 2, recommendedMax: 2, ratePerPerson: 450 },
    { areaFrom: 2001, areaTo: 4000, recommendedMin: 3, recommendedMax: 4, ratePerPerson: 425 },
    { areaFrom: 4001, areaTo: null, recommendedMin: 4, recommendedMax: 6, ratePerPerson: 400 }
  ] };

test('visit-based manpower applies the area range and suggests headcount without multiplying regular hours', () => {
  const result = quote(manpower, { area: 1500 });
  assert.equal(result.inputs.personnel, 2);
  assert.equal(result.vendorCost, 10800);
  assert.equal(result.totalPrice, 14040);
  assert.equal(result.inputs.working_hours_per_visit, 2);
  assert.deepEqual(result.inputs.manpower_range, { areaFrom: 1001, areaTo: 2000, recommendedMin: 2, recommendedMax: 2 });
  assert.equal(quote(manpower, { area: 3000 }).vendorCost, 15300);
  assert.equal(quote(manpower, { area: 5000 }).vendorCost, 19200);
  assert.equal(quote(manpower, { area: 3000, personnel: 4 }).vendorCost, 20400);
  assert.equal(quote(manpower, { area: 3000, personnel: 2 }).vendorCost, 10200);
  assert.equal(quote(manpower, { area: 3000, rate_per_person: 1, manpower_range: {} }).vendorCost, 15300);
  assert.equal(quote(manpower, { area: 1500, frequency: 'Quarterly' }).vendorCost, 3600);
  assert.equal(quote(manpower, { area: 1500, operating_cost: 1000 }).totalPrice, 15340);
});

test('manpower range boundaries, missing areas, minimum headcount and overtime are validated', () => {
  for (const [area, people] of [[1, 1], [1000, 1], [1001, 2], [2000, 2], [2001, 3], [4000, 3], [4001, 4]]) assert.equal(quote(manpower, { area }).inputs.personnel, people);
  for (const area of [undefined, '', 0, -1, 1000.5]) assert.throws(() => quote(manpower, { area }), /area/i);
  for (const personnel of [0, -1, 1.5]) assert.throws(() => quote(manpower, { area: 1500, personnel }), /personnel/i);
  assert.equal(quote(manpower, { area: 1500, overtime_hours_per_visit: 1 }).vendorCost, 12240);
  assert.throws(() => quote(manpower, { area: 1500, overtime_hours_per_visit: 23 }), /overtime/i);
  assert.throws(() => quote({ ...manpower, overtime_rate_per_hour: null }, { area: 1500, overtime_hours_per_visit: 1 }), /overtime/i);
  assert.equal(quote({ ...manpower, manpower_ranges: [] }, { personnel: 2 }).vendorCost, 10800);
  assert.throws(() => quote({ ...manpower, manpower_ranges: [], minimum_manpower: 2 }, { personnel: 1 }), /personnel/i);
  assert.throws(() => quote({ ...manpower, manpower_ranges: manpower.manpower_ranges.slice(0, 1) }, { area: 2000 }), /range/i);
});

test('manpower template rejects gaps, overlaps, invalid recommendations and invalid rates', () => {
  for (const ranges of [
    [{ ...manpower.manpower_ranges[0], areaFrom: 2 }],
    [manpower.manpower_ranges[0], { ...manpower.manpower_ranges[1], areaFrom: 1000 }],
    [manpower.manpower_ranges[0], { ...manpower.manpower_ranges[1], areaFrom: 1002 }],
    [{ ...manpower.manpower_ranges[0], recommendedMin: 3, recommendedMax: 2 }],
    [{ ...manpower.manpower_ranges[0], ratePerPerson: -1 }],
    [{ ...manpower.manpower_ranges[0], areaTo: null }, manpower.manpower_ranges[1]]
  ]) assert.throws(() => validateService(config({ ...manpower, manpower_ranges: ranges })), /range/i);
  for (const overrides of [{ manpower_basis: 'invalid' }, { working_hours_per_visit: 25 }, { minimum_manpower: 0 }, { rate_per_person: '' }, { overtime_rate_per_hour: -1 }]) assert.throws(() => validateService(config({ ...manpower, ...overrides })));
});

test('existing monthly manpower remains monthly after validation and does not use visit multipliers', () => {
  const legacy = { pricing_method: 'manpower', unit: 'Guards', monthly_rate: 10000, period_months: 12, billing_period: 'Monthly' };
  const result = quote(legacy, { personnel: 2, frequency: 'Quarterly' });
  assert.equal(result.vendorCost, 240000);
  assert.equal(validateService(config(legacy)).manpower_basis, 'monthly');
  assert.equal(calculateServiceQuote(config(legacy), { property_type: 'APT', personnel: 2 }, 'admin').vendorCost, 240000);
});

test('frontend manpower preview and headcount suggestions match backend pricing', async () => {
  const { previewManpower, suggestedManpower, findManpowerRange } = await import('../../admin-portal/src/utils/manpowerPricing.js');
  const service = validateService(config(manpower));
  for (const input of [{ area: 750 }, { area: 1500 }, { area: 3000, personnel: 4 }, { area: 5000, overtime_hours_per_visit: 1 }]) {
    const preview = previewManpower(service, input);
    const result = quote(manpower, input);
    assert.equal(preview.error, undefined);
    assert.equal(preview.vendorCost, result.vendorCost);
    assert.equal(preview.customerPrice, result.totalPrice);
    assert.equal(preview.personnel, result.inputs.personnel);
  }
  assert.equal(suggestedManpower(service, 3000), 3);
  assert.equal(findManpowerRange(service.manpower_ranges, ''), undefined);
  assert.equal(findManpowerRange(service.manpower_ranges, 1e9 + 1), undefined);
  assert.ok(previewManpower(service, { area: '', personnel: 2 }).error);
  assert.ok(previewManpower(service, { area: 1500, personnel: 0 }).error);
  assert.ok(previewManpower(service, { area: 1500, overtime_hours_per_visit: 23 }).error);
  assert.ok(previewManpower({ ...service, overtime_rate_per_hour: null }, { area: 1500, overtime_hours_per_visit: 1 }).error);
});

test('all six methods calculate vendor cost and marked-up customer totals', () => {
  const cases = [
    [{}, {}, 1200],
    [{ pricing_method: 'quantity_based', unit: 'Lifts', rate_per_quantity: 125.5 }, { quantity: 3 }, 4518],
    [{ pricing_method: 'area_based', unit: 'Sq Ft', rate_per_unit: 1.2 }, { area: 10000 }, 144000],
    [{ pricing_method: 'capacity_based', unit: 'KL', rate_per_capacity: 100 }, { capacity: 2.5 }, 3000],
    [{ pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [{ capacityFrom: 0, capacityTo: 25, vendorRate: 2000, isCustomQuote: false }, { capacityFrom: 26, capacityTo: null, vendorRate: null, isCustomQuote: true }] }, { capacity: 25 }, 24000],
    [{ pricing_method: 'manpower', unit: 'Guards', monthly_rate: 10000, period_months: 12, billing_period: 'Quarterly' }, { personnel: 2 }, 240000]
  ];
  for (const [configuration, inputs, expected] of cases) {
    const result = quote(configuration, inputs);
    assert.equal(result.vendorCost, expected);
    assert.equal(result.totalPrice, expected * 1.5);
  }
});

test('a service carries its own XLAND operating cost into every estimate', async () => {
  const withCost = { fixed_price: 1000, default_markup_percentage: 35, default_operating_cost: 6000 };
  assert.equal(validateService(config(withCost)).default_operating_cost, 6000);
  // The estimate starts from the configured cost without being told
  const priced = quote(withCost);
  assert.equal(priced.vendorCost, 12000);
  assert.equal(priced.operatingCost, 6000);
  assert.equal(priced.actualCost, 18000);
  assert.equal(priced.totalPrice, 24300);
  assert.equal(priced.profit, 6300);
  assert.equal(priced.marginPercentage, 25.93);
  // An estimate may still override it, including back to nothing
  assert.equal(quote(withCost, { operating_cost: 0 }).totalPrice, 16200);
  assert.equal(quote(withCost, { operating_cost: 1000 }).actualCost, 13000);
  // Absent means zero, which is how services saved before the field behave
  assert.equal(validateService(config({ fixed_price: 1000 })).default_operating_cost, 0);
  assert.equal(quote({ fixed_price: 1000 }).operatingCost, 0);
  for (const value of [-1, 'abc', 1e10]) assert.throws(() => validateService(config({ ...withCost, default_operating_cost: value })), /operating cost/i, String(value));

  // The manpower preview shown while configuring must agree with the server, operating cost included
  const { previewManpower } = await import('../../admin-portal/src/utils/manpowerPricing.js');
  const service = validateService(config({ ...manpower, default_operating_cost: 5000 }));
  const preview = previewManpower(service, { area: 1500 });
  const result = calculateServiceQuote(service, { property_type: 'APT', area: 1500 }, 'admin');
  assert.equal(preview.operatingCost, 5000);
  assert.equal(preview.actualCost, result.actualCost);
  assert.equal(preview.customerPrice, result.totalPrice);
  assert.equal(preview.marginPercentage, result.marginPercentage);
});

test('a service can be arranged without a vendor on every pricing method', () => {
  const methods = {
    fixed_price: { fixed_price: 100 },
    quantity_based: { pricing_method: 'quantity_based', unit: 'Nos', rate_per_quantity: 50 },
    area_based: { pricing_method: 'area_based', unit: 'Sq Ft', rate_per_unit: 2 },
    capacity_based: { pricing_method: 'capacity_based', unit: 'KL', rate_per_capacity: 10 },
    capacity_slab: { pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [{ capacityFrom: 1, capacityTo: null, vendorRate: 500 }] },
    manpower: { ...manpower }
  };
  for (const [method, overrides] of Object.entries(methods)) {
    // Off by default, and absent on services saved before the toggle, which behave the same way
    assert.equal(validateService(config(overrides)).skip_vendor_assignment, false, method);
    const vendorless = validateService(config({ ...overrides, skip_vendor_assignment: true }));
    assert.equal(vendorless.skip_vendor_assignment, true, method);
    // Switching it on changes nothing else about the service: it still prices exactly the same
    const priced = calculateServiceQuote(vendorless, { property_type: 'APT', capacity: 75, area: 1500, quantity: 10 }, 'admin');
    const unchanged = calculateServiceQuote(validateService(config(overrides)), { property_type: 'APT', capacity: 75, area: 1500, quantity: 10 }, 'admin');
    assert.equal(priced.totalPrice, unchanged.totalPrice, method);
    assert.throws(() => validateService(config({ ...overrides, skip_vendor_assignment: 'yes' })), /true or false/, method);
  }
});

test('primary input is derived from the service and its pricing method, never entered', async () => {
  // Service, method, unit, expected primary input
  const cases = [
    ['Generator', 'capacity_slab', 'KVA', 'Generator Capacity'],
    ['Generator', 'capacity_based', 'KL', 'Generator Capacity'],
    ['Generator Capacity', 'capacity_based', 'KVA', 'Generator Capacity'],
    ['Landscape', 'area_based', 'Sq Ft', 'Area'],
    ['Camera Maintenance', 'quantity_based', 'Camera', 'Camera Maintenance Quantity'],
    ['Housekeeping', 'manpower', 'Persons', 'Headcount'],
    ['Pest Control', 'fixed_price', 'Visit', 'Visit'],
    ['Pest Control', 'fixed_price', 'Job', 'Job'],
    // Retired methods still describe services saved before they were withdrawn
    ['Painting', 'fixed_visit_custom', 'Visit', 'Visit'],
    ['Painting', 'custom_quote', '', 'Quote'],
    // A missing service name leaves the dimension on its own; an unknown method has no input
    ['', 'capacity_based', 'KL', 'Capacity'],
    ['Anything', 'not_a_method', 'Unit', '']
  ];
  for (const [name, method, unit, expected] of cases) {
    assert.equal(primaryInputLabel(name, method, unit), expected, `${name || '(no name)'} / ${method}`);
  }
  // Every pricing method resolves an input, so no service is left without one
  for (const method of ['fixed_price', 'quantity_based', 'area_based', 'capacity_based', 'capacity_slab', 'manpower']) {
    assert.ok(primaryInputLabel('Service', method, 'Visit'), method);
  }
  assert.equal(propertyTypeLabel('GC'), 'Gated Community');
  assert.equal(propertyTypeLabel('IH'), 'Independent House');
  assert.equal(propertyTypeLabel('Apartment'), 'Apartment');
  // The frontend twin must agree, or a modal and a PDF would disagree with the API
  const { primaryInputLabel: frontend } = await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  for (const [name, method, unit, expected] of cases) assert.equal(frontend(name, method, unit), expected, `frontend ${method}`);
});

test('the frequency list matches the agreed visit counts, including On Request', () => {
  const expected = [['On Request', 0], ['Monthly', 12], ['Every 2 Months', 6], ['Quarterly', 4], ['Every 4 Months', 3],
    ['Half Yearly', 2], ['Yearly', 1], ['Weekly', 52], ['Bi-Weekly', 26]];
  for (const [frequency, visits] of expected) {
    const service = config({ default_frequency: frequency, default_visits_per_year: visits });
    assert.equal(validateService(service).default_visits_per_year, visits, frequency);
    assert.equal(quote({ default_frequency: frequency, default_visits_per_year: visits }).visits, visits, frequency);
  }
  // Zero visits belong to On Request alone
  assert.throws(() => validateService(config({ default_frequency: 'Monthly', default_visits_per_year: 0, allow_manual_visits: true })), /at least 1 for Monthly/i);
  assert.throws(() => quote({ default_frequency: 'Weekly', default_visits_per_year: 52, allow_manual_visits: true }, { visits: 0 }), /at least 1 for Weekly/i);
  // An On Request service costs nothing until it is requested, and must not divide by zero
  const onRequest = quote({ default_frequency: 'On Request', default_visits_per_year: 0, fixed_price: 1000 });
  assert.equal(onRequest.visits, 0);
  assert.equal(onRequest.vendorCost, 0);
  assert.equal(onRequest.vendorRatePerVisit, 0);
  assert.equal(Number.isFinite(onRequest.totalPrice), true);
  // Weekly multiplies by 52
  assert.equal(quote({ default_frequency: 'Weekly', default_visits_per_year: 52, fixed_price: 100 }).vendorCost, 5200);
  assert.throws(() => validateService(config({ default_frequency: 'Fortnightly', default_visits_per_year: 26 })), /valid default frequency/i);
});

test('frequencies retired from the list still validate and price saved services', () => {
  for (const [frequency, visits] of [['Half-Yearly', 2], ['One-time', 1]]) {
    assert.equal(validateService(config({ default_frequency: frequency, default_visits_per_year: visits })).default_frequency, frequency);
    assert.equal(quote({ default_frequency: frequency, default_visits_per_year: visits }).visits, visits);
  }
});

const METHOD_RATES = {
  fixed_price: { fixed_price: 100 }, quantity_based: { rate_per_quantity: 50 }, area_based: { rate_per_unit: 2 },
  capacity_based: { rate_per_capacity: 10 }, capacity_slab: { capacity_slabs: [{ capacityFrom: 1, capacityTo: null, vendorRate: 500 }] },
  manpower: { manpower_basis: 'per_visit', rate_per_person: 450, working_hours_per_visit: 8, minimum_manpower: 2 }
};

test('the unit master offers each unit type to the methods that measure it', async () => {
  const expected = {
    count: ['Nos', 'Unit', 'Each', 'Lift', 'Camera', 'Tank', 'Generator', 'AC Unit', 'Motor', 'Pump', 'System', 'Flat', 'Villa', 'Plot', 'Room', 'Floor'],
    area: ['Sq Ft', 'Sq M', 'Sq Yard', 'Acre'],
    capacity: ['KL', 'Liter', 'LPH', 'KVA', 'kW', 'HP', 'Ton', 'KG', 'Persons'],
    manpower: ['Person', 'Staff', 'Guard', 'Worker', 'Technician', 'Housekeeper', 'Supervisor'],
    billing: ['Visit', 'Hour', 'Day', 'Shift', 'Month', 'Year'],
    general: ['Job', 'Service', 'Package', 'Lot', 'Lump Sum']
  };
  assert.deepEqual(Object.fromEntries(UNIT_TYPES.map(({ type, units }) => [type, units])), expected);
  // A unit belongs to exactly one type, so no dropdown can list it twice
  const allUnits = UNIT_TYPES.flatMap(item => item.units);
  assert.equal(new Set(allUnits).size, allUnits.length);
  // Each method offers its own types and nothing else; Fixed Price still bills per visit, service or job
  assert.deepEqual(unitOptionsFor('fixed_price'), ['Visit', 'Service', 'Job']);
  assert.deepEqual(unitOptionsFor('quantity_based'), expected.count);
  assert.deepEqual(unitOptionsFor('area_based'), expected.area);
  assert.deepEqual(unitOptionsFor('capacity_based'), expected.capacity);
  assert.deepEqual(unitOptionsFor('capacity_slab'), expected.capacity);
  assert.deepEqual(unitOptionsFor('manpower'), [...expected.manpower, ...expected.billing]);
  assert.deepEqual(unitOptionsFor('not_a_method'), []);
  // Every offered unit saves, and a unit belonging to another type is rejected
  for (const [method, overrides] of Object.entries(METHOD_RATES)) {
    for (const unit of unitOptionsFor(method)) {
      assert.equal(validateService(config({ pricing_method: method, unit, ...overrides })).unit, unit, `${method} / ${unit}`);
    }
    const foreign = allUnits.find(unit => !unitOptionsFor(method).includes(unit));
    assert.throws(() => validateService(config({ pricing_method: method, unit: foreign, ...overrides })), /valid pricing method and unit/i, method);
  }
  // The frontend twin must offer exactly the same units, or the form would offer one the API rejects
  const frontend = await import('../../admin-portal/src/utils/estimatePackageUtils.js');
  assert.deepEqual(frontend.UNIT_TYPES, UNIT_TYPES);
  for (const method of [...Object.keys(METHOD_RATES), 'not_a_method']) {
    assert.deepEqual(frontend.unitOptionsFor(method), unitOptionsFor(method), `frontend ${method}`);
    // Grouped for the dropdown, the same options appear under their unit type labels
    const grouped = frontend.unitGroupsFor(method);
    assert.deepEqual(grouped.flatMap(group => group.units).sort(), unitOptionsFor(method).slice().sort(), `grouped ${method}`);
    assert.ok(grouped.every(group => group.label), `labelled ${method}`);
  }
});

test('plural unit labels withdrawn from the dropdown still validate saved services', () => {
  const retired = { quantity_based: ['Units', 'Lifts', 'Pumps', 'Tanks'], area_based: ['Acres'],
    capacity_based: ['Liters', 'KW'], capacity_slab: ['Liters', 'KW'], manpower: ['Persons', 'Guards', 'Personnel'] };
  for (const [method, units] of Object.entries(retired)) {
    for (const unit of units) {
      assert.equal(validateService(config({ pricing_method: method, unit, ...METHOD_RATES[method] })).unit, unit, `${method} / ${unit}`);
      // Withdrawn means absent from the dropdown, not rejected on save
      assert.equal(unitOptionsFor(method).includes(unit), false, `${method} / ${unit} still offered`);
    }
  }
});

test('retired methods cannot be saved but still price services stored before they were removed', () => {
  for (const retired of [{ pricing_method: 'fixed_visit_custom', unit: 'Visit', visit_charge: 500, custom_work_rate: 1000 },
    { pricing_method: 'custom_quote', unit: 'Quote' }]) {
    assert.throws(() => validateService(config(retired)), /valid pricing method and unit/i);
  }
  const savedVisitCustom = { ...config({ pricing_method: 'fixed_visit_custom', unit: 'Visit', visit_charge: 500, custom_work_rate: 1000 }), default_visits_per_year: 12 };
  assert.equal(calculateServiceQuote(savedVisitCustom, { property_type: 'APT' }, 'admin').vendorCost, 7000);
  const savedCustomQuote = config({ pricing_method: 'custom_quote', unit: 'Quote' });
  assert.equal(calculateServiceQuote(savedCustomQuote, { property_type: 'APT' }, 'admin').requiresCustomQuote, true);
  assert.equal(calculateServiceQuote(savedCustomQuote, { property_type: 'APT', custom_quote: 4000 }, 'admin').vendorCost, 4000);
});

test('area-based reference uses rate, area and visits with markup on actual cost', () => {
  const areaService = { pricing_method: 'area_based', unit: 'Sq Ft', rate_per_unit: 1.2,
    default_frequency: 'Every 2 Months', default_visits_per_year: 6, default_markup_percentage: 40 };
  const result = quote(areaService, { area: 10000 });
  assert.equal(result.visits, 6);
  assert.equal(result.vendorCost, 72000);
  assert.equal(result.totalPrice, 100800);
  assert.equal(result.profit, 28800);
  assert.equal(result.marginPercentage, 28.57);
  const withOperatingCost = quote(areaService, { area: 10000, operating_cost: 6000 });
  assert.equal(withOperatingCost.actualCost, 78000);
  assert.equal(withOperatingCost.totalPrice, 109200);
  assert.equal(withOperatingCost.profit, 31200);
  assert.equal(quote(areaService, { area: 10000, markup_percentage: 0 }).profit, 0);
  assert.equal(quote(areaService, { area: 10000, frequency: 'Quarterly' }).vendorCost, 48000);
  assert.equal(quote({ ...areaService, allow_manual_visits: true }, { area: 10000, visits: 5 }).vendorCost, 60000);
  assert.throws(() => quote({ ...areaService, allow_frequency_override: false }, { area: 10000, frequency: 'Yearly' }), /frequency override/i);
  for (const area of [undefined, '', 0, -1, Infinity]) assert.throws(() => quote(areaService, { area }), /area/i);
  for (const unit of ['Sq Ft', 'Sq M', 'Acres']) {
    assert.equal(quote({ ...areaService, unit }, { area: 10.25 }).vendorCost, 73.8);
  }
});

test('capacity-based reference multiplies rate by capacity and visits, not capacity slabs', () => {
  const capacityService = { pricing_method: 'capacity_based', unit: 'KL', rate_per_capacity: 450,
    default_frequency: 'Half-Yearly', default_visits_per_year: 2, default_markup_percentage: 30 };
  const result = quote(capacityService, { capacity: 10 });
  assert.equal(result.visits, 2);
  assert.equal(result.vendorCost, 9000);
  assert.equal(result.totalPrice, 11700);
  assert.equal(result.profit, 2700);
  assert.equal(result.marginPercentage, 23.08);
  const withOperatingCost = quote(capacityService, { capacity: 10, operating_cost: 1000 });
  assert.equal(withOperatingCost.actualCost, 10000);
  assert.equal(withOperatingCost.totalPrice, 13000);
  assert.equal(quote(capacityService, { capacity: 10, markup_percentage: 0 }).profit, 0);
  assert.equal(quote(capacityService, { capacity: 10, frequency: 'Quarterly' }).vendorCost, 18000);
  assert.equal(quote({ ...capacityService, allow_manual_visits: true }, { capacity: 10, visits: 3 }).vendorCost, 13500);
  assert.throws(() => quote({ ...capacityService, allow_frequency_override: false }, { capacity: 10, frequency: 'Yearly' }), /frequency override/i);
  assert.throws(() => quote(capacityService, { capacity: 10, visits: 3 }), /manual visits/i);
  for (const capacity of [undefined, '', 0, -1, Infinity]) assert.throws(() => quote(capacityService, { capacity }), /capacity/i);
  for (const unit of ['KL', 'Liters', 'KVA', 'KW']) {
    assert.equal(quote({ ...capacityService, unit }, { capacity: 2.5 }).vendorCost, 2250);
  }
});

test('frequency defaults and overrides determine visits without double multiplying manpower', () => {
  assert.equal(quote({}, { frequency: 'Quarterly' }).visits, 4);
  assert.equal(quote({}, { frequency: 'Every 2 Months' }).vendorCost, 600);
  assert.throws(() => quote({ allow_frequency_override: false }, { frequency: 'Yearly' }), /frequency override/i);
  assert.throws(() => quote({}, { visits: 5 }), /manual visits/i);
  assert.equal(quote({ allow_manual_visits: true, default_visits_per_year: 7 }).visits, 7);
  assert.equal(quote({ allow_manual_visits: true }, { visits: 5 }).vendorCost, 500);
});

test('slab boundaries are inclusive and above-range custom quotes are explicit', () => {
  const configuration = { pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [
    { capacityFrom: 0, capacityTo: 25, vendorRate: 20.75, isCustomQuote: false },
    { capacityFrom: 26, capacityTo: 50, vendorRate: 30, isCustomQuote: false },
    { capacityFrom: 51, capacityTo: null, vendorRate: null, isCustomQuote: true }
  ] };
  assert.equal(quote(configuration, { capacity: 25 }).vendorCost, 249);
  assert.equal(quote(configuration, { capacity: 26 }).vendorCost, 360);
  assert.equal(quote(configuration, { capacity: 51 }).requiresCustomQuote, true);
  assert.equal(quote(configuration, { capacity: 51, custom_quote: 800 }).vendorCost, 800);
  assert.throws(() => quote(configuration, { capacity: 25.5 }), /whole number/i);
  assert.throws(() => calculateServiceQuote(validateService(config(configuration)), { property_type: 'APT', capacity: 51, custom_quote: 800 }, 'supervisor'), /admin or manager/i);
});

test('generator slabs apply the matching rate and slab-specific frequency and visits', () => {
  const generator = { pricing_method: 'capacity_slab', unit: 'KVA', default_markup_percentage: 30, capacity_slabs: [
    { capacityFrom: 0, capacityTo: 25, vendorRate: 1200, defaultFrequency: 'Monthly', defaultVisitsPerYear: 12 },
    { capacityFrom: 26, capacityTo: 50, vendorRate: 1600, defaultFrequency: 'Half-Yearly', defaultVisitsPerYear: 2 },
    { capacityFrom: 51, capacityTo: 100, vendorRate: 2300, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 },
    { capacityFrom: 101, capacityTo: 200, vendorRate: 3400, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 },
    { capacityFrom: 201, capacityTo: null, vendorRate: 4800, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 }
  ] };
  const result = quote(generator, { capacity: 75 });
  assert.equal(result.frequency, 'Quarterly');
  assert.equal(result.visits, 4);
  assert.equal(result.vendorRatePerVisit, 2300);
  assert.equal(result.vendorCost, 9200);
  assert.equal(result.totalPrice, 11960);
  assert.equal(result.marginPercentage, 23.08);
  assert.equal(quote(generator, { capacity: 75, operating_cost: 800 }).totalPrice, 13000);
  for (const [capacity, cost] of [[0, 14400], [25, 14400], [26, 3200], [50, 3200], [51, 9200], [100, 9200], [101, 13600], [200, 13600], [201, 19200], [1000, 19200]]) {
    assert.equal(quote(generator, { capacity }).vendorCost, cost);
  }
  assert.equal(quote(generator, { capacity: 75, frequency: 'Yearly' }).vendorCost, 2300);
  assert.equal(quote({ ...generator, allow_frequency_override: false }, { capacity: 75 }).frequency, 'Quarterly');
  assert.throws(() => quote({ ...generator, allow_frequency_override: false }, { capacity: 75, frequency: 'Monthly' }), /frequency override/i);
  assert.throws(() => quote(generator, { capacity: 75, visits: 12 }), /manual visits/i);
  assert.equal(quote({ ...generator, allow_manual_visits: true }, { capacity: 75, visits: 5 }).vendorCost, 11500);
  const manual = { ...generator, allow_manual_visits: true, capacity_slabs: [{ capacityFrom: 0, capacityTo: 100, vendorRate: 100, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 7 }] };
  assert.equal(quote(manual, { capacity: 75 }).visits, 7);
  assert.equal(quote(manual, { capacity: 75, frequency: 'Monthly' }).visits, 12);
  const aboveRange = { ...generator, capacity_slabs: generator.capacity_slabs.slice(0, -1) };
  assert.equal(quote(aboveRange, { capacity: 201 }).requiresCustomQuote, true);
  const customSlab = { ...generator, capacity_slabs: [{ capacityFrom: 0, capacityTo: null, isCustomQuote: true, defaultFrequency: 'Quarterly', defaultVisitsPerYear: 4 }] };
  assert.equal(quote(customSlab, { capacity: 75 }).visits, 4);
  assert.equal(quote(customSlab, { capacity: 75, custom_quote: 1000 }).vendorCost, 1000);
});

test('slab schedules validate values and preserve legacy service-level defaults', () => {
  const slab = { capacityFrom: 0, capacityTo: 100, vendorRate: 100 };
  const service = { pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [slab] };
  const normalized = validateService(config(service));
  assert.equal(normalized.capacity_slabs[0].defaultFrequency, 'Monthly');
  assert.equal(normalized.capacity_slabs[0].defaultVisitsPerYear, 12);
  assert.equal(calculateServiceQuote(config(service), { property_type: 'APT', capacity: 75 }, 'admin').vendorCost, 1200);
  for (const fields of [{ defaultFrequency: 'Never' }, { defaultFrequency: '' }, { defaultFrequency: 'Quarterly', defaultVisitsPerYear: 12 }, { defaultVisitsPerYear: 0 }, { defaultVisitsPerYear: 367 }, { defaultVisitsPerYear: 1.5 }, { defaultVisitsPerYear: '' }]) {
    assert.throws(() => validateService(config({ ...service, capacity_slabs: [{ ...slab, ...fields }] })), /slab/i);
  }
  assert.equal(quote({ ...service, capacity_slabs: [{ ...slab, defaultFrequency: 'Quarterly' }] }, { capacity: 75 }).visits, 4);
});

test('invalid, overlapping, gapped, and premature open-ended slabs are rejected', () => {
  for (const slabs of [[],
    [{ capacityFrom: 0, capacityTo: 25, vendorRate: 1 }, { capacityFrom: 25, capacityTo: 50, vendorRate: 1 }],
    [{ capacityFrom: 0, capacityTo: 25, vendorRate: 1 }, { capacityFrom: 27, capacityTo: 50, vendorRate: 1 }],
    [{ capacityFrom: 0, capacityTo: null, vendorRate: 1 }, { capacityFrom: 26, capacityTo: 50, vendorRate: 1 }]
  ]) assert.throws(() => validateService(config({ pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: slabs })), /slab/i);
});

test('configuration rejects invalid names, percentages, property types, units, and rates', () => {
  for (const overrides of [
    { service_name: ' ' }, { category: '' }, { applicable_property_types: [] },
    { applicable_property_types: ['INVALID'] }, { fixed_price: -1 }, { fixed_price: '' },
    { fixed_price: Infinity }, { fixed_price: true }, { unit: 'KL' }, { pricing_method: 'unknown' },
    { default_frequency: 'Never' }, { default_visits_per_year: 3 }, { default_markup_percentage: -1 },
    { applicable_property_types: ['COMMERCIAL'] }, { allow_manual_visits: 'false' }
  ]) assert.throws(() => validateService(config(overrides)));
});

test('estimate inputs reject unsupported properties, missing quantity, zero visits and invalid quotes', () => {
  assert.throws(() => quote({}, { property_type: 'PLOT' }), /property type/i);
  assert.throws(() => quote({ pricing_method: 'quantity_based', unit: 'Lifts', rate_per_quantity: 1 }), /quantity/i);
  assert.throws(() => quote({ allow_manual_visits: true }, { visits: 0 }), /visits/i);
  const aboveSlab = { pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [{ capacityFrom: 0, capacityTo: 25, vendorRate: 100 }, { capacityFrom: 26, capacityTo: null, isCustomQuote: true }] };
  assert.throws(() => quote(aboveSlab, { capacity: 30, custom_quote: -1 }), /quote/i);
  assert.equal(quote(aboveSlab, { capacity: 30 }).requiresCustomQuote, true);
});
