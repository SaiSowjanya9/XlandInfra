import { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import { Store, Search, RefreshCw, X, AlertCircle, CheckCircle, Eye, Wrench, Zap, Wind, Sparkles, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader, { HEADER_ACTION_CLASS, HEADER_GHOST_CLASS } from '../components/common/PageHeader';
import { formatDate } from '../utils/dateFormat';
import Modal from '../components/common/Modal';
import ViewModal, { ViewSection, ViewField, ViewGrid } from '../components/common/ViewModal';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ITEMS_PER_PAGE = 10;

const SERVICE_TYPES = [
  { id: 'all', label: 'All Vendors', icon: Store },
  { id: 'Plumbing', label: 'Plumbing', icon: Wrench },
  { id: 'Electrical', label: 'Electrical', icon: Zap },
  { id: 'HVAC', label: 'HVAC', icon: Wind },
  { id: 'Cleaning', label: 'Cleaning', icon: Sparkles },
  { id: 'Security', label: 'Security', icon: Shield },
];

const ExecutiveVendors = ({ user }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const token = getAuthToken();

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/executive/vendors`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) setVendors(result.data.all || result.data || []);
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const viewVendorDetails = (vendor) => { setSelectedVendor(vendor); setShowDetailModal(true); };


  // Derived data - based on current status filter for dynamic counts
  const getStatusFilteredVendors = () => {
    return vendors.filter(v => {
      const isActive = v.status === 'active' || v.is_active;
      if (statusFilter === 'active') return isActive;
      if (statusFilter === 'inactive') return !isActive;
      return true;
    });
  };
  
  const statusFilteredVendors = getStatusFilteredVendors();
  const zones = [...new Set(statusFilteredVendors.map(v => v.zone || v.zone_name).filter(Boolean))].sort();
  
  // Get count for each service type (based on status + zone filters)
  const getServiceCount = (type) => {
    let filtered = statusFilteredVendors;
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(v => (v.zone || v.zone_name) === zoneFilter);
    }
    if (type === 'all') return filtered.length;
    return filtered.filter(v => v.service_type?.toLowerCase() === type.toLowerCase()).length;
  };
  
  // Get count for each zone (based on status + service type filters)
  const getZoneCount = (zone) => {
    let filtered = statusFilteredVendors;
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(v => v.service_type?.toLowerCase() === serviceFilter.toLowerCase());
    }
    if (zone === 'all') return filtered.length;
    return filtered.filter(v => (v.zone || v.zone_name) === zone).length;
  };
  
  // Get count for each status (based on service type + zone filters)
  const getStatusCount = (status) => {
    let filtered = vendors.filter(v => {
      const isActive = v.status === 'active' || v.is_active;
      if (status === 'active') return isActive;
      if (status === 'inactive') return !isActive;
      return true;
    });
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(v => v.service_type?.toLowerCase() === serviceFilter.toLowerCase());
    }
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(v => (v.zone || v.zone_name) === zoneFilter);
    }
    return filtered.length;
  };

  const filteredVendors = vendors.filter(v => {
    const matchSearch = !searchTerm || 
      v.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.zone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchService = serviceFilter === 'all' || v.service_type?.toLowerCase() === serviceFilter.toLowerCase();
    const matchZone = zoneFilter === 'all' || v.zone === zoneFilter || v.zone_name === zoneFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? (v.status === 'active' || v.is_active) : v.status !== 'active');
    return matchSearch && matchService && matchZone && matchStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredVendors.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, serviceFilter, zoneFilter, statusFilter]);

  return (
    <div className="space-y-4">
      {/* The shared section header, as on Work Orders and Estimates */}
      <PageHeader icon={Store} title="Vendor Details"
        subtitle={`${statusFilteredVendors.length} total vendors`}>
        <button onClick={fetchVendors} className={`${HEADER_GHOST_CLASS} !px-2.5`} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </PageHeader>

      {message.text && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, service, or zone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.trim())}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Service Types ({getServiceCount('all')})</option>
          {SERVICE_TYPES.filter(t => t.id !== 'all').map(type => (
            <option key={type.id} value={type.id}>{type.label} ({getServiceCount(type.id)})</option>
          ))}
        </select>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Zones ({getZoneCount('all')})</option>
          {zones.map(z => { const zoneName = typeof z === 'object' ? (z.name || z.zone_name) : z; return <option key={zoneName} value={zoneName}>{zoneName} ({getZoneCount(zoneName)})</option>; })}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="active">Active Vendors ({getStatusCount('active')})</option>
          <option value="all">All Status ({getStatusCount('all')})</option>
          <option value="inactive">Inactive ({getStatusCount('inactive')})</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12"><Store className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No vendors found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Service Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Area</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Coverage/Day</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-900">{vendor.owner_name || vendor.company_name || '-'}</p>
                      <p className="text-xs text-gray-400">{vendor.vendor_id}</p>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.service_type || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.zone || vendor.zone_name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.area || vendor.area_name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.coverage_per_day || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.created_by_name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-500">{formatDate(vendor.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${vendor.status === 'active' || vendor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {vendor.status === 'active' || vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => viewVendorDetails(vendor)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && filteredVendors.length > 0 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-100 rounded-xl">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredVendors.length)} of {filteredVendors.length} vendors
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .map((page, index, array) => (
                <span key={page} className="flex items-center">
                  {index > 0 && array[index - 1] !== page - 1 && <span className="px-2 text-gray-400">...</span>}
                  <button
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${currentPage === page ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50'}`}
                  >
                    {page}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailModal && selectedVendor && (
        <ViewModal
          onClose={() => setShowDetailModal(false)}
          id={selectedVendor.vendor_id}
          title={selectedVendor.owner_name || selectedVendor.company_name || 'Vendor Details'}
          meta={[
            { label: 'Created', value: formatDate(selectedVendor.created_at) },
            { label: 'Created By', value: selectedVendor.created_by_name || selectedVendor.created_by || '-' },
          ]}
          badge={
            <span className="flex items-center gap-1.5">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${selectedVendor.vendor_type === 'own' ? 'bg-warm-accent-soft text-warm-accent-hover' : 'bg-warm-section text-warm-muted'}`}>
                {selectedVendor.vendor_type === 'own' ? 'My Vendor' : 'Assigned'}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${selectedVendor.is_active || selectedVendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {selectedVendor.is_active || selectedVendor.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </span>
          }
        >
              {/* Basic Info */}
              <ViewSection title="Service Information">
                <ViewGrid>
                  <ViewField label="Service Type" value={selectedVendor.service_type} />
                  <ViewField label="Vendor Type">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${selectedVendor.vendor_type === 'own' ? 'bg-warm-accent-soft text-warm-accent-hover' : 'bg-warm-section text-warm-muted'}`}>
                      {selectedVendor.vendor_type === 'own' ? 'My Vendor' : 'Assigned'}
                    </span>
                  </ViewField>
                </ViewGrid>
              </ViewSection>

              {/* Location */}
              <ViewSection title="Location">
                <ViewGrid>
                  <ViewField label="Zone" value={selectedVendor.zone_name || selectedVendor.zone} />
                  <ViewField label="Area" value={selectedVendor.area || selectedVendor.area_name} />
                </ViewGrid>
              </ViewSection>

              {/* Coverage & Working Hours */}
              <ViewSection title="Coverage & Working Hours">
                <ViewGrid>
                  <ViewField label="Coverage Per Day" value={selectedVendor.coverage_per_day || 0} />
                  <ViewField label="Working Hours" valueClassName="text-warm-accent-hover" value={selectedVendor.working_hours_from && selectedVendor.working_hours_to ? `${selectedVendor.working_hours_from} - ${selectedVendor.working_hours_to}` : '-'} />
                </ViewGrid>
              </ViewSection>

              {/* Vendor Details */}
              <ViewSection title="Vendor Details">
                <ViewGrid>
                  <ViewField label="Name" value={selectedVendor.owner_name || selectedVendor.company_name} />
                  <ViewField label="Mobile" value={(() => { const mobile = selectedVendor.owner_mobile || selectedVendor.phone || '-'; return mobile.startsWith('+') ? mobile : `${selectedVendor.owner_country_code || '+91'} ${mobile}`; })()} />
                  <ViewField label="Email" value={selectedVendor.owner_email || selectedVendor.email} />
                  <ViewField label="Aadhar" value={selectedVendor.owner_aadhar} />
                </ViewGrid>
              </ViewSection>

              {/* Manager Details */}
              {(selectedVendor.manager_name || selectedVendor.manager_mobile) && (
                <ViewSection title="Manager / Primary Contact">
                  <ViewGrid>
                    <ViewField label="Name" value={selectedVendor.manager_name} />
                    <ViewField label="Mobile" value={`${selectedVendor.manager_country_code || '+91'} ${selectedVendor.manager_mobile || '-'}`} />
                    <ViewField label="Email" value={selectedVendor.manager_email} className="sm:col-span-2" />
                  </ViewGrid>
                </ViewSection>
              )}

              {/* POC Details */}
              {(selectedVendor.poc_name || selectedVendor.poc_mobile) && (
                <ViewSection title="Point of Contact">
                  <ViewGrid>
                    <ViewField label="Name" value={selectedVendor.poc_name} />
                    <ViewField label="Mobile" value={`${selectedVendor.poc_country_code || '+91'} ${selectedVendor.poc_mobile || '-'}`} />
                    <ViewField label="Email" value={selectedVendor.poc_email} className="sm:col-span-2" />
                  </ViewGrid>
                </ViewSection>
              )}
        </ViewModal>
      )}
    </div>
  );
};

export default ExecutiveVendors;
