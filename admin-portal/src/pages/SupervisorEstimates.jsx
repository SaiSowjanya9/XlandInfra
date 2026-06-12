import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, RefreshCw, X, Save, AlertCircle, CheckCircle, Package, PlusCircle, Archive, List, Trash2, Eye, Layers, Edit, Download, Mail, EyeOff, Calendar, Filter, Home, Building2, FolderOpen, ExternalLink, Link } from 'lucide-react';
import { exportEstimateToPDF } from '../utils/pdfExport';

const PROPERTY_TYPE_OPTIONS = [
  { id: 'gated_community', label: 'Gated Community' },
  { id: 'apartment', label: 'Apartment' },
  { id: 'villa', label: 'Villa' },
  { id: 'flat', label: 'Flat' },
  { id: 'plot', label: 'Plot' },
];

// Helper to match property types (handles different formats)
const matchPropertyType = (value, filterId) => {
  if (!value || !filterId) return false;
  const normalize = (str) => str.toLowerCase().replace(/[_\s-]/g, '');
  const filterOption = PROPERTY_TYPE_OPTIONS.find(t => t.id === filterId);
  const normalizedValue = normalize(value);
  const aliases = {
    gc: ['gc', 'gatedcommunity'],
    gatedcommunity: ['gc', 'gatedcommunity'],
    apartment: ['apt', 'apartment'],
    apt: ['apt', 'apartment'],
    villa: ['villa', 'villas'],
    villas: ['villa', 'villas'],
    flat: ['flat', 'flats'],
    flats: ['flat', 'flats'],
    plot: ['plot', 'plots'],
    plots: ['plot', 'plots']
  };
  const normalizedFilter = normalize(filterId);
  const filterAliases = aliases[normalizedFilter] || [normalizedFilter];
  const valueAliases = aliases[normalizedValue] || [normalizedValue];
  return normalize(filterId) === normalizedValue || 
         (filterOption && normalize(filterOption.label) === normalizedValue) ||
         filterAliases.some(alias => valueAliases.includes(alias));
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

const SupervisorEstimates = ({ user, defaultTab = 'list' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
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
  const [viewEstimate, setViewEstimate] = useState(null);
  const [fpPortalLinks, setFpPortalLinks] = useState([]);
  const clearAllFilters = () => { setEstimateTypeFilter('all'); setStatusFilter('all'); setCategoryFilter('all'); setFromDate(''); setToDate(''); setSearchTerm(''); };

  const [estimateForm, setEstimateForm] = useState({ clientId: '', propertyId: '', title: '', description: '', estimateType: '', subtotal: 0, taxPercentage: 18, discountPercentage: 0, validUntil: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
  const [amcForm, setAmcForm] = useState({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true });
  const [addonForm, setAddonForm] = useState({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true });
  
  // Property-based estimate state
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedAmcPackage, setSelectedAmcPackage] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
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
  const getFrequencyVisits = (frequency) => ({ Monthly: 12, 'Every 2 Months': 6, 'Every 3 Months': 4, Quarterly: 3, 'Half-Yearly': 2, Yearly: 1 }[frequency]) || parseInt(frequency) || 12;

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

  const token = sessionStorage.getItem('pm_auth_token');

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
        fetch('/api/supervisor/estimates?archived=false', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/estimates?archived=true', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/fp-portal-links', { headers: { 'Authorization': `Bearer ${token}` } })
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

  useEffect(() => { fetchData(); }, []);

  const handleEstimateSubmit = async (e) => {
    if (e) e.preventDefault();
    setMessage({ type: '', text: '' });
    
    // Property-based estimate
    if (estimateForm.estimateType === 'property_based') {
      if (!propertyIdInput || !selectedProperty) {
        setMessage({ type: 'error', text: 'Please select a property' }); return;
      }
    }
    // Direct estimate validation
    if (estimateForm.estimateType === 'direct') {
      if (!estimateForm.directCustomerName) { setMessage({ type: 'error', text: 'Enter Customer Name' }); return; }
      if (!estimateForm.directPhone || estimateForm.directPhone.length !== 10) { setMessage({ type: 'error', text: 'Enter valid 10-digit phone' }); return; }
    }
    if (!selectedAmcPackage) {
      setMessage({ type: 'error', text: 'Please select an AMC package' }); return;
    }
    
    const pkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage);
    const pkgPrice = getPackagePrice(pkg);
    const addonsTotal = selectedAddons.reduce((sum, id) => sum + getAddonPrice(addons.find(a => getAddonId(a) === id)), 0);
    const subtotal = pkgPrice + addonsTotal;
    const discountAmt = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmt;
    const gstAmt = (afterDiscount * gstPercent) / 100;
    const total = afterDiscount + gstAmt;
    
    try {
      const payload = {
        estimate_type: estimateForm.estimateType || 'property_based',
        property_id: selectedProperty?.id || propertyIdInput,
        property_code: selectedProperty?.property_id || '',
        client_name: selectedProperty?.contact_person || selectedProperty?.contact_name || '',
        client_phone: selectedProperty?.contact_phone || '',
        client_email: selectedProperty?.contact_email || '',
        property_name: selectedProperty?.name || selectedProperty?.community_name || '',
        property_type: selectedProperty?.property_type || '',
        zone: selectedProperty?.zone_name || selectedProperty?.zoneName || selectedProperty?.zone || '',
        city: selectedProperty?.city || '',
        address: selectedProperty?.address || '',
        package_id: selectedAmcPackage,
        package_name: pkg?.name || '',
        package_price: pkgPrice,
        addons: selectedAddons.map(id => {
          const addon = addons.find(a => getAddonId(a) === id);
          return addon ? { id: getAddonId(addon), name: getAddonName(addon), price: getAddonPrice(addon) } : null;
        }).filter(Boolean),
        subtotal: subtotal,
        discount_percent: discountPercent,
        discount_amount: discountAmt,
        gst_percent: gstPercent,
        gst_amount: gstAmt,
        total_amount: total
      };
      
      const response = await fetch('/api/supervisor/estimates', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.ok || result.success) { 
        setMessage({ type: 'success', text: 'Estimate created successfully!' }); 
        resetEstimateForm(); 
        setPropertyIdInput('');
        setSelectedProperty(null);
        setSelectedAmcPackage('');
        setSelectedAddons([]);
        setDiscountPercent(0);
        fetchData(); 
        setActiveTab('list'); 
      }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { 
      console.error('Save error:', error);
      setMessage({ type: 'error', text: 'Failed to create estimate: ' + error.message }); 
    }
  };

  const handleAmcSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/supervisor/amc-packages', {
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
      const response = await fetch('/api/supervisor/addons', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(addonForm)
      });
      const result = await response.json();
      if (response.ok || result.success) { setMessage({ type: 'success', text: 'Add-on created successfully!' }); setShowModal(false); resetAddonForm(); fetchData(); }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create add-on' }); }
  };

  const resetEstimateForm = () => { setEstimateForm({ clientId: '', propertyId: '', title: '', description: '', estimateType: '', subtotal: 0, taxPercentage: 18, discountPercentage: 0, validUntil: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] }); };
  const resetAmcForm = () => { setAmcForm({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true }); };
  const resetAddonForm = () => { setAddonForm({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true }); };

  const addLineItem = () => { setEstimateForm({ ...estimateForm, items: [...estimateForm.items, { description: '', quantity: 1, unitPrice: 0 }] }); };
  const removeLineItem = (index) => { if (estimateForm.items.length > 1) setEstimateForm({ ...estimateForm, items: estimateForm.items.filter((_, i) => i !== index) }); };
  const updateLineItem = (index, field, value) => { const updatedItems = [...estimateForm.items]; updatedItems[index][field] = value; setEstimateForm({ ...estimateForm, items: updatedItems }); };

  const getStatusColor = (status) => { const colors = { draft: 'bg-gray-100 text-gray-700', pending_approval: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', converted: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-500' }; return colors[status] || 'bg-gray-100 text-gray-700'; };
  const formatCurrency = (amount) => { const num = parseFloat(amount); return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(isNaN(num) ? 0 : Math.round(num)); };
  const calculateTotals = () => { const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0); const tax = (subtotal * estimateForm.taxPercentage) / 100; const discount = (subtotal * estimateForm.discountPercentage) / 100; return { subtotal, tax, discount, total: subtotal + tax - discount }; };

  const filteredEstimates = estimates.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.estimate_id?.toLowerCase().includes(searchTerm.toLowerCase()) || e.client_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header - matches FP layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeTab === 'create' ? 'Create Estimate' : activeTab === 'list' ? 'All Estimates' : activeTab === 'amc' ? 'AMC Packages' : activeTab === 'addons' ? 'Add-ons' : 'Archived Estimates'}
            </h1>
            <p className="text-gray-500">Create and manage estimates, AMC packages, and add-ons</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={fetchData} className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{estimates.length}</p><p className="text-xs text-gray-500">Active Estimates</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{amcPackages.length}</p><p className="text-xs text-gray-500">AMC Packages</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{addons.length}</p><p className="text-xs text-gray-500">Add-ons</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{archivedEstimates.length}</p><p className="text-xs text-gray-500">Archived</p></div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-1 flex items-center gap-1">
        <button onClick={() => window.location.href = '/supervisor/estimates'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <List className="w-4 h-4" />All Estimates
        </button>
        <button onClick={() => window.location.href = '/supervisor/estimates/create'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Plus className="w-4 h-4" />Create Estimate
        </button>
        <button onClick={() => window.location.href = '/supervisor/estimates/amc'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'amc' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Package className="w-4 h-4" />AMC Packages
        </button>
        <button onClick={() => window.location.href = '/supervisor/estimates/addons'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'addons' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <PlusCircle className="w-4 h-4" />Add-ons
        </button>
        <button onClick={() => window.location.href = '/supervisor/estimates/archived'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${defaultTab === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Archive className="w-4 h-4" />Archived
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-amber-600 animate-spin" /></div>
      ) : (
        <>
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search estimates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" /></div>
                <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg border font-medium flex items-center gap-2 ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><Filter className="w-4 h-4" />Filters</button>
              </div>
              {showFilters && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">Estimate Type</label><select value={estimateTypeFilter} onChange={(e) => setEstimateTypeFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="all">All Estimates</option><option value="property_based">Property Based</option><option value="direct">Direct</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="all">All Statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">Property Category</label><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"><option value="all">All Categories</option>{PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">From Date</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">To Date</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
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
                      <thead className="border-b border-gray-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Estimate ID</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Client</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Created By</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredEstimates.map((estimate) => (
                          <tr key={estimate.id} className="hover:bg-gray-50">
                            <td className="py-4 px-4">
                              <span className="font-medium text-gray-900">{estimate.estimate_id || `EST-${estimate.id}`}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' 
                                  ? 'bg-blue-50 text-blue-600' 
                                  : 'bg-green-50 text-green-600'
                              }`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'Property' : 'Direct'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-gray-700 font-medium">{estimate.client_name || '-'}</span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {estimate.created_at ? new Date(estimate.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '-'}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-semibold text-gray-900">{formatCurrency(estimate.total_amount || estimate.subtotal || 0)}</span>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className="font-medium text-gray-900">{estimate.created_by_name || (estimate.created_by_role ? estimate.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'System')}</p>
                                <p className="text-xs text-blue-600">{estimate.created_by_name ? (estimate.created_by_role || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : ''}</p>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                estimate.status === 'approved' ? 'bg-green-100 text-green-700' :
                                estimate.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                estimate.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {estimate.status || 'draft'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <button 
                                onClick={() => setViewEstimate(estimate)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'archived' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search archived estimates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" /></div>
                <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg border font-medium flex items-center gap-2 ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}><Filter className="w-4 h-4" />Filters</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {archivedEstimates.filter(e => (e.estimate_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.client_name || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                  <div className="text-center py-12"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimate ID</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Archived On</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th><th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {archivedEstimates.filter(e => (e.estimate_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.client_name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((estimate) => {
                          const TypeIcon = estimate.property_type === 'Apt' ? Home : Building2;
                          return (
                            <tr key={estimate.id} className="hover:bg-gray-50">
                              <td className="py-4 px-4"><span className="font-medium text-gray-900">{estimate.estimate_id || `EST-${estimate.id}`}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-gray-400" /><span className={`px-2 py-0.5 text-xs font-medium rounded ${estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'Property' : 'Direct'}</span></div></td>
                              <td className="py-4 px-4"><span className="text-gray-700">{estimate.client_name || '-'}</span></td>
                              <td className="py-4 px-4"><span className="text-gray-500">{estimate.archived_at ? new Date(estimate.archived_at).toLocaleDateString() : '-'}</span></td>
                              <td className="py-4 px-4"><span className="font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(estimate.total_amount || 0)}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center justify-center gap-1"><button onClick={() => setViewEstimate(estimate)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button></div></td>
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

          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* FP Shared Resources Section - Read-only for employees */}
              {fpPortalLinks.length > 0 && (
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

              {!estimateForm.estimateType || estimateForm.estimateType === 'select' ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Select Estimate Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'property_based' })} className="p-8 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group">
                      <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-100">
                        <FileText className="w-6 h-6 text-gray-400 group-hover:text-blue-600" />
                      </div>
                      <p className="font-semibold text-gray-900">Property-Based Estimate</p>
                      <p className="text-sm text-gray-500 mt-2">Enter Property ID to auto-fill details</p>
                    </button>
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'direct' })} className="p-8 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group">
                      <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-blue-100">
                        <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-gray-900">Direct-Based Estimate</p>
                      <p className="text-sm text-gray-500 mt-2">Enter customer details manually</p>
                    </button>
                  </div>
                </div>
              ) : estimateForm.estimateType === 'property_based' ? (
                <div className="space-y-6">
                  {/* Estimate Details */}
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="font-semibold text-gray-900">Estimate Details</h2>
                    </div>
                    <div className="p-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Property ID <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          value={propertyIdInput} 
                          onChange={(e) => { 
                            setPropertyIdInput(e.target.value); 
                            const match = properties.find(p => p.property_id?.toLowerCase() === e.target.value.toLowerCase()); 
                            setSelectedProperty(match || null); 
                          }} 
                          placeholder="COORD-APT-1780347062151" 
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500" 
                        />
                      </div>
                      {selectedProperty && (
                        <div className="mt-6 space-y-4">
                          <div className="grid grid-cols-5 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Contact Name</label>
                              <input type="text" value={selectedProperty.contact_person || selectedProperty.contact_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Property ID</label>
                              <input type="text" value={selectedProperty.property_id || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Entry Type</label>
                              <input type="text" value={selectedProperty.entry_type || selectedProperty.property_type?.substring(0,3).toUpperCase() || 'GC'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
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
                          <div className="grid grid-cols-5 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Community Name</label>
                              <input type="text" value={selectedProperty.name || selectedProperty.community_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Division</label>
                              <input type="text" value={selectedProperty.division || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
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
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AMC Package */}
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="font-semibold text-gray-900">AMC Package</h2>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select AMC Package <span className="text-red-500">*</span></label>
                        <select value={selectedAmcPackage} onChange={(e) => setSelectedAmcPackage(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200">
                          <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                          {(() => {
                            const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType;
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
                            <div className="px-5 py-3 flex items-center gap-3"><Package className="w-5 h-5 text-blue-600" /><span className="font-semibold text-gray-900">{pkg.name}</span><span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span></div>
                            <table className="w-full text-sm bg-white"><thead><tr className="border-y border-blue-100"><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Service</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Frequency</th><th className="px-5 py-2.5 text-right text-xs font-semibold text-blue-600 uppercase">No. of Visits</th></tr></thead><tbody className="divide-y divide-gray-100">{services.length > 0 ? services.map((svc, idx) => { const freqType = svc.frequencyType || svc.frequency_type || 'Monthly'; return (<tr key={idx}><td className="px-5 py-2.5 text-gray-800">{svc.service || svc.name || '-'}</td><td className="px-5 py-2.5 text-gray-600">{freqType}</td><td className="px-5 py-2.5 text-right text-gray-600">{svc.frequencyCount || svc.frequency_count || getFrequencyVisits(freqType)}</td></tr>); }) : <tr><td colSpan={3} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}</tbody></table>
                            <div className="px-5 py-3 bg-blue-50 border-t border-blue-100"><div className="flex justify-between items-center"><span className="text-sm font-semibold text-blue-700">Total Package Price</span><span className="text-lg font-bold text-gray-900">{formatCurrency(getPackagePrice(pkg))}</span></div><div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize">{getPackageBillingDuration(pkg)}</span></div></div>
                          </div>
                        );
                      })()}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Add Service from Add-ons</label>
                        <select onChange={(e) => { if (e.target.value) { setSelectedAddons([...selectedAddons, e.target.value]); } e.target.value = ''; }} className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200">
                          <option value="">+ Select Add-on to add</option>
                          {(() => {
                            const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType;
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
                          <table className="w-full text-sm"><thead><tr className="border-b border-blue-100 bg-white"><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Service</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Frequency</th><th className="px-5 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase">No. of Visits</th><th className="px-5 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase">Action</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{selectedAddons.map((addonId, idx) => { const addon = addons.find(a => getAddonId(a) === addonId); if (!addon) return null; const freqType = addon.frequency_type || addon.frequencyType || addon.services?.[0]?.frequencyType || 'Monthly'; return (<tr key={idx}><td className="px-5 py-2.5 text-gray-800">{getAddonName(addon)}</td><td className="px-5 py-2.5 text-gray-600">{freqType}</td><td className="px-5 py-2.5 text-center text-gray-600">{addon.frequency_count || addon.frequencyCount || getFrequencyVisits(freqType)}</td><td className="px-5 py-2.5 text-center"><button onClick={() => setSelectedAddons(selectedAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>); })}</tbody><tfoot className="bg-blue-50 border-t border-blue-200"><tr><td colSpan={3} className="px-5 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td><td className="px-5 py-2.5 text-right font-bold text-blue-700">{formatCurrency(selectedAddons.reduce((sum, id) => sum + getAddonPrice(addons.find(a => getAddonId(a) === id)), 0))}</td></tr></tfoot></table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => { setEstimateForm({ ...estimateForm, estimateType: 'select' }); setPropertyIdInput(''); setSelectedProperty(null); setSelectedAmcPackage(''); setSelectedAddons([]); }} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                    <button type="button" onClick={handleEstimateSubmit} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEstimateSubmit} className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Customer Information</h3></div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label><input type="text" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Customer name" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="tel" value={estimateForm.directPhone || ''} maxLength={10} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setEstimateForm({...estimateForm, directPhone: val}); }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="10-digit phone" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Email address" /></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Property Details */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Property Details</h3></div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Type <span className="text-red-500">*</span></label><select value={estimateForm.directPropertyType || ''} onChange={(e) => setEstimateForm({...estimateForm, directPropertyType: e.target.value, numberOfBlocks: 1, unitsPerBlock: {}, totalUnits: 0})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white">{PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label><input type="text" value={estimateForm.directPropertyName || ''} onChange={(e) => setEstimateForm({...estimateForm, directPropertyName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Property name" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Zone</label><input type="text" value={estimateForm.directZone || ''} onChange={(e) => setEstimateForm({...estimateForm, directZone: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Zone" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input type="text" value={estimateForm.directCity || ''} onChange={(e) => setEstimateForm({...estimateForm, directCity: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="City" /></div>
                      </div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input type="text" value={estimateForm.directAddress || ''} onChange={(e) => setEstimateForm({...estimateForm, directAddress: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Full address" /></div>
                      
                      {/* Blocks & Units - Only for GC - Dynamic blocks */}
                      {estimateForm.directPropertyType === 'gated_community' && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-sm font-semibold text-blue-800 mb-3">Block Details</h4>
                          <div className="mb-4 max-w-xs">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Blocks <span className="text-red-500">*</span></label>
                            <input type="number" min="1" value={estimateForm.numberOfBlocks || ''} onChange={(e) => { const blocks = parseInt(e.target.value) || 1; setEstimateForm({...estimateForm, numberOfBlocks: blocks, unitsPerBlock: {}}); }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Array.from({ length: parseInt(estimateForm.numberOfBlocks) || 1 }, (_, i) => i + 1).map(blockNum => (
                              <React.Fragment key={blockNum}>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Block Name</label><input type="text" value={estimateForm.blockNames?.[blockNum] || ''} onChange={(e) => { const newBlockNames = {...(estimateForm.blockNames || {}), [blockNum]: e.target.value}; setEstimateForm({...estimateForm, blockNames: newBlockNames}); }} placeholder={`Block ${blockNum}`} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Units <span className="text-red-500">*</span></label><input type="number" min="1" value={estimateForm.unitsPerBlock?.[blockNum] || ''} onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...(estimateForm.unitsPerBlock || {}), [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setEstimateForm({...estimateForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }} placeholder="No. of units" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                              </React.Fragment>
                            ))}
                          </div>
                          {(estimateForm.totalUnits > 0 || estimateForm.numberOfUnits > 0) && (<div className="mt-3 p-2 bg-blue-100 rounded inline-block"><span className="text-sm text-blue-700 font-medium">Total Units: {estimateForm.totalUnits || estimateForm.numberOfUnits}</span></div>)}
                        </div>
                      )}

                      {/* Apartment */}
                      {estimateForm.directPropertyType === 'apartment' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Tower/Building Name</label><input type="text" value={estimateForm.blockName || ''} onChange={(e) => setEstimateForm({...estimateForm, blockName: e.target.value})} placeholder="Tower/Building name" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Block Number</label><input type="text" value={estimateForm.blockNumber || ''} onChange={(e) => setEstimateForm({...estimateForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Number of Units <span className="text-red-500">*</span></label><input type="number" min="1" value={estimateForm.numberOfUnits || ''} onChange={(e) => setEstimateForm({...estimateForm, numberOfUnits: e.target.value})} placeholder="Total units" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}

                      {/* Villa */}
                      {estimateForm.directPropertyType === 'villa' && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="max-w-xs"><label className="block text-sm font-medium text-gray-700 mb-1">Villa Number <span className="text-red-500">*</span></label><input type="text" value={estimateForm.villaNumber || ''} onChange={(e) => setEstimateForm({...estimateForm, villaNumber: e.target.value})} placeholder="Enter villa number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}

                      {/* Flat */}
                      {estimateForm.directPropertyType === 'flat' && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="max-w-xs"><label className="block text-sm font-medium text-gray-700 mb-1">Flat Number <span className="text-red-500">*</span></label><input type="text" value={estimateForm.flatNumber || ''} onChange={(e) => setEstimateForm({...estimateForm, flatNumber: e.target.value})} placeholder="Enter flat number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}

                      {/* Plot */}
                      {estimateForm.directPropertyType === 'plot' && (
                        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="max-w-xs"><label className="block text-sm font-medium text-gray-700 mb-1">Plot Number <span className="text-red-500">*</span></label><input type="text" value={estimateForm.plotNumber || ''} onChange={(e) => setEstimateForm({...estimateForm, plotNumber: e.target.value})} placeholder="Enter plot number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">AMC Package</h3></div>
                    <div className="p-6 space-y-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Select AMC Package <span className="text-red-500">*</span></label><select value={selectedAmcPackage} onChange={(e) => setSelectedAmcPackage(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"><option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>{amcPackages.map((pkg) => (<option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(getPackagePrice(pkg))}</option>))}</select></div>
                      {(() => { const pkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage); if (!pkg) return null; const services = getPackageServices(pkg); return (<div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30"><div className="px-5 py-3 flex items-center gap-3"><Package className="w-5 h-5 text-blue-600" /><span className="font-semibold text-gray-900">{pkg.name}</span><span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span></div><table className="w-full text-sm bg-white"><thead><tr className="border-y border-blue-100"><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Service</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Frequency</th><th className="px-5 py-2.5 text-right text-xs font-semibold text-blue-600 uppercase">No. of Visits</th></tr></thead><tbody className="divide-y divide-gray-100">{services.length > 0 ? services.map((svc, idx) => { const freqType = svc.frequencyType || svc.frequency_type || 'Monthly'; return (<tr key={idx}><td className="px-5 py-2.5 text-gray-800">{svc.service || svc.name || '-'}</td><td className="px-5 py-2.5 text-gray-600">{freqType}</td><td className="px-5 py-2.5 text-right text-gray-600">{svc.frequencyCount || svc.frequency_count || getFrequencyVisits(freqType)}</td></tr>); }) : <tr><td colSpan={3} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}</tbody></table><div className="px-5 py-3 bg-blue-50 border-t border-blue-100"><div className="flex justify-between items-center"><span className="text-sm font-semibold text-blue-700">Total Package Price</span><span className="text-lg font-bold text-gray-900">{formatCurrency(getPackagePrice(pkg))}</span></div><div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize">{getPackageBillingDuration(pkg)}</span></div></div></div>); })()}
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Add Service from Add-ons</label><select onChange={(e) => { if (e.target.value) setSelectedAddons([...selectedAddons, e.target.value]); e.target.value = ''; }} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"><option value="">+ Select Add-on to add</option>{addons.map((addon) => (<option key={getAddonId(addon)} value={getAddonId(addon)}>{getAddonName(addon)}</option>))}</select></div>
                      {selectedAddons.length > 0 && (<div className="border border-blue-200 rounded-xl overflow-hidden"><div className="bg-blue-50 px-5 py-2.5 border-b border-blue-200"><span className="text-sm font-semibold text-blue-700">Additional Services (Add-ons)</span></div><table className="w-full text-sm"><thead><tr className="border-b border-blue-100 bg-white"><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Service</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Frequency</th><th className="px-5 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase">No. of Visits</th><th className="px-5 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase">Action</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{selectedAddons.map((addonId, idx) => { const addon = addons.find(a => getAddonId(a) === addonId); if (!addon) return null; const freqType = addon.frequency_type || addon.frequencyType || addon.services?.[0]?.frequencyType || 'Monthly'; return (<tr key={idx}><td className="px-5 py-2.5 text-gray-800">{getAddonName(addon)}</td><td className="px-5 py-2.5 text-gray-600">{freqType}</td><td className="px-5 py-2.5 text-center text-gray-600">{addon.frequency_count || addon.frequencyCount || getFrequencyVisits(freqType)}</td><td className="px-5 py-2.5 text-center"><button onClick={() => setSelectedAddons(selectedAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>); })}</tbody><tfoot className="bg-blue-50 border-t border-blue-200"><tr><td colSpan={3} className="px-5 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td><td className="px-5 py-2.5 text-right font-bold text-blue-700">{formatCurrency(selectedAddons.reduce((sum, id) => sum + getAddonPrice(addons.find(a => getAddonId(a) === id)), 0))}</td></tr></tfoot></table></div>)}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'select' })} className="px-6 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                  </div>
                </form>
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
                          : `${amcPackages.filter(p => matchPropertyType(p.property_type, filterPropertyType)).length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Property Type Filter */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFilterPropertyType('all')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>All</button>
                    {PROPERTY_TYPE_OPTIONS.map((type) => (
                      <button key={type.id} onClick={() => setFilterPropertyType(type.id)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>{type.label}</button>
                    ))}
                  </div>
                </div>

                {amcPackages.length === 0 ? (
                  <div className="p-12 text-center"><Package className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No AMC packages available</p></div>
                ) : (filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => matchPropertyType(p.property_type, filterPropertyType))).length === 0 ? (
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
                        {(filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => matchPropertyType(p.property_type, filterPropertyType))).map((pkg) => {
                          // Parse services JSON if it's a string, or use directly if object
                          let servicesData = pkg.services;
                          if (typeof servicesData === 'string') {
                            try { servicesData = JSON.parse(servicesData); } catch(e) { servicesData = null; }
                          }
                          // Extract service names from serviceRows array
                          const serviceRows = servicesData?.serviceRows || pkg.serviceRows || servicesData || [];
                          const servicesText = Array.isArray(serviceRows) 
                            ? serviceRows.map(s => s.name || s.service || 'Service').filter(Boolean).join(', ') 
                            : '-';
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
                              <td className="px-4 py-4"><span className="text-gray-700">{pkg.property_type || 'GC'}</span></td>
                              <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getBillingBadgeColor(pkg.billing_duration)}`}>{BILLING_DURATIONS.find(d => d.value === pkg.billing_duration)?.label || 'Monthly'}</span></td>
                              <td className="px-4 py-4 max-w-xs"><p className="text-sm text-gray-600 truncate" title={servicesText}>{servicesText || '-'}</p></td>
                              <td className="px-4 py-4 text-right"><span className="font-semibold text-gray-900">{formatCurrency(getPackagePrice(pkg))}</span></td>
                              <td className="px-4 py-4">
                                <button className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors" title="View">
                                  <Eye className="w-4 h-4" />
                                </button>
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
                    <button onClick={() => setAddonFilterPropertyType('all')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${addonFilterPropertyType === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>All</button>
                    {PROPERTY_TYPE_OPTIONS.map((type) => (<button key={type.id} onClick={() => setAddonFilterPropertyType(type.id)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${addonFilterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>{type.label}</button>))}
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
                              <td className="px-4 py-4 text-right"><span className="text-sm text-gray-400 italic flex items-center justify-end gap-1"><EyeOff className="w-3 h-3" /> Hidden</span></td>
                              <td className="px-4 py-4"><div className="flex items-center justify-center gap-1"><button className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button><button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button></div></td>
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
                <div><p className="text-xs text-gray-500">Created</p><p className="font-medium text-sm">{viewEstimate.created_at ? new Date(viewEstimate.created_at).toLocaleDateString() : '-'}</p></div>
              </div>

              {/* Property Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p>
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Property ID</p><p className="font-medium text-sm">{viewEstimate.property_code || viewEstimate.property_id || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Name</p><p className="font-medium text-sm">{viewEstimate.property_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Type</p><p className="font-medium text-sm">{viewEstimate.property_type || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Zone</p><p className="font-medium text-sm">{viewEstimate.zone || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Division</p><p className="font-medium text-sm">{viewEstimate.division || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">City</p><p className="font-medium text-sm">{viewEstimate.city || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="font-medium text-sm">{viewEstimate.address || viewEstimate.property_address || '-'}</p></div>
                  {/* GC-specific: Number of Blocks, Block Names, Units per Block */}
                  {['GC', 'gated_community', 'Gated Community'].includes(viewEstimate.property_type) && (
                    <>
                      <div><p className="text-xs text-gray-500">Number of Blocks</p><p className="font-medium text-sm">{viewEstimate.number_of_blocks || '-'}</p></div>
                      <div><p className="text-xs text-gray-500">Total Units</p><p className="font-medium text-sm">{viewEstimate.total_units || '-'}</p></div>
                      {(() => {
                        const blockNames = viewEstimate.block_names ? (typeof viewEstimate.block_names === 'string' ? JSON.parse(viewEstimate.block_names) : viewEstimate.block_names) : {};
                        const unitsPerBlock = viewEstimate.units_per_block ? (typeof viewEstimate.units_per_block === 'string' ? JSON.parse(viewEstimate.units_per_block) : viewEstimate.units_per_block) : {};
                        const hasBlockData = Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0;
                        if (!hasBlockData) return null;
                        return (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-gray-500 mb-2">Block Details</p>
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.keys(blockNames).length > 0 ? Object.entries(blockNames).map(([key, name]) => (
                                  <div key={key} className="bg-white p-2 rounded border border-blue-100">
                                    <p className="text-xs text-blue-600 font-medium">{name || `Block ${key}`}</p>
                                    <p className="text-sm text-gray-700">{unitsPerBlock[key] || 0} units</p>
                                  </div>
                                )) : Object.entries(unitsPerBlock).map(([key, units]) => (
                                  <div key={key} className="bg-white p-2 rounded border border-blue-100">
                                    <p className="text-xs text-blue-600 font-medium">Block {key}</p>
                                    <p className="text-sm text-gray-700">{units || 0} units</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {/* Apartment-specific fields */}
                  {['APT', 'apartment', 'Apartment'].includes(viewEstimate.property_type) && (
                    <>
                      {viewEstimate.tower_name && <div><p className="text-xs text-gray-500">Tower/Building Name</p><p className="font-medium text-sm">{viewEstimate.tower_name}</p></div>}
                      {viewEstimate.block_number && <div><p className="text-xs text-gray-500">Block Number</p><p className="font-medium text-sm">{viewEstimate.block_number}</p></div>}
                      <div><p className="text-xs text-gray-500">Number of Units</p><p className="font-medium text-sm">{viewEstimate.total_units || '-'}</p></div>
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
              {viewEstimate.package_name && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p>
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-indigo-900">{viewEstimate.package_name}</p>
                        <p className="text-xs text-indigo-600">Yearly Billing</p>
                      </div>
                      <p className="text-lg font-bold text-indigo-700">₹{Number(viewEstimate.package_price || 0).toLocaleString()}</p>
                    </div>
                    {viewEstimate.amc_package_description && (
                      <p className="text-sm text-indigo-700 mt-2 pt-2 border-t border-indigo-100">{viewEstimate.amc_package_description}</p>
                    )}
                  </div>
                  {/* Package Services */}
                  {viewEstimate.package_services && (() => {
                    const services = typeof viewEstimate.package_services === 'string' ? JSON.parse(viewEstimate.package_services) : viewEstimate.package_services;
                    if (!services || services.length === 0) return null;
                    return (
                      <div className="mt-3 space-y-2">
                        {services.map((svc, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-100">
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-gray-800">{svc.name || svc.service}</p>
                              <p className="text-sm text-indigo-600">{svc.frequencyCount || 1}x {svc.frequencyType || 'Monthly'}</p>
                            </div>
                            {svc.description && <p className="text-xs text-gray-500 mt-1">{svc.description}</p>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Add-ons */}
              {viewEstimate.addons && viewEstimate.addons.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add-on Services</p>
                  <div className="space-y-2">
                    {viewEstimate.addons.map((addon, idx) => {
                      const frequencyCount = addon.frequency_count || addon.frequencyCount || 1;
                      const frequencyType = addon.frequency_type || addon.frequencyType || 'Monthly';
                      return (
                        <div key={idx} className="bg-green-50 p-3 rounded-lg border border-green-100">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-green-900">{addon.name || addon.service_name}</p>
                              <p className="text-xs text-green-600">{frequencyCount}x {frequencyType}</p>
                            </div>
                          </div>
                          {addon.description && <p className="text-xs text-green-700 mt-2 pt-2 border-t border-green-100">{addon.description}</p>}
                        </div>
                      );
                    })}
                    <div className="flex justify-between items-center bg-green-100 p-3 rounded-lg mt-2">
                      <p className="font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">₹{viewEstimate.addons.reduce((sum, a) => sum + Number(a.price || 0), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {viewEstimate.description && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Description / Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewEstimate.description}</p>
                </div>
              )}

              {/* Price Summary */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Price Summary</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>₹{Number(viewEstimate.subtotal || 0).toLocaleString()}</span></div>
                  {viewEstimate.discount_amount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount ({viewEstimate.discount_percent || 0}%)</span><span>-₹{Number(viewEstimate.discount_amount).toLocaleString()}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({viewEstimate.gst_percent || 0}%)</span><span>₹{Number(viewEstimate.gst_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-indigo-600">₹{Number(viewEstimate.total_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Created By */}
              <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
                Created by: {viewEstimate.created_by_name || (viewEstimate.created_by_role ? viewEstimate.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')} {viewEstimate.created_by_name && viewEstimate.created_by_role ? `(${viewEstimate.created_by_role.replace(/_/g, ' ')})` : ''}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorEstimates;
