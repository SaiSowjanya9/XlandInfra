import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, ChevronLeft, ChevronRight,
  Eye, RefreshCw, CheckCircle, AlertCircle, Info, X
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
    search: '', service: 'all', status: 'all', vendor: 'all', zone: 'all', package: 'all'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
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
    // Initialize with mock data so filters have options
    setSchedules(generateMockSchedules());
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchPropertySchedules(selectedProperty.id);
    }
  }, [selectedProperty]);

  const generateMockSchedules = () => [
    { id: 1, property_id: 'PROP-001', service: 'HVAC', vendor: 'ABC HVAC', zone: 'Zone A', package: 'Basic AMC', currentDate: '2026-08-10', time: '10:00 AM - 11:00 AM', status: 'completed' },
    { id: 2, property_id: 'PROP-001', service: 'HVAC', vendor: 'ABC HVAC', zone: 'Zone A', package: 'Basic AMC', currentDate: '2026-09-10', time: '10:00 AM - 11:00 AM', status: 'scheduled' },
    { id: 3, property_id: 'PROP-002', service: 'HVAC', vendor: 'ABC HVAC', zone: 'Zone A', package: 'Standard AMC', currentDate: '2026-10-10', time: '10:00 AM - 11:00 AM', status: 'scheduled' },
    { id: 4, property_id: 'PROP-002', service: 'Plumbing', vendor: 'Aqua Plumbing', zone: 'Zone B', package: 'Standard AMC', currentDate: '2026-09-15', time: '02:00 PM - 03:00 PM', status: 'scheduled' },
    { id: 5, property_id: 'PROP-003', service: 'Plumbing', vendor: 'Aqua Plumbing', zone: 'Zone B', package: 'Premium AMC', currentDate: '2026-10-15', time: '02:00 PM - 03:00 PM', status: 'scheduled' },
    { id: 6, property_id: 'PROP-003', service: 'Lift', vendor: 'Elevate Engineers', zone: 'Zone C', package: 'Premium AMC', currentDate: '2026-10-05', time: '11:30 AM - 12:30 PM', status: 'scheduled' },
    { id: 7, property_id: 'PROP-004', service: 'Lift', vendor: 'Elevate Engineers', zone: 'Zone C', package: 'Basic AMC', currentDate: '2026-11-05', time: '11:30 AM - 12:30 PM', status: 'scheduled' },
    { id: 8, property_id: 'PROP-005', service: 'Lift', vendor: 'Elevate Engineers', zone: 'Zone D', package: 'Standard AMC', currentDate: '2026-12-05', time: '11:30 AM - 12:30 PM', status: 'scheduled' }
  ];

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

  // Get unique services and vendors for filter dropdowns
  const uniqueServices = [...new Set(schedules.map(s => s.service))];
  const uniqueVendors = [...new Set(schedules.map(s => s.vendor))];
  const statusOptions = ['scheduled', 'completed', 'rescheduled', 'cancelled'];

  // Apply filters to schedules
  const filteredSchedules = schedules.filter(schedule => {
    // Search filter - by Property ID only
    if (filters.search) {
      const propertyId = schedule.property_id || schedule.propertyId || '';
      if (!propertyId.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
    }
    // Service filter
    if (filters.service !== 'all' && schedule.service !== filters.service) {
      return false;
    }
    // Status filter
    if (filters.status !== 'all' && schedule.status !== filters.status) {
      return false;
    }
    // Vendor filter
    if (filters.vendor !== 'all' && schedule.vendor !== filters.vendor) {
      return false;
    }
    // Zone filter
    if (filters.zone !== 'all' && schedule.zone !== filters.zone) {
      return false;
    }
    // Package filter
    if (filters.package !== 'all' && schedule.package !== filters.package) {
      return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchedules = filteredSchedules.slice(startIndex, startIndex + itemsPerPage);

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
                      setCurrentPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium"
                  >
                    <option value="">Select Property</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.propertyId || p.property_id || `PROP-${p.id}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Property Name</label>
                  <input
                    type="text"
                    value={selectedProperty?.propertyName || selectedProperty?.property_name || ''}
                    readOnly
                    placeholder="Select property first"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium bg-gray-50"
                  />
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
                        placeholder="Search by Property ID..."
                        value={filters.search}
                        onChange={(e) => {
                          setFilters(prev => ({ ...prev, search: e.target.value }));
                          setCurrentPage(1);
                        }}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <select 
                    value={filters.service}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, service: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="min-w-[110px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Services</option>
                    {uniqueServices.map(service => (
                      <option key={service} value={service}>{service}</option>
                    ))}
                  </select>
                  <select 
                    value={filters.status}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, status: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="min-w-[100px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Status</option>
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                    ))}
                  </select>
                  <select 
                    value={filters.vendor}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, vendor: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="min-w-[105px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Vendors</option>
                    {uniqueVendors.map(vendor => (
                      <option key={vendor} value={vendor}>{vendor}</option>
                    ))}
                  </select>
                  <select 
                    value={filters.package}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, package: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="min-w-[110px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Packages</option>
                    <option value="Basic AMC">Basic AMC</option>
                    <option value="Standard AMC">Standard AMC</option>
                    <option value="Premium AMC">Premium AMC</option>
                  </select>
                  <select 
                    value={filters.zone}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, zone: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="min-w-[90px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Zones</option>
                    <option value="Zone A">Zone A</option>
                    <option value="Zone B">Zone B</option>
                    <option value="Zone C">Zone C</option>
                    <option value="Zone D">Zone D</option>
                  </select>
                  <button 
                    onClick={() => {
                      setFilters({ search: '', service: 'all', status: 'all', vendor: 'all', zone: 'all', package: 'all' });
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50 flex-shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Property ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Current Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Calendar className="w-12 h-12 text-gray-300 mb-3" />
                          <p className="text-gray-500 font-medium">No visits found</p>
                          <p className="text-gray-400 text-sm mt-1">
                            {selectedProperty ? 'Try adjusting your filters' : 'Select a property to view schedules'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedSchedules.map((schedule) => (
                    <tr 
                      key={schedule.id} 
                      className={`hover:bg-gray-50 ${selectedSchedule?.id === schedule.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-blue-600">{schedule.property_id || schedule.propertyId || `PROP-${String(schedule.id).padStart(3, '0')}`}</span>
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
                <p className="text-sm text-gray-500">
                  Showing {filteredSchedules.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredSchedules.length)} of {filteredSchedules.length} visits
                </p>
                <div className="flex items-center gap-2">
                  <select 
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                      <button 
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 text-sm font-medium rounded ${
                          currentPage === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
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
