import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Package, Calendar, CalendarDays, Clock,
  CheckCircle, AlertCircle, Sparkles, User, Wrench, RefreshCw, X, Save,
  Star, Info, Check, ChevronLeft, ChevronRight, Phone, Edit2, HelpCircle
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PropertySchedulingScreen = ({ user, portalType = 'admin' }) => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const propertyData = location.state?.property;

  const [property, setProperty] = useState(propertyData || null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(getNextMonday());
  const [recommendedDates, setRecommendedDates] = useState([]);
  const [plannedVisits, setPlannedVisits] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  function getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? 1 : 8);
    return new Date(today.setDate(diff));
  }

  useEffect(() => {
    fetchPropertyDetails();
  }, [propertyId]);

  useEffect(() => {
    if (selectedService) {
      generateRecommendedDates(selectedService);
      generatePlannedVisits(selectedService);
    }
  }, [selectedService, currentWeekStart]);

  const fetchPropertyDetails = async () => {
    setLoading(true);
    try {
      if (propertyData) {
        setProperty(propertyData);
        const mockServices = generateMockServices(propertyData);
        setServices(mockServices);
        if (mockServices.length > 0) {
          setSelectedService(mockServices[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockServices = (prop) => {
    return [
      { id: 1, name: 'HVAC', vendorName: 'ABC HVAC', vendorId: 1, frequency: 'Monthly', visits: 12, status: 'Schedule' },
      { id: 2, name: 'Plumbing', vendorName: 'XYZ Plumbing', vendorId: 2, frequency: 'Every 2 Months', visits: 6, status: 'Schedule' },
      { id: 3, name: 'Lift AMC', vendorName: 'Elevate Services', vendorId: 3, frequency: 'Quarterly', visits: 4, status: 'Schedule' },
      { id: 4, name: 'Pest Control', vendorName: 'PestFree Experts', vendorId: 4, frequency: 'Half Yearly', visits: 2, status: 'Schedule' },
      { id: 5, name: 'Water Tank Cleaning', vendorName: 'Aqua Clean Services', vendorId: 5, frequency: 'Yearly', visits: 1, status: 'Schedule' }
    ];
  };

  const generateRecommendedDates = (service) => {
    const dates = [];
    const baseDate = new Date(currentWeekStart);
    
    // Generate 4 recommended dates
    const recommendedDays = [
      { day: 5, time: '10:00 AM', type: 'recommended', reason: 'Vendor already has Zone A jobs' },
      { day: 3, time: '02:00 PM', type: 'available', reason: '' },
      { day: 6, time: '09:30 AM', type: 'available', reason: '' },
      { day: 0, time: '11:00 AM', type: 'limited', reason: '' }
    ];
    
    recommendedDays.forEach((rec, i) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + rec.day);
      dates.push({
        id: i + 1,
        date: date,
        dateStr: formatDateFull(date),
        time: rec.time,
        type: rec.type,
        reason: rec.reason,
        vendor: service.vendorName,
        zone: property?.zone || 'Zone A'
      });
    });
    
    setRecommendedDates(dates);
  };

  const generatePlannedVisits = (service) => {
    const visits = [];
    const firstDate = selectedSlot?.date || new Date(currentWeekStart);
    firstDate.setDate(firstDate.getDate() + 5); // Default to Saturday
    
    let intervalMonths = 1;
    switch (service.frequency.toLowerCase()) {
      case 'monthly': intervalMonths = 1; break;
      case 'every 2 months': intervalMonths = 2; break;
      case 'quarterly': intervalMonths = 3; break;
      case 'half yearly': intervalMonths = 6; break;
      case 'yearly': intervalMonths = 12; break;
    }
    
    for (let i = 0; i < service.visits; i++) {
      const visitDate = new Date(firstDate);
      visitDate.setMonth(visitDate.getMonth() + (i * intervalMonths));
      
      visits.push({
        visitNumber: i + 1,
        date: visitDate,
        dateStr: formatDateShort(visitDate),
        time: '10:00 AM',
        status: i === 0 ? 'Scheduled' : 'Target'
      });
    }
    
    setPlannedVisits(visits);
  };

  const formatDateFull = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateShort = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getTimeSlots = () => {
    return ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
  };

  const getSlotStatus = (day, timeIndex) => {
    const dayOfWeek = day.getDay();
    const dayNum = day.getDate();
    
    // Simulate different slot statuses
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (timeIndex < 4) return 'available';
      return 'limited';
    }
    if (dayNum === 12 && timeIndex === 2) return 'recommended';
    if (dayNum === 10 && timeIndex === 6) return 'recommended';
    if (timeIndex === 5 || timeIndex === 7) return 'booked';
    if (timeIndex > 6) return 'limited';
    return 'available';
  };

  const handleSelectSlot = (day, time, status) => {
    if (status === 'booked') return;
    setSelectedSlot({ date: day, time, status });
  };

  const handleUseRecommended = () => {
    if (recommendedDates.length > 0) {
      const rec = recommendedDates[0];
      setSelectedSlot({ date: rec.date, time: rec.time, status: 'recommended' });
    }
  };

  const handleConfirmSchedule = () => {
    // Update service status and navigate back
    alert('Schedule confirmed! Redirecting...');
    navigate(-1);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate);
  };

  const goBack = () => navigate(-1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  const weekDays = getWeekDays();
  const timeSlots = getTimeSlots();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Schedule Property</h1>
            <nav className="text-sm text-gray-500">
              Home › Scheduling › Pending Property Schedules › <span className="text-gray-900">Schedule Property</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" />
              Back to Pending Schedules
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Save className="w-4 h-4" />
              Save Draft
            </button>
            <button 
              onClick={handleConfirmSchedule}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Schedule
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50">
              <Sparkles className="w-4 h-4" />
              Auto Recommend All Services
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
        <div className="flex items-center gap-2 text-blue-700 text-sm">
          <Info className="w-4 h-4" />
          Select a vendor-recommended date for each service. Future visits will follow the service frequency and can be adjusted later.
          <a href="#" className="text-blue-600 hover:underline ml-auto">Learn more</a>
          <HelpCircle className="w-4 h-4" />
        </div>
      </div>

      {/* Property Info Card */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Property ID</p>
            <p className="font-semibold text-blue-600">{property?.propertyId || 'PROP-101'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Property Name</p>
            <p className="font-semibold">{property?.propertyName || 'Green Valley Apartments'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="font-semibold">{property?.customerName || 'Mr. Ramesh Kumar'}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" /> 98765 43210</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Property Type</p>
            <p className="font-semibold flex items-center gap-1"><Building2 className="w-4 h-4 text-gray-400" /> Apartment</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Zone</p>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">{property?.zone || 'Zone A'}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Package</p>
            <p className="font-semibold text-purple-700">{property?.packageName || 'Apartment Basic AMC'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Contract Period</p>
            <p className="font-semibold">01 Sep 2026 - 31 Aug 2027</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Ready to Schedule</span>
          </div>
        </div>
      </div>

      <div className="p-6 flex gap-6">
        {/* Left: Services List */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Services to Schedule</h3>
              <span className="text-sm text-gray-500">{services.length}</span>
            </div>
            <div className="space-y-2">
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedService?.id === service.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'Scheduled' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className="font-medium text-sm">{service.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{service.vendorName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{service.frequency}</span>
                    <span className="text-xs text-gray-400">{service.visits}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      service.status === 'Scheduled' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>{service.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Calendar */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Vendor Availability Calendar</h3>
                  <p className="text-sm text-gray-500">{selectedService?.vendorName} | {property?.zone || 'Zone A'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigateWeek(-1)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium px-3">
                    {formatDateShort(weekDays[0])} - {formatDateShort(weekDays[6])}
                  </span>
                  <button onClick={() => navigateWeek(1)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button className="ml-4 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">
                    Today
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="w-20 px-2 py-3 text-xs font-medium text-gray-500">Time</th>
                    {weekDays.map((day, i) => (
                      <th key={i} className="px-2 py-3 text-center">
                        <p className="text-xs font-medium text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className="text-sm font-semibold">{day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((time, timeIndex) => (
                    <tr key={time} className="border-t border-gray-100">
                      <td className="px-2 py-2 text-xs text-gray-500">{time}</td>
                      {weekDays.map((day, dayIndex) => {
                        const status = getSlotStatus(day, timeIndex);
                        const isSelected = selectedSlot?.date?.getDate() === day.getDate() && selectedSlot?.time === time;
                        return (
                          <td key={dayIndex} className="px-1 py-1">
                            <button
                              onClick={() => handleSelectSlot(day, time, status)}
                              disabled={status === 'booked'}
                              className={`w-full px-2 py-1.5 text-xs rounded transition-all ${
                                isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                              } ${
                                status === 'recommended' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                                status === 'available' ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                                status === 'limited' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                                'bg-red-50 text-red-400 cursor-not-allowed'
                              }`}
                            >
                              {time.replace(':00', '')}
                              <br />
                              <span className="text-[10px]">
                                {status === 'recommended' ? 'Recommended' : 
                                 status === 'available' ? 'Available' :
                                 status === 'limited' ? 'Limited' : 'Booked'}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="p-4 border-t border-gray-200 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
                <span className="text-xs text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded" />
                <span className="text-xs text-gray-600">Recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
                <span className="text-xs text-gray-600">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-100 border border-amber-300 rounded" />
                <span className="text-xs text-gray-600">Limited / Busy</span>
              </div>
            </div>

            {/* Selected Info */}
            {selectedSlot && (
              <div className="p-4 bg-blue-50 border-t border-blue-100">
                <div className="flex items-center gap-2 text-blue-700">
                  <Star className="w-4 h-4" />
                  <span className="font-medium">{formatDateFull(selectedSlot.date)}, {selectedSlot.time}</span>
                  <span className="text-sm">- {selectedSlot.status === 'recommended' ? 'Recommended because vendor already has Zone A jobs on this date.' : 'Selected slot'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recommended Dates */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recommended Dates</h3>
              <span className="text-sm text-gray-500">{recommendedDates.length}</span>
            </div>
            <div className="space-y-3">
              {recommendedDates.map((rec, i) => (
                <div 
                  key={rec.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    i === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedSlot({ date: rec.date, time: rec.time, status: rec.type })}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      rec.type === 'recommended' ? 'bg-blue-500' :
                      rec.type === 'available' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    <span className="font-medium text-sm">{rec.dateStr}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{rec.time}</p>
                  <p className="text-xs text-gray-400">{rec.vendor} • {rec.zone}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                    rec.type === 'recommended' ? 'bg-blue-100 text-blue-700' :
                    rec.type === 'available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {rec.type === 'recommended' ? 'Recommended' : rec.type === 'available' ? 'Available' : 'Limited'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <button 
                onClick={handleUseRecommended}
                className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Use Recommended ({recommendedDates[0]?.dateStr})
              </button>
              <button className="w-full py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                Apply to All Monthly Visits
              </button>
              <button className="w-full py-2 text-blue-600 text-sm font-medium hover:underline flex items-center justify-center gap-1">
                <Edit2 className="w-3 h-3" /> Customize Dates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Planned Visits Series */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Planned Visit Series</h3>
              <p className="text-sm text-gray-500">
                (Based on first visit: {selectedSlot ? formatDateFull(selectedSlot.date) : 'Not selected'} at {selectedSlot?.time || '-'})
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedService?.frequency} • {selectedService?.visits} visits total • Future visits follow the selected day & time and can be edited anytime.
              </p>
            </div>
            <button className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <Edit2 className="w-3 h-3" /> Edit Recurrence
            </button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {plannedVisits.map((visit, i) => (
              <div 
                key={i}
                className={`flex-shrink-0 w-28 p-3 rounded-lg border text-center ${
                  visit.status === 'Scheduled' ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}
              >
                <p className="text-xs text-gray-500">Visit {visit.visitNumber}</p>
                <p className="font-semibold text-sm mt-1">{visit.dateStr}</p>
                <p className="text-xs text-gray-500">{visit.time}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                  visit.status === 'Scheduled' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>{visit.status}</span>
              </div>
            ))}
          </div>
          
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            The series is generated based on the first visit. You can modify any future visit date before confirming.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PropertySchedulingScreen;
