import { useState, useEffect } from 'react';
import {
  Archive, RotateCcw, Trash2, Eye, X, Calendar, Building2, User,
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase
} from 'lucide-react';
import { calculateEstimateTotal } from '../../utils/estimateStore';

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

const API_BASE = import.meta.env.VITE_API_URL || '';

const ArchivedEstimates = ({ admin, onRefresh, showToast, selectedFp }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  const token = sessionStorage.getItem('pm_auth_token');
  
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedFp?.id]);

  const loadData = async () => {
    try {
      let url;
      // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
      if (selectedFp?.id === 'all') {
        url = `${API_BASE}/api/admin/all-estimates?archived=true`;
      } else if (selectedFp?.id) {
        url = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/estimates?archived=true`;
      } else {
        // Fallback to default
        const response = await fetch('/api/estimates-sync?archived=true');
        const result = await response.json();
        if (result.success) {
          setArchivedEstimates(result.data || []);
        }
        return;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setArchivedEstimates(result.data || []);
      } else {
        setArchivedEstimates([]);
      }
    } catch (error) {
      console.error('Load archived estimates error:', error);
    }
  };

  const handleRestoreEstimate = async (estimateId) => {
    try {
      const response = await fetch(`/api/estimates-sync/${estimateId}/restore`, { method: 'PUT' });
      const result = await response.json();
      if (result.success) {
        showToast('Estimate restored');
        loadData();
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      showToast('Failed to restore estimate', 'error');
    }
  };

  const handleDeletePermanent = async (estimateId) => {
    try {
      const response = await fetch(`/api/estimates-sync/${estimateId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        showToast('Estimate deleted permanently');
        loadData();
        setDeleteConfirm(null);
      }
    } catch (error) {
      showToast('Failed to delete estimate', 'error');
    }
  };

  const handleDeleteAllArchived = async () => {
    try {
      const response = await fetch('/api/estimates-sync/archived/delete-all', { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        showToast(`${result.deletedCount || archivedEstimates.length} archived estimates deleted`);
        loadData();
        setShowDeleteAllConfirm(false);
        if (onRefresh) onRefresh();
      } else {
        showToast(result.message || 'Failed to delete', 'error');
      }
    } catch (error) {
      showToast('Failed to delete all archived estimates', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Delete All button */}
      {archivedEstimates.length > 0 && !isOpsManager && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Delete All ({archivedEstimates.length})
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {archivedEstimates.length === 0 ? (
          <div className="p-12 text-center">
            <Archive className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No archived estimates</p>
            <p className="text-sm text-gray-400">Archived estimates will appear here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estimate ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived On</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {archivedEstimates.map((estimate) => {
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
                        {estimate.archivedAt 
                          ? new Date(estimate.archivedAt).toLocaleDateString()
                          : new Date(estimate.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">
                        ₹{(estimate.totalPrice || calculateEstimateTotal(estimate)).toLocaleString()}
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
                        {/* Restore/Delete buttons - Hidden for Operations Manager */}
                        {!isOpsManager && (
                          <>
                            <button
                              onClick={() => handleRestoreEstimate(estimate.estimateId)}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                              title="Restore"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(estimate)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Permanently"
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
        )}
      </div>

      {/* View Estimate Modal */}
      {viewEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Archived Estimate Details</h3>
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
                  <p className="text-sm text-gray-500">Archived On</p>
                  <p className="font-medium">
                    {viewEstimate.archivedAt 
                      ? new Date(viewEstimate.archivedAt).toLocaleDateString()
                      : new Date(viewEstimate.createdAt).toLocaleDateString()}
                  </p>
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
                  {viewEstimate.propertyId && (
                    <p className="text-sm text-gray-500">ID: {viewEstimate.propertyId}</p>
                  )}
                  {/* GC-specific fields */}
                  {['GC', 'gated_community', 'Gated Community'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (
                    <>
                      {(viewEstimate.numberOfBlocks || viewEstimate.number_of_blocks) && <p className="text-sm text-gray-600">🏗️ Blocks: {viewEstimate.numberOfBlocks || viewEstimate.number_of_blocks}</p>}
                      {(viewEstimate.totalUnits || viewEstimate.total_units) && <p className="text-sm text-gray-600">🔢 Total Units: {viewEstimate.totalUnits || viewEstimate.total_units}</p>}
                    </>
                  )}
                  {/* Apartment-specific fields */}
                  {['APT', 'Apt', 'apartment', 'Apartment'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (
                    <>
                      {(viewEstimate.towerName || viewEstimate.tower_name) && <p className="text-sm text-gray-600">🏢 Tower: {viewEstimate.towerName || viewEstimate.tower_name}</p>}
                      {(viewEstimate.blockNumber || viewEstimate.block_number) && <p className="text-sm text-gray-600">🔤 Block: {viewEstimate.blockNumber || viewEstimate.block_number}</p>}
                      {(viewEstimate.totalUnits || viewEstimate.total_units) && <p className="text-sm text-gray-600">🔢 Units: {viewEstimate.totalUnits || viewEstimate.total_units}</p>}
                    </>
                  )}
                  {/* Villa/Plot-specific */}
                  {['VILLA', 'Villa', 'villa', 'PLOT', 'Plot', 'plot'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (viewEstimate.villaPlotNumber || viewEstimate.villa_plot_number) && (
                    <p className="text-sm text-gray-600">🏡 Villa/Plot #: {viewEstimate.villaPlotNumber || viewEstimate.villa_plot_number}</p>
                  )}
                </div>
              </div>

              {/* AMC Package */}
              {(viewEstimate.packageName || viewEstimate.package_name) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">AMC Package</p>
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-indigo-900">{viewEstimate.packageName || viewEstimate.package_name}</p>
                        <p className="text-xs text-indigo-600">Yearly Billing</p>
                      </div>
                      <p className="text-lg font-bold text-indigo-700">₹{Number(viewEstimate.packagePrice || viewEstimate.package_price || 0).toLocaleString()}</p>
                    </div>
                    {(viewEstimate.amc_package_description || viewEstimate.amcPackageDescription) && (
                      <p className="text-sm text-indigo-700 mt-2 pt-2 border-t border-indigo-100">{viewEstimate.amc_package_description || viewEstimate.amcPackageDescription}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Package Services - Horizontal Table */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-500 mb-2">Services / Package</p>
                {viewEstimate.package_services && (() => {
                  const services = typeof viewEstimate.package_services === 'string' ? JSON.parse(viewEstimate.package_services) : viewEstimate.package_services;
                  if (!services || services.length === 0) return <p className="text-gray-400 text-sm">No services listed</p>;
                  return (
                    <div>
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-indigo-100 rounded-t-lg">
                        <div className="col-span-1 text-xs font-semibold text-indigo-700">#</div>
                        <div className="col-span-3 text-xs font-semibold text-indigo-700">Service</div>
                        <div className="col-span-5 text-xs font-semibold text-indigo-700">Description</div>
                        <div className="col-span-2 text-xs font-semibold text-indigo-700 text-center">Frequency</div>
                        <div className="col-span-1 text-xs font-semibold text-indigo-700 text-right">Visits</div>
                      </div>
                      <div className="border border-indigo-100 rounded-b-lg divide-y divide-indigo-50">
                        {services.map((service, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                            <div className="col-span-1">
                              <span className="w-5 h-5 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-gray-800 text-sm">{service.name || service.service}</p>
                            </div>
                            <div className="col-span-5">
                              <p className="text-xs text-gray-500 break-words whitespace-normal">{service.description || '-'}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <p className="text-sm text-indigo-600">{service.frequencyType || 'Monthly'}</p>
                            </div>
                            <div className="col-span-1 text-right">
                              <p className="text-sm text-indigo-700 font-semibold">{service.frequencyCount || 1}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {!viewEstimate.package_services && (
                  <p className="text-gray-400 text-sm">No services listed</p>
                )}
              </div>

              {/* Add-ons - Horizontal Table */}
              {viewEstimate.addons?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">Add-ons</p>
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
                        const addonName = addon.name || addon.serviceName || addon.service_name || 'Add-on';
                        const frequencyCount = addon.frequency_count || addon.frequencyCount || 1;
                        const frequencyType = addon.frequency_type || addon.frequencyType || 'Monthly';
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                            <div className="col-span-1">
                              <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-gray-800 text-sm">{addonName}</p>
                            </div>
                            <div className="col-span-5">
                              <p className="text-xs text-gray-500 break-words whitespace-normal">{addon.description || '-'}</p>
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
                      <p className="font-bold text-green-700">₹{viewEstimate.addons.reduce((sum, a) => sum + Number(a.price || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
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

              <div className="border-t border-gray-100 pt-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    handleRestoreEstimate(viewEstimate.estimateId);
                    setViewEstimate(null);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore Estimate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md m-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Permanently?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete estimate <strong>{deleteConfirm.estimateId}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePermanent(deleteConfirm.estimateId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md m-4">
            <h3 className="text-lg font-semibold text-red-600 mb-2">⚠️ Delete All Archived Estimates?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete <strong>all {archivedEstimates.length} archived estimates</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllArchived}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete All Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivedEstimates;
