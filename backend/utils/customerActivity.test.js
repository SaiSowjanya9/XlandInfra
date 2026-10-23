/**
 * The customer's home page reads one list of what has happened on their property, merged from three
 * tables. This test pins the three things that make that list trustworthy:
 *
 *  - it is ordered by when each thing happened, across all three streams, not within each one;
 *  - a visit is in exactly one of the two panels -- activity once it is over, upcoming until then;
 *  - stored text is decoded, and a status that is not in the ENUM still reads as something.
 *
 * Run: node --test backend/utils/customerActivity.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCustomerActivity, buildUpcomingVisits, invoiceActivity, istToday
} = require('./customerActivity');

const TODAY = '2026-10-21';

const workOrder = (over, rest = {}) => ({
  id: 1, work_order_id: 'WO-1783455968280', category_name: 'Plumbing', status: 'completed',
  created_at: '2026-10-01T06:00:00.000Z', updated_at: over, ...rest
});

test('the three streams are merged into one list, newest first', () => {
  const activity = buildCustomerActivity({
    workOrders: [workOrder('2026-10-20T06:00:00.000Z')],
    invoices: [{ id: 7, invoice_id: 'INV-0021', status: 'paid', paid_at: '2026-10-15T06:00:00.000Z' }],
    visits: [{ id: 3, visit_id: 'VST-9', service_name: 'AC Maintenance', status: 'completed', scheduled_date: '2026-10-10' }]
  }, { today: TODAY });

  assert.deepEqual(activity.map(item => item.type), ['work_order', 'payment', 'schedule']);
  assert.deepEqual(activity.map(item => item.statusLabel), ['Completed', 'Paid', 'Completed']);
  assert.deepEqual(activity.map(item => item.subtitle), ['Plumbing', 'Invoice INV-0021', 'AC Maintenance']);
  // Ordering is global: a payment older than the work order but newer than the visit sits between
  // them, which is the whole reason the three queries are merged here rather than concatenated.
  assert.ok(activity.every((item, i) => i === 0 || Date.parse(item.at) <= Date.parse(activity[i - 1].at)));
});

test('type narrows the feed to one stream, and filters before the limit is taken', () => {
  // If the slice ran before the filter, a mixed feed whose newest item is a payment would come
  // back empty here -- the Work Orders panel's Activity tab would say "no work orders" while one
  // exists.
  const activity = buildCustomerActivity({
    workOrders: [workOrder('2026-10-10T06:00:00.000Z')],
    invoices: [{ id: 7, invoice_id: 'INV-0021', status: 'paid', paid_at: '2026-10-15T06:00:00.000Z' }]
  }, { today: TODAY, type: 'work_order', limit: 1 });

  assert.deepEqual(activity.map(item => item.type), ['work_order']);
});

test('a visit is in exactly one panel: activity once it is over, upcoming until then', () => {
  const visits = [
    { id: 1, service_name: 'AC Maintenance', status: 'completed', scheduled_date: '2026-10-10' },
    { id: 2, service_name: 'Pest Control', status: 'scheduled', scheduled_date: '2026-10-24' },
    { id: 3, service_name: 'Lift AMC', status: 'scheduled', scheduled_date: '2026-10-18' },
    // Over, whatever its date says -- a visit cancelled for next week is news today, and must not
    // be offered as an appointment the customer can still expect.
    { id: 4, service_name: 'Water Tank', status: 'cancelled', scheduled_date: '2026-10-28' }
  ];

  const inActivity = buildCustomerActivity({ visits }, { today: TODAY }).map(item => item.refId);
  const upcoming = buildUpcomingVisits(visits, { today: TODAY }).map(visit => visit.id);

  assert.deepEqual(inActivity.slice().sort(), [1, 3, 4]);
  assert.deepEqual(upcoming, [2]);
  // Complementary: every visit lands in one panel, none in both.
  assert.equal(inActivity.length + upcoming.length, visits.length);
  assert.ok(!inActivity.some(id => upcoming.includes(id)));
});

test('a visit today is upcoming, not already history', () => {
  const visits = [{ id: 5, service_name: 'AC Maintenance', status: 'scheduled', scheduled_date: TODAY }];
  assert.deepEqual(buildCustomerActivity({ visits }, { today: TODAY }), []);
  assert.deepEqual(buildUpcomingVisits(visits, { today: TODAY }).map(v => v.id), [5]);
});

test('upcoming visits read forwards, soonest first, and the date is the stored day', () => {
  const upcoming = buildUpcomingVisits([
    { id: 1, service_name: 'B', status: 'scheduled', scheduled_date: '2026-11-02', scheduled_time_start: '09:00' },
    { id: 2, service_name: 'A', status: 'confirmed', scheduled_date: '2026-10-24', scheduled_time_start: '14:00' },
    { id: 3, service_name: 'C', status: 'scheduled', scheduled_date: '2026-10-24', scheduled_time_start: '10:00' }
  ], { today: TODAY });

  assert.deepEqual(upcoming.map(visit => visit.id), [3, 2, 1]);
  assert.equal(upcoming[0].scheduledDate, '2026-10-24');
});

test('a DATE read as a Date keeps its stored day', () => {
  // mysql2 hands a DATE column back as a Date at the server's local midnight. Reformatting that
  // through a UTC offset is what slides a visit onto the previous date, so the local components
  // are what is read.
  const visits = [{ id: 1, service_name: 'AC', status: 'scheduled', scheduled_date: new Date(2026, 9, 24) }];
  assert.deepEqual(buildUpcomingVisits(visits, { today: TODAY }).map(v => v.scheduledDate), ['2026-10-24']);
});

test('a draft invoice is not activity, because the customer has never seen it', () => {
  const activity = buildCustomerActivity({
    invoices: [
      { id: 1, invoice_id: 'INV-0001', status: 'draft', created_at: '2026-10-20T06:00:00.000Z' },
      { id: 2, invoice_id: 'INV-0002', status: 'sent', created_at: '2026-10-19T06:00:00.000Z' }
    ]
  }, { today: TODAY });

  assert.deepEqual(activity.map(item => item.reference), ['INV-0002']);
  assert.equal(activity[0].statusLabel, 'Pending');
});

test('an invoice is dated without ever requiring paid_at', () => {
  // `invoices.paid_at` is created by schema_v53 and was missing from every deployment before it, so
  // a row read with `SELECT i.*` simply has no such key. Dating an invoice must not depend on it.
  const sent = invoiceActivity({ id: 1, invoice_id: 'INV-1', status: 'paid', sent_at: '2026-10-05T06:00:00.000Z' });
  assert.equal(sent.at, '2026-10-05T06:00:00.000Z');
  assert.equal(sent.statusLabel, 'Paid');

  const paid = invoiceActivity({
    id: 1, invoice_id: 'INV-1', status: 'paid',
    sent_at: '2026-10-05T06:00:00.000Z', paid_at: '2026-10-15T06:00:00.000Z'
  });
  assert.equal(paid.at, '2026-10-15T06:00:00.000Z', 'when it was settled outranks when it was sent');
});

test('stored text is decoded once, for display only', () => {
  const [item] = buildCustomerActivity({
    workOrders: [workOrder('2026-10-20T06:00:00.000Z', { category_name: 'Parts&#x2F;major &amp; minor' })]
  }, { today: TODAY });
  assert.equal(item.subtitle, 'Parts/major & minor');
});

test('a status carries a named tone, and an unknown one still reads', () => {
  const [item] = buildCustomerActivity({
    workOrders: [workOrder('2026-10-20T06:00:00.000Z', { status: 'on_hold' })]
  }, { today: TODAY });
  // An ENUM here has gained a member before (payment_history.action, fp_employees.role); a blank
  // badge would say nothing at all.
  assert.equal(item.statusLabel, 'On Hold');
  assert.equal(item.tone, 'neutral');

  const tones = new Set(['success', 'warning', 'info', 'danger', 'neutral']);
  const every = buildCustomerActivity({
    workOrders: [workOrder('2026-10-20T06:00:00.000Z')],
    invoices: [{ id: 1, invoice_id: 'INV-1', status: 'overdue', sent_at: '2026-10-02T06:00:00.000Z' }],
    visits: [{ id: 1, service_name: 'AC', status: 'missed', scheduled_date: '2026-10-09' }]
  }, { today: TODAY });
  // Tailwind is scanned statically: a hex sent from here renders as no colour at all.
  assert.ok(every.every(item => tones.has(item.tone)), 'tones are names the portal can spell out');
});

test('the feed is capped, and the cap keeps the newest', () => {
  const workOrders = Array.from({ length: 12 }, (_, i) => workOrder(`2026-10-${String(i + 1).padStart(2, '0')}T06:00:00.000Z`, { id: i + 1 }));
  const activity = buildCustomerActivity({ workOrders }, { limit: 5, today: TODAY });
  assert.equal(activity.length, 5);
  assert.deepEqual(activity.map(item => item.refId), [12, 11, 10, 9, 8]);
});

test('today is read in IST, not in the server\'s zone', () => {
  // A VPS on UTC is still 05:30 behind the property, so a visit scheduled for the 24th must not
  // become history at 18:30 on the 23rd.
  assert.equal(istToday(new Date('2026-10-23T18:45:00.000Z')), '2026-10-24');
  assert.match(istToday(), /^\d{4}-\d{2}-\d{2}$/);
});
