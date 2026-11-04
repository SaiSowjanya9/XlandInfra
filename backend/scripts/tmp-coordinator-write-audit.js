/* Temporary: exercises every Coordinator portal write path the UI can trigger. Not committed. */
const BASE = 'http://127.0.0.1:5000';
const stamp = Date.now().toString().slice(-6);

const login = async (username, password) => {
  const r = await fetch(`${BASE}/api/employee/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.data?.token) throw new Error(`login failed ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return { token: j.data.token, user: j.data.user };
};

let TOKEN = null;
const call = async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: r.status, json, text: text.slice(0, 400) };
};

const log = (label, r, extra = '') => {
  const ok = r.status >= 200 && r.status < 300 && r.json?.success !== false;
  console.log(`${ok ? 'OK ' : '>>>'} ${r.status} ${label}${extra ? ' :: ' + extra : ''}${ok ? '' : ' :: ' + r.text.replace(/\s+/g, ' ').slice(0, 200)}`);
  return r;
};

(async () => {
  const { token, user } = await login(process.argv[2] || 'coordinator_admin', process.argv[3] || 'Password@123');
  TOKEN = token;
  console.log('LOGGED IN AS', user.username, '| role', user.role, '| fp', user.franchisePartnerId);
  console.log('='.repeat(100));

  // ---------- ZONES ----------
  const zoneName = `CRD-Zone-${stamp}`;
  log(`POST /zones (${zoneName})`, await call('POST', '/api/coordinator/zones', { name: zoneName }));
  const zonesAfter = await call('GET', '/api/coordinator/zones');
  log('GET /zones', zonesAfter, `${zonesAfter.json?.data?.length} rows; contains new = ${!!zonesAfter.json?.data?.some(z => z.name === zoneName)}`);

  // ---------- DIVISIONS ----------
  const divName = `CRD-Div-${stamp}`;
  log(`POST /divisions (${divName})`, await call('POST', '/api/coordinator/divisions', { name: divName }));
  const divs = await call('GET', '/api/coordinator/divisions');
  log('GET /divisions', divs, `${divs.json?.data?.length} rows; contains new = ${!!divs.json?.data?.some(d => d.name === divName)}`);

  // ---------- ADD CUSTOMER (property form, the sidebar's own entry) ----------
  const community = `CRD Community ${stamp}`;
  const custEmail = `crd-cust-${stamp}@example.com`;
  const custRes = log('POST /customers (property form)', await call('POST', '/api/coordinator/customers', {
    zone: zoneName, areaName: 'Audit Area', division: divName, propertyType: 'Gated Community',
    communityName: community, entryType: 'GC', category: 'residential',
    associationContacts: [{ name: `Audit Contact ${stamp}`, email: custEmail, phone: '9800000001', countryCode: '+91' }],
    numberOfBlocks: 2, unitsPerBlock: { 1: 10, 2: 12 }, blockNames: { 1: 'A', 2: 'B' }, blockUnitTypes: {},
    address: '1 Audit Street', city: 'Hyderabad', state: 'Telangana', postalCode: '500001',
    landmark: 'Near Park', mapLocation: { lat: 17.4, lng: 78.4, address: 'Hyd' }, notes: 'audit',
    watchmanName: 'Watchman', watchmanContact: '9800000002'
  }));
  const propertyCode = custRes.json?.data?.propertyId;

  // duplicate email must be refused with 409, nothing written
  log('POST /customers (duplicate email -> expect 409)', await call('POST', '/api/coordinator/customers', {
    zone: zoneName, communityName: `${community} dup`, entryType: 'GC', category: 'residential',
    associationContacts: [{ name: 'Dup', email: custEmail, phone: '9800000003', countryCode: '+91' }],
    address: 'x', city: 'y', state: 'z'
  }));

  const custList = await call('GET', '/api/coordinator/customers');
  const mine = (custList.json?.data || []).find(c => c.email === custEmail);
  log('GET /customers', custList, `${custList.json?.data?.length} rows; new row found = ${!!mine}; property_name = ${JSON.stringify(mine?.property_name)}; zone = ${JSON.stringify(mine?.zone)}`);

  // ---------- PROPERTIES ----------
  const props = await call('GET', '/api/coordinator/properties');
  const newProp = (props.json?.data || []).find(p => p.property_id === propertyCode);
  log('GET /properties', props, `${props.json?.data?.length} rows; created property present = ${!!newProp}; source = ${newProp?.source_table}; zone_name = ${JSON.stringify(newProp?.zone_name)}; units = ${newProp?.total_units}`);

  if (newProp) {
    log('PUT /properties/:id (rename + watchman)', await call('PUT', `/api/coordinator/properties/${newProp.id}`, {
      name: `${community} EDITED`, propertyType: newProp.property_type, address: '2 Audit Street',
      city: 'Hyderabad', state: 'Telangana', zipCode: '500002',
      contactPerson: `Audit Contact ${stamp}`, contactPhone: '9800000001', contactEmail: custEmail,
      zoneId: zoneName, divisionId: divName, areaName: 'Audit Area 2', isActive: true,
      sourceTable: newProp.source_table, watchmanName: 'Watchman Two', watchmanContact: '9800000009'
    }));
    const reread = await call('GET', '/api/coordinator/properties');
    const after = (reread.json?.data || []).find(p => p.property_id === propertyCode);
    log('GET /properties (persistence check)', reread, `name = ${JSON.stringify(after?.name)}; zip = ${after?.zip_code}; watchman = ${JSON.stringify(after?.watchman_name)}; area = ${JSON.stringify(after?.area)}`);

    log('POST /properties/:id/assign-vendor (UI offers this)', await call('POST', `/api/coordinator/properties/${newProp.id}/assign-vendor`, { vendorId: 1 }));
    log('POST /properties/:id/assign-employee (UI offers this)', await call('POST', `/api/coordinator/properties/${newProp.id}/assign-employee`, { employeeId: 1 }));
    log('DELETE /properties/:id', await call('DELETE', `/api/coordinator/properties/${newProp.id}`));

    // deactivate / reactivate, the list's Active/Inactive tabs
    log('PUT /properties/:id (isActive false)', await call('PUT', `/api/coordinator/properties/${newProp.id}`, { isActive: false, sourceTable: newProp.source_table }));
    const inactive = await call('GET', '/api/coordinator/properties?status=inactive');
    log('GET /properties?status=inactive', inactive, `contains property = ${!!(inactive.json?.data || []).find(p => p.property_id === propertyCode)}`);
    log('PUT /properties/:id (isActive true)', await call('PUT', `/api/coordinator/properties/${newProp.id}`, { isActive: true, sourceTable: newProp.source_table }));
  }

  // ---------- VENDORS ----------
  const vendorOwner = `Audit Vendor ${stamp}`;
  const vRes = log('POST /vendors', await call('POST', '/api/coordinator/vendors', {
    serviceType: 'Housekeeping', serviceVerified: true, zone: zoneName, areaName: 'Audit Area',
    ownerName: vendorOwner, ownerMobile: '9811111111', ownerEmail: `crd-vendor-${stamp}@example.com`,
    ownerAadhar: '111122223333', ownerCountryCode: '+91',
    managerName: 'VM', managerMobile: '9811111112', managerEmail: `crd-vm-${stamp}@example.com`, managerCountryCode: '+91',
    pocName: 'VP', pocMobile: '9811111113', pocEmail: `crd-vp-${stamp}@example.com`, pocCountryCode: '+91',
    ratePerVisit: '1500', coveragePerDay: '4', workingHoursFrom: '09:00', workingHoursTo: '18:00',
    createdBy: 'Field Coordinator'
  }));
  const vendorRowId = vRes.json?.data?.id;
  const vendors = await call('GET', '/api/coordinator/vendors');
  const vAll = vendors.json?.data?.all || [];
  log('GET /vendors', vendors, `all=${vAll.length} own=${vendors.json?.data?.own?.length} assigned=${vendors.json?.data?.assigned?.length}; new present = ${vAll.some(v => v.owner_name === vendorOwner)}`);
  if (vendorRowId) {
    log('PUT /vendors/:id (UI offers Edit)', await call('PUT', `/api/coordinator/vendors/${vendorRowId}`, { serviceType: 'Plumbing' }));
    log('DELETE /vendors/:id (UI offers Delete)', await call('DELETE', `/api/coordinator/vendors/${vendorRowId}`));
  }
  log('GET /export/vendors (UI Export button)', await call('GET', '/api/coordinator/export/vendors'));
  const assignments = await call('GET', '/api/coordinator/vendors/assignments');
  log('GET /vendors/assignments', assignments, `property=${assignments.json?.data?.propertyAssignments?.length} service=${assignments.json?.data?.serviceAssignments?.length}`);

  // ---------- EMPLOYEES (Employee Zone Management) ----------
  const emps = await call('GET', '/api/coordinator/employees');
  log('GET /employees', emps, `${emps.json?.data?.length} rows`);
  log('GET /employees/:id (UI View button)', await call('GET', '/api/coordinator/employees/1'));
  log('POST /employees (UI Add modal)', await call('POST', '/api/coordinator/employees', { firstName: 'X', email: 'x@y.com', phone: '9', role: 'coord_executive' }));
  log('PUT /employees/:id (UI Edit)', await call('PUT', '/api/coordinator/employees/1', { firstName: 'X' }));
  log('DELETE /employees/:id (UI Delete)', await call('DELETE', '/api/coordinator/employees/1'));
  log('GET /export/employees (UI Export button)', await call('GET', '/api/coordinator/export/employees'));

  // ---------- WORK ORDERS ----------
  const cats = await call('GET', '/api/coordinator/categories');
  const cat = (cats.json?.data || [])[0];
  const subcat = cat?.subcategories?.[0];
  let woId = null;
  if (newProp && cat) {
    const woRes = log('POST /work-orders', await call('POST', '/api/coordinator/work-orders', {
      propertyId: String(newProp.id), categoryId: String(cat.id), subcategoryId: String(subcat?.id || ''),
      categoryName: cat.name, subcategoryName: subcat?.name || '', customSubcategory: '',
      clientId: '', customerName: `Audit Contact ${stamp}`, customerEmail: custEmail, customerPhone: '9800000001',
      title: `Audit WO ${stamp}`, description: 'Created by the coordinator audit', priority: 'medium',
      permissionToEnter: 'yes', hasPet: 'no', entryNotes: 'Ring the bell', scheduledDate: '2026-12-01'
    }));
    woId = woRes.json?.data?.id;
  }
  const wos = await call('GET', '/api/coordinator/work-orders');
  const myWo = (wos.json?.data || []).find(w => w.id === woId);
  log('GET /work-orders', wos, `${wos.json?.data?.length} rows; new present = ${!!myWo}; property_name = ${JSON.stringify(myWo?.property_name)}; code = ${myWo?.work_order_id}`);
  if (woId) {
    log('PUT /work-orders/:id (edit)', await call('PUT', `/api/coordinator/work-orders/${woId}`, { title: `Audit WO ${stamp} EDITED`, description: 'edited', priority: 'high' }));
    log('PATCH /work-orders/:id/status (assigned)', await call('PATCH', `/api/coordinator/work-orders/${woId}/status`, { status: 'assigned', note: 'audit' }));
    log('PATCH /work-orders/:id/assign-vendor', await call('PATCH', `/api/coordinator/work-orders/${woId}/assign-vendor`, { vendorId: vendorRowId || 1 }));
    log('PATCH /work-orders/:id/assign-employee', await call('PATCH', `/api/coordinator/work-orders/${woId}/assign-employee`, { employeeId: 1 }));
    log('PATCH /work-orders/:id/status (completed)', await call('PATCH', `/api/coordinator/work-orders/${woId}/status`, { status: 'completed', closingNotes: 'done by audit' }));
    const done = await call('GET', '/api/coordinator/work-orders/completed');
    log('GET /work-orders/completed', done, `${done.json?.data?.length} rows; contains = ${!!(done.json?.data || []).find(w => w.id === woId)}`);
    const pend = await call('GET', '/api/coordinator/work-orders/pending');
    log('GET /work-orders/pending', pend, `${pend.json?.data?.length} rows`);
    log('GET /export/work-orders', await call('GET', '/api/coordinator/export/work-orders'));
  }

  // ---------- AMC PACKAGES ----------
  const pkgName = `Audit Package ${stamp}`;
  const pkgRes = log('POST /amc-packages', await call('POST', '/api/coordinator/amc-packages', {
    name: pkgName, property_type: 'Gated Community',
    services: [{ name: 'Pest Control', frequency_count: 12, frequency_type: 'Monthly' }, { name: 'Tank Cleaning', frequency_count: 4, frequency_type: 'Quarterly' }],
    price: 25000, billing_duration: 'yearly'
  }));
  const pkgId = pkgRes.json?.data?.id;
  const pkgs = await call('GET', '/api/coordinator/amc-packages');
  log('GET /amc-packages', pkgs, `${pkgs.json?.data?.length} rows; new present = ${!!(pkgs.json?.data || []).find(p => (p.name || p.package_name) === pkgName)}; price field = ${JSON.stringify((pkgs.json?.data || []).find(p => (p.name || p.package_name) === pkgName)?.price)}`);
  if (pkgId) log('DELETE /amc-packages/:id (UI Delete)', await call('DELETE', `/api/coordinator/amc-packages/${pkgId}`));

  // ---------- ADD SERVICE (addons) ----------
  const addonName = `Audit Addon ${stamp}`;
  const addRes = log('POST /addons', await call('POST', '/api/coordinator/addons', {
    property_type: 'Gated Community', service_name: addonName, frequency_count: 12,
    frequency_type: 'Monthly', billing_cycle: 'Monthly', price: 3500, description: 'audit addon'
  }));
  const addonId = addRes.json?.data?.id;
  const addons = await call('GET', '/api/coordinator/addons');
  log('GET /addons', addons, `${addons.json?.data?.length} rows; new present = ${!!(addons.json?.data || []).find(a => (a.service_name || a.name) === addonName)}`);
  if (addonId) log('DELETE /addons/:id (UI Delete)', await call('DELETE', `/api/coordinator/addons/${addonId}`));

  // ---------- SERVICE CATALOG ----------
  const svcName = `Audit Service ${stamp}`;
  const svcRes = log('POST /service-catalog', await call('POST', '/api/coordinator/service-catalog', {
    service_name: svcName, category: 'Housekeeping', pricing_method: 'fixed',
    base_price: 1200, vendor_cost: 800, default_markup: 20, frequency_type: 'Monthly', frequency_count: 12
  }));
  const svcs = await call('GET', '/api/coordinator/service-catalog');
  log('GET /service-catalog', svcs, `${svcs.json?.data?.length} rows`);

  // ---------- ESTIMATES ----------
  const estPayload = {
    estimate_type: 'property_based',
    property_id: newProp ? String(newProp.id) : '1',
    property_code: propertyCode, property_name: community, property_type: 'Gated Community',
    client_name: `Audit Contact ${stamp}`, client_phone: '+91 9800000001', client_email: custEmail,
    zone: zoneName, city: 'Hyderabad', address: '1 Audit Street', division: divName,
    number_of_blocks: 2, total_units: 22, tower_name: '', block_number: '', villa_plot_number: '',
    package_id: null, package_name: '', package_price: 0, billing_duration: 'yearly',
    addons: [{ name: 'Hand Entered Service', price: 5000, isManual: true, manual: true, frequency_type: 'Monthly', frequency_count: 12, details: 'typed in by the audit' }],
    subtotal: 5000, discount_percent: 0, discount_amount: 0, gst_percent: 18, gst_amount: 900,
    total_amount: 5900, includeTerms: true, termsConditions: 'Audit terms'
  };
  const estRes = log('POST /estimates (custom service)', await call('POST', '/api/coordinator/estimates', estPayload));
  const estId = estRes.json?.data?.id || estRes.json?.id;
  const ests = await call('GET', '/api/coordinator/estimates');
  const myEst = (ests.json?.data || []).find(e => e.id === estId);
  log('GET /estimates', ests, `${ests.json?.data?.length} rows; new present = ${!!myEst}; total = ${myEst?.total_amount}; status = ${myEst?.status}`);
  if (estId) {
    log('PUT /estimates/:id (edit)', await call('PUT', `/api/coordinator/estimates/${estId}`, { ...estPayload, total_amount: 7080, subtotal: 6000, gst_amount: 1080 }));
    const after = await call('GET', '/api/coordinator/estimates');
    log('GET /estimates (persistence)', after, `total now = ${(after.json?.data || []).find(e => e.id === estId)?.total_amount}`);
    log('PUT /estimates/:id/status', await call('PUT', `/api/coordinator/estimates/${estId}/status`, { status: 'sent' }));
    log('POST /estimates/send-email', await call('POST', '/api/coordinator/estimates/send-email', { estimateId: estId, email: custEmail }));
    log('PUT /estimates/:id/archive', await call('PUT', `/api/coordinator/estimates/${estId}/archive`));
    const arch = await call('GET', '/api/coordinator/estimates?archived=true');
    log('GET /estimates?archived=true', arch, `${arch.json?.data?.length} rows; contains = ${!!(arch.json?.data || []).find(e => e.id === estId)}`);
    log('PUT /estimates/:id/restore', await call('PUT', `/api/coordinator/estimates/${estId}/restore`));
    log('POST /estimates/bulk-archive', await call('POST', '/api/coordinator/estimates/bulk-archive', { ids: [estId] }));
  }

  // ---------- SCHEDULES ----------
  const sAll = await call('GET', '/api/coordinator/schedules/all');
  log('GET /schedules/all', sAll, `${Array.isArray(sAll.json?.data) ? sAll.json.data.length + ' rows' : 'keys ' + Object.keys(sAll.json?.data || {})}`);
  const sPend = await call('GET', '/api/coordinator/schedules/pending-properties');
  log('GET /schedules/pending-properties', sPend, `${sPend.json?.data?.length} rows`);
  console.log('--- shared /api/schedules/* endpoints the coordinator schedule screens call ---');
  for (const p of ['/api/schedules/pending-properties', '/api/schedules/reschedule-requests', '/api/schedules/cancelled', `/api/schedules/property/${newProp?.id || 1}/services`]) {
    log(`GET ${p}`, await call('GET', p));
  }
  log('POST /api/schedules/draft', await call('POST', '/api/schedules/draft', { propertyId: newProp?.id || 1, services: [] }));
  log('POST /api/schedules/confirm', await call('POST', '/api/schedules/confirm', { propertyId: newProp?.id || 1, services: [] }));
  log('PUT /api/schedules/visits/1/reschedule', await call('PUT', '/api/schedules/visits/1/reschedule', { newDate: '2026-12-15', reason: 'audit' }));
  log('PUT /api/schedules/visits/1/cancel', await call('PUT', '/api/schedules/visits/1/cancel', { reason: 'audit' }));

  console.log('='.repeat(100));
  console.log('done');
})().catch(e => { console.error('FATAL', e.message, e.stack); process.exit(1); });
