import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Filter,
  Eye,
  Clock,
  MapPin,
  Building2,
  User,
  Wrench,
  X,
  Search,
  Download,
  Bell
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import DateRangeFilter from '../../components/common/DateRangeFilter';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'employee': 'admin'
  };
  return portalMap[portalType] || 'fp';
};

// Format date helper
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Get days in month
const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

// Get first day of month (0 = Sunday, 1 = Monday, etc.)
const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month, 1).getDay();
};

// Status colors
const statusColors = {
  'scheduled': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'in_progress': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  'completed': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  'cancelled': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'rescheduled': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  'pending': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
};

const SchedulingCalendar = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  
  // Current date state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  
  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Calendar navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const response = await fetch(
        `${API_BASE}/api/${apiPath}/schedules?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (!response.ok) {
        // Use mock data if API not available
        setSchedules(getMockSchedules());
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        setSchedules(result.data || []);
      } else {
        setSchedules(getMockSchedules());
      }
    } catch (err) {
      console.error('Fetch schedules error:', err);
      setSchedules(getMockSchedules());
    } finally {
      setLoading(false);
    }
  }, [token, apiPath, currentDate]);

  // Mock schedules for development
  const getMockSchedules = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return [
      {
        id: 1,
        scheduleId: 'SCH-001',
        title: 'HVAC Maintenance',
        propertyName: 'Green Valley Apartments',
        propertyType: 'Apartment',
        zone: 'Zone A',
        vendorName: 'ABC HVAC Services',
        serviceType: 'HVAC',
        startDate: new Date(year, month, 5, 10, 0).toISOString(),
        endDate: new Date(year, month, 5, 12, 0).toISOString(),
        status: 'scheduled',
        frequency: 'Monthly'
      },
      {
        id: 2,
        scheduleId: 'SCH-002',
        title: 'Plumbing Inspection',
        propertyName: 'Sunrise Villas',
        propertyType: 'Villa',
        zone: 'Zone B',
        vendorName: 'XYZ Plumbing',
        serviceType: 'Plumbing',
        startDate: new Date(year, month, 8, 9, 0).toISOString(),
        endDate: new Date(year, month, 8, 11, 0).toISOString(),
        status: 'completed',
        frequency: 'Every 2 Months'
      },
      {
        id: 3,
        scheduleId: 'SCH-003',
        title: 'Pest Control',
        propertyName: 'Palm Meadows',
        propertyType: 'Villa',
        zone: 'Zone A',
        vendorName: 'PestFree Services',
        serviceType: 'Pest Control',
        startDate: new Date(year, month, 12, 14, 0).toISOString(),
        endDate: new Date(year, month, 12, 16, 0).toISOString(),
        status: 'scheduled',
        frequency: 'Half-Yearly'
      },
      {
        id: 4,
        scheduleId: 'SCH-004',
        title: 'Electrical Check',
        propertyName: 'Lake View Residency',
        propertyType: 'Apartment',
        zone: 'Zone C',
        vendorName: 'Power Services',
        serviceType: 'Electrical',
        startDate: new Date(year, month, 15, 10, 0).toISOString(),
        endDate: new Date(year, month, 15, 12, 0).toISOString(),
        status: 'in_progress',
        frequency: 'Quarterly'
      },
      {
        id: 5,
        scheduleId: 'SCH-005',
        title: 'Water Tank Cleaning',
        propertyName: 'Urban Nest',
        propertyType: 'Villa',
        zone: 'Zone D',
        vendorName: 'Aqua Service',
        serviceType: 'Water Tank',
        startDate: new Date(year, month, 18, 8, 0).toISOString(),
        endDate: new Date(year, month, 18, 10, 0).toISOString(),
        status: 'scheduled',
        frequency: 'Yearly'
      },
      {
        id: 6,
        scheduleId: 'SCH-006',
        title: 'HVAC Service',
        propertyName: 'Golden Heights',
        propertyType: 'Apartment',
        zone: 'Zone B',
        vendorName: 'CoolAir HVAC',
        serviceType: 'HVAC',
        startDate: new Date(year, month, 22, 11, 0).toISOString(),
        endDate: new Date(year, month, 22, 13, 0).toISOString(),
        status: 'scheduled',
        frequency: 'Monthly'
      },
      {
        id: 7,
        scheduleId: 'SCH-007',
        title: 'Lift Maintenance',
        propertyName: 'Elite Enclave',
        propertyType: 'Apartment',
        zone: 'Zone A',
        vendorName: 'Elevate Services',
        serviceType: 'Lift',
        startDate: new Date(year, month, 25, 9, 0).toISOString(),
        endDate: new Date(year, month, 25, 11, 0).toISOString(),
        status: 'cancelled',
        frequency: 'Quarterly'
      }
    ];
  };

  // Initial load
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Get schedules for a specific date
  const getSchedulesForDate = (date) => {
    return schedules.filter(s => {
      const scheduleDate = new Date(s.startDate);
      return scheduleDate.getDate() === date &&
             scheduleDate.getMonth() === currentDate.getMonth() &&
             scheduleDate.getFullYear() === currentDate.getFullYear();
    });
  };

  // Filter schedules
  const getFilteredSchedules = () => {
    let filtered = schedules;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.title?.toLowerCase().includes(search) ||
        s.propertyName?.toLowerCase().includes(search) ||
        s.scheduleId?.toLowerCase().includes(search)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(s => s.serviceType === serviceFilter);
    }
    
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(s => s.zone === zoneFilter);
    }
    
    return filtered;
  };

  // Handle date click
  const handleDateClick = (day) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
    const daySchedules = getSchedulesForDate(day);
    if (daySchedules.length > 0) {
      setShowEventModal(true);
    }
  };

  // Handle schedule click
  const handleScheduleClick = (schedule) => {
    setSelectedSchedule(schedule);
    setShowEventModal(true);
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    
    const days = [];
    
    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-28 border border-gray-100 bg-gray-50/50"></div>
      );
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const daySchedules = getSchedulesForDate(day);
      const isToday = 
        day === today.getDate() && 
        month === today.getMonth() && 
        year === today.getFullYear();
      
      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(day)}
          className={`h-28 border border-gray-100 p-2 cursor-pointer transition-colors hover:bg-blue-50/50 ${
            isToday ? 'bg-blue-50 border-blue-200' : 'bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${
              isToday ? 'text-blue-600' : 'text-gray-700'
            }`}>
              {day}
            </span>
            {daySchedules.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {daySchedules.length}
              </span>
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {daySchedules.slice(0, 2).map((schedule, idx) => {
              const colors = statusColors[schedule.status] || statusColors.scheduled;
              return (
                <div
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); handleScheduleClick(schedule); }}
                  className={`text-xs px-2 py-1 rounded truncate ${colors.bg} ${colors.text} cursor-pointer hover:opacity-80`}
                >
                  {schedule.title}
                </div>
              );
            })}
            {daySchedules.length > 2 && (
              <div className="text-xs text-gray-500 text-center">
                +{daySchedules.length - 2} more
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduling Calendar</h1>
          <nav className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <Link to={portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '/'} className="hover:text-blue-600">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Scheduling</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900">Calendar</span>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter</span>
          </button>
          
          {/* New Schedule Button */}
          <button
            onClick={() => {
              const basePath = portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '';
              navigate(`${basePath}/schedules/create`);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Schedule</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search schedules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
            
            {/* Service Filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="all">All Services</option>
              <option value="HVAC">HVAC</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="Pest Control">Pest Control</option>
              <option value="Water Tank">Water Tank</option>
              <option value="Lift">Lift</option>
            </select>
            
            {/* Zone Filter */}
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="all">All Zones</option>
              <option value="Zone A">Zone A</option>
              <option value="Zone B">Zone B</option>
              <option value="Zone C">Zone C</option>
              <option value="Zone D">Zone D</option>
            </select>
            
            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setServiceFilter('all');
                setZoneFilter('all');
              }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Today
            </button>
            
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Day
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-0">
            {generateCalendarDays()}
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-500">Status:</span>
            {Object.entries(statusColors).map(([status, colors]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${colors.bg}`}></div>
                <span className="capitalize text-gray-600">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Detail Modal */}
      {showEventModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEventModal(false)}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Details</h2>
              <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Schedule ID & Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600 font-medium">{selectedSchedule.scheduleId}</span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${
                  statusColors[selectedSchedule.status]?.bg || 'bg-gray-100'
                } ${statusColors[selectedSchedule.status]?.text || 'text-gray-700'}`}>
                  {selectedSchedule.status?.replace('_', ' ')}
                </span>
              </div>
              
              {/* Title */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedSchedule.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedSchedule.frequency}</p>
              </div>
              
              {/* Details */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.propertyName}</p>
                    <p className="text-xs text-gray-500">{selectedSchedule.propertyType}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">{selectedSchedule.zone}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">{selectedSchedule.serviceType}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">{selectedSchedule.vendorName}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {new Date(selectedSchedule.startDate).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const basePath = portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '';
                  navigate(`${basePath}/schedules/${selectedSchedule.id}`);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Detail Modal */}
      {showEventModal && selectedDate && !selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowEventModal(false); setSelectedDate(null); }}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Schedules for {formatDate(selectedDate)}
              </h2>
              <button onClick={() => { setShowEventModal(false); setSelectedDate(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              {getSchedulesForDate(selectedDate.getDate()).length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No schedules for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getSchedulesForDate(selectedDate.getDate()).map(schedule => {
                    const colors = statusColors[schedule.status] || statusColors.scheduled;
                    return (
                      <div
                        key={schedule.id}
                        onClick={() => { setSelectedSchedule(schedule); }}
                        className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${colors.border} ${colors.bg}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${colors.text}`}>{schedule.title}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${colors.bg} ${colors.text}`}>
                            {schedule.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{schedule.propertyName}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(schedule.startDate).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {schedule.vendorName}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulingCalendar;
