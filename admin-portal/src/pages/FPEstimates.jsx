import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Plus, Search, X, Check, AlertCircle, Package, PlusCircle, Archive,
  List, ChevronDown, ChevronLeft, ChevronRight, Building2, User, Trash2, Edit2, Eye, RotateCcw, Calendar,
  DollarSign, Layers, Filter, Download, Mail, Save, Edit, Send, Link2, RefreshCw,
  FolderOpen, ExternalLink, Link, CheckSquare, Square, ArrowLeft, ClipboardList, Loader2
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const API_BASE = import.meta.env.VITE_API_URL || '';
import { FREQUENCY_TYPES, FREQUENCY_COUNT_MAP } from '../utils/estimateStore';
import { getAuthToken } from '../utils/safeStorage';
import { exportEstimateToPDF, exportPackageToPDF } from '../utils/pdfExport';
import * as XLSX from 'xlsx';

// Decode HTML entities (e.g., &#x2F; -> /)
const decodeHtml = (html) => {
  if (!html || typeof html !== 'string') return html;
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

// Format date in IST format (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '-';
  // If already in yyyy-mm-dd format, parse directly to avoid timezone issues
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse dd/mm/yyyy to yyyy-mm-dd (internal format)
const parseISTDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle date input change with auto-formatting
const handleDateInput = (value, setter) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  setter(cleaned);
};

const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'APT', label: 'Apartment' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'PLOT', label: 'Plot' },
];

const BILLING_DURATIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' }
];

const TAB_TITLES = {
  'create': 'Create Estimate', 'list': 'All Estimates', 'amc': 'AMC Packages', 'addons': 'Add-ons', 'archived': 'Archived Estimates'
};

const FPEstimates = ({ user, defaultTab = 'list' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Check if user is FP Manager (restricted access)
  const isFPManager = user?.role === 'manager';
  
  // Ref to prevent circular updates between URL and state
  const isUpdatingFromStateRef = useRef(false);
  const isUpdatingFromUrlRef = useRef(false);
  
  // URL-synced state for filters and modals
  const urlSearchTerm = searchParams.get('search') || '';
  const urlFilterStatus = searchParams.get('status') || 'all';
  const urlFilterType = searchParams.get('type') || 'all';
  const viewEstimateId = searchParams.get('viewEstimate');
  const viewPackageId = searchParams.get('viewPackage');
  const urlEstimateStep = searchParams.get('estimateStep'); // For browser back navigation
  
  // Helper to update URL params (push new history entry for back button support)
  const updateUrlParam = useCallback((key, value, defaultValue = '') => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === defaultValue || value === null || value === undefined || value === '' || value === 'all') {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
      return newParams;
    });
  }, [setSearchParams]);
  
  // URL-based modal handlers
  const openViewEstimate = useCallback((estimate) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('viewEstimate', String(estimate.id));
      return newParams;
    });
  }, [setSearchParams]);
  
  const closeViewEstimate = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('viewEstimate');
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);
  
  const openViewPackage = useCallback((pkg) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('viewPackage', String(pkg.id));
      return newParams;
    });
  }, [setSearchParams]);
  
  const closeViewPackage = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('viewPackage');
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);
  
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({ estimates: 0, amcPackages: 0, addons: 0, archived: 0 });
  const [searchTerm, setSearchTerm] = useState(urlSearchTerm);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterFromDate, setFilterFromDate] = useState(''); // Internal yyyy-mm-dd
  const [filterToDate, setFilterToDate] = useState(''); // Internal yyyy-mm-dd
  const [filterFromDateDisplay, setFilterFromDateDisplay] = useState(''); // Display dd/mm/yyyy
  const [filterToDateDisplay, setFilterToDateDisplay] = useState(''); // Display dd/mm/yyyy
  const [emailModal, setEmailModal] = useState(null);
  const [estimateType, setEstimateType] = useState(null);
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  // FP Manager defaults to 'all-packages' (no create access)
  const [amcActiveTab, setAmcActiveTab] = useState(isFPManager ? 'all-packages' : 'create');
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);
  const [amcForm, setAmcForm] = useState({ packageName: '', description: '', serviceRows: [{ service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' });
  const [editingAmcPackage, setEditingAmcPackage] = useState(null);
  const [filterPropertyType, setFilterPropertyType] = useState('all');
  // FP Manager defaults to 'all-addons' (no create access)
  const [addonActiveTab, setAddonActiveTab] = useState(isFPManager ? 'all-addons' : 'create');
  const [addonSelectedPropertyType, setAddonSelectedPropertyType] = useState(null);
  const [addonFilterPropertyType, setAddonFilterPropertyType] = useState('all');
  const [addonForm, setAddonForm] = useState({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' });
  const [editingAddon, setEditingAddon] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [editEstimate, setEditEstimate] = useState(null);
  const [editEstimateForm, setEditEstimateForm] = useState(null);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [viewAmcPackage, setViewAmcPackage] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [archivedTypeFilter, setArchivedTypeFilter] = useState('all');
  const [sendingEmailId, setSendingEmailId] = useState(null); // Track which estimate email is being sent
  const [selectedEstimates, setSelectedEstimates] = useState([]);
  const [archivingSelected, setArchivingSelected] = useState(false);
  
  // Work Order Estimate States
  const [workOrderIdInput, setWorkOrderIdInput] = useState('');
  const [workOrderLoading, setWorkOrderLoading] = useState(false);
  const [workOrderError, setWorkOrderError] = useState('');
  const [workOrderData, setWorkOrderData] = useState(null);
  const [workOrderStep, setWorkOrderStep] = useState('input'); // 'input', 'review'
  const [workOrderAmount, setWorkOrderAmount] = useState('');
  const [workOrderGst, setWorkOrderGst] = useState('18');
  const [workOrderDiscount, setWorkOrderDiscount] = useState('');
  const [workOrderNotes, setWorkOrderNotes] = useState('');
  const [savingWorkOrder, setSavingWorkOrder] = useState(false);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [loadingCompletedWO, setLoadingCompletedWO] = useState(false);
  
  // FP Portal Links state
  const [portalLinks, setPortalLinks] = useState([]);
  const [linkForms, setLinkForms] = useState({
    1: { heading: '', url: '', isEditing: false, isSaving: false },
    2: { heading: '', url: '', isEditing: false, isSaving: false }
  });
  const [linkErrors, setLinkErrors] = useState({ 1: '', 2: '' });

  const token = getAuthToken();

  useEffect(() => { loadData(); }, [defaultTab]);
  
  // Sync estimate creation step with URL for browser back button support
  useEffect(() => {
    // Skip if this update was triggered by URL change (prevents circular loop)
    if (isUpdatingFromUrlRef.current) {
      isUpdatingFromUrlRef.current = false;
      return;
    }
    
    if (defaultTab === 'create') {
      let targetStep = '';
      if (estimateType === 'property-based' && selectedProperty) {
        targetStep = 'property-form';
      } else if (estimateType === 'property-based') {
        targetStep = 'property-id';
      } else if (estimateType === 'direct') {
        targetStep = 'direct-form';
      }
      // Only update if different from current URL to prevent infinite loop
      if ((urlEstimateStep || '') !== targetStep) {
        isUpdatingFromStateRef.current = true;
        // Use setSearchParams directly without replace to push to history
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          if (!targetStep) {
            newParams.delete('estimateStep');
          } else {
            newParams.set('estimateStep', targetStep);
          }
          return newParams;
        }); // Default is push, not replace
        // Reset the flag after a short delay
        setTimeout(() => {
          isUpdatingFromStateRef.current = false;
        }, 100);
      }
    }
  }, [estimateType, selectedProperty, defaultTab, urlEstimateStep, setSearchParams]);
  
  // Handle browser back button - sync URL to state
  useEffect(() => {
    // Skip if this update was triggered by state change (prevents circular loop)
    if (isUpdatingFromStateRef.current) {
      return;
    }
    
    if (defaultTab === 'create') {
      isUpdatingFromUrlRef.current = true;
      if (!urlEstimateStep) {
        // No step in URL = type selection
        setEstimateType(null);
        setSelectedProperty(null);
        setPropertyIdInput('');
        setEstimateForm({ customerName: '', phone: '', countryCode: '+91', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', selectedPackage: '', selectedAddons: [], discount: '', gst: '', description: '', numberOfBlocks: '', blockNumber: '', blockName: '', numberOfUnits: '', villaNumber: '', flatNumber: '', plotNumber: '' });
      } else if (urlEstimateStep === 'property-id') {
        // Property ID entry step
        setEstimateType('property-based');
        setSelectedProperty(null);
        setPropertyIdInput('');
      } else if (urlEstimateStep === 'property-form') {
        // Property form step - keep current state if already there
        if (estimateType !== 'property-based') {
          setEstimateType('property-based');
        }
      } else if (urlEstimateStep === 'direct-form') {
        // Direct form step
        setEstimateType('direct');
        setSelectedProperty(null);
        setPropertyIdInput('');
      }
      // Reset the flag after state updates are processed
      setTimeout(() => {
        isUpdatingFromUrlRef.current = false;
      }, 100);
    }
  }, [urlEstimateStep, defaultTab]);
  
  // Sync viewEstimate and viewAmcPackage from URL params
  useEffect(() => {
    if (viewEstimateId && estimates.length > 0) {
      const estimate = estimates.find(e => String(e.id) === viewEstimateId) || 
                       archivedEstimates.find(e => String(e.id) === viewEstimateId);
      if (estimate) setViewEstimate(estimate);
    } else if (!viewEstimateId) {
      setViewEstimate(null);
    }
  }, [viewEstimateId, estimates, archivedEstimates]);
  
  useEffect(() => {
    if (viewPackageId && amcPackages.length > 0) {
      const pkg = amcPackages.find(p => String(p.id) === viewPackageId);
      if (pkg) {
        // Parse services data
        let servicesData = pkg.services;
        if (typeof servicesData === 'string') {
          try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = null; }
        }
        const serviceRows = servicesData?.serviceRows || servicesData || [];
        const propertyType = servicesData?.property_type || pkg.property_type;
        const billingDuration = servicesData?.billing_duration || pkg.billing_duration;
        setViewAmcPackage({ ...pkg, servicesData: serviceRows, propertyType, billingDuration });
      }
    } else if (!viewPackageId) {
      setViewAmcPackage(null);
    }
  }, [viewPackageId, amcPackages]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estRes, amcRes, addRes, propRes, archivedRes, linksRes] = await Promise.all([
        fetch(`${API_BASE}/api/fp/estimates?archived=false`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/amc-packages`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/addons`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/estimates?archived=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/portal-links`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [estData, amcData, addData, propData, archivedData, linksData] = await Promise.all([estRes.json(), amcRes.json(), addRes.json(), propRes.json(), archivedRes.json(), linksRes.json()]);
      const estArr = estData.success ? (Array.isArray(estData.data) ? estData.data : []) : [];
      // Sort active estimates by created_at date descending (latest first)
      const sortedEstArr = estArr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const amcArr = amcData.success ? (Array.isArray(amcData.data) ? amcData.data : []) : [];
      const addArr = addData.success ? (Array.isArray(addData.data) ? addData.data : []) : [];
      const propArr = propData.success ? (Array.isArray(propData.data) ? propData.data : []) : [];
      const archArr = archivedData.success ? (Array.isArray(archivedData.data) ? archivedData.data : []) : [];
      // Sort archived estimates by archived_at date descending (latest first)
      const sortedArchArr = archArr.sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at));
      const linksArr = linksData.success ? (Array.isArray(linksData.data) ? linksData.data : []) : [];
      setEstimates(sortedEstArr); setAmcPackages(amcArr); setAddons(addArr); setProperties(propArr); setArchivedEstimates(sortedArchArr);
      setStats({ estimates: estArr.length, amcPackages: amcArr.length, addons: addArr.length, archived: archArr.length });
      
      // Set portal links and populate forms
      setPortalLinks(linksArr);
      const newForms = { 1: { heading: '', url: '', isEditing: false, isSaving: false }, 2: { heading: '', url: '', isEditing: false, isSaving: false } };
      linksArr.forEach(link => {
        if (link.link_slot === 1 || link.link_slot === 2) {
          newForms[link.link_slot] = { heading: link.heading, url: link.url, isEditing: false, isSaving: false, id: link.id };
        }
      });
      setLinkForms(newForms);
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  };

  // Fetch completed work orders for the estimate form
  const fetchCompletedWorkOrders = async () => {
    setLoadingCompletedWO(true);
    try {
      const res = await fetch(`${API_BASE}/api/fp/work-orders?status=completed`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setCompletedWorkOrders(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) { console.error('Error fetching completed work orders:', e); }
    finally { setLoadingCompletedWO(false); }
  };

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };
  
  // Helper to compute total units based on property type
  const computeTotalUnits = (prop) => {
    const propType = (prop.property_type || prop.entryType || prop.entry_type || '').toUpperCase();
    // For GC properties, compute from units_per_block
    if (propType === 'GC' || propType === 'GATED_COMMUNITY') {
      const upbData = prop.units_per_block || prop.unitsPerBlock;
      if (upbData) {
        try {
          const upb = typeof upbData === 'string' ? JSON.parse(upbData) : upbData;
          if (typeof upb === 'object' && upb !== null) {
            const total = Object.values(upb).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            if (total > 0) return total;
          }
        } catch (e) { /* ignore */ }
      }
    }
    // For APT properties, use number_of_units or total_units
    if (propType === 'APT' || propType === 'APARTMENT') {
      return prop.number_of_units || prop.total_units || prop.numberOfUnits || prop.totalUnits || null;
    }
    // For VILLA, FLAT, PLOT - single unit
    if (['VILLA', 'VILLAS', 'FLAT', 'FLATS', 'PLOT', 'PLOTS'].includes(propType)) {
      return 1;
    }
    // Fallback to stored values
    return prop.total_units || prop.totalUnits || prop.units || prop.number_of_units || null;
  };

  const formatCurrency = (amt) => {
    const num = parseFloat(amt);
    const value = isNaN(num) ? 0 : Math.round(num);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value);
  };
  
  const getPackageBillingDuration = (pkg) => {
    let servicesData = pkg?.services || pkg?.services_data;
    if (typeof servicesData === 'string') {
      try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = {}; }
    }
    return servicesData?.billing_duration || pkg?.billing_duration || pkg?.billingDuration || 'monthly';
  };

  // Portal Links Handlers
  const validateUrl = (url) => {
    if (!url || !url.trim()) return false;
    try {
      new URL(url.trim());
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleLinkFormChange = (slot, field, value) => {
    setLinkForms(prev => ({
      ...prev,
      [slot]: { ...prev[slot], [field]: value }
    }));
    setLinkErrors(prev => ({ ...prev, [slot]: '' }));
  };

  const handleSavePortalLink = async (slot) => {
    const form = linkForms[slot];
    
    // Validation
    if (!form.heading || !form.heading.trim()) {
      setLinkErrors(prev => ({ ...prev, [slot]: 'Heading cannot be blank.' }));
      return;
    }
    if (!form.url || !form.url.trim()) {
      setLinkErrors(prev => ({ ...prev, [slot]: 'URL cannot be blank.' }));
      return;
    }
    if (!validateUrl(form.url)) {
      setLinkErrors(prev => ({ ...prev, [slot]: 'Please enter a valid URL.' }));
      return;
    }

    setLinkForms(prev => ({ ...prev, [slot]: { ...prev[slot], isSaving: true } }));

    try {
      const res = await fetch(`${API_BASE}/api/fp/portal-links`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_slot: slot, heading: form.heading.trim(), url: form.url.trim() })
      });
      const result = await res.json();
      
      if (res.ok && result.success) {
        showToast(result.message || 'Link saved successfully.');
        setLinkForms(prev => ({ 
          ...prev, 
          [slot]: { ...prev[slot], isEditing: false, isSaving: false, id: result.data?.id } 
        }));
        loadData(); // Refresh to get updated links
      } else {
        setLinkErrors(prev => ({ ...prev, [slot]: result.message || 'Failed to save link.' }));
        setLinkForms(prev => ({ ...prev, [slot]: { ...prev[slot], isSaving: false } }));
      }
    } catch (e) {
      console.error('Save portal link error:', e);
      setLinkErrors(prev => ({ ...prev, [slot]: 'Failed to save link. Please try again.' }));
      setLinkForms(prev => ({ ...prev, [slot]: { ...prev[slot], isSaving: false } }));
    }
  };

  const handleDeletePortalLink = async (slot) => {
    const form = linkForms[slot];
    if (!form.id) {
      // Just clear the form if no saved link
      setLinkForms(prev => ({ ...prev, [slot]: { heading: '', url: '', isEditing: false, isSaving: false } }));
      return;
    }

    try {
      const res = await fetch(`/api/fp/portal-links/${form.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      
      if (res.ok && result.success) {
        showToast('Link deleted successfully.');
        setLinkForms(prev => ({ ...prev, [slot]: { heading: '', url: '', isEditing: false, isSaving: false } }));
        loadData();
      } else {
        showToast(result.message || 'Failed to delete link.', 'error');
      }
    } catch (e) {
      console.error('Delete portal link error:', e);
      showToast('Failed to delete link.', 'error');
    }
  };

  const handleEditLink = (slot) => {
    setLinkForms(prev => ({ ...prev, [slot]: { ...prev[slot], isEditing: true } }));
  };

  const handleCancelEdit = (slot) => {
    // Restore original values from portalLinks
    const existingLink = portalLinks.find(l => l.link_slot === slot);
    if (existingLink) {
      setLinkForms(prev => ({ 
        ...prev, 
        [slot]: { heading: existingLink.heading, url: existingLink.url, isEditing: false, isSaving: false, id: existingLink.id } 
      }));
    } else {
      setLinkForms(prev => ({ ...prev, [slot]: { heading: '', url: '', isEditing: false, isSaving: false } }));
    }
    setLinkErrors(prev => ({ ...prev, [slot]: '' }));
  };

  // Estimate form state
  const [estimateForm, setEstimateForm] = useState({
    customerName: '', phone: '', countryCode: '+91', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '',
    selectedPackage: '', selectedAddons: [], discount: '', gst: '', description: '',
    numberOfBlocks: '', blockNumber: '', blockName: '', numberOfUnits: '',
    villaNumber: '', flatNumber: '', plotNumber: ''
  });

  // Helper to normalize property type to match PROPERTY_TYPE_OPTIONS IDs
  const normalizePropertyType = (type) => {
    if (!type) return '';
    const upper = type.toUpperCase().replace(/[_\s-]/g, '');
    // Map full names to short codes (matching PROPERTY_TYPE_OPTIONS IDs)
    if (upper.includes('GATED') || upper === 'GC') return 'GC';
    if (upper.includes('APARTMENT') || upper === 'APT') return 'APT';
    if (upper === 'VILLA' || upper === 'VILLAS') return 'VILLA';
    if (upper === 'FLAT' || upper === 'FLATS') return 'FLAT';
    if (upper === 'PLOT' || upper === 'PLOTS') return 'PLOT';
    return upper;
  };

  // Helper to get property type label
  const getPropertyTypeLabel = (type) => {
    const normalized = normalizePropertyType(type);
    return PROPERTY_TYPE_OPTIONS.find(t => t.id === normalized)?.label || type || '-';
  };

  // Helper to match property type for filtering
  const matchPropertyType = (value, filterId) => {
    if (!value || !filterId) return false;
    const normalizedValue = normalizePropertyType(value);
    return normalizedValue === filterId;
  };

  // Export FP estimate to PDF with properly formatted data
  const handleExportPDF = (estimate) => {
    console.log('Export PDF - Full estimate:', estimate);
    
    // Parse addons from multiple possible sources (no prices shown)
    let addonsArray = [];
    
    // Try estimate.addons first (from backend enrichment)
    if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
      console.log('Found addons array:', estimate.addons);
      addonsArray = estimate.addons;
    }
    // Try addons_data JSON string
    else if (estimate.addons_data) {
      console.log('Found addons_data:', estimate.addons_data);
      try {
        const parsed = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
        console.log('Parsed addons_data:', parsed);
        if (Array.isArray(parsed)) addonsArray = parsed;
      } catch (e) { console.log('Addon parse error:', e); }
    }
    // Try selected_addons JSON string
    else if (estimate.selected_addons) {
      console.log('Found selected_addons:', estimate.selected_addons);
      try {
        const parsed = typeof estimate.selected_addons === 'string' ? JSON.parse(estimate.selected_addons) : estimate.selected_addons;
        if (Array.isArray(parsed)) addonsArray = parsed;
      } catch (e) { console.log('Selected addons parse error:', e); }
    }
    
    // Parse package services from multiple sources
    let packageServices = [];
    
    // Try packageServices (camelCase from backend) or package_services (snake_case)
    const rawPackageServices = estimate.packageServices || estimate.package_services;
    if (rawPackageServices) {
      try {
        const parsed = typeof rawPackageServices === 'string' ? JSON.parse(rawPackageServices) : rawPackageServices;
        if (parsed.serviceRows && Array.isArray(parsed.serviceRows)) {
          packageServices = parsed.serviceRows;
        } else if (parsed.services && Array.isArray(parsed.services)) {
          packageServices = parsed.services;
        } else if (Array.isArray(parsed)) {
          packageServices = parsed;
        }
        console.log('Parsed packageServices:', packageServices.length, 'services');
      } catch (e) { console.log('Package services parse error:', e); }
    }
    // Try services_data JSON string (contains package services)
    if (packageServices.length === 0 && estimate.services_data) {
      try {
        const parsed = typeof estimate.services_data === 'string' ? JSON.parse(estimate.services_data) : estimate.services_data;
        if (parsed.serviceRows && Array.isArray(parsed.serviceRows)) {
          packageServices = parsed.serviceRows;
        } else if (Array.isArray(parsed)) {
          packageServices = parsed;
        }
      } catch (e) { console.log('Services parse error:', e); }
    }
    // If we have a package_id, try to find package services from amcPackages
    if (packageServices.length === 0 && estimate.package_id && amcPackages.length > 0) {
      const pkg = amcPackages.find(p => p.id?.toString() === estimate.package_id?.toString());
      if (pkg) {
        try {
          const servicesData = typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services;
          if (servicesData?.serviceRows) {
            packageServices = servicesData.serviceRows;
          } else if (servicesData?.services) {
            packageServices = servicesData.services;
          } else if (Array.isArray(servicesData)) {
            packageServices = servicesData;
          }
          console.log('Found services from AMC package lookup:', packageServices.length);
        } catch (e) { console.log('Package lookup error:', e); }
      }
    }
    
    console.log('PDF Export - Estimate:', estimate.estimate_id, 'Package Services:', packageServices, 'Addons:', addonsArray);
    
    // Prepare estimate data for PDF
    const pdfData = {
      ...estimate,
      estimateId: estimate.estimate_id,
      estimateType: estimate.estimate_type,
      propertyId: estimate.property_code || estimate.property_id,
      propertyType: estimate.property_type,
      propertyName: estimate.property_name,
      communityName: estimate.property_name,
      zone: estimate.zone,
      division: estimate.division || '',
      // APT specific fields
      towerName: estimate.tower_name,
      blockNumber: estimate.block_number,
      // GC specific fields
      numberOfBlocks: estimate.number_of_blocks,
      totalUnits: estimate.total_units,
      // Villa/Plot specific
      villaPlotNumber: estimate.villa_plot_number,
      customerName: estimate.client_name,
      customerPhone: estimate.client_phone,
      customerEmail: estimate.client_email,
      address: estimate.address,
      city: estimate.city,
      packageName: estimate.package_name,
      billingDuration: 'Yearly',
      subtotal: parseFloat(estimate.subtotal) || 0,
      totalPrice: parseFloat(estimate.total_amount) || 0,
      discountPercent: parseFloat(estimate.discount_percent) || 0,
      discountAmount: parseFloat(estimate.discount_amount) || 0,
      gstPercent: parseFloat(estimate.gst_percent) || 0,
      gstAmount: parseFloat(estimate.gst_amount) || 0,
      description: estimate.description || '',
      // Include package services with descriptions
      packageServices: packageServices.map(s => ({
        name: s.service || s.name || s.serviceName || 'Service',
        frequencyCount: s.frequencyCount ?? s.frequency_count ?? s.frequency ?? 0,
        frequencyType: s.frequencyType || s.frequency_type || 'Monthly',
        description: s.description || ''
      })),
      // Include addons with descriptions - match by property_type
      addons: addonsArray.map(a => {
        const addonName = a.name || a.service_name || a.serviceName || '';
        const estPropertyType = normalizePropertyType(estimate.property_type);
        // Priority 1: Match by ID
        let addonFromList = addons.find(ad => ad.id == a.id || ad.id == a.addon_id);
        // Priority 2: Match by name AND property_type
        if (!addonFromList || !addonFromList.description) {
          addonFromList = addons.find(ad => 
            (ad.service_name === addonName || ad.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
            normalizePropertyType(ad.property_type) === estPropertyType
          ) || addonFromList;
        }
        return {
          name: addonName || 'Add-on',
          frequencyType: a.frequency_type || a.frequencyType || addonFromList?.frequency_type || 'One-time',
          frequencyCount: a.frequency_count ?? a.frequencyCount ?? addonFromList?.frequency_count ?? 0,
          description: a.description || addonFromList?.description || ''
        };
      })
    };
    
    console.log('PDF Data:', pdfData);
    exportEstimateToPDF(pdfData);
  };

  // Send email with estimate - with guard against double sending
  const handleSendEmail = async (estimate) => {
    // Prevent double sending
    if (sendingEmailId === estimate.id) {
      console.log('Email already being sent for this estimate');
      return;
    }
    
    const clientEmail = estimate.client_email;
    if (!clientEmail) {
      showToast('No email address found for this client', 'error');
      return;
    }
    
    setSendingEmailId(estimate.id);
    
    try {
      const res = await fetch(`${API_BASE}/api/fp/estimates/send-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: estimate.id, email: clientEmail })
      });
      const result = await res.json();
      if (result.success) {
        showToast(`Email sent to ${clientEmail}`);
        loadData(); // Refresh to update status to "Sent"
      } else {
        showToast(result.message || 'Failed to send email', 'error');
      }
    } catch (e) {
      console.error('Send email error:', e);
      showToast('Failed to send email', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  // Open edit estimate modal for property-based estimates
  const openEditEstimate = (estimate) => {
    // Allow editing both property-based and direct estimates
    
    // Parse addons data with quantities
    let selectedAddonsWithQty = [];
    if (estimate.addons_data) {
      try {
        const addonsData = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
        selectedAddonsWithQty = addonsData.map(a => ({ id: a.id || a.addon_id, quantity: a.quantity || 1 })).filter(a => a.id);
      } catch (e) { console.log('Addon parse error:', e); }
    }
    
    setEditEstimate(estimate);
    setEditEstimateForm({
      client_name: estimate.client_name || '',
      client_phone: estimate.client_phone || '',
      client_email: estimate.client_email || '',
      property_name: estimate.property_name || '',
      zone: estimate.zone || '',
      city: estimate.city || '',
      address: estimate.address || '',
      package_id: estimate.package_id || '',
      selectedAddons: selectedAddonsWithQty,
      discount_percent: estimate.discount_percent || 0,
      gst_percent: estimate.gst_percent || 0,
      description: estimate.description || ''
    });
  };

  // Calculate pricing for edit form
  const calculateEditPricing = () => {
    if (!editEstimateForm) return { subtotal: 0, discountAmt: 0, gstAmt: 0, total: 0 };
    const pkg = amcPackages.find(p => p.id == editEstimateForm.package_id);
    const pkgPrice = parseFloat(pkg?.price) || parseFloat(editEstimate?.package_price) || 0;
    const addonsPrice = (editEstimateForm.selectedAddons || []).reduce((sum, item) => {
      const addon = addons.find(a => a.id == item.id);
      const qty = item.quantity || 1;
      return sum + ((parseFloat(addon?.price) || 0) * qty);
    }, 0);
    const subtotal = pkgPrice + addonsPrice;
    const discount = parseFloat(editEstimateForm.discount_percent) || 0;
    const gst = parseFloat(editEstimateForm.gst_percent) || 0;
    const discountAmt = (subtotal * discount) / 100;
    const gstAmt = ((subtotal - discountAmt) * gst) / 100;
    const total = subtotal - discountAmt + gstAmt;
    return { subtotal, discountAmt, gstAmt, total };
  };

  // Handle update estimate
  const handleUpdateEstimate = async () => {
    if (!editEstimate || !editEstimateForm) return;
    
    if (!editEstimateForm.client_name?.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }
    
    setSavingEstimate(true);
    
    try {
      const pkg = amcPackages.find(p => p.id == editEstimateForm.package_id);
      const pricing = calculateEditPricing();
      
      // Get package services if package changed
      let packageServices = null;
      if (pkg && pkg.services) {
        packageServices = typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services;
      }
      
      // Build addons data with descriptions and quantities
      const selectedAddonsList = (editEstimateForm.selectedAddons || []).map(item => {
        const addon = addons.find(a => a.id == item.id);
        return addon ? {
          id: addon.id,
          name: addon.service_name,
          description: addon.description || '',
          price: addon.price,
          frequency_type: addon.frequency_type,
          frequency_count: addon.frequency_count,
          quantity: item.quantity || 1
        } : null;
      }).filter(Boolean);
      
      const payload = {
        client_name: editEstimateForm.client_name,
        client_phone: editEstimateForm.client_phone,
        client_email: editEstimateForm.client_email,
        property_name: editEstimateForm.property_name,
        zone: editEstimateForm.zone,
        city: editEstimateForm.city,
        address: editEstimateForm.address,
        package_id: editEstimateForm.package_id,
        package_name: pkg?.name || editEstimate.package_name,
        package_price: pkg?.price || editEstimate.package_price,
        amc_package_description: pkg?.description || editEstimate.amc_package_description,
        package_services: packageServices,
        billing_duration: pkg?.billing_duration || editEstimate.billing_duration,
        subtotal: pricing.subtotal,
        discount_percent: editEstimateForm.discount_percent,
        discount_amount: pricing.discountAmt,
        gst_percent: editEstimateForm.gst_percent,
        gst_amount: pricing.gstAmt,
        total_amount: pricing.total,
        addons_data: selectedAddonsList,
        description: editEstimateForm.description
      };
      
      const res = await fetch(`${API_BASE}/api/fp/estimates/${editEstimate.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      
      if (result.success) {
        showToast('Estimate updated successfully');
        setEditEstimate(null);
        setEditEstimateForm(null);
        loadData();
      } else {
        showToast(result.message || 'Failed to update estimate', 'error');
      }
    } catch (e) {
      console.error('Update estimate error:', e);
      showToast('Failed to update estimate', 'error');
    } finally {
      setSavingEstimate(false);
    }
  };

    // Helper to get package property type (parses services JSON)
  const getPkgPropertyType = (pkg) => {
    let svc = pkg.services;
    if (typeof svc === 'string') { try { svc = JSON.parse(svc); } catch(e) { svc = null; } }
    return normalizePropertyType(svc?.property_type || pkg.property_type || '');
  };

  // Back navigation handler for estimate subsections
  const handleBackFromEstimate = useCallback(() => {
    if (estimateType === 'property-based' && selectedProperty) {
      // If property is selected, go back to property ID entry
      setSelectedProperty(null);
      setPropertyIdInput('');
      setEstimateForm({ customerName: '', phone: '', countryCode: '+91', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', selectedPackage: '', selectedAddons: [], discount: '', gst: '', description: '', numberOfBlocks: '', blockNumber: '', blockName: '', numberOfUnits: '', villaNumber: '', flatNumber: '', plotNumber: '' });
    } else {
      // Otherwise go back to estimate type selection
      setEstimateType(null);
      setSelectedProperty(null);
      setPropertyIdInput('');
      setEstimateForm({ customerName: '', phone: '', countryCode: '+91', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', selectedPackage: '', selectedAddons: [], discount: '', gst: '', description: '', numberOfBlocks: '', blockNumber: '', blockName: '', numberOfUnits: '', villaNumber: '', flatNumber: '', plotNumber: '' });
    }
  }, [estimateType, selectedProperty]);

  // Keyboard shortcut handler for back navigation (Escape key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle Escape key when on create tab and estimate type is selected
      if (e.key === 'Escape' && defaultTab === 'create' && estimateType) {
        const activeElement = document.activeElement;
        const isInputField = activeElement?.tagName === 'INPUT' || 
                            activeElement?.tagName === 'TEXTAREA' || 
                            activeElement?.tagName === 'SELECT';
        
        // If in input field, just blur it; otherwise navigate back
        if (isInputField) {
          activeElement.blur();
        } else {
          e.preventDefault();
          handleBackFromEstimate();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [defaultTab, estimateType, handleBackFromEstimate]);

  const calculatePricing = () => {
    const pkg = amcPackages.find(p => p.id == estimateForm.selectedPackage);
    const pkgPrice = parseFloat(pkg?.price) || 0;
    const addonsPrice = estimateForm.selectedAddons.reduce((sum, id) => {
      const addon = addons.find(a => a.id == id);
      return sum + (parseFloat(addon?.price) || 0);
    }, 0);
    const subtotal = pkgPrice + addonsPrice;
    const discount = parseFloat(estimateForm.discount) || 0;
    const gst = parseFloat(estimateForm.gst) || 0;
    const discountAmt = (subtotal * discount) / 100;
    const gstAmt = ((subtotal - discountAmt) * gst) / 100;
    const total = subtotal - discountAmt + gstAmt;
    return { subtotal, discountAmt, gstAmt, total };
  };

  // Get selected package details with services
  const getSelectedPackage = () => {
    if (!estimateForm.selectedPackage) return null;
    const pkgId = estimateForm.selectedPackage;
    const pkg = amcPackages.find(p => p.id == pkgId || p.id === parseInt(pkgId));
    if (!pkg) return null;
    let services = pkg.services;
    if (typeof services === 'string') { try { services = JSON.parse(services); } catch(e) { services = {}; } }
    return { ...pkg, parsedServices: services?.serviceRows || services?.services || [] };
  };

  // Save estimate to backend
  const handleSaveEstimate = async () => {
    // Prevent multiple submissions
    if (savingEstimate) return;
    setSavingEstimate(true);
    
    // Validation
    const clientName = selectedProperty?.contact_person || selectedProperty?.contact_name || selectedProperty?.customer_name || estimateForm.customerName;
    // Build phone - prioritize property contact, then form input
    let clientPhone = selectedProperty?.contact_phone || selectedProperty?.phone || '';
    if (!clientPhone && estimateForm.phone?.trim()) {
      clientPhone = `${estimateForm.countryCode || '+91'} ${estimateForm.phone}`;
    }
    // Build email - prioritize property contact, then form input
    let clientEmail = selectedProperty?.contact_email || selectedProperty?.email || estimateForm.email || '';
    
    if (!clientName?.trim()) { showToast('Customer name is required', 'error'); return; }
    if (!clientPhone?.trim()) { showToast('Phone number is required', 'error'); return; }
    if (!estimateForm.selectedPackage) { showToast('Please select an AMC package', 'error'); return; }

    const pkg = getSelectedPackage();
    const pricing = calculatePricing();
    // Use loose equality to handle string/number type mismatch
    const selectedAddonsList = estimateForm.selectedAddons.map(id => addons.find(a => a.id == id)).filter(Boolean);
    console.log('Selected Addons for estimate:', selectedAddonsList);

    // Get package services with descriptions
    const pkgServices = pkg?.parsedServices || [];

    try {
      // For direct estimates, don't include property_id or property_code
      const isDirectEstimate = estimateType === 'direct';
      const payload = {
        estimate_type: isDirectEstimate ? 'direct' : 'property_based',
        property_id: isDirectEstimate ? null : (selectedProperty?.id || null),
        property_code: isDirectEstimate ? '' : (selectedProperty?.property_id || selectedProperty?.property_code || ''),
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        property_type: selectedProperty?.property_type || selectedProperty?.entry_type || estimateForm.propertyType || '',
        property_name: selectedProperty?.name || selectedProperty?.community_name || estimateForm.propertyName || '',
        zone: selectedProperty?.zone_name || selectedProperty?.zoneName || selectedProperty?.zone || estimateForm.zone || '',
        division: selectedProperty?.division || selectedProperty?.division_id || selectedProperty?.division_name || '',
        city: selectedProperty?.city || estimateForm.city || '',
        address: selectedProperty?.address || estimateForm.address || '',
        // Block details for GC
        number_of_blocks: estimateForm.numberOfBlocks || selectedProperty?.number_of_blocks || 1,
        units_per_block: estimateForm.unitsPerBlock || selectedProperty?.units_per_block || {},
        block_names: estimateForm.blockNames || selectedProperty?.block_names || {},
        block_unit_types: estimateForm.blockUnitTypes || selectedProperty?.block_unit_types || selectedProperty?.blockUnitTypes || {},
        total_units: estimateForm.totalUnits || estimateForm.numberOfUnits || selectedProperty?.total_units || 0,
        // Apartment-specific fields
        tower_name: estimateForm.blockName || selectedProperty?.tower_name || selectedProperty?.block_info || '',
        block_number: estimateForm.blockNumber || selectedProperty?.block_number || '',
        // Villa/Plot-specific fields
        villa_plot_number: estimateForm.villaNumber || selectedProperty?.villa_plot_number || '',
        // Package and pricing
        package_id: estimateForm.selectedPackage,
        package_name: pkg?.name || '',
        package_price: pkg?.price || 0,
        amc_package_description: pkg?.description || '',
        billing_duration: pkg?.billing_duration || pkg?.billingDuration || getPackageBillingDuration(pkg) || 'yearly',
        package_services: pkgServices.map(s => ({ 
          name: s.service || s.name, 
          frequencyCount: s.frequencyCount ?? s.frequency_count ?? 0, 
          frequencyType: s.frequencyType || s.frequency_type || 'Monthly',
          description: s.description || ''
        })),
        addons: selectedAddonsList.map(a => ({ 
          id: a.id, 
          name: a.service_name, 
          price: a.price, 
          frequency_count: a.frequency_count, 
          frequency_type: a.frequency_type,
          description: a.description || ''
        })),
        subtotal: pricing.subtotal,
        discount_percent: estimateForm.discount,
        discount_amount: pricing.discountAmt,
        gst_percent: estimateForm.gst,
        gst_amount: pricing.gstAmt,
        total_amount: pricing.total,
        description: estimateForm.description || ''
      };

      const res = await fetch(`${API_BASE}/api/fp/estimates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      console.log('Create estimate response:', res.status, result);
      // Check for success - API returns success:true or HTTP 200/201
      if (result.success || res.ok) {
        showToast('Estimate saved successfully!', 'success');
        setEstimateType(null);
        setSelectedProperty(null);
        setPropertyIdInput('');
        setEstimateForm({ customerName: '', phone: '', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', selectedPackage: '', selectedAddons: [], discount: '', gst: '', description: '', numberOfBlocks: 1, unitsPerBlock: {}, totalUnits: 0 });
        loadData();
      } else {
        console.error('Create estimate failed:', result);
        showToast(result.message || 'Failed to save estimate', 'error');
      }
    } catch (e) {
      console.error('Save estimate error:', e);
      showToast('Error saving estimate. Please try again.', 'error');
    } finally {
      setSavingEstimate(false);
    }
  };

  // CREATE ESTIMATE - Both Property-Based and Direct-Based available for FP Manager
  const renderCreateEstimate = () => (
    <div className="space-y-6">
      {/* Back Arrow - Show when estimate type is selected */}
      {estimateType && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackFromEstimate}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            title="Go back (Esc)"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-lg font-semibold text-gray-800">
            {estimateType === 'property-based' 
              ? (selectedProperty ? 'Property Estimate Form' : 'Select Property')
              : estimateType === 'work_order'
              ? (workOrderData ? 'Work Order Estimate Review' : 'Work Order Estimate')
              : 'Direct Estimate Form'}
          </h2>
        </div>
      )}

      {!estimateType && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Estimate Type</h2>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {/* Property-Based Estimate */}
            <button onClick={() => setEstimateType('property-based')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <Building2 className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-indigo-600">Property-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
            </button>
            {/* Direct-Based Estimate */}
            <button onClick={() => { setEstimateType('direct'); setSelectedProperty(null); setPropertyIdInput(''); }} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <User className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-indigo-600">Direct-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
            </button>
            {/* Work Order Estimate */}
            <button onClick={() => { setEstimateType('work_order'); setWorkOrderStep('input'); setWorkOrderData(null); setWorkOrderError(''); setWorkOrderIdInput(''); fetchCompletedWorkOrders(); }} className="p-6 border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all group">
              <ClipboardList className="w-10 h-10 text-gray-400 group-hover:text-orange-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-orange-600">Work Order Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Create estimate from existing Work Order</p>
            </button>
          </div>
        </div>
      )}

      {/* Property-Based Estimate Form */}
      {estimateType === 'property-based' && (
        <div className="space-y-6">
          {/* Estimate Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Estimate Details</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Property ID Search */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Property ID <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={propertyIdInput} 
                    onChange={(e) => { 
                      const v = e.target.value.trim();
                      setPropertyIdInput(v); 
                      const m = properties.find(p => p.property_id?.toLowerCase() === v.toLowerCase()); 
                      if (m) {
                        const totalUnits = computeTotalUnits(m);
                        setSelectedProperty({ ...m, total_units: totalUnits, units: totalUnits });
                      } else {
                        setSelectedProperty(null);
                      }
                    }} 
                    placeholder="GC-DMMN-20260520" 
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-600 text-sm"
                  />
                </div>
              </div>

              {/* Auto-populated fields */}
              {selectedProperty && (
                <>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Contact Name</label>
                      <input type="text" value={selectedProperty.contact_person || selectedProperty.contact_name || selectedProperty.customer_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Property ID</label>
                      <input type="text" value={selectedProperty.property_id || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Entry Type</label>
                      <input type="text" value={selectedProperty.entry_type || selectedProperty.property_type?.substring(0,2).toUpperCase() || 'GC'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Zone</label>
                      <input type="text" value={selectedProperty.zone_name || selectedProperty.zoneName || selectedProperty.zone || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
                      <input type="text" value={selectedProperty.area || selectedProperty.area_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Community Name</label>
                      <input type="text" value={selectedProperty.name || selectedProperty.community_name || selectedProperty.property_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Property Type</label>
                      <input type="text" value={selectedProperty.property_type || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Units</label>
                      <input type="text" value={selectedProperty.units || selectedProperty.total_units || '1'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                      <input type="text" value={selectedProperty.city || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                      <input type="text" value={selectedProperty.address || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Contact Phone</label>
                      <input type="text" value={selectedProperty.contact_phone || selectedProperty.phone || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Contact Email</label>
                      <input type="text" value={selectedProperty.contact_email || selectedProperty.email || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                  </div>

                  {/* Unit Details - Property Type Specific */}
                  <div className="bg-slate-50 rounded-lg p-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">Unit Details</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded">{selectedProperty.property_type?.toUpperCase() || 'GC'}</span>
                    </div>
                    {(() => {
                      const propType = (selectedProperty.property_type || '').toUpperCase();
                      
                      // FLAT - Show Flat Number
                      if (propType === 'FLAT' || propType === 'FL' || propType === 'FLATS') {
                        return (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Flat Number</label>
                              <input type="text" value={selectedProperty.flat_number || selectedProperty.villa_plot_number || selectedProperty.unit_number || '-'} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                            </div>
                          </div>
                        );
                      }
                      
                      // VILLA - Show Villa Number
                      if (propType === 'VILLA' || propType === 'VL' || propType === 'VILLAS') {
                        return (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Villa Number</label>
                              <input type="text" value={selectedProperty.villa_number || selectedProperty.villa_plot_number || selectedProperty.unit_number || '-'} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                            </div>
                          </div>
                        );
                      }
                      
                      // PLOT - Show Plot Number
                      if (propType === 'PLOT' || propType === 'PL' || propType === 'PLOTS') {
                        return (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Plot Number</label>
                              <input type="text" value={selectedProperty.plot_number || selectedProperty.villa_plot_number || selectedProperty.unit_number || '-'} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                            </div>
                          </div>
                        );
                      }
                      
                      // GC/APT - Show Block Details
                      let blockNames = selectedProperty.block_names || selectedProperty.blockNames;
                      let unitsPerBlock = selectedProperty.units_per_block || selectedProperty.unitsPerBlock;
                      let blockUnitTypes = selectedProperty.block_unit_types || selectedProperty.blockUnitTypes;
                      if (typeof blockNames === 'string') try { blockNames = JSON.parse(blockNames); } catch(e) { blockNames = {}; }
                      if (typeof unitsPerBlock === 'string') try { unitsPerBlock = JSON.parse(unitsPerBlock); } catch(e) { unitsPerBlock = {}; }
                      if (typeof blockUnitTypes === 'string') try { blockUnitTypes = JSON.parse(blockUnitTypes); } catch(e) { blockUnitTypes = {}; }
                      const numBlocks = selectedProperty.number_of_blocks || selectedProperty.numberOfBlocks || Object.keys(blockNames || {}).length || 1;
                      const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };
                      
                      if (numBlocks > 1 || Object.keys(blockNames || {}).length > 0) {
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                              const unitTypes = blockUnitTypes?.[blockNum] || blockUnitTypes?.[String(blockNum)] || {};
                              const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                              return (
                                <div key={blockNum} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <label className="block text-xs font-medium text-slate-500 mb-1">Block Name</label>
                                      <p className="text-sm font-semibold text-gray-800">{blockNames?.[blockNum] || blockNames?.[String(blockNum)] || `Block ${blockNum}`}</p>
                                    </div>
                                    <div className="text-right">
                                      <label className="block text-xs font-medium text-slate-500 mb-1">Units</label>
                                      <p className="text-sm font-medium text-gray-700">{unitsPerBlock?.[blockNum] || unitsPerBlock?.[String(blockNum)] || 0}</p>
                                    </div>
                                  </div>
                                  {hasUnitTypes && (
                                    <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
                                      {Object.entries(unitTypes).filter(([, count]) => count > 0).map(([type, count]) => (
                                        <span key={type} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                                          {unitTypeLabels[type] || type}: {count}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // For APT, check 'apt' key first since that's how it's stored
                        const unitTypes = blockUnitTypes?.['apt'] || blockUnitTypes?.[1] || blockUnitTypes?.['1'] || {};
                        const propType = (selectedProperty.property_type || selectedProperty.entry_type || '').toUpperCase();
                        const isAPT = propType === 'APT' || propType === 'APARTMENT';
                        return (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Block Name</label>
                                <input type="text" value={selectedProperty.block_name || selectedProperty.block_info || blockNames?.[1] || blockNames?.['1'] || 'A'} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Number of Units</label>
                                <input type="text" value={`${selectedProperty.units || selectedProperty.total_units || unitsPerBlock?.[1] || 1} Units`} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                              </div>
                            </div>
                            {isAPT && (
                              <div className="flex flex-wrap gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                                <span className="text-xs font-medium text-slate-500 mr-2">Unit Types:</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">Studio: {unitTypes.studio || 0}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">1 BHK: {unitTypes.oneBed || 0}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">2 BHK: {unitTypes.twoBed || 0}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">3 BHK: {unitTypes.threeBed || 0}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">4 BHK: {unitTypes.fourBed || 0}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* AMC Package */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">AMC Package</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Select AMC Package <span className="text-red-500">*</span></label>
                <select 
                  value={estimateForm.selectedPackage} 
                  onChange={(e) => setEstimateForm({...estimateForm, selectedPackage: e.target.value})}
                  className="w-full max-w-md px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                  {(() => {
                    const propertyType = selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm?.propertyType;
                    const searchType = normalizePropertyType(propertyType);
                    const filteredPkgs = searchType ? amcPackages.filter(pkg => getPkgPropertyType(pkg) === searchType) : [];
                    if (!searchType) return <option disabled>Select property type first</option>;
                    if (searchType && filteredPkgs.length === 0) return <option disabled>No packages for {propertyType}</option>;
                    return filteredPkgs.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>);
                  })()}
                </select>
              </div>

              {/* Package Details Card */}
              {(() => {
                const pkg = getSelectedPackage();
                if (!pkg) return null;
                const services = pkg.parsedServices || [];
                let svcData = pkg.services;
                if (typeof svcData === 'string') { try { svcData = JSON.parse(svcData); } catch(e) { svcData = {}; } }
                const billingDuration = svcData?.billing_duration || pkg.billing_duration || 'monthly';
                return (
                  <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                    <div className="px-5 py-3 flex items-center gap-3">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">{decodeHtml(pkg.name)}</span>
                      <span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                    </div>
                    <table className="w-full text-sm bg-white">
                      <thead>
                        <tr className="border-y border-blue-100">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[12%]">Service</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[53%]">Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[20%]">Frequency</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[15%]">Visits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {services.length > 0 ? services.map((svc, idx) => {
                          const freqType = svc.frequencyType || svc.frequency_type || 'Monthly';
                          const visits = svc.frequency_count ?? svc.frequencyCount ?? (FREQUENCY_COUNT_MAP?.[freqType] ?? 0);
                          return (
                            <tr key={idx} className="align-top">
                              <td className="px-3 py-2.5 text-gray-800 font-medium">{decodeHtml(svc.service || svc.name) || '-'}</td>
                              <td className={`px-3 py-2.5 text-gray-500 text-xs break-all whitespace-normal text-center max-w-[200px]`}>{decodeHtml(svc.description)?.trim() || '-'}</td>
                              <td className="px-3 py-2.5 text-gray-600">{freqType}</td>
                              <td className="px-3 py-2.5 text-center text-gray-600">{visits}</td>
                            </tr>
                          );
                        }) : <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-400">No services in package</td></tr>}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-blue-700">Total Package Price</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(pkg.price)}</span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize whitespace-nowrap">{billingDuration?.replace('-', ' ')}</span></div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Add Service from Add-ons</label>
                <select 
                  onChange={(e) => { if (e.target.value) setEstimateForm({...estimateForm, selectedAddons: [...estimateForm.selectedAddons, e.target.value]}); e.target.value = ''; }}
                  className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">+ Select Add-on to add</option>
                  {(() => {
                    // Get property type from selected property, form, or selected AMC package
                    const selectedPkg = amcPackages.find(p => p.id == estimateForm.selectedPackage);
                    const pkgPropertyType = selectedPkg?.property_type;
                    const propertyType = selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm?.propertyType || pkgPropertyType;
                    const searchType = normalizePropertyType(propertyType);
                    if (!searchType) return <option disabled>Select property type first</option>;
                    const filteredAddons = addons.filter(addon => normalizePropertyType(addon.property_type) === searchType);
                    if (filteredAddons.length === 0) return <option disabled>No add-ons for {propertyType}</option>;
                    return filteredAddons.map(addon => <option key={addon.id} value={addon.id}>{addon.service_name}</option>);
                  })()}
                </select>
              </div>

              {/* Additional Services (Add-ons) Table - Only show when add-ons selected */}
              {estimateForm.selectedAddons.length > 0 && (
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-50 px-5 py-2.5 border-b border-blue-200">
                    <span className="text-sm font-semibold text-blue-700">Additional Services (Add-ons)</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-blue-100 bg-white">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[10%]">Service</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[48%]">Description</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[18%]">Frequency</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[14%]">Visits</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[10%]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {estimateForm.selectedAddons.map((id, idx) => {
                        const addon = addons.find(a => a.id == id || a.id === parseInt(id));
                        if (!addon) return null;
                        const visits = addon.frequency_count ?? (FREQUENCY_COUNT_MAP?.[addon.frequency_type] ?? 0);
                        return (
                          <tr key={idx} className="align-top">
                            <td className="px-3 py-2.5 text-gray-800 font-medium">{decodeHtml(addon.service_name)}</td>
                            <td className={`px-3 py-2.5 text-gray-500 text-xs break-all whitespace-normal text-center max-w-[200px]`}>{decodeHtml(addon.description || addon.services?.[0]?.description) || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{addon.frequency_type || 'Monthly'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{visits}</td>
                            <td className="px-3 py-2.5 text-center">
                              <button onClick={() => setEstimateForm({...estimateForm, selectedAddons: estimateForm.selectedAddons.filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-blue-50 border-t border-blue-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td>
                        <td className="px-3 py-2.5 text-right font-bold text-blue-700">{formatCurrency(estimateForm.selectedAddons.reduce((sum, id) => sum + (addons.find(a => a.id == id)?.price || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Price Summary</h2>
            </div>
            <div className="p-6">
              {(() => {
                const pricing = calculatePricing();
                return (
                  <div className="max-w-md ml-auto space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Sub Total</span>
                      <span className="font-medium">{formatCurrency(pricing.subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Discount (%)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={estimateForm.discount} onChange={(e) => setEstimateForm({...estimateForm, discount: parseFloat(e.target.value) || 0})} className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center" min="0" max="100" />
                        <span className="text-gray-500">- {formatCurrency(pricing.discountAmt)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">GST (%)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={estimateForm.gst} onChange={(e) => setEstimateForm({...estimateForm, gst: e.target.value === '' ? '' : parseFloat(e.target.value)})} className="w-16 px-2 py-1 border border-blue-300 bg-blue-50 rounded text-sm text-center text-blue-700" placeholder="0" />
                        <span className="text-gray-500">+ {formatCurrency(pricing.gstAmt)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800 text-white px-4 py-3 rounded-lg mt-4">
                      <span className="font-medium">Total Amount</span>
                      <span className="text-lg font-bold">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Description / Notes - Under Price Summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Description / Notes</h2>
            </div>
            <div className="p-6">
              <textarea 
                value={estimateForm.description} 
                onChange={(e) => setEstimateForm({...estimateForm, description: e.target.value})}
                placeholder="Add any additional notes or description for this estimate..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-y min-h-[100px]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={handleBackFromEstimate} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
            <button onClick={handleSaveEstimate} disabled={savingEstimate} className={`px-6 py-2.5 rounded-lg text-sm font-medium ${savingEstimate ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} text-white`}>{savingEstimate ? "Saving..." : "Save"}</button>
          </div>
        </div>
      )}

      {/* Direct-Based Estimate Form */}
      {estimateType === 'direct' && (
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Customer Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter customer name" value={estimateForm.customerName} onChange={(e) => setEstimateForm({...estimateForm, customerName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
                  <div className="flex w-full">
                    <select value={estimateForm.countryCode || '+91'} onChange={(e) => setEstimateForm({...estimateForm, countryCode: e.target.value})} className="shrink-0 px-2 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-sm bg-gray-50">
                      <option value="+91">+91</option>
                    </select>
                    <input type="tel" placeholder="10-digit phone number" value={estimateForm.phone} maxLength={10} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setEstimateForm({...estimateForm, phone: val}); }} className="min-w-0 flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg text-sm" />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                  <input type="email" placeholder="Enter email address" value={estimateForm.email} onChange={(e) => setEstimateForm({...estimateForm, email: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Property Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Property Type <span className="text-red-500">*</span></label>
                  <select value={estimateForm.propertyType} onChange={(e) => setEstimateForm({...estimateForm, propertyType: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">Select Property Type</option>
                    {PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Property Name</label>
                  <input type="text" placeholder="Enter property name" value={estimateForm.propertyName} onChange={(e) => setEstimateForm({...estimateForm, propertyName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Zone</label>
                  <input type="text" placeholder="Enter zone" value={estimateForm.zone} onChange={(e) => setEstimateForm({...estimateForm, zone: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">City</label>
                  <input type="text" placeholder="Enter city" value={estimateForm.city} onChange={(e) => setEstimateForm({...estimateForm, city: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Address</label>
                <input type="text" placeholder="Enter full address" value={estimateForm.address} onChange={(e) => setEstimateForm({...estimateForm, address: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              
              {/* Blocks & Units - Only for GC - Dynamic blocks */}
              {estimateForm.propertyType === 'GC' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">Block Details</h4>
                  <div className="mb-4 max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Blocks <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={estimateForm.numberOfBlocks} onChange={(e) => { const blocks = parseInt(e.target.value) || 1; setEstimateForm({...estimateForm, numberOfBlocks: blocks, unitsPerBlock: {}}); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: parseInt(estimateForm.numberOfBlocks) || 1 }, (_, i) => i + 1).map(blockNum => (
                      <React.Fragment key={blockNum}>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Block Name</label>
                          <input type="text" value={estimateForm.blockNames?.[blockNum] || ''} onChange={(e) => { const newBlockNames = {...(estimateForm.blockNames || {}), [blockNum]: e.target.value}; setEstimateForm({...estimateForm, blockNames: newBlockNames}); }} placeholder={`Block ${blockNum}`} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Units <span className="text-red-500">*</span></label>
                          <input type="number" min="1" value={estimateForm.unitsPerBlock?.[blockNum] || ''} onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...(estimateForm.unitsPerBlock || {}), [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setEstimateForm({...estimateForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }} placeholder="No. of units" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  {(estimateForm.totalUnits > 0 || estimateForm.numberOfUnits > 0) && (<div className="mt-3 p-2 bg-blue-100 rounded inline-block"><span className="text-sm text-blue-700 font-medium">Total Units: {estimateForm.totalUnits || estimateForm.numberOfUnits}</span></div>)}
                </div>
              )}

              {/* Apartment */}
              {estimateForm.propertyType === 'APT' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tower/Building Name</label>
                    <input type="text" value={estimateForm.blockName || ''} onChange={(e) => setEstimateForm({...estimateForm, blockName: e.target.value})} placeholder="Tower/Building name" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Block Number</label>
                    <input type="text" value={estimateForm.blockNumber} onChange={(e) => setEstimateForm({...estimateForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Units <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={estimateForm.numberOfUnits} onChange={(e) => setEstimateForm({...estimateForm, numberOfUnits: e.target.value})} placeholder="Total units" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              )}

              {/* Villa */}
              {estimateForm.propertyType === 'VILLA' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Villa Number <span className="text-red-500">*</span></label>
                    <input type="text" value={estimateForm.villaNumber} onChange={(e) => setEstimateForm({...estimateForm, villaNumber: e.target.value})} placeholder="Enter villa number" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              )}

              {/* Flat */}
              {estimateForm.propertyType === 'FLAT' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Flat Number <span className="text-red-500">*</span></label>
                    <input type="text" value={estimateForm.flatNumber} onChange={(e) => setEstimateForm({...estimateForm, flatNumber: e.target.value})} placeholder="Enter flat number" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              )}

              {/* Plot */}
              {estimateForm.propertyType === 'PLOT' && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plot Number <span className="text-red-500">*</span></label>
                    <input type="text" value={estimateForm.plotNumber} onChange={(e) => setEstimateForm({...estimateForm, plotNumber: e.target.value})} placeholder="Enter plot number" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AMC Package */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">AMC Package</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Select AMC Package <span className="text-red-500">*</span></label>
                <select 
                  value={estimateForm.selectedPackage} 
                  onChange={(e) => setEstimateForm({...estimateForm, selectedPackage: e.target.value, selectedAddons: []})}
                  className="w-full max-w-md px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                  {(() => {
                    const searchType = normalizePropertyType(estimateForm.propertyType);
                    const filteredPkgs = searchType ? amcPackages.filter(pkg => getPkgPropertyType(pkg) === searchType) : [];
                    if (!searchType) return <option disabled>Select property type first</option>;
                    if (searchType && filteredPkgs.length === 0) return <option disabled>No packages for {estimateForm.propertyType}</option>;
                    return filteredPkgs.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>);
                  })()}
                </select>
              </div>

              {/* Package Details Card */}
              {(() => {
                const pkg = getSelectedPackage();
                if (!pkg) return null;
                const services = pkg.parsedServices || [];
                let svcData = pkg.services;
                if (typeof svcData === 'string') { try { svcData = JSON.parse(svcData); } catch(e) { svcData = {}; } }
                const billingDuration = svcData?.billing_duration || pkg.billing_duration || 'monthly';
                return (
                  <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                    <div className="px-5 py-3 flex items-center gap-3">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">{decodeHtml(pkg.name)}</span>
                      <span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                    </div>
                    <table className="w-full text-sm bg-white">
                      <thead>
                        <tr className="border-y border-blue-100">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[12%]">Service</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[53%]">Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[20%]">Frequency</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[15%]">Visits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {services.length > 0 ? services.map((svc, idx) => {
                          const freqType = svc.frequencyType || svc.frequency_type || 'Monthly';
                          const visits = svc.frequency_count ?? svc.frequencyCount ?? (FREQUENCY_COUNT_MAP?.[freqType] ?? 0);
                          return (
                            <tr key={idx} className="align-top">
                              <td className="px-3 py-2.5 text-gray-800 font-medium">{decodeHtml(svc.service || svc.name) || '-'}</td>
                              <td className={`px-3 py-2.5 text-gray-500 text-xs break-all whitespace-normal text-center max-w-[200px]`}>{decodeHtml(svc.description)?.trim() || '-'}</td>
                              <td className="px-3 py-2.5 text-gray-600">{freqType}</td>
                              <td className="px-3 py-2.5 text-center text-gray-600">{visits}</td>
                            </tr>
                          );
                        }) : <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-400">No services in package</td></tr>}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-blue-700">Total Package Price</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(pkg.price)}</span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize whitespace-nowrap">{billingDuration?.replace('-', ' ')}</span></div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Add Service from Add-ons</label>
                <select 
                  onChange={(e) => { if (e.target.value) setEstimateForm({...estimateForm, selectedAddons: [...estimateForm.selectedAddons, e.target.value]}); e.target.value = ''; }}
                  className="w-full max-w-sm px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">+ Select Add-on to add</option>
                  {(() => {
                    // Get property type from selected property, form, or selected AMC package
                    const selectedPkg = amcPackages.find(p => p.id == estimateForm.selectedPackage);
                    const pkgPropertyType = selectedPkg?.property_type;
                    const propertyType = selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm?.propertyType || pkgPropertyType;
                    const searchType = normalizePropertyType(propertyType);
                    if (!searchType) return <option disabled>Select property type first</option>;
                    const filteredAddons = addons.filter(addon => normalizePropertyType(addon.property_type) === searchType);
                    if (filteredAddons.length === 0) return <option disabled>No add-ons for {propertyType}</option>;
                    return filteredAddons.map(addon => <option key={addon.id} value={addon.id}>{addon.service_name}</option>);
                  })()}
                </select>
              </div>

              {/* Additional Services (Add-ons) Table - Only show when add-ons selected */}
              {estimateForm.selectedAddons.length > 0 && (
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <div className="bg-blue-50 px-5 py-2.5 border-b border-blue-200">
                    <span className="text-sm font-semibold text-blue-700">Additional Services (Add-ons)</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-blue-100 bg-white">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[10%]">Service</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[48%]">Description</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[18%]">Frequency</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[14%]">Visits</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[10%]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {estimateForm.selectedAddons.map((id, idx) => {
                        const addon = addons.find(a => a.id == id || a.id === parseInt(id));
                        if (!addon) return null;
                        const visits = addon.frequency_count ?? (FREQUENCY_COUNT_MAP?.[addon.frequency_type] ?? 0);
                        return (
                          <tr key={idx} className="align-top">
                            <td className="px-3 py-2.5 text-gray-800 font-medium">{decodeHtml(addon.service_name)}</td>
                            <td className={`px-3 py-2.5 text-gray-500 text-xs break-all whitespace-normal text-center max-w-[200px]`}>{decodeHtml(addon.description || addon.services?.[0]?.description) || '-'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{addon.frequency_type || 'Monthly'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{visits}</td>
                            <td className="px-3 py-2.5 text-center">
                              <button onClick={() => setEstimateForm({...estimateForm, selectedAddons: estimateForm.selectedAddons.filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-blue-50 border-t border-blue-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td>
                        <td className="px-3 py-2.5 text-right font-bold text-blue-700">{formatCurrency(estimateForm.selectedAddons.reduce((sum, id) => sum + (addons.find(a => a.id == id)?.price || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            </div>
          </div>

          {/* Price Summary - Only show when package selected */}
          {estimateForm.selectedPackage && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Price Summary</h2>
            </div>
            <div className="p-6">
              {(() => {
                const pricing = calculatePricing();
                return (
                  <div className="max-w-md ml-auto space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Sub Total</span>
                      <span className="font-medium">{formatCurrency(pricing.subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Discount (%)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={estimateForm.discount} onChange={(e) => setEstimateForm({...estimateForm, discount: parseFloat(e.target.value) || 0})} className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center" min="0" max="100" />
                        <span className="text-gray-500">- {formatCurrency(pricing.discountAmt)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">GST (%)</span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={estimateForm.gst} onChange={(e) => setEstimateForm({...estimateForm, gst: e.target.value === '' ? '' : parseFloat(e.target.value)})} className="w-16 px-2 py-1 border border-blue-300 bg-blue-50 rounded text-sm text-center text-blue-700" placeholder="0" />
                        <span className="text-gray-500">+ {formatCurrency(pricing.gstAmt)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800 text-white px-4 py-3 rounded-lg mt-4">
                      <span className="font-medium">Total Amount</span>
                      <span className="text-lg font-bold">{formatCurrency(pricing.total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          )}

          {/* Description / Notes - Under Price Summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Description / Notes</h2>
            </div>
            <div className="p-6">
              <textarea 
                value={estimateForm.description} 
                onChange={(e) => setEstimateForm({...estimateForm, description: e.target.value})}
                placeholder="Add any additional notes or description for this estimate..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-y min-h-[100px]"
              />
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
            * Currency: INR (₹) | GST applied on total | Fields marked with * are mandatory
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setEstimateType(null)} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
            <button onClick={handleSaveEstimate} disabled={savingEstimate} className={`px-6 py-2.5 rounded-lg text-sm font-medium ${savingEstimate ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} text-white`}>{savingEstimate ? "Saving..." : "Save"}</button>
          </div>
        </div>
      )}

      {/* Work Order Estimate Form */}
      {estimateType === 'work_order' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Completed Work Orders List */}
          {workOrderStep === 'input' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-800">Completed Work Orders</h3>
                  <p className="text-xs text-gray-500">Select a work order to create an estimate</p>
                </div>
              </div>
              
              {workOrderError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{workOrderError}</p>
                </div>
              )}

              {loadingCompletedWO ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  <span className="ml-2 text-gray-500">Loading work orders...</span>
                </div>
              ) : completedWorkOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No completed work orders found</p>
                  <p className="text-sm mt-1">Complete some work orders first to create estimates</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Work Order ID</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Customer</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Category</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Created</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Property</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedWorkOrders.map((wo) => (
                        <tr 
                          key={wo.id} 
                          onClick={async () => {
                            setWorkOrderLoading(true);
                            setWorkOrderError('');
                            try {
                              const response = await fetch(`${API_BASE}/api/fp/work-orders/by-order-id/${encodeURIComponent(wo.work_order_id)}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              const result = await response.json();
                              if (result.success && result.data) {
                                setWorkOrderData(result.data);
                                setWorkOrderStep('review');
                              } else {
                                setWorkOrderError(result.message || 'Failed to load work order details.');
                              }
                            } catch (error) {
                              setWorkOrderError('Failed to fetch work order. Please try again.');
                            } finally {
                              setWorkOrderLoading(false);
                            }
                          }}
                          className="border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 font-medium text-gray-900">{wo.work_order_id}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-800">{wo.customer_name || wo.client_name || '-'}</div>
                            <div className="text-xs text-gray-500">{wo.property_name || wo.community_name || '-'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium">{wo.category_name || '-'}</div>
                            <div className="text-xs text-gray-500">{wo.subcategory_name || '-'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              {wo.status || 'Completed'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-600">
                            {wo.created_at ? new Date(wo.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-gray-800">{wo.customer_name || wo.client_name || '-'}</div>
                            <div className="text-xs text-gray-500">{wo.property_code || wo.property_id || '-'}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {workOrderLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-xl flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    <span className="text-gray-700">Loading work order details...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Work Order Review & Pricing Step */}
          {workOrderStep === 'review' && workOrderData && (
            <div className="p-6 space-y-6">
              {/* Work Order Info */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Work Order Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div><span className="text-xs text-gray-500 block">Work Order ID</span><span className="font-medium text-orange-700">{workOrderData.work_order_id}</span></div>
                  <div><span className="text-xs text-gray-500 block">Category</span><span className="font-medium">{workOrderData.category_name || '-'}</span></div>
                  <div><span className="text-xs text-gray-500 block">Subcategory</span><span className="font-medium">{workOrderData.subcategory_name || '-'}</span></div>
                  <div><span className="text-xs text-gray-500 block">Priority</span><span className={`font-medium uppercase ${workOrderData.priority === 'high' ? 'text-red-600' : workOrderData.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{workOrderData.priority || '-'}</span></div>
                  <div><span className="text-xs text-gray-500 block">Created</span><span className="font-medium">{workOrderData.created_at ? new Date(workOrderData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span></div>
                </div>
                {workOrderData.description && (
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <span className="text-xs text-gray-500 block mb-1">Description</span>
                    <p className="text-sm text-gray-700">{workOrderData.description}</p>
                  </div>
                )}
              </div>

              {/* Property & Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">Property Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Property:</span> <span className="font-medium">{workOrderData.property_name || workOrderData.community_name || '-'}</span></div>
                    <div><span className="text-gray-500">Property ID:</span> <span className="font-medium">{workOrderData.property_code || workOrderData.property_id || '-'}</span></div>
                    <div><span className="text-gray-500">Type:</span> <span className="font-medium">{workOrderData.property_type || '-'}</span></div>
                    <div><span className="text-gray-500">Zone / Division:</span> <span className="font-medium">{workOrderData.zone || '-'} / {workOrderData.division || '-'}</span></div>
                    <div><span className="text-gray-500">Address:</span> <span className="font-medium">{workOrderData.address || '-'}</span></div>
                  </div>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-green-800 mb-3">Customer Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{workOrderData.client_name || workOrderData.customer_name || '-'}</span></div>
                    <div><span className="text-gray-500">Email:</span> <span className="font-medium">{workOrderData.client_email || workOrderData.customer_email || '-'}</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{workOrderData.client_phone || workOrderData.customer_phone || '-'}</span></div>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-800 mb-4">Estimate Pricing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
                    <input type="number" value={workOrderAmount} onChange={(e) => setWorkOrderAmount(e.target.value)} placeholder="Enter amount" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                    <input type="number" value={workOrderDiscount} onChange={(e) => setWorkOrderDiscount(e.target.value)} placeholder="0" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
                    <input type="number" value={workOrderGst} onChange={(e) => setWorkOrderGst(e.target.value)} placeholder="18" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                  </div>
                </div>
                
                {/* Price Summary */}
                {workOrderAmount && parseFloat(workOrderAmount) > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Subtotal:</span><span>₹{parseFloat(workOrderAmount || 0).toLocaleString('en-IN')}</span></div>
                    {parseFloat(workOrderDiscount || 0) > 0 && <div className="flex justify-between text-sm mb-1 text-red-600"><span>Discount ({workOrderDiscount}%):</span><span>-₹{(parseFloat(workOrderAmount || 0) * parseFloat(workOrderDiscount || 0) / 100).toLocaleString('en-IN')}</span></div>}
                    {parseFloat(workOrderGst || 0) > 0 && <div className="flex justify-between text-sm mb-1 text-blue-600"><span>GST ({workOrderGst}%):</span><span>+₹{((parseFloat(workOrderAmount || 0) - (parseFloat(workOrderAmount || 0) * parseFloat(workOrderDiscount || 0) / 100)) * parseFloat(workOrderGst || 0) / 100).toLocaleString('en-IN')}</span></div>}
                    <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-gray-300"><span>Total:</span><span className="text-orange-600">₹{(() => { const amt = parseFloat(workOrderAmount || 0); const disc = amt * parseFloat(workOrderDiscount || 0) / 100; const afterDisc = amt - disc; const gst = afterDisc * parseFloat(workOrderGst || 0) / 100; return (afterDisc + gst).toLocaleString('en-IN'); })()}</span></div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea value={workOrderNotes} onChange={(e) => setWorkOrderNotes(e.target.value)} rows={3} placeholder="Add any additional notes..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setWorkOrderStep('input'); setWorkOrderData(null); }} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
                <button
                  onClick={async () => {
                    if (!workOrderAmount || parseFloat(workOrderAmount) <= 0) { showToast('Please enter a valid amount', 'error'); return; }
                    setSavingWorkOrder(true);
                    try {
                      const amt = parseFloat(workOrderAmount || 0);
                      const discPercent = parseFloat(workOrderDiscount || 0);
                      const gstPercent = parseFloat(workOrderGst || 0);
                      const discAmt = amt * discPercent / 100;
                      const afterDisc = amt - discAmt;
                      const gstAmt = afterDisc * gstPercent / 100;
                      const total = afterDisc + gstAmt;
                      
                      const payload = {
                        estimate_type: 'work_order',
                        property_id: workOrderData.property_id || null,
                        property_code: workOrderData.property_code || null,
                        client_name: workOrderData.client_name || workOrderData.customer_name || '',
                        client_email: workOrderData.client_email || workOrderData.customer_email || '',
                        client_phone: workOrderData.client_phone || workOrderData.customer_phone || '',
                        // Property details from work order
                        property_name: workOrderData.property_name || '',
                        property_type: workOrderData.property_type || workOrderData.entry_type || '',
                        zone: workOrderData.zone || '',
                        division: workOrderData.division || '',
                        city: workOrderData.city || '',
                        address: workOrderData.address || '',
                        // Pricing with correct field names
                        subtotal: amt,
                        discount_percent: discPercent,
                        discount_amount: discAmt,
                        gst_percent: gstPercent,
                        gst_amount: gstAmt,
                        total_amount: Math.round(total),
                        description: workOrderNotes,
                        // Work order details
                        work_order_id: workOrderData.work_order_id,
                        work_order_category: workOrderData.category_name,
                        work_order_subcategory: workOrderData.subcategory_name,
                        work_order_description: workOrderData.description,
                        work_order_priority: workOrderData.priority,
                        work_order_status: workOrderData.status
                      };
                      
                      const response = await fetch(`${API_BASE}/api/fp/estimates`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(payload)
                      });
                      const result = await response.json();
                      
                      if (result.success) {
                        showToast('Work Order Estimate created successfully!', 'success');
                        setEstimateType(null);
                        setWorkOrderStep('input');
                        setWorkOrderData(null);
                        setWorkOrderIdInput('');
                        setWorkOrderAmount('');
                        setWorkOrderDiscount('');
                        setWorkOrderGst('18');
                        setWorkOrderNotes('');
                        loadData();
                      } else {
                        showToast(result.message || 'Failed to create estimate', 'error');
                      }
                    } catch (error) {
                      showToast('Failed to create estimate. Please try again.', 'error');
                    } finally {
                      setSavingWorkOrder(false);
                    }
                  }}
                  disabled={savingWorkOrder || !workOrderAmount || parseFloat(workOrderAmount) <= 0}
                  className="px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingWorkOrder ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Estimate'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FP Portal Links Section - Only show when estimate type is not selected */}
      {!estimateType && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Link className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">FP Portal Links</h2>
              <p className="text-xs text-gray-500 mt-0.5">Share up to 2 custom links with your employees (Google Drive, Sheets, Docs, or any URL)</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Link Block 1 */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-white transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">1</span>
              <span className="text-sm font-medium text-gray-700">Link Block 1</span>
              {linkForms[1].id && !linkForms[1].isEditing && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            
            {/* Heading Row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={linkForms[1].heading}
                  onChange={(e) => handleLinkFormChange(1, 'heading', e.target.value)}
                  placeholder="Enter Link Heading (e.g., Floor Plan Documents)"
                  disabled={linkForms[1].id && !linkForms[1].isEditing}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                    linkForms[1].id && !linkForms[1].isEditing 
                      ? 'bg-gray-100 border-gray-200 text-gray-700' 
                      : 'bg-white border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400'
                  }`}
                />
              </div>
              {linkForms[1].id && !linkForms[1].isEditing ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEditLink(1)} 
                    className="px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDeletePortalLink(1)} 
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleSavePortalLink(1)} 
                  disabled={linkForms[1].isSaving}
                  className="px-4 py-2.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-200 disabled:bg-indigo-50 disabled:text-indigo-400 transition-colors flex items-center gap-1.5"
                >
                  {linkForms[1].isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Done
                    </>
                  )}
                </button>
              )}
              {linkForms[1].isEditing && (
                <button 
                  onClick={() => handleCancelEdit(1)} 
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* URL Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={linkForms[1].url}
                  onChange={(e) => handleLinkFormChange(1, 'url', e.target.value)}
                  placeholder="Paste any external URL (Google Drive, Sheets, etc.)"
                  disabled={linkForms[1].id && !linkForms[1].isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm transition-colors ${
                    linkForms[1].id && !linkForms[1].isEditing 
                      ? 'bg-gray-100 border-gray-200 text-gray-600' 
                      : 'bg-white border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400'
                  }`}
                />
              </div>
              {linkForms[1].id && !linkForms[1].isEditing && linkForms[1].url && (
                <a 
                  href={linkForms[1].url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-200"
                >
                  <ExternalLink className="w-4 h-4" /> Open Link
                </a>
              )}
            </div>
            
            {/* Error Message */}
            {linkErrors[1] && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {linkErrors[1]}
              </div>
            )}
          </div>

          {/* Link Block 2 */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-white transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold">2</span>
              <span className="text-sm font-medium text-gray-700">Link Block 2</span>
              {linkForms[2].id && !linkForms[2].isEditing && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            
            {/* Heading Row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={linkForms[2].heading}
                  onChange={(e) => handleLinkFormChange(2, 'heading', e.target.value)}
                  placeholder="Enter Link Heading (e.g., Material Selection Sheet)"
                  disabled={linkForms[2].id && !linkForms[2].isEditing}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                    linkForms[2].id && !linkForms[2].isEditing 
                      ? 'bg-gray-100 border-gray-200 text-gray-700' 
                      : 'bg-white border-gray-300 focus:ring-2 focus:ring-purple-200 focus:border-purple-400'
                  }`}
                />
              </div>
              {linkForms[2].id && !linkForms[2].isEditing ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEditLink(2)} 
                    className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDeletePortalLink(2)} 
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleSavePortalLink(2)} 
                  disabled={linkForms[2].isSaving}
                  className="px-4 py-2.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:bg-purple-50 disabled:text-purple-400 transition-colors flex items-center gap-1.5"
                >
                  {linkForms[2].isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Done
                    </>
                  )}
                </button>
              )}
              {linkForms[2].isEditing && (
                <button 
                  onClick={() => handleCancelEdit(2)} 
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* URL Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={linkForms[2].url}
                  onChange={(e) => handleLinkFormChange(2, 'url', e.target.value)}
                  placeholder="Paste any external URL (Google Drive, Sheets, etc.)"
                  disabled={linkForms[2].id && !linkForms[2].isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm transition-colors ${
                    linkForms[2].id && !linkForms[2].isEditing 
                      ? 'bg-gray-100 border-gray-200 text-gray-600' 
                      : 'bg-white border-gray-300 focus:ring-2 focus:ring-purple-200 focus:border-purple-400'
                  }`}
                />
              </div>
              {linkForms[2].id && !linkForms[2].isEditing && linkForms[2].url && (
                <a 
                  href={linkForms[2].url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1.5 border border-purple-200"
                >
                  <ExternalLink className="w-4 h-4" /> Open Link
                </a>
              )}
            </div>
            
            {/* Error Message */}
            {linkErrors[2] && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {linkErrors[2]}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Links shared here will be visible to all employees assigned to you. Maximum 2 links allowed.
        </div>
      </div>
      )}
    </div>
  );

  // Export all estimates to Excel
  const exportAllEstimates = () => {
    if (filteredEstimates.length === 0) {
      showToast('No estimates to export', 'error');
      return;
    }
    const exportData = filteredEstimates.map(e => ({
      'Estimate ID': e.estimate_id || '-',
      'Type': e.estimate_type === 'work_order' ? 'Work Order' : e.estimate_type === 'property_based' || e.estimate_type === 'property-based' ? 'Property Based' : 'Direct',
      'Work Order ID': e.work_order_id || '-',
      'Client Name': e.client_name || '-',
      'Property': e.property_name || '-',
      'Property Type': e.property_type || '-',
      'AMC Package': e.package_name || '-',
      'Subtotal': e.subtotal || 0,
      'Discount': e.discount || 0,
      'GST': e.gst || 0,
      'Total': e.total || 0,
      'Status': e.status || '-',
      'Created By': e.created_by_name || '-',
      'Created Date': formatDateIST(e.created_at)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimates');
    XLSX.writeFile(wb, `All_Estimates_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Estimates exported successfully');
  };

  // ALL ESTIMATES
  const filteredEstimates = estimates.filter(e => {
    const search = searchTerm.toLowerCase();
    const matchSearch = !searchTerm || (
      (e.title || '').toLowerCase().includes(search) || 
      (e.estimate_id || '').toLowerCase().includes(search) || 
      (e.client_name || '').toLowerCase().includes(search) ||
      (e.property_code || '').toLowerCase().includes(search) ||
      (e.property_name || '').toLowerCase().includes(search) ||
      (e.property_id?.toString() || '').toLowerCase().includes(search)
    );
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchType = filterType === 'all' || e.estimate_type === filterType || (filterType === 'property_based' && (e.estimate_type === 'property_based' || e.estimate_type === 'property-based'));
    // Property category filter should work for ALL estimates that have a property_type (both direct and property-based)
    const matchCategory = filterCategory === 'all' || (e.property_type && normalizePropertyType(e.property_type) === filterCategory);
    // Date range filter
    let matchDate = true;
    if (filterFromDate || filterToDate) {
      const estDate = e.created_at ? new Date(e.created_at) : null;
      if (estDate) {
        if (filterFromDate) {
          const fromDate = new Date(filterFromDate);
          fromDate.setHours(0, 0, 0, 0);
          if (estDate < fromDate) matchDate = false;
        }
        if (filterToDate) {
          const toDate = new Date(filterToDate);
          toDate.setHours(23, 59, 59, 999);
          if (estDate > toDate) matchDate = false;
        }
      }
    }
    return matchSearch && matchStatus && matchType && matchCategory && matchDate;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterType, filterCategory, filterFromDate, filterToDate]);

  // Pagination calculations for estimates
  const totalPages = Math.ceil(filteredEstimates.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEstimates = filteredEstimates.slice(startIndex, endIndex);

  const renderAllEstimates = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search by Property ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.trim())} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"><Filter className="w-4 h-4" />Filters<ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} /></button>
          <button onClick={exportAllEstimates} className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors text-sm font-medium"><Download className="w-4 h-4" />Export All</button>
          {/* Archive Selected button - only visible when items are selected and not FP Manager */}
          {!isFPManager && selectedEstimates.length > 0 && (
            <button
              onClick={handleBulkArchive}
              disabled={archivingSelected}
              className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              {archivingSelected ? 'Archiving...' : `Archive Selected (${selectedEstimates.length})`}
            </button>
          )}
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimate Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="all">All Estimates</option>
                  <option value="property_based">Property Based</option>
                  <option value="direct">Direct</option>
                  <option value="work_order">Work Order</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Property Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="all">All Categories</option>
                  <option value="GC">Gated Community</option>
                  <option value="APT">Apartment</option>
                  <option value="VILLA">Villa</option>
                  <option value="FLAT">Flat</option>
                  <option value="PLOT">Plot</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="dd/mm/yyyy"
                    value={filterFromDateDisplay} 
                    onChange={(e) => {
                      handleDateInput(e.target.value, setFilterFromDateDisplay);
                      const parsed = parseISTDate(e.target.value);
                      if (parsed) setFilterFromDate(parsed);
                    }}
                    onBlur={() => {
                      const parsed = parseISTDate(filterFromDateDisplay);
                      if (parsed) setFilterFromDate(parsed);
                      else if (filterFromDateDisplay && filterFromDateDisplay.length < 10) setFilterFromDateDisplay('');
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm bg-white" 
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilterFromDate(e.target.value); setFilterFromDateDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="dd/mm/yyyy"
                    value={filterToDateDisplay} 
                    onChange={(e) => {
                      handleDateInput(e.target.value, setFilterToDateDisplay);
                      const parsed = parseISTDate(e.target.value);
                      if (parsed) setFilterToDate(parsed);
                    }}
                    onBlur={() => {
                      const parsed = parseISTDate(filterToDateDisplay);
                      if (parsed) setFilterToDate(parsed);
                      else if (filterToDateDisplay && filterToDateDisplay.length < 10) setFilterToDateDisplay('');
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm bg-white" 
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilterToDate(e.target.value); setFilterToDateDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => { setFilterStatus('all'); setFilterType('all'); setFilterCategory('all'); setFilterFromDate(''); setFilterToDate(''); setFilterFromDateDisplay(''); setFilterToDateDisplay(''); }} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">Clear all filters</button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="py-16 text-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div> : filteredEstimates.length === 0 ? <div className="py-16 text-center"><DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No estimates found</p><p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p></div> : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {/* Checkbox column - hidden for FP Manager */}
                  {!isFPManager && (
                    <th className="px-3 py-3 text-center w-10">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={selectedEstimates.length === filteredEstimates.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedEstimates.length === filteredEstimates.length && filteredEstimates.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Estimate ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Division</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedEstimates.map((est) => {
                  const isSelected = selectedEstimates.includes(est.id);
                  return (
                  <tr key={est.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                    {/* Checkbox cell - hidden for FP Manager */}
                    {!isFPManager && (
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => handleSelectEstimate(est.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-4 font-mono text-sm text-gray-900">{est.estimate_id}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                        est.estimate_type === 'work_order' ? 'bg-orange-50 text-orange-600' :
                        est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'bg-blue-50 text-blue-600' : 
                        'bg-purple-50 text-purple-600'
                      }`}>
                        <Link2 className="w-3 h-3" />
                        {est.estimate_type === 'work_order' ? 'Work Order' : est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'Property' : 'Direct'}
                      </span>
                      {est.estimate_type === 'work_order' && <div className="text-xs text-orange-600 mt-1">{est.property_name || est.property_code || est.work_order_id}</div>}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {(est.estimate_type === 'property_based' || est.estimate_type === 'property-based') 
                        ? (est.division || est.property_division || '-') 
                        : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{est.client_name}</div>
                      {(est.estimate_type === 'property_based' || est.estimate_type === 'property-based') && est.property_code && <div className="text-xs text-gray-400">{est.property_code}</div>}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDateIST(est.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(est.total_amount)}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{est.created_by_name || (est.created_by_role ? est.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}</div>
                      <div className="text-xs text-gray-400 capitalize">{est.created_by_name ? (est.created_by_role || '').replace(/_/g, ' ') : ''}</div>
                    </td>
                    <td className="px-4 py-4">
                      {isFPManager ? (
                        // FP Manager - View only (badge)
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getEstimateStatusColor(est.status)}`}>
                          {est.status || 'draft'}
                        </span>
                      ) : (
                        // FP Owner/Admin - Dropdown to change status
                        <div className="relative inline-block">
                          <select
                            value={(est.status || 'draft').toLowerCase()}
                            onChange={(e) => handleEstimateStatusChange(est.id, e.target.value)}
                            className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-200 ${getEstimateStatusColor(est.status)}`}
                          >
                            <option value="draft" className="bg-white text-gray-900">Draft</option>
                            <option value="sent" className="bg-white text-gray-900">Sent</option>
                            <option value="approved" className="bg-white text-gray-900">Approved</option>
                            <option value="rejected" className="bg-white text-gray-900">Rejected</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openViewEstimate(est)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye className="w-4 h-4" /></button>
                        {!isFPManager && (
                          <button onClick={() => openEditEstimate(est)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleExportPDF(est)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Download PDF"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleSendEmail(est)} disabled={sendingEmailId === est.id} className={`p-1.5 rounded ${sendingEmailId === est.id ? 'text-indigo-400 cursor-wait' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`} title="Send Email"><Send className={`w-4 h-4 ${sendingEmailId === est.id ? 'animate-pulse' : ''}`} /></button>
                        <button onClick={() => handleArchiveEstimate(est.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredEstimates.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredEstimates.length)} of {filteredEstimates.length} estimates
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );

  // AMC PACKAGES - Use getPkgPropertyType to correctly extract property type from services JSON
  const filteredAmcPackages = filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => getPkgPropertyType(p) === filterPropertyType);
  const handleSaveAmcPackage = async () => {
    if (!amcForm.packageName.trim()) { showToast('Enter package name', 'error'); return; }
    if (!selectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!amcForm.price || parseFloat(amcForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    const validSvc = amcForm.serviceRows.filter(r => r.service.trim());
    if (validSvc.length === 0) { showToast('Add at least one service', 'error'); return; }
    try {
      const isEditing = !!editingAmcPackage;
      const url = isEditing ? `/api/fp/amc-packages/${editingAmcPackage}` : '/api/fp/amc-packages';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: amcForm.packageName, description: amcForm.description || '', property_type: selectedPropertyType, services: validSvc.map(r => { const parsed = parseInt(r.frequencyCount); return { name: r.service, description: r.description || '', frequency_count: typeof r.frequencyCount === 'number' ? r.frequencyCount : (isNaN(parsed) ? 0 : parsed), frequency_type: r.frequencyType }; }), price: parseFloat(amcForm.price), billing_duration: amcForm.billingDuration }) });
      const result = await res.json();
      if (res.ok || result.success) { showToast(isEditing ? 'AMC Package updated!' : 'AMC Package created!'); resetAmcForm(); loadData(); setAmcActiveTab('all-packages'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to save package', 'error'); }
  };
  const handleDeleteAmcPackage = async (id) => { if (!window.confirm('Delete this package?')) return; try { const res = await fetch(`/api/fp/amc-packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleAddServiceRow = () => setAmcForm({ ...amcForm, serviceRows: [...amcForm.serviceRows, { service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }] });
  const handleUpdateServiceRow = (i, f, v) => { 
    const rows = [...amcForm.serviceRows]; 
    if (f === 'frequencyType') { 
      const auto = FREQUENCY_COUNT_MAP[v]; 
      rows[i] = { ...rows[i], [f]: v, frequencyCount: auto !== null ? auto : 0 }; 
    } else if (f === 'frequencyCount') {
      const parsed = parseInt(v);
      rows[i][f] = v === '' ? 0 : (isNaN(parsed) ? 0 : parsed);
    } else {
      rows[i][f] = v; 
    }
    setAmcForm({ ...amcForm, serviceRows: rows }); 
  };
  const handleRemoveServiceRow = (i) => { if (amcForm.serviceRows.length > 1) setAmcForm({ ...amcForm, serviceRows: amcForm.serviceRows.filter((_, idx) => idx !== i) }); };

  const getPrice = () => parseFloat(amcForm.price) || 0;
  const resetAmcForm = () => { setAmcForm({ packageName: '', description: '', serviceRows: [{ service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); setEditingAmcPackage(null); };
  const getBillingBadgeColor = (billing) => {
    switch (billing) {
      case 'monthly': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'quarterly': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'half-yearly': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'yearly': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const renderAmcPackages = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AMC Packages</h1>
            <p className="text-sm text-gray-500">Create and manage service packages</p>
          </div>
        </div>
      </div>

      {/* Tabs - Create Package hidden for FP Manager */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {!isFPManager && (
          <button
            onClick={() => setAmcActiveTab('create')}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${amcActiveTab === 'create' ? 'bg-white text-slate-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Package
            </div>
          </button>
        )}
        <button
          onClick={() => setAmcActiveTab('all-packages')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${amcActiveTab === 'all-packages' ? 'bg-white text-slate-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            All Packages
            {amcPackages.length > 0 && (
              <span className="px-1.5 py-0.5 bg-slate-600 text-white rounded-full text-xs">{amcPackages.length}</span>
            )}
          </div>
        </button>
      </div>

      {/* All Packages Tab */}
      {amcActiveTab === 'all-packages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">All Packages</h3>
                <p className="text-sm text-gray-500">
                  {filterPropertyType === 'all' 
                    ? `${amcPackages.length} package(s) available` 
                    : `${filteredAmcPackages.length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
                </p>
              </div>
            </div>
            
            {/* Property Type Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterPropertyType('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                All
                {amcPackages.length > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{amcPackages.length}</span>
                )}
              </button>
              {PROPERTY_TYPE_OPTIONS.map((type) => {
                const count = amcPackages.filter(p => getPkgPropertyType(p) === type.id).length;
                return (
                  <button
                    key={type.id}
                    onClick={() => setFilterPropertyType(type.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    {type.label}
                    {count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === type.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {amcPackages.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No AMC packages yet</p>
              <p className="text-sm text-gray-400 mb-4">Create your first package to get started</p>
              <button onClick={() => setAmcActiveTab('create')} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                Create Package
              </button>
            </div>
          ) : filteredAmcPackages.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No packages found for this property type</p>
              <button onClick={() => setFilterPropertyType('all')} className="mt-2 text-sm text-blue-600 hover:underline">
                Show all packages
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Package Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Property Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Billing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Services Included</th>
                    {!isFPManager && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Rate</th>}
                    {!isFPManager && <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAmcPackages.map((pkg) => {
                    // Parse services JSON if needed
                    let servicesData = pkg.services;
                    if (typeof servicesData === 'string') {
                      try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = null; }
                    }
                    const serviceRows = servicesData?.serviceRows || servicesData || [];
                    const servicesText = Array.isArray(serviceRows) ? serviceRows.map(s => s.name || s.service || s).join(', ') : '-';
                    const propertyType = servicesData?.property_type || pkg.property_type;
                    const billingDuration = servicesData?.billing_duration || pkg.billing_duration;
                    return (
                      <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{pkg.name || 'Unnamed Package'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200 whitespace-nowrap">
                            {getPropertyTypeLabel(propertyType)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${getBillingBadgeColor(billingDuration)}`}>
                            {BILLING_DURATIONS.find(d => d.value === billingDuration)?.label || 'Monthly'}
                          </span>
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <p className="text-sm text-gray-600 truncate" title={servicesText}>{servicesText}</p>
                        </td>
                        {/* Price - Hidden for FP Manager */}
                        {!isFPManager && (
                          <td className="px-4 py-4 text-right">
                            <span className="text-lg font-bold text-slate-800">{formatCurrency(pkg.price)}</span>
                          </td>
                        )}
                        {/* Action buttons - Hidden for FP Manager */}
                        {!isFPManager && (
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openViewPackage({ ...pkg, servicesData: serviceRows, propertyType, billingDuration });
                                }}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" 
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingAmcPackage(pkg.id);
                                  setAmcForm({
                                    packageName: decodeHtml(pkg.name) || '',
                                    description: decodeHtml(pkg.description) || '',
                                    serviceRows: serviceRows.length > 0 ? serviceRows.map(s => ({
                                      service: decodeHtml(s.name || s.service) || '',
                                      description: decodeHtml(s.description) || '',
                                      frequencyCount: s.frequency_count ?? s.frequencyCount ?? 0,
                                      frequencyType: s.frequency_type || s.frequencyType || 'Monthly'
                                    })) : [{ service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }],
                                    price: pkg.base_price || pkg.price || '',
                                    billingDuration: billingDuration || 'monthly'
                                  });
                                  setSelectedPropertyType(propertyType);
                                  setAmcActiveTab('create');
                                  showToast('Editing package - make changes and save', 'info');
                                }}
                                className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" 
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  // Debug: log what's in serviceRows
                                  console.log('[PDF Export] Raw serviceRows:', serviceRows);
                                  console.log('[PDF Export] First service:', serviceRows?.[0]);
                                  // Map service fields to PDF expected format
                                  const mappedServices = Array.isArray(serviceRows) ? serviceRows.map(s => {
                                    console.log('[PDF Export] Mapping service:', s);
                                    return {
                                      name: s.name || s.service || 'Service',
                                      description: s.description || '',
                                      frequencyCount: s.frequency_count ?? s.frequencyCount ?? 0,
                                      frequencyType: s.frequency_type || s.frequencyType || 'Monthly'
                                    };
                                  }) : [];
                                  const pdfData = {
                                    id: pkg.id,
                                    packageId: pkg.package_code || `PKG-${pkg.id}`,
                                    packageName: pkg.name,
                                    name: pkg.name,
                                    propertyType: propertyType,
                                    billingDuration: billingDuration,
                                    price: pkg.price || pkg.base_price,
                                    totalPrice: pkg.price || pkg.base_price,
                                    services: mappedServices,
                                    serviceRows: mappedServices,
                                    description: pkg.description,
                                    createdAt: pkg.created_at
                                  };
                                  if (exportPackageToPDF(pdfData)) {
                                    showToast('PDF downloaded!', 'success');
                                  } else {
                                    showToast('Failed to export PDF', 'error');
                                  }
                                }}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                                title="Export PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                                                            <button onClick={() => handleDeleteAmcPackage(pkg.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Package Tab */}
      {amcActiveTab === 'create' && (
        <div className="space-y-6">
          {/* Property Type Selection */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Select Property Type</h2>
            <p className="text-sm text-gray-500 mb-4">Choose the property type this package will be configured for</p>
            
            <div className="grid grid-cols-5 gap-4">
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedPropertyType(type.id)}
                  className={`px-4 py-3 rounded-lg border transition-all duration-200 text-sm font-medium text-center ${
                    selectedPropertyType === type.id
                      ? 'border-slate-400 bg-slate-100 text-slate-800 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Package Configuration Card - Only show after property type selected */}
          {selectedPropertyType && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Header with Add Button */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Package Configuration</h2>
                <button
                  onClick={handleAddServiceRow}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add Row
                </button>
              </div>
              
              <div className="p-6">
                {/* Package Name */}
                <div className="mb-6">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.packageName}
                    onChange={(e) => setAmcForm({ ...amcForm, packageName: e.target.value })}
                    placeholder="e.g., Gold Package"
                    className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400"
                  />
                </div>

                {/* Service Configuration with Price on Right */}
                <div className="flex gap-6">
                  {/* Service Rows Section */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Service Configuration</h3>
                    
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 rounded-lg mb-3">
                      <div className="col-span-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Visits</span>
                      </div>
                      <div className="col-span-1">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</span>
                      </div>
                    </div>

                    {/* Service Rows */}
                    <div className="space-y-3">
                      {amcForm.serviceRows.map((row, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {/* Service Name */}
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={row.service}
                              onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                              placeholder="e.g., Deep Cleaning"
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                            />
                          </div>
                          
                          {/* Description */}
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={row.description || ''}
                              onChange={(e) => handleUpdateServiceRow(index, 'description', e.target.value)}
                              placeholder="Service description..."
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                            />
                          </div>
                          
                          {/* Frequency Type */}
                          <div className="col-span-3 relative">
                            <select
                              value={row.frequencyType}
                              onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-white appearance-none"
                            >
                              {FREQUENCY_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                          
                          {/* Frequency Count */}
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={row.frequencyCount}
                              readOnly={row.frequencyType !== 'Other'}
                              onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                              placeholder={row.frequencyType === 'Other' ? 'Enter' : ''}
                              className={`w-full px-2 py-2 border border-gray-300 rounded-lg text-sm ${row.frequencyType === 'Other' ? 'bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400' : 'bg-gray-100 cursor-not-allowed'}`}
                            />
                          </div>
                          
                          {/* Delete Button */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              onClick={() => handleRemoveServiceRow(index)}
                              disabled={amcForm.serviceRows.length === 1}
                              className={`p-2 rounded-lg transition-colors ${
                                amcForm.serviceRows.length === 1
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-red-500 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price Section - Right Side */}
                  <div className="w-72 flex-shrink-0">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 h-full">
                      <h3 className="text-gray-600 text-xs uppercase tracking-wider mb-4 font-semibold">Price Summary</h3>
                      
                      {/* Price Input */}
                      <div className="mb-6">
                        <label className="text-gray-600 text-xs mb-2 block font-medium">Price (₹) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">₹</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={amcForm.price}
                            onChange={(e) => setAmcForm({ ...amcForm, price: e.target.value.replace(/[^0-9]/g, '') })}
                            placeholder="0"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-2xl font-bold text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                          />
                        </div>
                      </div>
                      
                      {/* Service Period */}
                      <div className="mb-6">
                        <label className="text-gray-600 text-xs mb-2 block font-medium">Service Period</label>
                        <div className="relative">
                          <select
                            value={amcForm.billingDuration}
                            onChange={(e) => setAmcForm({ ...amcForm, billingDuration: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-gray-200 focus:border-gray-400 appearance-none"
                          >
                            {BILLING_DURATIONS.map(duration => (
                              <option key={duration.value} value={duration.value}>{duration.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                      
                      {/* Summary */}
                      <div className="border-t border-gray-200 pt-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Package</span>
                          <span className="font-medium text-gray-800 truncate ml-2">{amcForm.packageName || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Services</span>
                          <span className="font-medium text-gray-800">{amcForm.serviceRows.filter(r => r.service.trim()).length}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <span className="text-sm font-semibold text-gray-700">Total Rate</span>
                          <span className="text-2xl font-bold text-gray-800">{formatCurrency(amcForm.price)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Action Buttons - Only show after property type selected */}
          {selectedPropertyType && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                <span className="text-red-500">*</span> Required fields
              </p>
              <div className="flex gap-3">
                <button
                  onClick={resetAmcForm}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleSaveAmcPackage}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ADDONS - Use normalizePropertyType for consistent filtering
  const filteredAddons = addonFilterPropertyType === 'all' ? addons : addons.filter(a => normalizePropertyType(a.property_type) === addonFilterPropertyType);
  const handleSaveAddon = async () => {
    if (!addonSelectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!addonForm.serviceName.trim()) { showToast('Enter service name', 'error'); return; }
    if (!addonForm.price || parseFloat(addonForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/fp/addons`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ property_type: addonSelectedPropertyType, service_name: addonForm.serviceName, frequency_count: !isNaN(parseInt(addonForm.frequencyCount)) ? parseInt(addonForm.frequencyCount) : 1, frequency_type: addonForm.frequencyType, billing_cycle: addonForm.billingCycle, price: parseFloat(addonForm.price), description: addonForm.description || '' }) });
      const result = await res.json();
      if (res.ok || result.success) { showToast('Add-on created!'); setAddonForm({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' }); setAddonSelectedPropertyType(null); loadData(); setAddonActiveTab('all-addons'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create add-on', 'error'); }
  };
  const handleDeleteAddon = async (id) => { if (!window.confirm('Delete this add-on?')) return; try { const res = await fetch(`/api/fp/addons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };

  const openEditAddon = (addon) => {
    setEditingAddon({
      id: addon.id,
      serviceName: decodeHtml(addon.service_name) || '',
      frequencyType: addon.frequency_type || 'Monthly',
      frequencyCount: addon.frequency_count ?? 1,
      propertyType: addon.property_type || 'GC',
      price: addon.price || '',
      description: decodeHtml(addon.description) || ''
    });
  };

  const handleUpdateAddon = async () => {
    if (!editingAddon) return;
    try {
      const res = await fetch(`/api/fp/addons/${editingAddon.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: editingAddon.serviceName,
          frequency_type: editingAddon.frequencyType,
          frequency_count: editingAddon.frequencyCount,
          property_type: editingAddon.propertyType,
          price: parseFloat(editingAddon.price) || 0,
          description: editingAddon.description
        })
      });
      const result = await res.json();
      if (res.ok || result.success) {
        showToast('Add-on updated!');
        setEditingAddon(null);
        loadData();
      } else {
        showToast(result.message || 'Failed to update', 'error');
      }
    } catch (e) {
      showToast('Failed to update add-on', 'error');
    }
  };

  const renderAddons = () => (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {!isFPManager && (
          <button onClick={() => setAddonActiveTab('create')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${addonActiveTab === 'create' ? 'bg-white border-gray-300 text-gray-800 shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Plus className="w-4 h-4" />Create Add-on
          </button>
        )}
        <button onClick={() => setAddonActiveTab('all-addons')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${addonActiveTab === 'all-addons' ? 'bg-white border-gray-300 text-gray-800 shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Layers className="w-4 h-4" />All Add-ons
          {addons.length > 0 && <span className="px-1.5 py-0.5 bg-gray-700 text-white rounded-full text-xs">{addons.length}</span>}
        </button>
      </div>

      {addonActiveTab === 'create' && (
        <div className="space-y-6">
          {/* Select Property Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Select Property Type</h3>
            <p className="text-sm text-gray-500 mb-4">Choose the property type this package will be configured for</p>
            <div className="flex gap-3">
              {PROPERTY_TYPE_OPTIONS.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setAddonSelectedPropertyType(t.id)} 
                  className={`px-6 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    addonSelectedPropertyType === t.id 
                      ? 'border-gray-400 bg-gray-100 text-gray-800' 
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Create Add-on Form */}
          {addonSelectedPropertyType && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Create Add-on</h3>
              <p className="text-sm text-gray-500 mb-6">For: <span className="font-medium text-indigo-600">{PROPERTY_TYPE_OPTIONS.find(t => t.id === addonSelectedPropertyType)?.label}</span></p>
              
              {/* Form Row - SERVICE | DESCRIPTION | FREQUENCY | VISITS | PRICE | SAVE */}
              <div className="flex items-end gap-3">
                <div className="w-44">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Service</label>
                  <input 
                    type="text" 
                    value={addonForm.serviceName} 
                    onChange={(e) => setAddonForm({ ...addonForm, serviceName: e.target.value })} 
                    placeholder="Service name" 
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400" 
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Description</label>
                  <input 
                    type="text" 
                    value={addonForm.description} 
                    onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} 
                    placeholder="Add-on description..." 
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400" 
                  />
                </div>
                <div className="w-32">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Frequency</label>
                  <div className="relative">
                    <select 
                      value={addonForm.frequencyType} 
                      onChange={(e) => { 
                        const v = e.target.value; 
                        const auto = FREQUENCY_COUNT_MAP[v]; 
                        setAddonForm({ ...addonForm, frequencyType: v, frequencyCount: auto !== null ? auto : '' }); 
                      }} 
                      className="w-full px-2 py-2.5 border border-gray-300 rounded-lg text-sm bg-white appearance-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400"
                    >
                      {FREQUENCY_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="w-16">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Visits</label>
                  <input 
                    type="number" 
                    value={addonForm.frequencyCount} 
                    readOnly={addonForm.frequencyType !== 'Other'}
                    onChange={(e) => setAddonForm({ ...addonForm, frequencyCount: e.target.value })}
                    className={`w-full px-2 py-2.5 border border-gray-300 rounded-lg text-sm text-center ${addonForm.frequencyType === 'Other' ? 'bg-white focus:ring-2 focus:ring-gray-100' : 'bg-gray-50 cursor-not-allowed'}`} 
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Price (₹)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input 
                      type="text" 
                      value={addonForm.price} 
                      onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value.replace(/[^0-9]/g, '') })} 
                      placeholder="0" 
                      className="w-full pl-6 pr-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400" 
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveAddon} 
                  className="px-5 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium whitespace-nowrap"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Add-ons List for Selected Property Type */}
          {addonSelectedPropertyType && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-1">Add-ons for {PROPERTY_TYPE_OPTIONS.find(t => t.id === addonSelectedPropertyType)?.label}</h3>
              <p className="text-sm text-gray-500 mb-4">{addons.filter(a => normalizePropertyType(a.property_type) === addonSelectedPropertyType).length} add-on(s) available</p>
              
              {addons.filter(a => normalizePropertyType(a.property_type) === addonSelectedPropertyType).length === 0 ? (
                <div className="py-8 text-center text-gray-400">No add-ons created yet for this property type</div>
              ) : (
                <div className="space-y-3">
                  {addons.filter(a => normalizePropertyType(a.property_type) === addonSelectedPropertyType).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <PlusCircle className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{a.service_name}</p>
                          <p className="text-sm text-gray-500">{a.frequency_type} - {a.frequency_count} visits</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase">Price</p>
                          <p className="font-bold text-gray-800">{formatCurrency(a.price)}</p>
                        </div>
                        {!isFPManager && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditAddon(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteAddon(a.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {addonActiveTab === 'all-addons' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">All Add-ons</h3>
                <p className="text-sm text-gray-500">{addons.length} add-on(s) available</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setAddonFilterPropertyType('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${addonFilterPropertyType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  All
                  {addons.length > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${addonFilterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{addons.length}</span>}
                </button>
                {PROPERTY_TYPE_OPTIONS.map(t => {
                  const count = addons.filter(a => normalizePropertyType(a.property_type) === t.id).length;
                  return (
                    <button key={t.id} onClick={() => setAddonFilterPropertyType(t.id)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${addonFilterPropertyType === t.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {t.label}
                      {count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${addonFilterPropertyType === t.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredAddons.length === 0 ? (
              <div className="py-16 text-center">
                <PlusCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No add-ons found</p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-gray-200">
                  <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Service</div>
                  <div className="col-span-3 text-xs font-semibold text-gray-600 uppercase">Description</div>
                  <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Frequency</div>
                  <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase">Visits</div>
                  <div className="col-span-2 text-xs font-semibold text-gray-600 uppercase">Property Type</div>
                  <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase text-right">Price</div>
                  <div className="col-span-1 text-xs font-semibold text-gray-600 uppercase text-center">Actions</div>
                </div>
                {/* Rows */}
                <div className="divide-y divide-gray-100">
                  {filteredAddons.map(a => (
                    <div key={a.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                      <div className="col-span-2">
                        <p className="font-medium text-gray-800 text-sm">{a.service_name || a.name || 'Unnamed'}</p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs text-gray-500 break-words">{a.description || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-600">{a.frequency_type || 'Monthly'}</p>
                      </div>
                      <div className="col-span-1">
                        <p className="text-sm text-gray-600">{a.frequency_count ?? 1}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{getPropertyTypeLabel(a.property_type) || 'GC'}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <p className="font-bold text-gray-800 text-sm">{formatCurrency(a.price)}</p>
                      </div>
                      <div className="col-span-1 flex justify-center gap-1">
                        {!isFPManager && (
                          <>
                            <button onClick={() => openEditAddon(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteAddon(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Add-on Modal */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Edit Add-on</h2>
              <button onClick={() => setEditingAddon(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Service Name and Description in one row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingAddon.serviceName}
                    onChange={(e) => setEditingAddon({ ...editingAddon, serviceName: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={editingAddon.description}
                    onChange={(e) => setEditingAddon({ ...editingAddon, description: e.target.value })}
                    placeholder="Add-on description..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  />
                </div>
              </div>
              
              {/* Frequency and Visits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <select
                    value={editingAddon.frequencyType}
                    onChange={(e) => {
                      const v = e.target.value;
                      const auto = FREQUENCY_COUNT_MAP[v];
                      setEditingAddon({ ...editingAddon, frequencyType: v, frequencyCount: auto !== null ? auto : '' });
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  >
                    {FREQUENCY_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No.of visits</label>
                  <input
                    type="number"
                    value={editingAddon.frequencyCount}
                    readOnly={editingAddon.frequencyType !== 'Other'}
                    onChange={(e) => setEditingAddon({ ...editingAddon, frequencyCount: e.target.value })}
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm ${editingAddon.frequencyType === 'Other' ? 'bg-white focus:ring-2 focus:ring-gray-200' : 'bg-gray-50 cursor-not-allowed'}`}
                  />
                </div>
              </div>
              
              {/* Property Type and Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Property Type <span className="text-red-500">*</span></label>
                  <select
                    value={editingAddon.propertyType}
                    onChange={(e) => setEditingAddon({ ...editingAddon, propertyType: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  >
                    {PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingAddon.price}
                    onChange={(e) => setEditingAddon({ ...editingAddon, price: e.target.value.replace(/[^0-9]/g, '') })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => setEditingAddon(null)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={handleUpdateAddon} className="px-5 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Handle estimate status change (FP only)
  const handleEstimateStatusChange = async (estimateId, newStatus) => {
    try {
      const res = await fetch(`/api/fp/estimates/${estimateId}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const result = await res.json();
      if (result.success) {
        showToast(`Status updated to ${newStatus}`);
        // Update local state immediately for responsive UI
        setEstimates(prev => prev.map(e => e.id === estimateId ? { ...e, status: newStatus } : e));
      } else {
        showToast(result.message || 'Failed to update status', 'error');
      }
    } catch (e) {
      console.error('Status update error:', e);
      showToast('Failed to update status', 'error');
    }
  };

  // Get status color for dropdown
  const getEstimateStatusColor = (status) => {
    const s = (status || 'draft').toLowerCase();
    switch (s) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // ARCHIVED
  const handleArchiveEstimate = async (id) => { try { const res = await fetch(`${API_BASE}/api/fp/estimates/${id}/archive`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate archived'); loadData(); } } catch (e) { showToast('Failed to archive', 'error'); } };
  
  // Multi-select handlers
  const handleSelectEstimate = (id) => {
    setSelectedEstimates(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedEstimates.length === filteredEstimates.length) {
      setSelectedEstimates([]);
    } else {
      setSelectedEstimates(filteredEstimates.map(e => e.id));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedEstimates.length === 0) {
      showToast('No estimates selected', 'error');
      return;
    }
    
    setArchivingSelected(true);
    try {
      const response = await fetch(`${API_BASE}/api/fp/estimates/bulk-archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedEstimates })
      });
      const result = await response.json();
      if (result.success) {
        showToast(`${result.archivedCount || selectedEstimates.length} estimate(s) archived`);
        setSelectedEstimates([]);
        loadData();
      } else {
        showToast(result.message || 'Failed to archive estimates', 'error');
      }
    } catch (error) {
      console.error('Bulk archive error:', error);
      showToast('Failed to archive estimates', 'error');
    } finally {
      setArchivingSelected(false);
    }
  };

  const handleRestoreEstimate = async (id) => { try { const res = await fetch(`${API_BASE}/api/fp/estimates/${id}/restore`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate restored'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleDeletePermanent = async (id) => { try { const res = await fetch(`${API_BASE}/api/fp/estimates/${id}/permanent`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted permanently'); setDeleteConfirm(null); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleDeleteAllArchived = async () => { try { const res = await fetch(`${API_BASE}/api/fp/estimates/archived/delete-all`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const result = await res.json(); if (result.success || res.status === 201) { showToast(`${result.deletedCount || archivedEstimates.length} archived deleted`); setShowDeleteAllConfirm(false); loadData(); } else { showToast(result.message || 'Failed', 'error'); } } catch (e) { showToast('Failed to delete all', 'error'); } };
  const handleDownloadPDF = (estimate) => { 
    try { 
      // Use the same export logic as handleExportPDF for consistency
      handleExportPDF(estimate);
    } catch (e) { 
      console.error('PDF download error:', e);
      showToast('PDF failed: ' + e.message, 'error'); 
    } 
  };

  const renderArchived = () => (
    <div className="space-y-4">
      {archivedEstimates.length > 0 && !isFPManager && <div className="flex justify-end"><div className="flex items-center gap-2 mr-auto"><label className="text-sm text-gray-600">Type:</label><select value={archivedTypeFilter} onChange={(e) => setArchivedTypeFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="all">All Types</option><option value="property">Property Based</option><option value="direct">Direct</option></select></div><button onClick={() => setShowDeleteAllConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"><Trash2 className="w-4 h-4" />Delete All ({archivedEstimates.length})</button></div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{archivedEstimates.length === 0 ? <div className="py-16 text-center"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Division</th><th className="px-4 py-3 text-left font-medium text-gray-600">Client</th><th className="px-4 py-3 text-left font-medium text-gray-600">Archived On</th><th className="px-4 py-3 text-left font-medium text-gray-600">Total</th><th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{archivedEstimates.filter(e => archivedTypeFilter === "all" ? true : archivedTypeFilter === "property" ? (e.estimate_type === "property_based" || e.property_id) : (e.estimate_type === "direct" && !e.property_id)).map(e => <tr key={e.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{e.estimate_id}</td><td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3 text-gray-600">{(e.estimate_type === 'property_based' || e.property_id) ? (e.division || '-') : '-'}</td><td className="px-4 py-3">{e.client_name}</td><td className="px-4 py-3 text-gray-500">{formatDateIST(e.archived_at)}</td><td className="px-4 py-3 font-semibold">{formatCurrency(e.total_amount)}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button onClick={() => handleDownloadPDF(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Download PDF"><Download className="w-4 h-4" /></button><button onClick={() => openViewEstimate(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye className="w-4 h-4" /></button><button onClick={() => handleRestoreEstimate(e.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"><RotateCcw className="w-4 h-4" /></button><button onClick={() => setDeleteConfirm(e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
      {deleteConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Permanently?</h3><p className="text-gray-600 mb-4">Are you sure you want to permanently delete estimate <strong>{deleteConfirm.estimate_id}</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button><button onClick={() => handleDeletePermanent(deleteConfirm.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button></div></div></div>}
      {showDeleteAllConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Delete All Archived?</h3><p className="text-gray-600 mb-4">Are you sure you want to permanently delete <strong>all {archivedEstimates.length} archived estimates</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setShowDeleteAllConfirm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button><button onClick={handleDeleteAllArchived} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete All</button></div></div></div>}
    </div>
  );

  const renderContent = () => {
    switch (defaultTab) {
      case 'create': return renderCreateEstimate();
      case 'list': return renderAllEstimates();
      case 'amc': return renderAmcPackages();
      case 'addons': return renderAddons();
      case 'archived': return renderArchived();
      default: return renderAllEstimates();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center"><FileText className="w-6 h-6 text-indigo-600" /></div>
              <div><h1 className="text-2xl font-bold text-gray-800">{TAB_TITLES[defaultTab] || 'Estimates'}</h1><p className="text-sm text-gray-500">Create and manage estimates, AMC packages, and add-ons</p></div>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={loadData} className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
                <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{filteredEstimates.length}</p><p className="text-xs text-gray-500">Active Estimates</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{filteredAmcPackages.length}</p><p className="text-xs text-gray-500">AMC Packages</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{filteredAddons.length}</p><p className="text-xs text-gray-500">Add-ons</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{archivedEstimates.length}</p><p className="text-xs text-gray-500">Archived</p></div>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">{renderContent()}</div>
      {toast && <div className="fixed bottom-6 right-6 z-50"><div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<span>{toast.message}</span><button onClick={() => setToast(null)} className="ml-2 p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button></div></div>}
      
      {/* View Estimate Modal */}
      {viewEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">Estimate Details</h3>
              <button onClick={closeViewEstimate} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div><p className="text-xs text-gray-500">Estimate ID</p><p className="font-medium text-sm">{viewEstimate.estimate_id}</p></div>
                <div><p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    viewEstimate.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    viewEstimate.status === 'sent' ? 'bg-blue-100 text-blue-700' : 
                    viewEstimate.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                  }`}>{viewEstimate.status || 'draft'}</span>
                </div>
                <div><p className="text-xs text-gray-500">Type</p><p className={`font-medium text-sm capitalize ${viewEstimate.estimate_type === 'work_order' ? 'text-orange-600' : ''}`}>{viewEstimate.estimate_type === 'work_order' ? 'Work Order' : viewEstimate.estimate_type?.replace('_', ' ')}</p></div>
                <div><p className="text-xs text-gray-500">Created</p><p className="font-medium text-sm">{formatDateIST(viewEstimate.created_at)}</p></div>
              </div>

              {/* Work Order Details - Only for Work Order Estimates */}
              {viewEstimate.estimate_type === 'work_order' && viewEstimate.work_order_id && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-orange-700 mb-3">Work Order Details</p>
                  <div className="bg-orange-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-gray-500">Work Order ID</p><p className="font-medium text-sm font-mono text-orange-700">{viewEstimate.work_order_id}</p></div>
                    <div><p className="text-xs text-gray-500">Category</p><p className="font-medium text-sm">{viewEstimate.work_order_category || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">Subcategory</p><p className="font-medium text-sm">{viewEstimate.work_order_subcategory || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">Priority</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        viewEstimate.work_order_priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        viewEstimate.work_order_priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        viewEstimate.work_order_priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{viewEstimate.work_order_priority?.toUpperCase() || 'N/A'}</span>
                    </div>
                    {viewEstimate.work_order_description && (
                      <div className="col-span-2"><p className="text-xs text-gray-500">Work Order Description</p><p className="font-medium text-sm">{viewEstimate.work_order_description}</p></div>
                    )}
                  </div>
                </div>
              )}

              {/* Property Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p>
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  {(viewEstimate.estimate_type === 'property_based' || viewEstimate.estimate_type === 'property-based') && viewEstimate.property_code && (
                    <div><p className="text-xs text-gray-500">Property ID</p><p className="font-medium text-sm">{viewEstimate.property_code}</p></div>
                  )}
                  <div><p className="text-xs text-gray-500">Property Name</p><p className="font-medium text-sm">{viewEstimate.property_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Type</p><p className="font-medium text-sm">{getPropertyTypeLabel(viewEstimate.property_type)}</p></div>
                  <div><p className="text-xs text-gray-500">Zone</p><p className="font-medium text-sm">{viewEstimate.zone || '-'}</p></div>
                  {(viewEstimate.estimate_type === 'property_based' || viewEstimate.property_id) && viewEstimate.division && (
                    <div><p className="text-xs text-gray-500">Division</p><p className="font-medium text-sm">{viewEstimate.division}</p></div>
                  )}
                  <div><p className="text-xs text-gray-500">City</p><p className="font-medium text-sm">{viewEstimate.city || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="font-medium text-sm">{viewEstimate.address || viewEstimate.property_address || '-'}</p></div>
                  {/* GC-specific: Number of Blocks, Block Names, Units per Block with Bedroom Counts */}
                  {['GC', 'gated_community', 'Gated Community'].includes(viewEstimate.property_type) && (
                    <>
                      <div><p className="text-xs text-gray-500">Number of Blocks</p><p className="font-medium text-sm">{viewEstimate.number_of_blocks || '-'}</p></div>
                      <div><p className="text-xs text-gray-500">Total Units</p><p className="font-medium text-sm">{viewEstimate.total_units || '-'}</p></div>
                      {(() => {
                        const blockNames = viewEstimate.block_names ? (typeof viewEstimate.block_names === 'string' ? JSON.parse(viewEstimate.block_names) : viewEstimate.block_names) : {};
                        const unitsPerBlock = viewEstimate.units_per_block ? (typeof viewEstimate.units_per_block === 'string' ? JSON.parse(viewEstimate.units_per_block) : viewEstimate.units_per_block) : {};
                        const blockUnitTypes = viewEstimate.block_unit_types ? (typeof viewEstimate.block_unit_types === 'string' ? JSON.parse(viewEstimate.block_unit_types) : viewEstimate.block_unit_types) : {};
                        const hasBlockData = Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0 || Object.keys(blockUnitTypes).length > 0;
                        if (!hasBlockData) return null;
                        const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };
                        const numBlocks = viewEstimate.number_of_blocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || Object.keys(blockUnitTypes).length || 1;
                        return (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-gray-500 mb-2">Block Details</p>
                            <div className="bg-blue-50 p-3 rounded-lg space-y-3">
                              {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                                const blockName = blockNames[blockNum] || `Block ${blockNum}`;
                                const blockUnits = unitsPerBlock[blockNum] || 0;
                                const unitTypes = blockUnitTypes[blockNum] || {};
                                const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                                return (
                                  <div key={blockNum} className="bg-white p-3 rounded border border-blue-100">
                                    <div className="flex justify-between items-center mb-2">
                                      <p className="text-sm text-blue-600 font-semibold">{blockName}</p>
                                      <p className="text-sm text-gray-700 font-medium">{blockUnits} units</p>
                                    </div>
                                    {hasUnitTypes && (
                                      <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-50">
                                        {Object.entries(unitTypes).filter(([, count]) => count > 0).map(([type, count]) => (
                                          <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                            {unitTypeLabels[type] || type}: {count}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {/* Apartment-specific: Block Details with Unit Type Breakdown - Same UI as GC */}
                  {['APT', 'apartment', 'Apartment'].includes(viewEstimate.property_type) && (
                    <>
                      {viewEstimate.block_number && <div><p className="text-xs text-gray-500">Block Number</p><p className="font-medium text-sm">{viewEstimate.block_number}</p></div>}
                      <div><p className="text-xs text-gray-500">Number of Units</p><p className="font-medium text-sm">{viewEstimate.total_units || viewEstimate.number_of_units || '-'}</p></div>
                      {(() => {
                        const blockUnitTypes = viewEstimate.block_unit_types ? (typeof viewEstimate.block_unit_types === 'string' ? JSON.parse(viewEstimate.block_unit_types) : viewEstimate.block_unit_types) : {};
                        const unitTypes = blockUnitTypes['apt'] || {};
                        const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                        if (!hasUnitTypes) return null;
                        const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };
                        const buildingName = viewEstimate.tower_name || viewEstimate.block_name || 'Building';
                        const totalUnits = viewEstimate.total_units || viewEstimate.number_of_units || 0;
                        return (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-gray-500 mb-2">Block Details</p>
                            <div className="bg-blue-50 p-3 rounded-lg space-y-3">
                              <div className="bg-white p-3 rounded border border-blue-100">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-sm text-blue-600 font-semibold">{buildingName}</p>
                                  <p className="text-sm text-gray-700 font-medium">{totalUnits} units</p>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-50">
                                  {Object.entries(unitTypes).filter(([, count]) => count > 0).map(([type, count]) => (
                                    <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                      {unitTypeLabels[type] || type}: {count}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {/* Villa-specific fields */}
                  {['VILLA', 'villa', 'Villa', 'VL'].includes(viewEstimate.property_type) && (
                    <div><p className="text-xs text-gray-500">Villa Number</p><p className="font-medium text-sm">{viewEstimate.villa_plot_number || viewEstimate.villa_number || '-'}</p></div>
                  )}
                  {/* Flat-specific fields */}
                  {['FLAT', 'flat', 'Flat', 'FL'].includes(viewEstimate.property_type) && (
                    <div><p className="text-xs text-gray-500">Flat Number</p><p className="font-medium text-sm">{viewEstimate.villa_plot_number || viewEstimate.flat_number || '-'}</p></div>
                  )}
                  {/* Plot-specific fields */}
                  {['PLOT', 'plot', 'Plot', 'PL'].includes(viewEstimate.property_type) && (
                    <div><p className="text-xs text-gray-500">Plot Number</p><p className="font-medium text-sm">{viewEstimate.villa_plot_number || viewEstimate.plot_number || '-'}</p></div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p>
                <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Contact Name</p><p className="font-medium text-sm">{viewEstimate.client_name || viewEstimate.customer_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Phone</p><p className="font-medium text-sm">{viewEstimate.client_phone || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium text-sm">{viewEstimate.client_email || '-'}</p></div>
                </div>
              </div>

              {/* Package */}
              {viewEstimate.package_name && (() => {
                // Try to get description from estimate, fallback to AMC package lookup
                // Try multiple matching strategies for package lookup
                let pkgFromList = amcPackages.find(p => p.id == viewEstimate.package_id);
                if (!pkgFromList) {
                  pkgFromList = amcPackages.find(p => p.name === viewEstimate.package_name);
                }
                if (!pkgFromList) {
                  // Try case-insensitive name match
                  pkgFromList = amcPackages.find(p => p.name?.toLowerCase() === viewEstimate.package_name?.toLowerCase());
                }
                console.log('[ViewEstimate] package_id:', viewEstimate.package_id, 'package_name:', viewEstimate.package_name, 
                  'found pkg:', pkgFromList?.id, pkgFromList?.name);
                
                const pkgDescription = viewEstimate.amc_package_description || pkgFromList?.description || '';
                // Get services from estimate or from package lookup
                // Backend returns as 'packageServices' (camelCase) or 'package_services' (snake_case)
                let pkgServices = [];
                const rawServices = viewEstimate.packageServices || viewEstimate.package_services;
                console.log('[ViewEstimate] rawServices from estimate:', rawServices ? 'exists' : 'null/empty');
                
                if (rawServices) {
                  try {
                    const parsed = typeof rawServices === 'string' ? JSON.parse(rawServices) : rawServices;
                    // Handle different data structures
                    if (Array.isArray(parsed)) {
                      pkgServices = parsed;
                    } else if (parsed?.serviceRows) {
                      pkgServices = parsed.serviceRows;
                    } else if (parsed?.services) {
                      pkgServices = parsed.services;
                    }
                    console.log('[ViewEstimate] Parsed services from estimate:', pkgServices.length);
                  } catch (e) { console.log('Error parsing package services:', e); }
                }
                // Fallback to AMC package lookup if no services found
                if (pkgServices.length === 0 && pkgFromList?.services) {
                  console.log('[ViewEstimate] Falling back to AMC package services lookup');
                  try {
                    const svc = typeof pkgFromList.services === 'string' ? JSON.parse(pkgFromList.services) : pkgFromList.services;
                    pkgServices = svc?.serviceRows || svc?.services || (Array.isArray(svc) ? svc : []);
                    console.log('[ViewEstimate] Found services from AMC package:', pkgServices.length);
                  } catch (e) { console.log('Error parsing pkg services from list:', e); }
                }
                
                console.log('[ViewEstimate] Final pkgServices count:', pkgServices.length);
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p>
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-indigo-600">{viewEstimate.billing_duration ? viewEstimate.billing_duration.charAt(0).toUpperCase() + viewEstimate.billing_duration.slice(1).replace('-', ' ') : 'Yearly'} Billing</p>
                        </div>
                        <p className="text-lg font-bold text-indigo-700">{formatCurrency(viewEstimate.package_price)}</p>
                      </div>
                      {pkgDescription && (
                        <p className="text-sm text-indigo-700 mt-2 pt-2 border-t border-indigo-100">{pkgDescription}</p>
                      )}
                    </div>
                    {/* Package Services - Horizontal Table */}
                    {pkgServices.length > 0 && (
                      <div className="mt-3">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-indigo-100 rounded-t-lg">
                          <div className="col-span-1 text-xs font-semibold text-indigo-700">#</div>
                          <div className="col-span-3 text-xs font-semibold text-indigo-700">Service</div>
                          <div className="col-span-4 text-xs font-semibold text-indigo-700">Description</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-center">Frequency</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-right">Visits</div>
                        </div>
                        {/* Rows */}
                        <div className="border border-indigo-100 rounded-b-lg divide-y divide-indigo-50">
                          {pkgServices.map((svc, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                              <div className="col-span-1">
                                <span className="w-5 h-5 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                              </div>
                              <div className="col-span-3">
                                <p className="font-medium text-gray-800 text-sm">{decodeHtml(svc.name || svc.service)}</p>
                              </div>
                              <div className="col-span-4 overflow-hidden">
                                <p className={`text-xs text-gray-500 break-all whitespace-normal text-center`}>{decodeHtml(svc.description)?.trim() || '-'}</p>
                              </div>
                              <div className="col-span-2 text-center">
                                <p className="text-sm text-indigo-600">{svc.frequencyType || svc.frequency_type || 'Monthly'}</p>
                              </div>
                              <div className="col-span-2 text-right">
                                <p className="text-sm text-indigo-700 font-semibold">{svc.frequency_count ?? svc.frequencyCount ?? 0}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Add-ons - Horizontal Table */}
              {(() => {
                // Parse addons from addons array or addons_data JSON
                let addonsList = viewEstimate.addons || [];
                if ((!addonsList || addonsList.length === 0) && viewEstimate.addons_data) {
                  try {
                    addonsList = typeof viewEstimate.addons_data === 'string' 
                      ? JSON.parse(viewEstimate.addons_data) 
                      : viewEstimate.addons_data;
                  } catch (e) { addonsList = []; }
                }
                if (!Array.isArray(addonsList) || addonsList.length === 0) return null;
                
                return (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add-on Services</p>
                  <div>
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-green-100 rounded-t-lg">
                      <div className="col-span-1 text-xs font-semibold text-green-700">#</div>
                      <div className="col-span-3 text-xs font-semibold text-green-700">Service</div>
                      <div className="col-span-4 text-xs font-semibold text-green-700">Description</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-center">Frequency</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-right">Visits</div>
                    </div>
                    {/* Rows */}
                    <div className="border border-green-100 divide-y divide-green-50">
                      {addonsList.map((addon, idx) => {
                        const addonName = decodeHtml(addon.name || addon.service_name) || '';
                        const estPropertyType = (viewEstimate.property_type || '').toUpperCase();
                        // Priority 1: Match by ID
                        let addonFromList = addons.find(a => a.id == addon.id || a.id == addon.addon_id);
                        // Priority 2: Match by name AND property_type
                        if (!addonFromList || !addonFromList.description) {
                          addonFromList = addons.find(a => 
                            (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                            (a.property_type || '').toUpperCase() === estPropertyType
                          ) || addonFromList;
                        }
                        const addonDescription = addon.description || addonFromList?.description || '';
                        const frequencyCount = addon.frequency_count ?? addon.frequencyCount ?? addonFromList?.frequency_count ?? 1;
                        const frequencyType = addon.frequency_type || addon.frequencyType || addonFromList?.frequency_type || 'Monthly';
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                            <div className="col-span-1">
                              <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-gray-800 text-sm">{addonName}</p>
                            </div>
                            <div className="col-span-4">
                              <p className="text-xs text-gray-500 break-all whitespace-normal">{addonDescription || '-'}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <p className="text-sm text-green-600">{frequencyType}</p>
                            </div>
                            <div className="col-span-2 text-right">
                              <p className="text-sm text-green-700 font-semibold">{frequencyCount}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Total Add-ons Price */}
                    <div className="flex justify-between items-center bg-green-100 p-3 rounded-b-lg">
                      <p className="font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">{formatCurrency(addonsList.reduce((sum, a) => sum + Number(a.price || a.totalPrice || a.calculatedPrice || 0), 0))}</p>
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* Price Summary */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Price Summary</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(viewEstimate.subtotal)}</span></div>
                  {viewEstimate.discount_amount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Discount ({viewEstimate.discount_percent || 0}%)</span><span>-{formatCurrency(viewEstimate.discount_amount)}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({viewEstimate.gst_percent || 0}%)</span><span>{formatCurrency(viewEstimate.gst_amount || 0)}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-indigo-600">{formatCurrency(viewEstimate.total_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Description / Notes - After Price Summary */}
              {viewEstimate.description && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Description / Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewEstimate.description}</p>
                </div>
              )}

              {/* Created By */}
              <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
                Created by: {viewEstimate.created_by_name || '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View AMC Package Modal */}
      {viewAmcPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={closeViewPackage}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-800">AMC Package Details</h3>
              <button onClick={closeViewPackage} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Package Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
                <h4 className="text-xl font-bold text-indigo-900">{viewAmcPackage.name}</h4>
                <p className="text-sm text-indigo-600 mt-1">{viewAmcPackage.package_code || `PKG-${viewAmcPackage.id}`}</p>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Property Type</p>
                  <p className="font-semibold text-gray-900">{getPropertyTypeLabel(viewAmcPackage.propertyType)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Billing</p>
                  <p className="font-semibold text-gray-900 capitalize">{viewAmcPackage.billingDuration?.replace('-', ' ') || 'Yearly'}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Total Price</p>
                  <p className="font-bold text-xl text-green-600">{formatCurrency(viewAmcPackage.price || viewAmcPackage.base_price)}</p>
                </div>
              </div>

              {/* Services Included */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Services Included</p>
                {viewAmcPackage.servicesData && viewAmcPackage.servicesData.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="col-span-1 text-xs font-semibold text-gray-600">#</div>
                      <div className="col-span-2 text-xs font-semibold text-gray-600">Service</div>
                      <div className="col-span-5 text-xs font-semibold text-gray-600 text-center">Description</div>
                      <div className="col-span-2 text-xs font-semibold text-gray-600 text-center">Frequency</div>
                      <div className="col-span-2 text-xs font-semibold text-gray-600 text-center">Visits</div>
                    </div>
                    {/* Service Rows */}
                    {viewAmcPackage.servicesData.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center px-4 py-4 bg-blue-50/50 border-b border-blue-100 last:border-b-0">
                        <div className="col-span-1">
                          <span className="w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                        </div>
                        <div className="col-span-2 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{decodeHtml(svc.name || svc.service) || 'Service'}</p>
                        </div>
                        <div className="col-span-5 min-w-0 overflow-hidden">
                          <p className="text-sm text-gray-600 text-center" style={{wordBreak: 'break-word', overflowWrap: 'anywhere'}}>
                            {decodeHtml(svc.description)?.trim() || '-'}
                          </p>
                        </div>
                        <div className="col-span-2 text-center min-w-0">
                          <p className="text-sm text-gray-700 truncate">{svc.frequency_type || svc.frequencyType || svc.frequency || 'Monthly'}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-sm font-medium text-gray-900">{svc.frequency_count ?? svc.frequencyCount ?? svc.visits ?? 0}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No services listed</p>
                )}
              </div>

              {/* Price Summary */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-4 text-center uppercase">Price Summary</h4>
                <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(viewAmcPackage.price || viewAmcPackage.base_price)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">GST ({viewAmcPackage.gst_percentage || 0}%):</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(((viewAmcPackage.price || viewAmcPackage.base_price) * (viewAmcPackage.gst_percentage || 0)) / 100)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="font-bold text-gray-800">TOTAL:</span>
                    <span className="font-bold text-xl text-green-600">{formatCurrency((viewAmcPackage.price || viewAmcPackage.base_price) + (((viewAmcPackage.price || viewAmcPackage.base_price) * (viewAmcPackage.gst_percentage || 0)) / 100))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Estimate Modal */}
      {editEstimate && editEstimateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div><h3 className="text-lg font-semibold text-gray-800">Edit Estimate</h3><p className="text-sm text-gray-500">{editEstimate.estimate_id} - {editEstimate.estimate_type === 'property_based' || editEstimate.estimate_type === 'property-based' ? 'Property Based' : 'Direct'}</p></div>
              <button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div><p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label><input type="text" value={editEstimateForm.client_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input type="text" value={editEstimateForm.client_phone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={editEstimateForm.client_email} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_email: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div></div></div>
              <div><p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{editEstimate.property_code && <div><label className="block text-xs font-medium text-gray-600 mb-1">Property ID</label><input type="text" value={editEstimate.property_code} readOnly disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" /></div>}<div><label className="block text-xs font-medium text-gray-600 mb-1">Property Name</label><input type="text" value={editEstimateForm.property_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, property_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Zone</label><input type="text" value={editEstimateForm.zone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, zone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">City</label><input type="text" value={editEstimateForm.city} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, city: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input type="text" value={editEstimateForm.address} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div></div></div>
              <div><p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p><select value={editEstimateForm.package_id || ''} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, package_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"><option value="">Select Package</option>{amcPackages.filter(p => normalizePropertyType(getPkgPropertyType(p)) === normalizePropertyType(editEstimate.property_type)).map(pkg => (<option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>))}</select></div>
              <div><p className="text-sm font-semibold text-gray-700 mb-3">Add-ons</p><div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">{addons.filter(a => normalizePropertyType(a.property_type) === normalizePropertyType(editEstimate.property_type)).map(addon => { const existing = (editEstimateForm.selectedAddons || []).find(item => item.id === addon.id); const qty = existing?.quantity || 0; return (<div key={addon.id} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded"><span className="text-sm text-gray-700 flex-1">{addon.service_name}</span><div className="flex items-center gap-2"><button type="button" onClick={() => { const current = editEstimateForm.selectedAddons || []; if (qty <= 1) { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.filter(item => item.id !== addon.id) }); } else { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.map(item => item.id === addon.id ? { ...item, quantity: item.quantity - 1 } : item) }); } }} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50" disabled={qty === 0}>-</button><span className="w-6 text-center text-sm font-medium">{qty}</span><button type="button" onClick={() => { const current = editEstimateForm.selectedAddons || []; if (qty === 0) { setEditEstimateForm({ ...editEstimateForm, selectedAddons: [...current, { id: addon.id, quantity: 1 }] }); } else { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.map(item => item.id === addon.id ? { ...item, quantity: item.quantity + 1 } : item) }); } }} className="w-7 h-7 flex items-center justify-center rounded-full border border-amber-500 text-amber-600 hover:bg-amber-50">+</button></div></div>); })}</div></div>
              <div><p className="text-sm font-semibold text-gray-700 mb-3">Pricing</p><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">Discount (%)</label><input type="number" min="0" max="100" value={editEstimateForm.discount_percent} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, discount_percent: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">GST (%)</label><input type="number" min="0" max="100" value={editEstimateForm.gst_percent} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, gst_percent: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div></div><div className="mt-4 bg-gray-50 p-4 rounded-lg space-y-2"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(calculateEditPricing().subtotal)}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span className="text-red-500">-{formatCurrency(calculateEditPricing().discountAmt)}</span></div><div className="flex justify-between text-sm"><span>GST</span><span>{formatCurrency(calculateEditPricing().gstAmt)}</span></div><div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span className="text-amber-600">{formatCurrency(calculateEditPricing().total)}</span></div></div></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><textarea value={editEstimateForm.description} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button><button onClick={handleUpdateEstimate} disabled={savingEstimate} className="px-6 py-2.5 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">{savingEstimate ? (<><RefreshCw className="w-4 h-4 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4" />Save</>)}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPEstimates;
