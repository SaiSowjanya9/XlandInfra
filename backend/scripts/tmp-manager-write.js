/* Temporary: write-path probe for the Manager portal, with the payloads the UI actually sends. */
const BASE = 'http://127.0.0.1:5000';

const login = async (username, password) => {
  const r = await fetch(`${BASE}/api/employee/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.data?.token) throw new Error(`login failed ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return { token: j.data.token, user: j.data.user };
};

const call = async (token, method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text: text.slice(0, 500) };
};

const show = (label, r) => {
  const ok = r.status >= 200 && r.status < 300 && r.json?.success !== false;
  console.log(`${ok ? 'OK ' : '>>>'} ${r.status} ${label} :: ${r.text.replace(/\s+/g, ' ').slice(0, 240)}`);
  return r;
};

(async () => {
  const who = process.argv[2] || 'test-manager-969675_mvphja5o';
  const pass = process.argv[3] || 'Password@123';
  const { token, user } = await login(who, pass);
  const stamp = Date.now().toString().slice(-6);
  console.log(`### Manager write probes as ${who} (fp=${user.franchisePartnerId}) stamp ${stamp}`);
  console.log('='.repeat(110));

  // ---------------- Zones (Properties / Add Customer / Add Vendor auto-save a typed zone)
  console.log('\n--- ZONES');
  show('POST /api/manager/zones', await call(token, 'POST', '/api/manager/zones', { name: `AuditZone${stamp}` }));
  const zl = await call(token, 'GET', '/api/manager/zones');
  const myZone = (zl.json?.data || []).find(z => String(z.name) === `AuditZone${stamp}`);
  console.log(`    zone list -> ${(zl.json?.data || []).length} rows; new one visible: ${!!myZone} (id ${myZone?.id})`);

  // ---------------- Divisions
  console.log('\n--- DIVISIONS');
  const dv = show('POST /api/manager/divisions', await call(token, 'POST', '/api/manager/divisions', { name: `AuditDiv${stamp}` }));
  const dl = await call(token, 'GET', '/api/manager/divisions');
  const myDiv = (dl.json?.data || []).find(d => String(d.name) === `AuditDiv${stamp}`);
  console.log(`    division list -> ${(dl.json?.data || []).length} rows; new one visible: ${!!myDiv}`);

  // ---------------- Add Customer (the property form the screen posts)
  console.log('\n--- ADD CUSTOMER (property form)');
  const custBody = {
    zone: `AuditZone${stamp}`, areaName: 'Audit Area', division: `AuditDiv${stamp}`, propertyType: 'GC',
    communityName: `Audit Community ${stamp}`,
    associationContacts: [{ name: `Audit Contact ${stamp}`, email: `auditmgr${stamp}@example.com`, phone: '9000000010', countryCode: '+91' }],
    numberOfBlocks: 1, unitsPerBlock: { 1: 10 }, blockNames: { 1: 'A' }, blockUnitTypes: {},
    numberOfUnits: '', villaPlotNumber: '', blockInfo: '', blockNA: false,
    flatBlockInfo: '', flatBlockNA: false, plotNA: false,
    address: 'Audit address', city: 'Hyderabad', state: 'Telangana', postalCode: '500001',
    landmark: '', mapLocation: { lat: null, lng: null, address: '' }, notes: '',
    watchmanName: 'Watchman', watchmanContact: '9000000012',
    entryType: 'GC', category: 'residential'
  };
  show('POST /api/manager/customers', await call(token, 'POST', '/api/manager/customers', custBody));
  show('POST /api/manager/customers (duplicate email -> must 409)', await call(token, 'POST', '/api/manager/customers', {
    ...custBody, communityName: `Audit Community dup ${stamp}`
  }));

  const props = await call(token, 'GET', '/api/manager/properties');
  const mine = (props.json?.data || []).filter(p => String(p.name || p.community_name || '').includes(stamp));
  console.log(`    properties list -> ${(props.json?.data || []).length} rows; new one visible: ${mine.length > 0}`);
  const custs = await call(token, 'GET', '/api/manager/customers');
  console.log(`    customers list -> ${(custs.json?.data || []).length} rows; new one visible: ${(custs.json?.data || []).some(c => JSON.stringify(c).includes(stamp))}`);

  const target = mine[0] || (props.json?.data || [])[0];
  console.log(`    target property: id=${target?.id} name=${target?.name} source=${target?.source_table}`);

  // ---------------- Property edit (the Edit modal's PUT) + get by id
  console.log('\n--- PROPERTY EDIT');
  if (target) {
    show(`GET /api/manager/properties/${target.id}`, await call(token, 'GET', `/api/manager/properties/${target.id}`));
    show(`PUT /api/manager/properties/${target.id}`, await call(token, 'PUT', `/api/manager/properties/${target.id}`, {
      name: `${target.name} edited`, propertyType: target.property_type || 'GC', address: target.address || 'a',
      city: target.city || 'Hyderabad', state: target.state || 'TS', zipCode: target.zip_code || '500001',
      contactPerson: target.contact_person || 'x', contactPhone: target.contact_phone || '9000000010',
      contactEmail: target.contact_email || '', zoneId: target.zone || `AuditZone${stamp}`,
      sourceTable: target.source_table || 'onboarded_properties',
      watchmanName: 'Watchman edited', watchmanContact: '9000000013'
    }));
    const after = await call(token, 'GET', '/api/manager/properties');
    const row = (after.json?.data || []).find(p => String(p.id) === String(target.id) && p.source_table === target.source_table);
    console.log(`    edit persisted: name="${row?.name}" watchman="${row?.watchman_name}"`);
  }

  // ---------------- Work orders (Create Work Order form)
  console.log('\n--- WORK ORDERS');
  const cats = await call(token, 'GET', '/api/manager/categories');
  const cat = (cats.json?.data || [])[0];
  const sub = cat?.subcategories?.[0];
  console.log(`    category: ${cat?.id} ${cat?.name}; subcategory: ${sub?.id} ${sub?.name}`);
  const wo = show('POST /api/manager/work-orders', await call(token, 'POST', '/api/manager/work-orders', {
    propertyId: target?.id, categoryId: cat?.id, subcategoryId: sub?.id, customSubcategory: '',
    description: `audit probe ${stamp}`, priority: 'medium',
    categoryName: cat?.name, subcategoryName: sub?.name,
    customerName: `Audit Contact ${stamp}`, customerEmail: `auditmgr${stamp}@example.com`, customerPhone: '9000000010'
  }));
  const woId = wo.json?.data?.id;
  const woList = await call(token, 'GET', '/api/manager/work-orders');
  console.log(`    work-order list -> ${(woList.json?.data || []).length} rows; new one visible: ${(woList.json?.data || []).some(w => w.id === woId)}`);

  if (woId) {
    show(`PUT /api/manager/work-orders/${woId} (edit modal)`, await call(token, 'PUT', `/api/manager/work-orders/${woId}`, {
      category_id: cat?.id, subcategory_id: sub?.id, description: `audit edited ${stamp}`,
      permission_to_enter: 'yes', has_pet: 'no', entry_notes: 'audit notes', priority: 'high',
      status: 'assigned', customer_name: `Audit Contact ${stamp}`, customer_email: `auditmgr${stamp}@example.com`,
      customer_phone: '9000000010', block: 'A', flatNumber: '101'
    }));
    show(`PATCH /work-orders/${woId}/status in_progress`, await call(token, 'PATCH', `/api/manager/work-orders/${woId}/status`, { status: 'in_progress', closingNotes: null }));
    const vend = await call(token, 'GET', '/api/manager/vendors');
    const anyVendor = (vend.json?.data?.all || vend.json?.data?.own || [])[0];
    if (anyVendor) show(`PATCH /work-orders/${woId}/assign-vendor`, await call(token, 'PATCH', `/api/manager/work-orders/${woId}/assign-vendor`, { vendorId: anyVendor.id }));
    const emps = await call(token, 'GET', '/api/manager/employees');
    const anyEmp = (emps.json?.data || [])[0];
    if (anyEmp) show(`PATCH /work-orders/${woId}/assign-employee`, await call(token, 'PATCH', `/api/manager/work-orders/${woId}/assign-employee`, { employeeId: anyEmp.id }));
    show(`PATCH /work-orders/${woId}/status completed`, await call(token, 'PATCH', `/api/manager/work-orders/${woId}/status`, { status: 'completed', closingNotes: 'audit done' }));
    show(`PATCH /work-orders/${woId}/status cancelled`, await call(token, 'PATCH', `/api/manager/work-orders/${woId}/status`, { status: 'cancelled', cancelNote: 'audit cancel' }));
  }

  // ---------------- Vendors (Add Vendor form)
  console.log('\n--- VENDORS');
  const v = show('POST /api/manager/vendors', await call(token, 'POST', '/api/manager/vendors', {
    serviceType: 'Plumbing', serviceVerified: true, zone: `AuditZone${stamp}`, areaName: 'Audit Area',
    ownerName: `Audit Vendor ${stamp}`, ownerMobile: '9000000020', ownerEmail: `auditvend${stamp}@example.com`,
    ownerAadhar: '', ownerCountryCode: '+91',
    managerName: 'VM', managerMobile: '9000000021', managerEmail: `auditvm${stamp}@example.com`, managerCountryCode: '+91',
    pocName: 'POC', pocMobile: '9000000022', pocEmail: `auditpoc${stamp}@example.com`, pocCountryCode: '+91',
    ratePerVisit: '500', coveragePerDay: '5', workingHoursFrom: '09:00', workingHoursTo: '18:00',
    createdBy: who, createdAt: new Date().toISOString()
  }));
  const vid = v.json?.data?.id;
  const vlist = await call(token, 'GET', '/api/manager/vendors');
  const allV = vlist.json?.data?.all || [];
  console.log(`    vendor list -> own ${(vlist.json?.data?.own || []).length}, assigned ${(vlist.json?.data?.assigned || []).length}, all ${allV.length}; new one visible: ${allV.some(x => x.id === vid)}`);
  if (vid) {
    show(`PUT /api/manager/vendors/${vid}`, await call(token, 'PUT', `/api/manager/vendors/${vid}`, { ownerName: `Audit Vendor ${stamp} edited`, ownerMobile: '9000000023' }));
    show(`DELETE /api/manager/vendors/${vid}`, await call(token, 'DELETE', `/api/manager/vendors/${vid}`));
  }

  // ---------------- Vendor assignments (Property Management > Assign Vendor)
  console.log('\n--- VENDOR ASSIGNMENTS');
  const anyVendor2 = allV[0];
  if (target && anyVendor2) {
    show('POST /api/manager/properties/:id/assign-vendor', await call(token, 'POST', `/api/manager/properties/${target.id}/assign-vendor`, {
      vendorId: anyVendor2.id, serviceType: 'Plumbing', notes: 'audit'
    }));
    const a = show('POST /api/manager/vendors/assignments', await call(token, 'POST', '/api/manager/vendors/assignments', {
      propertyId: target.id, vendorId: anyVendor2.id, serviceName: 'Plumbing', notes: 'audit'
    }));
    const aid = a.json?.data?.id;
    if (aid) show(`PUT /api/manager/vendors/assignments/${aid}`, await call(token, 'PUT', `/api/manager/vendors/assignments/${aid}`, { vendorId: anyVendor2.id, notes: 'audit edited' }));
    show(`GET /api/manager/vendors/assignments/property/${target.id}`, await call(token, 'GET', `/api/manager/vendors/assignments/property/${target.id}`));
  }

  // ---------------- Employees + zones (Employee Zone Management)
  console.log('\n--- EMPLOYEES / ZONES');
  show('POST /api/manager/employees (should refuse - read only)', await call(token, 'POST', '/api/manager/employees', { firstName: 'X' }));
  const emps2 = await call(token, 'GET', '/api/manager/employees');
  const emp = (emps2.json?.data || [])[0];
  if (emp) {
    show(`PUT /api/manager/employees/${emp.id}/zones`, await call(token, 'PUT', `/api/manager/employees/${emp.id}/zones`, { zones: [`AuditZone${stamp}`] }));
    const ez = await call(token, 'GET', '/api/manager/fp-employee-zones');
    const row = (ez.json?.data?.employees || []).find(e => e.id === emp.id);
    console.log(`    employee ${emp.id} zones now: ${JSON.stringify(row?.zones || row?.assigned_zones)}`);
    show(`PUT /api/manager/employees/${emp.id}`, await call(token, 'PUT', `/api/manager/employees/${emp.id}`, { firstName: 'X' }));
    show(`DELETE /api/manager/employees/${emp.id}`, await call(token, 'DELETE', `/api/manager/employees/${emp.id}`));
  }

  // ---------------- AMC packages (Estimates > AMC Packages)
  console.log('\n--- AMC PACKAGES');
  const pkg = show('POST /api/manager/amc-packages', await call(token, 'POST', '/api/manager/amc-packages', {
    name: `Audit Pkg ${stamp}`, property_type: 'GC',
    services: [{ name: 'Housekeeping', frequency_count: 1, frequency_type: 'monthly' }],
    price: 5000, billing_duration: 'yearly'
  }));
  const pkgId = pkg.json?.data?.id;
  const pkgs = await call(token, 'GET', '/api/manager/amc-packages');
  console.log(`    amc list -> ${(pkgs.json?.data || []).length} rows; new one visible: ${(pkgs.json?.data || []).some(p => p.id === pkgId)}`);
  if (pkgId) show(`DELETE /api/manager/amc-packages/${pkgId}`, await call(token, 'DELETE', `/api/manager/amc-packages/${pkgId}`));

  // ---------------- Add-ons (Estimates > Add-ons)
  console.log('\n--- ADD-ONS');
  const ad = show('POST /api/manager/addons', await call(token, 'POST', '/api/manager/addons', {
    property_type: 'GC', service_name: `Audit Addon ${stamp}`, frequency_count: 1,
    frequency_type: 'monthly', billing_cycle: 'Monthly', price: 500, description: 'audit'
  }));
  const adId = ad.json?.data?.id;
  const ads = await call(token, 'GET', '/api/manager/addons');
  console.log(`    addon list -> ${(ads.json?.data || []).length} rows; new one visible: ${(ads.json?.data || []).some(a => a.id === adId)}`);
  if (adId) show(`DELETE /api/manager/addons/${adId}`, await call(token, 'DELETE', `/api/manager/addons/${adId}`));

  // ---------------- Estimates (Create Estimate)
  console.log('\n--- ESTIMATES');
  const est = show('POST /api/manager/estimates', await call(token, 'POST', '/api/manager/estimates', {
    estimate_type: 'property_based',
    property_id: target?.id, property_code: target?.property_id || target?.property_code,
    property_name: target?.name, property_type: 'GC',
    client_name: `Audit Contact ${stamp}`, client_email: `auditmgr${stamp}@example.com`, client_phone: '9000000010',
    zone: `AuditZone${stamp}`, city: 'Hyderabad', address: 'Audit address',
    addons: [{ service_name: 'Extra Cleaning', price: 1000, frequency_count: 1, frequency_type: 'monthly' }],
    subtotal: 1000, gst_percent: 18, gst_amount: 180, total_amount: 1180,
    notes: 'audit probe', valid_until: '2027-01-01'
  }));
  const estId = est.json?.data?.id;
  const el = await call(token, 'GET', '/api/manager/estimates?archived=false');
  console.log(`    estimate list -> ${(el.json?.data || []).length} rows; new one visible: ${(el.json?.data || []).some(e => e.id === estId)}`);
  if (estId) {
    show(`PUT /api/manager/estimates/${estId}/status`, await call(token, 'PUT', `/api/manager/estimates/${estId}/status`, { status: 'sent' }));
    show(`PUT /api/manager/estimates/${estId}`, await call(token, 'PUT', `/api/manager/estimates/${estId}`, {
      estimate_type: 'property_based', property_id: target?.id, property_name: target?.name,
      client_name: `Audit Contact ${stamp} edited`, client_email: `auditmgr${stamp}@example.com`, client_phone: '9000000010',
      addons: [{ service_name: 'Extra Cleaning', price: 1500, frequency_count: 1, frequency_type: 'monthly' }],
      subtotal: 1500, gst_percent: 18, gst_amount: 270, total_amount: 1770
    }));
    show(`PUT /api/manager/estimates/${estId}/archive`, await call(token, 'PUT', `/api/manager/estimates/${estId}/archive`));
    const ar = await call(token, 'GET', '/api/manager/estimates?archived=true');
    console.log(`    archived list -> ${(ar.json?.data || []).length} rows; contains id: ${(ar.json?.data || []).some(e => e.id === estId)}`);
    show(`PUT /api/manager/estimates/${estId}/restore`, await call(token, 'PUT', `/api/manager/estimates/${estId}/restore`));
    show('POST /api/manager/estimates/bulk-archive', await call(token, 'POST', '/api/manager/estimates/bulk-archive', { estimateIds: [estId] }));
    show(`DELETE /api/manager/estimates/${estId}`, await call(token, 'DELETE', `/api/manager/estimates/${estId}`));
    show('POST /api/manager/estimates/send-email', await call(token, 'POST', '/api/manager/estimates/send-email', { estimateId: estId, email: `auditmgr${stamp}@example.com` }));
  }

  // ---------------- Zone delete last (it is referenced above)
  console.log('\n--- CLEANUP / ZONE DELETE');
  if (myZone) show(`DELETE /api/manager/zones/${myZone.id}`, await call(token, 'DELETE', `/api/manager/zones/${myZone.id}`));
  if (myDiv) show(`DELETE /api/manager/divisions/${myDiv.id}`, await call(token, 'DELETE', `/api/manager/divisions/${myDiv.id}`));
})().catch(e => { console.error('FATAL', e.message, e.stack); process.exit(1); });
