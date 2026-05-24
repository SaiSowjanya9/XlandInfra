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
  Sent: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Expired: 'bg-orange-100 text-orange-700',
  Archived: 'bg-slate-100 text-slate-700'
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
    return matchSearch && matchType && matchStatus && matchProperty;
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
    setExportingId(estimate.estimateId);
    showToast('Generating PDF...');
    
    setTimeout(() => {
      try {
        const success = exportEstimateToPDF(estimate);
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={filters.estimateType}
                  onChange={(e) => setFilters({ ...filters, estimateType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="property-based">Property-Based Estimate</option>
                  <option value="direct">Direct-Based Estimate</option>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Property Type</label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Properties</option>
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
                          estimate.estimateType === 'property-based' || estimate.propertyId 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {estimate.estimateType === 'property-based' || estimate.propertyId ? 'Property' : 'Direct'}
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[estimate.status]}`}>
                        {estimate.status}
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
                        {/* Download PDF - Available for all */}
                        <button
                          onClick={(e) => handleDownloadPDF(e, estimate)}
                          disabled={exportingId === estimate.estimateId}
                          className={`p-2 rounded-lg ${exportingId === estimate.estimateId ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {/* Send Email - Available for all */}
                        {estimate.status === 'Draft' && (
                          <button
                            onClick={() => handleSendEstimate(estimate)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Send Email"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {/* Archive - Hidden for Operations Manager */}
                        {!isOpsManager && (
                          <button
                            onClick={() => setDeleteConfirm(estimate)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Archive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">Estimate Details</h3>
              <button
                onClick={() => setViewEstimate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Estimate ID</p>
                  <p className="font-medium">{viewEstimate.estimateId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[viewEstimate.status]}`}>
                    {viewEstimate.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium capitalize">{viewEstimate.estimateType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium">{new Date(viewEstimate.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Client Information</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="font-medium text-lg">{viewEstimate.customerName || viewEstimate.clientName || 'N/A'}</p>
                  {(viewEstimate.customerPhone || viewEstimate.phone) && (
                    <p className="text-sm text-gray-600">📞 {viewEstimate.customerPhone || viewEstimate.phone}</p>
                  )}
                  {(viewEstimate.customerEmail || viewEstimate.email) && (
                    <p className="text-sm text-gray-600">✉️ {viewEstimate.customerEmail || viewEstimate.email}</p>
                  )}
                  {viewEstimate.propertyType && (
                    <p className="text-sm text-gray-600">🏠 Property Type: {viewEstimate.propertyType}</p>
                  )}
                  {viewEstimate.propertyName && (
                    <p className="text-sm text-gray-600">🏢 Property: {viewEstimate.propertyName}</p>
                  )}
                  {viewEstimate.propertyAddress && (
                    <p className="text-sm text-gray-600">📍 {viewEstimate.propertyAddress}</p>
                  )}
                  {viewEstimate.communityName && (
                    <p className="text-sm text-gray-600">🏘️ {viewEstimate.communityName}</p>
                  )}
                  {viewEstimate.propertyId && (
                    <p className="text-sm text-gray-500">ID: {viewEstimate.propertyId}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Services / Package</p>
                <div className="space-y-2">
                  {/* Show AMC Package if exists */}
                  {viewEstimate.amcPackage && (
                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-indigo-800">{viewEstimate.amcPackage.packageName || viewEstimate.amcPackage.name || 'AMC Package'}</p>
                          <p className="text-xs text-indigo-600">{viewEstimate.amcPackage.billingDuration || 'Monthly'} billing</p>
                        </div>
                        <p className="font-bold text-indigo-700">₹{Number(viewEstimate.amcPackage.rate || viewEstimate.amcPackage.totalRate || viewEstimate.amcPrice || 0).toLocaleString()}</p>
                      </div>
                      {/* Package Services */}
                      {viewEstimate.amcPackage.serviceRows?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-indigo-200 space-y-1">
                          {viewEstimate.amcPackage.serviceRows.map((svc, i) => (
                            <p key={i} className="text-xs text-indigo-600">• {svc.service} ({svc.frequencyCount}× {svc.frequencyType})</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Show individual services */}
                  {viewEstimate.services?.length > 0 ? viewEstimate.services.map((service, idx) => {
                    const serviceName = service.name || service.service || service.serviceName || 'Service';
                    const servicePrice = service.price || service.rate || 0;
                    const serviceFrequency = service.frequency || service.frequencyCount;
                    const serviceFrequencyType = service.frequencyType;
                    
                    return (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <div>
                          <p className="font-medium">{serviceName}</p>
                          {serviceFrequency && serviceFrequencyType && (
                            <p className="text-sm text-gray-500">{serviceFrequency}× {serviceFrequencyType}</p>
                          )}
                        </div>
                        <p className="font-semibold">₹{Number(servicePrice).toLocaleString()}</p>
                      </div>
                    );
                  }) : !viewEstimate.amcPackage && (
                    <p className="text-gray-400 text-sm">No services listed</p>
                  )}
                </div>
              </div>

              {/* Addons Section */}
              {viewEstimate.addons?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">Add-ons</p>
                  <div className="space-y-2">
                    {viewEstimate.addons.map((addon, idx) => {
                      // Handle different addon data structures including plain numbers
                      if (typeof addon === 'number') {
                        return (
                          <div key={idx} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                            <p className="font-medium text-blue-800">Add-on {idx + 1}</p>
                            <p className="font-semibold text-blue-700">₹{Number(addon).toLocaleString()}</p>
                          </div>
                        );
                      }
                      
                      // Get addon name from various possible structures
                      const addonName = addon.name || addon.serviceName || addon.service_name || 
                                       addon.services?.[0]?.name || addon.addonName || 
                                       addon.addon_name || `Add-on ${idx + 1}`;
                      const addonPrice = addon.price || addon.totalPrice || addon.total_price || 
                                        addon.services?.[0]?.price || addon.rate || 0;
                      const addonFrequency = addon.frequency || addon.frequencyCount || 
                                            addon.frequency_count || addon.services?.[0]?.frequency;
                      const addonFrequencyType = addon.frequencyType || addon.frequency_type || 
                                                addon.services?.[0]?.frequencyType;
                      
                      return (
                        <div key={idx} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                          <div>
                            <p className="font-medium text-blue-800">{addonName}</p>
                            {addonFrequency && addonFrequencyType && (
                              <p className="text-xs text-blue-600">{addonFrequency}× {addonFrequencyType}</p>
                            )}
                          </div>
                          <p className="font-semibold text-blue-700">₹{Number(addonPrice).toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {viewEstimate.notes && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">Notes</p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{viewEstimate.notes}</p>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                {viewEstimate.subtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>₹{Number(viewEstimate.subtotal).toLocaleString()}</span>
                  </div>
                )}
                {viewEstimate.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-₹{Number(viewEstimate.discount).toLocaleString()}</span>
                  </div>
                )}
                {viewEstimate.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax (GST)</span>
                    <span>₹{Number(viewEstimate.tax).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t">
                  <p className="text-lg font-semibold">Total</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    ₹{Number(viewEstimate.total || viewEstimate.totalPrice || calculateEstimateTotal(viewEstimate) || 0).toLocaleString()}
                  </p>
                </div>
              </div>
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
              Are you sure you want to archive estimate <strong>{deleteConfirm.estimateId}</strong>? 
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
                onClick={() => handleArchiveEstimate(deleteConfirm.estimateId)}
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
