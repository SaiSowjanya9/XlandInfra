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
  Save
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
  const [scheduleForm, setScheduleForm] = useState({
    startDate: '',
    preferredDay: '',
    preferredTime: '',
    notes: ''
  });

  const apiPath = portalType === 'manager' ? 'manager' : portalType === 'franchise' ? 'fp' : 'admin';

  useEffect(() => {
    fetchPropertyDetails();
  }, [propertyId]);

  const fetchPropertyDetails = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      // For now, use mock data - replace with actual API call
      if (propertyData) {
        setProperty(propertyData);
        // Generate services from property data
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
    // Parse services from property data or use defaults
    const serviceList = prop.services || [
      { name: 'HVAC', vendorName: 'ABC HVAC', vendorAssigned: true, frequency: 'Monthly', visits: 12 },
      { name: 'Plumbing', vendorName: 'XYZ Plumbing', vendorAssigned: true, frequency: 'Every 2 Months', visits: 6 },
      { name: 'Lift', vendorName: 'Elevator Services', vendorAssigned: true, frequency: 'Quarterly', visits: 4 },
      { name: 'Pest Control', vendorName: 'PestFree', vendorAssigned: true, frequency: 'Half-Yearly', visits: 2 },
      { name: 'Water Tank', vendorName: 'Aqua Services', vendorAssigned: true, frequency: 'Yearly', visits: 1 }
    ];
    
    return serviceList.map((s, index) => ({
      id: index + 1,
      name: s.name || s.service,
      vendorName: s.vendorName || 'Not Assigned',
      vendorAssigned: s.vendorAssigned || false,
      frequency: s.frequency || s.frequencyType || 'Monthly',
      visits: s.visits || s.frequencyCount || 1,
      scheduleStatus: 'Not Scheduled',
      scheduledDates: []
    }));
  };

  const handleScheduleService = (service) => {
    setSelectedService(service);
    setShowScheduleModal(true);
  };

  const handleAutoRecommendAll = async () => {
    setScheduling(true);
    // Simulate auto-scheduling
    setTimeout(() => {
      setServices(prev => prev.map(s => ({
        ...s,
        scheduleStatus: 'Scheduled',
        scheduledDates: generateRecommendedDates(s.frequency, s.visits)
      })));
      setScheduling(false);
    }, 2000);
  };

  const generateRecommendedDates = (frequency, visits) => {
    const dates = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + 1);
    startDate.setDate(1);
    
    let interval = 1;
    switch (frequency.toLowerCase()) {
      case 'monthly': interval = 1; break;
      case 'every 2 months': interval = 2; break;
      case 'quarterly': interval = 3; break;
      case 'half-yearly': interval = 6; break;
      case 'yearly': interval = 12; break;
      default: interval = 1;
    }
    
    for (let i = 0; i < visits; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + (i * interval));
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  const handleSaveSchedule = () => {
    if (selectedService) {
      setServices(prev => prev.map(s => 
        s.id === selectedService.id 
          ? { ...s, scheduleStatus: 'Scheduled', scheduledDates: [scheduleForm.startDate] }
          : s
      ));
      setShowScheduleModal(false);
      setSelectedService(null);
      setScheduleForm({ startDate: '', preferredDay: '', preferredTime: '', notes: '' });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
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

  const goBack = () => {
    navigate(-1);
  };

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
        <button 
          onClick={goBack}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Scheduling</h1>
          <p className="text-sm text-gray-500">Schedule services for this property</p>
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
              <tr 
                key={service.id} 
                className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
              >
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
                    <span className={`text-sm ${service.vendorAssigned ? 'text-gray-700' : 'text-red-500'}`}>
                      {service.vendorName}
                    </span>
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
                  {getStatusBadge(service.scheduleStatus)}
                </td>
                <td className="px-6 py-4 text-center">
                  {service.scheduleStatus === 'Scheduled' ? (
                    <button
                      onClick={() => handleScheduleService(service)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      View Schedule
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

      {/* Schedule Modal */}
      {showScheduleModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Schedule Service</h3>
                <p className="text-sm text-gray-500">{selectedService.name}</p>
              </div>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={scheduleForm.startDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Day</label>
                <select
                  value={scheduleForm.preferredDay}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, preferredDay: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select day</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
                <select
                  value={scheduleForm.preferredTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, preferredTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select time slot</option>
                  <option value="morning">Morning (9 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                  <option value="evening">Evening (4 PM - 7 PM)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any special instructions..."
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSchedule}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertySchedulingScreen;
