import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, User, Building2, Wrench, AlertCircle, 
  Check, ChevronRight, RefreshCw, MapPin
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Reschedule Request Modal
 * Displays current schedule, vendor availability, and allows manager to select new date/time
 */
const RescheduleRequestModal = ({ 
  isOpen, 
  onClose, 
  request, 
  onReschedule,
  portalType = 'admin'
}) => {
  const [loading, setLoading] = useState(false);
  const [vendorAvailability, setVendorAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [reason, setReason] = useState(request?.requestReason || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && request?.vendorId) {
      fetchVendorAvailability();
    }
  }, [isOpen, request]);

  const fetchVendorAvailability = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const requestedDate = request?.requestedDate || new Date().toISOString().split('T')[0];
      
      const response = await fetch(
        `${API_BASE}/api/schedules/vendor/${request.vendorId}/availability?` +
        `startDate=${requestedDate}&days=7&zone=${request.zone || ''}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setVendorAvailability(data.data?.availability || generateMockAvailability(requestedDate));
      } else {
        setVendorAvailability(generateMockAvailability(requestedDate));
      }
    } catch (error) {
      console.error('Error fetching vendor availability:', error);
      setVendorAvailability(generateMockAvailability(request?.requestedDate));
    } finally {
      setLoading(false);
    }
  };

  const generateMockAvailability = (startDate) => {
    const start = new Date(startDate || new Date());
    const availability = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      
      // Simulate availability
      let status = 'available';
      let sameZoneJobs = 0;
      
      if (dayOfWeek === 0) status = 'unavailable'; // Sunday
      else if (i === 1) { status = 'recommended'; sameZoneJobs = 2; }
      else if (i === 3) status = 'booked';
      
      availability.push({
        date: date.toISOString().split('T')[0],
        dateStr: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        status,
        sameZoneJobs,
        availableSlots: status === 'booked' ? 0 : status === 'unavailable' ? 0 : 3,
        timeSlots: ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM']
      });
    }
    
    return availability;
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('Please select a new date');
      return;
    }
    
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/visits/${request.visitId}/reschedule`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newDate: selectedDate,
          newTimeStart: selectedTime,
          reason: reason,
          scope: 'this_visit_only', // Always default
          previousDate: request.scheduledDate,
          requestId: request.id
        })
      });
      
      if (response.ok) {
        onReschedule && onReschedule({
          oldDate: request.scheduledDate,
          newDate: selectedDate,
          newTime: selectedTime,
          status: 'rescheduled'
        });
        onClose();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Error processing reschedule request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (status) => {
    const styles = {
      available: 'bg-green-100 text-green-700 border-green-200',
      recommended: 'bg-blue-100 text-blue-700 border-blue-200',
      booked: 'bg-red-100 text-red-400 border-red-200',
      unavailable: 'bg-gray-100 text-gray-400 border-gray-200'
    };
    return styles[status] || styles.available;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Reschedule Request</h2>
              <p className="text-orange-100 text-sm mt-1">Review and approve reschedule</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Current Schedule Info */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Current Schedule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Service</p>
                <p className="font-semibold text-gray-900">{request?.serviceName || 'HVAC'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Scheduled Date</p>
                <p className="font-semibold text-gray-900">{request?.scheduledDateStr || 'Oct 10'} – {request?.scheduledTime || '10:00 AM'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned Vendor</p>
                <p className="font-semibold text-gray-900">{request?.vendorName || 'ABC HVAC'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Property</p>
                <p className="font-semibold text-gray-900">{request?.propertyName || 'Green Valley'}</p>
              </div>
            </div>
          </div>
          
          {request?.requestReason && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Request Reason:</strong> {request.requestReason}
              </p>
            </div>
          )}
        </div>

        {/* Vendor Availability */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
            Vendor Availability Around Requested Date
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {vendorAvailability.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => slot.status !== 'booked' && slot.status !== 'unavailable' && setSelectedDate(slot.date)}
                  disabled={slot.status === 'booked' || slot.status === 'unavailable'}
                  className={`w-full p-3 rounded-lg border-2 transition-all flex items-center justify-between ${
                    selectedDate === slot.date 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : getStatusBadge(slot.status)
                  } ${slot.status === 'booked' || slot.status === 'unavailable' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{slot.dateStr}</p>
                      <p className="text-xs text-gray-500">{slot.dayName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {slot.sameZoneJobs > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {slot.sameZoneJobs} zone jobs
                      </span>
                    )}
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      slot.status === 'recommended' ? 'bg-blue-500 text-white' :
                      slot.status === 'available' ? 'bg-green-500 text-white' :
                      slot.status === 'booked' ? 'bg-red-200 text-red-700' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {slot.status === 'recommended' ? 'Recommended' : 
                       slot.status === 'available' ? 'Available' :
                       slot.status === 'booked' ? 'Booked' : 'Unavailable'}
                    </span>
                    {selectedDate === slot.date && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Time Selection */}
          {selectedDate && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
              <div className="flex flex-wrap gap-2">
                {['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', 
                  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM'].map(time => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedTime === time 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Reschedule</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer requested change..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          {selectedDate && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Reschedule Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Old Date:</p>
                  <p className="font-medium text-gray-900">{request?.scheduledDateStr} – {request?.scheduledTime}</p>
                </div>
                <div>
                  <p className="text-gray-600">New Date:</p>
                  <p className="font-medium text-green-700">
                    {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {selectedTime}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Status will change to: Rescheduled</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedDate || submitting}
            className="px-6 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirm Reschedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleRequestModal;
