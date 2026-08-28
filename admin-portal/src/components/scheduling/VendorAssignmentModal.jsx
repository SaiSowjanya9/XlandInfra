import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Star,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Briefcase,
  IndianRupee,
  Clock,
  Check,
  Building2,
  Wrench,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const VendorAssignmentModal = ({
  isOpen,
  onClose,
  property,
  service,
  portalType = 'admin',
  onVendorAssigned
}) => {
  const token = getAuthToken();
  
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Get API path based on portal type
  const getApiPath = () => {
    const portalMap = {
      'franchise': 'fp',
      'manager': 'manager',
      'admin': 'admin',
      'employee': 'admin'
    };
    return portalMap[portalType] || 'admin';
  };

  // Fetch eligible vendors
  const fetchEligibleVendors = useCallback(async () => {
    if (!service) return;
    
    setLoading(true);
    setError(null);

    try {
      const apiPath = getApiPath();
      const params = new URLSearchParams({
        serviceCategory: service.name || service.service || '',
        zone: property?.zone || ''
      });

      const response = await fetch(
        `${API_BASE}/api/${apiPath}/schedules/eligible-vendors?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const result = await response.json();

      if (result.success) {
        setVendors(result.data || []);
        setFilteredVendors(result.data || []);
        
        if (result.data?.length === 0) {
          setError('No Vendor Available for this service category and zone.');
        }
      } else {
        // Fallback to fetching all active vendors
        const fallbackResponse = await fetch(
          `${API_BASE}/api/vendors?status=active`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        const fallbackResult = await fallbackResponse.json();
        
        if (fallbackResult.success) {
          // Filter by service type if available
          let filtered = fallbackResult.data || [];
          if (service.name) {
            filtered = filtered.filter(v => 
              v.serviceType?.toLowerCase().includes(service.name.toLowerCase()) ||
              service.name.toLowerCase().includes(v.serviceType?.toLowerCase() || '')
            );
          }
          setVendors(filtered);
          setFilteredVendors(filtered);
          
          if (filtered.length === 0) {
            setError('No Vendor Available');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError('Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, service, property, portalType]);

  useEffect(() => {
    if (isOpen && service) {
      fetchEligibleVendors();
      setSelectedVendor(null);
      setSuccess(null);
    }
  }, [isOpen, service, fetchEligibleVendors]);

  // Filter vendors by search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredVendors(vendors);
    } else {
      const search = searchTerm.toLowerCase();
      setFilteredVendors(vendors.filter(v =>
        v.vendorName?.toLowerCase().includes(search) ||
        v.ownerName?.toLowerCase().includes(search) ||
        v.vendorId?.toLowerCase().includes(search) ||
        v.serviceType?.toLowerCase().includes(search) ||
        v.zone?.toLowerCase().includes(search)
      ));
    }
  }, [searchTerm, vendors]);

  // Handle vendor assignment
  const handleAssignVendor = async () => {
    if (!selectedVendor || !property || !service) return;

    setAssigning(true);
    setError(null);

    try {
      const apiPath = getApiPath();
      const response = await fetch(
        `${API_BASE}/api/${apiPath}/schedules/assign-vendor`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            propertyId: property.id,
            vendorId: selectedVendor.id,
            serviceName: service.name || service.service,
            serviceType: service.name || service.service,
            frequency: service.frequency || 'monthly',
            frequencyCount: service.frequencyCount || service.visits || 1,
            totalVisits: service.visits || service.frequencyCount || 1,
            estimateId: property.estimateId
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setSuccess(`${selectedVendor.vendorName || selectedVendor.ownerName} assigned to ${service.name || service.service}`);
        
        // Notify parent component
        if (onVendorAssigned) {
          onVendorAssigned({
            service: service.name || service.service,
            vendorId: selectedVendor.id,
            vendorName: selectedVendor.vendorName || selectedVendor.ownerName,
            allVendorsAssigned: result.data?.allVendorsAssigned
          });
        }

        // Close modal after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(result.message || 'Failed to assign vendor');
      }
    } catch (err) {
      console.error('Error assigning vendor:', err);
      setError('Failed to assign vendor. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assign Vendor</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select a vendor for <span className="font-medium text-blue-600">{service?.name || service?.service}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Property & Service Info */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{property?.propertyName}</span>
              <span className="text-gray-400">({property?.propertyId})</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{property?.zone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{service?.name || service?.service}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {service?.frequency || 'Monthly'} • {service?.visits || 1} visits
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors by name, ID, service type, zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing vendors filtered by: <span className="font-medium">Service Capability</span> + <span className="font-medium">Zone</span> + <span className="font-medium">Active Status</span>
          </p>
        </div>

        {/* Vendors List */}
        <div className="overflow-y-auto max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading eligible vendors...</span>
            </div>
          ) : error && filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mb-3" />
              <p className="text-gray-900 font-medium">{error}</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or check vendor management.
              </p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <User className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">No vendors found matching your search</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    selectedVendor?.id === vendor.id
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedVendor(vendor)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {/* Selection Indicator */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${
                        selectedVendor?.id === vendor.id
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedVendor?.id === vendor.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>

                      {/* Vendor Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {vendor.vendorName || vendor.ownerName}
                          </span>
                          <span className="text-xs text-gray-400">({vendor.vendorId})</span>
                          {vendor.rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs text-gray-600">{vendor.rating?.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {vendor.serviceType || 'General'}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {vendor.zone || 'All Zones'}
                          </span>
                          {vendor.totalJobsCompleted > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              {vendor.totalJobsCompleted} jobs
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          {vendor.ownerMobile && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {vendor.ownerMobile}
                            </span>
                          )}
                          {vendor.ownerEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {vendor.ownerEmail}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rate */}
                    {vendor.ratePerVisit > 0 && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-gray-900 font-medium">
                          <IndianRupee className="w-3.5 h-3.5" />
                          {vendor.ratePerVisit?.toLocaleString()}
                        </div>
                        <span className="text-xs text-gray-400">per visit</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {/* Success Message */}
          {success && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-700">{success}</span>
            </div>
          )}

          {/* Error Message */}
          {error && !success && filteredVendors.length > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {selectedVendor ? (
                <span className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                  Selected: <span className="font-medium text-gray-900">{selectedVendor.vendorName || selectedVendor.ownerName}</span>
                </span>
              ) : (
                <span>Select a vendor to assign</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignVendor}
                disabled={!selectedVendor || assigning || success}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {assigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Assigned!
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Assign Vendor
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorAssignmentModal;
