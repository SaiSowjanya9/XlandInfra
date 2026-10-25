import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Building2, Calendar, CalendarDays, Check, ClipboardList,
  Clock, Copy, CreditCard, FileText, HelpCircle, History, Image, Loader2, MapPin, Paperclip,
  RotateCcw, ThumbsDown, ThumbsUp, X
} from 'lucide-react';
import Modal from '../components/common/Modal';
import ViewModal, { ViewSection, ViewField, ViewGrid } from '../components/common/ViewModal';
import { useRegisterRefresh } from '../hooks/usePortalRefresh';
import bannerProperty from '../assets/banner-property.webp';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const UPLOADS_BASE_URL = '';

// Four destinations, and nothing but. A card is its icon, its name and an arrow: the summary cards
// that used to sit under them are gone, and the sentence each card carried explaining itself went
// with them -- a resident reading "Payments" does not need to be told it is where payments are.
// The same four destinations the bottom bar carries, which is why this row is `hidden lg:block`
// and the bar is `lg:hidden` -- see the section below and components/BottomNav.jsx.
const QUICK_ACCESS = [
  {
    path: '/dashboard/work-order',
    title: 'Work Orders',
    icon: ClipboardList,
    tile: 'bg-blue-50 border-blue-100 text-blue-600',
    action: 'bg-blue-50 text-blue-600'
  },
  {
    path: '/dashboard/schedule',
    title: 'Schedules',
    icon: Calendar,
    tile: 'bg-violet-50 border-violet-100 text-violet-600',
    action: 'bg-violet-50 text-violet-600'
  },
  {
    path: '/dashboard/payment',
    title: 'Payments',
    icon: CreditCard,
    tile: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    action: 'bg-emerald-50 text-emerald-600'
  },
  {
    path: '/dashboard/contact',
    title: 'Contact / Help',
    icon: HelpCircle,
    tile: 'bg-gold-600/10 border-gold-500/20 text-gold-600',
    action: 'bg-gold-600/10 text-gold-600'
  }
];

// The server sends a named tone, not a colour, because Tailwind is scanned statically: the classes
// have to be spelled out somewhere, and this is that somewhere.
// `backend/utils/customerActivity.js` is where the names are assigned.
const ACTIVITY_TONES = {
  success: 'bg-green-100 text-green-600 border-green-200',
  warning: 'bg-amber-100 text-amber-600 border-amber-200',
  info: 'bg-blue-100 text-blue-600 border-blue-200',
  danger: 'bg-red-100 text-red-600 border-red-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200'
};

const ACTIVITY_TYPES = {
  work_order: { icon: ClipboardList, tile: 'bg-blue-50 border-blue-100 text-blue-600', label: 'Work Order', action: 'View' },
  payment: { icon: CreditCard, tile: 'bg-emerald-50 border-emerald-100 text-emerald-600', label: 'Payment', action: 'View Receipt' },
  schedule: { icon: Calendar, tile: 'bg-violet-50 border-violet-100 text-violet-600', label: 'Schedule', action: 'View' }
};

/**
 * The Work Orders panel's four figures.
 *
 * Pending and In Progress are separate tiles, so each reads a count that excludes the other --
 * `stats.awaitingStart` and `stats.inProgress`, both grouped by the server. `stats.pending` is the
 * older "everything unfinished" figure and counts in-progress work inside it, so using it here
 * would report the same work order in two tiles.
 */
const WORK_ORDER_TILES = [
  { key: 'total', label: 'Total', tone: 'bg-gray-50 border-gray-200 text-gray-900' },
  { key: 'awaitingStart', label: 'Pending', tone: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'inProgress', label: 'In Progress', tone: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'completed', label: 'Completed', tone: 'bg-green-50 border-green-200 text-green-700' }
];

// Whole rupees: an outstanding balance is read at a glance, and the paise are noise at this size.
const formatCurrency = (value) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

/**
 * A `YYYY-MM-DD` value is a stored IST day and is parsed at local midnight, so it is displayed as
 * the day it says whatever zone the browser is in; a timestamp is an instant and is formatted in
 * IST, because the business runs there. Formatting the first through a timezone is what slides a
 * visit onto the previous date.
 */
const formatActivityDate = (value) => {
  if (!value) return '-';
  const text = String(value);
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = dayOnly ? new Date(`${text}T00:00:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', dayOnly
    ? { day: '2-digit', month: 'short', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

const formatTime = (time) => {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return null;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minutes || '00'} ${suffix}`;
};

const formatTimeRange = (start, end) => {
  const from = formatTime(start);
  if (!from) return 'Time to be confirmed';
  const to = formatTime(end);
  return to ? `${from} - ${to}` : from;
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="border border-dashed border-gray-200 rounded-xl py-5 px-4 text-center">
    <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-gray-100 flex items-center justify-center">
      <Icon className="w-4 h-4 text-gray-400" />
    </div>
    <p className="text-sm font-medium text-gray-900">{title}</p>
    <p className="text-xs text-gray-500 mt-0.5 max-w-xs mx-auto leading-relaxed">{description}</p>
  </div>
);

// A panel states its name and nothing else: the line of description under each title went the same
// way as the Quick Access cards' sentences.
const PanelHeader = ({ icon: Icon, title, children }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-7 h-7 shrink-0 rounded-lg bg-gold-600/10 border border-gold-500/20 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-gold-600" />
      </span>
      <h2 className="text-sm font-semibold text-gray-900 leading-tight truncate">{title}</h2>
    </div>
    {children}
  </div>
);

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(false);
  // The Work Orders panel's Activity tab: the whole work-order history, read on demand so the
  // panel's default face stays the four tiles. `?type=work_order` asks the activity route to
  // narrow its merged feed to the one stream, decoded server-side like the rest of the feed.
  const [workOrderTab, setWorkOrderTab] = useState('overview');
  const [workOrderActivity, setWorkOrderActivity] = useState([]);
  const [workOrderActivityLoading, setWorkOrderActivityLoading] = useState(false);
  const [workOrderActivityExpanded, setWorkOrderActivityExpanded] = useState(false);
  const [workOrderActivityFetched, setWorkOrderActivityFetched] = useState(false);
  const [payments, setPayments] = useState({ outstanding: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [olderWorkOrders, setOlderWorkOrders] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [processingRenewal, setProcessingRenewal] = useState(null);
  const modalRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (selectedWorkOrder) {
      setTimeout(() => {
        if (modalRef.current) modalRef.current.scrollTop = 0;
        if (overlayRef.current) overlayRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 10);
    }
  }, [selectedWorkOrder]);

  const authHeaders = () => {
    const token = localStorage.getItem('customerToken');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
  };

  const fetchDashboard = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/dashboard`, { headers });
      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
        setError(null);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recent Activity and Upcoming Schedules are one request: they are two halves of the same
  // question, and the server splits visits between them so neither panel can drop one.
  const fetchActivity = useCallback(async (limit) => {
    const headers = authHeaders();
    if (!headers) {
      setActivityLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/activity?limit=${limit}`, { headers });
      const result = await response.json();
      if (result.success) {
        setActivity(result.data.activity || []);
        setUpcomingVisits(result.data.upcomingVisits || []);
        // Counted on the server over every invoice in scope, not totalled here from the slice
        // above -- see the Payments panel.
        setPayments(result.data.payments || { outstanding: 0, pendingCount: 0 });
      }
    } catch (err) {
      console.error('Activity fetch error:', err);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // The panel tab's own fetch at the route's ceiling: the shared feed's six-item slice could hold
  // no work order at all even while the tiles count several, and an "all work orders" tab that
  // shows none is a lie. Rows open the same modal Recent Activity uses.
  const fetchWorkOrderActivity = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      setWorkOrderActivityLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/activity?limit=100&type=work_order`, { headers });
      const result = await response.json();
      if (result.success) {
        setWorkOrderActivity(result.data.activity || []);
        setWorkOrderActivityFetched(true);
      }
    } catch (err) {
      console.error('Work order activity fetch error:', err);
    } finally {
      setWorkOrderActivityLoading(false);
    }
  }, []);

  const fetchRenewals = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/renewals?status=pending_approval`, { headers });
      const result = await response.json();
      if (result.success) setRenewals(result.data || []);
    } catch (err) {
      console.error('Renewals fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchRenewals();
  }, [fetchDashboard, fetchRenewals]);

  // "View All" means the whole history, not a longer page of it: there is no activity page to send
  // anyone to, so the table grows in place and scrolls. 100 is the route's ceiling.
  const activityLimit = activityExpanded ? 100 : 6;
  useEffect(() => { fetchActivity(activityLimit); }, [fetchActivity, activityLimit]);

  // The panel's Activity tab reads its list the first time it is opened, not on page load.
  useEffect(() => {
    if (workOrderTab === 'activity' && !workOrderActivityFetched) fetchWorkOrderActivity();
  }, [workOrderTab, workOrderActivityFetched, fetchWorkOrderActivity]);

  // What the header's Refresh means on this page
  useRegisterRefresh(() => {
    fetchDashboard();
    fetchActivity(activityLimit);
    fetchRenewals();
    if (workOrderActivityFetched) fetchWorkOrderActivity();
  });

  const handleApproveRenewal = async (renewalId) => {
    const headers = authHeaders();
    if (!headers) return;

    try {
      setProcessingRenewal(renewalId);
      const response = await fetch(`${API_BASE_URL}/api/customers/renewals/${renewalId}/approve`, { method: 'POST', headers });
      const result = await response.json();
      if (result.success) {
        setRenewals(prev => prev.filter(r => r.id !== renewalId));
        alert('Renewal approved successfully!');
      } else {
        alert(result.message || 'Failed to approve renewal');
      }
    } catch (err) {
      console.error('Error approving renewal:', err);
      alert('Error approving renewal');
    } finally {
      setProcessingRenewal(null);
    }
  };

  const handleDeclineRenewal = async (renewalId) => {
    const headers = authHeaders();
    if (!headers) return;
    const reason = prompt('Please provide a reason for declining (optional):');

    try {
      setProcessingRenewal(renewalId);
      const response = await fetch(`${API_BASE_URL}/api/customers/renewals/${renewalId}/decline`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: reason || 'Customer declined' })
      });
      const result = await response.json();
      if (result.success) {
        setRenewals(prev => prev.filter(r => r.id !== renewalId));
        alert('Renewal declined.');
      } else {
        alert(result.message || 'Failed to decline renewal');
      }
    } catch (err) {
      console.error('Error declining renewal:', err);
      alert('Error declining renewal');
    } finally {
      setProcessingRenewal(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200', label: 'Pending' },
      assigned: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', label: 'Assigned' },
      in_progress: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', label: 'In Progress' },
      under_review: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', label: 'Under Review' },
      completed: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200', label: 'Completed' },
      closed: { bg: 'bg-gold-500/20', text: 'text-gray-500', border: 'border-gold-500/30', label: 'Closed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', label: 'Cancelled' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { bg: 'bg-green-100', text: 'text-green-600' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
      high: { bg: 'bg-orange-100', text: 'text-orange-600' },
      urgent: { bg: 'bg-red-100', text: 'text-red-600' }
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text} capitalize`}>
        {priority}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
  };

  const recentWorkOrders = dashboardData?.recentWorkOrders || [];
  const stats = dashboardData?.stats;
  const workOrderCounts = {
    total: Number(stats?.total) || 0,
    awaitingStart: Number(stats?.awaitingStart) || 0,
    inProgress: Number(stats?.inProgress) || 0,
    completed: Number(stats?.completed) || 0
  };
  const nextVisit = upcomingVisits[0];
  const visibleWorkOrderActivity = workOrderActivityExpanded
    ? workOrderActivity
    : workOrderActivity.slice(0, 5);

  // The Work Orders panel's View All: the panel's own Activity tab, expanded to the whole list.
  // On the tab already it toggles between the five-row preview and everything.
  const showWorkOrderHistory = () => {
    if (workOrderTab === 'activity') {
      setWorkOrderActivityExpanded(expanded => !expanded);
    } else {
      setWorkOrderTab('activity');
      setWorkOrderActivityExpanded(true);
    }
  };

  const customer = dashboardData?.customer;
  const firstName = customer?.firstName || user?.firstName || 'Resident';
  const propertyCode = customer?.propertyCode || user?.propertyCode;
  const propertyName = customer?.propertyName || user?.propertyName;

  const copyPropertyId = async () => {
    if (!propertyCode) return;
    try {
      await navigator.clipboard.writeText(propertyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the ID is on screen to read either way
    }
  };

  // A work order opens in the modal below -- the only place a customer can read one, since the Work
  // Orders page is the raise form. The dashboard carries the ten most recent, so an older row (the
  // expanded list reaches 25) fetches the full list once rather than dropping the customer into a
  // blank new-request form. Everything else goes to the page that owns it.
  const openActivity = async (item) => {
    if (item.type !== 'work_order') {
      navigate(item.type === 'payment' ? '/dashboard/payment' : '/dashboard/schedule');
      return;
    }

    const known = [...recentWorkOrders, ...olderWorkOrders].find(wo => wo.id === item.refId);
    if (known) {
      setSelectedWorkOrder(known);
      return;
    }

    const headers = authHeaders();
    if (!headers) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/work-orders`, { headers });
      const result = await response.json();
      const list = result.success ? (result.data || []) : [];
      setOlderWorkOrders(list);
      const found = list.find(wo => wo.id === item.refId);
      if (found) setSelectedWorkOrder(found);
    } catch (err) {
      console.error('Work order fetch error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Welcome banner. The decoration is the soft gold wash the rest of the site uses, plus a
          residential photo on the right (`banner-property.webp`, a stock home exterior the user
          asked for). It covers the banner's right third and melts into the cream gradient through
          a mask, so there is no hard photo edge; it hides below `sm` where the greeting and the
          property chip need the width. */}
      <section className="relative overflow-hidden rounded-2xl border border-warm-border bg-gradient-to-r from-warm-section via-warm-accent-soft to-gold-100">
        <div className="pointer-events-none absolute -top-16 -right-12 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-28 w-56 h-56 bg-gold-600/10 rounded-full blur-3xl" />
        <img
          src={bannerProperty}
          alt=""
          className="hidden sm:block absolute inset-y-0 right-0 h-full w-1/3 object-cover object-[65%_35%] [-webkit-mask-image:linear-gradient(to_right,transparent,black_55%)] [mask-image:linear-gradient(to_right,transparent,black_55%)]"
        />
        <div className="relative p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">Customer Portal</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, <span className="text-gold-600">{firstName}!</span>
          </h1>
          <p className="mt-1 text-sm sm:text-base text-gray-500">Here's what's happening with your property today.</p>
          {/* The property, in the one place it is stated. The panel that used to carry its name
              and ID again at the foot of the page is gone, so the name rides on this chip. */}
          {propertyCode && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/80 border border-warm-border rounded-lg pl-3 pr-2 py-2 max-w-full">
              <Building2 className="w-4 h-4 text-gold-600 shrink-0" />
              {propertyName && (
                <>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{propertyName}</span>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                </>
              )}
              <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">Property ID:</span>
              <span className="text-xs sm:text-sm font-semibold text-gold-600 truncate">{propertyCode}</span>
              <button
                type="button"
                onClick={copyPropertyId}
                className="p-1 rounded hover:bg-gold-600/10 transition-colors"
                title={copied ? 'Copied' : 'Copy Property ID'}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Quick Access -- desktop only, and that is the whole point.
          These are the same four destinations as the fixed bottom bar (components/BottomNav.jsx,
          `lg:hidden`), so on a phone or a tablet the portal was offering its navigation twice: the
          bar across the bottom and this column of cards saying the same thing. The pair is
          complementary at one breakpoint -- `hidden lg:block` here, `lg:hidden` there. Change one
          and the duplication comes back, or a width is left with no navigation at all. */}
      <section className="hidden lg:block">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {QUICK_ACCESS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group bg-white border border-gray-200 rounded-xl shadow-warm hover:shadow-warm-hover hover:border-gold-500/30 transition-all p-4 flex items-center gap-3"
              >
                <span className={`w-10 h-10 shrink-0 rounded-lg border flex items-center justify-center ${item.tile}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1 font-semibold text-gray-900 truncate">{item.title}</span>
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 ${item.action}`}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Work Orders, the next visit and what is owed -- the three things a resident opens this
          page to check. Each states its own figures; none of them restates another's. This row
          is the portal's one exception to `items-start`: the cards stretch to a shared height so
          all three end on the same line, and a `flex-1` spacer inside each shares the extra room
          out instead of leaving it under one card's content. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <PanelHeader icon={ClipboardList} title="Work Orders">
            {workOrderCounts.total > 0 && (
              <button
                type="button"
                onClick={showWorkOrderHistory}
                className="shrink-0 text-xs font-medium text-gold-600 hover:text-gold-500 flex items-center gap-1"
              >
                {workOrderTab === 'activity' && workOrderActivityExpanded ? 'Show Less' : 'View All'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </PanelHeader>
          {/* The counts are the panel's first tab; the second reads the work orders themselves. */}
          <div className="flex border-b border-gray-100 px-3 sm:px-4">
            {[['overview', 'Overview'], ['activity', 'Activity']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWorkOrderTab(key)}
                className={`px-1 py-1.5 mr-4 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  workOrderTab === key
                    ? 'border-gold-500 text-gold-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {workOrderTab === 'overview' ? (
            <div className="grid flex-1 grid-cols-4 content-center gap-2 p-3 sm:p-4">
              {WORK_ORDER_TILES.map(({ key, label, tone }) => (
                <div key={key} className={`rounded-lg border px-1.5 py-2 text-center ${tone}`}>
                  <span className="block text-lg font-bold leading-none">{workOrderCounts[key]}</span>
                  <span className="block mt-0.5 text-[11px] font-medium whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-3 sm:p-4">
              {workOrderActivityLoading && workOrderActivity.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
                </div>
              ) : workOrderActivity.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <EmptyState
                    icon={ClipboardList}
                    title="No work orders yet"
                    description="Requests raised for your property will appear here."
                  />
                </div>
              ) : (
                // The expanded list scrolls inside its cap rather than stretching this card (and
                // the row it sits in) for every order the property has ever raised.
                <ul className={`divide-y divide-gray-100 ${workOrderActivityExpanded ? 'max-h-72 overflow-y-auto' : ''}`}>
                  {visibleWorkOrderActivity.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => openActivity(item)}
                        className="w-full text-left flex items-center gap-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900 truncate">{item.subtitle || item.title}</span>
                          <span className="block text-xs text-gray-500 truncate">
                            {item.reference ? `${item.reference} · ` : ''}{formatActivityDate(item.at)}
                          </span>
                        </span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${ACTIVITY_TONES[item.tone] || ACTIVITY_TONES.neutral}`}>
                          {item.statusLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* The next visit, and nothing behind it: the rest of the calendar is the Schedules page. */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <PanelHeader icon={CalendarDays} title="Upcoming Schedule">
            <Link
              to="/dashboard/schedule"
              className="shrink-0 text-xs font-medium text-gold-600 hover:text-gold-500 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </PanelHeader>
          <div className="flex-1 flex flex-col p-3 sm:p-4">
            <div className="flex-1 flex flex-col justify-center">
            {activityLoading && !nextVisit ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
              </div>
            ) : !nextVisit ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming schedules"
                description="Any scheduled visits, maintenance or service appointments will be shown here."
              />
            ) : (
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-2.5">
                <span className="w-10 shrink-0 py-1 text-center bg-gold-600/10 border border-gold-500/20 rounded-lg">
                  <span className="block text-sm font-bold leading-none text-gray-900">
                    {nextVisit.scheduledDate
                      ? String(new Date(`${nextVisit.scheduledDate}T00:00:00`).getDate()).padStart(2, '0')
                      : '--'}
                  </span>
                  <span className="block mt-0.5 text-[10px] uppercase text-gray-500">
                    {nextVisit.scheduledDate
                      ? new Date(`${nextVisit.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })
                      : ''}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 truncate">{nextVisit.serviceName}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="truncate">{formatTimeRange(nextVisit.scheduledTimeStart, nextVisit.scheduledTimeEnd)}</span>
                  </span>
                </span>
              </div>
            )}
            </div>
            <Link
              to="/dashboard/schedule"
              className="mt-2.5 flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
            >
              View Schedule
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </section>

        {/* What is owed, counted on the server over every invoice in scope -- a total added up from
            the activity slice above would under-report it, which is worse than showing nothing. */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <PanelHeader icon={CreditCard} title="Payments">
            <Link
              to="/dashboard/payment"
              className="shrink-0 text-xs font-medium text-gold-600 hover:text-gold-500 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </PanelHeader>
          <div className="flex-1 flex flex-col p-3 sm:p-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Outstanding Amount</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-900">{formatCurrency(payments.outstanding)}</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {payments.pendingCount} Invoice{payments.pendingCount === 1 ? '' : 's'} Pending
              </p>
            </div>
            <Link
              to="/dashboard/payment"
              className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gold-600/10 border border-gold-500/20 text-sm font-semibold text-gold-700 hover:bg-gold-600/15 transition-colors"
            >
              Make Payment
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>

      {/* Recent Activity. A table from `sm` up, as the agreed design draws it, and the same rows as
          a list below that -- a five-column table on a phone is a horizontal scroll nobody reads.
          "View All" shows the whole history in place, because there is no activity page. */}
      <section className="bg-white border border-gray-200 rounded-xl shadow-warm overflow-hidden">
        <PanelHeader icon={History} title="Recent Activity">
          <div className="flex items-center gap-3 shrink-0">
            {activity.length > 0 && (
              <button
                type="button"
                onClick={() => setActivityExpanded(!activityExpanded)}
                className="text-xs font-medium text-gold-600 hover:text-gold-500 flex items-center gap-1"
              >
                {activityExpanded ? 'Show Less' : 'View All'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </PanelHeader>

        {activityLoading && activity.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
          </div>
        ) : activity.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyState
              icon={ClipboardList}
              title="No recent activity"
              description="Your work orders, payments and updates will appear here once you start using the services."
            />
          </div>
        ) : (
          <>
            {/* Desktop: the agreed five columns. Capped in height once expanded so a long history
                scrolls inside the card instead of burying the rest of the page. */}
            <div className={`hidden sm:block ${activityExpanded ? 'max-h-[28rem] overflow-y-auto' : ''}`}>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Details</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activity.map((item) => {
                    const type = ACTIVITY_TYPES[item.type] || ACTIVITY_TYPES.work_order;
                    const Icon = type.icon;
                    return (
                      <tr key={item.key} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatActivityDate(item.at)}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center ${type.tile}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-sm text-gray-700">{type.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-0">
                          <span className="block text-sm text-gray-900 truncate max-w-[22rem]">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-xs text-gray-500 truncate max-w-[22rem]">{item.subtitle}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${ACTIVITY_TONES[item.tone] || ACTIVITY_TONES.neutral}`}>
                            {item.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openActivity(item)}
                            className="text-sm font-medium text-gold-600 hover:text-gold-500 whitespace-nowrap"
                          >
                            {type.action}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Below sm: the same rows, read as a list */}
            <ul className={`sm:hidden divide-y divide-gray-100 px-3 ${activityExpanded ? 'max-h-[28rem] overflow-y-auto' : ''}`}>
              {activity.map((item) => {
                const type = ACTIVITY_TYPES[item.type] || ACTIVITY_TYPES.work_order;
                const Icon = type.icon;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => openActivity(item)}
                      className="w-full text-left flex items-center gap-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center ${type.tile}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 truncate">{item.title}</span>
                        <span className="block text-xs text-gray-500">{formatActivityDate(item.at)}</span>
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${ACTIVITY_TONES[item.tone] || ACTIVITY_TONES.neutral}`}>
                        {item.statusLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Pending Renewals - the customer's own approval, so it stays on the home page */}
      {renewals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-gold-600" />
              Service Renewals
            </h2>
            <span className="px-2 py-1 bg-gold-600/20 text-gold-600 text-xs font-medium rounded-full">
              {renewals.length} Pending
            </span>
          </div>
          <div className="grid gap-4">
            {renewals.map((renewal) => (
              <div
                key={renewal.id}
                className="bg-gradient-to-r from-gold-500/10 to-gold-600/5 border border-gold-500/30 rounded-xl p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gold-600">{renewal.serviceName}</span>
                      {renewal.daysUntilExpiry !== null && renewal.daysUntilExpiry <= 7 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                          Expires in {renewal.daysUntilExpiry} days
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium text-sm mb-1">
                      Renewal Period: {new Date(renewal.renewalStartDate).toLocaleDateString('en-IN')} - {new Date(renewal.renewalEndDate).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {renewal.totalVisits} visits ({renewal.frequency}) | Vendor: {renewal.vendorCompany || renewal.vendorName || 'TBA'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveRenewal(renewal.id)}
                      disabled={processingRenewal === renewal.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {processingRenewal === renewal.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeclineRenewal(renewal.id)}
                      disabled={processingRenewal === renewal.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Work Order Detail Modal — portalled so fixed positioning always
          resolves against the viewport, not a transformed ancestor */}
      {selectedWorkOrder && createPortal(
        <ViewModal onClose={() => setSelectedWorkOrder(null)}
          id={selectedWorkOrder.work_order_id}
          title={selectedWorkOrder.category_name}
          align="top"
        >

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
                <p className="text-gray-900">{selectedWorkOrder.description || 'No description provided'}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Created</p>
                  <p className="text-gray-900 text-sm">{formatDate(selectedWorkOrder.created_at)}</p>
                </div>
                {selectedWorkOrder.scheduled_date && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Scheduled</p>
                    <p className="text-gray-900 text-sm">{formatDate(selectedWorkOrder.scheduled_date)}</p>
                  </div>
                )}
                {selectedWorkOrder.completed_at && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Completed</p>
                    <p className="text-gray-900 text-sm">{formatDate(selectedWorkOrder.completed_at)}</p>
                  </div>
                )}
                {selectedWorkOrder.property_type && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Property Type</p>
                    <p className="text-gray-900 text-sm capitalize">{selectedWorkOrder.property_type}</p>
                  </div>
                )}
              </div>

              {/* Location Info */}
              {(selectedWorkOrder.block || selectedWorkOrder.flat_number) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Location</h4>
                  <div className="flex items-center gap-2 text-gray-900">
                    <MapPin className="w-4 h-4 text-gold-600" />
                    <span>
                      {selectedWorkOrder.block && `Block ${selectedWorkOrder.block}`}
                      {selectedWorkOrder.block && selectedWorkOrder.flat_number && ', '}
                      {selectedWorkOrder.flat_number && `Flat ${selectedWorkOrder.flat_number}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Entry Permission */}
              {selectedWorkOrder.permission_to_enter && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Entry Permission</h4>
                  <p className="text-gray-900 capitalize">{selectedWorkOrder.permission_to_enter}</p>
                  {selectedWorkOrder.entry_notes && (
                    <p className="text-gray-500 text-sm mt-1">{selectedWorkOrder.entry_notes}</p>
                  )}
                </div>
              )}

              {/* Attachments */}
              {selectedWorkOrder.attachments && selectedWorkOrder.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({selectedWorkOrder.attachments.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedWorkOrder.attachments.map((att) => {
                      const isImage = att.file_type?.startsWith('image/');
                      const fileUrl = att.file_path?.startsWith('http')
                        ? att.file_path
                        : `${UPLOADS_BASE_URL}${att.file_path}`;

                      return (
                        <a
                          key={att.id}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-100 rounded-lg p-2 hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                          {isImage ? (
                            <Image className="w-4 h-4 text-gold-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-gold-600" />
                          )}
                          <span className="text-sm text-gray-900 truncate">{att.original_name || att.file_name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
        
        </ViewModal>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
