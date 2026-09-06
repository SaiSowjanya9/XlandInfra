import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Building2,
  Filter,
  Eye,
  ArrowRight,
  AlertCircle,
  Wrench,
  Home,
  Users,
  X,
  Search,
  MoreHorizontal,
  Truck,
  Phone,
  Mail,
  Star,
  Save,
  Repeat,
  Edit3,
  Trash2,
  Copy
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Status colors
const STATUS_COLORS = {
  upcoming: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#10B981',
  rescheduled: '#8B5CF6',
  cancelled: '#EF4444',
  draft: '#6B7280',
  active: '#3B82F6',
  paused: '#F59E0B'
};

// Type colors (Requests, Quotes, Jobs)
const TYPE_COLORS = {
  request: '#3B82F6',
  quote: '#8B5CF6',
  job: '#10B981'
};

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'employee': 'admin',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor'
  };
  return portalMap[portalType] || 'fp';
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format time helper
const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Format date to IST (dd/mm/yyyy) for input display
const formatDateIST = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date)) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

// Parse IST date (dd/mm/yyyy) to yyyy-mm-dd
const parseISTDate = (displayStr) => {
  if (!displayStr || displayStr.length < 10) return null;
  const parts = displayStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle IST date input with auto-formatting
const handleISTDateInput = (value) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  return cleaned;
};

// Role-based permissions for scheduling
const getSchedulePermissions = (portalType) => {
  const permissions = {
    admin: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, fullAccess: true },
    operations_manager: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, fullAccess: false },
    franchise: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: false, fullAccess: false },
    manager: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, fullAccess: false },
    coordinator: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, fullAccess: false },
    supervisor: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, fullAccess: false },
    executive: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, fullAccess: false }
  };
  return permissions[portalType] || permissions.executive;
};

const ScheduleService = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  const permissions = getSchedulePermissions(portalType);
  
  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [zones, setZones] = useState([]);
  const [properties, setProperties] = useState([]);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  
  // Calendar states
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('Month');
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showVendorAvailability, setShowVendorAvailability] = useState(false);
  
  // Create/Edit form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    vendorId: '',
    propertyId: '',
    zone: '',
    type: 'job',
    isRecurring: false,
    recurringType: 'weekly',
    recurringEndDate: '',
    priority: 'normal',
    notes: ''
  });
  
  // IST date display states
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState('');
  const [recurringEndDateDisplay, setRecurringEndDateDisplay] = useState('');

  // Fetch schedules
  const fetchSchedules = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/schedules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          console.warn('Schedules API not available, showing empty state');
          setSchedules([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSchedules(result.data || []);
      } else {
        console.warn('Schedules fetch warning:', result.message);
        setSchedules([]);
      }
    } catch (err) {
      console.error('Fetch schedules error:', err);
      setSchedules([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Fetch vendors
  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setVendors(result.data);
      } else if (Array.isArray(result)) {
        setVendors(result);
      }
    } catch (err) {
      console.error('Fetch vendors error:', err);
    }
  }, [token]);

  // Fetch zones
  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/onboarding/suggestions/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setZones(result.data);
      } else if (Array.isArray(result)) {
        setZones(result);
      }
    } catch (err) {
      console.error('Fetch zones error:', err);
    }
  }, [token]);

  // Fetch properties
  const fetchProperties = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/onboarding/properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setProperties(result.data);
      } else if (Array.isArray(result)) {
        setProperties(result);
      }
    } catch (err) {
      console.error('Fetch properties error:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    setCalendarDate(new Date());
    fetchSchedules();
    fetchVendors();
    fetchZones();
    fetchProperties();
    const interval = setInterval(() => fetchSchedules(false), 30000);
    return () => clearInterval(interval);
  }, [fetchSchedules, fetchVendors, fetchZones, fetchProperties]);

  // Time slots for Week and Day views (6 AM to 9 PM)
  const timeSlots = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00'
  ];

  // Format time slot for display
  const formatTimeSlot = (time) => {
    const [hours] = time.split(':');
    const hour = parseInt(hours, 10);
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Calendar helpers - Month view
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  // Get days for Week view (Sunday to Saturday of current week)
  const getDaysInWeek = (date) => {
    const days = [];
    const currentDay = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - currentDay);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push({
        date: day,
        isCurrentMonth: day.getMonth() === date.getMonth()
      });
    }
    
    return days;
  };

  // Get schedules for a specific date
  const getSchedulesForDate = (date) => {
    return schedules.filter(s => {
      const sDate = new Date(s.startDate || s.start_date);
      return sDate.toDateString() === date.toDateString();
    });
  };

  // Get schedules for a specific time slot on a date
  const getSchedulesForTimeSlot = (date, timeSlot) => {
    return schedules.filter(s => {
      const sDate = new Date(s.startDate || s.start_date);
      if (sDate.toDateString() !== date.toDateString()) return false;
      
      const scheduleHour = sDate.getHours();
      const slotHour = parseInt(timeSlot.split(':')[0], 10);
      
      // Check if schedule starts in this hour
      return scheduleHour === slotHour;
    });
  };

  // Navigate calendar based on view
  const navigateCalendar = (direction) => {
    const newDate = new Date(calendarDate);
    
    if (calendarView === 'Month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (calendarView === 'Week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (calendarView === 'Day') {
      newDate.setDate(newDate.getDate() + direction);
    }
    
    setCalendarDate(newDate);
  };

  // Get display title based on view
  const getCalendarTitle = () => {
    if (calendarView === 'Month') {
      return `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;
    } else if (calendarView === 'Week') {
      const weekDays = getDaysInWeek(calendarDate);
      const startDate = weekDays[0].date;
      const endDate = weekDays[6].date;
      const startMonth = monthNames[startDate.getMonth()].slice(0, 3);
      const endMonth = monthNames[endDate.getMonth()].slice(0, 3);
      
      if (startDate.getMonth() === endDate.getMonth()) {
        return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`;
      }
      return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${endDate.getFullYear()}`;
    } else {
      return calendarDate.toLocaleDateString('en-IN', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
  };

  // Go to today
  const goToToday = () => {
    setCalendarDate(new Date());
  };

  const getFilteredSchedules = () => {
    let filtered = schedules;
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(s => (s.type || 'job').toLowerCase() === typeFilter);
    }
    
    if (vendorFilter !== 'all') {
      filtered = filtered.filter(s => s.vendorId === vendorFilter || s.vendor_id === vendorFilter);
    }
    
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(s => s.zone === zoneFilter);
    }
    
    return filtered;
  };

  const filteredSchedules = getFilteredSchedules();
  const calendarDays = getDaysInMonth(calendarDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Unscheduled items (drafts or items without dates)
  const unscheduledItems = schedules.filter(s => {
    const status = (s.status || '').toLowerCase();
    return status === 'draft' || !s.startDate;
  });

  // Get vendor by ID
  const getVendorById = (vendorId) => {
    return vendors.find(v => v.id === vendorId || v._id === vendorId);
  };

  // Check for scheduling conflicts
  const checkConflicts = (vendorId, date, startTime, endTime) => {
    const conflicts = schedules.filter(s => {
      if ((s.vendorId || s.vendor_id) !== vendorId) return false;
      const sDate = new Date(s.startDate || s.start_date);
      if (sDate.toDateString() !== date.toDateString()) return false;
      return true;
    });
    return conflicts;
  };

  // Handle form change
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle save schedule
  const handleSaveSchedule = async () => {
    try {
      const scheduleData = {
        ...formData,
        createdBy: user?.id,
        status: formData.startDate ? 'upcoming' : 'draft'
      };

      const response = await fetch(`${API_BASE}/api/schedules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      });

      const result = await response.json();
      
      if (result.success) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          vendorId: '',
          propertyId: '',
          zone: '',
          type: 'job',
          isRecurring: false,
          recurringType: 'weekly',
          recurringEndDate: '',
          priority: 'normal',
          notes: ''
        });
        fetchSchedules(true);
      } else {
        alert(result.message || 'Failed to create schedule');
      }
    } catch (err) {
      console.error('Save schedule error:', err);
      alert('Failed to save schedule');
    }
  };

  // Handle drag start
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('scheduleId', item.id || item._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drop on calendar date
  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    const scheduleId = e.dataTransfer.getData('scheduleId');
    if (!scheduleId) return;

    try {
      const response = await fetch(`${API_BASE}/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: targetDate.toISOString(),
          status: 'upcoming'
        })
      });

      const result = await response.json();
      if (result.success) {
        fetchSchedules(true);
      }
    } catch (err) {
      console.error('Update schedule error:', err);
    }
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusColors = {
      upcoming: 'bg-blue-100 text-blue-700',
      active: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      rescheduled: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '_') || 'draft';
    const statusLabels = {
      upcoming: 'Upcoming',
      active: 'Active',
      draft: 'Draft',
      in_progress: 'In Progress',
      completed: 'Completed',
      rescheduled: 'Rescheduled',
      cancelled: 'Cancelled'
    };
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || 'bg-gray-100 text-gray-700'}`}>
        {statusLabels[normalizedStatus] || status}
      </span>
    );
  };

  // Type badge component
  const TypeBadge = ({ type }) => {
    const typeColors = {
      request: 'bg-blue-50 text-blue-700 border-blue-200',
      quote: 'bg-purple-50 text-purple-700 border-purple-200',
      job: 'bg-green-50 text-green-700 border-green-200'
    };
    const normalizedType = (type || 'job').toLowerCase();
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${typeColors[normalizedType] || typeColors.job}`}>
        {normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)}
      </span>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading schedule service...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Service</h1>
          <p className="text-gray-500 mt-1">Schedule and manage vendor services</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Refresh */}
          <button
            onClick={() => fetchSchedules(true)}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Vendor Availability */}
          <button
            onClick={() => setShowVendorAvailability(!showVendorAvailability)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors font-medium ${
              showVendorAvailability 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Vendor Availability
          </button>

          {/* New Schedule Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Unscheduled Sidebar */}
        <div className="lg:col-span-1 bg-amber-50 rounded-xl p-4 border border-amber-200">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Unscheduled
          </h3>
          <p className="text-xs text-amber-600 mb-3">Drag items to calendar to schedule</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {unscheduledItems.length > 0 ? (
              unscheduledItems.map((item, idx) => (
                <div
                  key={item.id || item._id || idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="bg-white rounded-lg p-3 cursor-move hover:shadow-md transition-all border border-amber-100 hover:border-amber-300"
                >
                  <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.propertyName || item.property_name || 'No property'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <TypeBadge type={item.type} />
                    {item.vendorId && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {getVendorById(item.vendorId)?.name || 'Assigned'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-amber-700">No unscheduled items</p>
            )}
          </div>
        </div>

        {/* Calendar Section */}
        <div className="lg:col-span-3">
          {/* Calendar Navigation & Filters */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              {/* Navigation */}
              <div className="flex items-center gap-4">
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateCalendar(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-lg font-semibold min-w-[200px] text-center">
                  {getCalendarTitle()}
                </span>
                <button
                  onClick={() => navigateCalendar(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                {['Month', 'Week', 'Day'].map(view => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      calendarView === view
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="request">Requests</option>
                  <option value="quote">Quotes</option>
                  <option value="job">Jobs</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Vendor Filter */}
              <div className="relative">
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Vendors</option>
                  {vendors.map((vendor, idx) => (
                    <option key={vendor.id || vendor._id || idx} value={vendor.id || vendor._id}>
                      {vendor.name || vendor.companyName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Zone Filter */}
              <div className="relative">
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Zones</option>
                  {zones.map((zone, idx) => (
                    <option key={idx} value={zone.name || zone}>{zone.name || zone}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Map View Button */}
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                <MapPin className="w-4 h-4" />
                Map View
              </button>
            </div>
          </div>

          {/* Calendar Grid - Month View */}
          {calendarView === 'Month' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Days Header */}
              <div className="grid grid-cols-7 bg-gray-50 border-b">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-600 py-3">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.slice(0, 35).map((day, idx) => {
                  const daySchedules = getSchedulesForDate(day.date).filter(s => {
                    if (typeFilter !== 'all' && (s.type || 'job').toLowerCase() !== typeFilter) return false;
                    if (vendorFilter !== 'all' && s.vendorId !== vendorFilter && s.vendor_id !== vendorFilter) return false;
                    if (zoneFilter !== 'all' && s.zone !== zoneFilter) return false;
                    return true;
                  });
                  const isToday = day.date.toDateString() === today.toDateString();
                  
                  return (
                    <div
                      key={idx}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day.date)}
                      className={`min-h-[100px] p-2 border-b border-r ${
                        !day.isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-blue-50 transition-colors`}
                    >
                      <span className={`text-sm ${
                        !day.isCurrentMonth ? 'text-gray-300' :
                        isToday ? 'w-7 h-7 bg-blue-600 text-white rounded-full inline-flex items-center justify-center font-bold' :
                        'text-gray-700'
                      }`}>
                        {day.date.getDate()}
                      </span>
                      <div className="mt-1 space-y-1">
                        {daySchedules.slice(0, 3).map((s, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedSchedule(s);
                              setShowScheduleModal(true);
                            }}
                            className="text-xs px-2 py-1 rounded cursor-pointer truncate hover:opacity-80"
                            style={{
                              backgroundColor: `${TYPE_COLORS[(s.type || 'job').toLowerCase()] || TYPE_COLORS.job}15`,
                              borderLeft: `3px solid ${TYPE_COLORS[(s.type || 'job').toLowerCase()] || TYPE_COLORS.job}`
                            }}
                          >
                            <span className="font-medium">{formatTime(s.startDate || s.start_date) || ''}</span>
                            {formatTime(s.startDate || s.start_date) && ' - '}
                            {s.title}
                          </div>
                        ))}
                        {daySchedules.length > 3 && (
                          <div className="text-xs text-gray-500 pl-2">
                            +{daySchedules.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calendar Grid - Week View */}
          {calendarView === 'Week' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Week Header with Days */}
              <div className="grid grid-cols-8 bg-gray-50 border-b">
                <div className="text-center text-sm font-medium text-gray-400 py-3 border-r">
                  Time
                </div>
                {getDaysInWeek(calendarDate).map((day, idx) => {
                  const isToday = day.date.toDateString() === today.toDateString();
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  return (
                    <div 
                      key={idx} 
                      className={`text-center py-3 ${idx < 6 ? 'border-r' : ''} ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className="text-xs font-medium text-gray-500">{dayNames[idx]}</div>
                      <div className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                        {day.date.getDate()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {monthNames[day.date.getMonth()].slice(0, 3)}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Time Slots Grid */}
              <div className="max-h-[600px] overflow-y-auto">
                {timeSlots.map((time, timeIdx) => (
                  <div key={time} className="grid grid-cols-8 border-b">
                    {/* Time Label */}
                    <div className="text-xs font-medium text-gray-400 py-2 px-2 border-r bg-gray-50 sticky left-0">
                      {formatTimeSlot(time)}
                    </div>
                    
                    {/* Day Columns */}
                    {getDaysInWeek(calendarDate).map((day, dayIdx) => {
                      const slotSchedules = getSchedulesForTimeSlot(day.date, time).filter(s => {
                        if (typeFilter !== 'all' && (s.type || 'job').toLowerCase() !== typeFilter) return false;
                        if (vendorFilter !== 'all' && s.vendorId !== vendorFilter && s.vendor_id !== vendorFilter) return false;
                        if (zoneFilter !== 'all' && s.zone !== zoneFilter) return false;
                        return true;
                      });
                      const isToday = day.date.toDateString() === today.toDateString();
                      const isCurrentHour = isToday && new Date().getHours() === parseInt(time.split(':')[0], 10);
                      
                      return (
                        <div
                          key={dayIdx}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            const dropDate = new Date(day.date);
                            dropDate.setHours(parseInt(time.split(':')[0], 10), 0, 0, 0);
                            handleDrop(e, dropDate);
                          }}
                          className={`min-h-[60px] p-1 ${dayIdx < 6 ? 'border-r' : ''} ${
                            isToday ? 'bg-blue-50/30' : ''
                          } ${isCurrentHour ? 'bg-blue-100/50' : ''} hover:bg-blue-50 transition-colors`}
                        >
                          {slotSchedules.map((s, i) => (
                            <div
                              key={i}
                              onClick={() => {
                                setSelectedSchedule(s);
                                setShowScheduleModal(true);
                              }}
                              className="text-xs px-2 py-1 rounded cursor-pointer mb-1 hover:opacity-80"
                              style={{
                                backgroundColor: `${TYPE_COLORS[(s.type || 'job').toLowerCase()] || TYPE_COLORS.job}20`,
                                borderLeft: `3px solid ${TYPE_COLORS[(s.type || 'job').toLowerCase()] || TYPE_COLORS.job}`
                              }}
                            >
                              <div className="font-medium truncate">{s.title}</div>
                              <div className="text-gray-500 truncate">
                                {getVendorById(s.vendorId || s.vendor_id)?.name || 'No vendor'}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar Grid - Day View */}
          {calendarView === 'Day' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Day Header */}
              <div className="bg-gray-50 border-b p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {calendarDate.toLocaleDateString('en-IN', { weekday: 'long' })}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {calendarDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      {getSchedulesForDate(calendarDate).filter(s => {
                        if (typeFilter !== 'all' && (s.type || 'job').toLowerCase() !== typeFilter) return false;
                        if (vendorFilter !== 'all' && s.vendorId !== vendorFilter && s.vendor_id !== vendorFilter) return false;
                        if (zoneFilter !== 'all' && s.zone !== zoneFilter) return false;
                        return true;
                      }).length} schedules
                    </p>
                    {calendarDate.toDateString() === today.toDateString() && (
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Time Slots */}
              <div className="max-h-[600px] overflow-y-auto">
                {timeSlots.map((time, idx) => {
                  const slotSchedules = getSchedulesForTimeSlot(calendarDate, time).filter(s => {
                    if (typeFilter !== 'all' && (s.type || 'job').toLowerCase() !== typeFilter) return false;
                    if (vendorFilter !== 'all' && s.vendorId !== vendorFilter && s.vendor_id !== vendorFilter) return false;
                    if (zoneFilter !== 'all' && s.zone !== zoneFilter) return false;
                    return true;
                  });
                  const isCurrentHour = calendarDate.toDateString() === today.toDateString() && 
                                        new Date().getHours() === parseInt(time.split(':')[0], 10);
                  
                  return (
                    <div 
                      key={time} 
                      className={`flex border-b ${isCurrentHour ? 'bg-blue-50' : ''}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        const dropDate = new Date(calendarDate);
                        dropDate.setHours(parseInt(time.split(':')[0], 10), 0, 0, 0);
                        handleDrop(e, dropDate);
                      }}
                    >
                      {/* Time Label */}
                      <div className="w-20 flex-shrink-0 text-sm font-medium text-gray-400 py-4 px-3 border-r bg-gray-50 text-right">
                        {formatTimeSlot(time)}
                      </div>
                      
                      {/* Schedule Content */}
                      <div className="flex-1 min-h-[80px] p-2 hover:bg-gray-50 transition-colors">
                        {slotSchedules.length > 0 ? (
                          <div className="space-y-2">
                            {slotSchedules.map((s, i) => {
                              const vendor = getVendorById(s.vendorId || s.vendor_id);
                              return (
                                <div
                                  key={i}
                                  onClick={() => {
                                    setSelectedSchedule(s);
                                    setShowScheduleModal(true);
                                  }}
                                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:shadow-md transition-all"
                                  style={{
                                    backgroundColor: `${TYPE_COLORS[(s.type || 'job').toLowerCase()] || TYPE_COLORS.job}10`,
                                    borderLeft: `4px solid ${TYPE_COLORS[(s.type || 'job').toLowerCase()] || TYPE_COLORS.job}`
                                  }}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-900">{s.title}</span>
                                      <TypeBadge type={s.type} />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {s.propertyName || s.property_name || 'No property'}
                                    </p>
                                    {vendor && (
                                      <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>{vendor.name || vendor.companyName}</span>
                                      </div>
                                    )}
                                    {s.description && (
                                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.description}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-gray-700">
                                      {formatTime(s.startDate || s.start_date)}
                                    </div>
                                    <StatusBadge status={s.status} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-300 text-sm">
                            {isCurrentHour && <Clock className="w-4 h-4 mr-1" />}
                            {isCurrentHour ? 'Current hour' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color Legend */}
          <div className="flex items-center gap-6 mt-4 text-sm bg-white rounded-lg p-3 border border-gray-100">
            <span className="text-gray-500">Color Coding:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.request }} />
              <span className="text-gray-600">Requests</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.quote }} />
              <span className="text-gray-600">Quotes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.job }} />
              <span className="text-gray-600">Jobs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Availability Panel */}
      {showVendorAvailability && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Vendor Availability Today
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.slice(0, 6).map((vendor, idx) => {
              const vendorSchedules = schedules.filter(s => {
                const sDate = new Date(s.startDate || s.start_date);
                sDate.setHours(0, 0, 0, 0);
                return sDate.getTime() === today.getTime() && 
                       (s.vendorId === (vendor.id || vendor._id) || s.vendor_id === (vendor.id || vendor._id));
              });
              const isAvailable = vendorSchedules.length < 3;
              
              return (
                <div key={vendor.id || vendor._id || idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAvailable ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Truck className={`w-5 h-5 ${isAvailable ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{vendor.name || vendor.companyName}</p>
                    <p className="text-xs text-gray-500">
                      {vendorSchedules.length} jobs scheduled today
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isAvailable ? 'Available' : 'Busy'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Create New Schedule</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="e.g., Plumbing Service"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="request">Request</option>
                    <option value="quote">Quote</option>
                    <option value="job">Job</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleFormChange('priority', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Vendor</label>
                <select
                  value={formData.vendorId}
                  onChange={(e) => handleFormChange('vendorId', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor, idx) => (
                    <option key={vendor.id || vendor._id || idx} value={vendor.id || vendor._id}>
                      {vendor.name || vendor.companyName} - {vendor.serviceCategory || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property ID</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Property ID..."
                    value={formData.propertySearch || ''}
                    onChange={(e) => {
                      handleFormChange('propertySearch', e.target.value);
                      const searchVal = e.target.value.toLowerCase();
                      const matchedProp = properties.find(p => 
                        (p.property_id || p.propertyId || '').toLowerCase().includes(searchVal) ||
                        (p.name || p.property_name || '').toLowerCase().includes(searchVal)
                      );
                      if (matchedProp) {
                        handleFormChange('propertyId', matchedProp.id || matchedProp._id);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {formData.propertyId && (
                  <p className="text-xs text-green-600 mt-1">
                    Selected: {properties.find(p => (p.id || p._id) == formData.propertyId)?.name || properties.find(p => (p.id || p._id) == formData.propertyId)?.property_name || 'Property found'}
                  </p>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={startDateDisplay}
                      onChange={(e) => {
                        const formatted = handleISTDateInput(e.target.value);
                        setStartDateDisplay(formatted);
                        const parsed = parseISTDate(formatted);
                        if (parsed) handleFormChange('startDate', parsed);
                      }}
                      onBlur={() => {
                        const parsed = parseISTDate(startDateDisplay);
                        if (parsed) handleFormChange('startDate', parsed);
                        else if (startDateDisplay && startDateDisplay.length < 10) setStartDateDisplay(formatDateIST(formData.startDate));
                      }}
                      className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleFormChange('startDate', e.target.value);
                            setStartDateDisplay(formatDateIST(e.target.value));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleFormChange('startTime', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={endDateDisplay}
                      onChange={(e) => {
                        const formatted = handleISTDateInput(e.target.value);
                        setEndDateDisplay(formatted);
                        const parsed = parseISTDate(formatted);
                        if (parsed) handleFormChange('endDate', parsed);
                      }}
                      onBlur={() => {
                        const parsed = parseISTDate(endDateDisplay);
                        if (parsed) handleFormChange('endDate', parsed);
                        else if (endDateDisplay && endDateDisplay.length < 10) setEndDateDisplay(formatDateIST(formData.endDate));
                      }}
                      className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleFormChange('endDate', e.target.value);
                            setEndDateDisplay(formatDateIST(e.target.value));
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleFormChange('endTime', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Recurring Schedule */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => handleFormChange('isRecurring', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Recurring Schedule
                  </span>
                </label>
                
                {formData.isRecurring && (
                  <div className="mt-3 grid grid-cols-2 gap-4 ml-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
                      <select
                        value={formData.recurringType}
                        onChange={(e) => handleFormChange('recurringType', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="dd/mm/yyyy"
                          value={recurringEndDateDisplay}
                          onChange={(e) => {
                            const formatted = handleISTDateInput(e.target.value);
                            setRecurringEndDateDisplay(formatted);
                            const parsed = parseISTDate(formatted);
                            if (parsed) handleFormChange('recurringEndDate', parsed);
                          }}
                          onBlur={() => {
                            const parsed = parseISTDate(recurringEndDateDisplay);
                            if (parsed) handleFormChange('recurringEndDate', parsed);
                            else if (recurringEndDateDisplay && recurringEndDateDisplay.length < 10) setRecurringEndDateDisplay(formatDateIST(formData.recurringEndDate));
                          }}
                          className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                          <input
                            type="date"
                            value={formData.recurringEndDate}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleFormChange('recurringEndDate', e.target.value);
                                setRecurringEndDateDisplay(formatDateIST(e.target.value));
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Add any additional details..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Notes for internal use only..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSchedule}
                disabled={!formData.title}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {formData.startDate ? 'Schedule' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Schedule Modal */}
      {showScheduleModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Schedule Details</h2>
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedSchedule(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-semibold text-gray-900 text-lg">{selectedSchedule.title}</p>
                </div>
                <div className="flex gap-2">
                  <TypeBadge type={selectedSchedule.type} />
                  <StatusBadge status={selectedSchedule.status} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedSchedule.startDate || selectedSchedule.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="font-medium text-gray-900">{formatTime(selectedSchedule.startDate || selectedSchedule.start_date) || 'Not set'}</p>
                </div>
              </div>

              {selectedSchedule.vendorId && (
                <div>
                  <p className="text-sm text-gray-500">Assigned Vendor</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Truck className="w-4 h-4 text-gray-400" />
                    <p className="font-medium text-gray-900">
                      {getVendorById(selectedSchedule.vendorId)?.name || getVendorById(selectedSchedule.vendorId)?.companyName || 'Unknown Vendor'}
                    </p>
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property</p>
                <p className="text-sm font-medium text-gray-900">{selectedSchedule.propertyName || selectedSchedule.property_name || '-'}</p>
              </div>
              
              {selectedSchedule.description && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Description</p>
                  <p className="text-xs text-gray-700">{selectedSchedule.description}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-4 border-t">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Edit3 className="w-4 h-4" />
                  Edit Schedule
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleService;
