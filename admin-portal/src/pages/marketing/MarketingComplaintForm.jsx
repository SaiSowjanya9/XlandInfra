import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileWarning, Megaphone, Plus, X, Loader2, AlertCircle, Pencil, Trash2, Search, Building2 } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { decodeEntities } from '../../utils/text';
import EmptyState from '../../components/common/EmptyState';
import { useFP } from '../../contexts/FPContext';
import { getMarketingApiPath, marketingFpId, withMarketingFp, canLogComplaint, marketingPermissions } from '../../utils/marketingApi';
import { formatDate } from '../../utils/dateFormat';
import DismissPanel from '../../components/common/DismissPanel';
import Modal from '../../components/common/Modal';

const API_BASE = import.meta.env.VITE_API_URL || '';

// The concern options the form offers -- the same set the "XLAND Customer complaints form" uses.
// Keep these in step with CONCERN_OPTIONS in backend/routes/franchisePartner.js -- the route
// refuses anything outside them. 'Other' carries its free text in concern_with_other.
const CONCERN_OPTIONS = ['Service Delay', 'Poor Quality Work', 'Incomplete Work', 'Safety Issue', 'Vendor Issue', 'Maintenance Issue', 'Pricing/Payments', 'Other'];


// A saved concern is a fixed option or, where the option is "Other", the typed text alongside it.
const displayConcern = (complaint) => {
  const value = decodeEntities(complaint.concern_with || '');
  if (!value) return '-';
  if (value === 'Other') return decodeEntities(complaint.concern_with_other || '') || 'Other';
  return value;
};

const emptyComplaintForm = {
  property_id: '',
  zone: '',
  responsible_person: '',
  concern_with: '',
  concern_with_other: '',
  contact_person_name: '',
  phone_number: '',
  comments: '',
};

// Shared by the FP, admin and Ops Manager portals; `portalType` picks the API prefix and, for the
// admin, the partner a complaint is filed against. See utils/marketingApi.js.
const MarketingComplaintForm = ({ user, portalType = 'franchise' }) => {
  const token = getAuthToken();
  const apiPath = getMarketingApiPath(portalType);
  const { selectedFp } = useFP();
  const fpId = marketingFpId(portalType, selectedFp);
  const showPartner = apiPath === 'admin';
  // A complaint is owned by exactly one partner, so an admin looking at every partner has to pick
  // one before the form can be saved -- the server answers 400 without it, and a Save that cannot
  // succeed is worse than a button that says why.
  // The coordinator and executive portals read this list; only the portals that own the records
  // may add to or change it. The server refuses the rest regardless.
  const { canEdit } = marketingPermissions(portalType);
  const canCreate = canEdit && canLogComplaint(portalType, selectedFp);
  // Marketing belongs to the franchise partner account inside the FP portal, so an FP's own
  // manager is refused there. These same screens are the Ops Manager portal's own Marketing
  // section, where a 'manager' role is exactly who they are for -- so what decides is the portal,
  // not the role on its own.
  const unavailable = portalType === 'franchise' && user?.role === 'manager';

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create' | 'edit' | 'view', row }
  const [form, setForm] = useState(emptyComplaintForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [properties, setProperties] = useState([]);
  const [showPropertySuggestions, setShowPropertySuggestions] = useState(false);
  // True while the Zone text came from a property match rather than the keyboard, so a Property ID
  // that stops matching only clears what the page itself filled in -- never a hand-typed zone.
  const zoneAutoFilled = useRef(false);

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/complaints`, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setComplaints(result.data || []);
      } else {
        setLoadError(result.message || 'Failed to load complaints.');
      }
    } catch (e) {
      setLoadError('Failed to load complaints. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, apiPath, fpId]);

  // The Property ID box matches against the onboarded properties this portal can see (the same
  // list its estimate screens use), so the suggestions follow the caller's own scope.
  const loadProperties = useCallback(async () => {
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/properties`, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) setProperties(Array.isArray(result.data) ? result.data : []);
    } catch (e) { /* suggestions just stay empty */ }
  }, [token, apiPath, fpId]);

  useEffect(() => { if (!unavailable) loadComplaints(); }, [unavailable, loadComplaints]);
  useEffect(() => { if (!unavailable) loadProperties(); }, [unavailable, loadProperties]);

  // A property's zone rides under three names depending on how the record was saved.
  const zoneOf = (p) => decodeEntities(p?.zone_name || p?.zoneName || p?.zone || '');

  // Typing a Property ID that exactly matches an onboarded property fills its Zone; drifting away
  // from a match clears only an auto-filled zone, leaving anything the user typed alone.
  const handlePropertyIdChange = (value) => {
    const match = properties.find(p => p.property_id?.toLowerCase() === value.trim().toLowerCase());
    setForm(prev => ({
      ...prev,
      property_id: value,
      zone: match ? zoneOf(match) : (zoneAutoFilled.current ? '' : prev.zone)
    }));
    zoneAutoFilled.current = !!match;
    setShowPropertySuggestions(true);
  };

  const applyProperty = (p) => {
    setForm(prev => ({ ...prev, property_id: p.property_id || '', zone: zoneOf(p) }));
    zoneAutoFilled.current = true;
    setShowPropertySuggestions(false);
  };

  const propertyQuery = (form.property_id || '').trim().toLowerCase();
  const propertySuggestions = propertyQuery
    ? properties.filter(p =>
        p.property_id?.toLowerCase().includes(propertyQuery) ||
        decodeEntities(p.name || p.community_name || p.property_name || '').toLowerCase().includes(propertyQuery)
      ).slice(0, 8)
    : [];

  const openCreate = () => {
    setForm(emptyComplaintForm);
    zoneAutoFilled.current = false;
    setFormError('');
    setModal({ mode: 'create', row: null });
  };

  // Stored text is HTML-escaped, so decode what the form loads before it is edited -- otherwise
  // saving would escape the escapes.
  const openEdit = (row) => {
    setForm({
      property_id: decodeEntities(row.property_id || ''),
      zone: decodeEntities(row.zone || ''),
      responsible_person: decodeEntities(row.responsible_person || ''),
      concern_with: decodeEntities(row.concern_with || ''),
      concern_with_other: decodeEntities(row.concern_with_other || ''),
      contact_person_name: decodeEntities(row.contact_person_name || ''),
      phone_number: decodeEntities(row.phone_number || ''),
      comments: decodeEntities(row.comments || ''),
    });
    zoneAutoFilled.current = false; // a saved zone is treated as the user's own, not auto-filled
    setFormError('');
    setModal({ mode: 'edit', row });
  };

  const openView = (row) => {
    setFormError('');
    setModal({ mode: 'view', row });
  };

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const saveComplaint = async () => {
    // Every field is required, exactly as the form marks them.
    const errors = [];
    if (!form.property_id.trim()) errors.push('Property ID is required');
    if (!form.zone.trim()) errors.push('Zone is required');
    if (!form.responsible_person.trim()) errors.push('Responsible person is required');
    if (!form.concern_with) errors.push('Concern With is required');
    if (form.concern_with === 'Other' && !form.concern_with_other.trim()) errors.push('Please specify the concern');
    if (!form.contact_person_name.trim()) errors.push('Contact Person Name is required');
    if (!/^\d{10}$/.test(form.phone_number)) errors.push('Phone number must be 10 digits');
    if (!form.comments.trim()) errors.push('Comments are required');
    if (errors.length) { setFormError(errors.join('. ')); return; }

    setSaving(true);
    setFormError('');
    try {
      const editing = modal.mode === 'edit';
      const res = await fetch(withMarketingFp(editing
        ? `${API_BASE}/api/${apiPath}/marketing/complaints/${modal.row.id}`
        : `${API_BASE}/api/${apiPath}/marketing/complaints`, fpId), {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await res.json();
      if (result.success) {
        showToast(editing ? 'Complaint updated' : 'Complaint logged');
        setModal(null);
        loadComplaints();
      } else {
        setFormError(result.message || 'Failed to save.');
      }
    } catch (e) {
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Soft delete: the row leaves this list and lands in Marketing > Archived, Complaint Forms tab.
  const archiveRow = async (row) => {
    setArchiveTarget(null);
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/complaints/${row.id}/archive`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setComplaints(prev => prev.filter(c => c.id !== row.id));
        showToast('Moved to Archived');
      } else {
        showToast(result.message || 'Failed to archive.', 'error');
      }
    } catch (e) {
      showToast('Failed to archive. Please try again.', 'error');
    }
  };

  const inputCls = 'w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20';
  const labelCls = 'block text-xs font-medium text-warm-muted mb-1';
  const readOnlyCls = 'w-full min-w-0 px-2.5 py-1 border border-warm-border rounded-md text-sm text-warm-text whitespace-pre-wrap bg-warm-section [overflow-wrap:anywhere]';

  const autoGrowField = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } };

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
            <FileWarning className="w-5 h-5 text-warm-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-warm-text">Complaint Form</h1>
          </div>
        </div>
        <button
          onClick={openCreate}
          disabled={!canCreate}
          title={canCreate ? undefined : 'Select a franchise partner to log a complaint against'}
          className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#B5812A]"
        >
          <Plus className="w-4 h-4" /> New Complaint
        </button>
      </div>

      {/* All complaints */}
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
            <span className="ml-2 text-warm-muted">Loading complaints...</span>
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            title="No complaints logged yet"
            description="Log a customer complaint to see it here"
            action={(
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors"
              >
                <Plus className="w-4 h-4" /> New Complaint
              </button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-border bg-warm-section">
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Property ID</th>
                  {/* On the admin portal the list carries several franchises at once, so the row
                      has to say which one the complaint belongs to. */}
                  {showPartner && <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Franchise Partner</th>}
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Zone</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Responsible Person</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Concern</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Contact Person</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Logged On</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openView(row)}
                    className="border-b border-warm-border/70 hover:bg-warm-section cursor-pointer transition-colors"
                    title="Click to view"
                  >
                    <td className="py-3 px-4 font-medium text-warm-text whitespace-nowrap">{decodeEntities(row.property_id) || '-'}</td>
                    {showPartner && <td className="py-3 px-4 text-warm-muted">{decodeEntities(row.franchise_partner_name) || '-'}</td>}
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(row.zone) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(row.responsible_person) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text max-w-[180px]"><span className="block truncate" title={displayConcern(row)}>{displayConcern(row)}</span></td>
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(row.contact_person_name) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">{decodeEntities(row.phone_number) || '-'}</td>
                    <td className="py-3 px-4 text-warm-muted whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {canEdit && <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-lg text-warm-muted hover:bg-warm-border/60 hover:text-warm-text transition-colors"
                          title="Edit complaint"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>}
                        {canEdit && <button
                          onClick={() => setArchiveTarget(row)}
                          className="p-1.5 rounded-lg text-warm-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Move to Archived"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Create / edit / view modal. Backdrop covers the viewport, but the card centers in the
          content area -- the expanded FP sidebar is 288px (lg:w-72), so pad the flex row by that much. */}
      {modal && (
        <Modal overlayClassName="lg:pl-72" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-warm-border bg-warm-section rounded-t-xl">
              <div>
                <h3 className="text-base font-semibold text-warm-text">
                  {modal.mode === 'create' ? 'New Complaint' : modal.mode === 'edit' ? 'Edit Complaint' : 'Complaint Details'}
                </h3>
                {modal.row && (
                  <p className="text-xs text-warm-muted">{decodeEntities(modal.row.property_id) || '-'} · logged {formatDate(modal.row.created_at)}</p>
                )}
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-warm-border/60 transition-colors" title="Close">
                <X className="w-5 h-5 text-warm-muted" />
              </button>
            </div>

            {modal.mode === 'view' ? (
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0"><label className={labelCls}>Property ID</label><div className={readOnlyCls}>{decodeEntities(modal.row.property_id) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Zone</label><div className={readOnlyCls}>{decodeEntities(modal.row.zone) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Responsible Person</label><div className={readOnlyCls}>{decodeEntities(modal.row.responsible_person) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Concern With</label><div className={readOnlyCls}>{displayConcern(modal.row)}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Contact Person Name</label><div className={readOnlyCls}>{decodeEntities(modal.row.contact_person_name) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Phone Number</label><div className={readOnlyCls}>{decodeEntities(modal.row.phone_number) || '-'}</div></div>
                </div>
                <div className="min-w-0"><label className={labelCls}>Comments</label><div className={readOnlyCls}>{decodeEntities(modal.row.comments) || '-'}</div></div>
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-warm-border">
                  <button
                    onClick={() => openEdit(modal.row)}
                    className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => setModal(null)}
                    className="px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label className={labelCls}>Property ID <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.property_id}
                        maxLength={255}
                        onChange={(e) => handlePropertyIdChange(e.target.value)}
                        onFocus={() => setShowPropertySuggestions(true)}
                        onBlur={() => setTimeout(() => setShowPropertySuggestions(false), 200)}
                        className={`${inputCls} pr-9`}
                        placeholder="Enter property ID"
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted pointer-events-none" />
                      <DismissPanel open={showPropertySuggestions && propertySuggestions.length > 0} onDismiss={() => setShowPropertySuggestions(false)} className="absolute z-20 w-full mt-1 bg-white border border-warm-border rounded-[10px] shadow-lg max-h-56 overflow-y-auto">
                          {propertySuggestions.map(p => (
                            <button
                              key={p.id || p.property_id}
                              type="button"
                              onClick={() => applyProperty(p)}
                              className="w-full px-3 py-2 text-left hover:bg-warm-section flex items-center gap-3"
                            >
                              <Building2 className="w-4 h-4 text-warm-muted shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-warm-text [overflow-wrap:anywhere]">{p.property_id}</p>
                                <p className="text-xs text-warm-muted [overflow-wrap:anywhere]">{decodeEntities(p.name || p.community_name || p.property_name || '-')}</p>
                              </div>
                            </button>
                          ))}
                        </DismissPanel>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Zone <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={form.zone}
                      maxLength={255}
                      onChange={(e) => { zoneAutoFilled.current = false; setField('zone', e.target.value); }}
                      className={inputCls}
                      placeholder="Auto-filled from Property ID"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Responsible Person <span className="text-red-500">*</span></label>
                    <input type="text" value={form.responsible_person} maxLength={255} onChange={(e) => setField('responsible_person', e.target.value)} className={inputCls} placeholder="Enter responsible person" />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Contact Person Name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.contact_person_name} maxLength={255} onChange={(e) => setField('contact_person_name', e.target.value)} className={inputCls} placeholder="Enter contact person name" />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Phone Number <span className="text-red-500">*</span></label>
                    <input type="tel" value={form.phone_number} maxLength={10} onChange={(e) => setField('phone_number', e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder="10-digit phone number" />
                  </div>
                </div>

                {/* Concern With -- the option list is fixed; 'Other' carries its typed text */}
                <div>
                  <label className={labelCls}>Concern With <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
                    {CONCERN_OPTIONS.map(option => (
                      <label key={option} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="complaint-concern"
                          checked={form.concern_with === option}
                          onChange={() => setField('concern_with', option)}
                          className="w-4 h-4 border-warm-border text-warm-accent focus:ring-warm-accent/30 flex-shrink-0"
                        />
                        <span className="text-sm text-warm-text">{option === 'Other' ? 'Other:' : option}</span>
                      </label>
                    ))}
                  </div>
                  {form.concern_with === 'Other' && (
                    <textarea
                      ref={autoGrowField}
                      onInput={(e) => autoGrowField(e.currentTarget)}
                      value={form.concern_with_other}
                      onChange={(e) => setField('concern_with_other', e.target.value)}
                      maxLength={255}
                      rows={1}
                      placeholder="Please specify"
                      className="mt-2 w-full px-2.5 py-1.5 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white resize-none overflow-hidden focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20"
                    />
                  )}
                </div>

                <div className="min-w-0">
                  <label className={labelCls}>Comments <span className="text-red-500">*</span></label>
                  <textarea
                    value={form.comments}
                    maxLength={4000}
                    onChange={(e) => setField('comments', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20 resize-y"
                    placeholder="Describe the complaint"
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{formError}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-warm-border">
                  <button
                    onClick={() => setModal(null)}
                    className="px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-muted border border-warm-border hover:bg-warm-section transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveComplaint}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors disabled:opacity-60"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Saving...' : modal.mode === 'edit' ? 'Save Changes' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </Modal>
      )}

      {/* Archive confirmation -- same backdrop offset as the form modal so the card
          centers in the content area beside the expanded sidebar. */}
      {archiveTarget && (
        <Modal overlayClassName="lg:pl-72" onClose={() => setArchiveTarget(null)} className="w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-warm-text mb-2">Move to Archived?</h3>
            <p className="text-sm text-warm-muted mb-5">
              The complaint for <span className="font-medium text-warm-text">{decodeEntities(archiveTarget.property_id) || 'this property'}</span> will leave this list. You can restore it from Marketing &gt; Archived.
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

export default MarketingComplaintForm;
