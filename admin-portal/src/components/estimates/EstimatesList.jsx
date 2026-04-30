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

const EstimatesList = ({ onRefresh, showToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredEstimates = searchEstimates(searchTerm, filters);

  const handleSendEstimate = (estimate) => {
    updateEstimate(estimate.estimateId, { status: 'Sent' });
    showToast('Estimate sent!');
    onRefresh();
  };

  const handleArchiveEstimate = (estimateId) => {
    deleteEstimate(estimateId, false);
    showToast('Estimate archived');
    onRefresh();
    setDeleteConfirm(null);
  };

  const handleDownloadPDF = (estimate) => {
    const content = `ESTIMATE
${'='.repeat(40)}
Estimate ID: ${estimate.estimateId}
Type: ${estimate.estimateType}
Date: ${new Date(estimate.createdAt).toLocaleDateString()}
Status: ${estimate.status}

${estimate.estimateType === 'property-based' 
  ? `Property ID: ${estimate.propertyId}
Property Type: ${estimate.propertyType}
Client: ${estimate.clientName}
Community: ${estimate.communityName || 'N/A'}`
  : `Customer: ${estimate.customerName}
Phone: ${estimate.phone || 'N/A'}
Email: ${estimate.email || 'N/A'}`}

SERVICES
${'-'.repeat(40)}
${estimate.services?.map(s => 
  `${s.name} - Frequency: ${s.frequency} ${s.frequencyType} - Price: ₹${s.price}`
).join('\n')}

${'-'.repeat(40)}
TOTAL: ₹${estimate.totalPrice || calculateEstimateTotal(estimate)}
${'='.repeat(40)}
${estimate.notes ? `\nNotes: ${estimate.notes}` : ''}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${estimate.estimateId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Estimate downloaded');
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
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No estimates found</p>
            <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estimate ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEstimates.map((estimate) => {
                const Icon = PROPERTY_ICONS[estimate.propertyType] || (estimate.estimateType === 'direct' ? User : Building2);
                return (
                  <tr key={estimate.estimateId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-800">{estimate.estimateId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {estimate.estimateType === 'property-based' ? estimate.propertyType : 'Direct-Based'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-800">
                        {estimate.clientName || estimate.customerName}
                      </p>
                      {estimate.propertyId && (
                        <p className="text-xs text-gray-500">{estimate.propertyId}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(estimate.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">
                        ₹{(estimate.totalPrice || calculateEstimateTotal(estimate)).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[estimate.status]}`}>
                        {estimate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewEstimate(estimate)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(estimate)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {estimate.status === 'Draft' && (
                          <button
                            onClick={() => handleSendEstimate(estimate)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Send"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(estimate)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Archive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* View Estimate Modal */}
      {viewEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Estimate Details</h3>
              <button
                onClick={() => setViewEstimate(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
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
                {viewEstimate.estimateType === 'property-based' ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{viewEstimate.clientName}</p>
                    <p className="text-sm text-gray-600">{viewEstimate.propertyId} • {viewEstimate.propertyType}</p>
                    {viewEstimate.communityName && (
                      <p className="text-sm text-gray-600">{viewEstimate.communityName}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{viewEstimate.customerName}</p>
                    {viewEstimate.phone && <p className="text-sm text-gray-600">Phone: {viewEstimate.phone}</p>}
                    {viewEstimate.email && <p className="text-sm text-gray-600">Email: {viewEstimate.email}</p>}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Services</p>
                <div className="space-y-2">
                  {viewEstimate.services?.map((service, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-gray-500">{service.frequency} × {service.frequencyType}</p>
                      </div>
                      <p className="font-semibold">₹{Number(service.price).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {viewEstimate.notes && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">Notes</p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{viewEstimate.notes}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                <p className="text-lg font-semibold">Total</p>
                <p className="text-2xl font-bold text-indigo-600">
                  ₹{(viewEstimate.totalPrice || calculateEstimateTotal(viewEstimate)).toLocaleString()}
                </p>
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
