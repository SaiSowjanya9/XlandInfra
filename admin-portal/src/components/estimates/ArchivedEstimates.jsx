import { useState, useEffect } from 'react';
import {
  Archive, RotateCcw, Trash2, Eye, X, Calendar, Building2, User,
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase
} from 'lucide-react';
import {
  getArchivedEstimates, restoreEstimate, deleteEstimate, calculateEstimateTotal
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

const ArchivedEstimates = ({ onRefresh, showToast }) => {
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setArchivedEstimates(getArchivedEstimates());
  };

  const handleRestoreEstimate = (estimateId) => {
    restoreEstimate(estimateId);
    showToast('Estimate restored');
    loadData();
    if (onRefresh) onRefresh();
  };

  const handleDeletePermanent = (estimateId) => {
    deleteEstimate(estimateId, true);
    showToast('Estimate deleted permanently');
    loadData();
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
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
                          {estimate.estimateType === 'property-based' ? estimate.propertyType : 'Direct'}
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        estimate.autoArchived ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {estimate.autoArchived ? 'Auto-archived (30 days)' : 'Manual'}
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

              <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                <p className="text-lg font-semibold">Total</p>
                <p className="text-2xl font-bold text-indigo-600">
                  ₹{(viewEstimate.totalPrice || calculateEstimateTotal(viewEstimate)).toLocaleString()}
                </p>
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
    </div>
  );
};

export default ArchivedEstimates;
