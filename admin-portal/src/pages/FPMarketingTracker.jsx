import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Target, Plus, X, Loader2, AlertCircle, ArrowLeft,
  ClipboardList, FileText
} from 'lucide-react';
import { getAuthToken } from '../utils/safeStorage';
import { decodeEntities } from '../utils/text';
import EmptyState from '../components/common/EmptyState';

const API_BASE = import.meta.env.VITE_API_URL || '';

// The five answers the tracker collects on a direct estimate. Keep these option sets in step with
// TRACKER_OPTIONS in backend/routes/franchisePartner.js -- the route refuses anything outside them.
const LEAD_SOURCE_OPTIONS = ['WhatsApp', 'Phone Call', 'Website', 'Social Media', 'Existing Customer', 'Walk-in', 'Office Visit', 'Other'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const MAINTENANCE_OPTIONS = ['Self-managed', 'Existing Vendor', 'Association Managed', 'No System', 'Other'];
const PROPOSAL_OPTIONS = ['Yes', 'No', 'Other'];
const DECISION_OPTIONS = ['Interested', 'Interested Need Follow-up', 'Not Interested', 'Need Follow-up', 'Competitor Selected', 'Other'];

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
};

const PRIORITY_STYLES = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-warm-warning text-amber-700 border-[#F3E2B3]',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Urgent: 'bg-red-50 text-red-700 border-red-200',
};

const FPMarketingTracker = ({ user }) => {
  const token = getAuthToken();
  const isFPManager = user?.role === 'manager';

  const [view, setView] = useState('tracker'); // 'tracker' list | 'pick' a direct estimate
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // the estimate open in the modal
  const [form, setForm] = useState(emptyTrackerForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };

  const loadEstimates = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_BASE}/api/fp/marketing/tracker`, {
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
  }, [token]);

  useEffect(() => { if (!isFPManager) loadEstimates(); }, [isFPManager, loadEstimates]);

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
    });
    setFormError('');
  };

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const saveTracker = async () => {
    // The required pair, and an Other that has nothing typed, are the only ways to fail here.
    const errors = [];
    if (!form.proposal_given) errors.push('Proposal Given is required');
    if (!form.customer_decision) errors.push('Customer Decision is required');
    if (form.maintenance_system === 'Other' && !form.maintenance_system_other.trim()) errors.push('Enter the current maintenance system');
    if (form.proposal_given === 'Other' && !form.proposal_given_other.trim()) errors.push('Enter the proposal details');
    if (form.customer_decision === 'Other' && !form.customer_decision_other.trim()) errors.push('Enter the customer decision');
    if (errors.length) { setFormError(errors.join('. ')); return; }

    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(`${API_BASE}/api/fp/marketing/tracker/${editing.id}`, {
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
  const labelCls = 'block text-xs font-medium text-warm-muted mb-1.5';
  const readOnlyCls = 'min-h-[42px] w-full min-w-0 px-3 py-2 border border-warm-border rounded-[10px] text-sm leading-6 text-warm-text whitespace-pre-wrap bg-warm-section [overflow-wrap:anywhere]';

  const radioField = (title, field, otherField, options, required) => (
    <div>
      <label className={labelCls}>{title} {required && <span className="text-red-500">*</span>}</label>
      <div className="space-y-2.5 pt-1">
        {options.map(option => (
          <label key={option} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={`tracker-${field}`}
              checked={form[field] === option}
              onChange={() => setField(field, option)}
              className="w-4 h-4 border-warm-border text-warm-accent focus:ring-warm-accent/30"
            />
            <span className="text-sm text-warm-text">{option === 'Other' && otherField ? 'Other:' : option}</span>
            {option === 'Other' && otherField && form[field] === 'Other' && (
              <input
                type="text"
                value={form[otherField]}
                onChange={(e) => setField(otherField, e.target.value)}
                maxLength={255}
                placeholder="Please specify"
                className="flex-1 h-9 px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );

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
        {view === 'tracker' && (
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
            ) : estimates.length === 0 ? (
              <EmptyState icon={FileText} title="No direct estimates found" description="Create a direct estimate first to track it here" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-warm-border bg-warm-section">
                      <th className="text-left py-3 px-3 font-medium text-warm-muted">Estimate ID</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted">Customer</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted">Property Type</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted">Status</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted">Visit Date</th>
                      <th className="text-left py-3 px-3 font-medium text-warm-muted">Executive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((est) => (
                      <tr
                        key={est.id}
                        onClick={() => openEditor(est)}
                        className="border-b border-warm-border/70 hover:bg-warm-section cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3 font-medium text-warm-text">{est.estimate_id}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-warm-text">{decodeEntities(est.client_name) || '-'}</div>
                          <div className="text-xs text-warm-muted">{decodeEntities(est.property_name) || '-'}</div>
                        </td>
                        <td className="py-3 px-3 text-warm-muted">{est.property_type || '-'}</td>
                        <td className="py-3 px-3">
                          {est.tracked_at ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Tracked</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-warm-warning text-amber-700 border border-[#F3E2B3]">New</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-warm-muted">{formatDate(est.created_at)}</td>
                        <td className="py-3 px-3 text-warm-muted">{decodeEntities(est.created_by_name) || '-'}</td>
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
              description={untrackedEstimates.length > 0 ? 'Click New to track a direct estimate' : 'Create a direct estimate first, then track it here'}
              action={untrackedEstimates.length > 0 ? (
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-border bg-warm-section">
                    <th className="text-left py-3 px-4 font-medium text-warm-muted">Estimate ID</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Customer</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Visit Date</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Executive</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Lead Source</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Priority</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Proposal</th>
                    <th className="text-left py-3 px-3 font-medium text-warm-muted">Customer Decision</th>
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
                      <td className="py-3 px-4 font-medium text-warm-text">{est.estimate_id}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-warm-text">{decodeEntities(est.client_name) || '-'}</div>
                        <div className="text-xs text-warm-muted">{decodeEntities(est.property_name) || '-'}</div>
                      </td>
                      <td className="py-3 px-3 text-warm-muted">{formatDate(est.created_at)}</td>
                      <td className="py-3 px-3 text-warm-muted">{decodeEntities(est.created_by_name) || '-'}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl border border-warm-border shadow-warm w-full max-w-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-warm-border bg-warm-section rounded-t-xl">
              <div>
                <h3 className="text-base font-semibold text-warm-text">Track Estimate</h3>
                <p className="text-xs text-warm-muted">{editing.estimate_id} · {decodeEntities(editing.client_name) || '-'}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-warm-border/60 transition-colors" title="Close">
                <X className="w-5 h-5 text-warm-muted" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Automated estimate details */}
              <div className="bg-warm-section/60 border border-warm-border rounded-[10px] p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className={labelCls}>Estimate ID</label><div className={readOnlyCls}>{editing.estimate_id}</div></div>
                  <div><label className={labelCls}>Customer Name</label><div className={readOnlyCls}>{decodeEntities(editing.client_name) || '-'}</div></div>
                  <div><label className={labelCls}>Visit Date</label><div className={readOnlyCls}>{formatDate(editing.created_at)}</div></div>
                  <div><label className={labelCls}>Executive Name</label><div className={readOnlyCls}>{decodeEntities(editing.created_by_name) || '-'}</div></div>
                  <div><label className={labelCls}>Phone</label><div className={readOnlyCls}>{decodeEntities(editing.client_phone) || '-'}</div></div>
                  <div><label className={labelCls}>Email</label><div className={readOnlyCls}>{decodeEntities(editing.client_email) || '-'}</div></div>
                  <div><label className={labelCls}>Property Type</label><div className={readOnlyCls}>{editing.property_type || '-'}</div></div>
                  <div><label className={labelCls}>No. of Units</label><div className={readOnlyCls}>{editing.total_units ?? '-'}</div></div>
                </div>
              </div>

              {/* Editable answers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {radioField('Proposal Given', 'proposal_given', 'proposal_given_other', PROPOSAL_OPTIONS, true)}
              {radioField('Customer Decision', 'customer_decision', 'customer_decision_other', DECISION_OPTIONS, true)}

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
                  Cancel
                </button>
                <button
                  onClick={saveTracker}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
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

export default FPMarketingTracker;
