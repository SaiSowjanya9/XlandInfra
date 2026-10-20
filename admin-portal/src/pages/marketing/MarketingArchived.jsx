import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Archive, ArchiveRestore, Loader2, AlertCircle, Target, FileWarning, Search, MessageSquare, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { decodeEntities } from '../../utils/text';
import { getPropertyTypeLabel } from '../../utils/estimatePackageUtils';
import { PROPERTY_TYPES } from '../../utils/estimateStore';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { useFP } from '../../contexts/FPContext';
import { getMarketingApiPath, marketingFpId, withMarketingFp, marketingPermissions, marketingHasTracker } from '../../utils/marketingApi';
import { complaintStatusStyle } from '../../utils/complaintStatus';
import { formatDate } from '../../utils/dateFormat';

const API_BASE = import.meta.env.VITE_API_URL || '';


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

const displayConcern = (complaint) => {
  const value = decodeEntities(complaint.concern_with || '');
  if (!value) return '-';
  if (value === 'Other') return decodeEntities(complaint.concern_with_other || '') || 'Other';
  return value;
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

// Read-only list of what was archived from Marketing: tracker entries deleted from Marketing >
// Tracker and complaint forms deleted from Marketing > Complaint Form, each under its own tab.
// Restore sends a tracker row back to the tracker (the estimate is untouched either way) and a
// complaint back to the complaint form list.
//
// Shared by the FP, admin and Ops Manager portals; `portalType` picks the API prefix and, for the
// admin, the partner the list is narrowed to. See utils/marketingApi.js.
const MarketingArchived = ({ user, portalType = 'franchise' }) => {
  const token = getAuthToken();
  const apiPath = getMarketingApiPath(portalType);
  const { selectedFp } = useFP();
  const fpId = marketingFpId(portalType, selectedFp);
  // Marketing belongs to the franchise partner account inside the FP portal, so an FP's own
  // manager is refused there. These same screens are the Ops Manager portal's own Marketing
  // section, where a 'manager' role is exactly who they are for -- so what decides is the portal,
  // not the role on its own.
  const unavailable = portalType === 'franchise' && user?.role === 'manager';
  // Restoring a row is a write, so the read-only portals see the archive without the button.
  const { canEdit } = marketingPermissions(portalType);
  // The supervisor portal has the Complaint Form and no lead pipeline, so this screen is its
  // archived complaints alone: its backend mount answers 403 to the tracker read, and asking anyway
  // would put an error where the first tab is.
  const hasTracker = marketingHasTracker(portalType);

  const [activeTab, setActiveTab] = useState(hasTracker ? 'tracker' : 'complaints'); // 'tracker' | 'complaints'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState('');
  const [restoringComplaintId, setRestoringComplaintId] = useState(null);
  // What the assignee reported, read-only: a closed complaint is archived, and the record of what
  // was actually done must stay readable without restoring it first.
  const [noteTarget, setNoteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  // Same row filters as the live tracker: search covers estimate ID and customer name, the
  // property dropdown is the fixed five types, and employees come from the rows themselves.
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const employeeOptions = [...new Set(rows.map(e => decodeEntities(e.coordinator_name || '')).filter(Boolean))];
  const needle = searchTerm.trim().toLowerCase();
  const filteredRows = rows.filter(e =>
    (!needle || (e.estimate_id || '').toLowerCase().includes(needle)
             || decodeEntities(e.client_name || '').toLowerCase().includes(needle)) &&
    (!propertyTypeFilter || getPropertyTypeLabel(e.property_type) === propertyTypeFilter) &&
    (!employeeFilter || decodeEntities(e.coordinator_name || '') === employeeFilter)
  );
  const filtersActive = Boolean(needle || propertyTypeFilter || employeeFilter);

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };

  const loadArchived = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/tracker/archived`, fpId), {
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
  }, [token, apiPath, fpId]);

  const loadArchivedComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    setComplaintsError('');
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/complaints/archived`, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setComplaints(result.data || []);
      } else {
        setComplaintsError(result.message || 'Failed to load archived complaints.');
      }
    } catch (e) {
      setComplaintsError('Failed to load archived complaints. Please try again.');
    } finally {
      setComplaintsLoading(false);
    }
  }, [token, apiPath, fpId]);

  useEffect(() => { if (!unavailable && hasTracker) loadArchived(); }, [unavailable, hasTracker, loadArchived]);
  useEffect(() => { if (!unavailable) loadArchivedComplaints(); }, [unavailable, loadArchivedComplaints]);

  const restoreRow = async (est) => {
    setRestoringId(est.id);
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/tracker/${est.id}/unarchive`, fpId), {
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

  const restoreComplaint = async (row) => {
    setRestoringComplaintId(row.id);
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/complaints/${row.id}/unarchive`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setComplaints(prev => prev.filter(c => c.id !== row.id));
        showToast('Restored to complaints');
      } else {
        showToast(result.message || 'Failed to restore.', 'error');
      }
    } catch (e) {
      showToast('Failed to restore. Please try again.', 'error');
    } finally {
      setRestoringComplaintId(null);
    }
  };

  if (unavailable) {
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
          <h1 className="text-lg font-semibold text-warm-text">Archived</h1>
          <p className="text-xs text-warm-muted">Closed complaints, deleted tracker entries and deleted complaint forms land here — restore them any time</p>
        </div>
      </div>

      {/* Tabs -- tracker entries and complaint forms archive separately. A portal with no lead
          pipeline has only the second one. */}
      <div className="bg-warm-section border border-warm-border rounded-xl shadow-warm px-2 flex overflow-x-auto">
        {[
          ...(hasTracker ? [{ id: 'tracker', label: 'Tracker Entries', icon: Target, count: rows.length }] : []),
          { id: 'complaints', label: 'Complaint Forms', icon: FileWarning, count: complaints.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active ? 'border-[#B5812A] text-[#B5812A]' : 'border-transparent text-warm-muted hover:text-warm-text'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${active ? 'bg-warm-accent-soft text-[#B5812A]' : 'bg-warm-border/60 text-warm-muted'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'complaints' ? (
        <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
          <div className="p-6 pb-0">
            {complaintsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{complaintsError}</p>
              </div>
            )}
          </div>
          {complaintsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
              <span className="ml-2 text-warm-muted">Loading archived complaints...</span>
            </div>
          ) : complaints.length === 0 ? (
            <EmptyState
              icon={FileWarning}
              title="No archived complaint forms"
              description="Complaints you close, and complaint forms you delete, land here and can be restored"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-border bg-warm-section">
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Property ID</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Zone</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Assigned To</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Responsible Person</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Concern</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Contact Person</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Archived On</th>
                    <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((row) => (
                    <tr key={row.id} className="border-b border-warm-border/70 hover:bg-warm-section transition-colors">
                      <td className="py-3 px-4 font-medium text-warm-text whitespace-nowrap">{decodeEntities(row.property_id) || '-'}</td>
                      <td className="py-3 px-4 text-warm-text">{decodeEntities(row.zone) || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${complaintStatusStyle(decodeEntities(row.status || '') || 'Open')}`}>
                          {decodeEntities(row.status || '') || 'Open'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-warm-text whitespace-nowrap">{decodeEntities(row.assigned_employee_name) || <span className="text-warm-muted">Unassigned</span>}</td>
                      <td className="py-3 px-4 text-warm-text">{decodeEntities(row.responsible_person) || '-'}</td>
                      <td className="py-3 px-4 text-warm-text max-w-[180px]"><span className="block truncate" title={displayConcern(row)}>{displayConcern(row)}</span></td>
                      <td className="py-3 px-4 text-warm-text">{decodeEntities(row.contact_person_name) || '-'}</td>
                      <td className="py-3 px-4 text-warm-text whitespace-nowrap">{decodeEntities(row.phone_number) || '-'}</td>
                      <td className="py-3 px-4 text-warm-muted whitespace-nowrap">{formatDate(row.archived_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {/* The notes the assignee left, still readable once the complaint is
                              closed -- that record is the reason the complaint was closed. */}
                          <button
                            onClick={() => setNoteTarget(row)}
                            className={`p-1.5 rounded-lg transition-colors ${row.complaint_note ? 'text-warm-accent hover:bg-warm-accent-soft' : 'text-warm-muted hover:bg-warm-border/60 hover:text-warm-text'}`}
                            title={row.complaint_note ? 'View notes' : 'No notes were saved'}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {canEdit && <button
                            onClick={() => restoreComplaint(row)}
                            disabled={restoringComplaintId === row.id}
                            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors disabled:opacity-60 whitespace-nowrap"
                            title="Restore to complaint form"
                          >
                            {restoringComplaintId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                            Restore
                          </button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        <div className="p-6 pb-0">
          {!loading && rows.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search estimate ID or customer"
                  className="w-full h-[38px] pl-9 pr-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20"
                />
              </div>
              <select
                value={propertyTypeFilter}
                onChange={(e) => setPropertyTypeFilter(e.target.value)}
                className={`h-[38px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20 ${propertyTypeFilter ? 'text-warm-text' : 'text-warm-muted'}`}
              >
                <option value="">All Property Types</option>
                {PROPERTY_TYPES.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
              </select>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className={`h-[38px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20 ${employeeFilter ? 'text-warm-text' : 'text-warm-muted'}`}
              >
                <option value="">All Employees</option>
                {employeeOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {filtersActive && (
                <button
                  onClick={() => { setSearchTerm(''); setPropertyTypeFilter(''); setEmployeeFilter(''); }}
                  className="h-[38px] px-3 text-sm font-medium text-warm-muted hover:text-warm-text hover:bg-warm-section rounded-[10px] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
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
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Visit Date</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Executive Name</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Employee Name</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Customer Name</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Lead Source</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Estimate Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Estimate Status</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Next Action</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Lead Status</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Last Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Next Follow-Up</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Proposal Sent</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Customer Decision</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Archived On</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Actions</th>
</tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={18} className="py-10 text-center text-sm text-warm-muted">No entries match these filters</td>
                  </tr>
                )}
                {filteredRows.map((est) => (
                  <tr key={est.id} className="border-b border-warm-border/70 hover:bg-warm-section transition-colors">
                                        <td className="py-3 px-4 font-medium text-warm-text whitespace-nowrap">{est.estimate_id}</td>
                    <td className="py-3 px-4 text-warm-muted whitespace-nowrap">{formatDate(est.created_at)}</td>
                    <td className="py-3 px-4 text-warm-muted">{decodeEntities(est.created_by_name) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(est.coordinator_name) || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-warm-text">{decodeEntities(est.client_name) || '-'}</div>
                      <div className="text-xs text-warm-muted">{decodeEntities(est.property_name) || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(est.lead_source) || '-'}</td>
                    <td className="py-3 px-4">
                      {est.priority ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PRIORITY_STYLES[est.priority] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {est.priority}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">{formatAmount(est.total_amount)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[est.tracker_status] || DEFAULT_STATUS_STYLE}`}>
                        {est.tracker_status || 'Not Started'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">{decodeEntities(est.next_action) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">{decodeEntities(est.lead_status) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">
                      <div>{formatDate(est.last_contact_date)}</div>
                      <div className="text-xs text-warm-muted">{decodeEntities(est.last_contact_method) || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">{formatDate(est.next_follow_up_date)}</td>
                    <td className="py-3 px-4 text-warm-text">{displayAnswer(est.proposal_given, est.proposal_given_other)}</td>
                    <td className="py-3 px-4 text-warm-text">{displayAnswer(est.customer_decision, est.customer_decision_other)}</td>
                    <td className="py-3 px-4 text-warm-muted whitespace-nowrap">{formatDate(est.tracker_archived_at)}</td>
                    <td className="py-3 px-4">
                      {canEdit && <button
                        onClick={() => restoreRow(est)}
                        disabled={restoringId === est.id}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors disabled:opacity-60 whitespace-nowrap"
                        title="Restore to tracker"
                      >
                        {restoringId === est.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                        Restore
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Read-only notes. An archived complaint is not edited -- restore it first -- but what the
          assignee reported is the record of why it was closed, so it stays readable here. */}
      {noteTarget && (
        <Modal overlayClassName="lg:pl-72" onClose={() => setNoteTarget(null)} className="w-full max-w-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-warm-border bg-warm-section rounded-t-xl">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-warm-text">Notes / Comments</h3>
              <p className="text-xs text-warm-muted">
                {decodeEntities(noteTarget.property_id) || '-'} · archived {formatDate(noteTarget.archived_at)}
              </p>
            </div>
            <button onClick={() => setNoteTarget(null)} className="p-1.5 rounded-lg hover:bg-warm-border/60 transition-colors" title="Close">
              <X className="w-5 h-5 text-warm-muted" />
            </button>
          </div>
          <div className="p-5">
            <div className="px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-warm-text whitespace-pre-wrap bg-warm-section min-h-[80px] [overflow-wrap:anywhere]">
              {decodeEntities(noteTarget.complaint_note || '') || 'No notes were saved against this complaint.'}
            </div>
            {decodeEntities(noteTarget.note_updated_by || '') && (
              <p className="mt-1.5 text-[11px] text-warm-muted">
                Last saved by {decodeEntities(noteTarget.note_updated_by)}
                {noteTarget.note_updated_at ? ` · ${formatDate(noteTarget.note_updated_at)}` : ''}
              </p>
            )}
            {decodeEntities(noteTarget.closed_by || '') && (
              <p className="mt-1 text-[11px] text-warm-muted">
                Closed by {decodeEntities(noteTarget.closed_by)}
                {noteTarget.closed_at ? ` · ${formatDate(noteTarget.closed_at)}` : ''}
              </p>
            )}
            <div className="flex justify-end pt-4 mt-4 border-t border-warm-border">
              <button
                onClick={() => setNoteTarget(null)}
                className="px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-[10px] shadow-lg text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default MarketingArchived;
