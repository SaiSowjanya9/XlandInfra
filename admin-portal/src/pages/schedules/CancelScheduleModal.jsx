import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, Calendar, Building2, Wrench, User, 
  Check, RefreshCw, ChevronRight, Search, AlertCircle
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Cancel Schedule Modal
 * Allows manager to cancel individual visits, all future visits, or entire property schedule
 */
const CancelScheduleModal = ({ 
  isOpen, 
  onClose, 
  propertyId,
  onCancel,
  portalType = 'admin'
}) => {
  const [step, setStep] = useState(1); // 1: Select Property, 2: Select Service, 3: Confirm
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [cancellationScope, setCancellationScope] = useState('this_visit_only');
  const [cancelEntireProperty, setCancelEntireProperty] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEntirePropertyConfirm, setShowEntirePropertyConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (propertyId) {
        // If propertyId provided, skip to step 2
        fetchPropertyServices(propertyId);
        setStep(2);
      } else {
        fetchProperties();
      }
    }
  }, [isOpen, propertyId]);

  const fetchProperties = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyServices = async (propId) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/property/${propId}/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setServices(data.data || generateMockServices());
      } else {
        setServices(generateMockServices());
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices(generateMockServices());
    } finally {
      setLoading(false);
    }
  };

  const generateMockServices = () => [
    { id: 1, serviceName: 'HVAC', vendorName: 'ABC HVAC', nextVisit: 'Sep 12', remainingVisits: 12, totalVisits: 12, status: 'scheduled' },
    { id: 2, serviceName: 'Plumbing', vendorName: 'XYZ Plumbing', nextVisit: 'Sep 20', remainingVisits: 6, totalVisits: 6, status: 'scheduled' },
    { id: 3, serviceName: 'Lift', vendorName: 'Elevate Services', nextVisit: 'Oct 05', remainingVisits: 4, totalVisits: 4, status: 'scheduled' }
  ];

  const handleSelectProperty = (property) => {
    setSelectedProperty(property);
    fetchPropertyServices(property.id);
    setStep(2);
  };

  const handleSelectService = (service) => {
    setSelectedService(service);
    setStep(3);
  };

  const handleCancelVisit = async () => {
    if (!reason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }
    
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const endpoint = cancellationScope === 'all_future' 
        ? `${API_BASE}/api/schedules/service/${selectedService.id}/cancel-future`
        : `${API_BASE}/api/schedules/visits/${selectedService.nextVisitId}/cancel`;
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason,
          scope: cancellationScope,
          cancelledBy: 'manager'
        })
      });
      
      if (response.ok) {
        onCancel && onCancel({
          service: selectedService,
          scope: cancellationScope,
          reason
        });
        onClose();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to cancel');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      alert('Error processing cancellation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEntireProperty = async () => {
    if (!reason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }
    
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/property/${selectedProperty?.id || propertyId}/cancel-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason,
          cancelledBy: 'manager'
        })
      });
      
      if (response.ok) {
        onCancel && onCancel({
          propertyId: selectedProperty?.id || propertyId,
          scope: 'entire_property',
          reason
        });
        onClose();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to cancel property schedules');
      }
    } catch (error) {
      console.error('Error cancelling property:', error);
      alert('Error processing cancellation');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredProperties = properties.filter(p => 
    p.propertyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.propertyId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Cancel Schedule</h2>
              <p className="text-red-100 text-sm mt-1">
                {step === 1 ? 'Select Property' : step === 2 ? 'Select Service' : 'Confirm Cancellation'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Step 1: Select Property */}
              {step === 1 && (
                <div>
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by Property ID or Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {filteredProperties.map(property => (
                      <button
                        key={property.id}
                        onClick={() => handleSelectProperty(property)}
                        className="w-full p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-100">
                            <Building2 className="w-6 h-6 text-gray-600 group-hover:text-red-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">{property.propertyId}</p>
                            <p className="text-sm text-gray-500">{property.propertyName}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Select Service */}
              {step === 2 && (
                <div>
                  {selectedProperty && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{selectedProperty.propertyId} – {selectedProperty.propertyName}</p>
                      </div>
                    </div>
                  )}
                  
                  <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Scheduled Services</h3>
                  
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vendor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Next Visit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {services.map(service => (
                        <tr key={service.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{service.serviceName}</td>
                          <td className="px-4 py-3 text-gray-700">{service.vendorName}</td>
                          <td className="px-4 py-3 text-gray-700">{service.nextVisit}</td>
                          <td className="px-4 py-3 text-gray-700">{service.remainingVisits}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              {service.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleSelectService(service)}
                              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Cancel Entire Property Button */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setShowEntirePropertyConfirm(true)}
                      className="w-full p-4 border-2 border-dashed border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <AlertTriangle className="w-5 h-5" />
                      Cancel Entire Property Schedule
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      This will cancel all future service occurrences for this property
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm Cancellation */}
              {step === 3 && selectedService && (
                <div>
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-800">Cancel {selectedService.serviceName} Service</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Vendor: {selectedService.vendorName} | Next Visit: {selectedService.nextVisit}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cancellation Scope */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Cancellation Scope</label>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-red-300 transition-colors">
                        <input
                          type="radio"
                          name="scope"
                          value="this_visit_only"
                          checked={cancellationScope === 'this_visit_only'}
                          onChange={(e) => setCancellationScope(e.target.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Cancel This Visit Only</p>
                          <p className="text-sm text-gray-500">Only the next scheduled visit ({selectedService.nextVisit}) will be cancelled. Future visits remain unchanged.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-red-300 transition-colors">
                        <input
                          type="radio"
                          name="scope"
                          value="all_future"
                          checked={cancellationScope === 'all_future'}
                          onChange={(e) => setCancellationScope(e.target.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Cancel All Future Visits for This Service</p>
                          <p className="text-sm text-gray-500">All {selectedService.remainingVisits} remaining visits will be cancelled. Completed visits remain in history.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cancellation Reason *</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Enter reason for cancellation..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Cancelled schedules will remain in history for audit purposes. This action cannot be undone.
                    </p>
                  </div>
                </div>
              )}

              {/* Entire Property Cancellation Confirm */}
              {showEntirePropertyConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Cancel Entire Property Schedule</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          You are about to cancel all future schedules for Property {selectedProperty?.propertyId || propertyId}.
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        Existing completed services and past work orders will remain unchanged.
                      </p>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cancellation Reason *</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Customer cancelled AMC contract..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowEntirePropertyConfirm(false)}
                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                      >
                        Go Back
                      </button>
                      <button
                        onClick={handleCancelEntireProperty}
                        disabled={!reason.trim() || submitting}
                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {submitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        Confirm Cancellation
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => {
              if (step > 1 && !propertyId) {
                setStep(step - 1);
                if (step === 3) setSelectedService(null);
                if (step === 2) setSelectedProperty(null);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            {step > 1 && !propertyId ? 'Back' : 'Cancel'}
          </button>
          
          {step === 3 && (
            <button
              onClick={handleCancelVisit}
              disabled={!reason.trim() || submitting}
              className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Confirm Cancellation
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CancelScheduleModal;
