import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Package,
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Play,
  User,
  Wrench,
  RefreshCw,
  X,
  ChevronRight,
  Save,
  Star,
  Info,
  Check
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
  const [scheduling, setScheduling] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const apiPath = portalType === 'manager' ? 'manager' : portalType === 'franchise' ? 'fp' : 'admin';

  useEffect(() => {
    fetchPropertyDetails();
  }, [propertyId]);

  const fetchPropertyDetails = async () => {
    setLoading(true);
    try {
      if (propertyData) {
        setProperty(propertyData);
        const mockServices = generateMockServices(propertyData);
        setServices(mockServices);
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockServices = (prop) => {
    const serviceList = prop.services || [
      { name: 'HVAC', vendorName: 'ABC HVAC', vendorId: 1, vendorAssigned: true, frequency: 'Monthly', visits: 12 },
      { name: 'Plumbing', vendorName: 'XYZ Plumbing', vendorId: 2, vendorAssigned: true, frequency: 'Every 2 Months', visits: 6 },
      { name: 'Lift', vendorName: 'Elevator Services', vendorId: 3, vendorAssigned: true, frequency: 'Quarterly', visits: 4 },
      { name: 'Pest Control', vendorName: 'PestFree', vendorId: 4, vendorAssigned: true, frequency: 'Half-Yearly', visits: 2 },
      { name: 'Water Tank', vendorName: 'Aqua Services', vendorId: 5, vendorAssigned: true, frequency: 'Yearly', visits: 1 }
    ];
    
    return serviceList.map((s, index) => ({
      id: index + 1,
      name: s.name || s.service,
      vendorName: s.vendorName || 'Not Assigned',
      vendorId: s.vendorId || index + 1,
      vendorAssigned: s.vendorAssigned || false,
      frequency: s.frequency || s.frequencyType || 'Monthly',
      visits: s.visits || s.frequencyCount || 1,
      scheduleStatus: 'Not Scheduled',
      scheduledDates: [],
      recommendedDate: null
    }));
  };

  // Generate smart recommendations based on vendor's existing zone schedule
  const generateSmartRecommendations = (service, zone) => {
    // Simulated vendor schedule in the same zone
    const vendorZoneSchedule = generateVendorZoneSchedule(service.vendorName, zone);
    const frequency = service.frequency;
    
    // Find dates when vendor is already working in this zone
    const zoneWorkDates = vendorZoneSchedule.filter(s => s.zone === zone);
    
    // Generate recommended date (when vendor is already in zone)
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Create recommendations
    const recommended = zoneWorkDates.length > 0 ? {
      date: zoneWorkDates[0].date,
      time: zoneWorkDates[0].availableSlot,
      reason: `Vendor already working in ${zone} on this date`
    } : {
      date: formatDateString(new Date(nextMonth.getTime() + 10 * 24 * 60 * 60 * 1000)),
      time: '10:00 AM',
      reason: 'First available slot'
    };

    // Generate alternative dates
    const alternatives = [];
    for (let i = 0; i < zoneWorkDates.length && alternatives.length < 3; i++) {
      if (zoneWorkDates[i].date !== recommended.date) {
        alternatives.push({
          date: zoneWorkDates[i].date,
          time: zoneWorkDates[i].availableSlot
        });
      }
    }

    // Add more alternatives if needed
    if (alternatives.length < 3) {
      const additionalDates = generateAvailableDates(nextMonth, 5 - alternatives.length);
      additionalDates.forEach(d => {
        if (!alternatives.find(a => a.date === d.date)) {
          alternatives.push(d);
        }
      });
    }

    return {
      service: service.name,
      vendor: service.vendorName,
      zone: zone,
      frequency: frequency,
      visits: service.visits,
      vendorExistingSchedule: zoneWorkDates.slice(0, 6),
      recommended,
      alternatives: alternatives.slice(0, 3)
    };
  };

  // Simulate vendor's existing schedule in a zone
  const generateVendorZoneSchedule = (vendorName, zone) => {
    const schedule = [];
    const today = new Date();
    const baseDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    // Generate dates: 10, 12, 19 of next month and 9, 11, 18 of month after
    const days1 = [10, 12, 19];
    const days2 = [9, 11, 18];
    const times = ['10:00 AM', '2:00 PM', '11:30 AM', '9:00 AM', '3:30 PM', '10:30 AM'];
    
    days1.forEach((day, i) => {
      const date = new Date(baseDate);
      date.setDate(day);
      schedule.push({
        date: formatDateString(date),
        zone: zone,
        availableSlot: times[i % times.length]
      });
    });
    
    const nextNextMonth = new Date(baseDate);
    nextNextMonth.setMonth(nextNextMonth.getMonth() + 1);
    
    days2.forEach((day, i) => {
      const date = new Date(nextNextMonth);
      date.setDate(day);
      schedule.push({
        date: formatDateString(date),
        zone: zone,
        availableSlot: times[(i + 3) % times.length]
      });
    });
    
    return schedule;
  };

  const generateAvailableDates = (startDate, count) => {
    const dates = [];
    const times = ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'];
    
    for (let i = 0; i < count; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + (i + 1) * 3 + 20);
      dates.push({
        date: formatDateString(date),
        time: times[i % times.length]
      });
    }
    return dates;
  };

  const formatDateString = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleScheduleService = (service) => {
    setSelectedService(service);
    setLoadingRecommendations(true);
    setShowScheduleModal(true);
    setSelectedDate(null);
    
    // Simulate API call delay
    setTimeout(() => {
      const recs = generateSmartRecommendations(service, property?.zone || 'Zone A');
      setRecommendations(recs);
      setSelectedDate({
        date: recs.recommended.date,
        time: recs.recommended.time,
        isRecommended: true
      });
      setLoadingRecommendations(false);
    }, 800);
  };

  const handleAutoRecommendAll = async () => {
    setScheduling(true);
    
    // Generate recommendations for all services
    setTimeout(() => {
      setServices(prev => prev.map(s => {
        const recs = generateSmartRecommendations(s, property?.zone || 'Zone A');
        return {
          ...s,
          scheduleStatus: 'Scheduled',
          recommendedDate: recs.recommended,
          scheduledDates: [recs.recommended]
        };
      }));
      setScheduling(false);
    }, 2000);
  };

  const handleSelectDate = (date, time, isRecommended = false) => {
    setSelectedDate({ date, time, isRecommended });
  };

  const handleConfirmSchedule = () => {
    if (selectedService && selectedDate) {
      setServices(prev => prev.map(s => 
        s.id === selectedService.id 
          ? { 
              ...s, 
              scheduleStatus: 'Scheduled', 
              recommendedDate: selectedDate,
              scheduledDates: [selectedDate]
            }
          : s
      ));
      setShowScheduleModal(false);
      setSelectedService(null);
      setRecommendations(null);
      setSelectedDate(null);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'Scheduled') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
          <CheckCircle className="w-3 h-3" />
          Scheduled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
        <Clock className="w-3 h-3" />
        Not Scheduled
      </span>
    );
  };

  const goBack = () => navigate(-1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading property details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={goBack} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Scheduling</h1>
          <p className="text-sm text-gray-500">Smart schedule recommendations based on vendor availability</p>
        </div>
      </div>

      {/* Property Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Property ID</p>
            <p className="text-sm font-bold text-blue-600">{property?.propertyId || 'PROP-001'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Property Name</p>
            <p className="text-sm font-semibold text-gray-900">{property?.propertyName || 'Green Valley Apartments'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Property Type</p>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-700">{property?.propertyType || 'Apartment'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Zone</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-700">{property?.zone || 'Zone A'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Package</p>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-medium text-purple-700">{property?.packageName || 'Apartment Basic'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Contract Period</p>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-700">01-Sep-2026 to 31-Aug-2027</p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Recommend Button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Services & Scheduling</h2>
        <button
          onClick={handleAutoRecommendAll}
          disabled={scheduling}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
        >
          {scheduling ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Auto Scheduling...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Auto Recommend All
            </>
          )}
        </button>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase">Service</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase">Vendor</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase">Frequency</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase">Visits</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase">Schedule Status</th>
              <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map((service, index) => (
              <tr key={service.id} className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{service.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{service.vendorName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                    {service.frequency}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-700 font-bold text-sm rounded-full">
                    {service.visits}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    {getStatusBadge(service.scheduleStatus)}
                    {service.recommendedDate && (
                      <span className="text-xs text-gray-500">
                        First visit: {service.recommendedDate.date}, {service.recommendedDate.time}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {service.scheduleStatus === 'Scheduled' ? (
                    <button
                      onClick={() => handleScheduleService(service)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      View/Edit
                    </button>
                  ) : (
                    <button
                      onClick={() => handleScheduleService(service)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Schedule
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Smart Schedule Modal */}
      {showScheduleModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Smart Schedule Recommendation</h3>
                <p className="text-sm text-gray-500">Based on vendor availability in {property?.zone || 'Zone A'}</p>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {loadingRecommendations ? (
              <div className="p-12 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Analyzing vendor schedule...</p>
                <p className="text-sm text-gray-400 mt-1">Finding optimal dates for {property?.zone || 'Zone A'}</p>
              </div>
            ) : recommendations && (
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Service Info */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Service</p>
                      <p className="font-semibold text-gray-900">{recommendations.service}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Vendor</p>
                      <p className="font-semibold text-gray-900">{recommendations.vendor}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Zone</p>
                      <p className="font-semibold text-gray-900">{recommendations.zone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Frequency</p>
                      <p className="font-semibold text-gray-900">{recommendations.frequency}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Visits/Year</p>
                      <p className="font-semibold text-gray-900">{recommendations.visits}</p>
                    </div>
                  </div>
                </div>

                {/* Vendor's Existing Zone Schedule */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    {recommendations.vendor}'s Existing {recommendations.zone} Schedule
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.vendorExistingSchedule.map((slot, i) => (
                      <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg border border-blue-100">
                        {slot.date}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recommended Date */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    Recommended First Visit
                  </h4>
                  <button
                    onClick={() => handleSelectDate(recommendations.recommended.date, recommendations.recommended.time, true)}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      selectedDate?.isRecommended 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-green-100 rounded-xl flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-green-700">{recommendations.recommended.date.split(' ')[1]}</span>
                          <span className="text-xs text-green-600">{recommendations.recommended.date.split(' ')[0]}</span>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{recommendations.recommended.date}</span>
                            <span className="text-gray-400">—</span>
                            <span className="text-lg font-semibold text-blue-600">{recommendations.recommended.time}</span>
                          </div>
                          <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                            <Info className="w-3.5 h-3.5" />
                            {recommendations.recommended.reason}
                          </p>
                        </div>
                      </div>
                      {selectedDate?.isRecommended && (
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Alternative Dates */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-gray-500" />
                    Other Available Dates
                  </h4>
                  <div className="space-y-2">
                    {recommendations.alternatives.map((alt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectDate(alt.date, alt.time, false)}
                        className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                          selectedDate?.date === alt.date && !selectedDate?.isRecommended
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-sm font-bold text-gray-700">{alt.date.split(' ')[1]}</span>
                            <span className="text-xs text-gray-500">{alt.date.split(' ')[0]}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-semibold text-gray-900">{alt.date}</span>
                            <span className="text-gray-400 mx-2">—</span>
                            <span className="text-sm font-medium text-blue-600">{alt.time}</span>
                          </div>
                        </div>
                        {selectedDate?.date === alt.date && !selectedDate?.isRecommended && (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500">
                {selectedDate ? (
                  <>Selected: <span className="font-semibold text-gray-900">{selectedDate.date}, {selectedDate.time}</span></>
                ) : (
                  'Select a date to continue'
                )}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSchedule}
                  disabled={!selectedDate}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertySchedulingScreen;
