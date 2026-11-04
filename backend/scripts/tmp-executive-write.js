/* Temporary: remaining Executive-portal probes (work orders, dashboard, zones, schedules). */
const BASE = 'http://127.0.0.1:5000';

const login = async (username, password) => {
  const r = await fetch(`${BASE}/api/employee/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.data?.token) throw new Error(`login failed ${r.status}`);
  return j.data.token;
};

const call = async (token, method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text: text.replace(/\s+/g, ' ').slice(0, 600) };
};

const show = (label, r, n = 300) => {
  const ok = r.status >= 200 && r.status < 300 && r.json?.success !== false;
  console.log(`${ok ? 'OK ' : '>>>'} ${r.status} ${label} :: ${r.text.slice(0, n)}`);
  return r;
};

(async () => {
  const who = process.argv[2] || 'executive';
  const token = await login(who, process.argv[3] || 'Password@123');
  const stamp = Date.now().toString().slice(-6);
  console.log(`### probes as ${who} (stamp ${stamp})`);

  show('GET /api/executive/dashboard', await call(token, 'GET', '/api/executive/dashboard'), 900);
  show('GET /api/executive/fp-employee-zones', await call(token, 'GET', '/api/executive/fp-employee-zones'), 500);

  // Work order, with the shape the Create Work Order form posts
  const props = await call(token, 'GET', '/api/executive/properties');
  const prop = (props.json?.data || [])[0];
  const cats = await call(token, 'GET', '/api/executive/categories');
  const cat = (cats.json?.data || [])[0];
  console.log(`    using property ${prop?.id} (${prop?.name}) and category ${cat?.id} (${cat?.name})`);
  const wo = show('POST /api/executive/work-orders', await call(token, 'POST', '/api/executive/work-orders', {
    propertyId: prop?.id, categoryId: cat?.id, categoryName: cat?.name,
    subcategoryId: '', customerName: `Audit Customer ${stamp}`,
    customerPhone: '9000000020', customerEmail: `auditwo${stamp}@example.com`,
    title: `Audit WO ${stamp}`, description: 'audit probe', priority: 'medium',
    unitNumber: 'A-101', blockNumber: 'A', preferredDate: new Date().toISOString().slice(0, 10)
  }));
  const woId = wo.json?.data?.id;
  if (woId) {
    show(`PATCH /work-orders/${woId}/status in_progress`, await call(token, 'PATCH', `/api/executive/work-orders/${woId}/status`, { status: 'in_progress', closingNotes: null }));
    show(`PATCH /work-orders/${woId}/status completed`, await call(token, 'PATCH', `/api/executive/work-orders/${woId}/status`, { status: 'completed', closingNotes: 'audit done' }));
    const all = await call(token, 'GET', '/api/executive/work-orders');
    const done = await call(token, 'GET', '/api/executive/work-orders/completed');
    console.log(`    work-orders -> all ${(all.json?.data || []).length}, completed ${(done.json?.data || []).length}; new visible in all: ${(all.json?.data || []).some(w => w.id === woId)}`);
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
