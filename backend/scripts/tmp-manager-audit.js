/* Temporary: end-to-end probe of every endpoint the Manager portal calls. Not committed. */
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
  return { status: r.status, json, text: text.slice(0, 600), ct: r.headers.get('content-type') };
};

// Every GET the Manager sidebar's screens issue, grouped by the screen that issues it.
const GETS = [
  // --- Dashboard
  '/api/manager/dashboard',
  '/api/manager/work-orders/approaching-deletion',
  '/api/payments/invoices',
  // --- Property Management
  '/api/manager/properties',
  '/api/manager/properties?status=active',
  '/api/manager/properties?status=inactive',
  '/api/manager/zones',
  '/api/manager/divisions',
  '/api/manager/employees',
  '/api/manager/vendors',
  '/api/manager/vendors/assignments',
  '/api/manager/export/properties',
  // --- Work Orders
  '/api/manager/work-orders',
  '/api/manager/work-orders/pending',
  '/api/manager/work-orders/completed',
  '/api/manager/categories',
  '/api/manager/customers',
  '/api/manager/export/work-orders',
  // --- Vendors
  '/api/manager/export/vendors',
  '/api/admin/service-types',
  '/api/onboarding/suggestions/areas',
  // --- Employee Zone Management
  '/api/manager/fp-employee-zones',
  '/api/manager/export/employees',
  // --- Estimates
  '/api/manager/estimates',
  '/api/manager/estimates?archived=false',
  '/api/manager/estimates?archived=true',
  '/api/manager/amc-packages',
  '/api/manager/addons',
  '/api/manager/fp-portal-links',
  '/api/manager/services',
  '/api/manager/service-catalog',
  '/api/manager/service-catalog/options',
  // --- Billing & Payments
  '/api/payments/invoices?archived=false',
  '/api/payments/invoices?archived=true',
  '/api/payments/payments',
  '/api/payments/dashboard',
  '/api/payments/history',
  '/api/staff',
  // --- Schedules endpoints the routes expose (no sidebar item, but mounted)
  '/api/manager/schedules/pending-properties',
  '/api/manager/schedules/pending-count',
  '/api/manager/schedules/all',
  '/api/manager/schedules/eligible-vendors',
  '/api/manager/schedules/notifications',
  // --- Marketing mount
  '/api/manager/marketing/dashboard',
  '/api/manager/marketing/tracker',
  '/api/manager/marketing/complaints',
  '/api/manager/marketing/tracker/archived',
  '/api/manager/marketing/complaints/archived',
  '/api/manager/marketing/complaints/employees',
  '/api/admin/all-employees',
  // --- Schedules screens (shared components, portalType=manager)
  '/api/schedules/pending-properties',
  '/api/schedules/reschedule-requests',
  '/api/schedules/cancelled',
  '/api/schedules/recommended-dates',
  // --- Billing Dashboard / Make Payments / Payment History screens
  '/api/payments/property-estimate-margins'
];

// Routes the Manager UI calls that may not exist at all - probed with a harmless id.
const EXISTENCE_PROBES = [
  ['PUT', '/api/manager/estimates/999999/restore'],
  ['DELETE', '/api/manager/estimates/999999'],
  ['DELETE', '/api/manager/amc-packages/999999'],
  ['DELETE', '/api/manager/addons/999999'],
  ['GET', '/api/manager/work-orders/999999'],
  ['GET', '/api/manager/properties/999999']
];

(async () => {
  const who = process.argv[2] || 'manager';
  const pass = process.argv[3] || 'Password@123';
  const { token, user } = await login(who, pass);
  console.log('LOGGED IN AS', JSON.stringify(user));
  console.log('='.repeat(110));
  for (const p of GETS) {
    const r = await call(token, 'GET', p);
    const ok = r.status >= 200 && r.status < 300;
    const flag = ok ? 'OK ' : '>>>';
    let detail = '';
    if (!ok) detail = ' :: ' + r.text.replace(/\s+/g, ' ').slice(0, 300);
    else if (r.json && Array.isArray(r.json.data)) detail = ` :: ${r.json.data.length} rows`;
    else if (r.json && Array.isArray(r.json)) detail = ` :: ${r.json.length} rows (bare array)`;
    else if (r.json && r.json.data && typeof r.json.data === 'object') detail = ` :: keys ${Object.keys(r.json.data).slice(0, 14).join(',')}`;
    else if (r.json && r.json.success === false) detail = ' :: success=false ' + r.text.replace(/\s+/g, ' ').slice(0, 200);
    else if (!r.json) detail = ` :: ${r.ct} ${r.text.replace(/\s+/g, ' ').slice(0, 80)}`;
    console.log(`${flag} ${r.status} GET ${p}${detail}`);
  }
  console.log('-'.repeat(110));
  console.log('EXISTENCE PROBES (404 with an HTML body = no such route)');
  for (const [m, p] of EXISTENCE_PROBES) {
    const r = await call(token, m, p);
    const routeMissing = r.status === 404 && !r.json;
    console.log(`${routeMissing ? '>>>' : 'OK '} ${r.status} ${m} ${p} :: ${routeMissing ? 'NO SUCH ROUTE' : (r.ct || '') + ' ' + r.text.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
