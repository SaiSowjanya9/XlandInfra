import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, RefreshCw, X, Save, AlertCircle, CheckCircle, Package, PlusCircle, Archive, List, Trash2, Eye, Layers, Edit, Calendar, Filter, Home, Building2, User } from 'lucide-react';
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

const ExecutiveEstimates = ({ user, defaultTab = 'list' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Sync activeTab with defaultTab when route changes
  useEffect(() => { setActiveTab(defaultTab); }, [defaultTab]);
  
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
  const clearAllFilters = () => { setEstimateTypeFilter('all'); setStatusFilter('all'); setCategoryFilter('all'); setFromDate(''); setToDate(''); setSearchTerm(''); };

  const [estimateForm, setEstimateForm] = useState({ clientId: '', propertyId: '', title: '', description: '', estimateType: '', subtotal: 0, taxPercentage: 18, discountPercentage: 0, validUntil: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
  const [amcForm, setAmcForm] = useState({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true });
  const [addonForm, setAddonForm] = useState({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true });
  
  // Property-based estimate state (like Manager)
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedAmcPackage, setSelectedAmcPackage] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  
  // Direct estimate form
  const [directForm, setDirectForm] = useState({ customerName: '', phone: '', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', numberOfBlocks: '', blockNumber: '', blockName: '', numberOfUnits: '', villaNumber: '', flatNumber: '', plotNumber: '' });

  // Helper functions (must be defined before calculatePriceSummary)
  const formatCurrency = (amt) => { const num = parseFloat(amt); return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(isNaN(num) ? 0 : Math.round(num)); };
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

  // Save estimate
  const handleSaveEstimate = async () => {
    const authToken = sessionStorage.getItem('pm_auth_token');
    if (estimateForm.estimateType === 'property_based' && !propertyIdInput) {
      setMessage({ type: 'error', text: 'Enter Property ID' }); return;
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
          client_phone: selectedProperty?.contact_phone || directForm.phone,
          client_email: selectedProperty?.contact_email || directForm.email,
          property_name: selectedProperty?.name || directForm.propertyName,
          property_type: selectedProperty?.property_type || directForm.propertyType,
          zone: selectedProperty?.zone_name || selectedProperty?.zoneName || selectedProperty?.zone || directForm.zone,
          city: selectedProperty?.city || directForm.city,
          address: selectedProperty?.address || directForm.address,
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
      const res = await fetch('/api/executive/estimates', {
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
      const [estRes, archivedRes, amcRes, addRes, custRes, propRes, catRes] = await Promise.all([
        fetch('/api/executive/estimates?archived=false', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/estimates?archived=true', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/categories', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [estData, archivedData, amcData, addData, custData, propData, catData] = await Promise.all([estRes.json(), archivedRes.json(), amcRes.json(), addRes.json(), custRes.json(), propRes.json(), catRes.json()]);
      if (estData.success) setEstimates(estData.data || []);
      if (archivedData.success) setArchivedEstimates(archivedData.data || []);
      if (amcData.success) setAmcPackages(amcData.data || []);
      if (addData.success) setAddons(addData.data || []);
      if (custData.success) setCustomers(custData.data || []);
      if (propData.success) setProperties(propData.data || []);
      if (catData.success) setCategories(catData.data || []);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const handleEstimateSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    try {
      const response = await fetch('/api/executive/estimates', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...estimateForm, subtotal, items: estimateForm.items.map(item => ({ ...item, totalPrice: item.quantity * item.unitPrice })) })
      });
      const result = await response.json();
      if (result.success) { setMessage({ type: 'success', text: 'Estimate created successfully!' }); resetEstimateForm(); fetchData(); setActiveTab('list'); }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create estimate' }); }
  };

  const handleAmcSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/executive/amc-packages', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...amcForm, services: amcForm.services.split(',').map(s => s.trim()).filter(Boolean) })
      });
      const result = await response.json();
      if (result.success) { setMessage({ type: 'success', text: 'AMC Package created successfully!' }); setShowModal(false); resetAmcForm(); fetchData(); }
      else setMessage({ type: 'error', text: result.message || 'Operation failed' });
    } catch (error) { setMessage({ type: 'error', text: 'Failed to create AMC package' }); }
  };

  const handleAddonSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch('/api/executive/addons', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(addonForm)
      });
      const result = await response.json();
      if (result.success) { setMessage({ type: 'success', text: 'Add-on created successfully!' }); setShowModal(false); resetAddonForm(); fetchData(); }
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
  const getFrequencyVisits = (frequency) => ({ Monthly: 12, 'Every 2 Months': 6, 'Every 3 Months': 4, Quarterly: 3, 'Half-Yearly': 2, Yearly: 1 }[frequency]) || parseInt(frequency) || 12;
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
                  <thead><tr className="border-y border-blue-100"><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Service</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Frequency</th><th className="px-5 py-2.5 text-right text-xs font-semibold text-blue-600 uppercase">No. of Visits</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{services.length > 0 ? services.map((svc, idx) => { const freqType = svc.frequencyType || svc.frequency_type || 'Monthly'; return (<tr key={idx}><td className="px-5 py-2.5 text-gray-800">{svc.service || svc.name || '-'}</td><td className="px-5 py-2.5 text-gray-600">{freqType}</td><td className="px-5 py-2.5 text-right text-gray-600">{svc.frequencyCount || svc.frequency_count || getFrequencyVisits(freqType)}</td></tr>); }) : <tr><td colSpan={3} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}</tbody>
                </table>
                <div className="px-5 py-3 bg-blue-50 border-t border-blue-100"><div className="flex justify-between items-center"><span className="text-sm font-semibold text-blue-700">Total Package Price</span><span className="text-lg font-bold text-gray-900">{formatCurrency(getPackagePrice(pkg))}</span></div><div className="text-xs text-blue-600 mt-1">Service Period: <span className="capitalize">{getPackageBillingDuration(pkg)}</span></div></div>
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
                <thead><tr className="border-b border-blue-100 bg-white"><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Service</th><th className="px-5 py-2.5 text-left text-xs font-semibold text-blue-600 uppercase">Frequency</th><th className="px-5 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase">No. of Visits</th><th className="px-5 py-2.5 text-center text-xs font-semibold text-blue-600 uppercase">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-100 bg-white">{selectedAddons.map((addonId, idx) => { const addon = addons.find(a => getAddonId(a) === addonId); if (!addon) return null; const freqType = addon.frequency_type || addon.frequencyType || addon.services?.[0]?.frequencyType || 'Monthly'; return (<tr key={idx}><td className="px-5 py-2.5 text-gray-800">{getAddonName(addon)}</td><td className="px-5 py-2.5 text-gray-600">{freqType}</td><td className="px-5 py-2.5 text-center text-gray-600">{addon.frequency_count || addon.frequencyCount || getFrequencyVisits(freqType)}</td><td className="px-5 py-2.5 text-center"><button onClick={() => setSelectedAddons(selectedAddons.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr>); })}</tbody>
                <tfoot className="bg-blue-50 border-t border-blue-200"><tr><td colSpan={3} className="px-5 py-2.5 text-sm font-semibold text-blue-700">Total Add-ons Price</td><td className="px-5 py-2.5 text-right font-bold text-blue-700">{formatCurrency(selectedAddons.reduce((sum, id) => sum + getAddonPrice(addons.find(a => getAddonId(a) === id)), 0))}</td></tr></tfoot>
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
                <input type="number" min="0" max="100" value={gstPercent} onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1 border border-blue-300 rounded text-center" />
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
        <p className="text-xs text-gray-500">* Currency: INR (₹) | GST applied on total | Fields marked with * are mandatory | Direct estimates are saved to Archive section</p>
        <div className="flex gap-3">
          <button onClick={resetEstimateForm} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
          {showSaveButton && <button onClick={handleSaveEstimate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>}
        </div>
      </div>
    </>
  );

  const filteredEstimates = estimates.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.estimate_id?.toLowerCase().includes(searchTerm.toLowerCase()) || e.client_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Estimates / AMC Management</h1><p className="text-gray-500 mt-1">Create estimates and view AMC packages</p></div>
        <div className="flex items-center gap-4">
          <button onClick={fetchData} className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-center"><p className="text-xl font-bold text-gray-900">{estimates.length}</p><p className="text-xs text-gray-500">Active Estimates</p></div>
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
        <button onClick={() => window.location.href = '/executive/estimates'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <List className="w-4 h-4" />All Estimates
        </button>
        <button onClick={() => window.location.href = '/executive/estimates/create'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Plus className="w-4 h-4" />Create Estimate
        </button>
        <button onClick={() => window.location.href = '/executive/estimates/amc'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'amc' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Package className="w-4 h-4" />AMC Packages
        </button>
        <button onClick={() => window.location.href = '/executive/estimates/addons'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'addons' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <PlusCircle className="w-4 h-4" />Add-ons
        </button>
        <button onClick={() => window.location.href = '/executive/estimates/archived'} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'archived' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
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
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimate ID</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th><th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEstimates.map((estimate) => {
                          const TypeIcon = estimate.property_type === 'Apt' ? Home : Building2;
                          return (
                            <tr key={estimate.id} className="hover:bg-gray-50">
                              <td className="py-4 px-4"><span className="font-medium text-gray-900">{estimate.estimate_id || `EST-${estimate.id}`}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-gray-400" /><span className={`px-2 py-0.5 text-xs font-medium rounded ${estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{estimate.estimate_type === 'property_based' || estimate.estimate_type === 'property-based' ? 'Property' : 'Direct'}</span></div></td>
                              <td className="py-4 px-4"><span className="text-gray-700">{estimate.client_name || '-'}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-1.5 text-gray-600"><Calendar className="w-4 h-4" />{estimate.created_at ? new Date(estimate.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '-'}</div></td>
                              <td className="py-4 px-4"><div><p className="font-medium text-gray-900">{estimate.created_by_name || (estimate.created_by_role ? estimate.created_by_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}</p>{estimate.created_by_name && estimate.created_by_role && <p className="text-xs text-gray-400 capitalize">{estimate.created_by_role.replace(/_/g, ' ')}</p>}</div></td>
                              <td className="py-4 px-4"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(estimate.status)}`}>{estimate.status?.charAt(0).toUpperCase() + estimate.status?.slice(1) || 'Draft'}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center justify-center gap-1"><button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button></div></td>
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
                          <td className="px-4 py-3 text-gray-500">{e.archived_at ? new Date(e.archived_at).toLocaleDateString() : '-'}</td>
                          <td className="px-4 py-3 font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(e.total_amount || 0)}</td>
                          <td className="px-4 py-3"><div className="flex items-center justify-center"><button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td>
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
                      <button onClick={resetEstimateForm} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                    </div>
                    <div className="p-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Property ID <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={propertyIdInput} onChange={(e) => { setPropertyIdInput(e.target.value); const m = properties.find(p => p.property_id?.toLowerCase() === e.target.value.toLowerCase()); setSelectedProperty(m || null); }} placeholder="GC-DMMN-20260520" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
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
                          <div className="grid grid-cols-5 gap-4">
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Community Name</label><input type="text" value={selectedProperty.name || selectedProperty.community_name || selectedProperty.property_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Division</label><input type="text" value={selectedProperty.division || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Property Type</label><input type="text" value={selectedProperty.property_type || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Units</label><input type="text" value={selectedProperty.units || selectedProperty.total_units || selectedProperty.number_of_units || '1'} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">City</label><input type="text" value={selectedProperty.city || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Address</label><input type="text" value={selectedProperty.address || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Contact Phone</label><input type="text" value={selectedProperty.contact_phone || selectedProperty.phone || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
                            <div><label className="block text-xs font-medium text-slate-500 mb-1">Contact Email</label><input type="text" value={selectedProperty.contact_email || selectedProperty.email || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" /></div>
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
                      <button onClick={resetEstimateForm} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label><input type="text" value={directForm.customerName} onChange={(e) => setDirectForm({...directForm, customerName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Customer name" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" value={directForm.phone} onChange={(e) => setDirectForm({...directForm, phone: e.target.value})} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Phone number" /></div>
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
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Block Name</label><input type="text" value={`Block ${blockNum}`} readOnly className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-600" /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Units <span className="text-red-500">*</span></label><input type="number" min="1" value={directForm.unitsPerBlock?.[blockNum] || ''} onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...(directForm.unitsPerBlock || {}), [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setDirectForm({...directForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }} placeholder="No. of units" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                              </React.Fragment>
                            ))}
                          </div>
                          {(directForm.totalUnits > 0 || directForm.numberOfUnits > 0) && (<div className="mt-3 p-2 bg-blue-100 rounded inline-block"><span className="text-sm text-blue-700 font-medium">Total Units: {directForm.totalUnits || directForm.numberOfUnits}</span></div>)}
                        </div>
                      )}

                      {/* Apartment */}
                      {directForm.propertyType === 'apartment' && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Tower/Building Name</label><input type="text" value={directForm.blockName || ''} onChange={(e) => setDirectForm({...directForm, blockName: e.target.value})} placeholder="Tower/Building name" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Block Number</label><input type="text" value={directForm.blockNumber} onChange={(e) => setDirectForm({...directForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Flat/Unit Number</label><input type="text" value={directForm.flatNumber} onChange={(e) => setDirectForm({...directForm, flatNumber: e.target.value})} placeholder="e.g., 101, 202" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" /></div>
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
                              <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">{getPropertyTypeLabel(getPackagePropertyType(pkg))}</span></td>
                              <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getBillingBadgeColor(pkg.billing_duration)}`}>{BILLING_DURATIONS.find(d => d.value === pkg.billing_duration)?.label || 'Monthly'}</span></td>
                              <td className="px-4 py-4 max-w-xs"><p className="text-sm text-gray-600 truncate" title={servicesText}>{servicesText}</p></td>
                              <td className="px-4 py-4 text-right"><span className="text-lg font-bold text-slate-800">{formatCurrency(getPackagePrice(pkg))}</span></td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
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
                              <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">{getPropertyTypeLabel(addon.property_type)}</span></td>
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
    </div>
  );
};

export default ExecutiveEstimates;
