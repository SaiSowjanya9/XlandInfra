import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, ChevronLeft, ChevronRight,
  Plus, Eye, RefreshCw, CheckCircle, AlertCircle, Info, X
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const RescheduleServicePage = ({ portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [filters, setFilters] = useState({
    search: '', service: 'all', status: 'all', vendor: 'all'
  });
  
  // Reschedule panel state
  const [showReschedulePanel, setShowReschedulePanel] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    newDate: '',
    newTime: '',
    reason: '',
    scope: 'this_visit_only'
  });
  const [weekStart, setWeekStart] = useState(new Date());
  const [vendorAvailability, setVendorAvailability] = useState({});
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchPropertySchedules(selectedProperty.id);
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/pending-properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProperties(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchPropertySchedules = async (propertyId) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/property/${propertyId}/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.data || generateMockSchedules());
      } else {
        setSchedules(generateMockSchedules());
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules(generateMockSchedules());
    } finally {
      setLoading(false);
    }
  };

  const generateMockSchedules = () => [
    { id: 1, visit: 'HVAC 1/12', service: 'HVAC', vendor: 'ABC HVAC', currentDate: '2026-08-10', time: '10:00 AM - 11:00 AM', status: 'completed' },
    { id: 2, visit: 'HVAC 2/12', service: 'HVAC', vendor: 'ABC HVAC', currentDate: '2026-09-10', time: '10:00 AM - 11:00 AM', status: 'scheduled' },
    { id: 3, visit: 'HVAC 3/12', service: 'HVAC', vendor: 'ABC HVAC', currentDate: '2026-10-10', time: '10:00 AM - 11:00 AM', status: 'scheduled' },
    { id: 4, visit: 'Plumbing 1/6', service: 'Plumbing', vendor: 'Aqua Plumbing', currentDate: '2026-09-15', time: '02:00 PM - 03:00 PM', status: 'scheduled' },
    { id: 5, visit: 'Plumbing 2/6', service: 'Plumbing', vendor: 'Aqua Plumbing', currentDate: '2026-10-15', time: '02:00 PM - 03:00 PM', status: 'scheduled' },
    { id: 6, visit: 'Lift 1/4', service: 'Lift', vendor: 'Elevate Engineers', currentDate: '2026-10-05', time: '11:30 AM - 12:30 PM', status: 'scheduled' },
    { id: 7, visit: 'Lift 2/4', service: 'Lift', vendor: 'Elevate Engineers', currentDate: '2026-11-05', time: '11:30 AM - 12:30 PM', status: 'scheduled' },
    { id: 8, visit: 'Lift 3/4', service: 'Lift', vendor: 'Elevate Engineers', currentDate: '2026-12-05', time: '11:30 AM - 12:30 PM', status: 'scheduled' }
  ];

  const handleReschedule = (schedule) => {
    setSelectedSchedule(schedule);
    setRescheduleData({
      newDate: '',
      newTime: '',
      reason: '',
      scope: 'this_visit_only'
    });
    setShowReschedulePanel(true);
    generateWeekAvailability();
  };

  const generateWeekAvailability = () => {
    // Generate mock vendor availability for the week
    const availability = {};
    const start = new Date(weekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Random availability status
      const statuses = ['available', 'recommended', 'limited', 'booked'];
      availability[dateStr] = {
        status: statuses[Math.floor(Math.random() * statuses.length)],
        slots: generateTimeSlots()
      };
    }
    
    // Set one as recommended
    const dates = Object.keys(availability);
    if (dates.length > 1) {
      availability[dates[1]].status = 'recommended';
    }
    
    setVendorAvailability(availability);
  };

  const generateTimeSlots = () => [
    { time: '09:00 AM - 10:00 AM', available: Math.random() > 0.3 },
    { time: '10:00 AM - 11:00 AM', available: Math.random() > 0.3 },
    { time: '11:00 AM - 12:00 PM', available: Math.random() > 0.3 },
    { time: '12:00 PM - 01:00 PM', available: Math.random() > 0.5 },
    { time: '01:00 PM - 02:00 PM', available: Math.random() > 0.3 },
    { time: '02:00 PM - 03:00 PM', available: Math.random() > 0.3 },
    { time: '03:00 PM - 04:00 PM', available: Math.random() > 0.3 },
    { time: '04:00 PM - 05:00 PM', available: Math.random() > 0.5 }
  ];

  const handleConfirmReschedule = async () => {
    if (!rescheduleData.newDate || !selectedTimeSlot) {
      alert('Please select a new date and time');
      return;
    }
    
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/visits/${selectedSchedule.id}/reschedule`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newDate: rescheduleData.newDate,
          newTimeStart: selectedTimeSlot,
          reason: rescheduleData.reason,
          scope: rescheduleData.scope
        })
      });
      
      if (response.ok) {
        alert('Schedule rescheduled successfully!');
        setShowReschedulePanel(false);
        setSelectedSchedule(null);
        if (selectedProperty) {
          fetchPropertySchedules(selectedProperty.id);
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Error processing reschedule');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
  };

  const getWeekDays = () => {
    const days = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      scheduled: 'bg-blue-100 text-blue-700',
      rescheduled: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-gray-100 text-gray-500'
    };
    return styles[status] || styles.scheduled;
  };

  const getAvailabilityDot = (status) => {
    const colors = {
      available: 'bg-green-500',
      recommended: 'bg-blue-500',
      limited: 'bg-amber-500',
      booked: 'bg-red-500'
    };
    return colors[status] || colors.available;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reschedule Service</h1>
            <p className="text-sm text-gray-500 mt-1">
              Home &gt; Scheduling &gt; Reschedule
            </p>
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

      <div className="p-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Property Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Property ID</label>
                  <select
                    value={selectedProperty?.id || ''}
                    onChange={(e) => {
                      const prop = properties.find(p => p.id === parseInt(e.target.value));
                      setSelectedProperty(prop || null);
                    }}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium"
                  >
                    <option value="">Select Property</option>
                    <option value="1">PROP-001</option>
                    <option value="2">PROP-002</option>
                    <option value="3">PROP-003</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Property Name</label>
                  <select className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium">
                    <option>Green Valley Apartments</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Package</label>
                  <select className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium">
                    <option>Apartment Basic AMC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Zone</label>
                  <select className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium">
                    <option>Zone A</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Existing Schedules Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Existing Schedule for Property</h3>
              </div>

              {/* Filters - Responsive */}
              <div className="px-3 sm:px-4 py-3 border-b border-gray-100">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-[180px] max-w-[300px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search visits..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <select className="min-w-[110px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>All Services</option>
                  </select>
                  <select className="min-w-[100px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>All Status</option>
                  </select>
                  <select className="min-w-[105px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>All Vendors</option>
                  </select>
                  <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 flex-shrink-0">
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Visit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Current Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schedules.map((schedule) => (
                    <tr 
                      key={schedule.id} 
                      className={`hover:bg-gray-50 ${selectedSchedule?.id === schedule.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {schedule.status === 'completed' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          <span className="text-sm font-medium text-gray-900">{schedule.visit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{schedule.service}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{schedule.vendor}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(schedule.currentDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{schedule.time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(schedule.status)}`}>
                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {schedule.status === 'completed' ? (
                          <button className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg">
                            View
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReschedule(schedule)}
                            className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            Reschedule
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">Showing 1 to 8 of 8 visits</p>
                <div className="flex items-center gap-2">
                  <select className="px-2 py-1 border border-gray-300 rounded text-sm">
                    <option>10 per page</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 border border-gray-300 rounded hover:bg-gray-50">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 bg-blue-600 text-white text-sm font-medium rounded">1</button>
                    <button className="p-1.5 border border-gray-300 rounded hover:bg-gray-50">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reschedule Panel */}
          {showReschedulePanel && selectedSchedule && (
            <div className="w-96 flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 sticky top-6">
                {/* Panel Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Reschedule Visit</h3>
                  <button 
                    onClick={() => setShowReschedulePanel(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Visit Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Service</span>
                      <span className="font-medium text-gray-900">{selectedSchedule.service}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Visit</span>
                      <span className="font-medium text-gray-900">{selectedSchedule.visit.split(' ')[1]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current Schedule</span>
                      <span className="font-medium text-gray-900">{formatDate(selectedSchedule.currentDate)}, {selectedSchedule.time.split(' - ')[0]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vendor</span>
                      <span className="font-medium text-gray-900">{selectedSchedule.vendor}</span>
                    </div>
                  </div>

                  {/* Availability Legend */}
                  <div className="flex items-center gap-4 text-xs">
                    {[
                      { label: 'Available', color: 'green' },
                      { label: 'Recommended', color: 'blue' },
                      { label: 'Limited', color: 'amber' },
                      { label: 'Booked', color: 'red' }
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full bg-${item.color}-500`} />
                        <span className="text-gray-600">{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Week Calendar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button 
                        onClick={() => {
                          const newDate = new Date(weekStart);
                          newDate.setDate(newDate.getDate() - 7);
                          setWeekStart(newDate);
                          generateWeekAvailability();
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-medium">
                        {formatDate(weekStart)} – {formatDate(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}
                      </span>
                      <button 
                        onClick={() => {
                          const newDate = new Date(weekStart);
                          newDate.setDate(newDate.getDate() + 7);
                          setWeekStart(newDate);
                          generateWeekAvailability();
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-xs text-gray-500 py-1">{day}</div>
                      ))}
                      {getWeekDays().map((day, i) => {
                        const dateStr = day.toISOString().split('T')[0];
                        const availability = vendorAvailability[dateStr];
                        const isSelected = rescheduleData.newDate === dateStr;
                        
                        return (
                          <button
                            key={i}
                            onClick={() => setRescheduleData({ ...rescheduleData, newDate: dateStr })}
                            className={`py-2 rounded-lg text-sm relative ${
                              isSelected 
                                ? 'bg-blue-600 text-white' 
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <span>{day.getDate()}</span>
                            {availability && (
                              <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${getAvailabilityDot(availability.status)}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Slots */}
                  {rescheduleData.newDate && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Available Time Slots for {formatDate(rescheduleData.newDate)}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(vendorAvailability[rescheduleData.newDate]?.slots || []).map((slot, i) => (
                          <button
                            key={i}
                            onClick={() => slot.available && setSelectedTimeSlot(slot.time)}
                            disabled={!slot.available}
                            className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                              selectedTimeSlot === slot.time
                                ? 'bg-blue-600 text-white border-blue-600'
                                : slot.available
                                  ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                  : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New Date/Time Summary */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">New Date</label>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        {rescheduleData.newDate ? formatDate(rescheduleData.newDate) : 'Select a date'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">New Time</label>
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        {selectedTimeSlot || 'Select a time slot'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Reason</label>
                      <input
                        type="text"
                        value={rescheduleData.reason}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                        placeholder="Customer requested different date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        maxLength={200}
                      />
                      <p className="text-xs text-gray-400 text-right mt-1">
                        {rescheduleData.reason.length} / 200
                      </p>
                    </div>
                  </div>

                  {/* Reschedule Scope */}
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300">
                      <input
                        type="radio"
                        name="scope"
                        value="this_visit_only"
                        checked={rescheduleData.scope === 'this_visit_only'}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, scope: e.target.value })}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Apply to this visit only</p>
                        <p className="text-xs text-gray-500">Only this occurrence will be updated</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 opacity-50">
                      <input
                        type="radio"
                        name="scope"
                        value="this_and_future"
                        checked={rescheduleData.scope === 'this_and_future'}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, scope: e.target.value })}
                        className="mt-0.5"
                        disabled
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">This and future visits</p>
                        <p className="text-xs text-gray-500">This option is disabled for AMC recurring schedules</p>
                      </div>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowReschedulePanel(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmReschedule}
                      disabled={!rescheduleData.newDate || !selectedTimeSlot || submitting}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Confirm Reschedule
                    </button>
                  </div>

                  
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RescheduleServicePage;
