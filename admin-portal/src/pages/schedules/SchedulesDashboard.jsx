import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFP } from '../../contexts/FPContext';
import {
  Calendar, CalendarDays, Clock, CheckCircle, XCircle, RefreshCw, Plus,
  ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Filter, Bell,
  Building2, ArrowRight, TrendingUp, RotateCcw
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DonutChart from '../../components/common/DonutChart';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import { getAuthToken } from '../../utils/safeStorage';
import { 
  SCHEDULE_STATUS_COLORS, 
  PROPERTY_TYPE_COLORS, 
  getServiceColor 
} from '../../utils/chartColors';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Alias for backward compatibility within this file
const STATUS_COLORS = SCHEDULE_STATUS_COLORS;

// Property categories always shown in the Property Type chart, even with a count of 0.
// Anything outside this list is only listed when it actually has schedules.
const PROPERTY_TYPES = ['Gated Community', 'Apartment', 'Villa', 'Flat', 'Plot'];

// Normalize property type to consistent display format
const normalizePropertyType = (type) => {
  if (!type) return 'Others';
  const t = type.toLowerCase().trim();
  if (t === 'gc' || t === 'gated_community' || t.includes('gated')) return 'Gated Community';
  if (t === 'apt' || t === 'apartment' || t.includes('apartment')) return 'Apartment';
  if (t === 'villa' || t.includes('villa')) return 'Villa';
  if (t === 'flat' || t.includes('flat')) return 'Flat';
  if (t === 'plot' || t.includes('plot')) return 'Plot';
  if (t === 'independent' || t === 'independent_house' || t.includes('independent')) return 'Independent House';
  if (t === 'commercial' || t.includes('commercial')) return 'Commercial';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase().replace(/_/g, ' ');
};

const getApiPath = (portalType) => {
  const map = { 'franchise': 'fp', 'manager': 'manager', 'admin': 'admin', 'employee': 'admin', 'coordinator': 'coordinator', 'supervisor': 'supervisor' };
  return map[portalType] || 'admin';
};

// Helper to extract zone name from zone (can be string or object)
const getZoneName = (zone) => {
  if (!zone) return '';
  if (typeof zone === 'string') return zone;
  return zone.name || zone.zone_name || zone.zone || '';
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

// scheduled_time_start comes back as a TIME string (HH:MM:SS), not a timestamp
const formatTimeOfDay = (t) => {
  if (!t) return '-';
  const [hours, minutes] = String(t).split(':');
  const h = parseInt(hours);
  if (isNaN(h)) return '-';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${minutes || '00'} ${suffix}`;
};

const SchedulesDashboard = ({ user, portalType = 'franchise' }) => {
  const navigate = useNavigate();
  const { selectedFp } = useFP();
  
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [pendingProperties, setPendingProperties] = useState([]);
  const initialLoadDoneRef = useRef(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Chart filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  
  // Table filter states
  const [trendFilter, setTrendFilter] = useState('all');
  const [upcomingFilter, setUpcomingFilter] = useState('all');
  const [recentFilter, setRecentFilter] = useState('all');
  const [rescheduleFilter, setRescheduleFilter] = useState('all');
  const [overdueFilter, setOverdueFilter] = useState('all');
  const [pendingFilter, setPendingFilter] = useState('all');
  
  // UI states for header buttons
  const [showNotifications, setShowNotifications] = useState(false);

  // Period filter helper function. getDate lets a card filter on its own timestamp
  // (e.g. Recently Created filters on when the visit was created, not when it is due).
  const applyPeriodFilter = (data, period, getDate) => {
    if (period === 'all') return data;
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (period) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        filterDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case '6months':
        filterDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'year':
        filterDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return data;
    }
    
    return data.filter(item => {
      const raw = getDate ? getDate(item) : (item.startDate || item.start_date || item.createdAt || item.addedOn);
      if (!raw) return false;
      const itemDate = new Date(raw);
      return itemDate >= filterDate && itemDate <= now;
    });
  };

  // Period Filter Dropdown Component
  const PeriodFilter = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">All Time</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="quarter">This Quarter</option>
      <option value="6months">Last 6 Months</option>
      <option value="year">This Year</option>
    </select>
  );

  const getBasePath = () => {
    const map = { 'franchise': '/fp', 'manager': '/manager', 'admin': '/employee', 'coordinator': '/coordinator', 'supervisor': '/supervisor' };
    return map[portalType] || '/fp';
  };

  // Fetch schedules from the portal-specific endpoint
  const fetchSchedules = useCallback(async () => {
    // Only show loading spinner on initial load, not on silent refreshes
    if (!initialLoadDoneRef.current) {
      setLoading(true);
    }
    try {
      const token = getAuthToken(); // Get token inside callback to avoid re-render loops
      const apiPath = getApiPath(portalType);
      const params = new URLSearchParams();
      params.append('limit', '500'); // Get more records for dashboard
      if (selectedFp && selectedFp.id !== 'all') params.append('fpId', selectedFp.id);
      
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/all?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        // Handle both array response and object with data property
        const schedulesData = Array.isArray(result) ? result : (result.data || result.schedules || []);
        // Transform to match expected format
        const transformedSchedules = schedulesData.map(s => ({
          id: s.id,
          propertyCode: s.propertyId || s.property_id,
          title: s.serviceName || s.title || null,
          service: s.serviceName || s.service || null,
          serviceCategory: s.serviceCategory || s.service_category,
          property_name: s.propertyName || s.property_name,
          propertyName: s.propertyName || s.property_name,
          property_type: s.propertyType || s.property_type,
          propertyType: s.propertyType || s.property_type,
          scheduledDate: s.scheduledDate || s.scheduled_date || s.start_date,
          startDate: s.scheduledDate || s.scheduled_date || s.start_date,
          start_date: s.scheduledDate || s.scheduled_date || s.start_date,
          scheduledTime: s.scheduledTime || s.scheduled_time,
          status: s.status || 'scheduled',
          zone: getZoneName(s.zone),
          vendorName: s.vendorName || s.vendor_name,
          visitNumber: s.visitNumber || s.visit_number,
          totalVisits: s.totalVisits || s.total_visits,
          originalDate: s.originalDate || s.original_date,
          rescheduledAt: s.rescheduledAt || s.rescheduled_at,
          rescheduleReason: s.rescheduleReason || s.reschedule_reason,
          createdAt: s.createdAt || s.created_at,
          updatedAt: s.updatedAt || s.updated_at
        }));
        setSchedules(transformedSchedules);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setSchedules([]);
    } finally {
      setLoading(false);
      initialLoadDoneRef.current = true;
    }
  }, [selectedFp, portalType]);

  // Fetch pending properties using portal-specific endpoint
  const fetchPendingProperties = useCallback(async () => {
    try {
      const token = getAuthToken(); // Get token inside callback to avoid re-render loops
      const apiPath = getApiPath(portalType);
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/pending-properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        // Handle both array response and object with data property
        const propertiesData = Array.isArray(result) ? result : (result.data || result.properties || []);
        setPendingProperties(propertiesData);
      }
    } catch (err) {
      console.error('Pending properties error:', err);
    }
  }, [portalType]);

  useEffect(() => {
    fetchSchedules();
    fetchPendingProperties();
  }, [fetchSchedules, fetchPendingProperties]);
  
  // Separate interval to avoid re-creating on every render
  useEffect(() => {
    const interval = setInterval(fetchSchedules, 30000);
    return () => clearInterval(interval);
  }, [fetchSchedules]);

  // Calculate stats
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next7Days = new Date(today); next7Days.setDate(today.getDate() + 7);
  
  const getStatus = (s) => (s.status || '').toLowerCase();
  
  // Helper to get schedule date
  const getScheduleDate = (s) => {
    const dateStr = s.scheduledDate || s.scheduled_date || s.startDate || s.start_date;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  
  const todaysSchedules = schedules.filter(s => {
    const d = getScheduleDate(s);
    return d && d.getTime() === today.getTime() && !['completed', 'cancelled'].includes(getStatus(s));
  });
  
  const upcoming7Days = schedules.filter(s => {
    const d = getScheduleDate(s);
    return d && d > today && d <= next7Days && !['completed', 'cancelled'].includes(getStatus(s));
  });
  
  // Pending schedules - status is pending/pending_schedule
  const pendingSchedules = schedules.filter(s => ['pending', 'pending_schedule'].includes(getStatus(s)));
  
  const rescheduleRequests = schedules.filter(s => getStatus(s) === 'rescheduled');
  const cancelledSchedules = schedules.filter(s => getStatus(s) === 'cancelled');
  const completedSchedules = schedules.filter(s => getStatus(s) === 'completed');
  const inProgressSchedules = schedules.filter(s => getStatus(s) === 'in_progress');
  
  // Past its due date and still open - single source of truth for every overdue count
  const isPastDue = (s) => {
    const d = getScheduleDate(s);
    return !!d && d < today && !['completed', 'cancelled'].includes(getStatus(s));
  };
  
  const overdueSchedules = schedules.filter(isPastDue);

  // All non-cancelled schedules for status charts
  const allActiveSchedules = schedules.filter(s => getStatus(s) !== 'cancelled');

  // Chart data - Status (with filter) - Use all non-cancelled schedules to show complete picture
  const statusFilteredData = applyPeriodFilter(allActiveSchedules, statusFilter);
  // Pending work never reaches scheduled_visits, so it comes from the pending properties feed:
  // one entry per property still awaiting scheduling, and pendingServices per property still
  // awaiting a vendor.
  const pendingPropertiesFiltered = applyPeriodFilter(pendingProperties, statusFilter);
  const pendingCount = statusFilteredData.filter(s => ['pending', 'pending_schedule'].includes(getStatus(s))).length
    + pendingPropertiesFiltered.length;
  const toAssignVendorCount = pendingPropertiesFiltered.reduce((sum, p) => sum + (p.pendingServices || 0), 0);
  // Overdue is derived from the due date, using the same rule as the Overdue card above.
  // Overdue visits are counted only once - they are excluded from their own status bucket
  // so the slices stay disjoint and the donut total remains meaningful.
  const overdueFilteredForChart = statusFilteredData.filter(s => isPastDue(s));
  const onTimeStatusData = statusFilteredData.filter(s => !isPastDue(s));
  // Every status stays in the list, so a status with no schedules still shows as 0
  const statusData = [
    { name: 'Scheduled', value: onTimeStatusData.filter(s => ['scheduled', 'confirmed', 'work_order_created'].includes(getStatus(s))).length, color: STATUS_COLORS.scheduled },
    { name: 'In Progress', value: onTimeStatusData.filter(s => getStatus(s) === 'in_progress').length, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: onTimeStatusData.filter(s => getStatus(s) === 'completed').length, color: STATUS_COLORS.completed },
    { name: 'Rescheduled', value: onTimeStatusData.filter(s => getStatus(s) === 'rescheduled').length, color: STATUS_COLORS.rescheduled },
    { name: 'Overdue', value: overdueFilteredForChart.length, color: '#DC2626' },
    { name: 'Pending', value: pendingCount, color: STATUS_COLORS.pending },
    { name: 'To Assign Vendor', value: toAssignVendorCount, color: '#EA580C' }
  ];
  const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);

  // Chart data - Service (with filter) - All non-cancelled schedules
  const serviceFilteredData = applyPeriodFilter(allActiveSchedules, serviceFilter);
  const serviceCounts = {};
  serviceFilteredData.forEach(s => {
    const svc = s.service || s.serviceCategory || 'General';
    serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
  });
  const serviceData = Object.entries(serviceCounts)
    .map(([name, value]) => ({ name, value, color: getServiceColor(name) }))
    .sort((a, b) => b.value - a.value);
  const serviceTotal = serviceData.reduce((sum, d) => sum + d.value, 0);

  // Chart data - Property Type (with filter) - All non-cancelled schedules
  const propertyTypeFilteredData = applyPeriodFilter(allActiveSchedules, propertyTypeFilter);
  const propTypeCounts = {};
  propertyTypeFilteredData.forEach(s => {
    const pt = normalizePropertyType(s.property_type || s.propertyType);
    propTypeCounts[pt] = (propTypeCounts[pt] || 0) + 1;
  });
  // Always list every known property type - a type with no schedules must still show as 0
  const propertyTypeData = [
    ...PROPERTY_TYPES.map(name => ({ name, value: propTypeCounts[name] || 0, color: PROPERTY_TYPE_COLORS[name] || '#6B7280' })),
    // Any unexpected type coming from the data (e.g. 'Others') is appended when it has schedules
    ...Object.entries(propTypeCounts)
      .filter(([name, value]) => value > 0 && !PROPERTY_TYPES.includes(name))
      .map(([name, value]) => ({ name, value, color: PROPERTY_TYPE_COLORS[name] || '#6B7280' }))
  ].sort((a, b) => b.value - a.value);
  const propertyTypeTotal = propertyTypeData.reduce((sum, d) => sum + d.value, 0);

  // Trend data (filtered) - Shows past 3 days + today + next 3 days for better visualization
  const trendFilteredData = applyPeriodFilter(allActiveSchedules, trendFilter);
  const generateTrendData = () => {
    // Show 3 days before and 3 days after today for a balanced view
    const pastDays = 3;
    const futureDays = 3;
    const data = [];
    
    for (let i = -pastDays; i <= futureDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      // Filter schedules for this specific date
      const daySchedules = trendFilteredData.filter(s => {
        const scheduledDate = s.scheduledDate || s.scheduled_date || s.startDate || s.start_date;
        if (!scheduledDate) return false;
        const sDate = new Date(scheduledDate);
        sDate.setHours(0, 0, 0, 0);
        return sDate.getTime() === date.getTime();
      });
      
      data.push({
        date: dateStr,
        scheduled: daySchedules.filter(s => ['scheduled', 'confirmed', 'work_order_created'].includes(getStatus(s))).length,
        completed: daySchedules.filter(s => getStatus(s) === 'completed').length,
        inProgress: daySchedules.filter(s => getStatus(s) === 'in_progress').length
      });
    }
    return data;
  };
  const trendData = generateTrendData();

  // Upcoming schedules (filtered) - Only active schedules
  const activeUpcoming = todaysSchedules.concat(upcoming7Days).filter(s => getStatus(s) !== 'cancelled');
  const upcomingFilteredData = applyPeriodFilter(activeUpcoming, upcomingFilter);

  // Recently created (filtered) - newest first by real creation timestamp, cancelled excluded
  const recentFilteredData = applyPeriodFilter(allActiveSchedules, recentFilter, s => s.createdAt);
  const recentSchedules = [...recentFilteredData].sort((a, b) => 
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  ).slice(0, 5);

  // Reschedule requests (filtered on when the move was made)
  const rescheduleFilteredData = applyPeriodFilter(rescheduleRequests, rescheduleFilter, s => s.rescheduledAt || s.scheduledDate);

  // Overdue schedules (filtered)
  const overdueFilteredData = applyPeriodFilter(overdueSchedules, overdueFilter);

  // Pending properties (filtered)
  const pendingFilteredData = applyPeriodFilter(pendingProperties, pendingFilter);

  const StatusBadge = ({ status }) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-700',
      upcoming: 'bg-blue-100 text-blue-700',
      work_order_created: 'bg-purple-100 text-purple-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      pending: 'bg-gray-100 text-gray-700',
      pending_schedule: 'bg-gray-100 text-gray-700',
      rescheduled: 'bg-purple-100 text-purple-700',
      overdue: 'bg-red-100 text-red-700'
    };
    const s = (status || '').toLowerCase().replace(/\s+/g, '_');
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || colors.pending}`}>{status || 'Pending'}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Scheduling Dashboard</h1>
          <p className="text-sm text-gray-500">Home &gt; Scheduling &gt; Dashboard</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            onRefresh={fetchSchedules}
          />
          
          {/* Notifications Button */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 border rounded-lg hover:bg-gray-50 bg-white ${showNotifications ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              <Bell className={`w-5 h-5 ${showNotifications ? 'text-blue-600' : 'text-gray-600'}`} />
              {(overdueSchedules.length + rescheduleRequests.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {overdueSchedules.length + rescheduleRequests.length}
                </span>
              )}
            </button>
            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-96 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Notifications</h4>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {overdueSchedules.length === 0 && rescheduleRequests.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      No notifications
                    </div>
                  ) : (
                    <>
                      {overdueSchedules.slice(0, 3).map((s) => (
                        <div key={`overdue-${s.id}`} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`${getBasePath()}/schedules/all`)}>
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-red-100 rounded-lg mt-0.5">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{s.propertyName || '-'}</p>
                              <p className="text-xs text-red-600 truncate">Overdue: {s.service || '-'}</p>
                              <p className="text-xs text-gray-400">{formatDate(s.scheduledDate)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {rescheduleRequests.slice(0, 3).map((s) => (
                        <div key={`reschedule-${s.id}`} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`${getBasePath()}/schedules/reschedule-requests`)}>
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-pink-100 rounded-lg mt-0.5">
                              <RotateCcw className="w-4 h-4 text-pink-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{s.propertyName || '-'}</p>
                              <p className="text-xs text-pink-600 truncate">Rescheduled: {s.service || '-'}</p>
                              <p className="text-xs text-gray-400">{formatDate(s.originalDate)} &rarr; {formatDate(s.scheduledDate)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {(overdueSchedules.length > 3 || rescheduleRequests.length > 3) && (
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                    <button 
                      onClick={() => navigate(`${getBasePath()}/schedules/all`)}
                      className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View All Notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Refresh Button */}
          <button 
            onClick={fetchSchedules}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          
          {/* New Schedule Button */}
          <button
            onClick={() => navigate(`${getBasePath()}/schedules/pending`)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Schedule</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Stat Cards - Responsive grid with consistent heights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Today's", sublabel: "Schedules", value: todaysSchedules.length, icon: CalendarDays, color: '#3B82F6', bg: '#DBEAFE', link: 'View Today', path: '/schedules/calendar' },
          { label: 'Upcoming', sublabel: '(7 Days)', value: upcoming7Days.length, icon: Clock, color: '#F59E0B', bg: '#FEF3C7', link: 'View Upcoming', path: '/schedules/calendar' },
          { label: 'Pending', sublabel: 'Properties', value: pendingProperties.length, icon: Building2, color: '#8B5CF6', bg: '#EDE9FE', link: 'View Pending', path: '/schedules/pending' },
          { label: 'Reschedule', sublabel: 'Requests', value: rescheduleRequests.length, icon: RotateCcw, color: '#EC4899', bg: '#FCE7F3', link: 'View Requests', path: '/schedules/reschedule-requests' },
          { label: 'Cancelled', sublabel: 'Schedules', value: cancelledSchedules.length, icon: XCircle, color: '#EF4444', bg: '#FEE2E2', link: 'View Cancelled', path: '/schedules/cancelled' },
          { label: 'Overdue', sublabel: 'Schedules', value: overdueSchedules.length, icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2', link: 'View Overdue', path: '/schedules/all' }
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow flex flex-col min-h-[120px] sm:min-h-[140px]">
            <div className="flex items-start gap-2 mb-auto">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: card.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-700 font-semibold leading-tight truncate">{card.label}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 leading-tight truncate">{card.sublabel}</p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
              <button 
                onClick={() => navigate(`${getBasePath()}${card.path}`)}
                className="text-xs text-blue-600 hover:underline font-medium mt-1"
              >
                {card.link}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row - Responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Status Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Status</h3>
            <PeriodFilter value={statusFilter} onChange={setStatusFilter} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <DonutChart data={statusData} size={90} strokeWidth={16} centerValue={statusTotal} centerLabel="Total" />
            </div>
            <div className="space-y-1 text-xs min-w-0 flex-1 max-h-[170px] overflow-y-auto pr-1">
              {statusData.map((d, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: d.color }} />
                  {/* Status names are shown in full - they wrap instead of being cut off */}
                  <span className="text-gray-600 flex-1 leading-tight break-words">{d.name}</span>
                  <span className="font-medium text-gray-900 text-[10px] flex-shrink-0">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service Donut Chart - expanded, grows with the number of services */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden sm:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Service</h3>
            <PeriodFilter value={serviceFilter} onChange={setServiceFilter} />
          </div>
          {serviceData.length > 0 ? (
            <div className="flex items-center gap-5">
              <div className="flex-shrink-0">
                <DonutChart data={serviceData} size={170} strokeWidth={28} centerValue={serviceTotal} centerLabel="Total" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5 text-xs min-w-0 flex-1 max-h-[170px] overflow-y-auto pr-1">
                {serviceData.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: d.color }} />
                    {/* Long service names wrap onto a second line instead of being cut off */}
                    <span className="text-gray-600 flex-1 min-w-0 leading-tight break-words">{d.name}</span>
                    <span className="font-medium text-gray-900 flex-shrink-0 whitespace-nowrap">{d.value} ({serviceTotal ? Math.round((d.value / serviceTotal) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-16">No data</p>
          )}
        </div>

        {/* Property Type Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Property Type</h3>
            <PeriodFilter value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
          </div>
          {/* Stacked so each legend row gets the full card width - type names are long */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex-shrink-0">
              <DonutChart data={propertyTypeData} size={110} strokeWidth={18} centerValue={propertyTypeTotal} centerLabel="Total" />
            </div>
            <div className="space-y-1 text-xs w-full">
              {propertyTypeData.map((d, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 flex-1 min-w-0 leading-tight break-words">{d.name}</span>
                  <span className="font-medium text-gray-900 text-[10px] flex-shrink-0 whitespace-nowrap">{d.value} ({propertyTypeTotal ? Math.round((d.value / propertyTypeTotal) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Trend + Tables Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Schedule Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedule Trend</h3>
            <PeriodFilter value={trendFilter} onChange={setTrendFilter} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs mb-3">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Scheduled</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> In Progress</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={30} allowDecimals={false} domain={[0, 'auto']} />
              <Tooltip 
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value, name) => [value, name === 'scheduled' ? 'Scheduled' : name === 'completed' ? 'Completed' : 'In Progress']}
              />
              <Line type="monotone" dataKey="scheduled" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 6 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="inProgress" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Upcoming Schedules</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={upcomingFilter} onChange={setUpcomingFilter} />
              <button onClick={() => navigate(`${getBasePath()}/schedules/calendar`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {upcomingFilteredData.slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 w-24 flex-shrink-0">
                  <p>{formatDate(s.scheduledDate)}</p>
                  <p className="text-[10px] text-gray-400">{formatTimeOfDay(s.scheduledTime)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.title || '-'}</p>
                  <p className="text-xs text-gray-500 truncate">{s.propertyName || '-'}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {upcomingFilteredData.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No upcoming schedules</p>
            )}
          </div>
        </div>

        {/* Pending Property Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Pending Property Schedules</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={pendingFilter} onChange={setPendingFilter} />
              <button onClick={() => navigate(`${getBasePath()}/schedules/pending`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Property ID / Name</th>
                  <th className="pb-2 px-2 text-center">Services</th>
                  <th className="pb-2 px-2 text-center">Vendors</th>
                  <th className="pb-2 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingFilteredData.slice(0, 4).map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-2">
                      <p className="font-medium text-gray-900">{p.propertyId || '-'}</p>
                      <p className="text-gray-500 truncate max-w-[120px]">{p.propertyName || '-'}</p>
                    </td>
                    <td className="py-2 px-2 text-center">{p.totalServices || 0}</td>
                    <td className="py-2 px-2 text-center">{p.assignedVendors || 0}/{p.totalServices || 0}</td>
                    <td className="py-2 pl-2 text-right">
                      <button onClick={() => navigate(`${getBasePath()}/schedules/pending`)} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 font-medium">Schedule</button>
                    </td>
                  </tr>
                ))}
                {pendingFilteredData.length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-gray-400">No pending properties</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Tables Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Recently Created */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recently Created</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={recentFilter} onChange={setRecentFilter} />
              <button className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Property ID</th>
                  <th className="pb-2 px-2">Property</th>
                  <th className="pb-2 px-2">Service</th>
                  <th className="pb-2 px-2">Status</th>
                  <th className="pb-2 pl-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSchedules.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">{s.propertyCode || '-'}</td>
                    <td className="py-2.5 px-2 text-gray-600 truncate max-w-[80px]">{s.propertyName || '-'}</td>
                    <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{s.service || '-'}</td>
                    <td className="py-2.5 px-2"><StatusBadge status={s.status} /></td>
                    <td className="py-2.5 pl-2 text-gray-600 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
                {recentSchedules.length === 0 && (
                  <tr><td colSpan="5" className="py-6 text-center text-gray-400">No recent schedules</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reschedule Requests */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Reschedule Requests</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={rescheduleFilter} onChange={setRescheduleFilter} />
              <button onClick={() => navigate(`${getBasePath()}/schedules/reschedule-requests`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Property ID</th>
                  <th className="pb-2 px-2">Property</th>
                  <th className="pb-2 px-2">Original</th>
                  <th className="pb-2 px-2">Moved To</th>
                  <th className="pb-2 pl-2">Rescheduled On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rescheduleFilteredData.slice(0, 4).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">{s.propertyCode || '-'}</td>
                    <td className="py-2.5 px-2">
                      <p className="text-gray-900 truncate max-w-[100px]">{s.propertyName || '-'}</p>
                      <p className="text-gray-500 truncate max-w-[100px]">{s.service || '-'}</p>
                    </td>
                    <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{formatDate(s.originalDate)}</td>
                    <td className="py-2.5 px-2 text-orange-600 whitespace-nowrap">{formatDate(s.scheduledDate)}</td>
                    <td className="py-2.5 pl-2 text-gray-600 whitespace-nowrap" title={s.rescheduleReason || ''}>{formatDate(s.rescheduledAt)}</td>
                  </tr>
                ))}
                {rescheduleFilteredData.length === 0 && (
                  <tr><td colSpan="5" className="py-6 text-center text-gray-400">No reschedule requests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Overdue Schedules</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={overdueFilter} onChange={setOverdueFilter} />
              <button className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Property ID</th>
                  <th className="pb-2 px-2">Property</th>
                  <th className="pb-2 px-2">Due Date</th>
                  <th className="pb-2 px-2">Status</th>
                  <th className="pb-2 pl-2 text-right">Overdue By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overdueFilteredData.slice(0, 4).map((s) => {
                  const dueDate = getScheduleDate(s);
                  const daysOverdue = dueDate ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : null;
                  return (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">{s.propertyCode || '-'}</td>
                      <td className="py-2.5 px-2">
                        <p className="text-gray-900 truncate max-w-[100px]">{s.propertyName || '-'}</p>
                        <p className="text-gray-500 truncate max-w-[100px]">{s.service || '-'}</p>
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{formatDate(s.scheduledDate)}</td>
                      <td className="py-2.5 px-2"><StatusBadge status={s.status} /></td>
                      <td className="py-2.5 pl-2 text-red-600 font-medium text-right whitespace-nowrap">
                        {daysOverdue === null ? '-' : `${daysOverdue} ${daysOverdue === 1 ? 'Day' : 'Days'}`}
                      </td>
                    </tr>
                  );
                })}
                {overdueFilteredData.length === 0 && (
                  <tr><td colSpan="5" className="py-6 text-center text-gray-400">No overdue schedules</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulesDashboard;
