import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Building2, Calendar, CalendarDays, Check, ChevronRight, ClipboardList,
  Clock, Copy, CreditCard, FileText, HelpCircle, History, Home, Image, Loader2, MapPin, Paperclip,
  RotateCcw, ThumbsDown, ThumbsUp, X
} from 'lucide-react';
import Modal from '../components/common/Modal';
import { useRegisterRefresh } from '../hooks/usePortalRefresh';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const UPLOADS_BASE_URL = '';

// Four destinations, and nothing but: the summary cards that used to sit under them are gone, so a
// card here states what it is for rather than carrying a figure.
const QUICK_ACCESS = [
  {
    path: '/dashboard/work-order',
    title: 'Work Orders',
    description: 'Raise and track maintenance requests for your property.',
    icon: ClipboardList,
    tile: 'bg-blue-50 border-blue-100 text-blue-600',
    action: 'bg-blue-50 text-blue-600'
  },
  {
    path: '/dashboard/schedule',
    title: 'Schedules',
    description: 'View upcoming visits, maintenance and other schedules.',
    icon: Calendar,
    tile: 'bg-violet-50 border-violet-100 text-violet-600',
    action: 'bg-violet-50 text-violet-600'
  },
  {
    path: '/dashboard/payment',
    title: 'Payments',
    description: 'View bills, make payments and check payment history.',
    icon: CreditCard,
    tile: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    action: 'bg-emerald-50 text-emerald-600'
  },
  {
    path: '/dashboard/contact',
    title: 'Contact / Help',
    description: 'Get support or talk to our customer care team.',
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
  work_order: { icon: ClipboardList, tile: 'bg-blue-50 border-blue-100 text-blue-600' },
  payment: { icon: CreditCard, tile: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
  schedule: { icon: Calendar, tile: 'bg-violet-50 border-violet-100 text-violet-600' }
};

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
  <div className="border border-dashed border-gray-200 rounded-xl py-10 px-6 text-center">
    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
      <Icon className="w-5 h-5 text-gray-400" />
    </div>
    <p className="font-medium text-gray-900">{title}</p>
    <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">{description}</p>
  </div>
);

const PanelHeader = ({ icon: Icon, title, description, children }) => (
  <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100">
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-9 h-9 shrink-0 rounded-lg bg-gold-600/10 border border-gold-500/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-gold-600" />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold text-gray-900 leading-tight">{title}</h2>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
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
      }
    } catch (err) {
      console.error('Activity fetch error:', err);
    } finally {
      setActivityLoading(false);
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

  const activityLimit = activityExpanded ? 25 : 6;
  useEffect(() => { fetchActivity(activityLimit); }, [fetchActivity, activityLimit]);

  // What the header's Refresh means on this page
  useRegisterRefresh(() => {
    fetchDashboard();
    fetchActivity(activityLimit);
    fetchRenewals();
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-2xl border border-warm-border bg-gradient-to-r from-warm-section via-warm-accent-soft to-gold-100">
        <div className="flex items-stretch">
          <div className="flex-1 min-w-0 p-5 sm:p-7">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">Customer Portal</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
              Welcome back, <span className="text-gold-600">{firstName}!</span>
            </h1>
            <p className="mt-1 text-sm sm:text-base text-gray-500">Here's what's happening with your property today.</p>
            {propertyCode && (
              <div className="mt-4 inline-flex items-center gap-2 bg-white/80 border border-warm-border rounded-lg pl-3 pr-2 py-2">
                <Building2 className="w-4 h-4 text-gold-600 shrink-0" />
                <span className="text-xs sm:text-sm text-gray-500">Property ID:</span>
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

          {/* The property's own image belongs here; until one is stored this is the brand's warm
              gradient rather than a stock photograph of somebody else's building. */}
          <div className="relative w-24 sm:w-56 lg:w-80 shrink-0 bg-gradient-to-br from-gold-200/60 via-gold-100 to-warm-accent-soft">
            <Building2 className="absolute -right-4 bottom-0 w-32 h-32 sm:w-44 sm:h-44 text-gold-600/20" />
            <div className="hidden lg:block absolute left-5 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-3">
              <Home className="w-4 h-4 text-gold-600" />
              <p className="mt-2 text-xs leading-relaxed text-gray-900">
                A better<br />living experience<br />together.
              </p>
              <span className="mt-2 block w-8 h-0.5 bg-gold-500/60" />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Quick Access</h2>
          <p className="text-xs text-gray-500 hidden sm:block">Get things done quickly with our most common services.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {QUICK_ACCESS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group bg-white border border-gray-200 rounded-xl shadow-warm hover:shadow-warm-hover hover:border-gold-500/30 transition-all p-4 flex items-start gap-3"
              >
                <span className={`w-10 h-10 shrink-0 rounded-lg border flex items-center justify-center ${item.tile}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-900">{item.title}</span>
                  <span className="block text-xs text-gray-500 leading-relaxed mt-0.5">{item.description}</span>
                </span>
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 ${item.action}`}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Activity + Upcoming Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <section className="bg-white border border-gray-200 rounded-xl shadow-warm overflow-hidden">
          <PanelHeader icon={History} title="Recent Activity" description="Your latest updates and activities.">
            {activity.length > 0 && (
              <button
                type="button"
                onClick={() => setActivityExpanded(!activityExpanded)}
                className="shrink-0 text-xs font-medium text-gold-600 hover:text-gold-500 flex items-center gap-1"
              >
                {activityExpanded ? 'Show Less' : 'View All'}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </PanelHeader>

          <div className="p-3 sm:p-4">
            {activityLoading && activity.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
              </div>
            ) : activity.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No recent activity"
                description="Your work orders, payments and updates will appear here once you start using the services."
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {activity.map((item) => {
                  const type = ACTIVITY_TYPES[item.type] || ACTIVITY_TYPES.work_order;
                  const Icon = type.icon;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => openActivity(item)}
                        className="w-full text-left flex items-center gap-2 sm:gap-3 py-2.5 px-1 sm:px-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-16 sm:w-24 shrink-0 text-[11px] text-gray-500">{formatActivityDate(item.at)}</span>
                        <span className={`w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center ${type.tile}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900 truncate">{item.title}</span>
                          <span className="block text-xs text-gray-500 truncate">{item.subtitle}</span>
                        </span>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${ACTIVITY_TONES[item.tone] || ACTIVITY_TONES.neutral}`}>
                          {item.statusLabel}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl shadow-warm overflow-hidden">
          <PanelHeader icon={CalendarDays} title="Upcoming Schedules" description="Your upcoming visits and maintenance schedule.">
            <Link
              to="/dashboard/schedule"
              className="shrink-0 text-xs font-medium text-gold-600 hover:text-gold-500 flex items-center gap-1"
            >
              View Calendar
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </PanelHeader>

          <div className="p-3 sm:p-4">
            {activityLoading && upcomingVisits.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
              </div>
            ) : upcomingVisits.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming schedules"
                description="Any scheduled visits, maintenance or service appointments will be shown here."
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {upcomingVisits.map((visit) => {
                  const day = visit.scheduledDate ? new Date(`${visit.scheduledDate}T00:00:00`) : null;
                  return (
                    <li key={visit.id}>
                      <Link
                        to="/dashboard/schedule"
                        className="flex items-center gap-3 py-2.5 px-1 sm:px-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-12 shrink-0 py-1.5 text-center bg-gold-600/10 border border-gold-500/20 rounded-lg">
                          <span className="block text-base font-bold leading-none text-gray-900">
                            {day ? String(day.getDate()).padStart(2, '0') : '--'}
                          </span>
                          <span className="block mt-0.5 text-[10px] uppercase text-gray-500">
                            {day ? day.toLocaleDateString('en-IN', { month: 'short' }) : ''}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900 truncate">{visit.serviceName}</span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span className="truncate">{formatTimeRange(visit.scheduledTimeStart, visit.scheduledTimeEnd)}</span>
                          </span>
                        </span>
                        <span className={`hidden sm:inline-block shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${ACTIVITY_TONES[visit.tone] || ACTIVITY_TONES.neutral}`}>
                          {visit.statusLabel}
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Property */}
      {(propertyName || propertyCode) && (
        <section className="bg-white border border-gray-200 rounded-xl shadow-warm overflow-hidden">
          <PanelHeader icon={Building2} title="Property" description="Your property details." />
          <div className="flex items-center gap-4 p-4">
            <div className="w-16 h-16 shrink-0 rounded-lg bg-gradient-to-br from-gold-200/60 to-warm-accent-soft border border-warm-border flex items-center justify-center">
              <Building2 className="w-7 h-7 text-gold-600/70" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{propertyName || 'Your property'}</p>
              {propertyCode && (
                <p className="text-sm text-gray-500 truncate">Property ID: <span className="text-gold-600">{propertyCode}</span></p>
              )}
            </div>
          </div>
        </section>
      )}

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
        <Modal
          overlayRef={overlayRef}
          cardRef={modalRef}
          align="top"
          top=""
          padding="py-8 px-4"
          onClose={() => setSelectedWorkOrder(null)}
          className="max-w-2xl overflow-hidden my-auto"
        >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-600/20 to-gold-600/20 border-b border-gray-200 p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gold-600 text-sm font-medium">{selectedWorkOrder.work_order_id}</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">{selectedWorkOrder.category_name}</h3>
                  {selectedWorkOrder.subcategory_name && (
                    <p className="text-gray-500 text-sm mt-0.5">{selectedWorkOrder.subcategory_name}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedWorkOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {getStatusBadge(selectedWorkOrder.status)}
                {selectedWorkOrder.priority && getPriorityBadge(selectedWorkOrder.priority)}
              </div>
            </div>

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
        </Modal>,
        document.body
      )}
    </div>
  );
};

export default Dashboard;
