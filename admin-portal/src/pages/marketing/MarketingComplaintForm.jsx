import ViewModal, { ViewSection, ViewField, ViewGrid } from '../../components/common/ViewModal';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileWarning, Megaphone, Plus, X, Loader2, AlertCircle, Pencil, Trash2, Search, Building2,
  MessageSquare, UserPlus, UserMinus, Lock, CheckCircle2, MapPin, Inbox
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { decodeEntities } from '../../utils/text';
import EmptyState from '../../components/common/EmptyState';
import { useFP } from '../../contexts/FPContext';
import { getMarketingApiPath, marketingFpId, withMarketingFp, canLogComplaint, marketingPermissions } from '../../utils/marketingApi';
import {
  COMPLAINT_STATUSES, complaintStatusesFor, canNoteOnComplaint, complaintStatusStyle,
  normalizeComplaintStatus
} from '../../utils/complaintStatus';
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

// Rows written before schema_v51 carry no status at all, and a complaint nobody has touched is
// Open; rows written before schema_v54 carry one of the two statuses In Review replaced.
const statusOf = (complaint) => normalizeComplaintStatus(decodeEntities(complaint?.status || ''));

// "Priya N (Coordinator)" -- the role is stamped on the row at assignment, so a renamed or removed
// employee still reads.
const assigneeLabel = (complaint) => {
  const name = decodeEntities(complaint?.assigned_employee_name || '');
  if (!name) return '';
  const role = decodeEntities(complaint?.assigned_employee_role_label || '');
  return role ? `${name} (${role})` : name;
};

// Who last touched the note or the status, for the view modal's small print. The role is not
// repeated here -- it is already against the name in Assigned To, and the server stores it as a
// code the browser has no copy of the labels for.
const stampLine = (by, at) => {
  const name = decodeEntities(by || '');
  if (!name) return '';
  return at ? `${name} · ${formatDate(at)}` : name;
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
  // canAssign is the franchise partner's own; canClose is the review the FP and its manager make,
  // and closing a complaint is also what archives it. Reporting on a complaint assigned to *this*
  // employee is decided per row, by `assigned_to_me`, not per portal.
  const { canEdit, canAssign, canClose } = marketingPermissions(portalType);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // The employee's own view of the list: "what has been handed to me", which is how an assignment
  // is checked in their portal.
  const [mineOnly, setMineOnly] = useState(false);
  const [zoneOptions, setZoneOptions] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  // The note bubble in the Actions column, exactly as the marketing tracker's works: noteTarget is
  // the complaint whose lightbox is open, noteEditing flips it between reading and writing.
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  // Assigning: the complaint being handed over, and the partner's assignable employees with the
  // ones covering its zone marked as recommended.
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignEmployees, setAssignEmployees] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(null);
  const [assignError, setAssignError] = useState('');
  // Closing archives the complaint, so it is confirmed rather than saved straight from the dropdown.
  const [closeTarget, setCloseTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(null);
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

  // The filter dropdowns list every zone and employee this portal can see, not only the
  // ones complaints already name -- the zones route is the same merged list the customer
  // forms use, and the employees route is each portal's own roster (the admin's spans all
  // partners). Either may fail where the caller has no roster, and that is fine: names
  // saved on complaints are merged in below, so the filters never lose a value in use.
  const loadZones = useCallback(async () => {
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/zones`, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setZoneOptions((result.data || []).map(z => decodeEntities(z.name || '')).filter(Boolean));
      }
    } catch (e) { /* the saved zones still reach the dropdown via the merge below */ }
  }, [token, apiPath, fpId]);

  const loadEmployees = useCallback(async () => {
    try {
      const url = apiPath === 'admin'
        ? `${API_BASE}/api/admin/all-employees`
        : `${API_BASE}/api/${apiPath}/employees`;
      const res = await fetch(withMarketingFp(url, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      const list = Array.isArray(result.data) ? result.data : (Array.isArray(result.employees) ? result.employees : []);
      const names = list
        .map(e => decodeEntities(e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.username || ''))
        .filter(Boolean);
      setEmployeeOptions([...new Set(names)]);
    } catch (e) { /* same -- responsible persons on complaints still reach the dropdown */ }
  }, [token, apiPath, fpId]);

  useEffect(() => { if (!unavailable) loadComplaints(); }, [unavailable, loadComplaints]);
  useEffect(() => { if (!unavailable) loadProperties(); }, [unavailable, loadProperties]);
  useEffect(() => { if (!unavailable) loadZones(); }, [unavailable, loadZones]);
  useEffect(() => { if (!unavailable) loadEmployees(); }, [unavailable, loadEmployees]);

  // The dropdown options are the roster plus whatever the saved complaints already carry,
  // so a zone or person that is no longer in the roster still filters its own rows.
  const zoneNames = useMemo(() => {
    const names = new Set(zoneOptions);
    complaints.forEach(c => { const z = decodeEntities(c.zone || '').trim(); if (z) names.add(z); });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [zoneOptions, complaints]);

  const employeeNames = useMemo(() => {
    const names = new Set(employeeOptions);
    complaints.forEach(c => { const p = decodeEntities(c.responsible_person || '').trim(); if (p) names.add(p); });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [employeeOptions, complaints]);

  // Property ID -> display name, so the search also answers a customer typing the
  // community's name rather than its GC-… code.
  const propertyNameByCode = useMemo(() => {
    const map = {};
    properties.forEach(p => {
      if (p.property_id) {
        map[p.property_id.toLowerCase()] = decodeEntities(p.community_name || p.name || p.property_name || '');
      }
    });
    return map;
  }, [properties]);

  // How many of these are this employee's own. The chip only appears where there are any, so the
  // FP and admin portals -- which are assigned nothing -- never see it.
  const mineCount = useMemo(() => complaints.filter(c => c.assigned_to_me).length, [complaints]);
  useEffect(() => { if (!mineCount) setMineOnly(false); }, [mineCount]);

  const filteredComplaints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return complaints.filter(c => {
      if (mineOnly && !c.assigned_to_me) return false;
      if (statusFilter && statusOf(c) !== statusFilter) return false;
      if (zoneFilter && decodeEntities(c.zone || '').trim() !== zoneFilter) return false;
      if (employeeFilter && decodeEntities(c.responsible_person || '').trim() !== employeeFilter) return false;
      if (q) {
        const haystack = [
          c.property_id,
          c.contact_person_name,
          c.assigned_employee_name,
          propertyNameByCode[decodeEntities(c.property_id || '').toLowerCase()]
        ].map(v => decodeEntities(v || '').toLowerCase());
        if (!haystack.some(v => v.includes(q))) return false;
      }
      return true;
    });
  }, [complaints, searchQuery, zoneFilter, employeeFilter, statusFilter, mineOnly, propertyNameByCode]);

  const filtersActive = !!(searchQuery.trim() || zoneFilter || employeeFilter || statusFilter || mineOnly);
  const clearFilters = () => {
    setSearchQuery(''); setZoneFilter(''); setEmployeeFilter(''); setStatusFilter(''); setMineOnly(false);
  };

  // ============================================
  // WORKFLOW -- assign, status, note
  // ============================================
  //
  // Open -> Assigned -> In Review -> Closed. The server is the authority on who may move a
  // complaint where (utils/complaintStatus.js mirrors it); every save below replies with the whole
  // row, which goes straight back into the list.
  //
  // The assignee has no status control: saving their note is the report, and the server moves the
  // row to In Review in the same write -- which is why saveNote applies its reply like any other
  // save rather than touching the status itself.

  const applySaved = (row) => {
    if (!row) return;
    setComplaints(prev => prev.map(c => (c.id === row.id ? row : c)));
    // The detail modal and the note lightbox can both be open over the row being saved, so they
    // are refreshed too rather than left holding the version from before the save.
    setModal(prev => (prev?.row?.id === row.id ? { ...prev, row } : prev));
    setNoteTarget(prev => (prev?.id === row.id ? row : prev));
  };

  // A closed complaint leaves the list, because closing is also what archives it.
  const dropRow = (id) => {
    setComplaints(prev => prev.filter(c => c.id !== id));
    setModal(prev => (prev?.row?.id === id ? null : prev));
    setNoteTarget(prev => (prev?.id === id ? null : prev));
  };

  const saveStatus = async (row, status) => {
    setStatusSaving(row.id);
    try {
      const res = await fetch(withMarketingFp(`${API_BASE}/api/${apiPath}/marketing/complaints/${row.id}/status`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await res.json();
      if (result.success) {
        if (status === 'Closed') dropRow(row.id); else applySaved(result.data);
        showToast(result.message || 'Status updated');
      } else {
        showToast(result.message || 'Failed to update status.', 'error');
      }
    } catch (e) {
      showToast('Failed to update status. Please try again.', 'error');
    } finally {
      setStatusSaving(null);
      setCloseTarget(null);
    }
  };

  // Choosing Closed asks first: it ends the complaint and moves it to Marketing > Archived.
  const chooseStatus = (row, status) => {
    if (!status || status === statusOf(row)) return;
    if (status === 'Closed') setCloseTarget(row); else saveStatus(row, status);
  };

  const loadAssignEmployees = useCallback(async (row) => {
    setAssignLoading(true);
    setAssignError('');
    try {
      const zone = encodeURIComponent(decodeEntities(row.zone || ''));
      const res = await fetch(withMarketingFp(
        `${API_BASE}/api/${apiPath}/marketing/complaints/employees?zone=${zone}`, fpId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) setAssignEmployees(result.data || []);
      else setAssignError(result.message || 'Failed to load employees.');
    } catch (e) {
      setAssignError('Failed to load employees. Please try again.');
    } finally {
      setAssignLoading(false);
    }
  }, [token, apiPath, fpId]);

  const openAssign = (row) => {
    setAssignTarget(row);
    setAssignEmployees([]);
    loadAssignEmployees(row);
  };

  // Locked once somebody has it. Assigning over an existing assignee used to be allowed, which made
  // the row the dialog marks "Current" a click that reset a complaint at In Review back to
  // Assigned, re-stamped who assigned it and re-announced it to the assignee and the resident. The
  // route refuses it too, so this is not the only guard.
  const assignTo = async (employee) => {
    if (assignTarget.assigned_employee_id) return;
    setAssignSaving(employee.id);
    setAssignError('');
    try {
      const res = await fetch(withMarketingFp(
        `${API_BASE}/api/${apiPath}/marketing/complaints/${assignTarget.id}/assign`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id })
      });
      const result = await res.json();
      if (result.success) {
        applySaved(result.data);
        setAssignTarget(null);
        showToast(result.message || 'Complaint assigned');
      } else {
        setAssignError(result.message || 'Failed to assign.');
      }
    } catch (e) {
      setAssignError('Failed to assign. Please try again.');
    } finally {
      setAssignSaving(null);
    }
  };

  // The way out of that lock: the complaint returns to Open with nobody on it. The dialog stays
  // open on the now-unlocked list, because taking it off one employee is almost always the first
  // half of handing it to another.
  const unassign = async () => {
    setAssignSaving('unassign');
    setAssignError('');
    try {
      const res = await fetch(withMarketingFp(
        `${API_BASE}/api/${apiPath}/marketing/complaints/${assignTarget.id}/unassign`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (result.success) {
        applySaved(result.data);
        setAssignTarget(result.data);
        showToast(result.message || 'Complaint unassigned');
      } else {
        setAssignError(result.message || 'Failed to unassign.');
      }
    } catch (e) {
      setAssignError('Failed to unassign. Please try again.');
    } finally {
      setAssignSaving(null);
    }
  };

  // The note lightbox. An existing note opens read-only with an Edit button, so a click meant only
  // to read never leaves a half-typed draft behind; an empty one goes straight to the box.
  const openNote = (row) => {
    setNoteTarget(row);
    setNoteText(decodeEntities(row.complaint_note || ''));
    setNoteEditing(canNoteOnComplaint(row, { canEdit }) && !row.complaint_note);
    setNoteError('');
  };

  const closeNote = () => { setNoteTarget(null); setNoteError(''); };

  // Cancel returns to the saved note when there is one; otherwise there was nothing to read and the
  // lightbox simply closes.
  const cancelNoteEdit = () => {
    setNoteError('');
    if (noteTarget?.complaint_note) {
      setNoteText(decodeEntities(noteTarget.complaint_note));
      setNoteEditing(false);
    } else {
      setNoteTarget(null);
    }
  };

  const saveNote = async () => {
    const text = noteText.trim();
    if (text.length > 500) { setNoteError('Note must be 500 characters or fewer.'); return; }
    setNoteSaving(true);
    setNoteError('');
    try {
      const res = await fetch(withMarketingFp(
        `${API_BASE}/api/${apiPath}/marketing/complaints/${noteTarget.id}/note`, fpId), {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: text })
      });
      const result = await res.json();
      if (result.success) {
        applySaved(result.data);
        setNoteText(decodeEntities(result.data?.complaint_note || ''));
        setNoteEditing(false);
        // The server's own message, because an assignee's save is also the status move: it says
        // the complaint is now In Review for the FP to verify, which 'Note saved' would hide.
        showToast(result.message || 'Note saved');
      } else {
        setNoteError(result.message || 'Failed to save note.');
      }
    } catch (e) {
      setNoteError('Failed to save note. Please try again.');
    } finally {
      setNoteSaving(false);
    }
  };

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
        {/* A portal that cannot log a complaint at all is not shown the button: disabled, it read
            "Select a franchise partner to log a complaint against", which is not why the coordinator,
            supervisor or executive portals cannot use it. Where the portal may log one and simply
            has not picked a partner yet (the admin), that is exactly what the tooltip says. */}
        {canEdit && (
          <button
            onClick={openCreate}
            disabled={!canCreate}
            title={canCreate ? undefined : 'Select a franchise partner to log a complaint against'}
            className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#B5812A]"
          >
            <Plus className="w-4 h-4" /> New Complaint
          </button>
        )}
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

        {/* Search + zone + employee filters */}
        {!loading && complaints.length > 0 && (
          <div className="px-6 pt-5 pb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-warm-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Property ID or customer name..."
                className="w-full h-[38px] pl-9 pr-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20"
              />
            </div>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={`h-[38px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20 ${zoneFilter ? 'text-warm-text' : 'text-warm-muted'}`}
            >
              <option value="">All Zones</option>
              {zoneNames.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className={`h-[38px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20 ${employeeFilter ? 'text-warm-text' : 'text-warm-muted'}`}
            >
              <option value="">All Employees</option>
              {employeeNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`h-[38px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20 ${statusFilter ? 'text-warm-text' : 'text-warm-muted'}`}
            >
              <option value="">All Statuses</option>
              {/* Closed complaints are archived, so they are read in Marketing > Archived rather
                  than filtered for here. */}
              {COMPLAINT_STATUSES.filter(s => s !== 'Closed').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {/* An employee's own view of the list -- what has been handed to them. Shown only where
                there is something assigned to this caller, so the FP and admin portals never see it. */}
            {mineCount > 0 && (
              <button
                type="button"
                onClick={() => setMineOnly(v => !v)}
                className={`inline-flex items-center gap-1.5 h-[38px] px-3 rounded-[10px] text-sm font-medium border transition-colors whitespace-nowrap ${
                  mineOnly
                    ? 'bg-warm-accent-soft border-warm-accent text-warm-accent'
                    : 'bg-white border-warm-border text-warm-muted hover:text-warm-text'
                }`}
              >
                <Inbox className="w-4 h-4" /> Assigned to me ({mineCount})
              </button>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-[38px] px-3 text-sm font-medium text-warm-muted hover:text-warm-text hover:bg-warm-section rounded-[10px] transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
            {filtersActive && (
              <span className="text-xs text-warm-muted whitespace-nowrap">
                {filteredComplaints.length} of {complaints.length}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
            <span className="ml-2 text-warm-muted">Loading complaints...</span>
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState
            icon={FileWarning}
            title="No complaints logged yet"
            description={canEdit
              ? 'Log a customer complaint to see it here'
              : 'Complaints for your zones, and any assigned to you, appear here'}
            action={canEdit ? (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors"
              >
                <Plus className="w-4 h-4" /> New Complaint
              </button>
            ) : undefined}
          />
        ) : filteredComplaints.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="w-8 h-8 mx-auto mb-2 text-warm-muted" strokeWidth={1.5} />
            <p className="text-sm text-warm-muted">No complaints match the current filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs font-medium text-warm-accent hover:underline"
            >
              Clear filters
            </button>
          </div>
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
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Assigned To</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Responsible Person</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Concern</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Contact Person</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Logged On</th>
                  <th className="text-left py-3 px-4 font-medium text-warm-muted whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((row) => {
                  // What this caller may do to this row. The status options come from the shared
                  // policy, so a portal never offers one whose save would answer 403 -- for an
                  // assignee that is none at all, and the cell is a badge.
                  const statusOptions = complaintStatusesFor({ canClose });
                  const canNote = canNoteOnComplaint(row, { canEdit });
                  return (
                  <tr
                    key={row.id}
                    onClick={() => openView(row)}
                    className={`border-b border-warm-border/70 hover:bg-warm-section cursor-pointer transition-colors ${row.assigned_to_me ? 'bg-warm-accent-soft/40' : ''}`}
                    title="Click to view"
                  >
                    <td className="py-3 px-4 font-medium text-warm-text whitespace-nowrap">{decodeEntities(row.property_id) || '-'}</td>
                    {showPartner && <td className="py-3 px-4 text-warm-muted">{decodeEntities(row.franchise_partner_name) || '-'}</td>}
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(row.zone) || '-'}</td>
                    {/* The status column. Only the FP and its manager may move a complaint by
                        hand; for everyone else -- the assignee included -- it is a badge, because
                        the assignee reports by saving their note and the server moves the row. */}
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {statusOptions.length ? (
                        <select
                          value={statusOf(row)}
                          disabled={statusSaving === row.id}
                          onChange={(e) => chooseStatus(row, e.target.value)}
                          className={`h-[30px] pl-2 pr-6 rounded-full text-[11px] font-medium border cursor-pointer appearance-none bg-no-repeat focus:outline-none focus:ring-2 focus:ring-warm-accent/20 disabled:opacity-60 ${complaintStatusStyle(statusOf(row))}`}
                          style={{ backgroundImage: 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236B7280\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.35rem center', backgroundSize: '0.85em' }}
                          title="Change status"
                        >
                          {/* The stored status is always listed, even where this caller could not
                              have set it -- a select whose value is missing shows the wrong row. */}
                          {[...new Set([statusOf(row), ...statusOptions])].map(s => (
                            <option key={s} value={s} disabled={!statusOptions.includes(s)}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${complaintStatusStyle(statusOf(row))}`}
                          title={row.assigned_to_me
                            ? 'Save your notes to report back — that moves this complaint to In Review'
                            : undefined}
                        >
                          {statusOf(row)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-warm-text">
                      {assigneeLabel(row)
                        ? <span className="whitespace-nowrap">{assigneeLabel(row)}</span>
                        : <span className="text-warm-muted">Unassigned</span>}
                    </td>
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(row.responsible_person) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text max-w-[180px]"><span className="block truncate" title={displayConcern(row)}>{displayConcern(row)}</span></td>
                    <td className="py-3 px-4 text-warm-text">{decodeEntities(row.contact_person_name) || '-'}</td>
                    <td className="py-3 px-4 text-warm-text whitespace-nowrap">{decodeEntities(row.phone_number) || '-'}</td>
                    <td className="py-3 px-4 text-warm-muted whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {/* The note bubble. The accent tint marks a row that already carries a
                            note, so a filled one is visible without opening it. */}
                        <button
                          onClick={() => openNote(row)}
                          className={`p-1.5 rounded-lg transition-colors ${row.complaint_note ? 'text-warm-accent hover:bg-warm-accent-soft' : 'text-warm-muted hover:bg-warm-border/60 hover:text-warm-text'}`}
                          title={row.complaint_note ? 'View notes' : (canNote ? 'Add notes' : 'No notes yet')}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {/* Verify and close, where the complaint has been reported back on. It is
                            the FP's and its manager's step, and it archives the row -- so it sits
                            in the list rather than only inside the detail modal. */}
                        {canClose && statusOf(row) !== 'Closed' && <button
                          onClick={() => setCloseTarget(row)}
                          className="p-1.5 rounded-lg text-warm-muted hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          title={statusOf(row) === 'In Review'
                            ? 'Verify the notes and close this complaint'
                            : 'Close this complaint'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>}
                        {canAssign && <button
                          onClick={() => openAssign(row)}
                          className="p-1.5 rounded-lg text-warm-muted hover:bg-warm-border/60 hover:text-warm-text transition-colors"
                          title={row.assigned_employee_id
                            ? `Assigned to ${assigneeLabel(row)} — unassign to hand it to someone else`
                            : 'Assign to an employee'}
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / edit / view modal. Backdrop covers the viewport, but the card centers in the
          content area -- the expanded FP sidebar is 288px (lg:w-72), so pad the flex row by that much. */}
      {modal && (
        <ViewModal onClose={() => setModal(null)}
          maxWidth="max-w-2xl"
        >

            {modal.mode === 'view' ? (
              <div className="p-5 space-y-3">
                {/* Where the complaint has got to, and with whom. The status is read here and set
                    from the list's own column, so it is never maintained in two places. */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${complaintStatusStyle(statusOf(modal.row))}`}>
                    {statusOf(modal.row)}
                  </span>
                  {assigneeLabel(modal.row) && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-warm-muted">
                      <UserPlus className="w-3.5 h-3.5" /> {assigneeLabel(modal.row)}
                    </span>
                  )}
                  {stampLine(modal.row.status_updated_by, modal.row.status_updated_at) && (
                    <span className="text-xs text-warm-muted">
                      · updated by {stampLine(modal.row.status_updated_by, modal.row.status_updated_at)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0"><label className={labelCls}>Property ID</label><div className={readOnlyCls}>{decodeEntities(modal.row.property_id) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Zone</label><div className={readOnlyCls}>{decodeEntities(modal.row.zone) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Responsible Person</label><div className={readOnlyCls}>{decodeEntities(modal.row.responsible_person) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Concern With</label><div className={readOnlyCls}>{displayConcern(modal.row)}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Contact Person Name</label><div className={readOnlyCls}>{decodeEntities(modal.row.contact_person_name) || '-'}</div></div>
                  <div className="min-w-0"><label className={labelCls}>Phone Number</label><div className={readOnlyCls}>{decodeEntities(modal.row.phone_number) || '-'}</div></div>
                </div>
                <div className="min-w-0"><label className={labelCls}>Comments</label><div className={readOnlyCls}>{decodeEntities(modal.row.comments) || '-'}</div></div>

                {/* The notes saved from the Actions column's bubble, read back here -- this is what
                    the FP and its manager verify before closing the complaint. Editing goes through
                    the same lightbox the bubble opens, so the text lives in one place. */}
                <div className="bg-warm-section/60 border border-warm-border rounded-[10px] p-3.5">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <label className="block text-xs font-medium text-warm-muted">Notes / Comments</label>
                    {canNoteOnComplaint(modal.row, { canEdit }) && (
                      <button
                        onClick={() => openNote(modal.row)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-warm-accent hover:text-warm-accent-hover transition-colors flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" /> {modal.row.complaint_note ? 'Edit' : 'Add notes'}
                      </button>
                    )}
                  </div>
                  <div className={`${readOnlyCls} bg-white`}>
                    {decodeEntities(modal.row.complaint_note || '') || '-'}
                  </div>
                  {stampLine(modal.row.note_updated_by, modal.row.note_updated_at) && (
                    <p className="mt-1.5 text-[11px] text-warm-muted">
                      Last saved by {stampLine(modal.row.note_updated_by, modal.row.note_updated_at)}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-warm-border">
                  {/* Closing is the review step, and it moves the complaint to Archived. */}
                  {canClose && statusOf(modal.row) !== 'Closed' && (
                    <button
                      onClick={() => setCloseTarget(modal.row)}
                      className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors mr-auto"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verify &amp; Close
                    </button>
                  )}
                  {canAssign && (
                    <button
                      onClick={() => openAssign(modal.row)}
                      className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors"
                    >
                      <UserPlus className="w-4 h-4" /> {modal.row.assigned_employee_id ? 'Assignment' : 'Assign'}
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => openEdit(modal.row)}
                      className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                  )}
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
          
        </ViewModal>
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

      {/* Assign to an employee. The ones covering the complaint's zone come first and are marked
          Recommended; the rest are still offered, because a zone with nobody assigned to it would
          otherwise leave the complaint with nowhere to go. */}
      {assignTarget && (
        <Modal overlayClassName="lg:pl-72" onClose={() => setAssignTarget(null)} className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-warm-border bg-warm-section rounded-t-xl">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-warm-text">Assign Complaint</h3>
                <p className="text-xs text-warm-muted">
                  {decodeEntities(assignTarget.property_id) || '-'} · {decodeEntities(assignTarget.zone) || 'no zone'}
                </p>
              </div>
              <button onClick={() => setAssignTarget(null)} className="p-1.5 rounded-lg hover:bg-warm-border/60 transition-colors" title="Close">
                <X className="w-5 h-5 text-warm-muted" />
              </button>
            </div>
            <div className="p-5">
              {/* One assignee at a time: while somebody has it the list below is locked, and
                  Unassign is the way out -- it returns the complaint to Open with nobody on it. */}
              {assignTarget.assigned_employee_id && (
                <div className="mb-3 p-3 bg-warm-section border border-warm-border rounded-[10px] flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-xs text-warm-muted">
                    Currently with <span className="font-medium text-warm-text">{assigneeLabel(assignTarget)}</span>.
                    The employees below are locked while it is assigned — unassign it first to hand it
                    to someone else.
                  </p>
                  <button
                    type="button"
                    onClick={unassign}
                    disabled={assignSaving !== null}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 h-[34px] rounded-[10px] text-xs font-medium text-warm-text border border-warm-border bg-white hover:bg-warm-section transition-colors disabled:opacity-60"
                  >
                    {assignSaving === 'unassign'
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <UserMinus className="w-3.5 h-3.5" />}
                    Unassign
                  </button>
                </div>
              )}
              {/* Every name here covers this complaint's zone -- that is what the list is. The zone
                  itself is in the header above, so the row carries the one thing that tells two
                  candidates apart: what they do. */}
              {!assignLoading && assignEmployees.length > 0 && decodeEntities(assignTarget.zone || '') && (
                <p className="mb-3 text-xs text-warm-muted">
                  Employees assigned to <span className="font-medium text-warm-text">{decodeEntities(assignTarget.zone)}</span>
                </p>
              )}
              {assignError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{assignError}</p>
                </div>
              )}
              {assignLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-warm-accent" />
                  <span className="ml-2 text-sm text-warm-muted">Loading employees...</span>
                </div>
              ) : assignEmployees.length === 0 ? (
                <div className="py-8 text-center">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-warm-muted" strokeWidth={1.5} />
                  {/* Nobody covers this zone. The fix is to put somebody in it, not to hand the
                      complaint to whoever happens to be on the roster. */}
                  <p className="text-sm text-warm-text font-medium">
                    No one is assigned to {decodeEntities(assignTarget.zone || '') || 'this zone'}
                  </p>
                  <p className="text-sm text-warm-muted mt-1">
                    Assign a manager, coordinator, supervisor or executive to this zone in
                    Employee Zone Management, then assign the complaint.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignEmployees.map((employee) => {
                    const locked = !!assignTarget.assigned_employee_id;
                    const isCurrent = assignTarget.assigned_employee_id === employee.id;
                    const body = (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-warm-text [overflow-wrap:anywhere]">
                            {decodeEntities(employee.name) || decodeEntities(employee.email) || `Employee ${employee.id}`}
                          </p>
                          <p className="text-xs text-warm-muted capitalize">
                            {employee.role}{employee.allZones ? ' · all zones' : ''}
                          </p>
                        </div>
                        {isCurrent
                          ? <span className="text-[11px] font-medium text-warm-accent whitespace-nowrap flex-shrink-0">Current</span>
                          : locked && <Lock className="w-3.5 h-3.5 text-warm-muted flex-shrink-0" />}
                        {assignSaving === employee.id && <Loader2 className="w-4 h-4 animate-spin text-warm-accent flex-shrink-0" />}
                      </>
                    );

                    // A locked row is not a disabled button: there is nothing for it to do, and a
                    // button that cannot be pressed still reads as one that should be.
                    return locked ? (
                      <div
                        key={employee.id}
                        className={`w-full px-3 py-2.5 rounded-[10px] border border-warm-border flex items-center gap-3 ${
                          isCurrent ? 'bg-white ring-2 ring-warm-accent/30' : 'bg-warm-section/60 opacity-70'
                        }`}
                      >
                        {body}
                      </div>
                    ) : (
                      <button
                        key={employee.id}
                        type="button"
                        disabled={assignSaving !== null}
                        onClick={() => assignTo(employee)}
                        className="w-full px-3 py-2.5 text-left rounded-[10px] border border-warm-border bg-white hover:bg-warm-section transition-colors flex items-center gap-3 disabled:opacity-60"
                      >
                        {body}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal>
      )}

      {/* The notes lightbox -- the same feature the marketing tracker's note bubble opens.
          z-[60] lifts it over the complaint modal, which is one of the two places it opens from. */}
      {noteTarget && (
        <Modal overlayClassName="lg:pl-72" zIndex="z-[60]" onClose={closeNote} className="w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-border bg-warm-section rounded-t-xl">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-warm-text">Notes / Comments</h3>
                <p className="text-xs text-warm-muted">
                  {decodeEntities(noteTarget.property_id) || '-'} · {decodeEntities(noteTarget.contact_person_name) || '-'}
                </p>
              </div>
              <button onClick={closeNote} className="p-1.5 rounded-lg hover:bg-warm-border/60 transition-colors" title="Close">
                <X className="w-5 h-5 text-warm-muted" />
              </button>
            </div>
            <div className="p-5">
              {noteEditing ? (
                <>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value.slice(0, 500))}
                    maxLength={500}
                    rows={5}
                    autoFocus
                    placeholder="What was done about this complaint..."
                    className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white resize-y focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20"
                  />
                  <div className="mt-1 text-right text-[11px] text-warm-muted">{noteText.trim().length}/500</div>
                </>
              ) : (
                <>
                  <div className="px-3 py-2.5 border border-warm-border rounded-[10px] text-sm text-warm-text whitespace-pre-wrap bg-warm-section min-h-[80px] [overflow-wrap:anywhere]">
                    {decodeEntities(noteTarget.complaint_note || '') || '-'}
                  </div>
                  {stampLine(noteTarget.note_updated_by, noteTarget.note_updated_at) && (
                    <p className="mt-1.5 text-[11px] text-warm-muted">
                      Last saved by {stampLine(noteTarget.note_updated_by, noteTarget.note_updated_at)}
                    </p>
                  )}
                </>
              )}

              {noteError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{noteError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-warm-border">
                {noteEditing ? (
                  <>
                    <button
                      onClick={cancelNoteEdit}
                      className="px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-muted border border-warm-border hover:bg-warm-section transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveNote}
                      disabled={noteSaving}
                      className="inline-flex items-center gap-2 px-5 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors disabled:opacity-60"
                    >
                      {noteSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {noteSaving ? 'Saving...' : 'Save Notes'}
                    </button>
                  </>
                ) : (
                  <>
                    {canNoteOnComplaint(noteTarget, { canEdit }) && (
                      <button
                        onClick={() => setNoteEditing(true)}
                        className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[10px] text-sm font-medium text-warm-text border border-warm-border hover:bg-warm-section transition-colors"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                    )}
                    <button
                      onClick={closeNote}
                      className="px-4 h-[38px] rounded-[10px] text-sm font-medium text-white bg-[#B5812A] hover:bg-[#a07325] transition-colors"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </Modal>
      )}

      {/* Verify and close. Closing is what moves a complaint to Archived, so it is confirmed --
          and the dialog says so where the assignee has not reported back yet. */}
      {closeTarget && (
        <Modal overlayClassName="lg:pl-72" zIndex="z-[60]" onClose={() => setCloseTarget(null)} className="w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-warm-text mb-2">Close this complaint?</h3>
            <p className="text-sm text-warm-muted mb-3">
              The complaint for <span className="font-medium text-warm-text">{decodeEntities(closeTarget.property_id) || 'this property'}</span> will
              be closed and moved to Marketing &gt; Archived.
              {closeTarget.assigned_employee_name ? ` ${decodeEntities(closeTarget.assigned_employee_name)} will be notified.` : ''}
            </p>
            {statusOf(closeTarget) !== 'In Review' && (
              <div className="mb-4 p-3 bg-warm-warning border border-[#F3E2B3] rounded-[10px] flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This complaint is still <span className="font-medium">{statusOf(closeTarget)}</span>, so the assigned
                  employee has not reported back on it yet.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCloseTarget(null)}
                className="px-4 py-2 border border-warm-border rounded-[10px] text-sm text-warm-text hover:bg-warm-section transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => saveStatus(closeTarget, 'Closed')}
                disabled={statusSaving === closeTarget.id}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-[10px] text-sm hover:bg-emerald-800 transition-colors disabled:opacity-60"
              >
                {statusSaving === closeTarget.id && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle2 className="w-4 h-4" /> Close Complaint
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
