/* Temporary: end-to-end probe of every endpoint the Coordinator portal calls. Not committed. */
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
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON (csv/pdf etc) */ }
  return { status: r.status, json, text: text.slice(0, 500), ct: r.headers.get('content-type') };
};

const GETS = [
  // Dashboard
  '/api/coordinator/dashboard',
  // Property Management
  '/api/coordinator/properties',
  '/api/coordinator/properties?status=active',
  '/api/coordinator/properties?status=inactive',
  // Work Orders
  '/api/coordinator/work-orders',
  '/api/coordinator/work-orders/pending',
  '/api/coordinator/work-orders/completed',
  // Customers
  '/api/coordinator/customers',
  // Vendors
  '/api/coordinator/vendors',
  '/api/coordinator/vendors/assignments',
  // Employees / zones
  '/api/coordinator/employees',
  '/api/coordinator/zones',
  '/api/coordinator/divisions',
  '/api/coordinator/fp-employee-zones',
  '/api/coordinator/fp-portal-links',
  // Estimates / AMC
  '/api/coordinator/estimates',
  '/api/coordinator/estimates?archived=true',
  '/api/coordinator/amc-packages',
  '/api/coordinator/addons',
  '/api/coordinator/categories',
  '/api/coordinator/categories/1/subcategories',
  '/api/coordinator/service-catalog',
  '/api/coordinator/service-catalog/options',
  '/api/coordinator/services',
  // Schedules
  '/api/coordinator/schedules/pending-properties',
  '/api/coordinator/schedules/all',
  // Exports
  '/api/coordinator/export/properties',
  '/api/coordinator/export/vendors',
  '/api/coordinator/export/employees',
  '/api/coordinator/export/work-orders',
  // Marketing mount
  '/api/coordinator/marketing/dashboard',
  '/api/coordinator/marketing/tracker',
  '/api/coordinator/marketing/tracker/archived',
  '/api/coordinator/marketing/complaints',
  '/api/coordinator/marketing/complaints/archived',
  '/api/coordinator/marketing/complaints/employees',
  // Shared endpoints the coordinator screens call directly
  '/api/admin/service-types',
  '/api/admin/all-employees',
  '/api/onboarding/suggestions/areas',
  '/api/schedules/pending-properties',
  '/api/schedules/reschedule-requests',
  '/api/schedules/cancelled',
  '/api/schedules/recommended-dates',
  // Estimates dashboard also pulls invoices
  '/api/payments/invoices?archived=false',
  '/api/payments/dashboard',
  '/api/payments/history',
  // billing routes exist but are not in the sidebar
  '/api/payments/payments'
];

(async () => {
  const who = process.argv[2] || 'coordinator_admin';
  const pass = process.argv[3] || 'Password@123';
  const { token, user } = await login(who, pass);
  console.log('LOGGED IN AS', JSON.stringify(user));
  console.log('='.repeat(100));
  for (const p of GETS) {
    const r = await call(token, 'GET', p);
    const ok = r.status >= 200 && r.status < 300;
    const flag = ok ? 'OK ' : '>>>';
    let detail = '';
    if (!ok) detail = ' :: ' + r.text.replace(/\s+/g, ' ').slice(0, 250);
    else if (r.json && Array.isArray(r.json.data)) detail = ` :: ${r.json.data.length} rows`;
    else if (r.json && r.json.data && typeof r.json.data === 'object') detail = ` :: keys ${Object.keys(r.json.data).slice(0, 12).join(',')}`;
    else if (r.json && r.json.success === false) detail = ' :: success=false ' + r.text.replace(/\s+/g, ' ').slice(0, 200);
    else if (!r.json) detail = ` :: ${r.ct} ${r.text.replace(/\s+/g, ' ').slice(0, 80)}`;
    console.log(`${flag} ${r.status} GET ${p}${detail}`);
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
