import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import {
  FileText, Plus, Search, X, Check, AlertCircle, Package, PlusCircle, Archive,
  List, ChevronDown, ChevronLeft, ChevronRight, Building2, User, Trash2, Edit2, Eye, RotateCcw, Calendar,
  DollarSign, Layers, Filter, Download, Mail, Save, Edit, RefreshCw, FolderOpen, ExternalLink, Link, ArrowLeft
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { FREQUENCY_TYPES, FREQUENCY_COUNT_MAP } from '../utils/estimateStore';

const ITEMS_PER_PAGE = 10;
import { exportEstimateToPDF } from '../utils/pdfExport';

// Decode HTML entities (e.g., &amp;amp; -> &)
const decodeHtml = (html) => {
  if (!html || typeof html !== 'string') return html;
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

const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'APT', label: 'Apartment' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'PLOT', label: 'Plot' },
];

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

// Helper to normalize property type to standard format
const normalizePropertyType = (type) => {
  if (!type) return '';
  const upper = type.toUpperCase().replace(/[_\s-]/g, '');
  if (upper === 'GC' || upper.includes('GATED')) return 'GC';
  if (upper === 'APT' || upper.includes('APARTMENT')) return 'APT';
  if (upper === 'VILLA' || upper === 'VILLAS') return 'VILLA';
  if (upper === 'FLAT' || upper === 'FLATS') return 'FLAT';
  if (upper === 'PLOT' || upper === 'PLOTS') return 'PLOT';
  return upper;
};

// Helper to match property types (handles different formats)
const matchPropertyType = (value, filterId) => {
  if (!value || !filterId) return false;
  return normalizePropertyType(value) === normalizePropertyType(filterId);
};

// Helper to get property type label from any format
const getPropertyTypeLabel = (type) => {
  if (!type) return '-';
  const upper = type.toUpperCase();
  if (upper.includes('GATED') || upper === 'GC') return 'Gated Community';
  if (upper.includes('APARTMENT') || upper === 'APT') return 'Apartment';
  if (upper.includes('VILLA')) return 'Villa';
  if (upper.includes('FLAT')) return 'Flat';
  if (upper.includes('PLOT')) return 'Plot';
  const match = PROPERTY_TYPE_OPTIONS.find(t => t.id === type);
  return match?.label || type || '-';
};

const BILLING_DURATIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' }
];

const TAB_TITLES = {
  'create': 'Create Estimate', 'list': 'All Estimates', 'amc': 'AMC Packages', 'addons': 'Add-ons', 'archived': 'Archived Estimates'
};

const CoordinatorEstimates = ({ user, defaultTab = 'list' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEstimateStep = searchParams.get('estimateStep');
  
  // Ref to prevent circular updates between URL and state
  const isUpdatingFromStateRef = useRef(false);
  const isUpdatingFromUrlRef = useRef(false);
  
  // Helper to update URL params (push new history entry for back button support)
  const updateUrlParam = useCallback((key, value) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (!value || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
      return newParams;
    });
  }, [setSearchParams]);
  
  // Check if this is an FP-created Manager (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [archivedTypeFilter, setArchivedTypeFilter] = useState('all');
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({ estimates: 0, amcPackages: 0, addons: 0, archived: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterFromDateDisplay, setFilterFromDateDisplay] = useState('');
  const [filterToDateDisplay, setFilterToDateDisplay] = useState('');
  const [estimateType, setEstimateType] = useState(null);
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  // Managers cannot create packages - always default to all-packages
  const [amcActiveTab, setAmcActiveTab] = useState('all-packages');
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);
  const [amcForm, setAmcForm] = useState({ packageName: '', serviceRows: [{ service: '', frequencyCount: 12, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' });
  const [filterPropertyType, setFilterPropertyType] = useState('all');
  // Managers cannot create add-ons - always default to all-addons
  const [addonActiveTab, setAddonActiveTab] = useState('all-addons');
  const [addonSelectedPropertyType, setAddonSelectedPropertyType] = useState(null);
  const [addonFilterPropertyType, setAddonFilterPropertyType] = useState('all');
  const [addonForm, setAddonForm] = useState({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [editEstimate, setEditEstimate] = useState(null);
  const [editEstimateForm, setEditEstimateForm] = useState(null);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [viewAmcPackage, setViewAmcPackage] = useState(null);
  const [viewAddon, setViewAddon] = useState(null);
  const [fpPortalLinks, setFpPortalLinks] = useState([]);

  const token = getAuthToken();

  // Auto-refresh every 30 seconds to sync with FP updates
  useEffect(() => { 
    loadData(); 
    const interval = setInterval(() => {
      loadData(true); // silent refresh
    }, 30000);
    return () => clearInterval(interval);
  }, [defaultTab]);

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
      
      // Only update if different from current URL
      if ((urlEstimateStep || '') !== targetStep) {
        isUpdatingFromStateRef.current = true;
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          if (!targetStep) {
            newParams.delete('estimateStep');
          } else {
            newParams.set('estimateStep', targetStep);
          }
          return newParams;
        });
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
      } else if (urlEstimateStep === 'property-id') {
        // Property ID entry step
        setEstimateType('property-based');
        setSelectedProperty(null);
        setPropertyIdInput('');
      } else if (urlEstimateStep === 'property-form') {
        // Property form step
        setEstimateType('property-based');
      } else if (urlEstimateStep === 'direct-form') {
        // Direct form step
        setEstimateType('direct');
      }
      setTimeout(() => {
        isUpdatingFromUrlRef.current = false;
      }, 100);
    }
  }, [urlEstimateStep, defaultTab]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [estRes, amcRes, addRes, propRes, archivedRes, linksRes] = await Promise.all([
        fetch(`${API_BASE}/api/coordinator/estimates?archived=false`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/amc-packages`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/addons`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/estimates?archived=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/fp-portal-links`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [estData, amcData, addData, propData, archivedData, linksData] = await Promise.all([estRes.json(), amcRes.json(), addRes.json(), propRes.json(), archivedRes.json(), linksRes.json()]);
      const estArr = estData.success ? (Array.isArray(estData.data) ? estData.data : []) : [];
      const amcArr = amcData.success ? (Array.isArray(amcData.data) ? amcData.data : []) : [];
      const addArr = addData.success ? (Array.isArray(addData.data) ? addData.data : []) : [];
      const propArr = propData.success ? (Array.isArray(propData.data) ? propData.data : []) : [];
      const archArr = archivedData.success ? (Array.isArray(archivedData.data) ? archivedData.data : []) : [];
      const linksArr = linksData.success ? (Array.isArray(linksData.data) ? linksData.data : []) : [];
      setEstimates(estArr); setAmcPackages(amcArr); setAddons(addArr); setProperties(propArr); setArchivedEstimates(archArr);
      setStats({ estimates: estArr.length, amcPackages: amcArr.length, addons: addArr.length, archived: archArr.length });
      setFpPortalLinks(linksArr);
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  };

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };
    const formatCurrency = (amt) => { const num = parseFloat(amt); return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(isNaN(num) ? 0 : Math.round(num)); };

  // Edit estimate functions for DIRECT estimates only
  const openEditEstimate = (estimate) => {
    if (estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based') {
      showToast('Property-based estimates cannot be edited here', 'error');
      return;
    }
    let selectedAddonsWithQty = [];
    if (estimate.addons_data || estimate.addons) {
      try {
        const addonsData = estimate.addons || (typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data);
        selectedAddonsWithQty = (addonsData || []).map(a => ({ id: a.id || a.addon_id, quantity: a.quantity || 1 })).filter(a => a.id);
      } catch (e) { console.log('Addon parse error:', e); }
    }
    setEditEstimate(estimate);
    setEditEstimateForm({
      client_name: estimate.client_name || '',
      client_phone: estimate.client_phone || '',
      client_email: estimate.client_email || '',
      property_name: estimate.property_name || '',
      property_type: estimate.property_type || '',
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

  const handleUpdateEstimate = async () => {
    if (!editEstimate || !editEstimateForm) return;
    if (!editEstimateForm.client_name?.trim()) { showToast('Customer name is required', 'error'); return; }
    setSavingEstimate(true);
    try {
      const pkg = amcPackages.find(p => p.id == editEstimateForm.package_id);
      const pricing = calculateEditPricing();
      let packageServices = null;
      if (pkg && pkg.services) {
        packageServices = typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services;
      }
      const selectedAddonsList = (editEstimateForm.selectedAddons || []).map(item => {
        const addon = addons.find(a => a.id == item.id);
        return addon ? { id: addon.id, name: addon.service_name, description: addon.description || '', price: addon.price, frequency_type: addon.frequency_type, frequency_count: addon.frequency_count, quantity: item.quantity || 1 } : null;
      }).filter(Boolean);
      const payload = {
        client_name: editEstimateForm.client_name, client_phone: editEstimateForm.client_phone, client_email: editEstimateForm.client_email,
        property_name: editEstimateForm.property_name, property_type: editEstimateForm.property_type, zone: editEstimateForm.zone, city: editEstimateForm.city, address: editEstimateForm.address,
        package_id: editEstimateForm.package_id, package_name: pkg?.name || editEstimate.package_name, package_price: pkg?.price || editEstimate.package_price,
        amc_package_description: pkg?.description || editEstimate.amc_package_description, package_services: packageServices, billing_duration: pkg?.billing_duration || editEstimate.billing_duration,
        subtotal: pricing.subtotal, discount_percent: editEstimateForm.discount_percent, discount_amount: pricing.discountAmt,
        gst_percent: editEstimateForm.gst_percent, gst_amount: pricing.gstAmt, total_amount: pricing.total,
        addons_data: selectedAddonsList, description: editEstimateForm.description
      };
      const res = await fetch(`${API_BASE}/api/coordinator/estimates/${editEstimate.id}`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) { showToast('Estimate updated successfully'); setEditEstimate(null); setEditEstimateForm(null); loadData(); }
      else { showToast(result.message || 'Failed to update estimate', 'error'); }
    } catch (e) { console.error('Update estimate error:', e); showToast('Failed to update estimate', 'error'); }
    finally { setSavingEstimate(false); }
  };

  
  // Helper to compute total units based on property type
  const computeTotalUnits = (prop) => {
    const propType = (prop.property_type || prop.entryType || prop.entry_type || '').toUpperCase();
    if (propType === 'GC' || propType === 'GATED_COMMUNITY') {
      const upbData = prop.units_per_block || prop.unitsPerBlock;
      if (upbData) { try { const upb = typeof upbData === 'string' ? JSON.parse(upbData) : upbData; if (typeof upb === 'object' && upb !== null) { const total = Object.values(upb).reduce((sum, val) => sum + (parseInt(val) || 0), 0); if (total > 0) return total; } } catch (e) { /* ignore */ } }
    }
    if (propType === 'APT' || propType === 'APARTMENT') return prop.number_of_units || prop.total_units || prop.numberOfUnits || prop.totalUnits || null;
    if (['VILLA', 'VILLAS', 'FLAT', 'FLATS', 'PLOT', 'PLOTS'].includes(propType)) return 1;
    return prop.total_units || prop.totalUnits || prop.units || prop.number_of_units || null;
  };
  const getAddonId = (addon) => (addon.id ?? addon.addonId)?.toString();
  const getAddonName = (addon) => addon.service_name || addon.name || addon.serviceName || addon.services?.[0]?.name || 'Add-on Service';
  const getAddonPrice = (addon) => parseFloat(addon.price ?? addon.totalPrice ?? addon.services?.[0]?.price) || 0;
  const getPackagePrice = (pkg) => parseFloat(pkg?.price ?? pkg?.base_price ?? pkg?.totalPrice ?? pkg?.total_price ?? pkg?.rate ?? pkg?.total_rate) || 0;
  const getPackageServices = (pkg) => {
    let servicesData = pkg?.services || pkg?.services_data || pkg?.serviceRows;
    if (typeof servicesData === 'string') {
      try { servicesData = JSON.parse(servicesData); } catch (e) { return []; }
    }
    return servicesData?.serviceRows || servicesData?.services || (Array.isArray(servicesData) ? servicesData : []);
  };
  const getPackageBillingDuration = (pkg) => {
    let servicesData = pkg?.services || pkg?.services_data;
    if (typeof servicesData === 'string') {
      try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = {}; }
    }
    return servicesData?.billing_duration || pkg?.billing_duration || pkg?.billingDuration || 'monthly';
  };
  const getPackagePropertyType = (pkg) => {
    let servicesData = pkg?.services || pkg?.services_data;
    if (typeof servicesData === 'string') {
      try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = {}; }
    }
    return servicesData?.property_type || pkg?.property_type || pkg?.propertyType || '';
  };
  const getFrequencyVisits = (frequency) => FREQUENCY_COUNT_MAP?.[frequency] ?? parseInt(frequency) ?? 0;

  // CREATE ESTIMATE - State for new form
  const [selectedAmcPackage, setSelectedAmcPackage] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [gstPercent, setGstPercent] = useState('');
  
  // Direct Estimate form state
  const [directForm, setDirectForm] = useState({
    customerName: '',
    phone: '',
    countryCode: '+91',
    email: '',
    propertyType: '',
    propertyName: '',
    zone: '',
    city: '',
    address: '',
    numberOfBlocks: '',
    blockNumber: '',
    blockName: '',
    numberOfUnits: '',
    villaNumber: '',
    flatNumber: '',
    plotNumber: ''
  });

  // Calculate price summary
  const calculatePriceSummary = () => {
    let subTotal = 0;
    const pkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage);
    if (pkg) subTotal += getPackagePrice(pkg);
    selectedAddons.forEach(addonId => {
      const addon = addons.find(a => getAddonId(a) === addonId);
      if (addon) subTotal += getAddonPrice(addon);
    });
    const discountAmount = (subTotal * discountPercent) / 100;
    const afterDiscount = subTotal - discountAmount;
    const gstAmount = (afterDiscount * gstPercent) / 100;
    const totalAmount = afterDiscount + gstAmount;
    return { subTotal, discountAmount, gstAmount, totalAmount };
  };

  const priceSummary = calculatePriceSummary();

  const handleSaveEstimate = async () => {
    // Validation based on estimate type
    if (estimateType === 'property-based') {
      if (!propertyIdInput) { showToast('Enter Property ID', 'error'); return; }
    } else if (estimateType === 'direct') {
      if (!directForm.customerName) { showToast('Enter Customer Name', 'error'); return; }
      if (!directForm.phone || directForm.phone.length !== 10) { showToast('Enter valid 10-digit phone number', 'error'); return; }
    }
    if (!selectedAmcPackage) { showToast('Select AMC Package', 'error'); return; }
    
    try {
      const pkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage);
      const pkgPrice = pkg ? getPackagePrice(pkg) : 0;
      const pkgName = pkg?.name || pkg?.package_name || '';
      
      const payload = estimateType === 'direct' ? {
        estimate_type: 'direct',
        client_name: directForm.customerName,
        client_phone: `${directForm.countryCode || '+91'} ${directForm.phone}`,
        client_email: directForm.email,
        property_name: directForm.propertyName,
        property_type: directForm.propertyType,
        zone: directForm.zone,
        city: directForm.city,
        address: directForm.address,
        number_of_blocks: directForm.numberOfBlocks,
        block_names: directForm.blockNames ? JSON.stringify(directForm.blockNames) : null,
        units_per_block: directForm.unitsPerBlock ? JSON.stringify(directForm.unitsPerBlock) : null,
        block_unit_types: directForm.blockUnitTypes ? JSON.stringify(directForm.blockUnitTypes) : null,
        total_units: directForm.totalUnits,
        tower_name: directForm.towerName,
        block_number: directForm.blockNumber,
        villa_plot_number: directForm.plotNumber,
        package_id: selectedAmcPackage,
        package_name: pkgName,
        package_price: pkgPrice,
        billing_duration: getPackageBillingDuration(pkg) || 'yearly',
        addons: selectedAddons.map(id => { const a = addons.find(x => getAddonId(x) === id); return a ? { id: getAddonId(a), name: getAddonName(a), price: getAddonPrice(a) } : null; }).filter(Boolean),
        subtotal: priceSummary.subTotal,
        discount_percent: discountPercent,
        discount_amount: priceSummary.discountAmount,
        gst_percent: gstPercent,
        gst_amount: priceSummary.gstAmount,
        total_amount: priceSummary.totalAmount
      } : {
        estimate_type: 'property_based',
        property_id: propertyIdInput,
        property_code: selectedProperty?.property_id || propertyIdInput,
        property_name: selectedProperty?.name || selectedProperty?.community_name || '',
        property_type: selectedProperty?.property_type || '',
        client_name: selectedProperty?.contact_person || selectedProperty?.contact_name || '',
        client_phone: selectedProperty?.contact_phone || selectedProperty?.phone || '',
        client_email: selectedProperty?.contact_email || selectedProperty?.email || '',
        zone: selectedProperty?.zone_name || selectedProperty?.zone || '',
        city: selectedProperty?.city || '',
        address: selectedProperty?.address || '',
        division: selectedProperty?.division || '',
        number_of_blocks: selectedProperty?.number_of_blocks || selectedProperty?.blocks || 1,
        block_names: selectedProperty?.block_names || null,
        units_per_block: selectedProperty?.units_per_block || null,
        block_unit_types: selectedProperty?.block_unit_types || selectedProperty?.blockUnitTypes || null,
        total_units: selectedProperty?.total_units || selectedProperty?.units || selectedProperty?.number_of_units || 1,
        tower_name: selectedProperty?.tower_name || '',
        block_number: selectedProperty?.block_number || '',
        villa_plot_number: selectedProperty?.villa_plot_number || '',
        package_id: selectedAmcPackage,
        package_name: pkgName,
        package_price: pkgPrice,
        billing_duration: getPackageBillingDuration(pkg) || 'yearly',
        addons: selectedAddons.map(id => { const a = addons.find(x => getAddonId(x) === id); return a ? { id: getAddonId(a), name: getAddonName(a), price: getAddonPrice(a) } : null; }).filter(Boolean),
        subtotal: priceSummary.subTotal,
        discount_percent: discountPercent,
        discount_amount: priceSummary.discountAmount,
        gst_percent: gstPercent,
        gst_amount: priceSummary.gstAmount,
        total_amount: priceSummary.totalAmount
      };

      const res = await fetch(`${API_BASE}/api/coordinator/estimates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok || result.success) {
        showToast('Estimate created successfully!');
        resetEstimateForm();
        loadData();
        navigate('/coordinator/estimates');
      } else {
        showToast(result.message || 'Failed to create estimate', 'error');
      }
    } catch (e) {
      showToast('Failed to create estimate', 'error');
    }
  };

  // Reset all estimate form data
  const resetEstimateForm = () => {
    setEstimateType(null);
    setPropertyIdInput('');
    setSelectedProperty(null);
    setSelectedAmcPackage('');
    setSelectedAddons([]);
    setDiscountPercent('');
    setGstPercent('');
    setDirectForm({
      customerName: '', phone: '', email: '',
      propertyType: '', propertyName: '', zone: '', city: '', address: '',
      numberOfBlocks: 1, unitsPerBlock: {}, totalUnits: 0
    });
  };

  // Back navigation handler for estimate subsections
  const handleBackFromEstimate = useCallback(() => {
    if (estimateType === 'property-based' && selectedProperty) {
      // If property is selected, go back to property ID entry
      setSelectedProperty(null);
      setPropertyIdInput('');
      setSelectedAmcPackage('');
      setSelectedAddons([]);
      setDiscountPercent('');
      setGstPercent('');
    } else {
      // Otherwise go back to estimate type selection
      resetEstimateForm();
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

  // AMC Package and Price Summary shared component
  const renderAmcAndPriceSummary = (showSaveButton = false) => (
    <>
      {/* AMC Package Section */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">AMC Package</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select AMC Package <span className="text-red-500">*</span></label>
            <select
              value={selectedAmcPackage}
              onChange={(e) => setSelectedAmcPackage(e.target.value)}
              className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            >
              <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
              {(() => {
                const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType || directForm?.propertyType;
                const filteredPkgs = propertyType ? amcPackages.filter(pkg => matchPropertyType(getPackagePropertyType(pkg), propertyType)) : [];
                return (<>
                  {filteredPkgs.length > 0 && filteredPkgs.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(getPackagePrice(pkg))}</option>)}
                  {propertyType && filteredPkgs.length === 0 && <option disabled>No packages available for {propertyType}</option>}
                  {!propertyType && <option disabled>Select property type first</option>}
                </>);
              })()}
            </select>
          </div>
          {(() => {
            const pkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage);
            if (!pkg) return null;
            const services = getPackageServices(pkg);
            return (
              <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                <div className="px-5 py-3 flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">{decodeHtml(pkg.name)}</span>
                  <span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                </div>
                <table className="w-full text-sm bg-white">
                  <thead><tr className="border-y border-blue-100"><th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[12%]">Service</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[53%]">Description</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[20%]">Frequency</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[15%]">Visits</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{services.length > 0 ? services.map((svc, idx) => { const freqType = svc.frequencyType || svc.frequency_type || 'Monthly'; const hasDesc = svc.description && svc.description.trim() && svc.description.trim() !== '-'; return (<tr key={idx}><td className="px-3 py-2.5 text-gray-800">{decodeHtml(svc.service || svc.name) || '-'}</td><td className={`px-3 py-2.5 text-gray-600 text-center`}>{decodeHtml(svc.description)?.trim() || '-'}</td><td className="px-3 py-2.5 text-gray-600">{freqType}</td><td className="px-3 py-2.5 text-center text-gray-600">{svc.frequency_count ?? svc.frequencyCount ?? getFrequencyVisits(freqType)}</td></tr>); }) : <tr><td colSpan={4} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}</tbody>
                </table>
                <div className="px-5 py-3 bg-blue-50 border-t border-blue-100"><div className="flex justify-between items-center"><span className="text-sm font-semibold text-blue-700">Total Package Price</span><span className="text-lg font-bold text-gray-900">{formatCurrency(getPackagePrice(pkg))}</span></div><div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize whitespace-nowrap">{getPackageBillingDuration(pkg)?.replace('-', ' ')}</span></div></div>
              </div>
            );
          })()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Service from Add-ons</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedAddons([...selectedAddons, e.target.value]);
                }
                e.target.value = '';
              }}
              className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            >
              <option value="">+ Select Add-on to add</option>
              {(() => {
                // Get property type from selected property, direct form, or selected AMC package
                const selectedPkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage);
                const pkgPropertyType = selectedPkg?.property_type || getPackagePropertyType(selectedPkg);
                const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType || directForm?.propertyType || pkgPropertyType;
                if (!propertyType) return <option disabled>Select property type first</option>;
                const filteredAddons = addons.filter(addon => matchPropertyType(addon.property_type || addon.propertyType, propertyType));
                if (filteredAddons.length === 0) return <option disabled>No add-ons available for {propertyType}</option>;
                return filteredAddons.map(addon => <option key={getAddonId(addon)} value={getAddonId(addon)}>{getAddonName(addon)}</option>);
              })()}
            </select>
          </div>
          {selectedAddons.length > 0 && (
            <div className="border border-blue-200 rounded-xl overflow-hidden">
              <div className="bg-blue-50 px-5 py-2.5 border-b border-blue-200"><span className="text-sm font-semibold text-blue-700">Additional Services (Add-ons)</span></div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-blue-100 bg-white"><th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[10%]">Service</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[48%]">Description</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[18%]">Frequency</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[14%]">Visits</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[10%]">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-100 bg-white">{selectedAddons.map((addonId, idx) => { const addon = addons.find(a => getAddonId(a) === addonId); if (!addon) return null; const freqType = addon.frequency_type || addon.frequencyType || addon.services?.[0]?.frequencyType || 'Monthly'; return (<tr key={idx}><td className="px-3 py-2.5 text-gray-800">{getAddonName(addon)}</td><td className={`px-3 py-2.5 text-gray-600 text-center`}>{decodeHtml(addon.description) || '-'}</td><td className="px-3 py-2.5 text-center text-gray-600">{freqType}</td><td className="px-3 py-2.5 text-center text-gray-600">{addon.frequency_count ?? addon.frequencyCount ?? getFrequencyVisits(freqType)}</td><td className="px-3 py-2.5 text-center"><button onClick={() => setSelectedAddons(selectedAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>); })}</tbody>
                <tfoot className="bg-blue-50 border-t border-blue-200"><tr><td colSpan={4} className="px-5 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td><td className="px-5 py-2.5 text-right font-bold text-blue-700">{formatCurrency(selectedAddons.reduce((sum, id) => sum + getAddonPrice(addons.find(a => getAddonId(a) === id)), 0))}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Price Summary Section */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Price Summary</h2>
        </div>
        <div className="p-6">
          <div className="max-w-md ml-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Sub Total</span>
              <span className="font-medium text-gray-900">{formatCurrency(priceSummary.subTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Discount (%)</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1 border border-gray-300 rounded text-center" />
                <span className="text-gray-500">- {formatCurrency(priceSummary.discountAmount)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">GST (%)</span>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" value={gstPercent} onChange={(e) => setGstPercent(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-16 px-2 py-1 border border-blue-300 rounded text-center" placeholder="0" />
                <span className="text-gray-500">+ {formatCurrency(priceSummary.gstAmount)}</span>
              </div>
            </div>
            <div className="bg-gray-900 text-white rounded-lg p-4 flex items-center justify-between">
              <span className="font-medium">Total Amount</span>
              <span className="text-xl font-bold">{formatCurrency(priceSummary.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note & Buttons */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">* Currency: INR (ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹) | GST applied on total | Fields marked with * are mandatory | Direct estimates are saved to Archive section</p>
        <div className="flex gap-3">
          <button onClick={handleBackFromEstimate} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Back</button>
          {showSaveButton && (
            <button onClick={handleSaveEstimate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
          )}
        </div>
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
              : 'Direct Estimate Form'}
          </h2>
        </div>
      )}

      {/* FP Shared Resources Section - Read-only for employees, only show before selecting estimate type */}
      {!estimateType && fpPortalLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-5 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <FolderOpen className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">FP Shared Resources</h2>
                <p className="text-xs text-gray-500 mt-0.5">Quick access links from your Franchise Partner</p>
              </div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {fpPortalLinks.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-gray-300 transition-all group">
                <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{link.heading}</p>
                  <p className="text-xs text-gray-500 truncate">{link.url}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Type Selection */}
      {!estimateType && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Estimate Type</h2>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setEstimateType('property-based')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
              <Building2 className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-blue-600">Property-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
            </button>
            <button onClick={() => setEstimateType('direct')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group">
              <User className="w-10 h-10 text-gray-400 group-hover:text-amber-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-amber-600">Direct Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
            </button>
          </div>
        </div>
      )}

      {/* Property-Based Estimate */}
      {estimateType === 'property-based' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Estimate Details</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Property ID <span className="text-red-500">*</span></label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={propertyIdInput} onChange={(e) => { const v = e.target.value.trim(); setPropertyIdInput(v); const m = properties.find(p => p.property_id?.toLowerCase() === v.toLowerCase()); if (m) { const totalUnits = computeTotalUnits(m); setSelectedProperty({ ...m, total_units: totalUnits, units: totalUnits }); } else { setSelectedProperty(null); } }} placeholder="GC-DMMN-20260520" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
              </div>
              {selectedProperty && (
                <div className="mt-6 space-y-4">
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
                      <input type="text" value={selectedProperty.units || selectedProperty.total_units || selectedProperty.number_of_units || '1'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
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
                                <input type="text" value={blockNames?.[1] || blockNames?.['1'] || selectedProperty.block_name || selectedProperty.block_info || 'A'} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
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
                </div>
              )}
            </div>
          </div>
          {renderAmcAndPriceSummary(true)}
        </>
      )}

      {/* Direct Estimate */}
      {estimateType === 'direct' && (
        <>
          {/* Customer Information */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Customer Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" value={directForm.customerName} onChange={(e) => setDirectForm({...directForm, customerName: e.target.value})} placeholder="Enter customer name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone <span className="text-red-500">*</span></label>
                  <div className="flex w-full">
                    <select value={directForm.countryCode || '+91'} onChange={(e) => setDirectForm({...directForm, countryCode: e.target.value})} className="shrink-0 px-3 py-3 border border-gray-300 rounded-l-lg bg-gray-50 text-sm">
                      <option value="+91">+91</option>
                    </select>
                    <input type="tel" value={directForm.phone} maxLength={10} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setDirectForm({...directForm, phone: val}); }} placeholder="10-digit phone number" className="min-w-0 flex-1 px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input type="email" value={directForm.email} onChange={(e) => setDirectForm({...directForm, email: e.target.value})} placeholder="Enter email address" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Property Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Property Type <span className="text-red-500">*</span></label>
                  <select value={directForm.propertyType} onChange={(e) => setDirectForm({...directForm, propertyType: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200">
                    <option value="">Select Property Type</option>
                    {PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Property Name</label>
                  <input type="text" value={directForm.propertyName} onChange={(e) => setDirectForm({...directForm, propertyName: e.target.value})} placeholder="Enter property name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
                  <input type="text" value={directForm.zone} onChange={(e) => setDirectForm({...directForm, zone: e.target.value})} placeholder="Enter zone" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input type="text" value={directForm.city} onChange={(e) => setDirectForm({...directForm, city: e.target.value})} placeholder="Enter city" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input type="text" value={directForm.address} onChange={(e) => setDirectForm({...directForm, address: e.target.value})} placeholder="Enter full address" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
              </div>
              
              {/* Blocks & Units - Only for GC - Dynamic blocks */}
              {directForm.propertyType === 'gated_community' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">Block Details</h4>
                  <div className="mb-4 max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Blocks <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={directForm.numberOfBlocks} onChange={(e) => { const blocks = parseInt(e.target.value) || 1; setDirectForm({...directForm, numberOfBlocks: blocks, unitsPerBlock: {}}); }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: parseInt(directForm.numberOfBlocks) || 1 }, (_, i) => i + 1).map(blockNum => (
                      <React.Fragment key={blockNum}>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Block Name</label>
                          <input type="text" value={directForm.blockNames?.[blockNum] || ''} onChange={(e) => { const newBlockNames = {...(directForm.blockNames || {}), [blockNum]: e.target.value}; setDirectForm({...directForm, blockNames: newBlockNames}); }} placeholder={`Block ${blockNum}`} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Units <span className="text-red-500">*</span></label>
                          <input type="number" min="1" value={directForm.unitsPerBlock?.[blockNum] || ''} onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...(directForm.unitsPerBlock || {}), [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setDirectForm({...directForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }} placeholder="No. of units" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  {(directForm.totalUnits > 0 || directForm.numberOfUnits > 0) && (<div className="mt-3 p-2 bg-blue-100 rounded inline-block"><span className="text-sm text-blue-700 font-medium">Total Units: {directForm.totalUnits || directForm.numberOfUnits}</span></div>)}
                </div>
              )}

              {/* Apartment */}
              {directForm.propertyType === 'apartment' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tower/Building Name</label>
                    <input type="text" value={directForm.blockName || ''} onChange={(e) => setDirectForm({...directForm, blockName: e.target.value})} placeholder="Tower/Building name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Block Number</label>
                    <input type="text" value={directForm.blockNumber} onChange={(e) => setDirectForm({...directForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Units <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={directForm.numberOfUnits} onChange={(e) => setDirectForm({...directForm, numberOfUnits: e.target.value})} placeholder="Total units" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              )}

              {/* Villa */}
              {directForm.propertyType === 'villa' && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Villa Number <span className="text-red-500">*</span></label>
                    <input type="text" value={directForm.villaNumber} onChange={(e) => setDirectForm({...directForm, villaNumber: e.target.value})} placeholder="Enter villa number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              )}

              {/* Flat */}
              {directForm.propertyType === 'flat' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Flat Number <span className="text-red-500">*</span></label>
                    <input type="text" value={directForm.flatNumber} onChange={(e) => setDirectForm({...directForm, flatNumber: e.target.value})} placeholder="Enter flat number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              )}

              {/* Plot */}
              {directForm.propertyType === 'plot' && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plot Number <span className="text-red-500">*</span></label>
                    <input type="text" value={directForm.plotNumber} onChange={(e) => setDirectForm({...directForm, plotNumber: e.target.value})} placeholder="Enter plot number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {renderAmcAndPriceSummary(true)}
        </>
      )}

    </div>
  );

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
    let matchDate = true;
    if (filterFromDate || filterToDate) {
      const estDate = e.created_at ? new Date(e.created_at) : null;
      if (estDate) {
        if (filterFromDate && estDate < new Date(filterFromDate)) matchDate = false;
        if (filterToDate && estDate > new Date(filterToDate + 'T23:59:59')) matchDate = false;
      }
    }
    return matchSearch && matchStatus && matchType && matchCategory && matchDate;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterType, filterCategory, filterFromDate, filterToDate]);

  // Pagination calculations
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
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimate Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="all">All Estimates</option>
                  <option value="property_based">Property Based</option>
                  <option value="direct">Direct</option>
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
                  <input type="text" placeholder="dd/mm/yyyy" value={filterFromDateDisplay} onChange={(e) => { handleDateInput(e.target.value, setFilterFromDateDisplay); const parsed = parseISTDate(e.target.value); if (parsed) setFilterFromDate(parsed); }} onBlur={() => { const parsed = parseISTDate(filterFromDateDisplay); if (parsed) setFilterFromDate(parsed); else if (filterFromDateDisplay && filterFromDateDisplay.length < 10) setFilterFromDateDisplay(''); }} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm bg-white" />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilterFromDate(e.target.value); setFilterFromDateDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <div className="relative">
                  <input type="text" placeholder="dd/mm/yyyy" value={filterToDateDisplay} onChange={(e) => { handleDateInput(e.target.value, setFilterToDateDisplay); const parsed = parseISTDate(e.target.value); if (parsed) setFilterToDate(parsed); }} onBlur={() => { const parsed = parseISTDate(filterToDateDisplay); if (parsed) setFilterToDate(parsed); else if (filterToDateDisplay && filterToDateDisplay.length < 10) setFilterToDateDisplay(''); }} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm bg-white" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs">Estimate ID</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs">Client</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden sm:table-cell">Type</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden md:table-cell">Division</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs">Amount</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden md:table-cell">Status</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden lg:table-cell">Created By</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden lg:table-cell">Created</th><th className="px-3 py-3 text-center font-medium text-gray-600 whitespace-nowrap text-xs">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{paginatedEstimates.map((est) => <tr key={est.id} className="hover:bg-gray-50"><td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{est.estimate_id}</td><td className="px-3 py-3"><div className="font-medium text-gray-900 truncate max-w-[120px]">{est.client_name}</div>{est.property_code && <div className="text-xs text-gray-400">{est.property_code}</div>}</td><td className="px-3 py-3 whitespace-nowrap hidden sm:table-cell"><span className={`px-2 py-0.5 rounded text-xs font-medium ${est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'Property' : 'Direct'}</span></td><td className="px-3 py-3 text-gray-600 whitespace-nowrap hidden md:table-cell">{(est.estimate_type === 'property_based' || est.estimate_type === 'property-based') ? (est.division || est.property_division || '-') : '-'}</td><td className="px-3 py-3 font-semibold whitespace-nowrap">{formatCurrency(est.total_amount)}</td><td className="px-3 py-3 hidden md:table-cell"><span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${est.status === 'approved' ? 'bg-green-100 text-green-700' : est.status === 'rejected' ? 'bg-red-100 text-red-700' : est.status === 'sent' ? 'bg-blue-100 text-blue-700' : est.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{getStatusLabel(est.status)}</span></td><td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden lg:table-cell truncate max-w-[100px]">{est.created_by_name || (est.created_by_role ? est.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}</td><td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden lg:table-cell">{formatDateIST(est.created_at)}</td><td className="px-3 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewEstimate(est)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button>{(est.estimate_type === 'direct' || (est.estimate_type && !est.estimate_type.includes('property'))) && <button onClick={() => openEditEstimate(est)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>}</div></td></tr>)}</tbody>
            </table>
          </div>
        )}
        {/* Pagination Controls */}
        {!loading && filteredEstimates.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredEstimates.length)} of {filteredEstimates.length} estimates
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1))
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-2 text-gray-400">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${currentPage === page ? 'bg-indigo-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // AMC PACKAGES - Use getPackagePropertyType to correctly extract property type from services JSON
  const filteredAmcPackages = filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => matchPropertyType(getPackagePropertyType(p), filterPropertyType));
  const handleSaveAmcPackage = async () => {
    if (!amcForm.packageName.trim()) { showToast('Enter package name', 'error'); return; }
    if (!selectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!amcForm.price || parseFloat(amcForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    const validSvc = amcForm.serviceRows.filter(r => r.service.trim());
    if (validSvc.length === 0) { showToast('Add at least one service', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/coordinator/amc-packages`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: amcForm.packageName, property_type: selectedPropertyType, services: validSvc.map(r => ({ name: r.service, frequency_count: parseInt(r.frequencyCount) || 1, frequency_type: r.frequencyType })), price: parseFloat(amcForm.price), billing_duration: amcForm.billingDuration }) });
      const result = await res.json();
      if (res.ok || result.success) { showToast('AMC Package created!'); setAmcForm({ packageName: '', serviceRows: [{ service: '', frequencyCount: 12, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); loadData(); setAmcActiveTab('all-packages'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create package', 'error'); }
  };
  const handleDeleteAmcPackage = async (id) => { if (!window.confirm('Delete this package?')) return; try { const res = await fetch(`/api/coordinator/amc-packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleAddServiceRow = () => setAmcForm({ ...amcForm, serviceRows: [...amcForm.serviceRows, { service: '', frequencyCount: 12, frequencyType: 'Monthly' }] });
  const handleUpdateServiceRow = (i, f, v) => { const rows = [...amcForm.serviceRows]; if (f === 'frequencyType') { const auto = FREQUENCY_COUNT_MAP[v]; rows[i] = { ...rows[i], [f]: v, frequencyCount: auto !== null ? auto : '' }; } else rows[i][f] = v; setAmcForm({ ...amcForm, serviceRows: rows }); };
  const handleRemoveServiceRow = (i) => { if (amcForm.serviceRows.length > 1) setAmcForm({ ...amcForm, serviceRows: amcForm.serviceRows.filter((_, idx) => idx !== i) }); };

  const getPrice = () => parseFloat(amcForm.price) || 0;
  const resetAmcForm = () => { setAmcForm({ packageName: '', serviceRows: [{ service: '', frequencyCount: 12, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); };
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

      {/* Tabs - Create Package hidden for all managers */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
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
                const count = amcPackages.filter(p => matchPropertyType(getPackagePropertyType(p), type.id)).length;
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
              <p className="text-gray-500">No AMC packages available</p>
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
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Rate</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAmcPackages.map((pkg) => {
                    // Parse services JSON if it's a string, or use directly if object
                    let servicesData = pkg.services;
                    if (typeof servicesData === 'string') {
                      try { servicesData = JSON.parse(servicesData); } catch(e) { servicesData = null; }
                    }
                    // Extract service names from serviceRows array
                    const serviceRows = servicesData?.serviceRows || servicesData || [];
                    const servicesText = Array.isArray(serviceRows) 
                      ? serviceRows.map(s => s.name || s.service || 'Service').join(', ') 
                      : '-';
                    // Property type is inside services JSON, check there first
                    const propertyType = servicesData?.property_type || pkg.property_type || '-';
                    const billingDuration = pkg.billing_duration || servicesData?.billing_duration || 'monthly';
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
                        <td className="px-4 py-4 text-right">
                          <span className="text-lg font-bold text-slate-800">{formatCurrency(getPackagePrice(pkg))}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setViewAmcPackage({ ...pkg, servicesData, serviceRows, propertyType, billingDuration });
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" 
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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
                    <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-slate-50 rounded-lg mb-3">
                      <div className="col-span-5">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Visits</span>
                      </div>
                      <div className="col-span-1">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</span>
                      </div>
                    </div>

                    {/* Service Rows */}
                    <div className="space-y-3">
                      {amcForm.serviceRows.map((row, index) => (
                        <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {/* Service Name */}
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={row.service}
                              onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                              placeholder="e.g., Deep Cleaning"
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                            />
                          </div>
                          
                          {/* Frequency Type */}
                          <div className="col-span-3 relative">
                            <select
                              value={row.frequencyType}
                              onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-white appearance-none"
                            >
                              {FREQUENCY_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                          
                          {/* Frequency Count */}
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              value={row.frequencyCount}
                              readOnly
                              className="w-full px-3 py-2.5 border border-gray-300 bg-gray-100 rounded-lg text-sm cursor-not-allowed"
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
                        <label className="text-gray-600 text-xs mb-2 block font-medium">Price (ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹</span>
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
                          <span className="font-medium text-gray-800 truncate ml-2">{amcForm.packageName || 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Services</span>
                          <span className="font-medium text-gray-800">{amcForm.serviceRows.filter(r => r.service.trim()).length}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <span className="text-sm font-semibold text-gray-700">Total Rate</span>
                          <span className="text-2xl font-bold text-gray-800">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹{getPrice().toLocaleString()}</span>
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

  // ADDONS
  const filteredAddons = addonFilterPropertyType === 'all' ? addons : addons.filter(a => matchPropertyType(a.property_type, addonFilterPropertyType));
  const handleSaveAddon = async () => {
    if (!addonSelectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!addonForm.serviceName.trim()) { showToast('Enter service name', 'error'); return; }
    if (!addonForm.price || parseFloat(addonForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    try {
      const res = await fetch(`${API_BASE}/api/coordinator/addons`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ property_type: addonSelectedPropertyType, service_name: addonForm.serviceName, frequency_count: parseInt(addonForm.frequencyCount) || 1, frequency_type: addonForm.frequencyType, billing_cycle: addonForm.billingCycle, price: parseFloat(addonForm.price), description: addonForm.description || '' }) });
      const result = await res.json();
      if (res.ok || result.success) { showToast('Add-on created!'); setAddonForm({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' }); setAddonSelectedPropertyType(null); loadData(); setAddonActiveTab('all-addons'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create add-on', 'error'); }
  };
  const handleDeleteAddon = async (id) => { if (!window.confirm('Delete this add-on?')) return; try { const res = await fetch(`/api/coordinator/addons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };

  const renderAddons = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center"><PlusCircle className="w-5 h-5 text-stone-600" /></div><div><h2 className="text-xl font-bold text-gray-900">Add-ons</h2><p className="text-sm text-gray-500">View available add-ons for AMC packages</p></div></div>
      {/* Tabs - Create Add-on hidden for all managers */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setAddonActiveTab('all-addons')} className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${addonActiveTab === 'all-addons' ? 'bg-white text-stone-700 shadow-sm' : 'text-gray-600'}`}><Layers className="w-4 h-4" />All Add-ons{addons.length > 0 && <span className="px-1.5 py-0.5 bg-stone-600 text-white rounded-full text-xs">{addons.length}</span>}</button>
      </div>
      {addonActiveTab === 'create' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-base font-semibold text-gray-900 mb-2">Select Property Type</h3><p className="text-sm text-gray-500 mb-4">Choose the property type this package will be configured for</p><div className="grid grid-cols-5 gap-4">{PROPERTY_TYPE_OPTIONS.map(t => <button key={t.id} onClick={() => setAddonSelectedPropertyType(t.id)} className={`px-4 py-3 rounded-lg border text-sm font-medium text-center ${addonSelectedPropertyType === t.id ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>{t.label}</button>)}</div></div>
          {addonSelectedPropertyType && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-lg font-semibold text-gray-800">Create Add-on</h3><p className="text-sm text-gray-500">For: <span className="font-medium text-gray-700">{PROPERTY_TYPE_OPTIONS.find(t => t.id === addonSelectedPropertyType)?.label}</span></p></div>
              <div className="p-6">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Service Name</label><input type="text" value={addonForm.serviceName} onChange={(e) => setAddonForm({ ...addonForm, serviceName: e.target.value })} placeholder="Service name" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Frequency</label><select value={addonForm.frequencyType} onChange={(e) => { const v = e.target.value; const auto = FREQUENCY_COUNT_MAP[v]; setAddonForm({ ...addonForm, frequencyType: v, frequencyCount: auto !== null ? auto : '' }); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">{FREQUENCY_TYPES.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div className="col-span-1"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider whitespace-nowrap">Visits</label><input type="number" value={addonForm.frequencyCount} readOnly className="w-full px-2 py-2.5 border border-gray-300 bg-gray-100 rounded-lg text-sm text-center" /></div>
                  <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Period</label><select value={addonForm.billingCycle} onChange={(e) => setAddonForm({ ...addonForm, billingCycle: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Half-Yearly">Half-Yearly</option><option value="Yearly">Yearly</option></select></div>
                  <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Price (ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹</span><input type="text" value={addonForm.price} onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0" className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div></div>
                  <div className="col-span-2"><button onClick={handleSaveAddon} className="w-full px-4 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 font-medium flex items-center justify-center">Save</button></div>
                </div>
                <div className="mt-3"><input type="text" value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} placeholder="Add description/notes (optional)" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
            </div>
          )}
        </div>
      )}
      {addonActiveTab === 'all-addons' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-gray-900">All Add-ons</h3><p className="text-sm text-gray-500">{addons.length} add-on(s) available</p></div><div className="flex gap-2 flex-wrap"><button onClick={() => setAddonFilterPropertyType('all')} className={`px-3 py-1.5 text-sm rounded-lg ${addonFilterPropertyType === 'all' ? 'bg-stone-700 text-white' : 'bg-gray-100 text-gray-700'}`}>All{addons.length > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${addonFilterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{addons.length}</span>}</button>{PROPERTY_TYPE_OPTIONS.map(t => { const count = addons.filter(a => matchPropertyType(a.property_type, t.id)).length; return <button key={t.id} onClick={() => setAddonFilterPropertyType(t.id)} className={`px-3 py-1.5 text-sm rounded-lg ${addonFilterPropertyType === t.id ? 'bg-stone-700 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.label}{count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${addonFilterPropertyType === t.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>}</button>; })}</div></div></div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{filteredAddons.length === 0 ? <div className="py-16 text-center"><p className="text-gray-500">No add-ons found</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Add-on Name</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Property Type</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Frequency</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">No.of visits</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Total Rate</th><th className="px-4 py-3 text-center font-medium text-gray-600 uppercase text-xs">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredAddons.map(a => <tr key={a.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{decodeHtml(a.service_name)}</td><td className="px-4 py-3 text-gray-500">{getPropertyTypeLabel(a.property_type)}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.frequency_type === 'Monthly' ? 'bg-blue-100 text-blue-700' : a.frequency_type === 'Quarterly' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{a.frequency_type}</span></td><td className="px-4 py-3 text-gray-600">{a.frequency_count}x</td><td className="px-4 py-3 font-semibold">{formatCurrency(a.price)}</td><td className="px-4 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewAddon(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
        </div>
      )}
    </div>
  );

  // ARCHIVED
  const handleArchiveEstimate = async (id) => { try { const res = await fetch(`/api/coordinator/estimates/${id}/archive`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate archived'); loadData(); } } catch (e) { showToast('Failed to archive', 'error'); } };
  const handleRestoreEstimate = async (id) => { try { const res = await fetch(`/api/coordinator/estimates/${id}/restore`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate restored'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleDeletePermanent = async (id) => { try { const res = await fetch(`/api/coordinator/estimates/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted permanently'); setDeleteConfirm(null); loadData(); } } catch (e) { showToast('Failed', 'error'); } };

  const renderArchived = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{archivedEstimates.length === 0 ? <div className="py-16 text-center"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Division</th><th className="px-4 py-3 text-left font-medium text-gray-600">Client</th><th className="px-4 py-3 text-left font-medium text-gray-600">Archived On</th><th className="px-4 py-3 text-left font-medium text-gray-600">Total</th><th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{archivedEstimates.map(e => <tr key={e.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{e.estimate_id}</td><td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3 text-gray-600">{(e.estimate_type === 'property_based' || e.property_id) ? (e.division || '-') : '-'}</td><td className="px-4 py-3"><div className="font-medium text-gray-900">{e.client_name}</div>{e.property_code && <div className="text-xs text-gray-400">{e.property_code}</div>}</td><td className="px-4 py-3 text-gray-500">{formatDateIST(e.archived_at)}</td><td className="px-4 py-3 font-semibold">{formatCurrency(e.total_amount)}</td><td className="px-4 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewEstimate(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
      {deleteConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Permanently?</h3><p className="text-gray-600 mb-4">Are you sure you want to permanently delete estimate <strong>{deleteConfirm.estimate_id}</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button><button onClick={() => handleDeletePermanent(deleteConfirm.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button></div></div></div>}
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
      
      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-1 py-3">
            <button onClick={() => navigate('/coordinator/estimates')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <List className="w-4 h-4" />All Estimates
            </button>
            <button onClick={() => navigate('/coordinator/estimates/create')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Plus className="w-4 h-4" />Create Estimate
            </button>
            <button onClick={() => navigate('/coordinator/estimates/amc')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'amc' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Package className="w-4 h-4" />AMC Packages
            </button>
            <button onClick={() => navigate('/coordinator/estimates/addons')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'addons' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <PlusCircle className="w-4 h-4" />Add-ons
            </button>
            <button onClick={() => navigate('/coordinator/estimates/archived')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Archive className="w-4 h-4" />Archived
            </button>
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
              <button onClick={() => setViewEstimate(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
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
                  }`}>{getStatusLabel(viewEstimate.status)}</span>
                </div>
                <div><p className="text-xs text-gray-500">Type</p><p className="font-medium text-sm capitalize">{viewEstimate.estimate_type?.replace('_', ' ')}</p></div>
                <div><p className="text-xs text-gray-500">Created</p><p className="font-medium text-sm">{formatDateIST(viewEstimate.created_at)}</p></div>
              </div>

              {/* Property Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p>
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Property ID</p><p className="font-medium text-sm">{viewEstimate.property_code || viewEstimate.property_id || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Name</p><p className="font-medium text-sm">{viewEstimate.property_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Type</p><p className="font-medium text-sm">{viewEstimate.property_type || '-'}</p></div>
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
                  {/* Apartment-specific: Tower/Building Name, Block Number, Number of Units with Bedroom Counts */}
                  {['APT', 'apartment', 'Apartment'].includes(viewEstimate.property_type) && (
                    <>
                      {viewEstimate.tower_name && <div><p className="text-xs text-gray-500">Tower/Building Name</p><p className="font-medium text-sm">{viewEstimate.tower_name}</p></div>}
                      {viewEstimate.block_number && <div><p className="text-xs text-gray-500">Block Number</p><p className="font-medium text-sm">{viewEstimate.block_number}</p></div>}
                      <div><p className="text-xs text-gray-500">Number of Units</p><p className="font-medium text-sm">{viewEstimate.total_units || '-'}</p></div>
                      {(() => {
                        const blockUnitTypes = viewEstimate.block_unit_types ? (typeof viewEstimate.block_unit_types === 'string' ? JSON.parse(viewEstimate.block_unit_types) : viewEstimate.block_unit_types) : {};
                        const unitTypes = blockUnitTypes['apt'] || {};
                        const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                        if (!hasUnitTypes) return null;
                        const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };
                        return (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-gray-500 mb-2">Unit Type Breakdown</p>
                            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg">
                              {Object.entries(unitTypes).filter(([, count]) => count > 0).map(([type, count]) => (
                                <span key={type} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-sm rounded-full font-medium">
                                  {unitTypeLabels[type] || type}: {count}
                                </span>
                              ))}
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
                const pkgFromList = amcPackages.find(p => p.id == viewEstimate.package_id || p.name === viewEstimate.package_name);
                const pkgDescription = viewEstimate.amc_package_description || pkgFromList?.description || '';
                // Get services from estimate or from package lookup
                let pkgServices = [];
                if (viewEstimate.package_services) {
                  pkgServices = typeof viewEstimate.package_services === 'string' ? JSON.parse(viewEstimate.package_services) : viewEstimate.package_services;
                } else if (viewEstimate.packageServices) {
                  const svc = typeof viewEstimate.packageServices === 'string' ? JSON.parse(viewEstimate.packageServices) : viewEstimate.packageServices;
                  pkgServices = svc?.serviceRows || svc?.services || svc || [];
                } else if (pkgFromList?.services) {
                  const svc = typeof pkgFromList.services === 'string' ? JSON.parse(pkgFromList.services) : pkgFromList.services;
                  pkgServices = svc?.serviceRows || svc?.services || svc || [];
                }
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p>
                    {pkgDescription && (
                      <p className="text-sm text-gray-600 mb-3">{pkgDescription}</p>
                    )}
                    {/* Package Services - Horizontal Table */}
                    {pkgServices.length > 0 && (
                      <div className="mt-3">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-indigo-100 rounded-t-lg">
                          <div className="col-span-1 text-xs font-semibold text-indigo-700">#</div>
                          <div className="col-span-3 text-xs font-semibold text-indigo-700">Service</div>
                          <div className="col-span-4 text-xs font-semibold text-indigo-700">Description</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-center">Frequency</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-right">Visits</div>
                        </div>
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
                                <p className={`text-xs text-gray-500 break-words whitespace-normal text-center`}>{decodeHtml(svc.description)?.trim() || '-'}</p>
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
              {viewEstimate.addons && viewEstimate.addons.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add-on Services</p>
                  <div>
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-green-100 rounded-t-lg">
                      <div className="col-span-1 text-xs font-semibold text-green-700">#</div>
                      <div className="col-span-3 text-xs font-semibold text-green-700">Service</div>
                      <div className="col-span-4 text-xs font-semibold text-green-700">Description</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-center">Frequency</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-right">Visits</div>
                    </div>
                    <div className="border border-green-100 divide-y divide-green-50">
                      {viewEstimate.addons.map((addon, idx) => {
                        const addonName = decodeHtml(addon.name || addon.service_name) || '';
                        const estPropertyType = (viewEstimate.property_type || '').toUpperCase();
                        let addonFromList = addons.find(a => a.id == addon.id || a.id == addon.addon_id);
                        if (!addonFromList || !addonFromList.description) {
                          addonFromList = addons.find(a => 
                            (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                            (a.property_type || '').toUpperCase() === estPropertyType
                          ) || addonFromList;
                        }
                        const addonDescription = decodeHtml(addon.description || addonFromList?.description) || '';
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
                              <p className="text-xs text-gray-500 break-words whitespace-normal">{addonDescription || '-'}</p>
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
                    <div className="flex justify-between items-center bg-green-100 p-3 rounded-b-lg">
                      <p className="font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹{viewEstimate.addons.reduce((sum, a) => sum + Number(a.price || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Duration */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Billing</span>
                  <span className="font-medium capitalize">{viewEstimate.billing_duration ? viewEstimate.billing_duration.replace('-', ' ') : 'Yearly'}</span>
                </div>
              </div>

              {/* Price Summary */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Price Summary</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹{Number(viewEstimate.subtotal || 0).toLocaleString()}</span></div>
                  {viewEstimate.discount_amount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Discount ({viewEstimate.discount_percent || 0}%)</span><span>-ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹{Number(viewEstimate.discount_amount).toLocaleString()}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({viewEstimate.gst_percent || 0}%)</span><span>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹{Number(viewEstimate.gst_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-indigo-600">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹{Number(viewEstimate.total_amount || 0).toLocaleString()}</p>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => setViewAmcPackage(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-800">AMC Package Details</h3>
              <button onClick={() => setViewAmcPackage(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
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
                  <p className="font-bold text-xl text-green-600">{formatCurrency(getPackagePrice(viewAmcPackage))}</p>
                </div>
              </div>

              {/* Services Included */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Services Included</p>
                {viewAmcPackage.serviceRows && viewAmcPackage.serviceRows.length > 0 ? (
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
                    {viewAmcPackage.serviceRows.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center px-4 py-4 bg-blue-50/50 border-b border-blue-100 last:border-b-0">
                        <div className="col-span-1">
                          <span className="w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                        </div>
                        <div className="col-span-2 min-w-0">
                          <p className="font-medium text-gray-900 text-sm" style={{wordBreak: 'break-word'}}>{decodeHtml(svc.name || svc.service) || 'Service'}</p>
                        </div>
                        <div className="col-span-5">
                          <p className={`text-sm text-gray-600 text-center`}>
                            {decodeHtml(svc.description)?.trim() || '-'}
                          </p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-sm text-gray-700">{svc.frequency_type || svc.frequencyType || svc.frequency || 'Monthly'}</p>
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

      {/* View Add-on Modal */}
      {viewAddon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">Add-on Details</h3>
              <button onClick={() => setViewAddon(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                <p className="text-lg font-semibold text-green-900">{decodeHtml(viewAddon.service_name)}</p>
                <p className="text-sm text-green-600">{getPropertyTypeLabel(viewAddon.property_type)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Frequency</p>
                  <p className="font-medium">{viewAddon.frequency_type}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">No. of Visits</p>
                  <p className="font-medium">{viewAddon.frequency_count}x</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Billing Cycle</p>
                  <p className="font-medium">{viewAddon.billing_cycle || 'Monthly'}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="font-semibold text-green-700">{formatCurrency(viewAddon.price)}</p>
                </div>
              </div>
              {viewAddon.description && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-700">{decodeHtml(viewAddon.description)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Edit Estimate Modal - Direct Estimates Only */}
      {editEstimate && editEstimateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div><h3 className="text-lg font-semibold text-gray-800">Edit Direct Estimate</h3><p className="text-sm text-gray-500">{editEstimate.estimate_id}</p></div>
              <button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div><p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label><input type="text" value={editEstimateForm.client_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input type="text" value={editEstimateForm.client_phone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={editEstimateForm.client_email} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_email: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div></div></div>
              <div><p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{editEstimate.property_code && <div><label className="block text-xs font-medium text-gray-600 mb-1">Property ID</label><input type="text" value={editEstimate.property_code} readOnly disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" /></div>}<div><label className="block text-xs font-medium text-gray-600 mb-1">Property Name</label><input type="text" value={editEstimateForm.property_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, property_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Property Type</label><select value={editEstimateForm.property_type} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, property_type: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"><option value="">Select</option>{PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Zone</label><input type="text" value={editEstimateForm.zone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, zone: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div><div><label className="block text-xs font-medium text-gray-600 mb-1">City</label><input type="text" value={editEstimateForm.city} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, city: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" /></div></div></div>
              <div><p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p><select value={editEstimateForm.package_id || ''} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, package_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"><option value="">Select Package</option>{amcPackages.filter(p => !editEstimateForm.property_type || normalizePropertyType(getPackagePropertyType(p)) === normalizePropertyType(editEstimateForm.property_type)).map(pkg => (<option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>))}</select></div>
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

export default CoordinatorEstimates;