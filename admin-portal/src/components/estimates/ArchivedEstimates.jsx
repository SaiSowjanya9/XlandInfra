import { Fragment, useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/safeStorage';
import {
  Archive, RotateCcw, Trash2, X, Calendar, Building2, User, ChevronDown,
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase, ArrowLeft, Download, Printer
} from 'lucide-react';
import { calculateEstimateTotal } from '../../utils/estimateStore';
import { exportEstimateToPDF, printEstimatePDF } from '../../utils/pdfExport';
import { useEstimatePrint } from '../../utils/useEstimatePrint';
import EstimateDetailPanel from './EstimateDetailPanel';

// Decode HTML entities (e.g., &amp; -> &)
const decodeHtml = (html) => {
  if (html == null) return '';
  // Never hand a non-string to JSX: React throws #31 and the whole page goes blank
  if (typeof html !== 'string') return typeof html === 'number' || typeof html === 'boolean' ? String(html) : '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

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
  const token = getAuthToken();
  
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  // Which estimate is expanded in place; the ID opens it, which is what replaced the view modal
  // Which estimate is open full screen. Clicking its ID leaves the list for the document.
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

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
        const response = await fetch(`${API_BASE}/api/estimates-sync?archived=true`, { headers: { Authorization: `Bearer ${token}` } });
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
      const response = await fetch(`${API_BASE}/api/estimates-sync/${estimateId}/restore`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
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
      const response = await fetch(`${API_BASE}/api/estimates-sync/archived/${estimateId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
      const response = await fetch(`${API_BASE}/api/estimates-sync/archived/delete-all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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

  // An estimate opened from the list leaves the list entirely: the document takes the whole
  // area, and Back returns to the archived list.
  const detailEstimate = expandedId ? archivedEstimates.find(e => e.estimateId === expandedId) || null : null;

  // Resolve a stored estimate to the PDF's data -- the download and the document print share it.
  // The exporter already understands snake_case fields; only package services need unwrapping,
  // since they may live under services_data as the package's service rows.
  const buildEstimatePdfData = (estimate) => {
    let packageServices = [];
    for (const source of [estimate.package_services, estimate.packageServices, estimate.services_data]) {
      if (!source) continue;
      try {
        const parsed = typeof source === 'string' ? JSON.parse(source) : source;
        const list = Array.isArray(parsed) ? parsed : (parsed?.serviceRows || parsed?.services || []);
        if (Array.isArray(list) && list.length) { packageServices = list; break; }
      } catch { /* malformed JSON on a stored row -- skip that source */ }
    }
    return { ...estimate, packageServices };
  };

  const handleDownloadPDF = (estimate) => {
    try {
      exportEstimateToPDF(buildEstimatePdfData(estimate));
    } catch (e) {
      console.error('PDF download error:', e);
    }
  };

  // Print the generated PDF itself -- a browser print of the page stamps the tab title and URL
  // on every sheet, while the PDF viewer prints the document alone
  const handlePrintEstimate = (estimate) => printEstimatePDF(buildEstimatePdfData(estimate));

  // While a document is open, Ctrl+P prints its PDF, not the page
  useEstimatePrint(detailEstimate, buildEstimatePdfData);

  if (detailEstimate) {
    return (
      <div>
        {/* Screen furniture around the document: Back returns to the list, Print sends the
            generated PDF to the viewer's print (a browser page print stamps the tab title and
            URL on every sheet) and Download is the same PDF -- the list rows no longer carry a
            download of their own */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={() => setExpandedId(null)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Archived Estimates
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePrintEstimate(detailEstimate)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Printer className="w-4 h-4" />Print
            </button>
            <button onClick={() => handleDownloadPDF(detailEstimate)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors">
              <Download className="w-4 h-4" />Download PDF
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <EstimateDetailPanel estimate={detailEstimate} decode={decodeHtml}
            internal={['admin', 'operations_manager'].includes(admin?.role)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Filter and Delete All button */}
      {archivedEstimates.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter by Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="property-based">Property Based</option>
              <option value="direct">Direct</option>
            </select>
          </div>
          {!isOpsManager && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete All ({archivedEstimates.length})
            </button>
          )}
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Division</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived On</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {archivedEstimates
              .filter(est => {
                if (typeFilter === 'all') return true;
                if (typeFilter === 'property-based') return est.estimateType === 'property-based' || est.estimateType === 'property_based' || est.propertyId || est.property_id;
                if (typeFilter === 'direct') return est.estimateType === 'direct' && !est.propertyId && !est.property_id;
                return true;
              })
              .map((estimate) => {
                const Icon = PROPERTY_ICONS[estimate.propertyType] || (estimate.estimateType === 'direct' ? User : Building2);
                return (
                  <Fragment key={estimate.estimateId}>
                  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(estimate.estimateId)} title="View details">
                    <td className="px-6 py-4">
                      {/* The ID opens the estimate full screen; the Back button returns here */}
                      <button type="button" onClick={() => setExpandedId(estimate.estimateId)}
                        className="font-medium text-gray-800 hover:text-indigo-600"
                        title="View details">
                        {estimate.estimateId}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {(estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId || estimate.property_id) 
                            ? 'Property Based' 
                            : 'Direct'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {(estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId || estimate.property_id) && (estimate.division || '-')}
                        {!(estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId || estimate.property_id) && '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {/* The customer, in the row itself: who they are and how to reach them */}
                      <p className="text-sm text-gray-800">{estimate.clientName || estimate.customerName || '-'}</p>
                      {(estimate.customerPhone || estimate.client_phone) && (
                        <p className="text-xs text-gray-500 whitespace-nowrap">{estimate.customerPhone || estimate.client_phone}</p>
                      )}
                      {(estimate.customerEmail || estimate.client_email) && (
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{estimate.customerEmail || estimate.client_email}</p>
                      )}
                      {estimate.propertyId && (
                        <p className="text-xs text-gray-400">{estimate.propertyId}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {estimate.archivedAt 
                          ? new Date(estimate.archivedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
                          : new Date(estimate.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">
                        ₹{(estimate.totalPrice || calculateEstimateTotal(estimate)).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
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
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
