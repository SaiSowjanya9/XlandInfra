import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, FileWarning } from 'lucide-react';
import { getAuthToken } from '../utils/safeStorage';
import { decodeEntities } from '../utils/text';
import { formatDate } from '../utils/dateFormat';
import Modal from '../components/common/Modal';

const API_BASE = import.meta.env.VITE_API_URL || '';


// A saved concern is a fixed option or, where the option is "Other", the typed text alongside it.
const displayConcern = (complaint) => {
  const value = decodeEntities(complaint.concern_with || '');
  if (!value) return '-';
  if (value === 'Other') return decodeEntities(complaint.concern_with_other || '') || 'Other';
  return value;
};

// Read-only view of fp_marketing_complaints for staff portals: admin and the Operations Manager
// see every partner's complaints (endpoint returns all rows plus the partner's name), the zone
// manager sees only their own zones. The owning FP edits and archives from their portal, so this
// table has no action buttons -- a row opens the read-only detail modal.
const ComplaintsInbox = ({ endpoint, title = 'Customer Complaints', showPartner = false }) => {
  const token = getAuthToken();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [viewing, setViewing] = useState(null);

  const loadComplaints = useCallback(async () => {
    try {
      setLoadError('');
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setComplaints(result.data || []);
      } else {
        setLoadError(result.message || 'Failed to load complaints.');
      }
    } catch (e) {
      setLoadError('Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';
  const readOnlyCls = 'w-full min-w-0 px-2.5 py-1 border border-gray-200 rounded-md text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 [overflow-wrap:anywhere]';

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <div className="p-2.5 bg-amber-50 rounded-[10px]">
            <FileWarning className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">Complaints filed by customers and franchise partners</p>
          </div>
        </div>

        {loadError && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{loadError}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span className="ml-2 text-gray-500">Loading complaints...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-16 text-center">
            <FileWarning className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No complaints logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Property ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Zone</th>
                  {showPartner && <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Franchise Partner</th>}
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Responsible Person</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Concern</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Contact Person</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Logged On</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setViewing(row)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    title="Click to view"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{decodeEntities(row.property_id) || '-'}</td>
                    <td className="py-3 px-4 text-gray-900">{decodeEntities(row.zone) || '-'}</td>
                    {showPartner && <td className="py-3 px-4 text-gray-900">{decodeEntities(row.franchise_partner_name) || '-'}</td>}
                    <td className="py-3 px-4 text-gray-900">{decodeEntities(row.responsible_person) || '-'}</td>
                    <td className="py-3 px-4 text-gray-900 max-w-[180px]"><span className="block truncate" title={displayConcern(row)}>{displayConcern(row)}</span></td>
                    <td className="py-3 px-4 text-gray-900">{decodeEntities(row.contact_person_name) || '-'}</td>
                    <td className="py-3 px-4 text-gray-900 whitespace-nowrap">{decodeEntities(row.phone_number) || '-'}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-3 px-4">
                      {row.archived_at ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">Archived</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">Open</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Read-only detail modal */}
      {viewing && (
        <Modal onClose={() => setViewing(null)} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Complaint Details</h3>
                <p className="text-xs text-gray-500">
                  {decodeEntities(viewing.property_id) || '-'} · logged {formatDate(viewing.created_at)}
                  {viewing.archived_at ? ` · archived ${formatDate(viewing.archived_at)}` : ''}
                </p>
              </div>
              <button onClick={() => setViewing(null)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" title="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0"><label className={labelCls}>Property ID</label><div className={readOnlyCls}>{decodeEntities(viewing.property_id) || '-'}</div></div>
                <div className="min-w-0"><label className={labelCls}>Zone</label><div className={readOnlyCls}>{decodeEntities(viewing.zone) || '-'}</div></div>
                {showPartner && (
                  <div className="min-w-0"><label className={labelCls}>Franchise Partner</label><div className={readOnlyCls}>{decodeEntities(viewing.franchise_partner_name) || '-'}</div></div>
                )}
                <div className="min-w-0"><label className={labelCls}>Responsible Person</label><div className={readOnlyCls}>{decodeEntities(viewing.responsible_person) || '-'}</div></div>
                <div className="min-w-0"><label className={labelCls}>Concern With</label><div className={readOnlyCls}>{displayConcern(viewing)}</div></div>
                <div className="min-w-0"><label className={labelCls}>Contact Person Name</label><div className={readOnlyCls}>{decodeEntities(viewing.contact_person_name) || '-'}</div></div>
                <div className="min-w-0"><label className={labelCls}>Phone Number</label><div className={readOnlyCls}>{decodeEntities(viewing.phone_number) || '-'}</div></div>
              </div>
              <div className="min-w-0"><label className={labelCls}>Comments</label><div className={readOnlyCls}>{decodeEntities(viewing.comments) || '-'}</div></div>
            </div>
          </Modal>
      )}
    </div>
  );
};

export default ComplaintsInbox;
