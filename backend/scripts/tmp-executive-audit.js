/* Temporary: end-to-end probe of every endpoint the Executive portal calls. Not committed. */
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
  try { json = JSON.parse(text); } catch { /* non-JSON (pdf etc) */ }
  return { status: r.status, json, text: text.slice(0, 500), ct: r.headers.get('content-type') };
};

const GETS = [
  // --- Marketing (real paths the screens use) ---
  '/api/executive/marketing/dashboard',
  '/api/executive/marketing/tracker',
  '/api/executive/marketing/tracker/archived',
  '/api/executive/marketing/complaints',
  '/api/executive/marketing/complaints/archived',
  '/api/executive/marketing/complaints/employees?zone=Test',
  // complaint form also reads these three from the same prefix
  '/api/executive/properties',
  '/api/executive/zones',
  '/api/executive/employees',
  // --- Schedules dashboard ---
  '/api/executive/schedules/all',
  '/api/executive/schedules/pending-properties',
  // --- shared billing ---
  '/api/payments/dashboard',
  '/api/payments/invoices?archived=false',
  '/api/payments/payments',
  '/api/payments/history',
  '/api/staff',
  '/api/work-orders?status=completed',
  '/api/estimates?status=approved',
  '/api/fp/work-orders?status=completed&excludeWithEstimates=true',
  '/api/admin/work-orders?status=completed&excludeWithEstimates=true'
];

(async () => {
  const who = process.argv[2] || 'executive';
  const pass = process.argv[3] || 'Password@123';
  const { token, user } = await login(who, pass);
  console.log('LOGGED IN AS', JSON.stringify(user));
  console.log('='.repeat(100));
  for (const p of GETS) {
    const r = await call(token, 'GET', p);
    const ok = r.status >= 200 && r.status < 300;
    const flag = ok ? 'OK ' : '>>>';
    let detail = '';
    if (!ok) detail = ' :: ' + r.text.replace(/\s+/g, ' ').slice(0, 260);
    else if (r.json && Array.isArray(r.json.data)) detail = ` :: ${r.json.data.length} rows`;
    else if (r.json && r.json.success === false) detail = ' :: success=false ' + r.text.replace(/\s+/g, ' ').slice(0, 220);
    console.log(`${flag} ${r.status} GET ${p}${detail}`);
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
