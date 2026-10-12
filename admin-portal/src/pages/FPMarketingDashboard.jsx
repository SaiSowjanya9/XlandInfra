import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, Megaphone, Loader2, AlertCircle, RefreshCw, Target,
  Users, Send, CheckCircle, XCircle, ClipboardCheck, Share2, TrendingUp,
  AlertTriangle, CalendarClock, CalendarDays, PlayCircle
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area, Line, LabelList,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { getAuthToken } from '../utils/safeStorage';
import { getPropertyTypeLabel } from '../utils/estimatePackageUtils';
import EmptyState from '../components/common/EmptyState';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Marketing Dashboard reports on the rows Marketing > Tracker edits. Every figure arrives
// pre-aggregated from GET /api/fp/marketing/dashboard (backend/utils/marketingDashboard.js owns
// the counting rules), so this file only draws.
//
// The page follows the FP portal's warm beige skin, and gold #B5812A -- not the lighter
// warm-accent -- carries white text, the same contrast rule the warm estimate screens follow.
const GOLD = '#B5812A';

// Each follow-up step gets the colour of the phase it belongs to, so the stage chart reads as a
// pipeline rather than seven unrelated bars.
const STAGE_COLORS = {
  'Step 1 - Thank You': '#8B5CF6',
  'Step 2 - Estimate Shared': '#FBBF24',
  'Step 3 - Follow-Up 1': '#3B82F6',
  'Step 4 - Follow-Up 2': '#3B82F6',
  'Step 5A - Executive Call': '#06B6D4',
  'Step 5B - Customer Visit': '#06B6D4',
  'Closed': '#10B981'
};

// Pipeline order, ending at the two outcomes. Matches STATUS_COLORS in utils/chartColors.js where
// the names overlap (Approved teal, Rejected red) so a status keeps one colour across the portal.
const STATUS_COLORS = {
  'Not Started': '#9CA3AF',
  'Created by Executive': '#8B5CF6',
  'Pending Coordinator Review': '#F59E0B',
  'Reviewed by Coordinator': '#6366F1',
  'Estimate Sent': '#FBBF24',
  'Revision Required': '#F97316',
  'Revised Estimate Sent': '#EAB308',
  'Approved': '#14B8A6',
  'Rejected': '#EF4444'
};

const PRIORITY_COLORS = { Urgent: '#DC2626', High: '#EA580C', Medium: '#CA8A04', Low: '#0D9488' };

// Due Status drives the day's work, so the colours match the badges on the tracker: overdue is
// the only loud one, because it is the only state that means somebody is late.
const DUE_COLORS = {
  'Overdue': '#EF4444',
  'Due Today': '#F59E0B',
  'Upcoming': '#3B82F6',
  'Completed': '#10B981',
  'No Date': '#9CA3AF'
};

// The workbook's 18 lead statuses, grouped so the chart reads as a pipeline rather than 18
// unrelated bars.
const LEAD_STATUS_COLORS = {
  'New Visit Completed': '#8B5CF6', 'Thank You Sent': '#8B5CF6',
  'Estimate Sent': '#FBBF24', 'Follow-Up 1 Sent': '#3B82F6', 'Follow-Up 2 Sent': '#3B82F6',
  'No Response - Call': '#F97316', 'No Response - Visit': '#F97316',
  'Customer Review': '#FBBF24', 'Changes Requested': '#F97316', 'Revised Estimate Sent': '#EAB308',
  'Customer Approved': '#14B8A6', 'Agreement Pending': '#06B6D4', 'Payment Pending': '#06B6D4',
  'Onboarding Pending': '#06B6D4', 'Service Started': '#10B981',
  'Follow-Up Later': '#9CA3AF', 'Not Interested': '#EF4444', 'Closed': '#78716C'
};

// Who the next action belongs to, so the queue says at a glance whose day it is.
const EXECUTIVE_ACTIONS = ['Executive Call', 'Executive Visit', 'Onboard Property', 'Start Service'];

const SOURCE_PALETTE = ['#8B5CF6', '#3B82F6', '#14B8A6', '#FBBF24', '#EF4444', '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#78716C'];

const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

// Axis and headline labels: one decimal, but never a dangling ".0" (₹51L, not ₹51.0L).
const trim1 = (n) => n.toFixed(1).replace(/\.0$/, '');
const compactInr = (value) => {
  const n = Number(value) || 0;
  if (n >= 10000000) return `₹${trim1(n / 10000000)}Cr`;
  if (n >= 100000) return `₹${trim1(n / 100000)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
};

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

// One tooltip for every chart on the page.
const ChartTip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-warm-border rounded-lg shadow-lg px-3 py-2 text-xs">
      {label != null && label !== '' && <div className="font-semibold text-warm-text mb-1">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: entry.color || entry.payload?.fill }} />
          <span className="text-warm-muted">{entry.name}</span>
          <span className="font-semibold text-warm-text ml-auto">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
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

const StatCard = ({ icon: Icon, label, value, tone = '#8B5CF6', hint }) => (
  <div className="bg-[#FFFAF0] border border-[#F1E3C6] rounded-xl p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-full bg-warm-accent-soft flex items-center justify-center flex-shrink-0">
      <Icon className="w-[18px] h-[18px]" style={{ color: tone }} />
    </div>
    <div className="min-w-0">
      <div className="text-[20px] font-semibold text-[#111827] leading-tight">{value}</div>
      <div className="text-[13px] text-[#6B7280] truncate" title={hint || label}>{label}</div>
    </div>
  </div>
);

const FPMarketingDashboard = ({ user }) => {
  const token = getAuthToken();
  const isFPManager = user?.role === 'manager';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE}/api/fp/marketing/dashboard`, {
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
  }, [token]);

  useEffect(() => { if (!isFPManager) loadDashboard(false); }, [isFPManager, loadDashboard]);

  // Charts want colours and labels attached; the API deliberately returns raw names and codes.
  const charts = useMemo(() => {
    if (!data) return null;
    const stages = (data.byFollowUpStage || []).map(s => ({ ...s, fill: STAGE_COLORS[s.name] || '#94A3B8' }));
    const statuses = (data.byTrackerStatus || []).map(s => ({ ...s, fill: STATUS_COLORS[s.name] || '#94A3B8' }));
    return {
      stages,
      statuses,
      // Donuts and ranked bars only carry what exists; a zero slice is noise.
      statusSlices: statuses.filter(s => s.value > 0),
      sources: (data.byLeadSource || [])
        .filter(s => s.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((s, i) => ({ ...s, fill: SOURCE_PALETTE[i % SOURCE_PALETTE.length] })),
      priorities: (data.byPriority || [])
        .filter(p => p.value > 0)
        .map(p => ({ ...p, fill: PRIORITY_COLORS[p.name] || '#94A3B8' })),
      propertyTypes: (data.byPropertyType || [])
        .filter(p => p.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((p, i) => ({ ...p, name: getPropertyTypeLabel(p.name), fill: SOURCE_PALETTE[i % SOURCE_PALETTE.length] })),
      valueByStatus: (data.valueByStatus || [])
        .slice()
        .sort((a, b) => b.value - a.value)
        .map(v => ({ ...v, fill: STATUS_COLORS[v.name] || '#94A3B8' })),
      trend: data.trend || [],
      leadStatuses: (data.byLeadStatus || []).map(s => ({ ...s, fill: LEAD_STATUS_COLORS[s.name] || '#94A3B8' })),
      nextActions: (data.byNextAction || [])
        .slice()
        .sort((a, b) => b.value - a.value)
        .map(a => ({ ...a, fill: EXECUTIVE_ACTIONS.includes(a.name) ? '#8B5CF6' : GOLD })),
      dueSlices: (data.byDueStatus || [])
        .filter(d => d.value > 0)
        .map(d => ({ ...d, fill: DUE_COLORS[d.name] || '#94A3B8' }))
    };
  }, [data]);

  if (isFPManager) {
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
      <button
        onClick={() => loadDashboard(true)}
        disabled={refreshing || loading}
        className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors flex-shrink-0 disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>
  );

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
          {/* Headline figures */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Leads" value={totals.totalLeads} tone="#8B5CF6" />
            <StatCard icon={Send} label="Estimates Sent" value={totals.estimatesSent} tone="#FBBF24"
                      hint="Leads whose estimate has been shared at least once" />
            <StatCard icon={CheckCircle} label="Approved" value={totals.approved} tone="#14B8A6" />
            <StatCard icon={XCircle} label="Not Interested" value={totals.notInterested} tone="#EF4444"
                      hint="Rejected, or the customer declined" />
            <StatCard icon={ClipboardCheck} label="Pending Coordinator Review" value={totals.pendingReview} tone="#F59E0B"
                      hint="Rows not positively marked reviewed" />
            <StatCard icon={Share2} label="Referral Leads" value={totals.referralLeads} tone="#06B6D4" />
            <StatCard icon={TrendingUp} label="Open Pipeline" value={compactInr(totals.openValue)} tone="#3B82F6"
                      hint={`Estimate value not yet approved or rejected — ${inr(totals.openValue)}`} />
            <StatCard icon={CheckCircle} label="Approved Value" value={compactInr(totals.wonValue)} tone="#10B981"
                      hint={inr(totals.wonValue)} />
          </div>

          {/* The day's follow-up position. Overdue leads the row because it is the only figure
              that means somebody is already late. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={AlertTriangle} label="Overdue Follow-Ups" value={totals.overdue} tone="#EF4444"
                      hint="Next follow-up date has passed" />
            <StatCard icon={CalendarClock} label="Due Today" value={totals.dueToday} tone="#F59E0B" />
            <StatCard icon={CalendarDays} label="Upcoming" value={totals.upcoming} tone="#3B82F6" />
            <StatCard icon={PlayCircle} label="Service Started" value={totals.serviceStarted} tone="#10B981" />
          </div>

          {/* Funnel + win rate */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" title="Conversion Funnel"
                  subtitle="Lead → estimate shared → approved"
                  right="% is of the step above">
              <div className="space-y-3">
                {(data.funnel || []).map((step) => (
                  <div key={step.name} className="flex items-center gap-4">
                    <div className="w-32 text-xs text-warm-muted flex-shrink-0 text-right">{step.name}</div>
                    <div className="flex-1 h-11 bg-warm-section rounded-lg relative overflow-hidden">
                      <div
                        className="h-full rounded-lg flex items-center px-3"
                        style={{
                          width: `${Math.max(step.ofTotal, step.value > 0 ? 8 : 0)}%`,
                          background: step.name === 'Approved' ? '#14B8A6' : step.name === 'Estimates Sent' ? '#FBBF24' : '#8B5CF6'
                        }}
                      >
                        <span className="text-sm font-semibold text-white">{step.value}</span>
                      </div>
                    </div>
                    <div className="w-24 flex-shrink-0 text-right">
                      {step.ofPrevious === null
                        ? <span className="text-[11px] text-warm-muted">baseline</span>
                        : (
                          <span className={`text-xs font-semibold ${
                            step.ofPrevious >= 50 ? 'text-emerald-600' : step.ofPrevious >= 25 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {step.ofPrevious}% <span className="text-warm-muted font-normal">of prev</span>
                          </span>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Win Rate" subtitle="Approved ÷ total leads">
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    data={[{ name: 'Win rate', value: totals.winRate, fill: '#14B8A6' }]}
                    startAngle={210} endAngle={-30} innerRadius="68%" outerRadius="100%" barSize={20}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#F3EDE3' }} isAnimationActive={false} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-3xl font-bold text-warm-text">{totals.winRate}%</div>
                  <div className="text-[11px] text-warm-muted">{totals.approved} of {totals.totalLeads}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Lead status: the workbook's own 18-stage breakdown */}
          <Card title="Lead Status" subtitle="Every stage on the tracker, coloured by phase"
                right={totals.missingNextDate > 0 ? `${totals.missingNextDate} open with no next date` : null}>
            {charts.leadStatuses.some(s => s.value > 0) ? (
              <ResponsiveContainer width="100%" height={430}>
                <BarChart data={charts.leadStatuses} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="#F3EDE3" />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={152} {...axisProps} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF9EE' }} />
                  <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={15} isAnimationActive={false}>
                    {charts.leadStatuses.map((s, i) => <Cell key={i} fill={s.value > 0 ? s.fill : '#EADFCF'} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6B7280' }}
                               formatter={(v) => (v > 0 ? v : '')} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData height={430} note="No lead status set yet" />}
          </Card>

          {/* The day's work: what is due, and what has to be done next */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3" title="Next Action Queue"
                  subtitle="What has to happen next, most common first"
                  right="gold = Coordinator · violet = Executive">
              {charts.nextActions.some(a => a.value > 0) ? (
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart data={charts.nextActions} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#F3EDE3" />
                    <XAxis type="number" allowDecimals={false} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={165} {...axisProps} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF9EE' }} />
                    <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={15} isAnimationActive={false}>
                      {charts.nextActions.map((a, i) => <Cell key={i} fill={a.value > 0 ? a.fill : '#EADFCF'} />)}
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6B7280' }}
                                 formatter={(v) => (v > 0 ? v : '')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <NoData height={330} note="No next action set yet" />}
            </Card>

            <Card className="lg:col-span-2" title="Due Status" subtitle="How the follow-up queue stands today">
              {charts.dueSlices.length ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={charts.dueSlices} dataKey="value" nameKey="name" cx="50%" cy="50%"
                           innerRadius={58} outerRadius={94} paddingAngle={2} isAnimationActive={false}>
                        {charts.dueSlices.map((s, i) => <Cell key={i} fill={s.fill} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                    {charts.dueSlices.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.fill }} />
                        <span className="text-warm-muted truncate">{s.name}</span>
                        <span className="font-semibold text-warm-text ml-auto">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <NoData height={240} note="No follow-up dates set" />}
            </Card>
          </div>

          {/* Pipeline shape */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Follow-Up Stage" subtitle="Where each lead sits in the follow-up sequence"
                  right={totals.missingStage > 0 ? `${totals.missingStage} with no stage set` : null}>
              {charts.stages.some(s => s.value > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={charts.stages} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#F3EDE3" />
                    <XAxis type="number" allowDecimals={false} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF9EE' }} />
                    <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                      {charts.stages.map((s, i) => <Cell key={i} fill={s.value > 0 ? s.fill : '#EADFCF'} />)}
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6B7280' }}
                                 formatter={(v) => (v > 0 ? v : '')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <NoData height={280} note="No follow-up stage set yet" />}
            </Card>

            <Card title="Estimate Status" subtitle="Share of the pipeline by status">
              {charts.statusSlices.length ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={charts.statusSlices} dataKey="value" nameKey="name" cx="50%" cy="50%"
                           innerRadius={62} outerRadius={96} paddingAngle={2} isAnimationActive={false}>
                        {charts.statusSlices.map((s, i) => <Cell key={i} fill={s.fill} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: 240 }}>
                    <div className="text-2xl font-bold text-warm-text">{totals.totalLeads}</div>
                    <div className="text-[11px] text-warm-muted">Total Leads</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                    {charts.statusSlices.map((s) => (
                      <div key={s.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.fill }} />
                        <span className="text-warm-muted truncate" title={s.name}>{s.name}</span>
                        <span className="font-semibold text-warm-text ml-auto">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <NoData height={240} />}
            </Card>
          </div>

          {/* Value and trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Pipeline Value by Status" subtitle="Estimate value sitting at each status"
                  right={`Open ${compactInr(totals.openValue)}`}>
              {charts.valueByStatus.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={charts.valueByStatus} margin={{ left: 8, right: 12, top: 14, bottom: 64 }}>
                    <CartesianGrid vertical={false} stroke="#F3EDE3" />
                    <XAxis dataKey="name" angle={-32} textAnchor="end" interval={0} height={84} {...axisProps} />
                    <YAxis tickFormatter={compactInr} width={58} {...axisProps} />
                    <Tooltip content={<ChartTip formatter={inr} />} cursor={{ fill: '#FFF9EE' }} />
                    <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {charts.valueByStatus.map((v, i) => <Cell key={i} fill={v.fill} />)}
                      <LabelList dataKey="value" position="top" formatter={compactInr}
                                 style={{ fontSize: 10, fill: '#6B7280' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <NoData height={300} note="No estimate value recorded" />}
            </Card>

            <Card title="Lead Trend" subtitle="Leads, estimates and approvals by creation month">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={charts.trend} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fpMktLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="fpMktEstimates" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3EDE3" />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#8B5CF6" strokeWidth={2}
                        fill="url(#fpMktLeads)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="estimates" name="Estimates" stroke="#FBBF24" strokeWidth={2}
                        fill="url(#fpMktEstimates)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="approved" name="Approved" stroke="#14B8A6" strokeWidth={2}
                        dot={{ r: 3 }} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs text-warm-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />Leads</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FBBF24]" />Estimates</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#14B8A6]" />Approved</span>
              </div>
            </Card>
          </div>

          {/* Lead quality mix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Lead Source" subtitle="Where the leads came from">
              {charts.sources.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={charts.sources} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#F3EDE3" />
                    <XAxis type="number" allowDecimals={false} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={112} {...axisProps} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF9EE' }} />
                    <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                      {charts.sources.map((s, i) => <Cell key={i} fill={s.fill} />)}
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6B7280' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <NoData height={260} note="No lead source recorded" />}
            </Card>

            <Card title="Priority" subtitle="Urgent work first">
              {charts.priorities.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={charts.priorities} dataKey="value" nameKey="name" cx="50%" cy="50%"
                         innerRadius={56} outerRadius={92} paddingAngle={2} isAnimationActive={false}>
                      {charts.priorities.map((p, i) => <Cell key={i} fill={p.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <NoData height={260} note="No priority set" />}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                {charts.priorities.map((p) => (
                  <span key={p.name} className="flex items-center gap-1.5 text-xs text-warm-muted">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.fill }} />
                    {p.name} <span className="font-semibold text-warm-text">{p.value}</span>
                  </span>
                ))}
              </div>
            </Card>

            <Card title="Property Type" subtitle="What kind of properties are in play">
              {charts.propertyTypes.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={charts.propertyTypes} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="#F3EDE3" />
                    <XAxis type="number" allowDecimals={false} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={112} {...axisProps} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF9EE' }} />
                    <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                      {charts.propertyTypes.map((p, i) => <Cell key={i} fill={p.fill} />)}
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6B7280' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <NoData height={260} note="No property type recorded" />}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default FPMarketingDashboard;
