import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Target, Plus, X, Loader2, AlertCircle, ArrowLeft,
  ClipboardList, FileText, Building2, Pencil, Trash2, Eye
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { decodeEntities } from '../../utils/text';
import { getPropertyTypeLabel } from '../../utils/estimatePackageUtils';
import EmptyState from '../../components/common/EmptyState';
import DateField from '../../components/common/DateField';
import { formatDate } from '../../utils/dateFormat';
import { useFP } from '../../contexts/FPContext';
import { getMarketingApiPath, marketingFpId, withMarketingFp, marketingPermissions } from '../../utils/marketingApi';
import Modal from '../../components/common/Modal';
import {
  LEAD_STATUSES, CONTACT_METHODS, CUSTOMER_RESPONSES, NEXT_ACTIONS,
  DUE_STATUS_STYLES, contactStamp, dueStatus, nextFollowUpFrom, toDateOnly,
  isCustomerResponseLocked, effectiveCustomerResponse
} from '../../utils/followUpDates';

const API_BASE = import.meta.env.VITE_API_URL || '';

// The answers the tracker collects on a direct estimate. Keep these option sets in step with
// TRACKER_OPTIONS in backend/routes/franchisePartner.js -- the route refuses anything outside them.
const LEAD_SOURCE_OPTIONS = ['Field Visit', 'Referral', 'WhatsApp', 'Phone Call', 'Website', 'Social Media', 'Existing Customer', 'Walk-in', 'Office Visit', 'Other'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const MAINTENANCE_OPTIONS = ['Self-managed', 'Existing Vendor', 'Association Managed', 'No System', 'Other'];
const PROPOSAL_OPTIONS = ['Yes', 'No', 'Other'];
const DECISION_OPTIONS = ['Interested', 'Interested Need Follow-up', 'Not Interested', 'Need Follow-up', 'Competitor Selected', 'Other'];
const TRACKER_STATUS_OPTIONS = ['Not Started', 'Created by Executive', 'Pending Employee Review', 'Reviewed by Employee', 'Estimate Sent', 'Revision Required', 'Revised Estimate Sent', 'Approved', 'Rejected'];
// The only statuses anybody picks by hand; the rest are derived -- by the estimate's own status,
// by Employee Reviewed, or by the time since the estimate was created -- so the dropdown keeps
// them listed (the current one has to be shown) but locked. The PUT enforces the same rule.
// Keep this in step with MANUAL_TRACKER_STATUSES in backend/utils/marketingDashboard.js.
const MANUAL_TRACKER_STATUSES = ['Revision Required', 'Revised Estimate Sent'];
const COORDINATOR_REVIEWED_OPTIONS = ['Yes', 'No'];
const FOLLOW_UP_OPTIONS = ['Step 1 - Thank You', 'Step 2 - Estimate Shared', 'Step 3 - Follow-Up 1', 'Step 4 - Follow-Up 2', 'Step 5A - Executive Call', 'Step 5B - Customer Visit', 'Closed'];

const formatAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `₹${amount.toLocaleString('en-IN')}`;
};

// Badge colour by where the estimate sits in the pipeline.
const STATUS_STYLES = {
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Rejected': 'bg-red-50 text-red-700 border-red-200',
  'Estimate Sent': 'bg-warm-info text-blue-700 border-[#D5E3FA]',
  'Revised Estimate Sent': 'bg-warm-info text-blue-700 border-[#D5E3FA]',
  'Not Started': 'bg-gray-50 text-gray-600 border-gray-200',
};
const DEFAULT_STATUS_STYLE = 'bg-warm-warning text-amber-700 border-[#F3E2B3]';

// A saved answer is a fixed option or, where the option is "Other", the typed text alongside it.
const displayAnswer = (value, other) => {
  if (!value) return '-';
  if (value === 'Other') return decodeEntities(other) || 'Other';
  return decodeEntities(value);
};

const emptyTrackerForm = {
  lead_source: '',
  priority: '',
  maintenance_system: '',
  maintenance_system_other: '',
  proposal_given: '',
  proposal_given_other: '',
  customer_decision: '',
  customer_decision_other: '',
  tracker_status: '',
  coordinator_reviewed: '',
  follow_up_stage: '',
  // coordinator_name is not here on purpose: the server sets it to whoever marks Reviewed as
  // Yes, so it is neither edited nor sent back. TRACKER_FIELDS is built from these keys.
  // Follow-up columns from the workbook. Due Status is derived from the next date and the lead
  // status, so it is never part of the form.
  lead_status: '',
  last_contact_date: '',
  last_contact_method: '',
  customer_response: '',
  next_follow_up_date: '',
  next_action: '',
};

// The fields a saved row contributes to a PUT. Every save sends the whole tracker payload, so a
// field missing from this list would be wiped by an unrelated inline edit.
const TRACKER_FIELDS = Object.keys(emptyTrackerForm);

const PRIORITY_STYLES = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-warm-warning text-amber-700 border-[#F3E2B3]',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Urgent: 'bg-red-50 text-red-700 border-red-200',
};

// Shared by the FP, admin and Ops Manager portals; `portalType` picks the API prefix and, for the
// admin, the partner the leads are narrowed to. See utils/marketingApi.js.
const MarketingTracker = ({ user, portalType = 'franchise' }) => {
  const token = getAuthToken();
  const apiPath = getMarketingApiPath(portalType);
  const { selectedFp } = useFP();
  const fpId = marketingFpId(portalType, selectedFp);
  // The admin sees several franchises in one list, so each row has to say which one it belongs to.
  const showPartner = getMarketingApiPath(portalType) === 'admin';
  // What this portal may change. The server refuses the rest with a 403 whatever is rendered;
  // this is so a read-only portal shows the pipeline instead of controls that all fail.
  const { canEdit, canReview } = marketingPermissions(portalType);
  // Marketing belongs to the franchise partner account inside the FP portal, so an FP's own
  // manager is refused there. These same screens are the Ops Manager portal's own Marketing
  // section, where a 'manager' role is exactly who they are for -- so what decides is the portal,
  // not the role on its own.
  const unavailable = portalType === 'franchise' && user?.role === 'manager';

  const [view, setView] = useState('tracker'); // 'tracker' list | 'pick' a direct estimate
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // the estimate open in the modal
  const [form, setForm] = useState(emptyTrackerForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/tracker`, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setEstimates(result.data || []);
      } else {
        setLoadError(result.message || 'Failed to load tracker data.');
      }
    } catch (e) {
      setLoadError('Failed to load tracker data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, apiPath, fpId]);

  useEffect(() => { if (!unavailable) loadEstimates(); }, [unavailable, loadEstimates]);

  const trackedEstimates = estimates.filter(e => e.tracked_at);
  const untrackedEstimates = estimates.filter(e => !e.tracked_at);

  const openEditor = (estimate) => {
    setEditing(estimate);
    setForm({
      lead_source: estimate.lead_source || '',
      priority: estimate.priority || '',
      maintenance_system: estimate.maintenance_system || '',
      maintenance_system_other: decodeEntities(estimate.maintenance_system_other || ''),
      proposal_given: estimate.proposal_given || '',
      proposal_given_other: decodeEntities(estimate.proposal_given_other || ''),
      customer_decision: estimate.customer_decision || '',
      customer_decision_other: decodeEntities(estimate.customer_decision_other || ''),
      tracker_status: estimate.tracker_status || '',
      coordinator_reviewed: estimate.coordinator_reviewed || '',
      follow_up_stage: estimate.follow_up_stage || '',
      lead_status: decodeEntities(estimate.lead_status || ''),
      last_contact_date: toDateOnly(estimate.last_contact_date),
      last_contact_method: decodeEntities(estimate.last_contact_method || ''),
      customer_response: decodeEntities(estimate.customer_response || ''),
      next_follow_up_date: toDateOnly(estimate.next_follow_up_date),
      next_action: decodeEntities(estimate.next_action || ''),
    });
    setFormError('');
  };

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Inline row edits: one field changes in the table and the whole saved payload goes
  // back -- proposal_given/customer_decision are required by the PUT, so they ride along.
  const [savingRowId, setSavingRowId] = useState(null);
  const saveRowField = async (est, patch) => {
    // The whole saved payload goes back every time -- proposal_given/customer_decision are
    // required by the PUT -- so the row is rebuilt from TRACKER_FIELDS and the one edit applied
    // on top. Building it by hand is how a newly added column gets silently wiped.
    const payload = { ...patch };
    for (const field of TRACKER_FIELDS) {
      if (field in payload) continue;
      payload[field] = (field === 'last_contact_date' || field === 'next_follow_up_date')
        ? toDateOnly(est[field])
        : (est[field] || '');
    }
    setSavingRowId(est.id);
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/tracker/${est.id}`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setEstimates(prev => prev.map(e => e.id === est.id ? result.data : e));
      } else {
        showToast(result.message || 'Failed to save.', 'error');
      }
    } catch (e) {
      showToast('Failed to save. Please try again.', 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  // Inline equivalents of the modal's two date rules, so a stage picked in the table stamps the
  // contact the same way one picked in the modal does.
  const saveRowStage = (est, stage) =>
    saveRowField(est, { follow_up_stage: stage, ...(stage ? contactStamp() : {}) });

  const saveRowContactDate = (est, date) =>
    saveRowField(est, { last_contact_date: date, next_follow_up_date: date ? nextFollowUpFrom(date) : '' });

  // Soft delete: the row leaves the tracker and lands in Marketing > Archived.
  const archiveRow = async (est) => {
    setArchiveTarget(null);
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/tracker/${est.id}/archive`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setEstimates(prev => prev.filter(e => e.id !== est.id));
        showToast('Moved to Archived');
      } else {
        showToast(result.message || 'Failed to archive.', 'error');
      }
    } catch (e) {
      showToast('Failed to archive. Please try again.', 'error');
    }
  };

  // w-auto lets a native select size itself to its widest option, so long stages like
  // "Pending Employee Review" never get clipped; max-w-full is the safety cap.
  const cellSelectCls = 'w-auto max-w-full px-1.5 py-1 border border-warm-border rounded-lg text-xs bg-white text-warm-text focus:outline-none focus:border-warm-accent disabled:opacity-60 disabled:bg-warm-section';
  // A date input needs its own width: left to w-full it collapses under the native calendar icon.
  const cellDateCls = 'w-[130px] px-1.5 py-1 border border-warm-border rounded-lg text-xs bg-white text-warm-text focus:outline-none focus:border-warm-accent disabled:opacity-60 disabled:bg-warm-section';

  const saveTracker = async () => {
    // The required pair, and an Other that has nothing typed, are the only ways to fail here.
    const errors = [];
    if (!form.proposal_given) errors.push('Proposal Sent is required');
    if (!form.customer_decision) errors.push('Customer Decision is required');
    if (form.maintenance_system === 'Other' && !form.maintenance_system_other.trim()) errors.push('Enter the current maintenance system');
    if (form.proposal_given === 'Other' && !form.proposal_given_other.trim()) errors.push('Enter the proposal details');
    if (form.customer_decision === 'Other' && !form.customer_decision_other.trim()) errors.push('Enter the customer decision');
    if (errors.length) { setFormError(errors.join('. ')); return; }

    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/tracker/${editing.id}`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await res.json();
      if (result.success) {
        showToast('Tracker saved successfully!', 'success');
        setEditing(null);
        setView('tracker');
        loadEstimates();
      } else {
        setFormError(result.message || 'Failed to save.');
      }
    } catch (e) {
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20';
  const labelCls = 'block text-xs font-medium text-warm-muted mb-1';
  const readOnlyCls = 'w-full min-w-0 px-2.5 py-1 border border-warm-border rounded-md text-sm text-warm-text whitespace-pre-wrap bg-warm-section [overflow-wrap:anywhere]';

  const autoGrowField = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } };

  const radioField = (title, field, otherField, options, required) => (
    <div>
      <label className={labelCls}>{title} {required && <span className="text-red-500">*</span>}</label>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5">
        {options.map(option => (
          <label key={option} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={`tracker-${field}`}
              checked={form[field] === option}
              onChange={() => setField(field, option)}
              disabled={!canEdit}
              className="w-4 h-4 border-warm-border text-warm-accent focus:ring-warm-accent/30 disabled:opacity-60"
            />
            <span className="text-sm text-warm-text">{option === 'Other' && otherField ? 'Other:' : option}</span>
          </label>
        ))}
      </div>
      {otherField && form[field] === 'Other' && (
        <textarea
          ref={autoGrowField}
          onInput={(e) => autoGrowField(e.currentTarget)}
          value={form[otherField]}
          onChange={(e) => setField(otherField, e.target.value)}
          disabled={!canEdit}
          maxLength={255}
          rows={1}
          placeholder="Please specify"
          className="mt-2 w-full px-2.5 py-1.5 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white resize-none overflow-hidden focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20"
        />
      )}
    </div>
  );

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
      {/* Page header */}
      <div className="bg-warm-section border border-warm-border rounded-xl shadow-warm px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-warm-accent-soft rounded-[10px] flex-shrink-0">
            <Target className="w-5 h-5 text-warm-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-warm-text">Marketing Tracker</h1>
            <p className="text-xs text-warm-muted">Track direct estimates from first visit to customer decision</p>
          </div>
        </div>
        {view === 'tracker' && canEdit && (
          <button
            onClick={() => setView('pick')}
            className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        )}
      </div>

      {/* Pick a direct estimate */}
      {view === 'pick' && (
        <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setView('tracker')}
                className="flex items-center gap-2 text-warm-muted hover:text-warm-text transition-colors group mr-1"
                title="Back to tracker"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="p-2 bg-warm-accent-soft rounded-[10px]">
                <ClipboardList className="w-5 h-5 text-warm-accent-hover" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-warm-text">Direct Estimates</h3>
                <p className="text-xs text-warm-muted">Select an estimate to track</p>
              </div>
            </div>

            {loadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{loadError}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
                <span className="ml-2 text-warm-muted">Loading estimates...</span>
              </div>
            ) : untrackedEstimates.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={estimates.length === 0 ? 'No direct estimates found' : 'All direct estimates are tracked'}
                description={estimates.length === 0 ? 'Create a direct estimate first to track it here' : 'Every direct estimate already has a tracker entry'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-warm-border bg-warm-section">
                      <th className="text-left py-3 px-3 font-medium text-warm-muted whitespace-nowrap">Estimate ID</th>
                      {/* On the admin portal the list carries several franchises at once, so the
                          row has to say which one it belongs to. */}
                      {showPartner && <th className="text-left py-3 px-3 font-medium text-warm-muted whitespace-nowrap">Franchise Partner</th>}
                      <th className="text-left py-3 px-3 font-medium text-warm-muted whitespace-nowrap">Visit Date</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted whitespace-nowrap">Executive Name</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted whitespace-nowrap">Customer Name</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted whitespace-nowrap">Property Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {untrackedEstimates.map((est) => (
                      <tr
                        key={est.id}
                        onClick={() => openEditor(est)}
                        className="border-b border-warm-border/70 hover:bg-warm-section cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-medium text-warm-text">{est.estimate_id}</td>
                        {showPartner && <td className="py-3 px-3 text-warm-muted">{decodeEntities(est.franchise_partner_name) || '-'}</td>}
                        <td className="py-3 px-3 text-warm-muted whitespace-nowrap">{formatDate(est.created_at)}</td>
                        <td className="py-3 px-3 text-warm-muted whitespace-nowrap">{decodeEntities(est.created_by_name) || '-'}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-warm-text">{decodeEntities(est.client_name) || '-'}</div>
                          <div className="text-xs text-warm-muted">{decodeEntities(est.property_name) || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-warm-muted whitespace-nowrap">{getPropertyTypeLabel(est.property_type)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All tracker entries */}
      {view === 'tracker' && (
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
              <span className="ml-2 text-warm-muted">Loading tracker...</span>
            </div>
          ) : trackedEstimates.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No tracked estimates yet"
              description={!canEdit ? 'Nothing has been tracked for your zones yet' : untrackedEstimates.length > 0 ? 'Click New to track a direct estimate' : 'Create a direct estimate first, then track it here'}
              action={untrackedEstimates.length > 0 && canEdit ? (
                <button
                  onClick={() => setView('pick')}
                  className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors"
                >
                  <Plus className="w-4 h-4" /> New
                </button>
              ) : null}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-warm-border bg-warm-section">
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Estimate ID</th>
                    {showPartner && <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Franchise Partner</th>}
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Visit Date</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Executive Name</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Customer Name</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Property Type</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Lead Source</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Priority</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Estimate Status</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Employee Reviewed</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Next Action</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Due Status</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Follow-Up Stage</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Lead Status</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Last Contact Date</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Last Contact Method</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Customer Response</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Next Follow-Up</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Last Updated By</th>
                    <th className="text-left py-2.5 px-2 font-medium text-warm-muted whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedEstimates.map((est) => (
                    <tr
                      key={est.id}
                      onClick={() => openEditor(est)}
                      className="border-b border-warm-border/70 hover:bg-warm-section cursor-pointer transition-colors"
                      title="Click to edit"
                    >
                      <td className="py-2 px-2 font-medium text-warm-text whitespace-nowrap">{est.estimate_id}</td>
                      {showPartner && <td className="py-2 px-2 text-warm-muted">{decodeEntities(est.franchise_partner_name) || '-'}</td>}                      <td className="py-2 px-2"><div className="text-warm-text whitespace-nowrap">{formatDate(est.created_at)}</div></td>
                      <td className="py-2 px-2"><div className="text-warm-muted whitespace-nowrap">{decodeEntities(est.created_by_name) || '-'}</div></td>
                      <td className="py-2 px-2">
                        <div className="font-medium text-warm-text">{decodeEntities(est.client_name) || '-'}</div>
                        <div className="text-warm-muted">{decodeEntities(est.property_name) || '-'}</div>
                      </td>                                            <td className="py-2 px-2"><div className="text-warm-muted whitespace-nowrap">{getPropertyTypeLabel(est.property_type)}</div></td>
                      <td className="py-2 px-2"><div className="text-warm-text whitespace-nowrap">{decodeEntities(est.lead_source) || '-'}</div></td>
                      <td className="py-2 px-2">{est.priority ? (
                          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${PRIORITY_STYLES[est.priority] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {est.priority}
                          </span>
                        ) : <span className="text-warm-muted">-</span>}</td>

                      {/* Estimate Status is inline-editable, except at the ends of the pipeline where
                          the estimate's own status (sent/approved/rejected) drives it. */}
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        {['approved', 'rejected'].includes(est.status) ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${STATUS_STYLES[est.tracker_status] || DEFAULT_STATUS_STYLE}`}
                            title="Set by the estimate's status in All Estimates">
                            {est.tracker_status}
                          </span>
                        ) : (
                          <select
                            value={est.tracker_status || 'Not Started'}
                            disabled={savingRowId === est.id || !canEdit}
                            onChange={(e) => saveRowField(est, { tracker_status: e.target.value })}
                            className={cellSelectCls}
                            title="Only the revision statuses are chosen by hand -- the rest follow the estimate and the review on their own"
                          >
                            {TRACKER_STATUS_OPTIONS.filter(o => o !== 'Approved' && o !== 'Rejected').map(o => (
                              <option key={o} value={o} disabled={!MANUAL_TRACKER_STATUSES.includes(o)}>{o}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={est.coordinator_reviewed || ''}
                          disabled={savingRowId === est.id || !(canEdit || canReview)}
                          onChange={(e) => saveRowField(est, { coordinator_reviewed: e.target.value })}
                          className={cellSelectCls}
                          title="Employee Reviewed?"
                        >
                          <option value="">Reviewed?</option>
                          {COORDINATOR_REVIEWED_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {est.coordinator_reviewed === 'Yes' && est.coordinator_name && (
                          <div className="mt-1 text-xs text-warm-muted whitespace-nowrap" title="Reviewed by">
                            {decodeEntities(est.coordinator_name)}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={decodeEntities(est.next_action || '')}
                          disabled={savingRowId === est.id || !canEdit}
                          onChange={(e) => saveRowField(est, { next_action: e.target.value })}
                          className={cellSelectCls}
                        >
                          <option value="">-</option>
                          {NEXT_ACTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Derived from the next date and the lead status, so it is never edited --
                          the server sends it, and it is recomputed here in case the tab has been
                          left open across midnight. */}
                      <td className="py-2 px-2">
                        {(() => {
                          const due = dueStatus(est.next_follow_up_date, decodeEntities(est.lead_status || ''));
                          return (
                            <span className={`px-2 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${DUE_STATUS_STYLES[due]}`}>
                              {due}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Picking a stage records a contact: today (IST) in Last Contact and the
                          next follow-up four days out, both still editable afterwards. The stage
                          only moves forward -- once a step is set, the ones before it are locked
                          and so is clearing it, because the pipeline does not walk backwards. */}
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const currentStage = FOLLOW_UP_OPTIONS.indexOf(est.follow_up_stage);
                          return (
                            <select
                              value={est.follow_up_stage || ''}
                              disabled={savingRowId === est.id || !canEdit}
                              onChange={(e) => saveRowStage(est, e.target.value)}
                              className={cellSelectCls}
                              title="Picking a stage stamps today as the last contact; steps already passed stay locked"
                            >
                              <option value="" disabled={currentStage >= 0}>-</option>
                              {FOLLOW_UP_OPTIONS.map((o, i) => <option key={o} value={o} disabled={i < currentStage}>{o}</option>)}
                            </select>
                          );
                        })()}
                      </td>
                      
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={decodeEntities(est.lead_status || '')}
                          disabled={savingRowId === est.id || !canEdit}
                          onChange={(e) => saveRowField(est, { lead_status: e.target.value })}
                          className={cellSelectCls}
                        >
                          <option value="">-</option>
                          {LEAD_STATUSES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <DateField
                          value={toDateOnly(est.last_contact_date)}
                          disabled={savingRowId === est.id || !canEdit}
                          onChange={(e) => saveRowContactDate(est, e.target.value)}
                          className={cellDateCls}
                          title="Changing this re-schedules the next follow-up four days later"
                        />
                      </td>
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={decodeEntities(est.last_contact_method || '')}
                          disabled={savingRowId === est.id || !canEdit}
                          onChange={(e) => saveRowField(est, { last_contact_method: e.target.value })}
                          className={`${cellSelectCls} mt-1`}
                          title="Last Contact Method"
                        >
                          <option value="">Method</option>
                          {CONTACT_METHODS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>

                      {/* Once the estimate is approved or rejected it answers this column itself,
                          so the select gives way to a badge -- the same rule Estimate Status
                          above follows. */}
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        {isCustomerResponseLocked(est.status) ? (
                          <span className={`px-2 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${
                            est.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`} title="Set by the estimate's status in All Estimates">
                            {effectiveCustomerResponse(est.status, est.customer_response)}
                          </span>
                        ) : (
                          <select
                            value={decodeEntities(est.customer_response || '')}
                            disabled={savingRowId === est.id || !canEdit}
                            onChange={(e) => saveRowField(est, { customer_response: e.target.value })}
                            className={cellSelectCls}
                          >
                            <option value="">-</option>
                            {CUSTOMER_RESPONSES.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                        <DateField
                          value={toDateOnly(est.next_follow_up_date)}
                          disabled={savingRowId === est.id || !canEdit}
                          onChange={(e) => saveRowField(est, { next_follow_up_date: e.target.value })}
                          className={cellDateCls}
                        />
                      </td>
                      {/* Written by the server from the caller's token on every tracker write,
                          so it names whoever actually made the last change -- including an
                          archive -- rather than whoever the row was created by. */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {est.tracker_updated_by ? (
                          <>
                            <div className="text-warm-text">{decodeEntities(est.tracker_updated_by)}</div>
                            <div className="text-[11px] text-warm-muted">
                              {[est.tracker_updated_by_role_label, formatDate(est.tracker_updated_at, '')]
                                .filter(Boolean).join(' · ')}
                            </div>
                          </>
                        ) : (
                          <span className="text-warm-muted">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditor(est)}
                            className="p-1.5 rounded-lg text-warm-muted hover:bg-warm-border/60 hover:text-warm-text transition-colors"
                            title={canEdit ? 'Edit tracker' : 'View estimate'}
                          >
                            {canEdit ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => setArchiveTarget(est)}
                              className="p-1.5 rounded-lg text-warm-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Move to Archived"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit modal. Backdrop covers the viewport, but the card centers in the content
          area -- the expanded FP sidebar is 288px (lg:w-72), so pad the flex row by that much. */}
      {editing && (
        <Modal overlayClassName="lg:pl-72" className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-warm-border bg-warm-section rounded-t-xl">
              <div>
                <h3 className="text-base font-semibold text-warm-text">Track Estimate</h3>
                <p className="text-xs text-warm-muted">{editing.estimate_id} · {decodeEntities(editing.client_name) || '-'}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-warm-border/60 transition-colors" title="Close">
                <X className="w-5 h-5 text-warm-muted" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Automated estimate details */}
              <div className="bg-warm-section/60 border border-warm-border rounded-[10px] p-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2.5">
                  <div className="min-w-0"><label className={labelCls}>Estimate ID</label><div className={readOnlyCls}>{editing.estimate_id}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Customer Name</label><div className={readOnlyCls}>{decodeEntities(editing.client_name) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Visit Date</label><div className={readOnlyCls}>{formatDate(editing.created_at)}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Executive Name</label><div className={readOnlyCls}>{decodeEntities(editing.created_by_name) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Phone</label><div className={readOnlyCls}>{decodeEntities(editing.client_phone) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Email</label><div className={readOnlyCls}>{decodeEntities(editing.client_email) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Property Type</label><div className={readOnlyCls}>{getPropertyTypeLabel(editing.property_type)}</div></div>
                  <div className="min-w-0"><label className={labelCls}>No. of Units</label><div className={readOnlyCls}>{editing.total_units ?? '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Estimate Amount</label><div className={readOnlyCls}>{formatAmount(editing.total_amount)}</div></div>
                </div>

                {/* Unit details by property type - the same block/unit split the estimate form shows */}
                {(() => {
                  const propType = (editing.property_type || '').toUpperCase();
                  const parseJson = (v) => {
                    if (!v) return {};
                    if (typeof v === 'object') return v;
                    try { return JSON.parse(v); } catch { return {}; }
                  };
                  const blockNames = parseJson(editing.block_names);
                  const unitsPerBlock = parseJson(editing.units_per_block);
                  const blockUnitTypes = parseJson(editing.block_unit_types);
                  const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };

                  // FLAT / VILLA / PLOT - the unit's own number
                  if (['FLAT', 'FL', 'FLATS'].includes(propType) || ['VILLA', 'VL', 'VILLAS'].includes(propType) || ['PLOT', 'PL', 'PLOTS'].includes(propType)) {
                    if (!editing.villa_plot_number) return null;
                    const unitLabel = propType.startsWith('FLAT') || propType === 'FL' ? 'Flat Number' : propType.startsWith('VILLA') || propType === 'VL' ? 'Villa Number' : 'Plot Number';
                    return (
                      <div className="mt-3 pt-3 border-t border-warm-border/70">
                        <div className="max-w-xs">
                          <label className={labelCls}>{unitLabel}</label>
                          <div className={`${readOnlyCls} bg-white`}>{decodeEntities(editing.villa_plot_number)}</div>
                        </div>
                      </div>
                    );
                  }

                  const numBlocks = editing.number_of_blocks || Object.keys(blockNames).length || 1;

                  // GC/APT with several blocks - one chip per block, wrapped on a single line
                  if (numBlocks > 1 || Object.keys(blockNames).length > 0) {
                    return (
                      <div className="mt-3 pt-2.5 border-t border-warm-border/70 flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-medium text-warm-muted mr-1">
                          <Building2 className="w-3.5 h-3.5" /> Blocks:
                        </span>
                        {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                          const unitTypes = blockUnitTypes?.[blockNum] || blockUnitTypes?.[String(blockNum)] || {};
                          const typeText = Object.entries(unitTypes).filter(([, c]) => c > 0).map(([t, c]) => `${c}×${unitTypeLabels[t] || t}`).join(' ');
                          return (
                            <span key={blockNum} className="px-2 py-0.5 bg-white border border-warm-border rounded text-xs text-warm-text whitespace-nowrap">
                              {decodeEntities(blockNames?.[blockNum] || blockNames?.[String(blockNum)]) || `Block ${blockNum}`} · {unitsPerBlock?.[blockNum] || unitsPerBlock?.[String(blockNum)] || 0} units{typeText ? ` (${typeText})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    );
                  }

                  // Single block (APT): tower/building name + block number
                  if (editing.tower_name || editing.block_number) {
                    const aptTypes = blockUnitTypes?.['apt'] || blockUnitTypes?.[1] || blockUnitTypes?.['1'] || {};
                    const hasAptTypes = Object.values(aptTypes).some(v => v > 0);
                    return (
                      <div className="mt-3 pt-3 border-t border-warm-border/70">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {editing.tower_name && (
                            <div className="min-w-0"><label className={labelCls}>Tower / Building Name</label><div className={`${readOnlyCls} bg-white`}>{decodeEntities(editing.tower_name)}</div></div>
                          )}
                          {editing.block_number && (
                            <div className="min-w-0"><label className={labelCls}>Block Number</label><div className={`${readOnlyCls} bg-white`}>{decodeEntities(editing.block_number)}</div></div>
                          )}
                        </div>
                        {hasAptTypes && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {Object.entries(aptTypes).filter(([, count]) => count > 0).map(([type, count]) => (
                              <span key={type} className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">
                                {unitTypeLabels[type] || type}: {count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Editable answers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Lead Source</label>
                  <select value={form.lead_source} onChange={(e) => setField('lead_source', e.target.value)} className={`${inputCls} ${form.lead_source ? 'text-warm-text' : 'text-warm-muted'}`}>
                    <option value="" className="text-warm-muted">Select lead source</option>
                    {LEAD_SOURCE_OPTIONS.map(o => <option key={o} value={o} className="text-warm-text">{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={form.priority} onChange={(e) => setField('priority', e.target.value)} className={`${inputCls} ${form.priority ? 'text-warm-text' : 'text-warm-muted'}`}>
                    <option value="" className="text-warm-muted">Select priority</option>
                    {PRIORITY_OPTIONS.map(o => <option key={o} value={o} className="text-warm-text">{o}</option>)}
                  </select>
                </div>
              </div>

              {radioField('Current Maintenance System', 'maintenance_system', 'maintenance_system_other', MAINTENANCE_OPTIONS, false)}
              {radioField('Proposal Sent', 'proposal_given', 'proposal_given_other', PROPOSAL_OPTIONS, true)}
              {radioField('Customer Decision', 'customer_decision', 'customer_decision_other', DECISION_OPTIONS, true)}

              {/* The follow-up columns are edited in the table, a row at a time, not here: this
                  view is the estimate and the answers taken on the visit. They are still carried
                  in the payload below -- the form holds what openEditor loaded, so saving from
                  here leaves a row's follow-up exactly as the table left it rather than clearing
                  it. */}

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-warm-border">
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-muted border border-warm-border hover:bg-warm-section transition-colors"
                >
                  {canEdit ? 'Cancel' : 'Close'}
                </button>
                {canEdit && <button
                  onClick={saveTracker}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>}
              </div>
            </div>
          </Modal>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <Modal overlayClassName="lg:pl-72" onClose={() => setArchiveTarget(null)} className="w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-warm-text mb-2">Move to Archived?</h3>
            <p className="text-sm text-warm-muted mb-5">
              <span className="font-medium text-warm-text">{archiveTarget.estimate_id}</span> will leave the tracker. You can restore it from Marketing &gt; Archived.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 border border-warm-border rounded-[10px] text-sm text-warm-text hover:bg-warm-section transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => archiveRow(archiveTarget)}
                className="px-4 py-2 bg-red-600 text-white rounded-[10px] text-sm hover:bg-red-700 transition-colors"
              >
                Move to Archived
              </button>
            </div>
          </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-[10px] shadow-lg text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default MarketingTracker;
