import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, Search, Filter, Plus, Bell,
  CheckCircle, Clock, AlertCircle, XCircle, RefreshCw, CalendarDays
} from 'lucide-react';

const ScheduleCalendar = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
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
    showWorkOrders: true,
    groupByVendor: false,
    groupByProperty: false
  });

  useEffect(() => {
    generateMockSchedules();
  }, [currentDate]);

  // Available filter options
  const vendorOptions = [
    'ABC Cleaning', 'PowerFix Solutions', 'Pipe Masters', 'Elevate Engineers',
    'PestFree Services', 'Cool Breeze', 'GenCare Services', 'Drain Pro'
  ];
  const zoneOptions = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];
  const propertyTypeOptions = ['Apartment', 'Villa', 'Gated Community', 'Plot'];
  const serviceOptions = ['Water Tank Cleaning', 'Electrical Repair', 'Plumbing Repair', 'Lift Maintenance', 'Pest Control', 'AC Service', 'Generator Checkup', 'Drainage Cleaning'];

  const generateMockSchedules = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const mockData = [];
    
    const services = [
      { name: 'Water Tank Cleaning', property: 'Green Valley Apts', vendor: 'ABC Cleaning', zone: 'Zone A', propertyType: 'Apartment', color: 'blue' },
      { name: 'Electrical Repair', property: 'Palm Meadows', vendor: 'PowerFix Solutions', zone: 'Zone A', propertyType: 'Villa', color: 'amber' },
      { name: 'Plumbing Repair', property: 'Urban Nest', vendor: 'Pipe Masters', zone: 'Zone D', propertyType: 'Villa', color: 'green' },
      { name: 'Lift Maintenance', property: 'Elite Enclave', vendor: 'Elevate Engineers', zone: 'Zone A', propertyType: 'Apartment', color: 'purple' },
      { name: 'Pest Control', property: 'Sunrise Villas', vendor: 'PestFree Services', zone: 'Zone B', propertyType: 'Villa', color: 'red' },
      { name: 'AC Service', property: 'Lake View Residency', vendor: 'Cool Breeze', zone: 'Zone C', propertyType: 'Apartment', color: 'cyan' },
      { name: 'Generator Checkup', property: 'Golden Heights', vendor: 'GenCare Services', zone: 'Zone B', propertyType: 'Apartment', color: 'orange' },
      { name: 'Drainage Cleaning', property: 'Skyline Towers', vendor: 'Drain Pro', zone: 'Zone C', propertyType: 'Gated Community', color: 'teal' }
    ];

    // Generate random schedules for the month
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) continue;
      
      const numSchedules = Math.floor(Math.random() * 4);
      for (let i = 0; i < numSchedules; i++) {
        const service = services[Math.floor(Math.random() * services.length)];
        const hour = 9 + Math.floor(Math.random() * 8);
        const minute = Math.random() > 0.5 ? '00' : '30';
        
        mockData.push({
          id: `${day}-${i}`,
          date: new Date(year, month, day),
          time: `${hour.toString().padStart(2, '0')}:${minute} ${hour < 12 ? 'AM' : 'PM'}`,
          service: service.name,
          property: service.property,
          vendor: service.vendor,
          zone: service.zone,
          propertyType: service.propertyType,
          color: service.color,
          status: ['scheduled', 'in_progress', 'completed', 'pending'][Math.floor(Math.random() * 4)]
        });
      }
    }
    
    setSchedules(mockData);
  };

  // Filter schedules based on current filters
  const getFilteredSchedules = () => {
    return schedules.filter(s => {
      if (filters.service !== 'All Services' && s.service !== filters.service) return false;
      if (filters.vendor !== 'All Vendors' && s.vendor !== filters.vendor) return false;
      if (filters.zone !== 'All Zones' && s.zone !== filters.zone) return false;
      if (filters.propertyType !== 'All Property Types' && s.propertyType !== filters.propertyType) return false;
      return true;
    });
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

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 border-l-amber-500';
      case 'scheduled': return 'bg-blue-100 border-l-blue-500';
      case 'in_progress': return 'bg-purple-100 border-l-purple-500';
      case 'completed': return 'bg-green-100 border-l-green-500';
      case 'rescheduled': return 'bg-orange-100 border-l-orange-500';
      case 'cancelled': return 'bg-red-100 border-l-red-500';
      default: return 'bg-gray-100 border-l-gray-500';
    }
  };

  const quickFilters = [
    { label: "Today's Schedules", count: 18 },
    { label: "Upcoming (7 Days)", count: 45 },
    { label: "Overdue", count: 3 },
    { label: "Reschedule Requests", count: 6 },
    { label: "Cancelled", count: 4 }
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
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              New Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">01 Aug 2025 - 07 Aug 2025</span>
          </div>
          
          <select 
            value={filters.service}
            onChange={(e) => setFilters({...filters, service: e.target.value})}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="All Services">All Services</option>
            {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <select 
            value={filters.vendor}
            onChange={(e) => setFilters({...filters, vendor: e.target.value})}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="All Vendors">All Vendors</option>
            {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          
          <select 
            value={filters.zone}
            onChange={(e) => setFilters({...filters, zone: e.target.value})}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="All Zones">All Zones</option>
            {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          
          <select 
            value={filters.propertyType}
            onChange={(e) => setFilters({...filters, propertyType: e.target.value})}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="All Property Types">All Property Types</option>
            {propertyTypeOptions.map(pt => <option key={pt} value={pt}>{pt}</option>)}
          </select>
          
          <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          
          <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {['Month', 'Week', 'Day', 'Agenda'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
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
              <h2 className="text-lg font-semibold">{monthName}</h2>
              <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button onClick={goToToday} className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Today
            </button>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const daySchedules = getSchedulesForDate(day.date);
              const isToday = day.date.toDateString() === new Date().toDateString();
              
              return (
                <div 
                  key={i}
                  className={`min-h-[120px] border-b border-r border-gray-100 p-1 ${
                    day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center justify-between p-1 ${
                    isToday ? 'text-white' : ''
                  }`}>
                    <span className={`text-sm font-medium ${
                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                      {day.date.getDate()}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="text-xs text-gray-400">{daySchedules.length}</span>
                    )}
                  </div>
                  
                  <div className="space-y-0.5 mt-1">
                    {daySchedules.slice(0, 3).map((schedule, idx) => (
                      <div
                        key={idx}
                        className={`px-1.5 py-0.5 text-[10px] rounded border-l-2 truncate cursor-pointer hover:opacity-80 ${getStatusColor(schedule.status)}`}
                        title={`${schedule.time} - ${schedule.service}\n${schedule.property}\n${schedule.vendor}`}
                      >
                        <span className="font-medium">{schedule.time}</span>
                        <br />
                        <span className="text-gray-700">{schedule.service}</span>
                        <br />
                        <span className="text-gray-500">{schedule.property}</span>
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-[10px] text-blue-600 px-1.5 cursor-pointer hover:underline">
                        +{daySchedules.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                { color: 'bg-purple-500', label: 'In Progress' },
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
            <h3 className="font-semibold text-gray-900 mb-3">Quick Filters</h3>
            <div className="space-y-2">
              {quickFilters.map(filter => (
                <div key={filter.label} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                  <span className="text-sm text-gray-600">{filter.label}</span>
                  <span className="text-sm font-medium text-blue-600">{filter.count}</span>
                </div>
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
              ].map(option => (
                <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={viewOptions[option.key]}
                    onChange={(e) => setViewOptions({ ...viewOptions, [option.key]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleCalendar;
