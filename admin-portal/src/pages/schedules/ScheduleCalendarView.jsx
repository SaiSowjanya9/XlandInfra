import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, ChevronLeft, ChevronRight,
  Plus, Eye, RefreshCw, CheckCircle, AlertCircle, X, Settings
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ScheduleCalendarView = ({ portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2025, 7, 7)); // August 2025
  const [viewMode, setViewMode] = useState('month'); // month, week, day, agenda
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    services: 'all', vendors: 'all', zones: 'all', propertyTypes: 'all'
  });
  const [viewOptions, setViewOptions] = useState({
    showUnscheduled: true,
    showWorkOrders: true,
    groupByVendor: false,
    groupByProperty: false
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  // Mock schedule data for calendar
  const getSchedulesForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const day = date.getDate();
    
    // Generate mock schedules based on date
    const mockSchedules = [];
    
    if (day % 2 === 0) {
      mockSchedules.push({
        id: `${dateStr}-1`,
        time: '09:00 AM',
        service: 'Water Tank Cleaning',
        property: 'Green Valley Apts',
        vendor: 'ABC Cleaning',
        status: 'scheduled'
      });
    }
    
    if (day % 3 === 0) {
      mockSchedules.push({
        id: `${dateStr}-2`,
        time: '10:00 AM',
        service: 'Electrical Repair',
        property: 'Palm Meadows',
        vendor: 'PowerFix Solutions',
        status: 'scheduled'
      });
    }
    
    if (day % 4 === 0) {
      mockSchedules.push({
        id: `${dateStr}-3`,
        time: '11:00 AM',
        service: 'Lift Maintenance',
        property: 'Elite Enclave',
        vendor: 'Elevate Engineers',
        status: 'in_progress'
      });
    }
    
    if (day % 5 === 0) {
      mockSchedules.push({
        id: `${dateStr}-4`,
        time: '02:00 PM',
        service: 'AC Service',
        property: 'Lake View Residency',
        vendor: 'Cool Breeze',
        status: 'completed'
      });
    }
    
    if (day % 7 === 0) {
      mockSchedules.push({
        id: `${dateStr}-5`,
        time: '02:30 PM',
        service: 'Drainage Cleaning',
        property: 'Skyline Towers',
        vendor: 'Drain Pro',
        status: 'rescheduled'
      });
    }
    
    return mockSchedules;
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

  // Quick filters data
  const quickFilters = [
    { label: "Today's Schedules", count: 18 },
    { label: 'Upcoming (7 Days)', count: 45 },
    { label: 'Overdue', count: 3 },
    { label: 'Reschedule Requests', count: 6 },
    { label: 'Cancelled', count: 4 }
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
              onClick={() => navigate('/schedules/new')}
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
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>01 Aug 2025 - 07 Aug 2025</span>
          </div>
          
          {['All Services', 'All Vendors', 'All Zones', 'All Property Types'].map((filter, i) => (
            <select key={i} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option>{filter}</option>
            </select>
          ))}

          <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>

          <div className="ml-auto flex items-center border border-gray-300 rounded-lg overflow-hidden">
            {['Month', 'Week', 'Day', 'Agenda'].map((mode) => (
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
            <div className="bg-white border-x border-b border-gray-200 rounded-b-xl overflow-hidden">
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
                  const schedules = getSchedulesForDate(day.date);
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
                        {schedules.length > 0 && (
                          <span className="text-xs text-gray-500">{schedules.length}</span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {schedules.slice(0, 3).map((schedule, i) => (
                          <div
                            key={i}
                            className={`px-1.5 py-1 text-xs rounded border-l-2 cursor-pointer hover:shadow-sm ${getStatusColor(schedule.status)}`}
                          >
                            <p className="font-medium truncate">{schedule.time}</p>
                            <p className="truncate">{schedule.service}</p>
                            <p className="truncate text-gray-600">{schedule.property}</p>
                          </div>
                        ))}
                        {schedules.length > 3 && (
                          <button className="text-xs text-blue-600 hover:underline w-full text-left px-1">
                            +{schedules.length - 3} more
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
                {calendarDays.slice(0, 35).map((day, i) => (
                  <button
                    key={i}
                    className={`py-1 rounded ${
                      day.date.getDate() === 7 && day.isCurrentMonth
                        ? 'bg-blue-600 text-white'
                        : day.isCurrentMonth ? 'hover:bg-gray-100' : 'text-gray-400'
                    }`}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
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
