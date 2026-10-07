import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Plus, Search, X, Check, AlertCircle, Package, Archive,
  List, ChevronDown, ChevronLeft, ChevronRight, Building2, User, Trash2, Edit2, Eye, RotateCcw, Calendar,
  DollarSign, Layers, Filter, Download, Mail, Save, Edit, Send, Link2, RefreshCw,
  FolderOpen, ExternalLink, Link, CheckSquare, Square, ArrowLeft, ClipboardList, Loader2, Printer
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const API_BASE = import.meta.env.VITE_API_URL || '';
import {
  FREQUENCY_TYPES, FREQUENCY_COUNT_MAP, isCustomFrequency, frequencyOptionStyle,
  getEstimateContactPhone, getEstimateAddress, getEstimateCity, getEstimateZone,
  getEstimateUnits, formatAddonsForExport
} from '../utils/estimateStore';
import { getAuthToken } from '../utils/safeStorage';
import { exportEstimateToPDF, exportPackageToPDF, printEstimatePDF } from '../utils/pdfExport';
import { useEstimatePrint } from '../utils/useEstimatePrint';
import { getServiceDescription, hasCatalogServices } from '../utils/estimatePackageUtils';
import { TermsConditionsField, EstimateTermsSection } from '../components/estimates/EstimateTerms';
import { newEstimateTerms } from '../utils/estimateTerms';
import * as XLSX from 'xlsx';
import AutocompleteInput from '../components/common/AutocompleteInput';
import AddServicePage from '../components/estimates/AddServicePage';
import ServiceCatalogList from '../components/estimates/ServiceCatalogList';
import ServiceCatalogPicker from '../components/estimates/ServiceCatalogPicker';
import EstimateStructure from '../components/estimates/EstimateStructure';
import PackageServicePicker from '../components/estimates/PackageServicePicker';
import { CapacitySlabSelect } from '../components/estimates/CapacitySlabList';
import { applyPackageMarkup, hasMarkup, packageTotals, quotePackageRow, rowInput, unpricedRows } from '../utils/packageServicePricing';
import { applyRowPatches, duplicatePackageName, packageRowForSave, packageRowFromDialog, packageRowFromSaved, updatePackageRow } from '../utils/packageRows';
import { capitalizeFirst } from '../utils/text';
import { PRICING_METHODS, methodLabel } from '../components/estimates/AddServicePage';
import CustomServicesTable, { buildCustomService, customServicesTotal } from '../components/estimates/CustomServicesTable';
import EstimateDetailPanel from '../components/estimates/EstimateDetailPanel';
import EstimateDraftServicesTable from '../components/estimates/EstimateDraftServicesTable';
import CustomServiceDialog from '../components/estimates/CustomServiceDialog';
import EmptyState from '../components/common/EmptyState';
import { EstimateThemeProvider } from '../utils/estimateTheme';
import AMCPackageDetailView from '../components/estimates/AMCPackageDetailView';
import { shortDivision } from '../utils/fieldOptionsStore';
import EstimateStatCards from '../components/estimates/EstimateStatCards';

const FP_CATALOG_API = '/api/fp/service-catalog';

// Decode HTML entities (e.g., &#x2F; -> /, &amp;amp; -> &)
const decodeHtml = (html) => {
  if (html == null) return '';
  // Never hand a non-string to JSX: React throws #31 and the whole page goes blank
  if (typeof html !== 'string') return typeof html === 'number' || typeof html === 'boolean' ? String(html) : '';
  // Decode multiple times to handle double/triple encoding
  let decoded = html;
  const txt = document.createElement('textarea');
  for (let i = 0; i < 3; i++) {
    txt.innerHTML = decoded;
    const newDecoded = txt.value;
    if (newDecoded === decoded) break;
    decoded = newDecoded;
  }
  return decoded;
};

// Format status label for display
const getStatusLabel = (status) => {
  const labels = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',

    sent: 'Sent',
    archived: 'Archived'
  };
  return labels[status] || status?.charAt(0).toUpperCase() + status?.slice(1) || 'Draft';
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

// The package's service table sizes its own columns: twelve equal ones could not hold Method and
// Input separately without squeezing the service name.
// The description is not a column: it runs the full width of the row underneath, so there is room
// to read and type it.
const PACKAGE_ROW_GRID = 'grid-cols-[minmax(10rem,2fr)_6.5rem_9.5rem_9.5rem_4rem_6.5rem_4rem]';

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

// Every field and button on a filter or action row is this tall, so a row lines up whatever it holds
const CONTROL_H = 'h-[42px]';

const TAB_TITLES = {
  'create': 'Create Estimate', 'list': 'All Estimates', 'amc': 'AMC Packages', 'addons': 'Add Service', 'archived': 'Archived Estimates'
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
  const urlWorkOrderId = searchParams.get('workOrderId'); // For direct work order estimate creation
  
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

  // Which estimate is open full screen. The URL still carries it, so a link to an estimate opens
  // it as before -- it now leaves the list for the document rather than expanding the row.
  const expandedEstimateId = viewEstimateId ? Number(viewEstimateId) : null;

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
  const [showPropertySuggestions, setShowPropertySuggestions] = useState(false);
  const propertyIdFieldRef = useRef(null);
  useEffect(() => {
    const field = propertyIdFieldRef.current;
    if (!field) return;
    const resize = () => { field.style.height = 'auto'; field.style.height = `${field.scrollHeight + 2}px`; };
    resize();
    let width = field.clientWidth;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (field.clientWidth !== width) { width = field.clientWidth; resize(); }
    });
    observer?.observe(field);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [propertyIdInput, estimateType, defaultTab, loading]);
  // FP Manager defaults to 'all-packages' (no create access)
  // Both sections land on their list; creating is the highlighted action on the right
  const [amcActiveTab, setAmcActiveTab] = useState('all-packages');
  // A package can apply to several property types, so the same one is configured once
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState([]);
  const [amcForm, setAmcForm] = useState({ packageName: '', description: '', serviceRows: [], price: '', markupPercentage: '', billingDuration: 'monthly' });
  // Open while the configured services are being browsed; Add Row still adds a blank row to type into
  const [showPackageServicePicker, setShowPackageServicePicker] = useState(false);
  const [editingAmcPackage, setEditingAmcPackage] = useState(null);
  const [filterPropertyType, setFilterPropertyType] = useState('all');
  // FP Manager defaults to 'all-addons' (no create access)
  const [addonActiveTab, setAddonActiveTab] = useState('all-addons');
  // Bumped on every Add Service tab click so the tab always reopens the form
  const [catalogEntry, setCatalogEntry] = useState(0);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // Terms & Conditions: on by default for a new estimate, editable before saving
  const [includeTerms, setIncludeTerms] = useState(newEstimateTerms().includeTerms);
  const [termsConditions, setTermsConditions] = useState(newEstimateTerms().termsConditions);
  const [editEstimate, setEditEstimate] = useState(null);
  const [editEstimateForm, setEditEstimateForm] = useState(null);
  const [savingEstimate, setSavingEstimate] = useState(false);
  // Configured services picked from the service catalog, priced by the backend
  const [catalogAddons, setCatalogAddons] = useState([]);
  // How the estimate is put together: a pre-built AMC package, or services entered by hand
  const [estimateStructure, setEstimateStructure] = useState('package');
  const [customServices, setCustomServices] = useState([]);
  // { index, row }: the hand-entered service open in its dialog, index null while it is new
  const [customServiceDraft, setCustomServiceDraft] = useState(null);
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
  
  // The estimate in the URL no longer opens a modal; expandedEstimateId reads it directly and the
  // row expands, so there is nothing to synchronise here.
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

  // Fetch pending work orders for the estimate form (exclude work orders that already have estimates)
  const fetchCompletedWorkOrders = async () => {
    setLoadingCompletedWO(true);
    try {
      const res = await fetch(`${API_BASE}/api/fp/work-orders?status=pending&excludeWithEstimates=true`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setCompletedWorkOrders(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) { console.error('Error fetching pending work orders:', e); }
    finally { setLoadingCompletedWO(false); }
  };

  // Handle workOrderId URL parameter - auto-fetch and show review form
  useEffect(() => {
    if (urlWorkOrderId && defaultTab === 'create') {
      // Set estimate type to work_order and fetch the work order details
      setEstimateType('work_order');
      setWorkOrderLoading(true);
      setWorkOrderError('');
      
      const fetchWorkOrderFromUrl = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/fp/work-orders/by-order-id/${encodeURIComponent(urlWorkOrderId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await response.json();
          if (result.success && result.data) {
            setWorkOrderData(result.data);
            setWorkOrderStep('review');
            // Clear the URL param after loading
            setSearchParams(prev => {
              const newParams = new URLSearchParams(prev);
              newParams.delete('workOrderId');
              return newParams;
            }, { replace: true });
          } else {
            setWorkOrderError(result.message || 'Failed to load work order details.');
            setWorkOrderStep('input');
            fetchCompletedWorkOrders();
          }
        } catch (error) {
          setWorkOrderError('Failed to fetch work order. Please try again.');
          setWorkOrderStep('input');
          fetchCompletedWorkOrders();
        } finally {
          setWorkOrderLoading(false);
        }
      };
      
      fetchWorkOrderFromUrl();
    }
  }, [urlWorkOrderId, defaultTab, token, setSearchParams]);

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
      const res = await fetch(`${API_BASE}/api/fp/portal-links/${form.id}`, {
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
  
  // Zone and City options for autocomplete
  const [zoneOptions, setZoneOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);

  // Fetch zones and cities for autocomplete
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [zonesRes, citiesRes] = await Promise.all([
          fetch(`${API_BASE}/api/onboarding/suggestions/zones`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/onboarding/suggestions/cities`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const zonesData = await zonesRes.json();
        const citiesData = await citiesRes.json();
        setZoneOptions(zonesData.success ? (zonesData.data || []).map(z => z.name || z) : []);
        setCityOptions(citiesData.success ? (citiesData.data || []).map(c => c.name || c) : []);
      } catch (error) {
        console.error('Error loading zones/cities:', error);
      }
    };
    if (token) fetchOptions();
  }, [token]);

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

  // Property type the create form prices configured services against
  const createPropertyType = normalizePropertyType(selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm.propertyType || '');
  // Configured-service prices depend on the property type, so never carry them across a change
  useEffect(() => { setCatalogAddons([]); }, [createPropertyType, estimateType]);
  const catalogAddonsTotal = catalogAddons.reduce((sum, addon) => sum + (parseFloat(addon.totalPrice) || 0), 0);
  const removeCatalogAddon = (addonId) => setCatalogAddons(prev => prev.filter(addon => addon.addonId !== addonId));
  // The row being re-priced, or null. Editing reopens the picker's dialog on it.
  const [editingCatalogAddon, setEditingCatalogAddon] = useState(null);
  // Adding and editing both come back through here: the rebuilt row keeps its addonId, so an edit
  // replaces the row in place instead of appending a second copy of the same service.
  const upsertCatalogAddon = (addon) => setCatalogAddons(prev => prev.some(item => item.addonId === addon.addonId)
    ? prev.map(item => item.addonId === addon.addonId ? addon : item)
    : [...prev, addon]);

  const renderCatalogPicker = ({ inline = false, variant = 'panel', extraItems = [] } = {}) => (
    <ServiceCatalogPicker
      key={`${estimateType}-${createPropertyType}`}
      apiPath={FP_CATALOG_API}
      propertyType={createPropertyType}
      selectedAddons={catalogAddons}
      onAdd={upsertCatalogAddon}
      editing={editingCatalogAddon}
      onEditClose={() => setEditingCatalogAddon(null)}
      inline={inline}
      variant={variant}
      extraItems={extraItems}
      theme="warm"
    />
  );
  // Shared by both service tables so the row actions cannot drift apart
  const catalogRowActions = (addon) => (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => setEditingCatalogAddon(addon)} title={`Edit ${addon.name}`} aria-label={`Edit ${addon.name}`}
        className="rounded-[10px] p-1.5 text-warm-muted transition-colors hover:bg-warm-accent-soft hover:text-warm-accent-hover"><Edit className="w-4 h-4" /></button>
      <button type="button" onClick={() => removeCatalogAddon(addon.addonId)} title={`Remove ${addon.name}`} aria-label={`Remove ${addon.name}`}
        className="rounded-[10px] p-1.5 text-warm-muted transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
    </div>
  );

  // Switching structure drops what belongs to the other choice, so neither a package price nor a
  // hand-entered row can sit hidden in the total.
  // Switching structure starts the other choice clean. Anything already added belongs to the
  // choice being left -- a package, hand-entered rows, or services picked alongside either -- and
  // carrying it across would put services on the estimate the user never chose in this mode.
  const changeEstimateStructure = (value) => {
    setEstimateStructure(value);
    setCustomServices([]);
    setCatalogAddons([]);
    setEditingCatalogAddon(null);
    setEstimateForm(prev => ({ ...prev, selectedAddons: [], ...(value === 'custom' ? { selectedPackage: '' } : {}) }));
  };
  // The package dropdown each form already had, shown on the structure row when a package applies.
  // In package mode the configured-service dropdown joins it there, so both ways of putting a service
  // on the estimate are chosen in one place. Custom mode leaves the picker where it was, below.
  const renderStructure = (packageSelect) => (
    <EstimateStructure value={estimateStructure} onChange={changeEstimateStructure} theme="warm">
      {estimateStructure === 'package' ? (
        <div className="flex min-w-0 w-full flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">{packageSelect}</div>
          <div className="min-w-0 flex-1">{renderCatalogPicker({ inline: true })}</div>
        </div>
      ) : null}
    </EstimateStructure>
  );
  // The hosting card already reads "Custom Services", so the table carries no heading of its own.
  // Its Add Service button is the catalog menu, with Custom listed above the configured services:
  // one control for both, instead of the picker repeated in a panel underneath.
  //
  // Custom opens its own dialog rather than dropping a blank row in the table: a hand-entered
  // service carries a category, a quantity and a vendor answer as well as its name, schedule and
  // price, and OK adds all of it as one row. Editing a row reopens the same dialog.
  const renderCustomServices = () => estimateStructure === 'custom'
    ? <CustomServicesTable rows={customServices} onChange={setCustomServices} title={null} theme="warm"
        extraRows={catalogAddons} renderExtraActions={catalogRowActions}
        onEditRow={(row, index) => setCustomServiceDraft({ index, row })}
        addControl={renderCatalogPicker({ variant: 'menu', extraItems: [
          { key: 'custom', label: 'Custom', onSelect: () => setCustomServiceDraft({ index: null, row: null }) }
        ] })} />
    : null;
  // Open while a hand-entered service is being filled in: `index` is null for a new row
  const renderCustomServiceDialog = () => (
    <CustomServiceDialog
      open={!!customServiceDraft}
      editing={customServiceDraft?.row || null}
      apiPath={FP_CATALOG_API}
      theme="warm"
      internal
      onClose={() => setCustomServiceDraft(null)}
      onSubmit={values => {
        const draft = customServiceDraft;
        setCustomServices(prev => draft?.index == null
          ? [...prev, buildCustomService(values)]
          : prev.map((row, index) => index === draft.index ? buildCustomService(values, row.addonId) : row));
        setCustomServiceDraft(null);
      }} />
  );
  // In custom mode every service is listed in the Custom Services table above, so the package-side
  // tables must not repeat the catalog rows underneath it.
  const tableCatalogAddons = estimateStructure === 'custom' ? [] : catalogAddons;
  const tableCatalogAddonsTotal = tableCatalogAddons.reduce((sum, addon) => sum + (parseFloat(addon.totalPrice) || 0), 0);

  // Helper to match property type for filtering
  const matchPropertyType = (value, filterId) => {
    if (!value || !filterId) return false;
    const normalizedValue = normalizePropertyType(value);
    return normalizedValue === filterId;
  };

  // Export FP estimate to PDF with properly formatted data
  // Resolve a stored estimate to the PDF's data -- the download and the document print share it
  const buildEstimatePdfData = (estimate) => {
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
    
    console.log('PDF Export - Estimate:', estimate.estimate_id, 'Package Services:', packageServices, 'Services:', addonsArray);
    
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
      billingDuration: estimate.billing_duration || 'Yearly',
      subtotal: parseFloat(estimate.subtotal) || 0,
      totalPrice: parseFloat(estimate.total_amount) || 0,
      discountPercent: parseFloat(estimate.discount_percent) || 0,
      discountAmount: parseFloat(estimate.discount_amount) || 0,
      gstPercent: parseFloat(estimate.gst_percent) || 0,
      gstAmount: parseFloat(estimate.gst_amount) || 0,
      description: estimate.description || '',
      // Terms & Conditions, printed only when the estimate carries them
      includeTerms: estimate.includeTerms ?? estimate.include_terms,
      termsConditions: estimate.termsConditions ?? estimate.terms_conditions,
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
          ...a,
          name: addonName || 'Service',
          frequencyType: a.frequency_type || a.frequencyType || addonFromList?.frequency_type || 'One-time',
          frequencyCount: a.frequency_count ?? a.frequencyCount ?? addonFromList?.frequency_count ?? 0,
          description: getServiceDescription(a) || addonFromList?.description || ''
        };
      })
    };
    
    console.log('PDF Data:', pdfData);
    return pdfData;
  };

  const handleExportPDF = (estimate) => exportEstimateToPDF(buildEstimatePdfData(estimate));

  // Print the generated PDF itself -- a browser print of the page stamps the tab title and URL
  // on every sheet, while the PDF viewer prints the document alone
  const handlePrintEstimate = (estimate) => printEstimatePDF(buildEstimatePdfData(estimate));

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
    if (hasCatalogServices(estimate)) { showToast('Saved services are read-only in this editor. Create a new estimate to change them.', 'error'); return; }
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

  // A package can apply to several property types; older ones carry a single value
  const getPkgPropertyTypes = (pkg) => {
    let svc = pkg.services;
    if (typeof svc === 'string') { try { svc = JSON.parse(svc); } catch(e) { svc = null; } }
    const list = svc?.property_types || pkg.property_types || pkg.propertyTypes;
    if (Array.isArray(list) && list.length) return [...new Set(list.map(normalizePropertyType).filter(Boolean))];
    const single = normalizePropertyType(svc?.property_type || pkg.property_type || '');
    return single ? [single] : [];
  };
  const getPkgPropertyType = (pkg) => getPkgPropertyTypes(pkg)[0] || '';
  const pkgMatchesPropertyType = (pkg, type) => {
    const wanted = normalizePropertyType(type);
    return Boolean(wanted) && getPkgPropertyTypes(pkg).includes(wanted);
  };

  // Back navigation handler for estimate subsections
  const handleBackFromEstimate = useCallback(() => {
    setCatalogAddons([]);
    setCustomServices([]);
    setEstimateStructure('package');
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
    const subtotal = pkgPrice + addonsPrice + catalogAddonsTotal + customServicesTotal(customServices);
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
    
    const abort = (message) => { showToast(message, 'error'); setSavingEstimate(false); };
    if (!clientName?.trim()) return abort('Customer name is required');
    if (!clientPhone?.trim()) return abort('Phone number is required');
    // A package estimate needs its package; a custom one needs at least one service instead
    if (estimateStructure === 'package' && !estimateForm.selectedPackage) return abort('Please select an AMC package');
    if (estimateStructure === 'custom' && !customServices.length && !catalogAddons.length && !estimateForm.selectedAddons.length) return abort('Add at least one service');

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
        // Villa, Flat and Plot all identify the unit through this one column, so whichever the
        // property type asked for is what travels -- a flat or plot number was dropped before
        villa_plot_number: estimateForm.villaNumber || estimateForm.flatNumber || estimateForm.plotNumber || selectedProperty?.villa_plot_number || '',
        // Package and pricing
        package_id: estimateForm.selectedPackage || null,
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
        addons: [
          ...selectedAddonsList.map(a => ({ 
            id: a.id, 
            name: a.service_name, 
            price: a.price, 
            frequency_count: a.frequency_count, 
            frequency_type: a.frequency_type,
            description: a.description || ''
          })),
          // Configured services; the backend re-prices these from the catalog before saving
          ...catalogAddons.map(a => ({
            addonId: a.addonId,
            catalogServiceId: a.catalogServiceId,
            pricingInputs: a.pricingInputs,
            name: a.name,
            description: a.description || '',
            frequency_type: a.frequency_type,
            frequency_count: a.frequency_count,
            services: a.services,
            totalPrice: a.totalPrice,
            price: a.totalPrice
          })),
          // Services typed in by hand on a custom estimate; they carry their own customer price
          ...customServices
        ],
        subtotal: pricing.subtotal,
        discount_percent: estimateForm.discount,
        discount_amount: pricing.discountAmt,
        gst_percent: estimateForm.gst,
        gst_amount: pricing.gstAmt,
        total_amount: pricing.total,
        description: estimateForm.description || '',
        includeTerms,
        termsConditions
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
        setCatalogAddons([]);
        setCustomServices([]);
        setEstimateStructure('package');
        setEstimateForm({ customerName: '', phone: '', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', selectedPackage: '', selectedAddons: [], discount: '', gst: '', description: '', numberOfBlocks: '', unitsPerBlock: {}, totalUnits: 0 });
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
  // Everything from Estimate Structure down to Save, for both the property-based and the direct
  // estimate: one section, so a change made to one flow is made to the other. Only the property
  // or customer details above it differ between the two.
  const renderEstimateBody = () => (
    <>
      {/* Estimate Structure: package or hand-entered services */}
      {renderStructure(
        <div className="min-w-0 w-full">
          <label className="block text-xs font-medium text-warm-muted mb-1.5">Select AMC Package <span className="text-red-500">*</span></label>
          {/* Unchosen reads as a placeholder, not as a value */}
          <select
            value={estimateForm.selectedPackage}
            onChange={(e) => setEstimateForm({...estimateForm, selectedPackage: e.target.value, selectedAddons: []})}
            className={`w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm bg-white ${estimateForm.selectedPackage ? 'text-warm-text' : 'text-warm-muted'}`}
          >
            <option value="" className="text-warm-muted">Select a package</option>
            {(() => {
              const propertyType = selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm.propertyType;
              const searchType = normalizePropertyType(propertyType);
              const filteredPkgs = searchType ? amcPackages.filter(pkg => pkgMatchesPropertyType(pkg, searchType)) : [];
              if (!searchType) return <option disabled>{selectedProperty ? 'Select property first' : 'Select property type first'}</option>;
              if (searchType && filteredPkgs.length === 0) return <option disabled>No packages for {propertyType}</option>;
              return filteredPkgs.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>);
            })()}
          </select>
        </div>
      )}

      {/* Services: the package's own, plus anything added here */}
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
          <h2 className="text-base font-semibold text-warm-text">{estimateStructure === 'custom' ? 'Custom Services' : 'AMC Package'}</h2>
        </div>
        <div className="p-6 space-y-4">
          {renderCustomServices()}

          {/* Package Details Card */}
          {(() => {
            const pkg = getSelectedPackage();
            if (!pkg) return null;
            const services = pkg.parsedServices || [];
            let svcData = pkg.services;
            if (typeof svcData === 'string') { try { svcData = JSON.parse(svcData); } catch(e) { svcData = {}; } }
            const billingDuration = svcData?.billing_duration || pkg.billing_duration || 'monthly';
            return (
              <div className="border border-warm-border rounded-xl overflow-hidden bg-warm-section/60">
                <div className="px-5 py-3 flex items-center gap-3">
                  <Package className="w-5 h-5 text-warm-accent-hover" />
                  <span className="font-semibold text-warm-text">{decodeHtml(pkg.name)}</span>
                  <span className="px-2 py-0.5 bg-warm-text text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                </div>
                <table className="w-full text-sm bg-white">
                  <thead>
                    <tr className="border-y border-warm-border/70">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-warm-muted uppercase w-[22%]">Service</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-warm-muted uppercase w-[43%]">Description</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-warm-muted uppercase w-[20%]">Frequency</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-warm-muted uppercase w-[15%]">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-border/70">
                    {services.length > 0 ? services.map((svc, idx) => {
                      const freqType = svc.frequencyType || svc.frequency_type || 'Monthly';
                      const visits = svc.frequency_count ?? svc.frequencyCount ?? (FREQUENCY_COUNT_MAP?.[freqType] ?? 0);
                      return (
                        <tr key={idx} className="align-top">
                          <td className="px-3 py-2.5 text-warm-text font-medium">{decodeHtml(svc.service || svc.name) || '-'}</td>
                          <td className={`px-3 py-2.5 text-warm-muted text-xs break-words whitespace-normal text-center`}>{decodeHtml(svc.description)?.trim() || '-'}</td>
                          <td className="px-3 py-2.5 text-warm-muted">{freqType}</td>
                          <td className="px-3 py-2.5 text-center text-warm-muted">{visits}</td>
                        </tr>
                      );
                    }) : <tr><td colSpan={4} className="px-3 py-3 text-center text-warm-muted">No services in package</td></tr>}
                  </tbody>
                </table>
                <div className="px-5 py-3 bg-warm-accent-soft border-t border-warm-border/70">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-warm-text">Total Package Price</span>
                    <span className="text-lg font-bold text-warm-text">{formatCurrency(pkg.price)}</span>
                  </div>
                  <div className="text-xs text-warm-muted mt-1">Service Period: <span className="capitalize whitespace-nowrap">{billingDuration?.replace('-', ' ')}</span></div>
                </div>
              </div>
            );
          })()}

          {/* Package mode shows the picker on the Estimate Structure row; custom mode offers it
              from the Custom Services table's own Add Service menu */}

          {/* Services Table - Only show when services selected. The table stands on its own
              border: a labelled box around it would squeeze the columns into the scroller. */}
          {(estimateForm.selectedAddons.length > 0 || tableCatalogAddons.length > 0) && (
            <div>
              <p className="text-sm font-semibold text-warm-text mb-2">Services</p>
              {/* Vendor Cost, XLAND Cost and Margin % are not shown while an estimate is being
                  written; they are read in the estimate's view once it is saved. */}
                <EstimateDraftServicesTable
                  warm
                  decode={decodeHtml}
                  items={[
                    ...estimateForm.selectedAddons.map((id, idx) => ({
                      key: `addon-${idx}`,
                      row: addons.find(a => a.id == id || a.id === parseInt(id)) || {},
                      tag: 'Service',
                      onRemove: () => setEstimateForm({ ...estimateForm, selectedAddons: estimateForm.selectedAddons.filter((_, i) => i !== idx) }),
                    })),
                    ...tableCatalogAddons.map((addon) => ({
                      key: `catalog-${addon.addonId}`, row: addon, tag: 'Configured',
                      onEdit: () => setEditingCatalogAddon(addon), onRemove: () => removeCatalogAddon(addon.addonId),
                    })),
                  ]}
                  total={estimateForm.selectedAddons.reduce((sum, id) => sum + (parseFloat(addons.find(a => a.id == id)?.price) || 0), 0) + tableCatalogAddonsTotal}
                />
            </div>
          )}

        </div>
      </div>

      {/* Price Summary -- shown for a package and for custom services alike */}
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
          <h2 className="text-base font-semibold text-warm-text">Price Summary</h2>
        </div>
        <div className="p-6">
          {(() => {
            const pricing = calculatePricing();
            return (
              <div className="max-w-md ml-auto space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-warm-muted">Sub Total</span>
                  <span className="font-medium">{formatCurrency(pricing.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-warm-muted">Discount (%)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={estimateForm.discount} onChange={(e) => setEstimateForm({...estimateForm, discount: parseFloat(e.target.value) || 0})} className="h-9 w-20 px-2 border border-warm-border rounded-[8px] text-sm text-center focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" min="0" max="100" />
                    <span className="text-warm-muted">- {formatCurrency(pricing.discountAmt)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-warm-muted">GST (%)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={estimateForm.gst} onChange={(e) => setEstimateForm({...estimateForm, gst: e.target.value === '' ? '' : parseFloat(e.target.value)})} className="h-9 w-20 px-2 border border-warm-accent bg-warm-accent-soft rounded-[8px] text-sm text-center text-warm-text" placeholder="0" />
                    <span className="text-warm-muted">+ {formatCurrency(pricing.gstAmt)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-warm-text text-white px-4 py-3 rounded-[10px] mt-4">
                  <span className="font-medium">Total Amount</span>
                  <span className="text-lg font-bold">{formatCurrency(pricing.total)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Notes - Under Price Summary */}
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
          <h2 className="text-base font-semibold text-warm-text">Notes</h2>
        </div>
        <div className="p-6">
          <textarea 
            value={estimateForm.description} 
            onChange={(e) => setEstimateForm({...estimateForm, description: e.target.value})}
            placeholder="Add any additional notes for this estimate..."
            className="w-full px-3 py-2.5 border border-warm-border rounded-[10px] text-sm resize-y min-h-[100px]"
          />
        </div>
      </div>

      {/* Terms & Conditions - included by default, and the text travels with the estimate */}
      <TermsConditionsField theme="warm" include={includeTerms} onIncludeChange={setIncludeTerms}
        terms={termsConditions} onTermsChange={setTermsConditions} />

      {/* Footer Note */}
      <div className="text-xs text-warm-muted border-t border-warm-border pt-4">
        * Currency: INR (₹) | GST applied on total | Fields marked with * are mandatory
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={handleBackFromEstimate} className="px-6 py-2.5 bg-white border border-warm-border rounded-[10px] text-sm font-medium text-warm-muted hover:bg-warm-section transition-colors">Back</button>
        <button onClick={handleSaveEstimate} disabled={savingEstimate} className={`px-6 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${savingEstimate ? "bg-warm-border cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800"} text-white`}>{savingEstimate ? "Saving..." : "Save"}</button>
      </div>
    </>
  );

  const renderCreateEstimate = () => (
    <div className="space-y-6">
      {/* Back Arrow - Show when estimate type is selected */}
      {estimateType && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackFromEstimate}
            className="flex items-center gap-2 text-warm-muted hover:text-warm-text transition-colors group"
            title="Go back (Esc)"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <span className="text-warm-border">|</span>
          <h2 className="text-lg font-semibold text-warm-text">
            {estimateType === 'property-based' 
              ? (selectedProperty ? 'Property Estimate Form' : 'Select Property')
              : estimateType === 'work_order'
              ? (workOrderData ? 'Work Order Estimate Review' : 'Work Order Estimate')
              : 'Direct Estimate Form'}
          </h2>
        </div>
      )}

      {!estimateType && (
        <div className="bg-white rounded-xl border border-warm-border shadow-warm p-6">
          <h2 className="text-lg font-semibold text-warm-text mb-2">Select Estimate Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[
              { icon: Building2, title: 'Property-Based Estimate', description: 'Enter Property ID to auto-fill details', onClick: () => setEstimateType('property-based') },
              { icon: User, title: 'Direct-Based Estimate', description: 'Enter customer details manually', onClick: () => { setEstimateType('direct'); setSelectedProperty(null); setPropertyIdInput(''); } },
              { icon: ClipboardList, title: 'Work Order Estimate', description: 'Create estimate from existing Work Order', onClick: () => { setEstimateType('work_order'); setWorkOrderStep('input'); setWorkOrderData(null); setWorkOrderError(''); setWorkOrderIdInput(''); fetchCompletedWorkOrders(); } }
            ].map(({ icon: Icon, title, description, onClick }) => (
              <button key={title} onClick={onClick} className="group h-full p-6 bg-white border border-warm-border rounded-xl text-center transition-all hover:border-warm-accent hover:bg-warm-section hover:shadow-warm-hover">
                <span className="mx-auto mb-3 flex w-14 h-14 items-center justify-center rounded-full bg-warm-accent-soft transition-colors group-hover:bg-warm-accent/25">
                  <Icon className="w-7 h-7 text-warm-accent" strokeWidth={1.5} />
                </span>
                <p className="font-semibold text-warm-text group-hover:text-warm-accent-hover">{title}</p>
                <p className="text-sm text-warm-muted mt-1">{description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Property-Based Estimate Form - Two column layout */}
      {estimateType === 'property-based' && (() => {
        const propertyTypeRaw = selectedProperty?.property_type || selectedProperty?.entry_type || '';
        const customerName = selectedProperty?.contact_person || selectedProperty?.contact_name || selectedProperty?.customer_name || '';
        const applyProperty = (m) => {
          const totalUnits = computeTotalUnits(m);
          setSelectedProperty({ ...m, total_units: totalUnits, units: totalUnits });
        };
        const q = propertyIdInput.toLowerCase();
        const propertySuggestions = q
          ? properties.filter(p => p.property_id?.toLowerCase().includes(q) || (p.name || p.community_name || p.property_name || '').toLowerCase().includes(q)).slice(0, 8)
          : [];
        const selectedPkg = getSelectedPackage();
        const pkgServices = selectedPkg?.parsedServices || [];
        const pkgPrice = parseFloat(selectedPkg?.price) || 0;
        const selectedAddonRows = estimateForm.selectedAddons
          .map((id, idx) => ({ idx, addon: addons.find(a => a.id == id || a.id === parseInt(id)) }))
          .filter(r => r.addon);
        const addonsTotal = selectedAddonRows.reduce((sum, r) => sum + (parseFloat(r.addon.price) || 0), 0);
        const pricing = calculatePricing();
        let pkgSvcData = selectedPkg?.services;
        if (typeof pkgSvcData === 'string') { try { pkgSvcData = JSON.parse(pkgSvcData); } catch(e) { pkgSvcData = {}; } }
        const billingDuration = pkgSvcData?.billing_duration || selectedPkg?.billing_duration || (selectedPkg ? getPackageBillingDuration(selectedPkg) : '') || 'yearly';
        const readOnlyCls = 'min-h-[42px] w-full min-w-0 px-3 py-2 border border-warm-border rounded-[10px] text-sm leading-6 text-warm-text whitespace-pre-wrap [overflow-wrap:anywhere]';
        // A field with nothing in it yet stays blank: it is filled from the Property ID, and the
        // label above already says what it will hold, so an "Auto-filled" tag only added noise.
        const readOnlyValue = (value, white = false) => (
          <div className={`${readOnlyCls} ${white ? 'bg-white' : 'bg-warm-section'}`}>
            {value === '' || value == null ? '\u00a0' : String(value)}
          </div>
        );
        return (
        <div className="flex flex-col gap-6">
          {/* Main form */}
          <div className="min-w-0 space-y-4">
            {/* Property header - details auto-populate from Property ID. Same 24px padding as the
                cards below it, so every field in this column starts on one line */}
            <div className="bg-white rounded-xl border border-warm-border shadow-warm p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label htmlFor="estimate-property-id" className="block text-xs font-medium text-warm-muted mb-1.5">Property ID <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <textarea
                      id="estimate-property-id"
                      rows={1}
                      ref={propertyIdFieldRef}
                      value={propertyIdInput}
                      onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[\r\n]/g, '').trim();
                        setPropertyIdInput(v);
                        setShowPropertySuggestions(true);
                        const m = properties.find(p => p.property_id?.toLowerCase() === v.toLowerCase());
                        if (m) applyProperty(m); else setSelectedProperty(null);
                      }}
                      onFocus={() => setShowPropertySuggestions(true)}
                      onBlur={() => setTimeout(() => setShowPropertySuggestions(false), 200)}
                      placeholder="GC-DMMN-20260520"
                      className="block w-full min-h-[42px] resize-none overflow-hidden pl-3 pr-9 py-2 border border-warm-border rounded-[10px] focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent text-sm leading-6 [overflow-wrap:anywhere]"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted pointer-events-none" />
                    {showPropertySuggestions && !selectedProperty && propertySuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-warm-border rounded-[10px] shadow-lg max-h-56 overflow-y-auto">
                        {propertySuggestions.map(p => (
                          <button
                            key={p.id || p.property_id}
                            type="button"
                            onClick={() => { setPropertyIdInput(p.property_id); applyProperty(p); setShowPropertySuggestions(false); }}
                            className="w-full px-3 py-2 text-left hover:bg-warm-section flex items-center gap-3"
                          >
                            <Building2 className="w-4 h-4 text-warm-muted shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-warm-text [overflow-wrap:anywhere]">{p.property_id}</p>
                              <p className="text-xs text-warm-muted [overflow-wrap:anywhere]">{p.name || p.community_name || p.property_name || '-'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Property Name</label>
                  {readOnlyValue(selectedProperty?.name || selectedProperty?.community_name || selectedProperty?.property_name)}
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Property Type</label>
                  {readOnlyValue(propertyTypeRaw ? getPropertyTypeLabel(propertyTypeRaw) : '')}
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Customer</label>
                  {readOnlyValue(customerName)}
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Zone</label>
                  {readOnlyValue(selectedProperty?.zone_name || selectedProperty?.zoneName || selectedProperty?.zone)}
                </div>
              </div>
            </div>

            {/* Property Details - remaining auto-populated fields */}
            {selectedProperty && (
              <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
                <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
                  <h3 className="text-sm font-semibold text-warm-text">Property Details</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-warm-muted mb-1.5">Contact Phone</label>
                      {readOnlyValue(selectedProperty.contact_phone || selectedProperty.phone)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-warm-muted mb-1.5">Contact Email</label>
                      {readOnlyValue(selectedProperty.contact_email || selectedProperty.email)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-warm-muted mb-1.5">Area</label>
                      {readOnlyValue(selectedProperty.area || selectedProperty.area_name)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-warm-muted mb-1.5">City</label>
                      {readOnlyValue(selectedProperty.city)}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-warm-muted mb-1.5">Units</label>
                      {readOnlyValue(selectedProperty.units ?? selectedProperty.total_units ?? 1)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Address</label>
                    {readOnlyValue(selectedProperty.address)}
                  </div>

                  {/* Unit Details - Property Type Specific */}
                  <div className="bg-warm-section rounded-[10px] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-warm-muted" />
                      <span className="text-sm font-medium text-warm-text">Unit Details</span>
                      <span className="text-xs px-2 py-0.5 bg-warm-accent-soft text-warm-text border border-warm-border rounded">{selectedProperty.property_type?.toUpperCase() || 'GC'}</span>
                    </div>
                    {(() => {
                      const propType = (selectedProperty.property_type || '').toUpperCase();
                      
                      // FLAT - Show Flat Number
                      if (propType === 'FLAT' || propType === 'FL' || propType === 'FLATS') {
                        return (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-warm-muted mb-1.5">Flat Number</label>
                              {readOnlyValue(selectedProperty.flat_number || selectedProperty.villa_plot_number || selectedProperty.unit_number || '-', true)}
                            </div>
                          </div>
                        );
                      }
                      
                      // VILLA - Show Villa Number
                      if (propType === 'VILLA' || propType === 'VL' || propType === 'VILLAS') {
                        return (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-warm-muted mb-1.5">Villa Number</label>
                              {readOnlyValue(selectedProperty.villa_number || selectedProperty.villa_plot_number || selectedProperty.unit_number || '-', true)}
                            </div>
                          </div>
                        );
                      }
                      
                      // PLOT - Show Plot Number
                      if (propType === 'PLOT' || propType === 'PL' || propType === 'PLOTS') {
                        return (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-warm-muted mb-1.5">Plot Number</label>
                              {readOnlyValue(selectedProperty.plot_number || selectedProperty.villa_plot_number || selectedProperty.unit_number || '-', true)}
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
                                <div key={blockNum} className="bg-white border border-warm-border rounded-[10px] p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 pr-2">
                                      <label className="block text-xs font-medium text-warm-muted mb-1.5">Block Name</label>
                                      <p className="text-sm font-semibold text-warm-text [overflow-wrap:anywhere]">{blockNames?.[blockNum] || blockNames?.[String(blockNum)] || `Block ${blockNum}`}</p>
                                    </div>
                                    <div className="text-right">
                                      <label className="block text-xs font-medium text-warm-muted mb-1.5">Units</label>
                                      <p className="text-sm font-medium text-warm-text">{unitsPerBlock?.[blockNum] || unitsPerBlock?.[String(blockNum)] || 0}</p>
                                    </div>
                                  </div>
                                  {hasUnitTypes && (
                                    <div className="flex flex-wrap gap-1 pt-2 border-t border-warm-border/70">
                                      {Object.entries(unitTypes).filter(([, count]) => count > 0).map(([type, count]) => (
                                        <span key={type} className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">
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
                              <div className="min-w-0">
                                <label className="block text-xs font-medium text-warm-muted mb-1.5">Block Name</label>
                                {readOnlyValue(selectedProperty.block_name || selectedProperty.block_info || blockNames?.[1] || blockNames?.['1'] || 'A', true)}
                              </div>
                              <div className="min-w-0">
                                <label className="block text-xs font-medium text-warm-muted mb-1.5">Number of Units</label>
                                {readOnlyValue(`${selectedProperty.units ?? selectedProperty.total_units ?? unitsPerBlock?.[1] ?? 1} Units`, true)}
                              </div>
                            </div>
                            {isAPT && (
                              <div className="flex flex-wrap gap-2 p-3 bg-white border border-warm-border rounded-[10px]">
                                <span className="text-xs font-medium text-warm-muted mr-2">Unit Types:</span>
                                <span className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">Studio: {unitTypes.studio || 0}</span>
                                <span className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">1 BHK: {unitTypes.oneBed || 0}</span>
                                <span className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">2 BHK: {unitTypes.twoBed || 0}</span>
                                <span className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">3 BHK: {unitTypes.threeBed || 0}</span>
                                <span className="px-2 py-0.5 bg-warm-accent-soft text-warm-text text-xs rounded-full border border-warm-border">4 BHK: {unitTypes.fourBed || 0}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}

          </div>

          {renderEstimateBody()}
        </div>
        );
      })()}

      {/* Direct-Based Estimate Form */}
      {estimateType === 'direct' && (
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
            <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
              <h2 className="text-base font-semibold text-warm-text">Customer Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter customer name" value={estimateForm.customerName} onChange={(e) => setEstimateForm({...estimateForm, customerName: e.target.value})} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Phone <span className="text-red-500">*</span></label>
                  <div className="flex w-full">
                    <select value={estimateForm.countryCode || '+91'} onChange={(e) => setEstimateForm({...estimateForm, countryCode: e.target.value})} className="shrink-0 px-2 py-2.5 border border-warm-border border-r-0 rounded-l-[10px] text-sm bg-warm-section">
                      <option value="+91">+91</option>
                    </select>
                    <input type="tel" placeholder="10-digit phone number" value={estimateForm.phone} maxLength={10} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setEstimateForm({...estimateForm, phone: val}); }} className="min-w-0 flex-1 px-3 py-2.5 border border-warm-border rounded-r-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Email</label>
                  <input type="email" placeholder="Enter email address" value={estimateForm.email} onChange={(e) => setEstimateForm({...estimateForm, email: e.target.value})} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                </div>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
            <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
              <h2 className="text-base font-semibold text-warm-text">Property Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Property Type <span className="text-red-500">*</span></label>
                  <select value={estimateForm.propertyType} onChange={(e) => setEstimateForm({...estimateForm, propertyType: e.target.value})} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20">
                    <option value="">Select Property Type</option>
                    {PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-warm-muted mb-1.5">Property Name</label>
                  <input type="text" placeholder="Enter property name" value={estimateForm.propertyName} onChange={(e) => setEstimateForm({...estimateForm, propertyName: e.target.value})} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                </div>
                <div>
                  <AutocompleteInput
                    label="Zone"
                    value={estimateForm.zone}
                    onChange={(val) => setEstimateForm({...estimateForm, zone: val})}
                    options={zoneOptions}
                    placeholder="Type or select zone..."
                    allowCustom={true}
                    showAllOnOpen={true}
                    inputClassName="text-sm"
                    theme="warm"
                  />
                </div>
                <div>
                  <AutocompleteInput
                    label="City"
                    value={estimateForm.city}
                    onChange={(val) => setEstimateForm({...estimateForm, city: val})}
                    options={cityOptions}
                    placeholder="Type or select city..."
                    allowCustom={true}
                    showAllOnOpen={true}
                    inputClassName="text-sm"
                    theme="warm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">Address</label>
                <input type="text" placeholder="Enter full address" value={estimateForm.address} onChange={(e) => setEstimateForm({...estimateForm, address: e.target.value})} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
              </div>
              
              {/* Blocks & Units - Only for GC - Dynamic blocks */}
              {estimateForm.propertyType === 'GC' && (
                <div className="mt-4 p-4 bg-warm-accent-soft rounded-[10px] border border-warm-border">
                  <h4 className="text-sm font-semibold text-warm-text mb-3">Block Details</h4>
                  <div className="mb-4 max-w-xs">
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Number of Blocks <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={estimateForm.numberOfBlocks} onChange={(e) => { setEstimateForm({...estimateForm, numberOfBlocks: e.target.value, unitsPerBlock: {}}); }} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: parseInt(estimateForm.numberOfBlocks, 10) || 0 }, (_, i) => i + 1).map(blockNum => (
                      <React.Fragment key={blockNum}>
                        <div>
                          <label className="block text-xs font-medium text-warm-muted mb-1.5">Block Name</label>
                          <input type="text" value={estimateForm.blockNames?.[blockNum] || ''} onChange={(e) => { const newBlockNames = {...(estimateForm.blockNames || {}), [blockNum]: e.target.value}; setEstimateForm({...estimateForm, blockNames: newBlockNames}); }} placeholder={`Block ${blockNum}`} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-warm-muted mb-1.5">Units <span className="text-red-500">*</span></label>
                          <input type="number" min="1" value={estimateForm.unitsPerBlock?.[blockNum] || ''} onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...(estimateForm.unitsPerBlock || {}), [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setEstimateForm({...estimateForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }} placeholder="No. of units" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  {(estimateForm.totalUnits > 0 || estimateForm.numberOfUnits > 0) && (<div className="mt-3 p-2 bg-warm-accent-soft rounded inline-block"><span className="text-sm text-warm-text font-medium">Total Units: {estimateForm.totalUnits || estimateForm.numberOfUnits}</span></div>)}
                </div>
              )}

              {/* Apartment */}
              {estimateForm.propertyType === 'APT' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-warm-accent-soft rounded-[10px] border border-warm-border">
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Tower/Building Name</label>
                    <input type="text" value={estimateForm.blockName || ''} onChange={(e) => setEstimateForm({...estimateForm, blockName: e.target.value})} placeholder="Tower/Building name" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Block Number</label>
                    <input type="text" value={estimateForm.blockNumber} onChange={(e) => setEstimateForm({...estimateForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Number of Units <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={estimateForm.numberOfUnits} onChange={(e) => setEstimateForm({...estimateForm, numberOfUnits: e.target.value})} placeholder="Total units" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                </div>
              )}

              {/* Villa */}
              {estimateForm.propertyType === 'VILLA' && (
                <div className="mt-4 p-4 bg-warm-accent-soft rounded-[10px] border border-warm-border">
                  <div className="max-w-xs">
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Villa Number <span className="text-red-500">*</span></label>
                    <input type="text" value={estimateForm.villaNumber} onChange={(e) => setEstimateForm({...estimateForm, villaNumber: e.target.value})} placeholder="Enter villa number" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                </div>
              )}

              {/* Flat */}
              {estimateForm.propertyType === 'FLAT' && (
                <div className="mt-4 p-4 bg-warm-accent-soft rounded-[10px] border border-warm-border">
                  <div className="max-w-xs">
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Flat Number <span className="text-red-500">*</span></label>
                    <input type="text" value={estimateForm.flatNumber} onChange={(e) => setEstimateForm({...estimateForm, flatNumber: e.target.value})} placeholder="Enter flat number" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                </div>
              )}

              {/* Plot */}
              {estimateForm.propertyType === 'PLOT' && (
                <div className="mt-4 p-4 bg-red-50 rounded-[10px] border border-red-200">
                  <div className="max-w-xs">
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Plot Number <span className="text-red-500">*</span></label>
                    <input type="text" value={estimateForm.plotNumber} onChange={(e) => setEstimateForm({...estimateForm, plotNumber: e.target.value})} placeholder="Enter plot number" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {renderEstimateBody()}
        </div>
      )}

      {/* Work Order Estimate Form */}
      {estimateType === 'work_order' && (
        <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
          {/* Completed Work Orders List */}
          {workOrderStep === 'input' && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-warm-accent-soft rounded-[10px]">
                  <ClipboardList className="w-5 h-5 text-warm-accent-hover" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-warm-text">Pending Work Orders</h3>
                  <p className="text-xs text-warm-muted">Select a work order to create an estimate</p>
                </div>
              </div>
              
              {workOrderError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[10px] flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{workOrderError}</p>
                </div>
              )}

              {loadingCompletedWO ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
                  <span className="ml-2 text-warm-muted">Loading work orders...</span>
                </div>
              ) : completedWorkOrders.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No pending work orders found" description="Create work orders first to generate estimates" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-warm-border bg-warm-section">
                        <th className="text-left py-3 px-3 font-medium text-warm-muted">Work Order ID</th>
                        <th className="text-left py-3 px-3 font-medium text-warm-muted">Customer</th>
                        <th className="text-left py-3 px-3 font-medium text-warm-muted">Category</th>
                        <th className="text-left py-3 px-3 font-medium text-warm-muted">Status</th>
                        <th className="text-left py-3 px-3 font-medium text-warm-muted">Created</th>
                        <th className="text-left py-3 px-3 font-medium text-warm-muted">Property</th>
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
                          className="border-b border-warm-border/70 hover:bg-warm-section cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3 font-medium text-warm-text">{wo.work_order_id}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-warm-text">{wo.customer_name || wo.client_name || '-'}</div>
                            <div className="text-xs text-warm-muted">{wo.property_name || wo.community_name || '-'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium">{wo.category_name || '-'}</div>
                            <div className="text-xs text-warm-muted">{wo.subcategory_name || '-'}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-warm-warning text-amber-700 border border-[#F3E2B3]">
                              {wo.status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-warm-muted">
                            {wo.created_at ? new Date(wo.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-warm-text">{wo.customer_name || wo.client_name || '-'}</div>
                            <div className="text-xs text-warm-muted">{wo.property_code || wo.property_id || '-'}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {workOrderLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center z-50 pt-20 overflow-y-auto">
                  <div className="bg-white p-6 rounded-[10px] shadow-xl flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-warm-accent" />
                    <span className="text-warm-text">Loading work order details...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Work Order Review & Pricing Step */}
          {workOrderStep === 'review' && workOrderData && (
            <div className="p-6 space-y-6">
              {/* Work Order Info */}
              <div className="p-4 bg-warm-section border border-warm-border rounded-[10px]">
                <h4 className="text-sm font-semibold text-warm-text mb-3 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Work Order Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div><span className="text-xs text-warm-muted block">Work Order ID</span><span className="font-medium text-warm-text">{workOrderData.work_order_id}</span></div>
                  <div><span className="text-xs text-warm-muted block">Category</span><span className="font-medium">{workOrderData.category_name || '-'}</span></div>
                  <div><span className="text-xs text-warm-muted block">Subcategory</span><span className="font-medium">{workOrderData.subcategory_name || '-'}</span></div>
                  <div><span className="text-xs text-warm-muted block">Priority</span><span className={`font-medium uppercase ${workOrderData.priority === 'high' ? 'text-red-600' : workOrderData.priority === 'medium' ? 'text-yellow-600' : 'text-emerald-600'}`}>{workOrderData.priority || '-'}</span></div>
                  <div><span className="text-xs text-warm-muted block">Created</span><span className="font-medium">{workOrderData.created_at ? new Date(workOrderData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span></div>
                </div>
                {workOrderData.description && (
                  <div className="mt-3 pt-3 border-t border-warm-border">
                    <span className="text-xs text-warm-muted block mb-1">Description</span>
                    <p className="text-sm text-warm-text">{workOrderData.description}</p>
                  </div>
                )}
              </div>

              {/* Property & Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-warm-accent-soft border border-warm-border rounded-[10px]">
                  <h4 className="text-sm font-semibold text-warm-text mb-3">Property Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-warm-muted">Property:</span> <span className="font-medium">{workOrderData.property_name || workOrderData.community_name || '-'}</span></div>
                    <div><span className="text-warm-muted">Property ID:</span> <span className="font-medium">{workOrderData.property_code || workOrderData.property_id || '-'}</span></div>
                    <div><span className="text-warm-muted">Type:</span> <span className="font-medium">{workOrderData.property_type || '-'}</span></div>
                    <div><span className="text-warm-muted">Zone / Division:</span> <span className="font-medium">{workOrderData.zone || '-'} / {workOrderData.division || '-'}</span></div>
                    <div><span className="text-warm-muted">Address:</span> <span className="font-medium">{workOrderData.address || '-'}</span></div>
                  </div>
                </div>
                <div className="p-4 bg-warm-success border border-[#CFEBDD] rounded-[10px]">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-3">Customer Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-warm-muted">Name:</span> <span className="font-medium">{workOrderData.client_name || workOrderData.customer_name || '-'}</span></div>
                    <div><span className="text-warm-muted">Email:</span> <span className="font-medium">{workOrderData.client_email || workOrderData.customer_email || '-'}</span></div>
                    <div><span className="text-warm-muted">Phone:</span> <span className="font-medium">{workOrderData.client_phone || workOrderData.customer_phone || '-'}</span></div>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 bg-warm-section border border-warm-border rounded-[10px]">
                <h4 className="text-sm font-semibold text-warm-text mb-4">Estimate Pricing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Amount (₹) <span className="text-red-500">*</span></label>
                    <input type="number" value={workOrderAmount} onChange={(e) => setWorkOrderAmount(e.target.value)} placeholder="Enter amount" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">Discount (%)</label>
                    <input type="number" value={workOrderDiscount} onChange={(e) => setWorkOrderDiscount(e.target.value)} placeholder="0" min="0" max="100" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-warm-muted mb-1.5">GST (%)</label>
                    <input type="number" value={workOrderGst} onChange={(e) => setWorkOrderGst(e.target.value)} placeholder="18" className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent" />
                  </div>
                </div>
                
                {/* Price Summary */}
                {workOrderAmount && parseFloat(workOrderAmount) > 0 && (
                  <div className="mt-4 pt-4 border-t border-warm-border">
                    <div className="flex justify-between text-sm mb-1"><span className="text-warm-muted">Subtotal</span><span>₹{parseFloat(workOrderAmount || 0).toLocaleString('en-IN')}</span></div>
                    {parseFloat(workOrderDiscount || 0) > 0 && <div className="flex justify-between text-sm mb-1 text-emerald-600"><span>Discount ({workOrderDiscount}%)</span><span>-₹{(parseFloat(workOrderAmount || 0) * parseFloat(workOrderDiscount || 0) / 100).toLocaleString('en-IN')}</span></div>}
                    {parseFloat(workOrderGst || 0) > 0 && <div className="flex justify-between text-sm mb-1 text-warm-muted"><span>GST ({workOrderGst}%)</span><span>+₹{((parseFloat(workOrderAmount || 0) - (parseFloat(workOrderAmount || 0) * parseFloat(workOrderDiscount || 0) / 100)) * parseFloat(workOrderGst || 0) / 100).toLocaleString('en-IN')}</span></div>}
                    <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-warm-accent/40"><span className="text-warm-accent-hover">Grand Total</span><span className="text-warm-text">₹{(() => { const amt = parseFloat(workOrderAmount || 0); const disc = amt * parseFloat(workOrderDiscount || 0) / 100; const afterDisc = amt - disc; const gst = afterDisc * parseFloat(workOrderGst || 0) / 100; return (afterDisc + gst).toLocaleString('en-IN'); })()}</span></div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">Notes (Optional)</label>
                <textarea value={workOrderNotes} onChange={(e) => setWorkOrderNotes(e.target.value)} rows={3} placeholder="Add any additional notes..." className="w-full px-3 py-2 border border-warm-border rounded-[10px] focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent" />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-warm-border">
                <button onClick={() => { setWorkOrderStep('input'); setWorkOrderData(null); }} className="px-6 py-2.5 bg-white border border-warm-border rounded-[10px] text-sm font-medium text-warm-muted hover:bg-warm-section transition-colors">Back</button>
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
                        // GC/APT specific fields
                        number_of_blocks: workOrderData.number_of_blocks || workOrderData.total_blocks || workOrderData.numberOfBlocks || null,
                        total_units: workOrderData.total_units || workOrderData.totalUnits || workOrderData.units || null,
                        units_per_block: workOrderData.units_per_block || workOrderData.unitsPerBlock || {},
                        block_names: workOrderData.block_names || workOrderData.blockNames || {},
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
                  className="px-6 py-2.5 bg-emerald-700 text-white rounded-[10px] text-sm font-medium hover:bg-emerald-800 disabled:bg-warm-border disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden mt-6">
        <div className="bg-warm-section px-6 py-4 border-b border-warm-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warm-accent-soft rounded-[10px]">
              <Link className="w-5 h-5 text-warm-accent-hover" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-warm-text">FP Portal Links</h2>
              <p className="text-xs text-warm-muted mt-0.5">Share up to 2 custom links with your employees (Google Drive, Sheets, Docs, or any URL)</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Link Block 1 */}
          <div className="border border-warm-border rounded-xl p-4 bg-warm-section/60 hover:bg-white transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-warm-accent-soft text-warm-accent-hover text-xs font-bold">1</span>
              <span className="text-sm font-medium text-warm-text">Link Block 1</span>
              {linkForms[1].id && !linkForms[1].isEditing && (
                <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700 bg-warm-success px-2 py-1 rounded-full">
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
                  className={`w-full px-4 py-2.5 border rounded-[10px] text-sm transition-colors ${
                    linkForms[1].id && !linkForms[1].isEditing 
                      ? 'bg-warm-page border-warm-border text-warm-text' 
                      : 'bg-white border-warm-border focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent'
                  }`}
                />
              </div>
              {linkForms[1].id && !linkForms[1].isEditing ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEditLink(1)} 
                    className="px-3 py-2 text-sm text-warm-accent-hover hover:bg-warm-accent-soft rounded-[10px] transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDeletePortalLink(1)} 
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-[10px] transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleSavePortalLink(1)} 
                  disabled={linkForms[1].isSaving}
                  className="px-4 py-2.5 bg-warm-accent-soft text-warm-text border border-warm-border rounded-[10px] text-sm font-medium hover:bg-warm-accent/30 disabled:bg-warm-section disabled:text-warm-muted transition-colors flex items-center gap-1.5"
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
                  className="px-3 py-2 text-sm text-warm-muted hover:bg-warm-section rounded-[10px] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* URL Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted" />
                <input
                  type="url"
                  value={linkForms[1].url}
                  onChange={(e) => handleLinkFormChange(1, 'url', e.target.value)}
                  placeholder="Paste any external URL (Google Drive, Sheets, etc.)"
                  disabled={linkForms[1].id && !linkForms[1].isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-[10px] text-sm transition-colors ${
                    linkForms[1].id && !linkForms[1].isEditing 
                      ? 'bg-warm-page border-warm-border text-warm-muted' 
                      : 'bg-white border-warm-border focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent'
                  }`}
                />
              </div>
              {linkForms[1].id && !linkForms[1].isEditing && linkForms[1].url && (
                <a 
                  href={linkForms[1].url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 text-sm text-warm-accent-hover hover:bg-warm-accent-soft rounded-[10px] transition-colors flex items-center gap-1.5 border border-warm-border"
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
          <div className="border border-warm-border rounded-xl p-4 bg-warm-section/60 hover:bg-white transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-warm-accent-soft text-warm-accent-hover text-xs font-bold">2</span>
              <span className="text-sm font-medium text-warm-text">Link Block 2</span>
              {linkForms[2].id && !linkForms[2].isEditing && (
                <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700 bg-warm-success px-2 py-1 rounded-full">
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
                  className={`w-full px-4 py-2.5 border rounded-[10px] text-sm transition-colors ${
                    linkForms[2].id && !linkForms[2].isEditing 
                      ? 'bg-warm-page border-warm-border text-warm-text' 
                      : 'bg-white border-warm-border focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent'
                  }`}
                />
              </div>
              {linkForms[2].id && !linkForms[2].isEditing ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEditLink(2)} 
                    className="px-3 py-2 text-sm text-warm-accent-hover hover:bg-warm-accent-soft rounded-[10px] transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDeletePortalLink(2)} 
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-[10px] transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleSavePortalLink(2)} 
                  disabled={linkForms[2].isSaving}
                  className="px-4 py-2.5 bg-warm-accent-soft text-warm-text border border-warm-border rounded-[10px] text-sm font-medium hover:bg-warm-accent/30 disabled:bg-warm-section disabled:text-warm-muted transition-colors flex items-center gap-1.5"
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
                  className="px-3 py-2 text-sm text-warm-muted hover:bg-warm-section rounded-[10px] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* URL Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted" />
                <input
                  type="url"
                  value={linkForms[2].url}
                  onChange={(e) => handleLinkFormChange(2, 'url', e.target.value)}
                  placeholder="Paste any external URL (Google Drive, Sheets, etc.)"
                  disabled={linkForms[2].id && !linkForms[2].isEditing}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-[10px] text-sm transition-colors ${
                    linkForms[2].id && !linkForms[2].isEditing 
                      ? 'bg-warm-page border-warm-border text-warm-muted' 
                      : 'bg-white border-warm-border focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent'
                  }`}
                />
              </div>
              {linkForms[2].id && !linkForms[2].isEditing && linkForms[2].url && (
                <a 
                  href={linkForms[2].url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 text-sm text-warm-accent-hover hover:bg-warm-accent-soft rounded-[10px] transition-colors flex items-center gap-1.5 border border-warm-border"
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
        <div className="px-6 py-3 bg-warm-section border-t border-warm-border text-xs text-warm-muted">
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
      'Customer Name': e.client_name || '-',
      'Phone': getEstimateContactPhone(e) || '-',
      'Property': e.property_name || '-',
      'Property Type': e.property_type || '-',
      'Address': getEstimateAddress(e) || '-',
      'City': getEstimateCity(e) || '-',
      'Zone': getEstimateZone(e) || '-',
      'No. of Units': getEstimateUnits(e) || '-',
      'AMC Package': e.package_name || '-',
      'Services': formatAddonsForExport(e) || '-',
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
      <div className="bg-white rounded-xl border border-warm-border shadow-warm p-4">
        {/* One row of equal-height controls: the search field takes the slack, every button keeps
            its own width, and they wrap as a group rather than shrinking out of alignment */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-accent" /><input type="text" placeholder="Search by Property ID, Customer, or Estimate #..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.trim())} className={`${CONTROL_H} w-full pl-10 pr-4 border border-warm-border rounded-[10px] text-sm text-warm-text placeholder:text-warm-muted focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20`} /></div>
          <button onClick={() => setShowFilters(!showFilters)} className={`${CONTROL_H} px-4 border border-warm-border text-warm-text bg-white rounded-[10px] inline-flex items-center gap-2 hover:bg-warm-section transition-colors text-sm font-medium`}><Filter className="w-4 h-4 text-warm-accent" />Filters<ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} /></button>
          <button onClick={exportAllEstimates} className={`${CONTROL_H} px-4 bg-emerald-700 text-white rounded-[10px] inline-flex items-center gap-2 hover:bg-emerald-800 transition-colors text-sm font-medium`}><Download className="w-4 h-4" />Export All</button>
          <button onClick={() => { setFilterStatus('all'); setFilterType('all'); setFilterCategory('all'); setFilterFromDate(''); setFilterToDate(''); setFilterFromDateDisplay(''); setFilterToDateDisplay(''); }} className={`${CONTROL_H} px-4 border border-warm-border text-warm-muted bg-white rounded-[10px] inline-flex items-center gap-2 hover:bg-warm-section transition-colors text-sm font-medium whitespace-nowrap`}><X className="w-4 h-4" />Clear all filters</button>
          {/* Archive Selected button - only visible when items are selected and not FP Manager */}
          {!isFPManager && selectedEstimates.length > 0 && (
            <button
              onClick={handleBulkArchive}
              disabled={archivingSelected}
              className={`${CONTROL_H} px-4 bg-red-600 text-white rounded-[10px] inline-flex items-center gap-2 hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50`}
            >
              <Archive className="w-4 h-4" />
              {archivingSelected ? 'Archiving...' : `Archive Selected (${selectedEstimates.length})`}
            </button>
          )}
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-warm-border">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">Estimate Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20">
                  <option value="all">All Estimates</option>
                  <option value="property_based">Property Based</option>
                  <option value="direct">Direct</option>
                  <option value="work_order">Work Order</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20">
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">Property Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full h-[42px] px-3 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20">
                  <option value="all">All Categories</option>
                  <option value="GC">Gated Community</option>
                  <option value="APT">Apartment</option>
                  <option value="VILLA">Villa</option>
                  <option value="FLAT">Flat</option>
                  <option value="PLOT">Plot</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">From Date</label>
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
                    className="w-full h-[42px] px-3 pr-10 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" 
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilterFromDate(e.target.value); setFilterFromDateDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-warm-accent pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-muted mb-1.5">To Date</label>
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
                    className="w-full h-[42px] px-3 pr-10 border border-warm-border rounded-[10px] text-sm text-warm-text bg-white focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20" 
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilterToDate(e.target.value); setFilterToDateDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-warm-accent pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        {loading ? <div className="py-16 text-center"><div className="w-8 h-8 border-2 border-warm-accent border-t-transparent rounded-full animate-spin mx-auto"></div></div> : filteredEstimates.length === 0 ? <EmptyState icon={FileText} title="No estimates found" description="Try adjusting your search or filters" /> : (
          <>
          <div className="overflow-x-auto">
            <table className="list-table w-full text-sm min-w-[900px]">
              <thead className="bg-warm-section border-b border-warm-border">
                <tr>
                  {/* Checkbox column - hidden for FP Manager */}
                  {!isFPManager && (
                    <th className="px-3 py-3 text-center w-10">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 hover:bg-warm-accent-soft rounded transition-colors"
                        title={selectedEstimates.length === filteredEstimates.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedEstimates.length === filteredEstimates.length && filteredEstimates.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-warm-accent" />
                        ) : (
                          <Square className="w-4 h-4 text-warm-muted" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Estimate ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Division</th>
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Date</th>
                  {/* Money reads down its own edge, so the figures and the heading are both right-aligned */}
                  <th className="px-4 py-3 text-right font-semibold text-warm-muted uppercase text-xs tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-warm-muted uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border/70">
                {paginatedEstimates.map((est) => {
                  const isSelected = selectedEstimates.includes(est.id);
                  return (
                  <React.Fragment key={est.id}>
                  <tr className={`cursor-pointer transition-colors ${isSelected ? 'bg-warm-accent-soft' : 'hover:bg-warm-section'}`}
                    onClick={() => openViewEstimate({ id: est.id })} title="View details">
                    {/* Checkbox cell - hidden for FP Manager; it selects, never opens */}
                    {!isFPManager && (
                      <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectEstimate(est.id)}
                          className="p-1 hover:bg-warm-accent-soft rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-warm-accent" />
                          ) : (
                            <Square className="w-4 h-4 text-warm-muted" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      {/* The ID opens the estimate full screen; the Back button returns here */}
                      <button type="button" onClick={() => openViewEstimate({ id: est.id })}
                        className="font-mono text-sm text-warm-text hover:text-warm-accent-hover"
                        title="View details">
                        {est.estimate_id}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      {/* Three tints from the warm palette: still one glance per type, no stray pastels */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${
                        est.estimate_type === 'work_order' ? 'bg-warm-warning text-amber-700 border-[#F3E2B3]' :
                        est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'bg-warm-info text-indigo-700 border-[#D8E2FA]' : 
                        'bg-warm-accent-soft text-warm-text border-warm-border'
                      }`}>
                        <Link2 className="w-3 h-3" />
                        {est.estimate_type === 'work_order' ? 'Work Order' : est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'Property' : 'Direct'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-warm-muted">
                      {(est.estimate_type === 'property_based' || est.estimate_type === 'property-based') 
                        ? (shortDivision(est.division || est.property_division) || '-') 
                        : '-'}
                    </td>
                    <td className="px-4 py-4">
                      {/* The customer, in the row itself: who they are and how to reach them */}
                      <div className="font-medium text-warm-text">{est.client_name || '-'}</div>
                      {est.client_phone && <div className="text-xs text-warm-muted whitespace-nowrap">{est.client_phone}</div>}
                      {est.client_email && <div className="text-xs text-warm-muted truncate max-w-[180px]">{est.client_email}</div>}
                      {est.property_code && <div className="text-xs text-warm-muted/80">{est.property_code}</div>}
                    </td>
                    <td className="px-4 py-4 text-warm-muted">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-warm-accent" />
                        {formatDateIST(est.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-warm-text whitespace-nowrap">{formatCurrency(est.total_amount)}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-warm-text">{est.created_by_name || (est.created_by_role ? est.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}</div>
                      <div className="text-xs text-warm-muted capitalize">{est.created_by_name ? (est.created_by_role || '').replace(/_/g, ' ') : ''}</div>
                    </td>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {isFPManager ? (
                        // FP Manager - View only (badge)
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getEstimateStatusColor(est.status)}`}>
                          {getStatusLabel(est.status)}
                        </span>
                      ) : (
                        // FP Owner/Admin - Dropdown to change status
                        <div className="relative inline-block">
                          <select
                            value={(est.status || 'draft').toLowerCase()}
                            onChange={(e) => handleEstimateStatusChange(est.id, e.target.value)}
                            className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-warm-accent/30 ${getEstimateStatusColor(est.status)}`}
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
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {!isFPManager && (
                          <button onClick={() => openEditEstimate(est)} className="p-1.5 text-warm-muted hover:text-warm-accent-hover hover:bg-warm-accent-soft rounded-[10px] transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => handleSendEmail(est)} disabled={sendingEmailId === est.id} className={`p-1.5 rounded-[10px] transition-colors ${sendingEmailId === est.id ? 'text-warm-accent cursor-wait' : 'text-warm-muted hover:text-indigo-600 hover:bg-warm-info'}`} title="Send Email"><Send className={`w-4 h-4 ${sendingEmailId === est.id ? 'animate-pulse' : ''}`} /></button>
                        <button onClick={() => handleArchiveEstimate(est.id)} className="p-1.5 text-warm-muted hover:text-red-600 hover:bg-red-50 rounded-[10px] transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredEstimates.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-t border-warm-border bg-warm-section/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-warm-muted">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredEstimates.length)} of {filteredEstimates.length} estimates
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-[10px] border border-warm-border bg-white text-warm-muted hover:bg-warm-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        className={`w-8 h-8 rounded-[10px] text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-warm-accent text-white'
                            : 'text-warm-muted hover:bg-warm-accent-soft'
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
                  className="p-2 rounded-[10px] border border-warm-border bg-white text-warm-muted hover:bg-warm-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  const filteredAmcPackages = filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => pkgMatchesPropertyType(p, filterPropertyType));
  const handleSaveAmcPackage = async () => {
    if (!amcForm.packageName.trim()) { showToast('Enter package name', 'error'); return; }
    if (amcPackageNameTaken) { showToast(`A package named "${amcPackageNameTaken.name || amcPackageNameTaken.packageName}" already exists`, 'error'); return; }
    if (!selectedPropertyTypes.length) { showToast('Select at least one property type', 'error'); return; }
    // The price is the sum of the configured services, so it is they that must be priced
    if (totals.price <= 0) { showToast('Add a configured service and its amount so the package has a price', 'error'); return; }
    // Every configured service must carry its price, or the package sells it for nothing
    const unpriced = unpricedRows(amcForm.serviceRows);
    if (unpriced.length) { showToast(`${unpriced.map(r => r.service).join(', ')} ${unpriced.length === 1 ? 'has' : 'have'} no price yet -- choose its amount or slab so it is priced, then save`, 'error'); return; }
    const validSvc = amcForm.serviceRows.filter(r => String(r.service || '').trim());
    if (validSvc.length === 0) { showToast('Add at least one service', 'error'); return; }
    try {
      const isEditing = !!editingAmcPackage;
      // Full API_BASE URL: a relative one resolves against the admin host in production
      const url = isEditing ? `${API_BASE}/api/fp/amc-packages/${editingAmcPackage}` : `${API_BASE}/api/fp/amc-packages`;
      const method = isEditing ? 'PUT' : 'POST';
      // The FP list reads `name` / `frequency_*`; the shared shape is kept alongside so a package
      // reads back the same in every portal
      const services = validSvc.map(r => {
        const row = packageRowForSave(r);
        return { ...row, name: row.service, frequency_count: row.frequencyCount, frequency_type: row.frequencyType };
      });
      const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: amcForm.packageName.trim(), description: amcForm.description?.trim() || '', property_type: selectedPropertyTypes[0], property_types: selectedPropertyTypes, services, price: totals.price, markup_percentage: amcForm.markupPercentage === '' ? null : Number(amcForm.markupPercentage), billing_duration: amcForm.billingDuration }) });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success !== false) { showToast(isEditing ? 'AMC Package updated!' : 'AMC Package created!'); resetAmcForm(); loadData(); setAmcActiveTab('all-packages'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to save package', 'error'); }
  };
  const handleDeleteAmcPackage = async (id) => { if (!window.confirm('Delete this package?')) return; try { const res = await fetch(`${API_BASE}/api/fp/amc-packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  // A slab carries its own frequency and visit count, so choosing one takes them with it. Leaving
  // the row on a different frequency has the quote refused -- "Frequency override is disabled for
  // this service" -- and the row stays unpriced.
  const handleChooseSlab = (index, capacity, slab) => {
    setAmcForm(prev => ({
      ...prev,
      serviceRows: prev.serviceRows.map((row, i) => (i === index ? {
        ...row, inputValue: capacity,
        ...(slab ? {
          frequencyType: slab.defaultFrequency ?? row.defaultFrequency ?? row.frequencyType,
          frequencyCount: slab.defaultVisitsPerYear ?? row.defaultVisitsPerYear ?? row.frequencyCount
        } : {})
      } : row))
    }));
  };
  const handleAddServiceRow = () => setCustomRowOpen(true);
  // Add Row opens the same dialog an estimate's hand-entered service uses, because a row has no
  // room for what one needs: a category, a quantity, a schedule and what the vendor charges. The
  // figure asked for is the vendor price -- a package is bought here, not sold -- so it lands on
  // the row as its vendor cost and shows in the Internal figures.
  const [customRowOpen, setCustomRowOpen] = useState(false);
  // Configured services arrive as ordinary rows, editable afterwards like any typed one. The blank
  // starter row is replaced rather than left above them.
  const handleAddCatalogServices = (rows) => {
    if (!rows.length) return;
    setAmcForm(prev => ({ ...prev, serviceRows: [...prev.serviceRows.filter(row => String(row.service || '').trim() !== ''), ...rows] }));
  };
  // Functional updates on new row objects: assigning into the row React was holding could be undone
  // by the re-pricing below
  const handleUpdateServiceRow = (i, f, v) => {
    const next = f === 'service' || f === 'description' ? capitalizeFirst(v) : v;
    setAmcForm(prev => ({ ...prev, serviceRows: updatePackageRow(prev.serviceRows, i, f, next, FREQUENCY_COUNT_MAP) }));
  };
  // Any row may go, the last one included: the table is allowed to be empty, and saving already
  // refuses a package with no services.
  const handleRemoveServiceRow = (i) => { setAmcForm(prev => ({ ...prev, serviceRows: prev.serviceRows.filter((_, idx) => idx !== i) })); };
  // The same package name twice is two entries nobody can tell apart in the estimate's dropdown
  const amcPackageNameTaken = duplicatePackageName(amcPackages, amcForm.packageName, editingAmcPackage);

  // The package's price is what its configured services add up to, so it is derived rather than typed
  // Every row's price follows the package's markup, exactly as a service's own markup prices it
  // on the service form. Blank leaves each row on the price it already has.
  const totals = packageTotals(amcForm.serviceRows, amcForm.markupPercentage);
  const pricedRows = applyPackageMarkup(amcForm.serviceRows, amcForm.markupPercentage);
  const getPrice = () => totals.price;
  const [pricingError, setPricingError] = useState('');
  // A quote is validated against the types a service allows, and no method prices differently by
  // type, so the package's first applicable type is enough to price with.
  const pricingKey = JSON.stringify(amcForm.serviceRows.map(row =>
    [row.catalogServiceId, row.inputValue, row.frequencyType, row.frequencyCount]));
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let failure = '';
      const snapshot = amcForm.serviceRows;
      const patches = await Promise.all(snapshot.map(async row => {
        const result = await quotePackageRow(row, { apiPath: FP_CATALOG_API, propertyTypes: selectedPropertyTypes, fpId: 'all', token, signal: controller.signal })
          .catch(error => (error.name === 'AbortError' ? { skipped: true } : { error: error.message }));
        if (result.error) { failure = result.error; return { price: undefined, vendorCost: undefined }; }
        if (result.priced) return result.priced;
        if (result.cleared) return { price: undefined, vendorCost: undefined, operatingCost: undefined, marginPercentage: undefined };
        return null;
      }));
      if (controller.signal.aborted) return;
      setPricingError(failure);
      // Applied to the rows as they are now: whatever was typed while the quotes ran is kept, and
      // nothing is written back when no figure changed, or this would loop
      setAmcForm(prev => {
        const serviceRows = applyRowPatches(prev.serviceRows, snapshot, patches);
        return serviceRows === prev.serviceRows ? prev : { ...prev, serviceRows };
      });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [pricingKey, selectedPropertyTypes, token]);
  const resetAmcForm = () => { setAmcForm({ packageName: '', description: '', serviceRows: [], price: '', markupPercentage: '', billingDuration: 'monthly' }); setSelectedPropertyTypes([]); setEditingAmcPackage(null); };
  const getBillingBadgeColor = (billing) => {
    switch (billing) {
      // Four tints a billing column can still be scanned by, drawn from the warm palette
      case 'monthly': return 'bg-warm-info text-indigo-700 border-[#D8E2FA]';
      case 'quarterly': return 'bg-warm-accent-soft text-warm-text border-warm-border';
      case 'half-yearly': return 'bg-warm-warning text-amber-700 border-[#F3E2B3]';
      case 'yearly': return 'bg-warm-success text-emerald-700 border-[#CFEBDD]';
      default: return 'bg-warm-info text-indigo-700 border-[#D8E2FA]';
    }
  };

  const renderAmcPackages = () => (
    <div className="space-y-6">
      {/* The page header already names this screen, so the list does not repeat the title */}
      {/* The list is the landing view; Create Package is the highlighted action on the
          right and stays there while the form is open. Hidden for FP Manager. */}
      {/* The segmented control and the action beside it are both 42px, so the row has one height */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-warm-page p-1 rounded-xl w-fit">
          <button
            onClick={() => setAmcActiveTab('all-packages')}
            className={`h-[34px] px-4 text-sm font-medium rounded-[10px] transition-all ${amcActiveTab === 'all-packages' ? 'bg-white text-warm-text shadow-warm' : 'text-warm-muted hover:text-warm-text'}`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              All Packages
              {amcPackages.length > 0 && (
                <span className="px-1.5 py-0.5 bg-warm-text text-white rounded-full text-xs">{amcPackages.length}</span>
              )}
            </div>
          </button>
        </div>
        {!isFPManager && (
          <button
            onClick={() => { resetAmcForm(); setAmcActiveTab('create'); }}
            className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        )}
      </div>

      {/* All Packages Tab */}
      {/* A package opens here, in place of the list, as an estimate does in All Estimates */}
      {amcActiveTab === 'all-packages' && viewAmcPackage && <AMCPackageDetailView pkg={viewAmcPackage} onClose={closeViewPackage} internal />}
      {amcActiveTab === 'all-packages' && !viewAmcPackage && (
        <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
          <div className="px-6 py-4 border-b border-warm-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-warm-text">All Packages</h3>
                <p className="text-sm text-warm-muted">
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
                className={`px-4 py-2 text-sm font-medium rounded-[10px] border transition-all ${filterPropertyType === 'all' ? 'bg-warm-text text-white border-warm-text' : 'bg-white text-warm-muted border-warm-border hover:border-warm-accent hover:bg-warm-section'}`}
              >
                All
                {amcPackages.length > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-warm-page text-warm-muted'}`}>{amcPackages.length}</span>
                )}
              </button>
              {PROPERTY_TYPE_OPTIONS.map((type) => {
                const count = amcPackages.filter(p => pkgMatchesPropertyType(p, type.id)).length;
                return (
                  <button
                    key={type.id}
                    onClick={() => setFilterPropertyType(type.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-[10px] border transition-all ${filterPropertyType === type.id ? 'bg-warm-text text-white border-warm-text' : 'bg-white text-warm-muted border-warm-border hover:border-warm-accent hover:bg-warm-section'}`}
                  >
                    {type.label}
                    {count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === type.id ? 'bg-white/20 text-white' : 'bg-warm-page text-warm-muted'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {amcPackages.length === 0 ? (
            <EmptyState icon={Package} title="No AMC packages yet" description="Create your first package to get started"
              action={isFPManager ? null : (
                <button onClick={() => { resetAmcForm(); setAmcActiveTab('create'); }} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-[10px] hover:bg-emerald-800 transition-colors">
                  <Plus className="w-4 h-4" />Create Package
                </button>
              )} />
          ) : filteredAmcPackages.length === 0 ? (
            <EmptyState icon={Package} title="No packages found for this property type"
              action={(
                <button onClick={() => setFilterPropertyType('all')} className="px-4 py-2 text-sm font-medium text-warm-muted bg-white border border-warm-border rounded-[10px] hover:bg-warm-section transition-colors">
                  Show all packages
                </button>
              )} />
          ) : (
            <div className="overflow-x-auto">
              <table className="list-table w-full">
                <thead className="bg-warm-section border-b border-warm-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-warm-muted uppercase tracking-wider">Package Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-warm-muted uppercase tracking-wider">Property Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-warm-muted uppercase tracking-wider">Billing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-warm-muted uppercase tracking-wider">Services Included</th>
                    {!isFPManager && <th className="px-4 py-3 text-right text-xs font-semibold text-warm-muted uppercase tracking-wider">Total Rate</th>}
                    {!isFPManager && <th className="px-4 py-3 text-center text-xs font-semibold text-warm-muted uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-border/70">
                  {filteredAmcPackages.map((pkg) => {
                    // Parse services JSON if needed
                    let servicesData = pkg.services;
                    if (typeof servicesData === 'string') {
                      try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = null; }
                    }
                    const serviceRows = servicesData?.serviceRows || servicesData || [];
                    const servicesText = Array.isArray(serviceRows) ? serviceRows.map(s => decodeHtml(s.name || s.service || s)).join(', ') : '-';
                    const propertyType = servicesData?.property_type || pkg.property_type;
                    const billingDuration = servicesData?.billing_duration || pkg.billing_duration;
                    // The row and its name open the package full screen, as an estimate opens from
                    // All Estimates; the action buttons stop the click so they never open it too
                    const openPackage = () => openViewPackage({ ...pkg, servicesData: serviceRows, propertyType, billingDuration });
                    return (
                      <tr key={pkg.id} onClick={openPackage} className="hover:bg-warm-section transition-colors cursor-pointer" title="View package">
                        <td className="px-6 py-4">
                          <button type="button" onClick={(e) => { e.stopPropagation(); openPackage(); }}
                            className="text-left font-semibold text-warm-text hover:text-warm-accent-hover hover:underline">{decodeHtml(pkg.name) || 'Unnamed Package'}</button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {getPkgPropertyTypes(pkg).map(type => (
                              <span key={type} className="px-2.5 py-1 text-xs font-medium bg-warm-accent-soft text-warm-text rounded-full border border-warm-border whitespace-nowrap">
                                {getPropertyTypeLabel(type)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${getBillingBadgeColor(billingDuration)}`}>
                            {BILLING_DURATIONS.find(d => d.value === billingDuration)?.label || 'Monthly'}
                          </span>
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <p className="text-sm text-warm-muted truncate" title={servicesText}>{servicesText}</p>
                        </td>
                        {/* Price - Hidden for FP Manager */}
                        {!isFPManager && (
                          <td className="px-4 py-4 text-right">
                            <span className="text-lg font-bold text-warm-text">{formatCurrency(pkg.price)}</span>
                          </td>
                        )}
                        {/* Action buttons - Hidden for FP Manager */}
                        {!isFPManager && (
                          <td className="px-4 py-4 cursor-default" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => {
                                  setEditingAmcPackage(pkg.id);
                                  // Every row reopens on what it was priced from -- service, method,
                                  // amount, price -- and the package on its markup. Only the name,
                                  // description and schedule used to come back, so an edited package
                                  // had no price and could not be saved again.
                                  setAmcForm({
                                    packageName: decodeHtml(pkg.name) || '',
                                    description: decodeHtml(pkg.description) || '',
                                    serviceRows: Array.isArray(serviceRows) ? serviceRows.filter(s => s && typeof s === 'object').map(s => packageRowFromSaved(s, decodeHtml)) : [],
                                    price: pkg.base_price || pkg.price || '',
                                    markupPercentage: pkg.markupPercentage ?? '',
                                    billingDuration: billingDuration || 'monthly'
                                  });
                                  setSelectedPropertyTypes(getPkgPropertyTypes(pkg));
                                  setAmcActiveTab('create');
                                  showToast('Editing package - make changes and save', 'info');
                                }}
                                className="p-2 text-warm-muted hover:text-warm-muted hover:bg-warm-accent-soft rounded-[10px] transition-colors" 
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
                                      frequencyType: s.frequency_type || s.frequencyType || 'Monthly',
                                      category: s.category || '',
                                      // The saved vendor cost, for the PDF's INTERNAL figures
                                      vendorCost: s.vendorCost,
                                      operatingCost: s.operatingCost
                                    };
                                  }) : [];
                                  const pdfData = {
                                    id: pkg.id,
                                    packageId: pkg.package_code || `PKG-${pkg.id}`,
                                    packageCode: pkg.package_code,
                                    propertyTypes: getPkgPropertyTypes(pkg),
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
                                className="p-2 text-warm-muted hover:text-green-600 hover:bg-green-50 rounded-[10px] transition-colors" 
                                title="Export PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                                                            <button onClick={() => handleDeleteAmcPackage(pkg.id)} className="p-2 text-warm-muted hover:text-red-600 hover:bg-red-50 rounded-[10px] transition-colors" title="Delete">
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

      {/* Create Package Tab, read top to bottom: what the package applies to, what is in it, then
          what it comes to. */}
      {amcActiveTab === 'create' && (
        <div className="space-y-6">
        <div className="space-y-6">
          <div className="space-y-6">
          {/* What the package applies to, before what is in it */}
          <div className="bg-white rounded-xl border border-warm-border shadow-warm p-5">
            <h2 className="text-sm font-semibold text-warm-text">Applicable Property Types <span className="text-red-500">*</span></h2>
            <p className="mt-1 text-xs text-warm-muted">Every property type this package applies to</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <label key={type.id} className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-xs transition-colors ${selectedPropertyTypes.includes(type.id) ? 'border-warm-accent bg-warm-accent-soft text-warm-text' : 'border-warm-border text-warm-muted hover:bg-warm-section'}`}>
                  <input
                    type="checkbox"
                    checked={selectedPropertyTypes.includes(type.id)}
                    onChange={() => setSelectedPropertyTypes(prev => prev.includes(type.id) ? prev.filter(value => value !== type.id) : [...prev, type.id])}
                    className="h-4 w-4 rounded border-warm-border text-warm-accent focus:ring-warm-accent/30"
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>

            <div className="bg-white rounded-xl border border-warm-border shadow-warm">
              {/* Header with Add Buttons */}
              <div className="px-6 py-4 border-b border-warm-border/70 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-warm-text">Package Configuration</h2>
                <div className="flex items-center gap-2">
                  {/* Add Row is for a service typed by hand; Add Service picks a configured one */}
                  <button
                    onClick={handleAddServiceRow}
                    className="px-4 py-2 text-sm font-medium text-warm-muted bg-white border border-warm-border rounded-[10px] hover:bg-warm-section transition-colors"
                  >
                    Add Row
                  </button>
                  <button
                    onClick={() => setShowPackageServicePicker(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-[10px] hover:bg-emerald-800 transition-colors"
                  >
                    Add Service
                  </button>
                </div>
              </div>
              {/* Add Row opens the same hand-entered service dialog, asking for the vendor price:
                  a package row is bought from a vendor rather than sold to a customer. */}
              <CustomServiceDialog
                open={customRowOpen}
                onClose={() => setCustomRowOpen(false)}
                onSubmit={values => { handleAddCatalogServices([packageRowFromDialog(values)]); setCustomRowOpen(false); }}
                title="Add Service Row"
                priceLabel="Vendor Price"
                subtitle="Typed in by hand, so what the vendor charges is set here rather than quoted from the catalog"
                apiPath={FP_CATALOG_API}
                theme="warm"
              />
              <PackageServicePicker
                open={showPackageServicePicker}
                onClose={() => setShowPackageServicePicker(false)}
                onAdd={handleAddCatalogServices}
                propertyTypes={selectedPropertyTypes}
                apiPath={FP_CATALOG_API}
                theme="warm"
              />
              
              <div className="p-6">
                {/* Package Name */}
                <div className="mb-6">
                  <label className="flex items-center gap-2 text-xs font-medium text-warm-muted mb-1.5">
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.packageName}
                    onChange={(e) => { const packageName = capitalizeFirst(e.target.value); setAmcForm(prev => ({ ...prev, packageName })); }}
                    placeholder="e.g., Gold Package"
                    maxLength={150}
                    className={`w-full max-w-md px-4 py-2.5 border rounded-[10px] text-sm focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent ${amcPackageNameTaken ? 'border-red-300' : 'border-warm-border'}`}
                  />
                  {amcPackageNameTaken && <p role="alert" className="mt-1.5 text-xs text-red-600">A package with this name already exists. Choose another name or edit the existing package.</p>}
                </div>

                {/* What the package covers, as a whole. Saved with the package and shown on its view. */}
                <div className="mb-6">
                  <label htmlFor="fp-package-description" className="block text-xs font-medium text-warm-muted mb-1.5">Package Description</label>
                  <textarea
                    id="fp-package-description"
                    rows={5}
                    maxLength={1000}
                    value={amcForm.description}
                    onChange={(e) => { const description = capitalizeFirst(e.target.value); setAmcForm(prev => ({ ...prev, description })); }}
                    placeholder="What this package covers, visit terms, exclusions..."
                    className="w-full min-h-[120px] px-4 py-3 border border-warm-border rounded-[10px] text-sm leading-relaxed resize-y focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent"
                  />
                  <p className="mt-1 text-right text-[11px] text-warm-muted">{(amcForm.description || '').length} / 1000</p>
                </div>

                {/* Service Configuration. Every column a configured service needs to be priced: what
                    it is, how it is priced, the amount it is priced on, its schedule and its price. */}
                <div className="overflow-x-auto">
                  <div className="min-w-[54rem]">
                    <h3 className="text-sm font-semibold text-warm-text mb-4">Service Configuration</h3>
                    
                    {/* Table Header */}
                    {/* Method and Input are separate columns -- one states how the service is
                        priced, the other takes the amount -- so the row sizes its own columns. */}
                    <div className={`grid ${PACKAGE_ROW_GRID} gap-2 px-3 py-2 bg-warm-section rounded-[10px] mb-3`}>
                      {[['Service', 'text-left'], ['Method', 'text-left'], ['Input', 'text-left'],
                        ['Frequency', 'text-left'], ['Visits', 'text-left'], ['Price', 'text-right'], ['Action', 'text-center']].map(([label, align]) => (
                        <div key={label} className={`px-2 ${align}`}>
                          <span className="text-xs font-semibold text-warm-muted uppercase tracking-wider whitespace-nowrap">{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Service Rows. The table starts empty: a row arrives only when Add Service
                        picks a configured one or Add Row makes a blank one. */}
                    <div className="space-y-3">
                      {!amcForm.serviceRows.length && (
                        <p className="rounded-[10px] border border-dashed border-warm-border px-4 py-6 text-center text-sm text-warm-muted">
                          No services yet. Use <span className="font-medium">Add Service</span> to price one from the catalog, or <span className="font-medium">Add Row</span> to type one in.
                        </p>
                      )}
                      {amcForm.serviceRows.map((row, index) => (
                        <div key={index} className={`grid ${PACKAGE_ROW_GRID} gap-2 items-center p-3 bg-warm-section rounded-[10px] border border-warm-border`}>
                          {/* Service Name */}
                          <div>
                            <input
                              type="text"
                              value={row.service}
                              onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                              placeholder="e.g., Deep Cleaning"
                              className="w-full px-2 py-2 border border-warm-border rounded-[10px] text-sm focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent"
                            />
                            {row.category && <p className="mt-1 px-1 text-[11px] text-warm-muted truncate" title={row.category}>{row.category}</p>}
                          </div>

                          {/* How the service is priced. A configured service brings its own method,
                              so that one is stated; a row typed by hand chooses one, which decides
                              what its Input asks for. */}
                          <div className={row.catalogServiceId ? undefined : 'relative'}>
                            {row.catalogServiceId
                              ? <span className="block px-2 text-xs text-warm-muted">{methodLabel(row.pricingMethod)}</span>
                              : <>
                                <select
                                  value={row.pricingMethod || ''}
                                  onChange={(e) => handleUpdateServiceRow(index, 'pricingMethod', e.target.value)}
                                  aria-label={`${row.service || 'Service'} pricing method`}
                                  className="w-full pl-2 pr-6 py-2 border border-warm-border rounded-[10px] text-sm bg-white appearance-none focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent"
                                >
                                  <option value="">Method</option>
                                  {PRICING_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                                </select>
                                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-muted pointer-events-none" />
                              </>}
                          </div>

                          {/* The amount that method is priced on: a quantity, an area, a capacity or
                              a headcount. Fixed Price measures nothing, so it asks for nothing. */}
                          <div>
                            {(() => {
                              const input = rowInput(row);
                              // Capacity Slab prices from a table, so the row offers its bands
                              if (row.pricingMethod === 'capacity_slab' && row.capacitySlabs?.length) {
                                return <CapacitySlabSelect slabs={row.capacitySlabs} unit={row.unit} capacity={row.inputValue}
                                  onChange={(value, slab) => handleChooseSlab(index, value, slab)}
                                  ariaLabel={`${row.service || 'Service'} slab`}
                                  className="w-full px-2 py-2 border border-warm-border rounded-[10px] text-sm bg-white focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent" />;
                              }
                              return input ? (
                                <input
                                  type="number" min={input.min} step={input.step}
                                  value={row.inputValue ?? ''}
                                  onChange={(e) => handleUpdateServiceRow(index, 'inputValue', e.target.value)}
                                  placeholder={input.unit || input.label}
                                  title={`${input.label}${input.unit ? ` (${input.unit})` : ''}`}
                                  aria-label={`${row.service} ${input.label}`}
                                  className="w-full px-2 py-2 border border-warm-border rounded-[10px] text-sm focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent"
                                />
                              ) : <p className="px-1 text-xs text-warm-muted">—</p>;
                            })()}
                          </div>
                          
                          {/* Frequency Type */}
                          <div className="relative">
                            {/* A service that forbids a frequency change has its quote refused when
                                the row carries a different one, so the row cannot create that conflict */}
                            <select
                              value={row.frequencyType}
                              disabled={row.catalogServiceId && row.allowFrequencyOverride === false}
                              title={row.catalogServiceId && row.allowFrequencyOverride === false ? 'This service sets its own frequency' : undefined}
                              onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                              className="w-full pl-2 pr-7 py-2 border border-warm-border rounded-[10px] text-sm focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent bg-white appearance-none"
                            >
                              {FREQUENCY_TYPES.map(type => (
                                <option key={type} value={type} style={frequencyOptionStyle(type)}>{type}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted pointer-events-none" />
                          </div>
                          
                          {/* Frequency Count */}
                          <div>
                            <input
                              type="number"
                              min="0"
                              value={row.frequencyCount}
                              readOnly={!isCustomFrequency(row.frequencyType)}
                              onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                              placeholder={isCustomFrequency(row.frequencyType) ? 'Enter' : ''}
                              className={`w-full px-2 py-2 border border-warm-border rounded-[10px] text-sm ${isCustomFrequency(row.frequencyType) ? 'bg-white focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent' : 'bg-warm-page cursor-not-allowed'}`}
                            />
                          </div>

                          {/* What this service comes to. A configured row opens on the server's quote
                              and a hand-typed one on nothing, and either may be typed over -- the
                              quote then refreshes the costs behind it without touching the figure. */}
                          <div>
                            <input
                              type="number" min="0" step="0.01"
                              value={pricedRows[index]?.price ?? ''}
                              onChange={(e) => handleUpdateServiceRow(index, 'price', e.target.value)}
                              placeholder={row.catalogServiceId ? 'Quoted' : '0'}
                              aria-label={`${row.service || 'Service'} price`}
                              title={row.priceOverridden ? 'Typed over the quote' : undefined}
                              className={`w-full px-2 py-2 text-right border rounded-[10px] text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent ${row.priceOverridden ? 'border-amber-300 bg-amber-50/50' : 'border-warm-border'}`}
                            />
                          </div>
                          
                          {/* Delete Button */}
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleRemoveServiceRow(index)}
                              aria-label={`Remove ${row.service || 'service'}`}
                              className="p-2 rounded-[10px] text-red-500 transition-colors hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Description: the full width of the row, so it can be read and typed */}
                          <div className="col-span-full">
                            <textarea
                              rows={3}
                              maxLength={1000}
                              value={row.description || ''}
                              onChange={(e) => handleUpdateServiceRow(index, 'description', e.target.value)}
                              placeholder="Service description — what this service covers in the package"
                              aria-label={`${row.service || 'Service'} description`}
                              className="w-full min-h-[80px] px-3 py-2.5 border border-warm-border rounded-[10px] text-sm leading-relaxed resize-y bg-white focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {pricingError && <p role="alert" className="mt-3 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{pricingError}</p>}
                  {/* A row with no configured service behind it cannot be priced, and the package's
                      price is the sum of the priced ones -- so it is said plainly rather than left
                      to be inferred from two dashes. */}
                  {amcForm.serviceRows.some(row => String(row.service || '').trim() && !row.catalogServiceId) && (
                    <p className="mt-3 text-xs text-warm-muted">
                      A row added with <span className="font-medium">Add Row</span> states what the vendor charges, which counts towards the vendor cost below. Every row's Price may be typed over: a configured one opens on its quote, and a figure entered by hand stands until the field is cleared.
                    </p>
                  )}
                  {/* No slab table under the rows. A Capacity Slab row offers its bands in the
                      Input column and pricing the chosen one is the whole of the job here -- the
                      full table belongs to the service's own configuration, not to a package. */}
                </div>

              </div>
            </div>
          </div>

          {/* What the package comes to, under what is in it */}
          <div className="w-full">
            <div className="w-full">
                    <div className="bg-warm-section rounded-xl p-6 border border-warm-border h-full">
                      <h3 className="text-warm-muted text-xs uppercase tracking-wider mb-4 font-semibold">Price Summary</h3>
                      {/* What is decided on the left, what it comes to on the right. The two were
                          interleaved -- price, markup, period, then the totals again -- so the
                          figures were read before the fields that set them, and the panel repeated
                          the same amount in two places a column apart. */}
                      <div className="grid gap-6 lg:grid-cols-2">

                      {/* The two figures that decide the price, in the order they are answered */}
                      <div className="space-y-4">
                        {/* Every row is priced at what the vendor charges, so this is XLAND's margin
                            on the package -- the same relationship a service's own markup has to its
                            vendor rate. Blank leaves the package at cost, which is why it says so. */}
                        <div>
                          <label className="block text-xs font-medium text-warm-muted mb-1.5" htmlFor="fp-package-markup">Markup (%) <span className="font-normal text-warm-muted/70">on the vendor cost</span></label>
                          <input
                            id="fp-package-markup" type="number" min="0" max="1000" step="0.01"
                            value={amcForm.markupPercentage ?? ''}
                            onChange={(e) => { const markupPercentage = e.target.value; setAmcForm(prev => ({ ...prev, markupPercentage })); }}
                            placeholder="None"
                            className="w-full px-4 py-2.5 bg-white border border-warm-border rounded-[10px] text-sm text-warm-text focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent"
                          />
                        </div>

                        {/* Service Period */}
                        <div>
                          <label className="block text-xs font-medium text-warm-muted mb-1.5">Service Period</label>
                          <div className="relative">
                            <select
                              value={amcForm.billingDuration}
                              onChange={(e) => { const billingDuration = e.target.value; setAmcForm(prev => ({ ...prev, billingDuration })); }}
                              className="w-full px-4 py-2.5 bg-white border border-warm-border rounded-[10px] text-sm text-warm-text focus:ring-2 focus:ring-warm-accent/20 focus:border-warm-accent appearance-none"
                            >
                              {BILLING_DURATIONS.map(duration => (
                                <option key={duration.value} value={duration.value}>{duration.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-muted pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* What it comes to: one card on the right, stating the price once. The
                          package's own name was a line of it and is gone -- the field that sets it
                          is directly above this panel, so repeating it here said nothing. */}
                      <div className="rounded-[10px] border border-warm-border bg-white px-4 py-4 lg:justify-self-end lg:w-full lg:max-w-sm">
                        <p className="text-xs font-medium text-warm-muted">Price (₹)</p>
                        <p className="mt-1 text-2xl font-bold text-warm-text">{formatCurrency(totals.price)}</p>
                        {/* A row is priced at the vendor's rate, so with no markup the package is
                            sold at cost -- said plainly rather than left to be worked out */}
                        <p className="mt-1 text-[11px] text-warm-muted">{totals.pricedCount
                          ? `From ${totals.pricedCount} configured service${totals.pricedCount === 1 ? '' : 's'}, priced at vendor cost${hasMarkup(amcForm.markupPercentage) ? ` plus ${Number(amcForm.markupPercentage)}% markup` : ' — add a markup to earn on it'}`
                          : 'Add a configured service and its amount'}</p>
                        <div className="mt-3 space-y-2 border-t border-warm-border pt-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-warm-muted">Services</span>
                            <span className="font-medium text-warm-text tabular-nums">{amcForm.serviceRows.filter(r => r.service.trim()).length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-warm-text">Total Rate</span>
                            <span className="text-xl font-bold text-warm-text tabular-nums">{formatCurrency(totals.price)}</span>
                          </div>
                        </div>
                      </div>

                      {/* What the package costs XLAND. Internal to this screen, like the service
                          form's pricing preview, and never part of what a customer is shown. */}
                      <div className="lg:col-span-2 border-t border-warm-border pt-4">
                        <p className="text-warm-muted text-[11px] uppercase tracking-wider font-semibold">Internal <span className="font-normal normal-case tracking-normal text-warm-muted/70">(not shown to customers)</span></p>
                        {/* Each figure is a cell with its label above it: as a row of label-value
                            pairs one figure ran straight into the next label -- "₹1,200 XLAND Cost
                            ₹360 Customer Price" -- and which number belonged to which word was a
                            guess. The reading order is the arithmetic: cost, plus margin, is price. */}
                        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            ['Annual Vendor Cost', formatCurrency(totals.vendorCost), 'text-warm-text'],
                            // The markup in rupees, as on the service form: vendor cost plus this
                            // is the customer price. It used to show `operatingCost`, an overhead
                            // no configured service carries, so it sat at ₹0 beside a real margin.
                            ['XLAND Cost', formatCurrency(totals.xlandCost), 'text-warm-text'],
                            ['Customer Price', formatCurrency(totals.price), 'text-warm-text'],
                            ['Margin', totals.marginPercent == null ? '—' : `${totals.marginPercent}%`,
                              totals.profit >= 0 ? 'text-emerald-700' : 'text-red-600']
                          ].map(([label, value, tone]) => (
                            <div key={label} className="min-w-0 rounded-[10px] border border-warm-border bg-white px-3 py-2.5">
                              <dt className="truncate text-[11px] text-warm-muted" title={label}>{label}</dt>
                              <dd className={`mt-1 truncate text-sm font-bold tabular-nums ${tone}`} title={value}>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      </div>
                    </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-warm-muted">
                <span className="text-red-500">*</span> Required fields
              </p>
              <div className="flex gap-3">
                <button
                  onClick={resetAmcForm}
                  className="px-5 py-2.5 text-sm font-medium text-warm-muted border border-warm-border rounded-[10px] hover:bg-warm-section transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleSaveAmcPackage}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-700 rounded-[10px] hover:bg-emerald-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
        </div>
        </div>
      )}
    </div>
  );

  // The legacy add-on list is retired: configured services are the only service catalogue this
  // screen shows. Saved estimates still read their own add-on data, so nothing here loads it.

  // Rendered either on its own row or inside the service form header, so both share one
  // line. type="button" matters in the form: a bare button there submits it.
  const renderAddonTabs = () => (
    <div className="flex gap-2">
      {/* Managers cannot author, so the configured catalog is a list tab for them */}
      {isFPManager && (
        <button type="button" onClick={() => setAddonActiveTab('configured')} className={`${CONTROL_H} px-4 text-sm font-medium rounded-[10px] border transition-all inline-flex items-center gap-2 ${addonActiveTab === 'configured' ? 'bg-white border-warm-border text-warm-text shadow-sm' : 'border-transparent text-warm-muted hover:text-warm-text'}`}>
          <ClipboardList className="w-4 h-4" />Services
        </button>
      )}
      <button type="button" onClick={() => setAddonActiveTab('all-addons')} className={`${CONTROL_H} px-4 text-sm font-medium rounded-[10px] border transition-all inline-flex items-center gap-2 ${addonActiveTab === 'all-addons' ? 'bg-white border-warm-border text-warm-text shadow-sm' : 'border-transparent text-warm-muted hover:text-warm-text'}`}>
        <Layers className="w-4 h-4" />All Services
      </button>
    </div>
  );

  // The create action belongs to the All Services list, where it is the primary action. It is not
  // repeated inside the form: that screen is already Add Service, and its row ends with Save.
  const renderAddServiceAction = () => isFPManager ? null : (
    <button type="button" onClick={() => { setAddonActiveTab('configured'); setCatalogEntry(value => value + 1); }}
      className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800">
      <Plus className="w-4 h-4" />Add Service
    </button>
  );

  const renderAddons = () => (
    <div className="space-y-4">
      {/* The service form hosts this row in its own header; every other view shows it here */}
      {!(addonActiveTab === 'configured' && !isFPManager) && (
        <div className="flex items-center justify-between gap-3">
          {renderAddonTabs()}
          {renderAddServiceAction()}
        </div>
      )}

      {/* Creating opens the form in place; managers cannot author, so they get the list */}
      {addonActiveTab === 'configured' && (isFPManager
        ? <ServiceCatalogList apiPath={FP_CATALOG_API} admin={user} showToast={showToast} scoped showWhenEmpty
            scopeLabel="For your franchise" canEdit={() => false} />
        : <AddServicePage key={catalogEntry} admin={user} showToast={showToast} apiPath={FP_CATALOG_API} scoped embedded
            leading={renderAddonTabs()} scopeLabel="For your franchise"
            onSave={loadData} onBack={() => setAddonActiveTab('all-addons')} />
      )}

      {addonActiveTab === 'all-addons' && (
        <ServiceCatalogList apiPath={FP_CATALOG_API} admin={user} showToast={showToast} scoped showWhenEmpty
          scopeLabel="For your franchise" canEdit={service => !isFPManager && !!service.franchise_partner_id} />
      )}

    </div>
  );

  // Handle estimate status change (FP only)
  const handleEstimateStatusChange = async (estimateId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/fp/estimates/${estimateId}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const result = await res.json();
      if (result.success) {
        // Moving to Sent emails the estimate; the server says to whom
        showToast(newStatus === 'sent' && result.message ? result.message : `Status updated to ${newStatus}`);
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
      default: return 'bg-warm-page text-warm-muted';
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
  const renderArchived = () => (
    <div className="space-y-4">
      {archivedEstimates.length > 0 && !isFPManager && <div className="bg-white rounded-xl border border-warm-border shadow-warm p-4 flex flex-wrap items-center gap-3"><label className="text-sm font-medium text-warm-muted">Type:</label><select value={archivedTypeFilter} onChange={(e) => setArchivedTypeFilter(e.target.value)} className={`${CONTROL_H} px-3 text-sm text-warm-text bg-white border border-warm-border rounded-[10px] focus:outline-none focus:border-warm-accent focus:ring-2 focus:ring-warm-accent/20`}><option value="all">All Types</option><option value="property">Property Based</option><option value="direct">Direct</option></select><button onClick={() => setShowDeleteAllConfirm(true)} className={`${CONTROL_H} ml-auto inline-flex items-center gap-2 px-4 bg-red-600 text-white rounded-[10px] hover:bg-red-700 transition-colors text-sm font-medium`}><Trash2 className="w-4 h-4" />Delete All ({archivedEstimates.length})</button></div>}
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">{archivedEstimates.length === 0 ? <EmptyState icon={Archive} title="No archived estimates" description="Archived estimates will appear here" /> : <table className="list-table w-full text-sm"><thead className="bg-warm-section border-b border-warm-border"><tr><th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Estimate ID</th><th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Type</th><th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Division</th><th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Client</th><th className="px-4 py-3 text-left font-semibold text-warm-muted uppercase text-xs tracking-wider">Archived On</th><th className="px-4 py-3 text-right font-semibold text-warm-muted uppercase text-xs tracking-wider">Total</th><th className="px-4 py-3 text-center font-semibold text-warm-muted uppercase text-xs tracking-wider">Actions</th></tr></thead><tbody className="divide-y divide-warm-border/70">{archivedEstimates.filter(e => archivedTypeFilter === "all" ? true : archivedTypeFilter === "property" ? (e.estimate_type === "property_based" || e.property_id) : (e.estimate_type === "direct" && !e.property_id)).map(e => <React.Fragment key={e.id}><tr className="hover:bg-warm-section cursor-pointer" onClick={() => openViewEstimate({ id: e.id })} title="View details"><td className="px-4 py-3"><button type="button" onClick={() => openViewEstimate({ id: e.id })} className="font-mono text-xs text-warm-text hover:text-warm-accent-hover" title="View details">{e.estimate_id}</button></td><td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3 text-warm-muted">{(e.estimate_type === 'property_based' || e.property_id) ? (shortDivision(e.division) || '-') : '-'}</td><td className="px-4 py-3"><div className="font-medium text-warm-text">{e.client_name || '-'}</div>{e.client_phone && <div className="text-xs text-warm-muted whitespace-nowrap">{e.client_phone}</div>}{e.client_email && <div className="text-xs text-warm-muted truncate max-w-[180px]">{e.client_email}</div>}{e.property_code && <div className="text-xs text-warm-muted/80">{e.property_code}</div>}</td><td className="px-4 py-3 text-warm-muted">{formatDateIST(e.archived_at)}</td><td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(e.total_amount)}</td><td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-center gap-1"><button onClick={() => handleRestoreEstimate(e.id)} className="p-1.5 text-warm-muted hover:text-green-600 hover:bg-green-50 rounded"><RotateCcw className="w-4 h-4" /></button><button onClick={() => setDeleteConfirm(e)} className="p-1.5 text-warm-muted hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></td></tr></React.Fragment>)}</tbody></table>}</div>
      {deleteConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-warm-text mb-2">Delete Permanently?</h3><p className="text-warm-muted mb-4">Are you sure you want to permanently delete estimate <strong>{deleteConfirm.estimate_id}</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-warm-border rounded-[10px] text-warm-text hover:bg-warm-section">Cancel</button><button onClick={() => handleDeletePermanent(deleteConfirm.id)} className="px-4 py-2 bg-red-600 text-white rounded-[10px] hover:bg-red-700">Delete</button></div></div></div>}
      {showDeleteAllConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Delete All Archived?</h3><p className="text-warm-muted mb-4">Are you sure you want to permanently delete <strong>all {archivedEstimates.length} archived estimates</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setShowDeleteAllConfirm(false)} className="px-4 py-2 border border-warm-border rounded-[10px] text-warm-text hover:bg-warm-section">Cancel</button><button onClick={handleDeleteAllArchived} className="px-4 py-2 bg-red-600 text-white rounded-[10px] hover:bg-red-700">Delete All</button></div></div></div>}
    </div>
  );

  // An estimate opened from a list leaves the list entirely: the document takes the whole area,
  // and Back returns to whichever list -- active or archived -- opened it. `?viewEstimate=` stays
  // in the URL, so a direct link to an estimate still lands on the document.
  const detailEstimate = expandedEstimateId
    ? [...estimates, ...archivedEstimates].find(e => Number(e.id) === expandedEstimateId) || null
    : null;

  // While a document is open, Ctrl+P prints its PDF, not the page
  useEstimatePrint(detailEstimate, buildEstimatePdfData);

  const renderEstimateDetail = (estimate) => (
    <div>
      {/* Screen furniture around the document: Back returns to the list, Print sends the
          generated PDF to the viewer's print (a browser page print stamps the tab title and URL
          on every sheet) and Download is the same PDF -- the row's own download icon is gone, so
          the document is where both actions live */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={closeViewEstimate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-warm-border rounded-[10px] text-sm font-medium text-warm-muted hover:bg-warm-section transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to {defaultTab === 'archived' ? 'Archived Estimates' : 'All Estimates'}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => handlePrintEstimate(estimate)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-warm-border rounded-[10px] text-sm font-medium text-warm-muted hover:bg-warm-section transition-colors">
            <Printer className="w-4 h-4" />Print
          </button>
          <button onClick={() => handleExportPDF(estimate)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-[10px] text-sm font-semibold hover:bg-emerald-800 transition-colors">
            <Download className="w-4 h-4" />Download PDF
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        {/* FP is internal — the services table also shows Vendor Cost, XLAND Cost and Margin % */}
        <EstimateDetailPanel estimate={estimate} decode={decodeHtml} internal onPrint={() => handlePrintEstimate(estimate)} />
      </div>
    </div>
  );

  const renderContent = () => {
    // Only the lists open the document: a lingering ?viewEstimate= on another tab is ignored
    if (detailEstimate && (defaultTab === 'list' || defaultTab === 'archived')) return renderEstimateDetail(detailEstimate);
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
    // Everything on this page renders on the warm skin, including the shared catalog screens
    <EstimateThemeProvider value="warm">
    {/* The layout already pads the main area and paints it warm, so the page adds no inset of its own */}
    <div className="bg-warm-page">
      <div className="max-w-7xl mx-auto">
        <div className="bg-warm-section border border-warm-border rounded-xl shadow-warm px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 bg-warm-accent-soft rounded-xl flex items-center justify-center shrink-0"><FileText className="w-6 h-6 text-warm-accent" /></div>
              <div className="min-w-0"><h1 className="text-2xl font-bold text-warm-text truncate">{TAB_TITLES[defaultTab] || 'Estimates'}</h1><p className="text-sm text-warm-muted">Create and manage estimates, AMC packages, and services</p></div>
            </div>
            {/* The retired add-on count is gone with its list; configured services are counted on their own panel */}
            <EstimateStatCards
              active={filteredEstimates.length}
              amc={filteredAmcPackages.length}
              archived={archivedEstimates.length}
              onRefresh={loadData}
              refreshing={loading}
            />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-6">{renderContent()}</div>
      {/* The hand-entered service dialog belongs to the page, not to one form: both the property
          and direct forms open the same one */}
      {renderCustomServiceDialog()}
      {toast && <div className="fixed bottom-6 right-6 z-50"><div className={`flex items-center gap-3 px-4 py-3 rounded-[10px] shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<span>{toast.message}</span><button onClick={() => setToast(null)} className="ml-2 p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button></div></div>}


      {/* Edit Estimate Modal */}
      {editEstimate && editEstimateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-warm-border/70 px-6 py-4 flex items-center justify-between z-10">
              <div><h3 className="text-lg font-semibold text-warm-text">Edit Estimate</h3><p className="text-sm text-warm-muted">{editEstimate.estimate_id} - {editEstimate.estimate_type === 'work_order' ? 'Work Order' : editEstimate.estimate_type === 'property_based' || editEstimate.estimate_type === 'property-based' ? 'Property Based' : 'Direct'}</p></div>
              <button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="p-2 hover:bg-warm-section rounded-[10px]"><X className="w-5 h-5 text-warm-muted" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div><p className="text-sm font-semibold text-warm-text mb-3">Customer Details</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-medium text-warm-muted mb-1.5">Customer Name *</label><input type="text" value={editEstimateForm.client_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div><div><label className="block text-xs font-medium text-warm-muted mb-1.5">Phone</label><input type="text" value={editEstimateForm.client_phone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div><div><label className="block text-xs font-medium text-warm-muted mb-1.5">Email</label><input type="email" value={editEstimateForm.client_email} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_email: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div></div></div>
              <div><p className="text-sm font-semibold text-warm-text mb-3">Property Details</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{editEstimate.property_code && <div><label className="block text-xs font-medium text-warm-muted mb-1.5">Property ID</label><input type="text" value={editEstimate.property_code} readOnly disabled className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-warm-page text-warm-muted cursor-not-allowed" /></div>}<div><label className="block text-xs font-medium text-warm-muted mb-1.5">Property Name</label><input type="text" value={editEstimateForm.property_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, property_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div><div><label className="block text-xs font-medium text-warm-muted mb-1.5">Zone</label><input type="text" value={editEstimateForm.zone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, zone: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div><div><label className="block text-xs font-medium text-warm-muted mb-1.5">City</label><input type="text" value={editEstimateForm.city} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, city: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div><div><label className="block text-xs font-medium text-warm-muted mb-1.5">Address</label><input type="text" value={editEstimateForm.address} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div></div></div>
              {editEstimate.estimate_type === 'work_order' ? (
                <div className="bg-warm-section border border-warm-border rounded-[10px] p-4">
                  <p className="text-sm font-semibold text-warm-text mb-3">Work Order Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-warm-muted mb-1.5">Work Order ID</label><input type="text" value={editEstimate.work_order_id || ''} readOnly disabled className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-warm-page text-warm-text font-mono cursor-not-allowed" /></div>
                    <div><label className="block text-xs font-medium text-warm-muted mb-1.5">Category</label><input type="text" value={editEstimate.work_order_category || '-'} readOnly disabled className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-warm-page cursor-not-allowed" /></div>
                    <div><label className="block text-xs font-medium text-warm-muted mb-1.5">Subcategory</label><input type="text" value={editEstimate.work_order_subcategory || '-'} readOnly disabled className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-warm-page cursor-not-allowed" /></div>
                    <div><label className="block text-xs font-medium text-warm-muted mb-1.5">Priority</label><input type="text" value={editEstimate.work_order_priority || '-'} readOnly disabled className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-warm-page cursor-not-allowed" /></div>
                  </div>
                  {editEstimate.work_order_description && (
                    <div className="mt-3"><label className="block text-xs font-medium text-warm-muted mb-1.5">Work Order Description</label><p className="text-sm text-warm-text bg-white p-2 rounded border border-warm-border">{editEstimate.work_order_description}</p></div>
                  )}
                </div>
              ) : (
                <>
                  <div><p className="text-sm font-semibold text-warm-text mb-3">AMC Package</p><select value={editEstimateForm.package_id || ''} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, package_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px] bg-white"><option value="">Select Package</option>{amcPackages.filter(p => normalizePropertyType(getPkgPropertyType(p)) === normalizePropertyType(editEstimate.property_type)).map(pkg => (<option key={pkg.id} value={pkg.id}>{pkg.name}</option>))}</select></div>
                  <div><p className="text-sm font-semibold text-warm-text mb-3">Add Service</p><div className="space-y-2 max-h-48 overflow-y-auto border border-warm-border rounded-[10px] p-3">{addons.filter(a => normalizePropertyType(a.property_type) === normalizePropertyType(editEstimate.property_type)).map(addon => { const existing = (editEstimateForm.selectedAddons || []).find(item => item.id === addon.id); const qty = existing?.quantity || 0; return (<div key={addon.id} className="flex items-center justify-between hover:bg-warm-section p-2 rounded"><span className="text-sm text-warm-text flex-1">{decodeHtml(addon.service_name)}</span><div className="flex items-center gap-2"><button type="button" onClick={() => { const current = editEstimateForm.selectedAddons || []; if (qty <= 1) { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.filter(item => item.id !== addon.id) }); } else { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.map(item => item.id === addon.id ? { ...item, quantity: item.quantity - 1 } : item) }); } }} className="w-7 h-7 flex items-center justify-center rounded-full border border-warm-border text-warm-muted hover:bg-warm-section disabled:opacity-50" disabled={qty === 0}>-</button><span className="w-6 text-center text-sm font-medium">{qty}</span><button type="button" onClick={() => { const current = editEstimateForm.selectedAddons || []; if (qty === 0) { setEditEstimateForm({ ...editEstimateForm, selectedAddons: [...current, { id: addon.id, quantity: 1 }] }); } else { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.map(item => item.id === addon.id ? { ...item, quantity: item.quantity + 1 } : item) }); } }} className="w-7 h-7 flex items-center justify-center rounded-full border border-amber-500 text-warm-accent-hover hover:bg-warm-accent-soft">+</button></div></div>); })}</div></div>
                </>
              )}
              <div><p className="text-sm font-semibold text-warm-text mb-3">Pricing</p><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-warm-muted mb-1.5">Discount (%)</label><input type="number" min="0" max="100" value={editEstimateForm.discount_percent} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, discount_percent: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div><div><label className="block text-xs font-medium text-warm-muted mb-1.5">GST (%)</label><input type="number" min="0" max="100" value={editEstimateForm.gst_percent} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, gst_percent: e.target.value })} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div></div><div className="mt-4 bg-warm-section p-4 rounded-[10px] space-y-2"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(calculateEditPricing().subtotal)}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span className="text-red-500">-{formatCurrency(calculateEditPricing().discountAmt)}</span></div><div className="flex justify-between text-sm"><span>GST</span><span>{formatCurrency(calculateEditPricing().gstAmt)}</span></div><div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span className="text-warm-accent-hover">{formatCurrency(calculateEditPricing().total)}</span></div></div></div>
              <div><label className="block text-xs font-medium text-warm-muted mb-1.5">Notes</label><textarea value={editEstimateForm.description} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border border-warm-border rounded-[10px]" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="px-5 py-2.5 text-sm text-warm-muted border border-warm-border rounded-[10px] hover:bg-warm-section">Cancel</button><button onClick={handleUpdateEstimate} disabled={savingEstimate} className="px-6 py-2.5 text-sm text-white bg-amber-600 rounded-[10px] hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">{savingEstimate ? (<><RefreshCw className="w-4 h-4 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4" />Save</>)}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
    </EstimateThemeProvider>
  );
};

export default FPEstimates;
