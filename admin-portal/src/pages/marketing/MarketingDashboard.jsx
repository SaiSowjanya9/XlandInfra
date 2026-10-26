import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, Megaphone, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, Line, LabelList
} from 'recharts';
import { getAuthToken } from '../../utils/safeStorage';
import { decodeEntities } from '../../utils/text';
import { monthsSinceEarliest, trendSpanLabel, TREND_X_AXIS } from '../../utils/trendSpan';
import EmptyState from '../../components/common/EmptyState';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import { useFP } from '../../contexts/FPContext';
import { getMarketingApiPath, marketingFpId, withMarketingFp } from '../../utils/marketingApi';
import { LEAD_STATUSES, LEAD_SOURCES } from '../../utils/followUpDates';
import {
  MARKETING_PHASE_COLORS, MARKETING_PRIORITY_COLORS,
  MARKETING_LEAD_STATUS_COLORS, MARKETING_OWNER_COLORS,
  MARKETING_CATEGORICAL
} from '../../utils/chartColors';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Marketing Dashboard reports on the rows Marketing > Tracker edits. Every figure arrives
// pre-aggregated from GET /api/fp/marketing/dashboard (backend/utils/marketingDashboard.js owns
// the counting rules), so this file only draws.
//
// The page follows the FP portal's warm beige skin, and gold #B5812A -- not the lighter
// warm-accent -- carries white text, the same contrast rule the warm estimate screens follow.
// The chart colours are the muted MARKETING_* palette in utils/chartColors.js: the saturated
// defaults read as warnings against cream, so every hue here is pulled down to sit on the beige.
// The workbook's 18 lead stages each belong to one of the six pipeline phases -- the same roll-up
// the "Leads by Phase" donut draws. Kept explicit rather than inferred from the colour table so a
// shade change in chartColors.js can never regroup a stage.
const LEAD_STATUS_PHASES = {
  'New Visit Completed': 'Visit', 'Thank You Sent': 'Visit',
  'Estimate Sent': 'Estimate', 'Customer Review': 'Estimate',
  'Changes Requested': 'Estimate', 'Revised Estimate Sent': 'Estimate',
  'Follow-Up 1 Sent': 'Follow-Up', 'Follow-Up 2 Sent': 'Follow-Up',
  'No Response - Call': 'Follow-Up', 'No Response - Visit': 'Follow-Up',
  'Follow-Up Later': 'Follow-Up',
  'Customer Approved': 'Closing', 'Agreement Pending': 'Closing',
  'Payment Pending': 'Closing', 'Onboarding Pending': 'Closing',
  'Service Started': 'Won',
  'Not Interested': 'Lost', 'Closed': 'Lost'
};

// The eight workbook headline metrics, in the sheet's own order and muted tones.
const KPI_DEFS = [
  { key: 'totalLeads', label: 'Total Leads', color: '#9B8AA6' },
  { key: 'dueToday', label: 'Due Today', color: '#BD9D66' },
  { key: 'overdue', label: 'Overdue Follow-Ups', color: '#C07C6D' },
  { key: 'upcoming', label: 'Upcoming', color: '#8CA9C4' },
  { key: 'estimatesSent', label: 'Estimates Sent', color: '#BFA56B' },
  { key: 'approved', label: 'Customer Approved', color: '#7FA7A3' },
  { key: 'serviceStarted', label: 'Service Started', color: '#87A878' },
  { key: 'notInterested', label: 'Not Interested', color: '#A89C92' }
];

const PRIORITY_COLORS = MARKETING_PRIORITY_COLORS;
const LEAD_STATUS_COLORS = MARKETING_LEAD_STATUS_COLORS;
const SOURCE_PALETTE = MARKETING_CATEGORICAL;

// ---- Date filters -----------------------------------------------------------
// The same windows the Estimates dashboard offers: one range picker filters the whole page
// server-side, and each chart card can narrow itself to a period without touching the rest --
// the API sends the slim rows along with the aggregates so a card recounts them in the browser.
const CHART_PERIODS = [
  { id: 'all', label: 'All Time' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'half', label: 'Last 6 Months' },
  { id: 'year', label: 'This Year' }
];

const ChartPeriodSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-xs border border-warm-border rounded-lg px-2 py-1 bg-white text-warm-text outline-none cursor-pointer focus:border-warm-accent"
  >
    {CHART_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
  </select>
);

const periodStart = (period) => {
  const now = new Date();
  switch (period) {
    case 'week': { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0, 0, 0, 0); return d; }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'half': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case 'year': return new Date(now.getFullYear(), 0, 1);
    default: return null;
  }
};
const inPeriod = (createdAt, period) => {
  const start = periodStart(period);
  return !start || Boolean(createdAt && new Date(createdAt) >= start);
};

// The client-side mirror of the server's counting in utils/marketingDashboard.js -- used only
// when a card picks a window narrower than the page's, so the aggregate the server already
// computed still answers the common case.
const cleanVal = (v) => decodeEntities(String(v || '')).trim();
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND_SENT = ['Estimate Sent', 'Revision Required', 'Revised Estimate Sent', 'Approved', 'Rejected'];
const PRIORITY_ORDER = ['Low', 'Medium', 'High', 'Urgent'];

const buildTrendFrom = (rows, months = 6) => {
  const now = new Date();
  const buckets = [];
  const index = new Map();
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const bucket = { month: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), leads: 0, estimates: 0, approved: 0 };
    index.set(`${d.getFullYear()}-${d.getMonth()}`, bucket);
    buckets.push(bucket);
  }
  rows.forEach(r => {
    if (!r.created_at) return;
    const c = new Date(r.created_at);
    if (Number.isNaN(c.getTime())) return;
    const b = index.get(`${c.getFullYear()}-${c.getMonth()}`);
    if (!b) return;
    const st = cleanVal(r.tracker_status);
    b.leads += 1;
    if (TREND_SENT.includes(st)) b.estimates += 1;
    if (st === 'Approved') b.approved += 1;
  });
  return buckets;
};

// All six chart datasets from raw rows. `order` pins a fixed bucket order (the 18 lead stages);
// any value outside it -- a legacy spelling -- still gets its own bucket at the end.
const chartsFromRows = (rows) => {
  const byField = (field, order) => {
    const counts = new Map();
    rows.forEach(r => { const k = cleanVal(r[field]); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
    const out = (order || [...counts.keys()]).map(name => ({ name, value: counts.get(name) || 0 }));
    if (order) for (const [name, value] of counts) if (!order.includes(name)) out.push({ name, value });
    return order ? out : out.filter(e => e.value > 0);
  };
  const leadStatuses = byField('lead_status', LEAD_STATUSES)
    .map(s => ({ ...s, fill: LEAD_STATUS_COLORS[s.name] || '#94A3B8' }));
  const phaseTotals = {};
  leadStatuses.forEach(s => {
    const phase = LEAD_STATUS_PHASES[s.name];
    if (phase) phaseTotals[phase] = (phaseTotals[phase] || 0) + s.value;
  });
  // Phases, sources and priorities keep every bucket -- the legend lists the whole vocabulary
  // at zero, the way the Estimates dashboard's statusDataAll does; the pie filters to value > 0
  // at render.
  const phases = Object.keys(MARKETING_PHASE_COLORS)
    .map(p => ({ name: p, value: phaseTotals[p] || 0, fill: MARKETING_PHASE_COLORS[p] }));
  return {
    leadStatuses,
    phases,
    sources: byField('lead_source', LEAD_SOURCES)
      .map((s, i) => ({ ...s, fill: SOURCE_PALETTE[i % SOURCE_PALETTE.length] })),
    priorities: byField('priority', PRIORITY_ORDER)
      .map(p => ({ ...p, fill: PRIORITY_COLORS[p.name] || '#94A3B8' })),
    trend: buildTrendFrom(rows, monthsSinceEarliest(rows.map(r => r.created_at))),
    nextActions: byField('next_action')
      .sort((a, b) => b.value - a.value)
      .map(a => ({ ...a, fill: EXECUTIVE_ACTIONS.includes(a.name) ? MARKETING_OWNER_COLORS.Executive : MARKETING_OWNER_COLORS.Coordinator }))
  };
};

// The donut draws only populated slices; the legend under it still lists every bucket.
const nonZero = (rows) => (rows || []).filter(r => r.value > 0);

// Merge a server aggregate onto a fixed bucket order -- zeros kept, values outside the list
// (legacy spellings) appended after it.
const orderMerge = (agg, order) => {
  const counts = new Map((agg || []).map(e => [e.name, e.value]));
  const out = order.map(name => ({ name, value: counts.get(name) || 0 }));
  for (const e of agg || []) if (!order.includes(e.name)) out.push({ name: e.name, value: e.value });
  return out;
};

// Who the next action belongs to, so the queue says at a glance whose day it is.
const EXECUTIVE_ACTIONS = ['Executive Call', 'Executive Visit', 'Onboard Property', 'Start Service'];

const axisProps = { tick: { fontSize: 11, fill: '#6B7280' }, stroke: '#EADFCF' };

const Card = ({ title, subtitle, right, children, className = '' }) => (
  <div className={`bg-white border border-warm-border rounded-xl shadow-warm overflow-hidden ${className}`}>
    <div className="px-5 py-3.5 border-b border-warm-border bg-warm-section flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-warm-text truncate">{title}</h3>
        {subtitle && <p className="text-[11px] text-warm-muted truncate">{subtitle}</p>}
      </div>
      {right && <div className="text-[11px] text-warm-muted flex-shrink-0">{right}</div>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// One tooltip for every chart on the page. It always names the point and states its value; where
// a `total` is given it adds the share, which is the question a slice of a donut actually raises.
const ChartTip = ({ active, payload, label, formatter, total }) => {
  if (!active || !payload || !payload.length) return null;
  // A pie hands the slice name on the datum rather than as the axis label.
  const heading = label != null && label !== '' ? label : payload[0]?.payload?.name;
  return (
    <div className="bg-white border border-warm-border rounded-lg shadow-lg px-3 py-2 text-xs min-w-[132px]">
      {heading && <div className="font-semibold text-warm-text mb-1">{heading}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: entry.color || entry.payload?.fill }} />
          <span className="text-warm-muted">{entry.name}</span>
          <span className="font-semibold text-warm-text ml-auto">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
      {total > 0 && (
        <div className="text-[11px] text-warm-muted mt-1 pt-1 border-t border-warm-border">
          {Math.round((payload[0].value / total) * 100)}% of {total}
        </div>
      )}
    </div>
  );
};

const sumOf = (rows) => (rows || []).reduce((sum, r) => sum + (Number(r.value) || 0), 0);

// Value drawn on the slice itself, so the donut is readable without hovering. Thin slices are
// skipped -- a number that does not fit is worse than no number.
const sliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
  if (percent < 0.06) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const radian = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * radian);
  const y = cy + radius * Math.sin(-midAngle * radian);
  return (
    <text x={x} y={y} fill="#FFFFFF" textAnchor="middle" dominantBaseline="central"
          fontSize={12} fontWeight={600} style={{ pointerEvents: 'none' }}>
      {value}
    </text>
  );
};

// Name, count and share under a donut. The legend is where the labels live, because 18 stage
// names will not fit around a 240px circle.
const DonutLegend = ({ rows, columns = 2 }) => {
  const total = sumOf(rows);
  return (
    <div className={`grid ${columns === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-x-3 gap-y-1.5 mt-2`}>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: row.fill }} />
          <span className="text-warm-muted truncate" title={row.name}>{row.name}</span>
          <span className="font-semibold text-warm-text ml-auto">{row.value}</span>
          {total > 0 && (
            <span className="text-warm-muted/80 tabular-nums w-9 text-right">
              {Math.round((row.value / total) * 100)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// A chart with nothing in it states so, rather than drawing empty axes.
const NoData = ({ height = 240, note = 'Nothing tracked yet' }) => (
  <div className="flex flex-col items-center justify-center text-warm-muted" style={{ height }}>
    <div className="text-3xl font-bold text-warm-border mb-1">0</div>
    <div className="text-xs">{note}</div>
  </div>
);

// Shared by the FP, admin and Ops Manager portals; `portalType` picks the API prefix and, for the
// admin, the partner the figures are narrowed to. See utils/marketingApi.js.
const MarketingDashboard = ({ user, portalType = 'franchise' }) => {
  const token = getAuthToken();
  const apiPath = getMarketingApiPath(portalType);
  const { selectedFp } = useFP();
  const fpId = marketingFpId(portalType, selectedFp);
  // Marketing belongs to the franchise partner account inside the FP portal, so an FP's own
  // manager is refused there. These same screens are the Ops Manager portal's own Marketing
  // section, where a 'manager' role is exactly who they are for -- so what decides is the portal,
  // not the role on its own.
  const unavailable = portalType === 'franchise' && user?.role === 'manager';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // The page-wide window (server-side) and each card's own window (client-side).
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartPeriods, setChartPeriods] = useState({});

  const loadDashboard = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const qs = params.toString();
      const base = withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/dashboard`, fpId);
      const res = await fetch(qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) setData(result.data);
      else setLoadError(result.message || 'Failed to load dashboard data.');
    } catch (e) {
      setLoadError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiPath, fpId, startDate, endDate]);

  useEffect(() => { if (!unavailable) loadDashboard(false); }, [unavailable, loadDashboard]);

  // Charts want colours and labels attached; the API deliberately returns raw names and codes.
  // When the API's slim rows are present they're the source for every chart, so one counting
  // path serves both the whole-page view and a card's own narrower window.
  const charts = useMemo(() => {
    if (!data) return null;
    if (Array.isArray(data.rows)) return chartsFromRows(data.rows);
    const leadStatuses = (data.byLeadStatus || [])
      .map(s => ({ ...s, fill: LEAD_STATUS_COLORS[s.name] || '#94A3B8' }));
    // Roll the 18 stages up into the six phases for the headline donut.
    const phaseTotals = {};
    leadStatuses.forEach(s => {
      const phase = LEAD_STATUS_PHASES[s.name];
      if (phase) phaseTotals[phase] = (phaseTotals[phase] || 0) + s.value;
    });
    const phases = Object.keys(MARKETING_PHASE_COLORS)
      .map(p => ({ name: p, value: phaseTotals[p] || 0, fill: MARKETING_PHASE_COLORS[p] }));
    return {
      leadStatuses,
      phases,
      // Donuts draw only what exists, but their legends list the whole vocabulary at zero.
      sources: orderMerge(data.byLeadSource, LEAD_SOURCES)
        .map((s, i) => ({ ...s, fill: SOURCE_PALETTE[i % SOURCE_PALETTE.length] })),
      priorities: orderMerge(data.byPriority, PRIORITY_ORDER)
        .map(p => ({ ...p, fill: PRIORITY_COLORS[p.name] || '#94A3B8' })),
      trend: Array.isArray(data.rows)
        ? buildTrendFrom(data.rows, monthsSinceEarliest(data.rows.map(r => r.created_at)))
        : (data.trend || []).map(t => (t.year && !/\d{4}$/.test(t.month) ? { ...t, month: `${t.month} ${t.year}` } : t)),
      nextActions: (data.byNextAction || [])
        .slice()
        .sort((a, b) => b.value - a.value)
        .map(a => ({ ...a, fill: EXECUTIVE_ACTIONS.includes(a.name) ? MARKETING_OWNER_COLORS.Executive : MARKETING_OWNER_COLORS.Coordinator }))
    };
  }, [data]);

  // A card's own period select narrows just that card; 'all' reuses the page-level set.
  const chartFor = (key) => {
    const period = chartPeriods[key] || 'all';
    if (period === 'all' || !Array.isArray(data?.rows) || !charts) return charts;
    return chartsFromRows(data.rows.filter(r => inPeriod(r.created_at, period)));
  };
  const periodSelect = (key) => Array.isArray(data?.rows) ? (
    <ChartPeriodSelect value={chartPeriods[key] || 'all'} onChange={(v) => setChartPeriods(p => ({ ...p, [key]: v }))} />
  ) : null;

  if (unavailable) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-warm-border shadow-warm p-10 text-center">
          <Megaphone className="w-10 h-10 mx-auto mb-3 text-warm-accent" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-text">Marketing is not available for your account</h2>
          <p className="text-sm text-warm-muted mt-1">This section is available to the franchise partner account only.</p>
        </div>
      </div>
    );
  }

  const header = (
    <div className="bg-warm-section border border-warm-border rounded-xl shadow-warm px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 bg-warm-accent-soft rounded-[10px] flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-warm-accent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-warm-text">Marketing Dashboard</h1>
          <p className="text-xs text-warm-muted">Lead and conversion insights for direct estimates</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
        <button
          onClick={() => loadDashboard(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors flex-shrink-0 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
    </div>
  );

  // Each card's own window; they stay null until `charts` exists, matching the render guard below.
  const cPhases = chartFor('phases');
  const cSources = chartFor('sources');
  const cPriorities = chartFor('priorities');
  const cStatuses = chartFor('leadStatuses');
  const cTrend = chartFor('trend');
  const cActions = chartFor('nextActions');

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {header}
        <div className="bg-white rounded-xl border border-warm-border shadow-warm flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
          <span className="ml-2 text-warm-muted">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const totals = data?.totals || {};
  const hasLeads = (totals.totalLeads || 0) > 0;

  return (
    <div className="p-6 space-y-6">
      {header}

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{loadError}</p>
        </div>
      )}

      {!loadError && !hasLeads ? (
        <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
          <EmptyState
            icon={Target}
            title="No tracked estimates yet"
            description="Track a direct estimate in Marketing > Tracker and its numbers appear here"
          />
        </div>
      ) : !loadError && charts && (
        <>
          {/* Headline figures — the workbook's eight metrics, each sized against total leads */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_DEFS.map((k) => {
              const value = Number(totals[k.key]) || 0;
              const totalLeads = Number(totals.totalLeads) || 0;
              return (
                <div key={k.key} className="bg-white border border-warm-border rounded-xl shadow-warm p-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: k.color }} />
                    <span className="text-xs text-warm-muted truncate">{k.label}</span>
                  </div>
                  <div className="text-2xl font-semibold mt-1.5" style={{ color: value > 0 ? '#111827' : '#9CA3AF' }}>
                    {value}
                  </div>
                  <div className="h-1.5 bg-warm-section rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalLeads > 0 ? Math.min(100, (value / totalLeads) * 100) : 0}%`,
                        background: k.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* The mix at a glance: pipeline phase, where leads came from, how urgent they are */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Leads by Phase" subtitle="18 tracker stages rolled into 6 phases" right={periodSelect('phases')}>
              {nonZero(cPhases.phases).length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={nonZero(cPhases.phases)} dataKey="value" nameKey="name" cx="50%" cy="50%"
                         innerRadius={58} outerRadius={92} paddingAngle={2} isAnimationActive={false}
                         label={sliceLabel} labelLine={false}>
                      {nonZero(cPhases.phases).map((p, i) => <Cell key={i} fill={p.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip total={sumOf(cPhases.phases)} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <NoData height={260} note="No lead status set yet" />}
              <DonutLegend rows={cPhases.phases} />
            </Card>

            <Card title="Lead Source Mix" subtitle="Where the leads came from" right={periodSelect('sources')}>
              {nonZero(cSources.sources).length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={nonZero(cSources.sources)} dataKey="value" nameKey="name" cx="50%" cy="50%"
                         innerRadius={52} outerRadius={90} paddingAngle={2} isAnimationActive={false}
                         label={sliceLabel} labelLine={false}>
                      {nonZero(cSources.sources).map((s, i) => <Cell key={i} fill={s.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip total={sumOf(cSources.sources)} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <NoData height={260} note="No lead source recorded" />}
              <DonutLegend rows={cSources.sources} columns={1} />
            </Card>

            <Card title="Priority Split" subtitle="Urgent work first" right={periodSelect('priorities')}>
              {nonZero(cPriorities.priorities).length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={nonZero(cPriorities.priorities)} dataKey="value" nameKey="name" cx="50%" cy="50%"
                         innerRadius={58} outerRadius={92} paddingAngle={2} isAnimationActive={false}
                         label={sliceLabel} labelLine={false}>
                      {nonZero(cPriorities.priorities).map((p, i) => <Cell key={i} fill={p.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip total={sumOf(cPriorities.priorities)} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <NoData height={260} note="No priority set" />}
              <DonutLegend rows={cPriorities.priorities} />
            </Card>
          </div>

          {/* Lead status: the workbook's own 18-stage breakdown */}
          <Card title="Lead Status Breakdown" subtitle="Every stage on the tracker, coloured by phase"
                right={<span className="flex items-center gap-2">
                  <span>{totals.missingNextDate > 0 ? `${totals.missingNextDate} open with no next date` : 'hover a bar for the count'}</span>
                  {periodSelect('leadStatuses')}
                </span>}>
            {cStatuses.leadStatuses.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={430}>
                <BarChart data={cStatuses.leadStatuses} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#F3EDE3" />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={152} {...axisProps} />
                  <Tooltip content={<ChartTip total={sumOf(cStatuses.leadStatuses)} />} cursor={{ fill: '#FFF9EE' }} />
                  <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={15} isAnimationActive={false}>
                    {cStatuses.leadStatuses.map((s, i) => <Cell key={i} fill={s.value > 0 ? s.fill : '#EADFCF'} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6B7280' }}
                               formatter={(v) => (v > 0 ? v : '')} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData height={430} note="No lead status set yet" />}
          </Card>

          {/* Trend and the day's workload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Lead Trend" subtitle={trendSpanLabel(cTrend.trend, 'month') || 'Leads, estimates and approvals over time'} right={periodSelect('trend')}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cTrend.trend} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fpMktLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9B8AA6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#9B8AA6" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="fpMktEstimates" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BFA56B" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#BFA56B" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE3" />
                  <XAxis dataKey="month" stroke={axisProps.stroke} {...TREND_X_AXIS} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#9B8AA6" strokeWidth={2}
                        fill="url(#fpMktLeads)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="estimates" name="Estimates" stroke="#BFA56B" strokeWidth={2}
                        fill="url(#fpMktEstimates)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="approved" name="Approved" stroke="#7FA7A3" strokeWidth={2}
                        dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs text-warm-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#9B8AA6]" />Leads</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#BFA56B]" />Estimates</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#7FA7A3]" />Approved</span>
              </div>
            </Card>

            <Card title="Next Action Workload" subtitle="Who has to do what next" right={periodSelect('nextActions')}>
              {cActions.nextActions.some(a => a.value > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cActions.nextActions.filter(a => a.value > 0)} margin={{ left: 0, right: 12, top: 8, bottom: 52 }}>
                    <CartesianGrid vertical={false} stroke="#F3EDE3" />
                    <XAxis dataKey="name" {...axisProps} angle={-35} textAnchor="end" interval={0} height={70} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip content={<ChartTip total={sumOf(cActions.nextActions)} />} cursor={{ fill: '#FFF9EE' }} />
                    <Bar dataKey="value" name="Pending" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {cActions.nextActions.filter(a => a.value > 0).map((a, i) => <Cell key={i} fill={a.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <NoData height={280} note="No next action set yet" />}
              <div className="flex items-center gap-4 mt-3 text-xs text-warm-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: MARKETING_OWNER_COLORS.Coordinator }} />Employee
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: MARKETING_OWNER_COLORS.Executive }} />Executive
                </span>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketingDashboard;
