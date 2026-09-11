import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Search, Bell,
  CheckCircle, Clock, AlertCircle, XCircle, RefreshCw, X,
  MapPin, User, Building2, Wrench, Truck, Phone, Mail, FileText
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Normalize property type to consistent display format
const normalizePropertyType = (type) => {
  if (!type) return 'Other';
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

const ScheduleCalendar = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get base path based on portal type
  const getBasePath = () => {
    const pathMap = {
      'franchise': '/fp',
      'manager': '/manager',
      'admin': '/admin',
      'coordinator': '/coordinator',
      'supervisor': '/supervisor'
    };
    return pathMap[portalType] || '/admin';
  };
  const [viewMode, setViewMode] = useState('Month');
  const [schedules, setSchedules] = useState([]);
  const [filters, setFilters] = useState({
    service: 'All Services',
    vendor: 'All Vendors',
    zone: 'All Zones',
    propertyType: 'All Property Types'
  });
  const [viewOptions, setViewOptions] = useState({
    showUnscheduled: true,
    zoneFilter: 'All Zones',
    groupByVendor: false,
    groupByProperty: false
  });
  const [activeQuickFilter, setActiveQuickFilter] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Dynamic filter options from API
  const [zones, setZones] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [services, setServices] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Extract unique zones from schedules data
  useEffect(() => {
    if (schedules.length > 0) {
      const uniqueZones = [...new Set(schedules.map(s => s.zone).filter(Boolean))].sort();
      setZones(uniqueZones.map(z => ({ name: z, zone_name: z })));
    }
  }, [schedules]);

  // Fetch vendors from API
  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/vendors?status=active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setVendors(result.data);
      }
    } catch (err) {
      console.error('Fetch vendors error:', err);
    }
  }, [token]);

  // Fetch services from API
  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const serviceNames = [...new Set(result.data.map(s => s.name || s.serviceName || s.service_name).filter(Boolean))];
        setServices(serviceNames);
      }
    } catch (err) {
      console.error('Fetch services error:', err);
    }
  }, [token]);

  // Fetch property types from API
  const fetchPropertyTypes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/onboarding/suggestions/property-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPropertyTypes(result.data);
      } else {
        // Fallback property types
        setPropertyTypes(['Gated Community', 'Apartment', 'Villa', 'Flat', 'Plot']);
      }
    } catch (err) {
      console.error('Fetch property types error:', err);
      setPropertyTypes(['Gated Community', 'Apartment', 'Villa', 'Flat', 'Plot']);
    }
  }, [token]);

  // Get API path based on portal type
  const getApiPath = () => {
    const pathMap = {
      'franchise': 'fp',
      'manager': 'manager',
      'admin': 'admin',
      'coordinator': 'coordinator',
      'supervisor': 'supervisor'
    };
    return pathMap[portalType] || 'admin';
  };
  const apiPath = getApiPath();

  // Fetch real schedules from API
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get first and last day of the month for the query
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const response = await fetch(
        `${API_BASE}/api/${apiPath}/schedules/all?startDate=${startDate}&endDate=${endDate}&limit=500`, 
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const result = await response.json();
      
      if (result.success && Array.isArray(result.data)) {
        // Transform API data to component format
        const formattedSchedules = result.data.map(s => {
          // Parse scheduled date
          const scheduledDate = s.scheduledDate ? new Date(s.scheduledDate) : new Date();
          
          // Format time
          let timeStr = '10:00 AM';
          if (s.scheduledTime) {
            const [hours, minutes] = s.scheduledTime.split(':').map(Number);
            const isPM = hours >= 12;
            const hour12 = hours % 12 || 12;
            timeStr = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
          }
          
          // Determine schedule type
          let type = 'scheduled';
          if (s.workOrderId) type = 'work_order';
          
          // Check if overdue
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let status = s.status || 'scheduled';
          if (scheduledDate < today && (status === 'pending' || status === 'scheduled')) {
            status = 'overdue';
          }
          
          return {
            id: s.id || s.visitId,
            visitId: s.visitId,
            date: scheduledDate,
            time: timeStr,
            service: s.serviceName || s.serviceCategory || 'Service',
            property: s.propertyName || 'Property',
            propertyId: s.propertyId,
            vendor: s.vendorName || 'Unassigned',
            vendorId: s.vendorDbId,
            zone: s.zone || '',
            propertyType: normalizePropertyType(s.propertyType),
            type: type,
            status: status,
            visitNumber: s.visitNumber,
            totalVisits: s.totalVisits,
            workOrderId: s.workOrderId
          };
        });
        
        setSchedules(formattedSchedules);
        
        // Extract unique services and property types from fetched data for filter dropdowns
        const uniqueServices = [...new Set(formattedSchedules.map(s => s.service).filter(Boolean))];
        const uniquePropertyTypes = [...new Set(formattedSchedules.map(s => s.propertyType).filter(Boolean))];
        
        if (uniqueServices.length > 0 && services.length === 0) {
          setServices(uniqueServices);
        }
        if (uniquePropertyTypes.length > 0 && propertyTypes.length === 0) {
          setPropertyTypes(uniquePropertyTypes);
        }
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Fetch schedules error:', err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate, token, apiPath]);

  // Initial load
  useEffect(() => {
    fetchVendors();
    fetchServices();
    fetchPropertyTypes();
  }, []);
  
  // Fetch schedules when date changes
  useEffect(() => {
    fetchSchedules();
  }, [currentDate, fetchSchedules]);

  // Filter schedules based on current filters and view options
  const getFilteredSchedules = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    
    return schedules.filter(s => {
      // Apply dropdown filters
      if (filters.service !== 'All Services' && s.service !== filters.service) return false;
      if (filters.vendor !== 'All Vendors' && s.vendor !== filters.vendor) return false;
      if (filters.zone !== 'All Zones' && s.zone !== filters.zone) return false;
      if (filters.propertyType !== 'All Property Types' && s.propertyType !== filters.propertyType) return false;
      
      // Apply view options filters
      if (!viewOptions.showUnscheduled && s.type === 'unscheduled') return false;
      if (viewOptions.zoneFilter !== 'All Zones' && s.zone !== viewOptions.zoneFilter) return false;
      
      // Apply quick filter
      if (activeQuickFilter) {
        const scheduleDate = new Date(s.date);
        scheduleDate.setHours(0, 0, 0, 0);
        
        switch (activeQuickFilter) {
          case 'today':
            if (scheduleDate.getTime() !== today.getTime()) return false;
            break;
          case 'upcoming':
            if (scheduleDate < today || scheduleDate > sevenDaysLater) return false;
            break;
          case 'overdue':
            if (scheduleDate >= today || (s.status !== 'pending' && s.status !== 'scheduled')) return false;
            break;
          case 'rescheduled':
            if (s.status !== 'rescheduled') return false;
            break;
          case 'cancelled':
            if (s.status !== 'cancelled') return false;
            break;
        }
      }
      
      return true;
    });
  };
  
  // Group schedules by vendor or property if enabled
  const getGroupedSchedules = (schedulesForDate) => {
    if (viewOptions.groupByVendor) {
      const grouped = {};
      schedulesForDate.forEach(s => {
        if (!grouped[s.vendor]) grouped[s.vendor] = [];
        grouped[s.vendor].push(s);
      });
      return grouped;
    }
    if (viewOptions.groupByProperty) {
      const grouped = {};
      schedulesForDate.forEach(s => {
        if (!grouped[s.property]) grouped[s.property] = [];
        grouped[s.property].push(s);
      });
      return grouped;
    }
    return null;
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add days from previous month
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    
    // Add days from next month
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const getSchedulesForDate = (date) => {
    const filtered = getFilteredSchedules();
    return filtered.filter(s => 
      s.date.getDate() === date.getDate() && 
      s.date.getMonth() === date.getMonth() &&
      s.date.getFullYear() === date.getFullYear()
    );
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const navigateYear = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get week days for week view
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDaysArr = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDaysArr.push(day);
    }
    return weekDaysArr;
  };

  // Get hour slots for day/week view
  const hourSlots = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  // Get all schedules sorted for agenda view
  const getAgendaSchedules = () => {
    const filtered = getFilteredSchedules();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filtered
      .filter(s => s.date >= today)
      .sort((a, b) => a.date - b.date)
      .slice(0, 20);
  };

  // Get schedules for a specific month in the year view
  const getSchedulesForMonth = (year, month) => {
    const filtered = getFilteredSchedules();
    return filtered.filter(s => 
      s.date.getFullYear() === year && 
      s.date.getMonth() === month
    );
  };

  // Get days in a specific month (for year view mini calendars)
  const getDaysInSpecificMonth = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add days from previous month
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    
    return days;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 border-l-amber-500';
      case 'scheduled': return 'bg-blue-100 border-l-blue-500';
      case 'completed': return 'bg-green-100 border-l-green-500';
      case 'rescheduled': return 'bg-orange-100 border-l-orange-500';
      case 'cancelled': return 'bg-red-100 border-l-red-500';
      case 'overdue': return 'bg-gray-800 border-l-gray-800';
      default: return 'bg-gray-100 border-l-gray-500';
    }
  };

  // Calculate dynamic quick filter counts
  const getQuickFilterCounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    
    const todaysSchedules = schedules.filter(s => {
      const scheduleDate = new Date(s.date);
      scheduleDate.setHours(0, 0, 0, 0);
      return scheduleDate.getTime() === today.getTime();
    }).length;
    
    const upcoming7Days = schedules.filter(s => {
      const scheduleDate = new Date(s.date);
      scheduleDate.setHours(0, 0, 0, 0);
      return scheduleDate >= today && scheduleDate <= sevenDaysLater;
    }).length;
    
    const overdue = schedules.filter(s => {
      const scheduleDate = new Date(s.date);
      scheduleDate.setHours(0, 0, 0, 0);
      return scheduleDate < today && (s.status === 'pending' || s.status === 'scheduled');
    }).length;
    
    const rescheduleRequests = schedules.filter(s => s.status === 'rescheduled').length;
    const cancelled = schedules.filter(s => s.status === 'cancelled').length;
    
    return { todaysSchedules, upcoming7Days, overdue, rescheduleRequests, cancelled };
  };
  
  const quickFilterCounts = getQuickFilterCounts();
  
  const quickFilters = [
    { key: 'today', label: "Today's Schedules", count: quickFilterCounts.todaysSchedules },
    { key: 'upcoming', label: "Upcoming (7 Days)", count: quickFilterCounts.upcoming7Days },
    { key: 'overdue', label: "Overdue", count: quickFilterCounts.overdue },
    { key: 'rescheduled', label: "Reschedule Requests", count: quickFilterCounts.rescheduleRequests },
    { key: 'cancelled', label: "Cancelled", count: quickFilterCounts.cancelled }
  ];

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
            <p className="text-sm text-gray-500">Home › Scheduling › Calendar</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Property, Vendor, Work Order..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">12</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar - Responsive */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left: Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <select 
              value={filters.service}
              onChange={(e) => setFilters({...filters, service: e.target.value})}
              className="min-w-[120px] max-w-[160px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All Services">All Services</option>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            
            <select 
              value={filters.vendor}
              onChange={(e) => setFilters({...filters, vendor: e.target.value})}
              className="min-w-[110px] max-w-[160px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All Vendors">All Vendors</option>
              {vendors.map(v => <option key={v.vendorId || v.id} value={v.ownerName || v.companyName}>{v.ownerName || v.companyName}</option>)}
            </select>
            
            <select 
              value={filters.zone}
              onChange={(e) => setFilters({...filters, zone: e.target.value})}
              className="min-w-[100px] max-w-[140px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All Zones">All Zones</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            
            <select 
              value={filters.propertyType}
              onChange={(e) => setFilters({...filters, propertyType: e.target.value})}
              className="min-w-[130px] max-w-[170px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All Property Types">All Property Types</option>
              {propertyTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
            </select>
            
            <button 
              onClick={() => setFilters({ service: 'All Services', vendor: 'All Vendors', zone: 'All Zones', propertyType: 'All Property Types' })}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              Clear
            </button>
          </div>
          
          {/* Right: View Mode Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-start lg:self-auto flex-shrink-0">
            {['Day', 'Week', 'Month', 'Year'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                  viewMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex p-6 gap-6">
        {/* Main Calendar */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {viewMode === 'Month' && monthName}
                {viewMode === 'Week' && `Week of ${getWeekDays()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${getWeekDays()[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {viewMode === 'Day' && currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {viewMode === 'Year' && currentDate.getFullYear().toString()}
              </h2>
              {loading && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
              <button 
                onClick={() => viewMode === 'Month' ? navigateMonth(-1) : viewMode === 'Week' ? navigateWeek(-1) : viewMode === 'Year' ? navigateYear(-1) : navigateDay(-1)} 
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => viewMode === 'Month' ? navigateMonth(1) : viewMode === 'Week' ? navigateWeek(1) : viewMode === 'Year' ? navigateYear(1) : navigateDay(1)} 
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchSchedules} 
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh schedules"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={goToToday} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Today
              </button>
            </div>
          </div>

          {/* MONTH VIEW */}
          {viewMode === 'Month' && (
            <>
              <div className="grid grid-cols-7 border-b border-gray-200">
                {weekDays.map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const daySchedules = getSchedulesForDate(day.date);
                  const isToday = day.date.toDateString() === new Date().toDateString();
                  return (
                    <div 
                      key={i}
                      className={`min-h-[120px] border-b border-r border-gray-100 p-1 ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between p-1">
                        <span className={`text-sm font-medium ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'} ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                          {day.date.getDate()}
                        </span>
                        {daySchedules.length > 0 && <span className="text-xs text-gray-400">{daySchedules.length}</span>}
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {daySchedules.slice(0, 3).map((schedule, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedSchedule(schedule)}
                            className={`px-1.5 py-0.5 text-[10px] rounded border-l-2 truncate cursor-pointer hover:opacity-80 hover:shadow-sm ${getStatusColor(schedule.status)}`}
                          >
                            <span className="font-medium">{schedule.time}</span> - {schedule.service}
                          </div>
                        ))}
                        {daySchedules.length > 3 && <div className="text-[10px] text-blue-600 px-1.5 cursor-pointer hover:underline">+{daySchedules.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'Week' && (
            <>
              <div className="grid grid-cols-8 border-b border-gray-200">
                <div className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50 border-r">Time</div>
                {getWeekDays().map((day, i) => {
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} className={`p-2 text-center text-sm font-medium bg-gray-50 ${isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>
                      <div>{weekDays[i]}</div>
                      <div className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="overflow-y-auto max-h-[500px]">
                {hourSlots.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
                    <div className="p-2 text-xs text-gray-500 border-r bg-gray-50 text-right pr-3 whitespace-nowrap">
                      {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    {getWeekDays().map((day, i) => {
                      const daySchedules = getSchedulesForDate(day).filter(s => {
                        const scheduleHour = parseInt(s.time.split(':')[0]);
                        return scheduleHour === hour || scheduleHour === hour - 12;
                      });
                      return (
                        <div key={i} className="p-1 min-h-[60px] border-r border-gray-100 hover:bg-gray-50">
                          {daySchedules.map((schedule, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setSelectedSchedule(schedule)}
                              className={`px-2 py-1 text-xs rounded border-l-2 mb-1 cursor-pointer hover:shadow-sm ${getStatusColor(schedule.status)}`}
                            >
                              <div className="font-medium truncate">{schedule.service}</div>
                              <div className="text-gray-500 truncate">{schedule.property}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* DAY VIEW */}
          {viewMode === 'Day' && (
            <div className="overflow-y-auto max-h-[600px]">
              {hourSlots.map(hour => {
                const daySchedules = getSchedulesForDate(currentDate).filter(s => {
                  const scheduleHour = parseInt(s.time.split(':')[0]);
                  return scheduleHour === hour || scheduleHour === hour - 12;
                });
                return (
                  <div key={hour} className="flex border-b border-gray-100">
                    <div className="w-24 p-3 text-sm text-gray-500 border-r bg-gray-50 text-right whitespace-nowrap">
                      {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    <div className="flex-1 p-2 min-h-[80px] hover:bg-gray-50">
                      {daySchedules.map((schedule, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedSchedule(schedule)}
                          className={`px-3 py-2 rounded-lg border-l-4 mb-2 cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(schedule.status)}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{schedule.service}</span>
                            <span className="text-sm text-gray-500">{schedule.time}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{schedule.property}</div>
                          <div className="text-sm text-gray-500">{schedule.vendor} • {schedule.zone}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* YEAR VIEW */}
          {viewMode === 'Year' && (
            <div className="p-4 overflow-y-auto max-h-[600px]">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, month) => {
                  const year = currentDate.getFullYear();
                  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' });
                  const monthDays = getDaysInSpecificMonth(year, month);
                  const monthSchedules = getSchedulesForMonth(year, month);
                  const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === year;
                  
                  return (
                    <div 
                      key={month} 
                      className={`bg-white rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow ${
                        isCurrentMonth ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
                      }`}
                      onClick={() => {
                        const newDate = new Date(year, month, 1);
                        setCurrentDate(newDate);
                        setViewMode('Month');
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-blue-600' : 'text-gray-900'}`}>
                          {monthName}
                        </span>
                        {monthSchedules.length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {monthSchedules.length}
                          </span>
                        )}
                      </div>
                      
                      {/* Mini calendar grid */}
                      <div className="grid grid-cols-7 gap-0.5 text-center">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                          <div key={i} className="text-[8px] text-gray-400 py-0.5">{d}</div>
                        ))}
                        {monthDays.slice(0, 35).map((day, i) => {
                          const isToday = day.date.toDateString() === new Date().toDateString();
                          const hasSchedule = monthSchedules.some(s => 
                            s.date.getDate() === day.date.getDate() && 
                            s.date.getMonth() === day.date.getMonth()
                          );
                          return (
                            <div
                              key={i}
                              className={`text-[9px] py-0.5 rounded ${
                                isToday ? 'bg-blue-600 text-white font-bold' :
                                hasSchedule && day.isCurrentMonth ? 'bg-blue-100 text-blue-700 font-medium' :
                                day.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                              }`}
                            >
                              {day.date.getDate()}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Schedule summary */}
                      {monthSchedules.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex flex-wrap gap-1">
                            {monthSchedules.filter(s => s.status === 'completed').length > 0 && (
                              <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">
                                {monthSchedules.filter(s => s.status === 'completed').length} done
                              </span>
                            )}
                            {monthSchedules.filter(s => s.status === 'scheduled' || s.status === 'pending').length > 0 && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">
                                {monthSchedules.filter(s => s.status === 'scheduled' || s.status === 'pending').length} pending
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Mini Calendar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Calendar</h3>
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium">{monthName}</span>
              <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-[10px] text-gray-500 py-1">{d}</div>
              ))}
              {days.slice(0, 35).map((day, i) => {
                const isToday = day.date.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={i}
                    className={`text-xs py-1 rounded ${
                      isToday ? 'bg-blue-600 text-white' :
                      day.isCurrentMonth ? 'hover:bg-gray-100' : 'text-gray-300'
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
              {[
                { color: 'bg-amber-500', label: 'New / Pending' },
                { color: 'bg-blue-500', label: 'Scheduled' },
                { color: 'bg-green-500', label: 'Completed' },
                { color: 'bg-orange-500', label: 'Rescheduled' },
                { color: 'bg-red-500', label: 'Cancelled' },
                { color: 'bg-gray-800', label: 'Overdue' }
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Quick Filters</h3>
              {activeQuickFilter && (
                <button 
                  onClick={() => setActiveQuickFilter(null)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              {quickFilters.map(filter => (
                <div 
                  key={filter.key} 
                  onClick={() => setActiveQuickFilter(activeQuickFilter === filter.key ? null : filter.key)}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                    activeQuickFilter === filter.key 
                      ? 'bg-blue-100 border border-blue-300' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-sm ${activeQuickFilter === filter.key ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                    {filter.label}
                  </span>
                  <span className={`text-sm font-semibold ${
                    activeQuickFilter === filter.key ? 'text-blue-700' : 
                    filter.key === 'overdue' && filter.count > 0 ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {filter.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* View Options */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">View Options</h3>
            <div className="space-y-3">
              {/* Show Unscheduled Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={viewOptions.showUnscheduled}
                  onChange={(e) => setViewOptions({ ...viewOptions, showUnscheduled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Show Unscheduled</span>
              </label>
              
              {/* Zone Filter Dropdown */}
              <div className="space-y-1">
                <label className="text-sm text-gray-600">Zone</label>
                <select
                  value={viewOptions.zoneFilter}
                  onChange={(e) => setViewOptions({ ...viewOptions, zoneFilter: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="All Zones">All Zones</option>
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              
              {/* Group by Vendor Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={viewOptions.groupByVendor}
                  onChange={(e) => setViewOptions({ ...viewOptions, groupByVendor: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Group by Vendor</span>
              </label>
              
              {/* Group by Property Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={viewOptions.groupByProperty}
                  onChange={(e) => setViewOptions({ ...viewOptions, groupByProperty: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Group by Property</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Detail Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b ${
              selectedSchedule.status === 'completed' ? 'bg-green-50' :
              selectedSchedule.status === 'pending' ? 'bg-amber-50' :
              selectedSchedule.status === 'cancelled' ? 'bg-red-50' :
              selectedSchedule.status === 'rescheduled' ? 'bg-orange-50' :
              'bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedSchedule.service}</h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {selectedSchedule.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSchedule(null)}
                  className="p-2 hover:bg-white/50 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 text-sm font-semibold rounded-full capitalize ${
                  selectedSchedule.status === 'completed' ? 'bg-green-100 text-green-700' :
                  selectedSchedule.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  selectedSchedule.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  selectedSchedule.status === 'rescheduled' ? 'bg-orange-100 text-orange-700' :
                  selectedSchedule.status === 'overdue' ? 'bg-gray-800 text-white' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {selectedSchedule.status?.replace('_', ' ')}
                </span>
                {/* Only show type badge for work orders or unscheduled */}
                {(selectedSchedule.type === 'work_order' || selectedSchedule.type === 'unscheduled') && (
                  <span className={`px-3 py-1.5 text-sm font-medium rounded-full capitalize ${
                    selectedSchedule.type === 'work_order' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedSchedule.type?.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Schedule Details */}
              <div className="space-y-2 pt-2">
                <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Scheduled Time</p>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.time}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                  <Building2 className="w-4 h-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property</p>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.property}</p>
                    <p className="text-xs text-gray-500">{selectedSchedule.propertyType}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                  <MapPin className="w-4 h-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Zone</p>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.zone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                  <Truck className="w-4 h-4 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Assigned Vendor</p>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.vendor}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                  <Wrench className="w-4 h-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Service Type</p>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.service}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
              <button 
                onClick={() => setSelectedSchedule(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setSelectedSchedule(null);
                  const woId = selectedSchedule.workOrderId || selectedSchedule.work_order_id;
                  if (woId) {
                    navigate(`${getBasePath()}/work-orders/${woId}`);
                  } else {
                    navigate(`${getBasePath()}/work-orders`);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                View Work Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;
