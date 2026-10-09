import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Archive, ArchiveRestore, Loader2, AlertCircle } from 'lucide-react';
import { getAuthToken } from '../utils/safeStorage';
import { decodeEntities } from '../utils/text';
import EmptyState from '../components/common/EmptyState';

const API_BASE = import.meta.env.VITE_API_URL || '';

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `₹${amount.toLocaleString('en-IN')}`;
};

const displayAnswer = (value, other) => {
  if (!value) return '-';
  if (value === 'Other') return decodeEntities(other) || 'Other';
  return decodeEntities(value);
};

const STATUS_STYLES = {
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected': 'bg-red-50 text-red-700 border-red-200',
  'Estimate Sent': 'bg-warm-info text-blue-700 border-[#D5E3FA]',
  'Revised Estimate Sent': 'bg-warm-info text-blue-700 border-[#D5E3FA]',
  'Not Started': 'bg-gray-50 text-gray-600 border-gray-200',
};
const DEFAULT_STATUS_STYLE = 'bg-warm-warning text-amber-700 border-[#F3E2B3]';

const PRIORITY_STYLES = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-warm-warning text-amber-700 border-[#F3E2B3]',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Urgent: 'bg-red-50 text-red-700 border-red-200',
};

// Read-only list of tracker entries the FP archived from Marketing > Tracker. Restore sends the
// row back to the tracker; the underlying estimate is untouched either way.
const FPMarketingArchived = ({ user }) => {
  const token = getAuthToken();
  const isFPManager = user?.role === 'manager';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };

  const loadArchived = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE}/api/fp/marketing/tracker/archived`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setRows(result.data || []);
      } else {
        setLoadError(result.message || 'Failed to load archived entries.');
      }
    } catch (e) {
      setLoadError('Failed to load archived entries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!isFPManager) loadArchived(); }, [isFPManager, loadArchived]);

  const restoreRow = async (est) => {
    setRestoringId(est.id);
    try {
      const res = await fetch(`${API_BASE}/api/fp/marketing/tracker/${est.id}/unarchive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setRows(prev => prev.filter(e => e.id !== est.id));
        showToast('Restored to tracker');
      } else {
        showToast(result.message || 'Failed to restore.', 'error');
      }
    } catch (e) {
      showToast('Failed to restore. Please try again.', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  if (isFPManager) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-warm-border shadow-warm p-10 text-center">
          <Megaphone className="w-10 h-10 mx-auto mb-3 text-warm-accent" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-text">Marketing is not available for your account</h2>
          <p className="text-sm text-warm-muted mt-1">This section is available to the franchise partner account only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-warm-section border border-warm-border rounded-xl shadow-warm px-5 py-4 flex items-center gap-3">
        <div className="p-2.5 bg-warm-accent-soft rounded-[10px] flex-shrink-0">
          <Archive className="w-5 h-5 text-warm-accent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-warm-text">Archived Tracker Entries</h1>
          <p className="text-xs text-warm-muted">Tracker rows removed from the active list — restore them any time</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        <div className="p-6 pb-0">
          {loadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{loadError}</p>
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
            <span className="ml-2 text-warm-muted">Loading archived entries...</span>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No archived entries"
            description="Tracker rows you delete land here and can be restored"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-border bg-warm-section">
                  <th className="text-left py-3 px-4 font-medium text-warm-muted">Estimate ID</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Customer</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Visit Date</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Executive</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Estimate Amount</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Estimate Status</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Lead Source</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Priority</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Proposal Sent</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Customer Decision</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Coordinator</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Archived On</th>
                  <th className="text-left py-3 px-3 font-medium text-warm-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((est) => (
                  <tr key={est.id} className="border-b border-warm-border/70 hover:bg-warm-section transition-colors">
                    <td className="py-3 px-4 font-medium text-warm-text whitespace-nowrap">{est.estimate_id}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-warm-text">{decodeEntities(est.client_name) || '-'}</div>
                      <div className="text-xs text-warm-muted">{decodeEntities(est.property_name) || '-'}</div>
                    </td>
                    <td className="py-3 px-3 text-warm-muted whitespace-nowrap">{formatDate(est.created_at)}</td>
                    <td className="py-3 px-3 text-warm-muted">{decodeEntities(est.created_by_name) || '-'}</td>
                    <td className="py-3 px-3 text-warm-text whitespace-nowrap">{formatAmount(est.total_amount)}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[est.tracker_status] || DEFAULT_STATUS_STYLE}`}>
                        {est.tracker_status || 'Not Started'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-warm-text">{decodeEntities(est.lead_source) || '-'}</td>
                    <td className="py-3 px-3">
                      {est.priority ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[est.priority] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {est.priority}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-3 text-warm-text">{displayAnswer(est.proposal_given, est.proposal_given_other)}</td>
                    <td className="py-3 px-3 text-warm-text">{displayAnswer(est.customer_decision, est.customer_decision_other)}</td>
                    <td className="py-3 px-3 text-warm-text">{decodeEntities(est.coordinator_name) || '-'}</td>
                    <td className="py-3 px-3 text-warm-muted whitespace-nowrap">{formatDate(est.tracker_archived_at)}</td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => restoreRow(est)}
                        disabled={restoringId === est.id}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors disabled:opacity-60 whitespace-nowrap"
                        title="Restore to tracker"
                      >
                        {restoringId === est.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-[10px] shadow-lg text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default FPMarketingArchived;
