import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import { FileText, Plus, Search, RefreshCw, X, Save, AlertCircle, CheckCircle, Package, PlusCircle, Archive, List, Trash2, Eye, Layers, Edit, Calendar, Filter, Home, Building2, User, FolderOpen, ExternalLink, Link } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { exportEstimateToPDF } from '../utils/pdfExport';

const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'APT', label: 'Apartment' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'PLOT', label: 'Plot' },
];

// Format date in IST format (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '-';
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

const ExecutiveEstimates = ({ user, defaultTab = 'list' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEstimateStep = searchParams.get('estimateStep');
  
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
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Sync activeTab with defaultTab when route changes
  useEffect(() => { setActiveTab(defaultTab); }, [defaultTab]);
  
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [archivedTypeFilter, setArchivedTypeFilter] = useState('all');
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('estimate');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filterPropertyType, setFilterPropertyType] = useState('all');
  const [addonFilterPropertyType, setAddonFilterPropertyType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [estimateTypeFilter, setEstimateTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromDateDisplay, setFromDateDisplay] = useState('');
  const [toDateDisplay, setToDateDisplay] = useState('');
  const clearAllFilters = () => { setEstimateTypeFilter('all'); setStatusFilter('all'); setCategoryFilter('all'); setFromDate(''); setToDate(''); setFromDateDisplay(''); setToDateDisplay(''); setSearchTerm(''); };
  const [fpPortalLinks, setFpPortalLinks] = useState([]);

  const [estimateForm, setEstimateForm] = useState({ clientId: '', propertyId: '', title: '', description: '', estimateType: '', subtotal: 0, taxPercentage: 18, discountPercentage: 0, validUntil: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
  const [amcForm, setAmcForm] = useState({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true });
  const [addonForm, setAddonForm] = useState({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true });
  
  // Property-based estimate state (like Manager)
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedAmcPackage, setSelectedAmcPackage] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');
  const [gstPercent, setGstPercent] = useState('');
  const [viewEstimate, setViewEstimate] = useState(null);
  const [editEstimate, setEditEstimate] = useState(null);
  const [editEstimateForm, setEditEstimateForm] = useState(null);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [viewAmcPackage, setViewAmcPackage] = useState(null);
  
  // Direct estimate form
  const [directForm, setDirectForm] = useState({ customerName: '', phone: '', countryCode: '+91', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', numberOfBlocks: '', blockNumber: '', blockName: '', numberOfUnits: '', villaNumber: '', flatNumber: '', plotNumber: '' });

  // Helper functions (must be defined before calculatePriceSummary)
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
    const addonsPrice = (editEstimateForm.selectedAddons || []).reduce((sum, id) => {
      const addon = addons.find(a => a.id == id);
      return sum + (parseFloat(addon?.price) || 0);
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
      const selectedAddonsList = (editEstimateForm.selectedAddons || []).map(id => {
        const addon = addons.find(a => a.id == id);
        return addon ? { id: addon.id, name: addon.service_name, description: addon.description || '', price: addon.price, frequency_type: addon.frequency_type, frequency_count: addon.frequency_count } : null;
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
      const res = await fetch(`${API_BASE}/api/executive/estimates/${editEstimate.id}`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) { showToast('Estimate updated successfully'); setEditEstimate(null); setEditEstimateForm(null); loadData(); }
      else { showToast(result.message || 'Failed to update estimate', 'error'); }
    } catch (e) { console.error('Update estimate error:', e); showToast('Failed to update estimate', 'error'); }
    finally { setSavingEstimate(false); }
  };

  const getAddonId = (addon) => (addon.id ?? addon.addonId)?.toString();
  const getAddonName = (addon) => addon.service_name || addon.name || addon.serviceName || addon.services?.[0]?.name || 'Add-on Service';
  const getAddonPrice = (addon) => parseFloat(addon.price ?? addon.totalPrice ?? addon.services?.[0]?.price) || 0;
  const getPackagePrice = (pkg) => parseFloat(pkg?.price ?? pkg?.base_price ?? pkg?.totalPrice ?? pkg?.total_price ?? pkg?.rate ?? pkg?.total_rate) || 0;

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

  // Reset estimate form
  const resetEstimateForm = () => {
    setEstimateForm({ ...estimateForm, estimateType: '' });
    setPropertyIdInput('');
    setSelectedProperty(null);
    setSelectedAmcPackage('');
    setSelectedAddons([]);
    setDiscountPercent(0);
    setDirectForm({ customerName: '', phone: '', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '' });
  };

  // Back navigation handler for estimate subsections
  const handleBackFromEstimate = () => {
    if (estimateForm.estimateType === 'property_based' && selectedProperty) {
      // If property is selected, go back to property ID entry
      setSelectedProperty(null);
      setPropertyIdInput('');
      setSelectedAmcPackage('');
      setSelectedAddons([]);
      setDiscountPercent(0);
    } else {
      // Otherwise go back to estimate type selection
      resetEstimateForm();
    }
  };

  // Save estimate
  const handleSaveEstimate = async () => {
    const authToken = getAuthToken();
    if (estimateForm.estimateType === 'property_based' && !propertyIdInput) {
      setMessage({ type: 'error', text: 'Enter Property ID' }); return;
    }
    if (estimateForm.estimateType === 'direct') {
      if (!directForm.customerName) { setMessage({ type: 'error', text: 'Enter Customer Name' }); return; }
      if (!directForm.phone || directForm.phone.length !== 10) { setMessage({ type: 'error', text: 'Enter valid 10-digit phone' }); return; }
    }
    if (!selectedAmcPackage) {
      setMessage({ type: 'error', text: 'Select AMC Package' }); return;
    }
    try {
      const payload = {
          estimate_type: estimateForm.estimateType,
          property_id: propertyIdInput,
          property_code: selectedProperty?.property_id,
          client_name: selectedProperty?.contact_person || selectedProperty?.name || directForm.customerName,
          client_phone: selectedProperty?.contact_phone || `${directForm.countryCode || '+91'} ${directForm.phone}`,
          client_email: selectedProperty?.contact_email || directForm.email,
          property_name: selectedProperty?.name || directForm.propertyName,
          property_type: selectedProperty?.property_type || directForm.propertyType,
          zone: selectedProperty?.zone_name || selectedProperty?.zoneName || selectedProperty?.zone || directForm.zone,
          city: selectedProperty?.city || directForm.city,
          address: selectedProperty?.address || directForm.address,
          division: selectedProperty?.division || '',
          number_of_blocks: selectedProperty?.number_of_blocks || selectedProperty?.numberOfBlocks || 1,
          block_names: selectedProperty?.block_names || selectedProperty?.blockNames || null,
          units_per_block: selectedProperty?.units_per_block || selectedProperty?.unitsPerBlock || null,
          block_unit_types: selectedProperty?.block_unit_types || selectedProperty?.blockUnitTypes || null,
          total_units: selectedProperty?.total_units || selectedProperty?.units || selectedProperty?.number_of_units || directForm.numberOfUnits || null,
          tower_name: selectedProperty?.tower_name || '',
          block_number: selectedProperty?.block_number || '',
          villa_plot_number: selectedProperty?.villa_plot_number || '',
          package_id: selectedAmcPackage,
          package_name: amcPackages.find(p => p.id?.toString() === selectedAmcPackage)?.name || '',
          package_price: getPackagePrice(amcPackages.find(p => p.id?.toString() === selectedAmcPackage)),
          addons: selectedAddons.map(id => addons.find(a => getAddonId(a) === id)).filter(Boolean),
          subtotal: priceSummary.subTotal,
          discount_percent: discountPercent,
          discount_amount: priceSummary.discountAmount,
          gst_percent: gstPercent,
          gst_amount: priceSummary.gstAmount,
          total_amount: priceSummary.totalAmount
      };
      console.log('Saving estimate payload:', payload);
      const res = await fetch(`${API_BASE}/api/executive/estimates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('API Error:', res.status, errText);
        setMessage({ type: 'error', text: `API Error ${res.status}: ${errText}` });
        return;
      }
      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Estimate created successfully!' });
        resetEstimateForm();
        setActiveTab('list');
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to create estimate' });
      }
    } catch (e) {
      console.error('Estimate save error:', e);
      setMessage({ type: 'error', text: 'Failed to create estimate: ' + e.message });
    }
  };

  const token = getAuthToken();

  const tabs = [
    { id: 'list', label: 'All Estimates', icon: List },
    { id: 'create', label: 'Create Estimate', icon: Plus },
    { id: 'amc', label: 'AMC Packages', icon: Package },
    { id: 'addons', label: 'Add-ons', icon: PlusCircle },
    { id: 'archived', label: 'Archived', icon: Archive }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [estRes, archivedRes, amcRes, addRes, custRes, propRes, catRes, linksRes] = await Promise.all([
        fetch(`${API_BASE}/api/executive/estimates?archived=false`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/estimates?archived=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/amc-packages`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/addons`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/customers`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/fp-portal-links`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [estData, archivedData, amcData, addData, custData, propData, catData, linksData] = await Promise.all([estRes.json(), archivedRes.json(), amcRes.json(), addRes.json(), custRes.json(), propRes.json(), catRes.json(), linksRes.json()]);
      if (estData.success) setEstimates(estData.data || []);
      if (archivedData.success) setArchivedEstimates(archivedData.data || []);
      if (amcData.success) setAmcPackages(amcData.data || []);
      if (addData.success) setAddons(addData.data || []);
      if (custData.success) setCustomers(custData.data || []);
      if (propData.success) setProperties(propData.data || []);
      if (catData.success) setCategories(catData.data || []);
      if (linksData.success) setFpPortalLinks(linksData.data || []);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  // Sync estimate creation step with URL for browser back button support
  useEffect(() => {
    if (defaultTab === 'create') {
      if (estimateForm.estimateType === 'property_based' && selectedProperty) {
        updateUrlParam('estimateStep', 'property-form');
      } else if (estimateForm.estimateType === 'property_based') {
        updateUrlParam('estimateStep', 'property-id');
      } else if (estimateForm.estimateType === 'direct') {
        updateUrlParam('estimateStep', 'direct-form');
      } else {
        updateUrlParam('estimateStep', '');
      }
    }
  }, [estimateForm.estimateType, selectedProperty, defaultTab, updateUrlParam]);

  // Handle browser back button - sync URL to state
  useEffect(() => {
    if (defaultTab === 'create') {
      if (!urlEstimateStep) {
        // No step in URL = type selection
        if (estimateForm.estimateType) {
          setEstimateForm(prev => ({ ...prev, estimateType: '' }));
          setSelectedProperty(null);
          setPropertyIdInput('');
        }
      } else if (urlEstimateStep === 'property-id') {
        // Property ID entry step
        if (estimateForm.estimateType !== 'property_based' || selectedProperty !== null) {
          setEstimateForm(prev => ({ ...prev, estimateType: 'property_based' }));
          setSelectedProperty(null);
          setPropertyIdInput('');
        }
      } else if (urlEstimateStep === 'property-form') {
        // Property form step - keep current state if already there
        if (estimateForm.estimateType !== 'property_based') {
          setEstimateForm(prev => ({ ...prev, estimateType: 'property_based' }));
        }
      } else if (urlEstimateStep === 'direct-form') {
        // Direct form step
        if (estimateForm.estimateType !== 'direct') {
          setEstimateForm(prev => ({ ...prev, estimateType: 'direct' }));
        }
      }
    }
  }, [urlEstimateStep, defaultTab]);

  const handleEstimateSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    try {
      const response = await fetch(`${API_BASE}/api/executive/estimates`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...estimateForm, subtotal, items: estimateForm.items.map(item => ({ ...item, totalPrice: item.quantity * item.unitPrice })) })
      });
      const result = await response.json();
      if (response.ok || result.success) { setMessage({ type: 'success', text: 'Estimate created successfully!' }); resetEstimateForm(); fetchData(); setActiveTab('list'); }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create estimate' }); }
  };

  const handleAmcSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/executive/amc-packages`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...amcForm, services: amcForm.services.split(',').map(s => s.trim()).filter(Boolean) })
      });
      const result = await response.json();
      if (response.ok || result.success) { setMessage({ type: 'success', text: 'AMC Package created successfully!' }); setShowModal(false); resetAmcForm(); fetchData(); }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create AMC package' }); }
  };

  const handleAddonSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${API_BASE}/api/executive/addons`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(addonForm)
      });
      const result = await response.json();
      if (response.ok || result.success) { setMessage({ type: 'success', text: 'Add-on created successfully!' }); setShowModal(false); resetAddonForm(); fetchData(); }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create add-on' }); }
  };

  const resetAmcForm = () => { setAmcForm({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true }); };
  const resetAddonForm = () => { setAddonForm({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true }); };

  const addLineItem = () => { setEstimateForm({ ...estimateForm, items: [...estimateForm.items, { description: '', quantity: 1, unitPrice: 0 }] }); };
  const removeLineItem = (index) => { if (estimateForm.items.length > 1) setEstimateForm({ ...estimateForm, items: estimateForm.items.filter((_, i) => i !== index) }); };
  const updateLineItem = (index, field, value) => { const updatedItems = [...estimateForm.items]; updatedItems[index][field] = value; setEstimateForm({ ...estimateForm, items: updatedItems }); };

  const getStatusColor = (status) => { const colors = { draft: 'bg-gray-100 text-gray-700', pending_approval: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', converted: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-500' }; return colors[status] || 'bg-gray-100 text-gray-700'; };
  const calculateTotals = () => { const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0); const tax = (subtotal * estimateForm.taxPercentage) / 100; const discount = (subtotal * estimateForm.discountPercentage) / 100; return { subtotal, tax, discount, total: subtotal + tax - discount }; };
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
  const getFrequencyVisits = (frequency) => ({ Monthly: 12, 'Every 2 Months': 6, Quarterly: 4, 'Half-Yearly': 2, Yearly: 1 }[frequency]) || parseInt(frequency) || 12;
  
  // Helper to compute total units based on property type
  const computeTotalUnits = (prop) => {
    const propType = (prop.property_type || prop.entryType || prop.entry_type || '').toUpperCase();
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
    if (propType === 'APT' || propType === 'APARTMENT') return prop.number_of_units || prop.total_units || prop.numberOfUnits || prop.totalUnits || null;
    if (['VILLA', 'VILLAS', 'FLAT', 'FLATS', 'PLOT', 'PLOTS'].includes(propType)) return 1;
    return prop.total_units || prop.totalUnits || prop.units || prop.number_of_units || null;
  };

  const getPackageServicesText = (pkg) => {
    let servicesData = pkg.services || pkg.services_data || pkg.serviceRows;
    if (typeof servicesData === 'string') {
      try { servicesData = JSON.parse(servicesData); } catch (e) { return servicesData || '-'; }
    }
    const serviceRows = servicesData?.serviceRows || servicesData || [];
    return Array.isArray(serviceRows) ? serviceRows.map(s => s.name || s.service || 'Service').join(', ') : '-';
  };
  const getBillingBadgeColor = (billing) => {
    switch (billing) {
      case 'monthly': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'quarterly': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'half-yearly': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'yearly': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const renderAmcAndPriceSummary = (showSaveButton = false) => (
    <>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">AMC Package</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select AMC Package <span className="text-red-500">*</span></label>
            <select value={selectedAmcPackage} onChange={(e) => setSelectedAmcPackage(e.target.value)} className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500">
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
                  <span className="font-semibold text-gray-900">{pkg.name}</span>
                  <span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                </div>
                <table className="w-full text-sm bg-white">
                  <thead><tr className="border-y border-blue-100"><th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[12%]">Service</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[53%]">Description</th><th className="px-3 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase w-[20%]">Frequency</th><th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase w-[15%]">Visits</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{services.length > 0 ? services.map((svc, idx) => { const freqType = svc.frequencyType || svc.frequency_type || 'Monthly'; const hasDesc = svc.description && svc.description.trim() && svc.description.trim() !== '-'; return (<tr key={idx}><td className="px-3 py-2.5 text-gray-800">{decodeHtml(svc.service || svc.name) || '-'}</td><td className={`px-3 py-2.5 text-gray-600 text-center`}>{svc.description?.trim() || '-'}</td><td className="px-3 py-2.5 text-gray-600">{freqType}</td><td className="px-3 py-2.5 text-center text-gray-600">{svc.frequencyCount || svc.frequency_count || getFrequencyVisits(freqType)}</td></tr>); }) : <tr><td colSpan={4} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}</tbody>
                </table>
                <div className="px-5 py-3 bg-blue-50 border-t border-blue-100"><div className="flex justify-between items-center"><span className="text-sm font-semibold text-blue-700">Total Package Price</span><span className="text-lg font-bold text-gray-900">{formatCurrency(getPackagePrice(pkg))}</span></div><div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize whitespace-nowrap">{getPackageBillingDuration(pkg)?.replace('-', ' ')}</span></div></div>
              </div>
            );
          })()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Service from Add-ons</label>
            <select onChange={(e) => { if (e.target.value) setSelectedAddons([...selectedAddons, e.target.value]); e.target.value = ''; }} className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500">
              <option value="">+ Select Add-on to add</option>
              {(() => {
                const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType || directForm?.propertyType;
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
                <tbody className="divide-y divide-gray-100 bg-white">{selectedAddons.map((addonId, idx) => { const addon = addons.find(a => getAddonId(a) === addonId); if (!addon) return null; const freqType = addon.frequency_type || addon.frequencyType || addon.services?.[0]?.frequencyType || 'Monthly'; return (<tr key={idx}><td className="px-3 py-2.5 text-gray-800">{getAddonName(addon)}</td><td className={`px-3 py-2.5 text-gray-600 text-center`}>{addon.description || '-'}</td><td className="px-3 py-2.5 text-center text-gray-600">{freqType}</td><td className="px-3 py-2.5 text-center text-gray-600">{addon.frequency_count || addon.frequencyCount || getFrequencyVisits(freqType)}</td><td className="px-3 py-2.5 text-center"><button onClick={() => setSelectedAddons(selectedAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>); })}</tbody>
                <tfoot className="bg-blue-50 border-t border-blue-200"><tr><td colSpan={4} className="px-5 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td><td className="px-5 py-2.5 text-right font-bold text-blue-700">{formatCurrency(selectedAddons.reduce((sum, id) => sum + getAddonPrice(addons.find(a => getAddonId(a) === id)), 0))}</td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

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

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">* Currency: INR (ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹) | GST applied on total | Fields marked with * are mandatory | Direct estimates are saved to Archive section</p>
        <div className="flex gap-3">
          <button onClick={handleBackFromEstimate} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Back</button>
          {showSaveButton && <button onClick={handleSaveEstimate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>}
        </div>
      </div>
    </>
  );

  const filteredEstimates = estimates.filter(e => {
    const matchSearch = !searchTerm || e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.estimate_id?.toLowerCase().includes(searchTerm.toLowerCase()) || e.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = estimateTypeFilter === 'all' || e.estimate_type === estimateTypeFilter;
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    // Property category filter should work for ALL estimates that have a property_type (both direct and property-based)
    const matchCategory = categoryFilter === 'all' || (e.property_type && normalizePropertyType(e.property_type) === categoryFilter);
    // Date filter
    let matchDate = true;
    if (fromDate || toDate) {
      const estDate = e.created_at ? new Date(e.created_at) : null;
      if (estDate) {
        if (fromDate && estDate < new Date(fromDate)) matchDate = false;
        if (toDate && estDate > new Date(toDate + 'T23:59:59')) matchDate = false;
      }
    }
    return matchSearch && matchType && matchStatus && matchCategory && matchDate;
  });

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Estimates / AMC Management</h1><p className="text-gray-500 mt-1">Create estimates and view AMC packages</p></div>
        <div className="flex items-center gap-4">
          <button onClick={fetchData} className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-center"><p className="text-xl font-bold text-gray-900">{filteredEstimates.length}</p><p className="text-xs text-gray-500">Active Estimates</p></div>
          <div className="text-center"><p className="text-xl font-bold text-gray-900">{amcPackages.length}</p><p className="text-xs text-gray-500">AMC Packages</p></div>
          <div className="text-center"><p className="text-xl font-bold text-gray-900">{addons.length}</p><p className="text-xs text-gray-500">Add-ons</p></div>
          <div className="text-center"><p className="text-xl font-bold text-gray-900">{archivedEstimates.length}</p><p className="text-xs text-gray-500">Archived</p></div>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-1 flex items-center gap-1">
        <button onClick={() => navigate('/executive/estimates')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <List className="w-4 h-4" />All Estimates
        </button>
        <button onClick={() => navigate('/executive/estimates/create')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Plus className="w-4 h-4" />Create Estimate
        </button>
        <button onClick={() => navigate('/executive/estimates/amc')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'amc' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Package className="w-4 h-4" />AMC Packages
        </button>
        <button onClick={() => navigate('/executive/estimates/addons')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'addons' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <PlusCircle className="w-4 h-4" />Add-ons
        </button>
        <button onClick={() => navigate('/executive/estimates/archived')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Archive className="w-4 h-4" />Archived
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
      ) : (
        <>
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search estimates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.trim())} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" /></div>
                <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg border font-medium flex items-center gap-2 ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><Filter className="w-4 h-4" />Filters</button>
              </div>
              {showFilters && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">Estimate Type</label><select value={estimateTypeFilter} onChange={(e) => setEstimateTypeFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="all">All Estimates</option><option value="property_based">Property Based</option><option value="direct">Direct</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="all">All Statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">Property Category</label><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="all">All Categories</option>{PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">From Date</label><input type="text" placeholder="dd/mm/yyyy" value={fromDateDisplay} onChange={(e) => { handleDateInput(e.target.value, setFromDateDisplay); const parsed = parseISTDate(e.target.value); if (parsed) setFromDate(parsed); }} onBlur={() => { const parsed = parseISTDate(fromDateDisplay); if (parsed) setFromDate(parsed); else if (fromDateDisplay && fromDateDisplay.length < 10) setFromDateDisplay(''); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">To Date</label><input type="text" placeholder="dd/mm/yyyy" value={toDateDisplay} onChange={(e) => { handleDateInput(e.target.value, setToDateDisplay); const parsed = parseISTDate(e.target.value); if (parsed) setToDate(parsed); }} onBlur={() => { const parsed = parseISTDate(toDateDisplay); if (parsed) setToDate(parsed); else if (toDateDisplay && toDateDisplay.length < 10) setToDateDisplay(''); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                  </div>
                  <button onClick={clearAllFilters} className="text-sm text-blue-600 hover:underline">Clear all filters</button>
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {filteredEstimates.length === 0 ? (
                  <div className="text-center py-12"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No estimates found</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimate ID</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Division</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th><th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEstimates.map((estimate) => {
                          const TypeIcon = estimate.property_type === 'Apt' ? Home : Building2;
                          return (
                            <tr key={estimate.id} className="hover:bg-gray-50">
                              <td className="py-4 px-4"><span className="font-medium text-gray-900">{estimate.estimate_id || `EST-${estimate.id}`}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-gray-400" /><span className={`px-2 py-0.5 text-xs font-medium rounded ${estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'Property' : 'Direct'}</span></div></td>
                              <td className="py-4 px-4"><span className="text-gray-600">{(estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based') ? (estimate.division || estimate.property_division || '-') : '-'}</span></td>
                              <td className="py-4 px-4"><span className="text-gray-700">{estimate.client_name || '-'}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-1.5 text-gray-600"><Calendar className="w-4 h-4" />{formatDateIST(estimate.created_at)}</div></td>
                              <td className="py-4 px-4"><div><p className="font-medium text-gray-900">{estimate.created_by_name || (estimate.created_by_role ? estimate.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}</p>{estimate.created_by_name && estimate.created_by_role && <p className="text-xs text-gray-400 capitalize">{estimate.created_by_role.replace(/_/g, ' ')}</p>}</div></td>
                              <td className="py-4 px-4"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(estimate.status)}`}>{estimate.status?.charAt(0).toUpperCase() + estimate.status?.slice(1) || 'Draft'}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center justify-center gap-1"><button onClick={() => setViewEstimate(estimate)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>{(estimate.estimate_type === 'direct' || (estimate.estimate_type && !estimate.estimate_type.includes('property'))) && <button onClick={() => openEditEstimate(estimate)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>}</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'archived' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {archivedEstimates.length === 0 ? (
                  <div className="text-center py-16"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Client</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Archived On</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Total</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {archivedEstimates.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{e.estimate_id || `EST-${e.id}`}</td>
                          <td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td>
                          <td className="px-4 py-3">{e.client_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDateIST(e.archived_at)}</td>
                          <td className="px-4 py-3 font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(e.total_amount || 0)}</td>
                          <td className="px-4 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewEstimate(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* FP Shared Resources Section - Read-only for employees, only show before selecting estimate type */}
              {!estimateForm.estimateType && fpPortalLinks.length > 0 && (
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
              {!estimateForm.estimateType && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Estimate Type</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'property_based' })} className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
                      <Building2 className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mx-auto mb-3" />
                      <p className="font-semibold text-gray-800 group-hover:text-blue-600">Property-Based Estimate</p>
                      <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
                    </button>
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'direct' })} className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
                      <User className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mx-auto mb-3" />
                      <p className="font-semibold text-gray-800 group-hover:text-blue-600">Direct Estimate</p>
                      <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Property-Based Estimate */}
              {estimateForm.estimateType === 'property_based' && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-semibold text-gray-900">Estimate Details</h2>
                      <button onClick={handleBackFromEstimate} className="text-sm text-gray-500 hover:text-gray-700">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Back</button>
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
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Contact Name</label><input type="text" value={selectedProperty.contact_person || selectedProperty.contact_name || selectedProperty.customer_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Property ID</label><input type="text" value={selectedProperty.property_id || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Entry Type</label><input type="text" value={selectedProperty.entry_type || selectedProperty.property_type?.substring(0,2).toUpperCase() || 'GC'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Zone</label><input type="text" value={selectedProperty.zone_name || selectedProperty.zoneName || selectedProperty.zone || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Area</label><input type="text" value={selectedProperty.area || selectedProperty.area_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                          </div>
                          <div className="grid grid-cols-4 gap-4">
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Community Name</label><input type="text" value={selectedProperty.name || selectedProperty.community_name || selectedProperty.property_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Property Type</label><input type="text" value={selectedProperty.property_type || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Units</label><input type="text" value={selectedProperty.units || selectedProperty.total_units || selectedProperty.number_of_units || '1'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">City</label><input type="text" value={selectedProperty.city || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Address</label><input type="text" value={selectedProperty.address || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Contact Phone</label><input type="text" value={selectedProperty.contact_phone || selectedProperty.phone || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Contact Email</label><input type="text" value={selectedProperty.contact_email || selectedProperty.email || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                          </div>

                          {/* Unit Details - Property Type Specific */}
                          <div className="bg-slate-50 rounded-lg p-4 mt-4">
                            <div className="flex items-center gap-2 mb-3">
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
              {estimateForm.estimateType === 'direct' && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-semibold text-gray-900">Customer Information</h2>
                      <button onClick={resetEstimateForm} className="text-sm text-gray-500 hover:text-gray-700">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Back</button>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label><input type="text" value={directForm.customerName} onChange={(e) => setDirectForm({...directForm, customerName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Customer name" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label><div className="flex"><select value={directForm.countryCode || '+91'} onChange={(e) => setDirectForm({...directForm, countryCode: e.target.value})} className="shrink-0 px-2 py-2.5 border border-gray-200 border-r-0 rounded-l-lg bg-gray-50 text-sm"><option value="+91">+91</option></select><input type="tel" value={directForm.phone} maxLength={10} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setDirectForm({...directForm, phone: val}); }} className="min-w-0 flex-1 px-3 py-2.5 border border-gray-200 rounded-r-lg" placeholder="10-digit phone" /></div></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={directForm.email} onChange={(e) => setDirectForm({...directForm, email: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Email address" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label><select value={directForm.propertyType} onChange={(e) => setDirectForm({...directForm, propertyType: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"><option value="">Select Type</option>{PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label><input type="text" value={directForm.propertyName} onChange={(e) => setDirectForm({...directForm, propertyName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Property name" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input type="text" value={directForm.city} onChange={(e) => setDirectForm({...directForm, city: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="City" /></div>
                      </div>
                      
                      {/* Blocks & Units - Only for GC - Dynamic blocks */}
                      {directForm.propertyType === 'gated_community' && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-sm font-semibold text-blue-800 mb-3">Block Details</h4>
                          <div className="mb-4 max-w-xs">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Blocks <span className="text-red-500">*</span></label>
                            <input type="number" min="1" value={directForm.numberOfBlocks} onChange={(e) => { const blocks = parseInt(e.target.value) || 1; setDirectForm({...directForm, numberOfBlocks: blocks, unitsPerBlock: {}}); }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Array.from({ length: parseInt(directForm.numberOfBlocks) || 1 }, (_, i) => i + 1).map(blockNum => (
                              <React.Fragment key={blockNum}>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Block Name</label><input type="text" value={directForm.blockNames?.[blockNum] || ''} onChange={(e) => { const newBlockNames = {...(directForm.blockNames || {}), [blockNum]: e.target.value}; setDirectForm({...directForm, blockNames: newBlockNames}); }} placeholder={`Block ${blockNum}`} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Units <span className="text-red-500">*</span></label><input type="number" min="1" value={directForm.unitsPerBlock?.[blockNum] || ''} onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...(directForm.unitsPerBlock || {}), [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setDirectForm({...directForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }} placeholder="No. of units" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                              </React.Fragment>
                            ))}
                          </div>
                          {(directForm.totalUnits > 0 || directForm.numberOfUnits > 0) && (<div className="mt-3 p-2 bg-blue-100 rounded inline-block"><span className="text-sm text-blue-700 font-medium">Total Units: {directForm.totalUnits || directForm.numberOfUnits}</span></div>)}
                        </div>
                      )}

                      {/* Apartment */}
                      {directForm.propertyType === 'apartment' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Tower/Building Name</label><input type="text" value={directForm.blockName || ''} onChange={(e) => setDirectForm({...directForm, blockName: e.target.value})} placeholder="Tower/Building name" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Block Number</label><input type="text" value={directForm.blockNumber} onChange={(e) => setDirectForm({...directForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Number of Units <span className="text-red-500">*</span></label><input type="number" min="1" value={directForm.numberOfUnits} onChange={(e) => setDirectForm({...directForm, numberOfUnits: e.target.value})} placeholder="Total units" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}

                      {/* Villa */}
                      {directForm.propertyType === 'villa' && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="max-w-xs"><label className="block text-sm font-medium text-gray-700 mb-1">Villa Number <span className="text-red-500">*</span></label><input type="text" value={directForm.villaNumber} onChange={(e) => setDirectForm({...directForm, villaNumber: e.target.value})} placeholder="Enter villa number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}

                      {/* Flat */}
                      {directForm.propertyType === 'flat' && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="max-w-xs"><label className="block text-sm font-medium text-gray-700 mb-1">Flat Number <span className="text-red-500">*</span></label><input type="text" value={directForm.flatNumber} onChange={(e) => setDirectForm({...directForm, flatNumber: e.target.value})} placeholder="Enter flat number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}

                      {/* Plot */}
                      {directForm.propertyType === 'plot' && (
                        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="max-w-xs"><label className="block text-sm font-medium text-gray-700 mb-1">Plot Number <span className="text-red-500">*</span></label><input type="text" value={directForm.plotNumber} onChange={(e) => setDirectForm({...directForm, plotNumber: e.target.value})} placeholder="Enter plot number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {renderAmcAndPriceSummary(true)}
                </>
              )}

            </div>
          )}

          {activeTab === 'amc' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">AMC Packages</h1>
                  <p className="text-sm text-gray-500">Create and manage service packages</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button className="px-5 py-2.5 text-sm font-medium rounded-lg bg-white text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    All Packages
                    {amcPackages.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-slate-600 text-white rounded-full text-xs">{amcPackages.length}</span>
                    )}
                  </div>
                </button>
              </div>

              {/* All Packages Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">All Packages</h3>
                      <p className="text-sm text-gray-500">
                        {filterPropertyType === 'all' 
                          ? `${amcPackages.length} package(s) available` 
                          : `${amcPackages.filter(p => matchPropertyType(getPackagePropertyType(p), filterPropertyType)).length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Property Type Filter */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFilterPropertyType('all')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                      All
                      {amcPackages.length > 0 && (
                        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{amcPackages.length}</span>
                      )}
                    </button>
                    {PROPERTY_TYPE_OPTIONS.map((type) => {
                      const count = amcPackages.filter(p => matchPropertyType(getPackagePropertyType(p), type.id)).length;
                      return (
                        <button key={type.id} onClick={() => setFilterPropertyType(type.id)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
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
                  <div className="p-12 text-center"><Package className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No AMC packages available</p></div>
                ) : (filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => matchPropertyType(getPackagePropertyType(p), filterPropertyType))).length === 0 ? (
                  <div className="p-8 text-center"><p className="text-gray-500">No packages found for this property type</p><button onClick={() => setFilterPropertyType('all')} className="mt-2 text-sm text-blue-600 hover:underline">Show all packages</button></div>
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
                        {(filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => matchPropertyType(getPackagePropertyType(p), filterPropertyType))).map((pkg) => {
                          const servicesText = getPackageServicesText(pkg);
                          const getBillingBadgeColor = (billing) => {
                            switch(billing) {
                              case 'monthly': return 'bg-blue-100 text-blue-700 border-blue-200';
                              case 'quarterly': return 'bg-purple-100 text-purple-700 border-purple-200';
                              case 'half-yearly': return 'bg-amber-100 text-amber-700 border-amber-200';
                              case 'yearly': return 'bg-green-100 text-green-700 border-green-200';
                              default: return 'bg-gray-100 text-gray-700 border-gray-200';
                            }
                          };
                          return (
                            <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4"><span className="font-semibold text-gray-900">{pkg.name || 'Unnamed Package'}</span></td>
                              <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200 whitespace-nowrap">{getPropertyTypeLabel(getPackagePropertyType(pkg))}</span></td>
                              <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${getBillingBadgeColor(pkg.billing_duration)}`}>{BILLING_DURATIONS.find(d => d.value === pkg.billing_duration)?.label || 'Monthly'}</span></td>
                              <td className="px-4 py-4 max-w-xs"><p className="text-sm text-gray-600 truncate" title={servicesText}>{servicesText}</p></td>
                              <td className="px-4 py-4 text-right"><span className="text-lg font-bold text-slate-800">{formatCurrency(getPackagePrice(pkg))}</span></td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const servicesData = getPackageServices(pkg);
                                      const serviceRows = Array.isArray(servicesData) ? servicesData : [];
                                      const propertyType = getPackagePropertyType(pkg);
                                      const billingDuration = pkg.billing_duration;
                                      setViewAmcPackage({ ...pkg, servicesData, serviceRows, propertyType, billingDuration });
                                    }}
                                    className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer" 
                                    title="View"
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
            </div>
          )}

          {activeTab === 'addons' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center"><PlusCircle className="w-5 h-5 text-slate-600" /></div>
                <div><h1 className="text-xl font-bold text-gray-900">Add-ons</h1><p className="text-sm text-gray-500">Create optional services for AMC packages by property type</p></div>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button className="px-5 py-2.5 text-sm font-medium rounded-lg bg-white text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2"><Layers className="w-4 h-4" />All Add-ons{addons.length > 0 && <span className="px-1.5 py-0.5 bg-slate-600 text-white rounded-full text-xs">{addons.length}</span>}</div>
                </button>
              </div>
              {/* All Add-ons Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div><h3 className="text-lg font-semibold text-gray-800">All Add-ons</h3><p className="text-sm text-gray-500">{addonFilterPropertyType === 'all' ? `${addons.length} add-on(s) available` : `${addons.filter(a => matchPropertyType(a.property_type, addonFilterPropertyType)).length} add-on(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === addonFilterPropertyType)?.label}`}</p></div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setAddonFilterPropertyType('all')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${addonFilterPropertyType === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>All{addons.length > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${addonFilterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{addons.length}</span>}</button>
                    {PROPERTY_TYPE_OPTIONS.map((type) => { const count = addons.filter(a => matchPropertyType(a.property_type, type.id)).length; return (<button key={type.id} onClick={() => setAddonFilterPropertyType(type.id)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${addonFilterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>{type.label}{count > 0 && <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${addonFilterPropertyType === type.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{count}</span>}</button>); })}
                  </div>
                </div>
                {addons.length === 0 ? (<div className="p-12 text-center"><PlusCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No add-ons available</p></div>
                ) : (addonFilterPropertyType === 'all' ? addons : addons.filter(a => matchPropertyType(a.property_type, addonFilterPropertyType))).length === 0 ? (<div className="p-8 text-center"><p className="text-gray-500">No add-ons found for this property type</p><button onClick={() => setAddonFilterPropertyType('all')} className="mt-2 text-sm text-blue-600 hover:underline">Show all add-ons</button></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Add-on Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Property Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Frequency</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">No.of Visits</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Rate</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(addonFilterPropertyType === 'all' ? addons : addons.filter(a => matchPropertyType(a.property_type, addonFilterPropertyType))).map((addon) => {
                          const getFrequencyBadgeColor = (freq) => { switch(freq?.toLowerCase()) { case 'monthly': return 'bg-blue-100 text-blue-700 border-blue-200'; case 'every 2 months': return 'bg-cyan-100 text-cyan-700 border-cyan-200'; case 'quarterly': return 'bg-purple-100 text-purple-700 border-purple-200'; default: return 'bg-gray-100 text-gray-700 border-gray-200'; } };
                          return (
                            <tr key={addon.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4"><span className="font-semibold text-gray-900">{getAddonName(addon)}</span></td>
                              <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200 whitespace-nowrap">{getPropertyTypeLabel(addon.property_type)}</span></td>
                              <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getFrequencyBadgeColor(addon.frequency_type || addon.frequency)}`}>{addon.frequency_type || addon.frequency || 'Monthly'}</span></td>
                              <td className="px-4 py-4"><span className="text-sm text-gray-600">{addon.frequency_count || addon.visits || '12'}x</span></td>
                              <td className="px-4 py-4 text-right"><span className="font-semibold text-gray-900">{formatCurrency(getAddonPrice(addon))}</span></td>
                              <td className="px-4 py-4"><div className="flex items-center justify-center"><button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details"><Eye className="w-4 h-4" /></button></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

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
                  }`}>{viewEstimate.status || 'draft'}</span>
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
                  <div><p className="text-xs text-gray-500">Property Type</p><p className="font-medium text-sm">{getPropertyTypeLabel(viewEstimate.property_type)}</p></div>
                  <div><p className="text-xs text-gray-500">Zone</p><p className="font-medium text-sm">{viewEstimate.zone || '-'}</p></div>
                  {(viewEstimate.estimate_type === 'property_based' || viewEstimate.property_id) && viewEstimate.division && (
                    <div><p className="text-xs text-gray-500">Division</p><p className="font-medium text-sm">{viewEstimate.division}</p></div>
                  )}
                  <div><p className="text-xs text-gray-500">City</p><p className="font-medium text-sm">{viewEstimate.city || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="font-medium text-sm">{viewEstimate.address || viewEstimate.property_address || '-'}</p></div>
                  {/* GC-specific fields with Bedroom Counts */}
                  {['GC', 'gated_community', 'Gated Community'].includes(viewEstimate.property_type) && (
                    <>
                      {(viewEstimate.number_of_blocks || viewEstimate.numberOfBlocks) && (
                        <div><p className="text-xs text-gray-500">Number of Blocks</p><p className="font-medium text-sm">{viewEstimate.number_of_blocks || viewEstimate.numberOfBlocks}</p></div>
                      )}
                      <div><p className="text-xs text-gray-500">Total Units</p><p className="font-medium text-sm">{viewEstimate.total_units || viewEstimate.totalUnits || '-'}</p></div>
                      {(() => {
                        const blockNames = viewEstimate.block_names ? (typeof viewEstimate.block_names === 'string' ? JSON.parse(viewEstimate.block_names) : viewEstimate.block_names) : {};
                        const unitsPerBlock = viewEstimate.units_per_block ? (typeof viewEstimate.units_per_block === 'string' ? JSON.parse(viewEstimate.units_per_block) : viewEstimate.units_per_block) : {};
                        const blockUnitTypes = viewEstimate.block_unit_types ? (typeof viewEstimate.block_unit_types === 'string' ? JSON.parse(viewEstimate.block_unit_types) : viewEstimate.block_unit_types) : {};
                        const hasBlockData = Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0 || Object.keys(blockUnitTypes).length > 0;
                        if (!hasBlockData) return null;
                        const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };
                        const numBlocks = viewEstimate.number_of_blocks || viewEstimate.numberOfBlocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || Object.keys(blockUnitTypes).length || 1;
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
                  {/* APT-specific fields with Bedroom Counts */}
                  {['APT', 'Apt', 'apartment', 'Apartment'].includes(viewEstimate.property_type) && (
                    <>
                      {(viewEstimate.tower_name || viewEstimate.towerName) && (
                        <div><p className="text-xs text-gray-500">Tower/Building Name</p><p className="font-medium text-sm">{viewEstimate.tower_name || viewEstimate.towerName}</p></div>
                      )}
                      <div><p className="text-xs text-gray-500">Total Units</p><p className="font-medium text-sm">{viewEstimate.total_units || viewEstimate.totalUnits || viewEstimate.number_of_units || viewEstimate.numberOfUnits || '-'}</p></div>
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
                  {/* Villa/Flat/Plot-specific fields */}
                  {['VILLA', 'Villa', 'villa'].includes(viewEstimate.property_type) && (viewEstimate.villa_number || viewEstimate.villaNumber) && (
                    <div><p className="text-xs text-gray-500">Villa Number</p><p className="font-medium text-sm">{viewEstimate.villa_number || viewEstimate.villaNumber}</p></div>
                  )}
                  {['FLAT', 'Flat', 'flat'].includes(viewEstimate.property_type) && (viewEstimate.flat_number || viewEstimate.flatNumber) && (
                    <div><p className="text-xs text-gray-500">Flat Number</p><p className="font-medium text-sm">{viewEstimate.flat_number || viewEstimate.flatNumber}</p></div>
                  )}
                  {['PLOT', 'Plot', 'plot'].includes(viewEstimate.property_type) && (viewEstimate.plot_number || viewEstimate.plotNumber) && (
                    <div><p className="text-xs text-gray-500">Plot Number</p><p className="font-medium text-sm">{viewEstimate.plot_number || viewEstimate.plotNumber}</p></div>
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
                const pkgFromList = amcPackages.find(p => p.id == viewEstimate.package_id || p.name === viewEstimate.package_name);
                const pkgDescription = viewEstimate.amc_package_description || pkgFromList?.description || '';
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
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-indigo-100 rounded-t-lg">
                          <div className="col-span-1 text-xs font-semibold text-indigo-700">#</div>
                          <div className="col-span-3 text-xs font-semibold text-indigo-700">Service</div>
                          <div className="col-span-5 text-xs font-semibold text-indigo-700">Description</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-center">Frequency</div>
                          <div className="col-span-1 text-xs font-semibold text-indigo-700 text-right">Visits</div>
                        </div>
                        <div className="border border-indigo-100 rounded-b-lg divide-y divide-indigo-50">
                          {pkgServices.map((svc, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                              <div className="col-span-1">
                                <span className="w-5 h-5 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                              </div>
                              <div className="col-span-3">
                                <p className="font-medium text-gray-800 text-sm">{svc.name || svc.service}</p>
                              </div>
                              <div className="col-span-5">
                                <p className={`text-xs text-gray-500 break-words whitespace-normal text-center`}>{svc.description?.trim() || '-'}</p>
                              </div>
                              <div className="col-span-2 text-center">
                                <p className="text-sm text-indigo-600">{svc.frequencyType || svc.frequency_type || 'Monthly'}</p>
                              </div>
                              <div className="col-span-1 text-right">
                                <p className="text-sm text-indigo-700 font-semibold">{svc.frequencyCount || svc.frequency_count || 1}</p>
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
                      <div className="col-span-5 text-xs font-semibold text-green-700">Description</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-center">Frequency</div>
                      <div className="col-span-1 text-xs font-semibold text-green-700 text-right">Visits</div>
                    </div>
                    <div className="border border-green-100 divide-y divide-green-50">
                      {viewEstimate.addons.map((addon, idx) => {
                        const addonName = addon.name || addon.service_name || '';
                        const estPropertyType = (viewEstimate.property_type || '').toUpperCase();
                        let addonFromList = addons.find(a => a.id == addon.id || a.id == addon.addon_id);
                        if (!addonFromList || !addonFromList.description) {
                          addonFromList = addons.find(a => 
                            (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                            (a.property_type || '').toUpperCase() === estPropertyType
                          ) || addonFromList;
                        }
                        const addonDescription = addon.description || addonFromList?.description || '';
                        const frequencyCount = addon.frequency_count || addon.frequencyCount || addonFromList?.frequency_count || 1;
                        const frequencyType = addon.frequency_type || addon.frequencyType || addonFromList?.frequency_type || 'Monthly';
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                            <div className="col-span-1">
                              <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-gray-800 text-sm">{addon.name || addon.service_name}</p>
                            </div>
                            <div className="col-span-5">
                              <p className="text-xs text-gray-500 break-words whitespace-normal">{addonDescription || '-'}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <p className="text-sm text-green-600">{frequencyType}</p>
                            </div>
                            <div className="col-span-1 text-right">
                              <p className="text-sm text-green-700 font-semibold">{frequencyCount}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center bg-green-100 p-3 rounded-b-lg">
                      <p className="font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">{formatCurrency(viewEstimate.addons.reduce((sum, a) => sum + Number(a.price || 0), 0))}</p>
                    </div>
                  </div>
                </div>
              )}

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
                        <div className="col-span-2">
                          <p className="font-medium text-gray-900 text-sm">{svc.name || svc.service || 'Service'}</p>
                        </div>
                        <div className="col-span-5">
                          <p className={`text-sm text-gray-600 text-center`}>
                            {svc.description?.trim() || '-'}
                          </p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-sm text-gray-700">{svc.frequency_type || svc.frequencyType || svc.frequency || 'Monthly'}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-sm font-medium text-gray-900">{svc.frequency_count || svc.frequencyCount || svc.visits || '12'}</p>
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

export default ExecutiveEstimates;