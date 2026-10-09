import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, Calendar, CalendarCheck, CalendarDays, CheckCircle, ChevronLeft,
  ChevronRight, Clock, List, Loader2, RefreshCw, RotateCcw, Truck, Wrench, X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// The business runs on IST, so "today" must be the Indian date even when the
// browser clock is not. backend/utils/scheduleStats.js applies the same rule to
// the counts, so the summary cards and these lists always agree.
const IST_OFFSET_MINUTES = 330;
const istToday = () => new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000)
  .toISOString()
  .slice(0, 10);

// Visits still awaiting work, exactly as the employee portals define them
const OPEN_STATUSES = ['scheduled', 'confirmed', 'work_order_created', 'missed'];

// Every status a visit can hold, plus the derived 'overdue'. Statuses match the
// employee portals so a customer sees the same state as the team working on it.
const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', badge: 'bg-blue-100 text-blue-600 border-blue-200', dot: 'bg-blue-400' },
  confirmed: { label: 'Confirmed', badge: 'bg-cyan-100 text-cyan-600 border-cyan-200', dot: 'bg-cyan-400' },
  work_order_created: { label: 'Work Order Created', badge: 'bg-purple-100 text-purple-600 border-purple-200', dot: 'bg-purple-400' },
  in_progress: { label: 'In Progress', badge: 'bg-amber-100 text-amber-600 border-amber-200', dot: 'bg-amber-400' },
  completed: { label: 'Completed', badge: 'bg-green-100 text-green-600 border-green-200', dot: 'bg-green-400' },
  rescheduled: { label: 'Rescheduled', badge: 'bg-orange-100 text-orange-600 border-orange-200', dot: 'bg-orange-400' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-600 border-red-200', dot: 'bg-red-400' },
  missed: { label: 'Missed', badge: 'bg-rose-100 text-rose-600 border-rose-200', dot: 'bg-rose-400' },
  overdue: { label: 'Overdue', badge: 'bg-red-100 text-red-600 border-red-200', dot: 'bg-red-500' }
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;

// scheduledDate arrives as a plain YYYY-MM-DD day, so it is parsed at local
// midnight instead of being shifted by a timezone
const parseDay = (day) => (day ? new Date(`${day}T00:00:00`) : null);

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatDay = (day) => {
  const date = parseDay(day);
  return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
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

const isOpenVisit = (visit) => OPEN_STATUSES.includes(visit.status);
// Past its due date and still awaiting work - the same rule as the portals
const isOverdue = (visit, today) => isOpenVisit(visit) && !!visit.scheduledDate && visit.scheduledDate < today;
const displayStatus = (visit, today) => (isOverdue(visit, today) ? 'overdue' : visit.status);

const StatusBadge = ({ status }) => {
  const config = statusConfig(status);
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${config.badge}`}>
      {config.label}
    </span>
  );
};

const SummaryCard = ({ icon: Icon, label, value, iconClass, valueClass = 'text-warm-text' }) => (
  <div className="bg-warm-border rounded-xl p-5 border border-warm-accent-hover/20">
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-warm-muted text-sm truncate">{label}</p>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  </div>
);

const VisitRow = ({ visit, today, onSelect }) => {
  const date = parseDay(visit.scheduledDate);
  const status = displayStatus(visit, today);

  return (
    <button
      onClick={() => onSelect(visit)}
      className="w-full text-left p-4 hover:bg-warm-accent-soft transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-warm-accent-hover/15 border border-warm-accent-hover/25 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-warm-accent-hover font-medium">
            {date ? date.toLocaleDateString('en-IN', { month: 'short' }) : '--'}
          </span>
          <span className="text-lg font-bold text-warm-text leading-tight">
            {date ? date.getDate() : '--'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-warm-text font-medium truncate">{visit.serviceName || 'Service visit'}</p>
          <div className="mt-1.5 space-y-1">
            <p className="flex items-center gap-2 text-sm text-warm-muted">
              <Clock className="w-4 h-4 text-warm-muted flex-shrink-0" />
              <span className="truncate">{formatDay(visit.scheduledDate)} &middot; {formatTimeRange(visit.scheduledTimeStart, visit.scheduledTimeEnd)}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-warm-muted">
              <Truck className="w-4 h-4 text-warm-muted flex-shrink-0" />
              <span className="truncate">{visit.vendorName || 'Service partner to be assigned'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge status={status} />
          {visit.visitNumber && visit.totalVisits ? (
            <span className="text-xs text-warm-muted">Visit {visit.visitNumber} of {visit.totalVisits}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
};

const VisitList = ({ visits, today, onSelect, emptyIcon: EmptyIcon, emptyTitle, emptyHint }) => {
  if (visits.length === 0) {
    return (
      <div className="p-12 text-center">
        <EmptyIcon className="w-12 h-12 text-warm-muted mx-auto mb-3" />
        <p className="text-warm-muted">{emptyTitle}</p>
        <p className="text-warm-muted text-sm mt-1">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-warm-border">
      {visits.map((visit) => (
        <VisitRow key={visit.id} visit={visit} today={today} onSelect={onSelect} />
      ))}
    </div>
  );
};

const VisitDetailModal = ({ visit, today, onClose }) => {
  if (!visit) return null;

  const rows = [
    { label: 'Service', value: visit.serviceName || 'Service visit' },
    { label: 'Service Partner', value: visit.vendorName || 'To be assigned' },
    { label: 'Date', value: formatDay(visit.scheduledDate) },
    { label: 'Time', value: formatTimeRange(visit.scheduledTimeStart, visit.scheduledTimeEnd) },
    ...(visit.visitNumber && visit.totalVisits
      ? [{ label: 'Visit', value: `${visit.visitNumber} of ${visit.totalVisits}` }]
      : []),
    ...(visit.originalDate && visit.originalDate !== visit.scheduledDate
      ? [{ label: 'Moved From', value: formatDay(visit.originalDate) }]
      : [])
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-warm-section border border-warm-accent-hover/20 rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-warm-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warm-accent-hover/20 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-warm-accent-hover" />
            </div>
            <div>
              <h2 className="text-warm-text font-semibold">Visit Details</h2>
              {visit.visitId && <p className="text-xs text-warm-muted">{visit.visitId}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-warm-muted hover:text-warm-text hover:bg-warm-accent-soft rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <StatusBadge status={displayStatus(visit, today)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rows.map((row) => (
              <div key={row.label}>
                <p className="text-xs text-warm-muted mb-1">{row.label}</p>
                <p className="text-sm text-warm-text break-words">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-warm-border">
          <p className="text-xs text-warm-muted">
            Need a change to this visit?{' '}
            <Link to="/dashboard/contact" className="text-warm-accent-hover hover:text-warm-accent">
              Contact your property manager
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

const ScheduleCalendar = ({ visitsByDay, today, month, onMonthChange, selectedDay, onSelectDay }) => {
  const days = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const startDay = new Date(year, monthIndex, 1).getDay();
    const cells = [];
    // 6 weeks keeps the grid height stable whichever day the month starts on
    for (let offset = -startDay; cells.length < 42; offset += 1) {
      const date = new Date(year, monthIndex, offset + 1);
      cells.push({ date, isCurrentMonth: date.getMonth() === monthIndex });
    }
    return cells;
  }, [month]);

  const shiftMonth = (direction) => {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + direction, 1));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-warm-border">
        <h2 className="text-lg font-semibold text-warm-text">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg bg-warm-page border border-warm-border text-warm-muted hover:text-warm-text hover:border-warm-border transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const now = new Date();
              onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
              onSelectDay(istToday());
            }}
            className="px-3 py-2 rounded-lg bg-warm-page border border-warm-border text-sm text-warm-muted hover:text-warm-text hover:border-warm-border transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg bg-warm-page border border-warm-border text-warm-muted hover:text-warm-text hover:border-warm-border transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-warm-border">
        {DAY_NAMES.map((day) => (
          <div key={day} className="px-1 py-2 text-center text-xs font-medium text-warm-muted">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map(({ date, isCurrentMonth }) => {
          const key = dateKey(date);
          const dayVisits = visitsByDay.get(key) || [];
          const isToday = key === today;
          const isSelected = key === selectedDay;

          return (
            <button
              key={key}
              onClick={() => onSelectDay(key)}
              className={`min-h-[84px] sm:min-h-[104px] p-1.5 text-left border-b border-r border-warm-border transition-colors ${
                isCurrentMonth ? 'hover:bg-warm-accent-soft' : 'bg-warm-page'
              } ${isSelected ? 'ring-1 ring-inset ring-warm-accent/50 bg-warm-section' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  isToday
                    ? 'bg-warm-accent-hover text-warm-text'
                    : isCurrentMonth ? 'text-warm-text' : 'text-warm-muted'
                }`}>
                  {date.getDate()}
                </span>
                {dayVisits.length > 0 && (
                  <span className="text-[10px] text-warm-muted">{dayVisits.length}</span>
                )}
              </div>

              <div className="space-y-1">
                {dayVisits.slice(0, 2).map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center gap-1 px-1 py-0.5 rounded bg-warm-page/70 border border-warm-border"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig(displayStatus(visit, today)).dot}`} />
                    <span className="text-[10px] text-warm-text truncate">
                      {visit.serviceName || 'Service visit'}
                    </span>
                  </div>
                ))}
                {dayVisits.length > 2 && (
                  <span className="block text-[10px] text-warm-accent-hover px-1">
                    +{dayVisits.length - 2} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Schedule = ({ user }) => {
  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list');
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const today = istToday();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(today);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        setError('Please login to view your schedule');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/customers/schedules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        setVisits(result.data?.visits || []);
        setStats(result.data?.stats || null);
      } else {
        setError(result.message || 'Failed to load your schedule');
      }
    } catch (err) {
      console.error('Schedules fetch error:', err);
      setError('Failed to load your schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // The three tabs are disjoint and together cover every status: a visit is
  // either still active, finished (or superseded by a move), or cancelled.
  const { upcomingVisits, pastVisits, cancelledVisits } = useMemo(() => {
    const byDateAsc = (a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate));
    const byDateDesc = (a, b) => byDateAsc(b, a);

    return {
      upcomingVisits: visits
        .filter(visit => isOpenVisit(visit) || visit.status === 'in_progress')
        .sort(byDateAsc),
      pastVisits: visits
        .filter(visit => ['completed', 'rescheduled'].includes(visit.status))
        .sort(byDateDesc),
      cancelledVisits: visits
        .filter(visit => visit.status === 'cancelled')
        .sort(byDateDesc)
    };
  }, [visits]);

  const visitsByDay = useMemo(() => {
    const grouped = new Map();
    visits.forEach((visit) => {
      if (!visit.scheduledDate) return;
      const dayVisits = grouped.get(visit.scheduledDate) || [];
      dayVisits.push(visit);
      grouped.set(visit.scheduledDate, dayVisits);
    });
    grouped.forEach(dayVisits => dayVisits.sort(
      (a, b) => String(a.scheduledTimeStart || '').localeCompare(String(b.scheduledTimeStart || ''))
    ));
    return grouped;
  }, [visits]);

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', icon: CalendarDays, count: upcomingVisits.length },
    { id: 'past', label: 'Past', icon: CalendarCheck, count: pastVisits.length },
    { id: 'cancelled', label: 'Cancelled', icon: X, count: cancelledVisits.length }
  ];

  const tabContent = {
    upcoming: {
      visits: upcomingVisits,
      emptyIcon: CalendarDays,
      emptyTitle: 'No upcoming visits',
      emptyHint: 'Your next service visits will appear here once they are scheduled'
    },
    past: {
      visits: pastVisits,
      emptyIcon: CalendarCheck,
      emptyTitle: 'No past visits yet',
      emptyHint: 'Completed and rescheduled visits are kept here for your records'
    },
    cancelled: {
      visits: cancelledVisits,
      emptyIcon: X,
      emptyTitle: 'No cancelled visits',
      emptyHint: 'Visits cancelled by our team will be listed here'
    }
  }[activeTab];

  const selectedDayVisits = visitsByDay.get(selectedDay) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-warm-text mb-2">Schedules</h1>
          <p className="text-warm-muted">Service visits scheduled for your property</p>
          {user?.propertyName && (
            <p className="text-warm-muted text-sm mt-1">
              Property: <span className="text-warm-accent-hover font-medium">{user.propertyName}</span>
            </p>
          )}
        </div>
        <button
          onClick={fetchSchedules}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-warm-section border border-warm-border rounded-lg hover:bg-warm-accent-soft transition-colors text-warm-text disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={Calendar}
          label="Total Visits"
          value={stats?.total || 0}
          iconClass="bg-blue-100 text-blue-600"
        />
        <SummaryCard
          icon={CalendarDays}
          label="Upcoming"
          value={stats?.upcoming || 0}
          iconClass="bg-warm-accent-hover/20 text-warm-accent-hover"
          valueClass="text-warm-accent-hover"
        />
        <SummaryCard
          icon={Clock}
          label="Today"
          value={stats?.today || 0}
          iconClass="bg-amber-100 text-amber-600"
          valueClass="text-amber-600"
        />
        <SummaryCard
          icon={CheckCircle}
          label="Completed"
          value={stats?.completed || 0}
          iconClass="bg-green-100 text-green-600"
          valueClass="text-green-600"
        />
      </div>

      {/* Overdue notice - a visit past its date that is still open */}
      {stats?.overdue > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-600 font-medium">
              {stats.overdue} {stats.overdue === 1 ? 'visit is' : 'visits are'} past the scheduled date
            </p>
            <p className="text-sm text-warm-muted mt-1">
              Our team is following these up.{' '}
              <Link to="/dashboard/contact" className="text-warm-accent-hover hover:text-warm-accent">Contact us</Link>{' '}
              if you need an update.
            </p>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            view === 'list'
              ? 'bg-warm-accent-hover/20 text-warm-accent-hover border border-warm-accent/30'
              : 'bg-warm-section text-warm-muted border border-warm-border hover:text-warm-text hover:border-warm-border'
          }`}
        >
          <List className="w-4 h-4" />
          List
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            view === 'calendar'
              ? 'bg-warm-accent-hover/20 text-warm-accent-hover border border-warm-accent/30'
              : 'bg-warm-section text-warm-muted border border-warm-border hover:text-warm-text hover:border-warm-border'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Calendar
        </button>
      </div>

      {/* Tabs - list view only */}
      {view === 'list' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'bg-warm-accent-soft text-warm-text border border-warm-border'
                    : 'bg-warm-section text-warm-muted border border-warm-border hover:text-warm-text hover:border-warm-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-warm-page' : 'bg-warm-accent-soft'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="bg-warm-border rounded-2xl border border-warm-accent-hover/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-warm-accent-hover animate-spin" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
            <p className="text-warm-text">{error}</p>
            <button
              onClick={fetchSchedules}
              className="mt-4 px-4 py-2 bg-warm-accent-soft border border-warm-border rounded-lg text-warm-text hover:bg-warm-border transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : view === 'calendar' ? (
          <>
            <ScheduleCalendar
              visitsByDay={visitsByDay}
              today={today}
              month={month}
              onMonthChange={setMonth}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            <div className="border-t border-warm-border">
              <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-warm-text">
                  Visits on {formatDay(selectedDay)}
                </h3>
                <span className="text-xs text-warm-muted">
                  {selectedDayVisits.length} {selectedDayVisits.length === 1 ? 'visit' : 'visits'}
                </span>
              </div>
              <VisitList
                visits={selectedDayVisits}
                today={today}
                onSelect={setSelectedVisit}
                emptyIcon={Calendar}
                emptyTitle="No visits on this date"
                emptyHint="Pick another date on the calendar to see its visits"
              />
            </div>
          </>
        ) : (
          <VisitList
            visits={tabContent.visits}
            today={today}
            onSelect={setSelectedVisit}
            emptyIcon={tabContent.emptyIcon}
            emptyTitle={tabContent.emptyTitle}
            emptyHint={tabContent.emptyHint}
          />
        )}
      </div>

      {/* Status Legend */}
      {!loading && !error && visits.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          {['scheduled', 'work_order_created', 'in_progress', 'completed', 'rescheduled', 'overdue', 'cancelled'].map((status) => (
            <span key={status} className="flex items-center gap-2 text-xs text-warm-muted">
              <span className={`w-2 h-2 rounded-full ${statusConfig(status).dot}`} />
              {statusConfig(status).label}
            </span>
          ))}
        </div>
      )}

      {/* How scheduling works */}
      {!loading && !error && (
        <div className="mt-6 flex items-start gap-3 bg-warm-section border border-warm-border rounded-xl p-4">
          <RotateCcw className="w-5 h-5 text-warm-accent-hover flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-warm-text font-medium">How Your Schedule Works</p>
            <p className="text-sm text-warm-muted mt-1">
              Our team schedules every service visit for your property from your approved plan, then
              assigns a service partner and raises a work order before each visit. This page is your
              read-only view of that schedule &mdash; to request a change,{' '}
              <Link to="/dashboard/contact" className="text-warm-accent-hover hover:text-warm-accent">contact your property manager</Link>.
            </p>
          </div>
        </div>
      )}

      <VisitDetailModal visit={selectedVisit} today={today} onClose={() => setSelectedVisit(null)} />
    </div>
  );
};

export default Schedule;
