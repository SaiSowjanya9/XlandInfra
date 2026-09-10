import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, ChevronLeft, ChevronRight,
  Plus, Eye, RefreshCw, CheckCircle, AlertCircle, X, Settings
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Get API path based on portal type
const getApiPath = (portalType) => {
  const pathMap = {
    'admin': 'admin',
    'franchise': 'fp',
    'manager': 'manager',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor'
  };
  return pathMap[portalType] || 'admin';
};

const ScheduleCalendarView = ({ portalType = 'admin' }) => {
  const navigate = useNavigate();
  const apiPath = getApiPath(portalType);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    services: 'all', vendors: 'all', zones: 'all', propertyTypes: 'all'
  });
  const [viewOptions, setViewOptions] = useState({
    showUnscheduled: true,
    showWorkOrders: true,
    groupByVendor: false,
    groupByProperty: false
  });
  
  // Quick filter counts
  const [quickFilterCounts, setQuickFilterCounts] = useState({
    today: 0, upcoming: 0, overdue: 0, rescheduled: 0, cancelled: 0
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Fetch schedules from API
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get first and last day of the month for the query
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const response = await fetch(
        `${API_BASE}/api/${apiPath}/schedules/all?startDate=${startDate}&endDate=${endDate}&limit=500`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const schedulesData = data.data || data.schedules || [];
        
        // Handle both flat visit format and hierarchical property/service/visit format
        const allVisits = [];
        
        schedulesData.forEach(item => {
          // Check if item is already a flat visit record (has scheduledDate directly)
          if (item.scheduledDate || item.scheduled_date || item.targetDate) {
            // Flat format from /schedules/all endpoint
            allVisits.push({
              id: item.id || item.visitId,
              date: item.scheduledDate || item.scheduled_date || item.targetDate,
              time: item.scheduledTime || item.scheduled_time_start || '09:00',
              service: item.serviceName || item.service_name || item.serviceCategory || 'Service',
              property: item.propertyName || item.property_name,
              vendor: item.vendorName || item.vendor_name || 'Unassigned',
              status: item.status || 'scheduled',
              zone: item.zone,
              propertyType: item.propertyType || item.property_type,
              visitNumber: item.visitNumber,
              totalVisits: item.totalVisits
            });
          } else if (item.services && Array.isArray(item.services)) {
            // Hierarchical format with property -> services -> visits
            item.services.forEach(service => {
              if (service.visits && Array.isArray(service.visits)) {
                service.visits.forEach(visit => {
                  allVisits.push({
                    id: visit.id || visit.visitId,
                    date: visit.scheduledDate || visit.scheduled_date,
                    time: visit.scheduledTime || visit.scheduled_time_start || '09:00',
                    service: service.serviceName || service.service_name || 'Service',
                    property: item.propertyName || item.property_name,
                    vendor: service.vendorName || service.vendor_name || 'Unassigned',
                    status: visit.status || 'scheduled',
                    zone: item.zone,
                    propertyType: item.propertyType || item.property_type
                  });
                });
              }
            });
          }
        });
        
        setSchedules(allVisits);
        calculateQuickFilters(allVisits);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate, apiPath]);

  // Calculate quick filter counts
  const calculateQuickFilters = (schedulesData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    const counts = {
      today: 0,
      upcoming: 0,
      overdue: 0,
      rescheduled: 0,
      cancelled: 0
    };
    
    schedulesData.forEach(schedule => {
      const schedDate = new Date(schedule.date);
      schedDate.setHours(0, 0, 0, 0);
      const schedDateStr = schedule.date?.split('T')[0];
      
      if (schedDateStr === todayStr) counts.today++;
      if (schedDate >= today && schedDate <= weekFromNow && schedule.status !== 'cancelled') counts.upcoming++;
      if (schedDate < today && schedule.status !== 'completed' && schedule.status !== 'cancelled') counts.overdue++;
      if (schedule.status === 'rescheduled') counts.rescheduled++;
      if (schedule.status === 'cancelled') counts.cancelled++;
    });
    
    setQuickFilterCounts(counts);
  };

  // Load schedules on mount and when month changes
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Generate calendar days for current month view
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = [];
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  // Get schedules for a specific date from fetched data
  const getSchedulesForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return schedules.filter(s => {
      const schedDateStr = s.date?.split('T')[0];
      return schedDateStr === dateStr;
    }).map(s => ({
      ...s,
      time: formatTime(s.time)
    }));
  };

  // Format time for display
  const formatTime = (time) => {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes || '00'} ${ampm}`;
    } catch {
      return time;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 border-l-blue-500 text-blue-800',
      in_progress: 'bg-amber-100 border-l-amber-500 text-amber-800',
      completed: 'bg-green-100 border-l-green-500 text-green-800',
      rescheduled: 'bg-orange-100 border-l-orange-500 text-orange-800',
      cancelled: 'bg-red-100 border-l-red-500 text-red-800',
      overdue: 'bg-red-100 border-l-red-500 text-red-800'
    };
    return colors[status] || colors.scheduled;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const calendarDays = generateCalendarDays();

  // Quick filters data with real counts
  const quickFilters = [
    { label: "Today's Schedules", count: quickFilterCounts.today },
    { label: 'Upcoming (7 Days)', count: quickFilterCounts.upcoming },
    { label: 'Overdue', count: quickFilterCounts.overdue },
    { label: 'Rescheduled', count: quickFilterCounts.rescheduled },
    { label: 'Cancelled', count: quickFilterCounts.cancelled }
  ];

  const scheduleLegend = [
    { label: 'New / Pending', color: 'bg-amber-500' },
    { label: 'Scheduled', color: 'bg-blue-500' },
    { label: 'In Progress', color: 'bg-purple-500' },
    { label: 'Completed', color: 'bg-green-500' },
    { label: 'Rescheduled', color: 'bg-orange-500' },
    { label: 'Cancelled', color: 'bg-red-500' },
    { label: 'Overdue', color: 'bg-red-600' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500 mt-1">
              Home &gt; Scheduling &gt; Calendar
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Property, Vendor, Work Order..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              onClick={() => {
                const basePath = portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '';
                navigate(`${basePath}/schedules/pending`);
              }}
              className="px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          {['All Services', 'All Vendors', 'All Zones', 'All Property Types'].map((filter, i) => (
            <select key={i} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option>{filter}</option>
            </select>
          ))}

          <button 
            onClick={() => { setFilters({ services: 'all', vendors: 'all', zones: 'all', propertyTypes: 'all' }); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchSchedules}
              disabled={loading}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              {['Day', 'Week', 'Month', 'Year'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode.toLowerCase())}
                  className={`px-4 py-2 text-sm font-medium ${
                    viewMode === mode.toLowerCase()
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-6">
          {/* Main Calendar */}
          <div className="flex-1">
            {/* Calendar Header */}
            <div className="bg-white rounded-t-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => navigateMonth(-1)}
                    className="p-1.5 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => navigateMonth(1)}
                    className="p-1.5 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white border-x border-b border-gray-200 rounded-b-xl overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              )}
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200">
                {dayNames.map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-sm font-semibold text-gray-600 bg-gray-50">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const daySchedules = getSchedulesForDate(day.date);
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[140px] border-b border-r border-gray-200 p-1 ${
                        !day.isCurrentMonth ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium px-1.5 py-0.5 rounded ${
                          isToday 
                            ? 'bg-blue-600 text-white' 
                            : day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {day.date.getDate()}
                        </span>
                        {daySchedules.length > 0 && (
                          <span className="text-xs text-gray-500">{daySchedules.length}</span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {daySchedules.slice(0, 3).map((schedule, i) => (
                          <div
                            key={i}
                            className={`px-1.5 py-1 text-xs rounded border-l-2 cursor-pointer hover:shadow-sm ${getStatusColor(schedule.status)}`}
                          >
                            <p className="font-medium truncate">{schedule.time}</p>
                            <p className="truncate">{schedule.service}</p>
                            <p className="truncate text-gray-600">{schedule.property}</p>
                          </div>
                        ))}
                        {daySchedules.length > 3 && (
                          <button className="text-xs text-blue-600 hover:underline w-full text-left px-1">
                            +{daySchedules.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            {/* Mini Calendar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="py-1 text-gray-500 font-medium">{day}</div>
                ))}
                {calendarDays.slice(0, 35).map((day, i) => {
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={i}
                      className={`py-1 rounded ${
                        isToday && day.isCurrentMonth
                          ? 'bg-blue-600 text-white'
                          : day.isCurrentMonth ? 'hover:bg-gray-100' : 'text-gray-400'
                      }`}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule Legend */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Schedule Legend</h3>
              <div className="space-y-2">
                {scheduleLegend.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${item.color}`} />
                    <span className="text-sm text-gray-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Filters</h3>
              <div className="space-y-2">
                {quickFilters.map((filter, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-600">{filter.label}</span>
                    <span className="text-sm font-medium text-blue-600">{filter.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* View Options */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">View Options</h3>
              <div className="space-y-2">
                {[
                  { key: 'showUnscheduled', label: 'Show Unscheduled' },
                  { key: 'showWorkOrders', label: 'Show Work Orders' },
                  { key: 'groupByVendor', label: 'Group by Vendor' },
                  { key: 'groupByProperty', label: 'Group by Property' }
                ].map((option) => (
                  <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viewOptions[option.key]}
                      onChange={(e) => setViewOptions({ ...viewOptions, [option.key]: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleCalendarView;
