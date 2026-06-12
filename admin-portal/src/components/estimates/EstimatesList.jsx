import { useState } from 'react';
import {
  Search, Filter, Eye, Edit, Download, Send, Trash2, X, ChevronDown,
  Calendar, DollarSign, Building2, User, Home, LayoutGrid, Layers,
  TreePine, Map, Briefcase
} from 'lucide-react';
import {
  searchEstimates, updateEstimate, deleteEstimate, calculateEstimateTotal,
  PROPERTY_TYPES, ESTIMATE_STATUSES
} from '../../utils/estimateStore';
import { exportEstimateToPDF } from '../../utils/pdfExport';

const PROPERTY_ICONS = {
  APT: Home,
  Flats: LayoutGrid,
  GC: Layers,
  Villas: TreePine,
  Plots: Map,
  Commercial: Briefcase
};

const STATUS_STYLES = {
  Draft: 'bg-gray-100 text-gray-700',
  draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  sent: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  Expired: 'bg-orange-100 text-orange-700',
  expired: 'bg-orange-100 text-orange-700',
  Archived: 'bg-slate-100 text-slate-700',
  archived: 'bg-slate-100 text-slate-700'
};

const EstimatesList = ({ admin, estimates = [], onRefresh, showToast }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const [filters, setFilters] = useState({
    estimateType: 'all',
    status: 'all',
    propertyType: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter estimates based on search and filters
  const filteredEstimates = estimates.filter(est => {
    const search = searchTerm.toLowerCase();
    const matchSearch = !search || 
      est.estimateId?.toLowerCase().includes(search) ||
      est.customerName?.toLowerCase().includes(search) ||
      est.propertyName?.toLowerCase().includes(search);
    const matchType = filters.estimateType === 'all' || est.estimateType === filters.estimateType;
    const matchStatus = filters.status === 'all' || est.status === filters.status;
    const matchProperty = filters.propertyType === 'all' || est.propertyType === filters.propertyType;
    
    // Date filtering
    const estDate = new Date(est.createdAt);
    const matchFromDate = !filters.dateFrom || estDate >= new Date(filters.dateFrom);
    const matchToDate = !filters.dateTo || estDate <= new Date(filters.dateTo + 'T23:59:59');
    
    return matchSearch && matchType && matchStatus && matchProperty && matchFromDate && matchToDate;
  });

  const handleSendEstimate = async (estimate) => {
    try {
      const response = await fetch(`/api/estimates-sync/${estimate.estimateId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.success) {
        showToast(`Estimate sent to ${result.email}`);
        onRefresh();
      } else {
        showToast(result.message || 'Failed to send estimate', 'error');
      }
    } catch (error) {
      console.error('Send estimate error:', error);
      showToast('Failed to send estimate', 'error');
    }
  };

  const handleArchiveEstimate = async (estimateId) => {
    try {
      const response = await fetch(`/api/estimates-sync/${estimateId}/archive`, { method: 'PUT' });
      const result = await response.json();
      if (result.success) {
        showToast('Estimate archived');
        onRefresh();
      }
    } catch (error) {
      showToast('Failed to archive', 'error');
    }
    setDeleteConfirm(null);
  };

  const handleDownloadPDF = (e, estimate) => {
    e.stopPropagation();
    e.preventDefault();
    if (exportingId) return;
    setExportingId(estimate.estimateId || estimate.estimate_id);
    showToast('Generating PDF...');
    
    setTimeout(() => {
      try {
        // Parse addons from multiple possible sources (same as FP portal)
        let addonsArray = [];
        if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
          addonsArray = estimate.addons;
        } else if (estimate.addons_data) {
          try {
            const parsed = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
            if (Array.isArray(parsed)) addonsArray = parsed;
          } catch (e) { console.log('Addon parse error:', e); }
        }
        
        // Parse AMC package services from backend
        let servicesArray = [];
        if (estimate.packageServices) {
          try {
            const parsed = typeof estimate.packageServices === 'string' ? JSON.parse(estimate.packageServices) : estimate.packageServices;
            if (Array.isArray(parsed) && parsed.length > 0) {
              servicesArray = parsed.map(s => ({
                name: s.service || s.name || 'Service',
                frequencyCount: s.frequencyCount || s.frequency || 1,
                frequencyType: s.frequencyType || 'Monthly'
              }));
            }
          } catch (e) { console.log('Package services parse error:', e); }
        }
        
        // Fallback to package name if no services found
        if (servicesArray.length === 0 && (estimate.packageName || estimate.package_name)) {
          servicesArray = [{
            name: estimate.packageName || estimate.package_name,
            frequencyCount: 1,
            frequencyType: 'Yearly'
          }];
        }
        
        // Prepare estimate data for PDF (same mapping as FP portal)
        const pdfData = {
          ...estimate,
          estimateId: estimate.estimateId || estimate.estimate_id,
          estimateType: estimate.estimateType || estimate.estimate_type,
          propertyId: estimate.propertyId || estimate.property_code || estimate.property_id,
          propertyType: estimate.propertyType || estimate.property_type,
          propertyName: estimate.propertyName || estimate.property_name,
          communityName: estimate.communityName || estimate.property_name,
          zone: estimate.zone,
          division: estimate.division || '',
          city: estimate.city,
          customerName: estimate.customerName || estimate.clientName || estimate.client_name,
          customerPhone: estimate.customerPhone || estimate.phone || estimate.client_phone,
          customerEmail: estimate.customerEmail || estimate.email || estimate.client_email,
          address: estimate.address || estimate.propertyAddress,
          packageName: estimate.packageName || estimate.package_name,
          billingDuration: estimate.billingDuration || 'Yearly',
          subtotal: parseFloat(estimate.subtotal) || 0,
          totalPrice: parseFloat(estimate.totalPrice || estimate.total || estimate.total_amount) || 0,
          discount: parseFloat(estimate.discount || estimate.discount_percent) || 0,
          description: estimate.description || estimate.notes || '',
          services: servicesArray,
          addons: addonsArray.map(a => ({
            name: a.name || a.service_name || a.serviceName || 'Add-on',
            price: parseFloat(a.price) || 0,
            frequencyType: a.frequency_type || a.frequencyType || 'One-time',
            frequency: a.frequency_count || a.frequencyCount || 1
          }))
        };
        
        const success = exportEstimateToPDF(pdfData);
        if (success) {
          showToast('PDF downloaded successfully!');
        }
      } catch (err) {
        console.error('PDF Error:', err);
      } finally {
        setExportingId(null);
      }
    }, 100);
  };

  const clearFilters = () => {
    setFilters({
      estimateType: 'all',
      status: 'all',
      propertyType: 'all',
      dateFrom: '',
      dateTo: ''
    });
    setSearchTerm('');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search estimates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              showFilters ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimate Type</label>
                <select
                  value={filters.estimateType}
                  onChange={(e) => setFilters({ ...filters, estimateType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Estimates</option>
                  <option value="property-based">Property ID Based</option>
                  <option value="direct">Direct Estimate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Statuses</option>
                  {ESTIMATE_STATUSES.filter(s => s !== 'Archived').map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Property Category</label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {PROPERTY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Estimates List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredEstimates.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No estimates found</p>
            <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Estimate ID</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden sm:table-cell">Type</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Client</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden md:table-cell">Date</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Total</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden lg:table-cell">Status</th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEstimates.map((estimate) => {
                const Icon = PROPERTY_ICONS[estimate.propertyType] || (estimate.estimateType === 'direct' ? User : Building2);
                return (
                  <tr key={estimate.estimateId} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="font-medium text-gray-800 text-xs sm:text-sm">{estimate.estimateId}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm whitespace-nowrap px-2 py-0.5 rounded ${
                          estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId 
                            ? 'Property' 
                            : 'Direct'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <p className="text-xs sm:text-sm text-gray-800 truncate max-w-[100px] sm:max-w-none">
                        {estimate.clientName || estimate.customerName}
                      </p>
                      {estimate.propertyId && (
                        <p className="text-xs text-gray-500 truncate">{estimate.propertyId}</p>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                        <Calendar className="w-4 h-4" />
                        {new Date(estimate.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="font-semibold text-gray-800 text-xs sm:text-sm whitespace-nowrap">
                        ₹{(estimate.totalPrice || calculateEstimateTotal(estimate)).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[estimate.status] || 'bg-gray-100 text-gray-700'}`}>
                        {estimate.status?.charAt(0).toUpperCase() + estimate.status?.slice(1) || 'Draft'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewEstimate(estimate)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* All other actions hidden for Operations Manager */}
                        {!isOpsManager && (
                          <>
                            {/* Download PDF */}
                            <button
                              onClick={(e) => handleDownloadPDF(e, estimate)}
                              disabled={exportingId === estimate.estimateId}
                              className={`p-2 rounded-lg ${exportingId === estimate.estimateId ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {/* Archive */}
                            <button
                              onClick={() => setDeleteConfirm(estimate)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Archive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* View Estimate Modal */}
      {viewEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">Estimate Details</h3>
              <button onClick={() => setViewEstimate(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div><p className="text-xs text-gray-500">Estimate ID</p><p className="font-medium text-sm">{viewEstimate.estimateId || viewEstimate.estimate_id}</p></div>
                <div><p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[viewEstimate.status] || 'bg-gray-100 text-gray-700'}`}>{viewEstimate.status?.charAt(0).toUpperCase() + viewEstimate.status?.slice(1) || 'Draft'}</span>
                </div>
                <div><p className="text-xs text-gray-500">Type</p><p className="font-medium text-sm capitalize">{(viewEstimate.estimateType || viewEstimate.estimate_type)?.replace('_', ' ') || '-'}</p></div>
                <div><p className="text-xs text-gray-500">Created</p><p className="font-medium text-sm">{new Date(viewEstimate.createdAt || viewEstimate.created_at).toLocaleDateString()}</p></div>
              </div>

              {/* Property Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p>
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Property ID</p><p className="font-medium text-sm">{viewEstimate.propertyId || viewEstimate.property_code || viewEstimate.property_id || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Name</p><p className="font-medium text-sm">{viewEstimate.propertyName || viewEstimate.property_name || viewEstimate.communityName || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Type</p><p className="font-medium text-sm">{viewEstimate.propertyType || viewEstimate.property_type || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Zone</p><p className="font-medium text-sm">{viewEstimate.zone || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Division</p><p className="font-medium text-sm">{viewEstimate.division || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">City</p><p className="font-medium text-sm">{viewEstimate.city || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="font-medium text-sm">{viewEstimate.propertyAddress || viewEstimate.address || '-'}</p></div>
                  {/* GC-specific: Number of Blocks, Block Names, Units per Block */}
                  {['GC', 'gated_community', 'Gated Community'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (
                    <>
                      <div><p className="text-xs text-gray-500">Number of Blocks</p><p className="font-medium text-sm">{viewEstimate.numberOfBlocks || viewEstimate.number_of_blocks || '-'}</p></div>
                      <div><p className="text-xs text-gray-500">Total Units</p><p className="font-medium text-sm">{viewEstimate.totalUnits || viewEstimate.total_units || '-'}</p></div>
                      {(() => {
                        const bn = viewEstimate.blockNames || viewEstimate.block_names;
                        const upb = viewEstimate.unitsPerBlock || viewEstimate.units_per_block;
                        const blockNames = bn ? (typeof bn === 'string' ? JSON.parse(bn) : bn) : {};
                        const unitsPerBlock = upb ? (typeof upb === 'string' ? JSON.parse(upb) : upb) : {};
                        const hasBlockData = Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0;
                        if (!hasBlockData) return null;
                        return (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-gray-500 mb-2">Block Details</p>
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.keys(blockNames).length > 0 ? Object.entries(blockNames).map(([key, name]) => (
                                  <div key={key} className="bg-white p-2 rounded border border-blue-100">
                                    <p className="text-xs text-blue-600 font-medium">{name || `Block ${key}`}</p>
                                    <p className="text-sm text-gray-700">{unitsPerBlock[key] || 0} units</p>
                                  </div>
                                )) : Object.entries(unitsPerBlock).map(([key, units]) => (
                                  <div key={key} className="bg-white p-2 rounded border border-blue-100">
                                    <p className="text-xs text-blue-600 font-medium">Block {key}</p>
                                    <p className="text-sm text-gray-700">{units || 0} units</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {/* Apartment-specific fields */}
                  {['APT', 'Apt', 'apartment', 'Apartment'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (
                    <>
                      {(viewEstimate.towerName || viewEstimate.tower_name) && <div><p className="text-xs text-gray-500">Tower/Building Name</p><p className="font-medium text-sm">{viewEstimate.towerName || viewEstimate.tower_name}</p></div>}
                      {(viewEstimate.blockNumber || viewEstimate.block_number) && <div><p className="text-xs text-gray-500">Block Number</p><p className="font-medium text-sm">{viewEstimate.blockNumber || viewEstimate.block_number}</p></div>}
                      <div><p className="text-xs text-gray-500">Number of Units</p><p className="font-medium text-sm">{viewEstimate.totalUnits || viewEstimate.total_units || '-'}</p></div>
                    </>
                  )}
                  {/* Villa/Plot-specific fields */}
                  {['VILLA', 'Villa', 'villa', 'PLOT', 'Plot', 'plot'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (viewEstimate.villaPlotNumber || viewEstimate.villa_plot_number) && (
                    <div><p className="text-xs text-gray-500">Villa/Plot Number</p><p className="font-medium text-sm">{viewEstimate.villaPlotNumber || viewEstimate.villa_plot_number}</p></div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p>
                <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Contact Name</p><p className="font-medium text-sm">{viewEstimate.customerName || viewEstimate.clientName || viewEstimate.client_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Phone</p><p className="font-medium text-sm">{viewEstimate.customerPhone || viewEstimate.phone || viewEstimate.client_phone || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium text-sm">{viewEstimate.customerEmail || viewEstimate.email || viewEstimate.client_email || '-'}</p></div>
                </div>
              </div>

              {/* AMC Package */}
              {(viewEstimate.amcPackage || viewEstimate.packageName || viewEstimate.package_name) && (() => {
                // Get package description from various sources
                const pkgDescription = viewEstimate.amc_package_description || viewEstimate.amcPackageDescription || viewEstimate.amcPackage?.description || '';
                // Get services from various sources
                let pkgServices = [];
                if (viewEstimate.package_services) {
                  pkgServices = typeof viewEstimate.package_services === 'string' ? JSON.parse(viewEstimate.package_services) : viewEstimate.package_services;
                } else if (viewEstimate.packageServices) {
                  const svc = typeof viewEstimate.packageServices === 'string' ? JSON.parse(viewEstimate.packageServices) : viewEstimate.packageServices;
                  pkgServices = svc?.serviceRows || svc?.services || svc || [];
                } else if (viewEstimate.amcPackage?.serviceRows) {
                  pkgServices = viewEstimate.amcPackage.serviceRows;
                }
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p>
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-indigo-900">{viewEstimate.amcPackage?.packageName || viewEstimate.amcPackage?.name || viewEstimate.packageName || viewEstimate.package_name || 'AMC Package'}</p>
                          <p className="text-xs text-indigo-600">{viewEstimate.amcPackage?.billingDuration || viewEstimate.billingDuration || 'Yearly'} Billing</p>
                        </div>
                        <p className="text-lg font-bold text-indigo-700">₹{Number(viewEstimate.amcPackage?.rate || viewEstimate.amcPackage?.totalRate || viewEstimate.amcPrice || viewEstimate.packagePrice || viewEstimate.package_price || viewEstimate.subtotal || 0).toLocaleString()}</p>
                      </div>
                      {pkgDescription && (
                        <p className="text-sm text-indigo-700 mt-2 pt-2 border-t border-indigo-100">{pkgDescription}</p>
                      )}
                    </div>
                    {/* Package Services - Horizontal Table */}
                    {pkgServices.length > 0 && (
                      <div className="mt-3">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-indigo-100 rounded-t-lg">
                          <div className="col-span-1 text-xs font-semibold text-indigo-700">#</div>
                          <div className="col-span-3 text-xs font-semibold text-indigo-700">Service</div>
                          <div className="col-span-5 text-xs font-semibold text-indigo-700">Description</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-center">Frequency</div>
                          <div className="col-span-1 text-xs font-semibold text-indigo-700 text-right">Visits</div>
                        </div>
                        <div className="border border-indigo-100 rounded-b-lg divide-y divide-indigo-50">
                          {pkgServices.map((svc, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                              <div className="col-span-1">
                                <span className="w-5 h-5 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                              </div>
                              <div className="col-span-3">
                                <p className="font-medium text-gray-800 text-sm">{svc.name || svc.service}</p>
                              </div>
                              <div className="col-span-5">
                                <p className={`text-xs text-gray-500 break-words whitespace-normal ${!svc.description ? 'text-center' : ''}`}>{svc.description || '-'}</p>
                              </div>
                              <div className="col-span-2 text-center">
                                <p className="text-sm text-indigo-600">{svc.frequencyType || svc.frequency_type || 'Monthly'}</p>
                              </div>
                              <div className="col-span-1 text-right">
                                <p className="text-sm text-indigo-700 font-semibold">{svc.frequencyCount || svc.frequency_count || 1}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Services */}
              {viewEstimate.services?.length > 0 && !viewEstimate.amcPackage && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Services</p>
                  <div className="space-y-2">
                    {viewEstimate.services.map((service, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <div>
                          <p className="font-medium">{service.name || service.service || service.serviceName || 'Service'}</p>
                          {(service.frequency || service.frequencyCount) && service.frequencyType && (
                            <p className="text-xs text-gray-500">{service.frequencyType} - {service.frequency || service.frequencyCount} visits</p>
                          )}
                        </div>
                        <p className="font-semibold">₹{Number(service.price || service.rate || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons - Horizontal Table */}
              {viewEstimate.addons?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add-on Services</p>
                  <div>
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-green-100 rounded-t-lg">
                      <div className="col-span-1 text-xs font-semibold text-green-700">#</div>
                      <div className="col-span-3 text-xs font-semibold text-green-700">Service</div>
                      <div className="col-span-5 text-xs font-semibold text-green-700">Description</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-center">Frequency</div>
                      <div className="col-span-1 text-xs font-semibold text-green-700 text-right">Visits</div>
                    </div>
                    <div className="border border-green-100 divide-y divide-green-50">
                      {viewEstimate.addons.map((addon, idx) => {
                        const addonName = typeof addon === 'number' ? `Add-on ${idx + 1}` : (addon.name || addon.serviceName || addon.service_name || `Add-on ${idx + 1}`);
                        const frequencyCount = typeof addon === 'object' ? (addon.frequency_count || addon.frequencyCount || 1) : 1;
                        const frequencyType = typeof addon === 'object' ? (addon.frequencyType || addon.frequency_type || 'Monthly') : 'Monthly';
                        const addonDesc = typeof addon === 'object' ? (addon.description || '') : '';
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                            <div className="col-span-1">
                              <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-gray-800 text-sm">{addonName}</p>
                            </div>
                            <div className="col-span-5">
                              <p className={`text-xs text-gray-500 break-words whitespace-normal ${!addonDesc ? 'text-center' : ''}`}>{addonDesc || '-'}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <p className="text-sm text-green-600">{frequencyType}</p>
                            </div>
                            <div className="col-span-1 text-right">
                              <p className="text-sm text-green-700 font-semibold">{frequencyCount}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center bg-green-100 p-3 rounded-b-lg">
                      <p className="font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">₹{viewEstimate.addons.reduce((sum, a) => sum + Number(typeof a === 'number' ? a : (a.price || 0)), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Summary */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Price Summary</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>₹{Number(viewEstimate.subtotal || viewEstimate.package_price || 0).toLocaleString()}</span></div>
                  {(viewEstimate.discount > 0 || viewEstimate.discount_amount > 0) && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-₹{Number(viewEstimate.discount || viewEstimate.discount_amount || 0).toLocaleString()}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({viewEstimate.gst_percent || 0}%)</span><span>₹{Number(viewEstimate.tax || viewEstimate.gst || viewEstimate.gst_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-indigo-600">₹{Number(viewEstimate.total || viewEstimate.totalPrice || viewEstimate.total_amount || calculateEstimateTotal(viewEstimate) || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Description / Notes - After Price Summary */}
              {(viewEstimate.notes || viewEstimate.description) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Description / Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewEstimate.notes || viewEstimate.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md m-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Archive Estimate?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to archive estimate <strong>{deleteConfirm.estimateId || deleteConfirm.estimate_id}</strong>? 
              You can restore it later from the Archived tab.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchiveEstimate(deleteConfirm.estimateId || deleteConfirm.estimate_id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimatesList;
