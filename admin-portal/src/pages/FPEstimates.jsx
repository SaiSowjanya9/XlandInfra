import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, X, Check, AlertCircle, Package, PlusCircle, Archive,
  List, ChevronDown, Building2, User, Trash2, Edit2, Eye, RotateCcw, Calendar,
  DollarSign, Layers, Filter, Download, Mail, Save, Edit, Send, Link2, RefreshCw
} from 'lucide-react';
import { FREQUENCY_TYPES, FREQUENCY_COUNT_MAP } from '../utils/estimateStore';
import { exportEstimateToPDF, exportPackageToPDF } from '../utils/pdfExport';

const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'Apt', label: 'Apartment' },
  { id: 'Villa', label: 'Villa' },
  { id: 'Flat', label: 'Flat' },
  { id: 'Plot', label: 'Plot' },
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
  
  // Check if user is FP Manager (restricted access)
  const isFPManager = user?.role === 'manager';
  
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({ estimates: 0, amcPackages: 0, addons: 0, archived: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [emailModal, setEmailModal] = useState(null);
  const [estimateType, setEstimateType] = useState(null);
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  // FP Manager defaults to 'all-packages' (no create access)
  const [amcActiveTab, setAmcActiveTab] = useState(isFPManager ? 'all-packages' : 'create');
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);
  const [amcForm, setAmcForm] = useState({ packageName: '', description: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' });
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
  const [viewAmcPackage, setViewAmcPackage] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const token = sessionStorage.getItem('pm_auth_token');

  useEffect(() => { loadData(); }, [defaultTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estRes, amcRes, addRes, propRes, archivedRes] = await Promise.all([
        fetch('/api/fp/estimates?archived=false', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fp/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fp/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fp/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fp/estimates?archived=true', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [estData, amcData, addData, propData, archivedData] = await Promise.all([estRes.json(), amcRes.json(), addRes.json(), propRes.json(), archivedRes.json()]);
      const estArr = estData.success ? (Array.isArray(estData.data) ? estData.data : []) : [];
      const amcArr = amcData.success ? (Array.isArray(amcData.data) ? amcData.data : []) : [];
      const addArr = addData.success ? (Array.isArray(addData.data) ? addData.data : []) : [];
      const propArr = propData.success ? (Array.isArray(propData.data) ? propData.data : []) : [];
      const archArr = archivedData.success ? (Array.isArray(archivedData.data) ? archivedData.data : []) : [];
      setEstimates(estArr); setAmcPackages(amcArr); setAddons(addArr); setProperties(propArr); setArchivedEstimates(archArr);
      setStats({ estimates: estArr.length, amcPackages: amcArr.length, addons: addArr.length, archived: archArr.length });
    } catch (e) { console.error('Load error:', e); }
    finally { setLoading(false); }
  };

  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3500); };
  const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amt || 0);

  // Estimate form state
  const [estimateForm, setEstimateForm] = useState({
    customerName: '', phone: '', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '',
    selectedPackage: '', selectedAddons: [], discount: 0, gst: 18, description: ''
  });

  // Helper to normalize property type to match PROPERTY_TYPE_OPTIONS IDs
  const normalizePropertyType = (type) => {
    if (!type) return '';
    const upper = type.toUpperCase();
    // Map full names to short codes (matching PROPERTY_TYPE_OPTIONS IDs)
    if (upper.includes('GATED') || upper === 'GC') return 'GC';
    if (upper.includes('APARTMENT') || upper === 'APT') return 'Apt';
    if (upper.includes('VILLA')) return 'Villa';
    if (upper.includes('FLAT')) return 'Flat';
    if (upper.includes('PLOT')) return 'Plot';
    return type;
  };

  // Helper to get property type label
  const getPropertyTypeLabel = (type) => {
    const normalized = normalizePropertyType(type);
    return PROPERTY_TYPE_OPTIONS.find(t => t.id === normalized)?.label || type || '-';
  };

  // Export FP estimate to PDF with properly formatted data
  const handleExportPDF = (estimate) => {
    // Parse addons from multiple possible sources (no prices shown)
    let addonsArray = [];
    
    // Try estimate.addons first (from backend enrichment)
    if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
      addonsArray = estimate.addons;
    }
    // Try addons_data JSON string
    else if (estimate.addons_data) {
      try {
        const parsed = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
        if (Array.isArray(parsed)) addonsArray = parsed;
      } catch (e) { console.log('Addon parse error:', e); }
    }
    
    // Parse package services from multiple sources
    let packageServices = [];
    
    // Try services_data JSON string (contains package services)
    if (estimate.services_data) {
      try {
        const parsed = typeof estimate.services_data === 'string' ? JSON.parse(estimate.services_data) : estimate.services_data;
        if (parsed.serviceRows && Array.isArray(parsed.serviceRows)) {
          packageServices = parsed.serviceRows;
        } else if (Array.isArray(parsed)) {
          packageServices = parsed;
        }
      } catch (e) { console.log('Services parse error:', e); }
    }
    // Try package_services
    else if (estimate.package_services) {
      try {
        const parsed = typeof estimate.package_services === 'string' ? JSON.parse(estimate.package_services) : estimate.package_services;
        if (Array.isArray(parsed)) packageServices = parsed;
      } catch (e) { console.log('Package services parse error:', e); }
    }
    // If we have a package_id, try to find package services from amcPackages
    else if (estimate.package_id && amcPackages.length > 0) {
      const pkg = amcPackages.find(p => p.id?.toString() === estimate.package_id?.toString());
      if (pkg) {
        try {
          const servicesData = typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services;
          if (servicesData?.serviceRows) {
            packageServices = servicesData.serviceRows;
          } else if (Array.isArray(servicesData)) {
            packageServices = servicesData;
          }
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
      customerName: estimate.client_name,
      customerPhone: estimate.client_phone,
      customerEmail: estimate.client_email,
      address: estimate.address,
      city: estimate.city,
      packageName: estimate.package_name,
      billingDuration: 'Yearly',
      subtotal: parseFloat(estimate.subtotal) || 0,
      totalPrice: parseFloat(estimate.total_amount) || 0,
      discount: parseFloat(estimate.discount_percent) || 0,
      description: estimate.description || '',
      // Include package services (no prices)
      packageServices: packageServices.map(s => ({
        name: s.service || s.name || s.serviceName || 'Service',
        frequencyCount: s.frequencyCount || s.frequency || 1,
        frequencyType: s.frequencyType || 'Monthly'
      })),
      // Include addons (no prices)
      addons: addonsArray.map(a => ({
        name: a.name || a.service_name || a.serviceName || 'Add-on',
        frequencyType: a.frequency_type || a.frequencyType || 'One-time'
      }))
    };
    
    console.log('PDF Data:', pdfData);
    exportEstimateToPDF(pdfData);
  };

  // Send email with estimate
  const handleSendEmail = async (estimate) => {
    const clientEmail = estimate.client_email;
    if (!clientEmail) {
      showToast('No email address found for this client', 'error');
      return;
    }
    try {
      const res = await fetch('/api/fp/estimates/send-email', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateId: estimate.id, email: clientEmail })
      });
      const result = await res.json();
      if (result.success) {
        showToast(`Email sent to ${clientEmail}`);
      } else {
        showToast(result.message || 'Failed to send email', 'error');
      }
    } catch (e) {
      console.error('Send email error:', e);
      showToast('Failed to send email', 'error');
    }
  };

  // Helper to get package property type (parses services JSON)
  const getPkgPropertyType = (pkg) => {
    let svc = pkg.services;
    if (typeof svc === 'string') { try { svc = JSON.parse(svc); } catch(e) { svc = null; } }
    return normalizePropertyType(svc?.property_type || pkg.property_type || '');
  };

  const calculatePricing = () => {
    const pkg = amcPackages.find(p => p.id == estimateForm.selectedPackage);
    const pkgPrice = parseFloat(pkg?.price) || 0;
    const addonsPrice = estimateForm.selectedAddons.reduce((sum, id) => {
      const addon = addons.find(a => a.id == id);
      return sum + (parseFloat(addon?.price) || 0);
    }, 0);
    const subtotal = pkgPrice + addonsPrice;
    const discount = parseFloat(estimateForm.discount) || 0;
    const gst = parseFloat(estimateForm.gst) || 18;
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
    // Validation
    const clientName = selectedProperty?.contact_person || selectedProperty?.contact_name || selectedProperty?.customer_name || estimateForm.customerName;
    const clientPhone = selectedProperty?.contact_phone || selectedProperty?.phone || estimateForm.phone;
    if (!clientName?.trim()) { showToast('Customer name is required', 'error'); return; }
    if (!clientPhone?.trim()) { showToast('Phone number is required', 'error'); return; }
    if (!estimateForm.selectedPackage) { showToast('Please select an AMC package', 'error'); return; }

    const pkg = getSelectedPackage();
    const pricing = calculatePricing();
    const selectedAddonsList = estimateForm.selectedAddons.map(id => addons.find(a => a.id === id)).filter(Boolean);

    try {
      const payload = {
        estimate_type: estimateType === 'property-based' ? 'property_based' : 'direct',
        property_id: selectedProperty?.id || null,
        property_code: selectedProperty?.property_id || selectedProperty?.property_code || '',
        client_name: clientName,
        client_phone: clientPhone,
        client_email: selectedProperty?.contact_email || selectedProperty?.email || estimateForm.email || '',
        property_type: selectedProperty?.property_type || selectedProperty?.entry_type || estimateForm.propertyType || '',
        property_name: selectedProperty?.name || selectedProperty?.community_name || estimateForm.propertyName || '',
        zone: selectedProperty?.zone_id || selectedProperty?.zone || estimateForm.zone || '',
        division: selectedProperty?.division || selectedProperty?.division_id || selectedProperty?.division_name || '',
        city: selectedProperty?.city || estimateForm.city || '',
        address: selectedProperty?.address || estimateForm.address || '',
        package_id: estimateForm.selectedPackage,
        package_name: pkg?.name || '',
        package_price: pkg?.price || 0,
        addons: selectedAddonsList.map(a => ({ id: a.id, name: a.service_name, price: a.price, frequency_count: a.frequency_count, frequency_type: a.frequency_type })),
        subtotal: pricing.subtotal,
        discount_percent: estimateForm.discount,
        discount_amount: pricing.discountAmt,
        gst_percent: estimateForm.gst,
        gst_amount: pricing.gstAmt,
        total_amount: pricing.total,
        description: estimateForm.description || ''
      };

      const res = await fetch('/api/fp/estimates', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success || res.status === 201) {
        showToast('Estimate saved successfully!');
        setEstimateType(null);
        setSelectedProperty(null);
        setPropertyIdInput('');
        setEstimateForm({ customerName: '', phone: '', email: '', propertyType: '', propertyName: '', zone: '', city: '', address: '', selectedPackage: '', selectedAddons: [], discount: 0, gst: 18, description: '' });
        loadData();
        setActiveTab('list');
      } else {
        showToast(result.message || 'Failed to save estimate', 'error');
      }
    } catch (e) {
      console.error('Save estimate error:', e);
      showToast('Failed to save estimate', 'error');
    }
  };

  // CREATE ESTIMATE - Both Property-Based and Direct-Based available for FP Manager
  const renderCreateEstimate = () => (
    <div className="space-y-6">
      {!estimateType && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Estimate Type</h2>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Property-Based Estimate */}
            <button onClick={() => setEstimateType('property-based')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <Building2 className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-indigo-600">Property-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
            </button>
            {/* Direct-Based Estimate */}
            <button onClick={() => setEstimateType('direct')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <User className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-indigo-600">Direct-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
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
                      setPropertyIdInput(e.target.value); 
                      const m = properties.find(p => p.property_id?.toLowerCase() === e.target.value.toLowerCase()); 
                      setSelectedProperty(m || null); 
                    }} 
                    placeholder="GC-DMMN-20260520" 
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-amber-500 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-600 text-sm"
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
                      <input type="text" value={selectedProperty.zone_id || selectedProperty.zone || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
                      <input type="text" value={selectedProperty.area || selectedProperty.area_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Community Name</label>
                      <input type="text" value={selectedProperty.name || selectedProperty.community_name || selectedProperty.property_name || ''} readOnly className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
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

                  {/* Unit Details */}
                  <div className="bg-slate-50 rounded-lg p-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">Unit Details</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded">{selectedProperty.property_type?.substring(0,2).toUpperCase() || 'GC'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Block Name</label>
                        <input type="text" value={selectedProperty.block_name || 'A'} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Number of Units</label>
                        <input type="text" value={`${selectedProperty.units || selectedProperty.total_units || 1} Units`} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                      </div>
                    </div>
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
                  <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                    <div className="px-5 py-3 flex items-center gap-3">
                      <Package className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-gray-900">{pkg.name}</span>
                      <span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                    </div>
                    <table className="w-full text-sm bg-white">
                      <thead>
                        <tr className="border-y border-amber-100">
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Service</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Frequency</th>
                          <th className="px-5 py-2.5 text-right text-xs font-semibold text-amber-600 uppercase">No. of Visits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {services.length > 0 ? services.map((svc, idx) => {
                          const freqType = svc.frequencyType || svc.frequency_type || 'Monthly';
                          const visits = FREQUENCY_COUNT_MAP?.[freqType] || 12;
                          return (
                            <tr key={idx}>
                              <td className="px-5 py-2.5 text-gray-800">{svc.service || svc.name || '-'}</td>
                              <td className="px-5 py-2.5 text-gray-600">{freqType}</td>
                              <td className="px-5 py-2.5 text-right text-gray-600">{visits}</td>
                            </tr>
                          );
                        }) : <tr><td colSpan={3} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-amber-700">Total Package Price</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(pkg.price)}</span>
                      </div>
                      <div className="text-xs text-amber-600 mt-1">Service Period: <span className="capitalize">{billingDuration}</span></div>
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
                    const propertyType = selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm?.propertyType;
                    const searchType = normalizePropertyType(propertyType);
                    const filteredAddons = searchType ? addons.filter(addon => normalizePropertyType(addon.property_type) === searchType) : addons;
                    if (searchType && filteredAddons.length === 0) return <option disabled>No add-ons for {propertyType}</option>;
                    return filteredAddons.map(addon => <option key={addon.id} value={addon.id}>{addon.service_name} - {formatCurrency(addon.price)}</option>);
                  })()}
                </select>
              </div>

              {/* Additional Services (Add-ons) Table - Only show when add-ons selected */}
              {estimateForm.selectedAddons.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-5 py-2.5 border-b border-amber-200">
                    <span className="text-sm font-semibold text-amber-700">Additional Services (Add-ons)</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-100 bg-white">
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Service</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Frequency</th>
                        <th className="px-5 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase">No. of Visits</th>
                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-amber-600 uppercase">Price</th>
                        <th className="px-5 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {estimateForm.selectedAddons.map((id, idx) => {
                        const addon = addons.find(a => a.id == id || a.id === parseInt(id));
                        if (!addon) return null;
                        const visits = FREQUENCY_COUNT_MAP?.[addon.frequency_type] || 12;
                        return (
                          <tr key={idx}>
                            <td className="px-5 py-2.5 text-gray-800">{addon.service_name}</td>
                            <td className="px-5 py-2.5 text-gray-600">{addon.frequency_type || 'Monthly'}</td>
                            <td className="px-5 py-2.5 text-center text-gray-600">{visits}</td>
                            <td className="px-5 py-2.5 text-right text-gray-800">{formatCurrency(addon.price)}</td>
                            <td className="px-5 py-2.5 text-center">
                              <button onClick={() => setEstimateForm({...estimateForm, selectedAddons: estimateForm.selectedAddons.filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-amber-50 border-t border-amber-200">
                      <tr>
                        <td colSpan={3} className="px-5 py-2.5 text-sm font-semibold text-amber-700">Total Add-ons</td>
                        <td className="px-5 py-2.5 text-right font-bold text-amber-700">{formatCurrency(estimateForm.selectedAddons.reduce((sum, id) => sum + (addons.find(a => a.id == id)?.price || 0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Description / Notes */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description / Notes</label>
                <textarea 
                  value={estimateForm.description} 
                  onChange={(e) => setEstimateForm({...estimateForm, description: e.target.value})}
                  placeholder="Add any additional notes or description for this estimate..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-y min-h-[100px]"
                />
              </div>
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
                        <input type="number" value={estimateForm.gst} onChange={(e) => setEstimateForm({...estimateForm, gst: parseFloat(e.target.value) || 0})} className="w-16 px-2 py-1 border border-amber-300 bg-amber-50 rounded text-sm text-center text-amber-700" />
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

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={() => { setEstimateType(null); setSelectedProperty(null); setPropertyIdInput(''); }} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSaveEstimate} className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-yellow-600">Save</button>
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
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Enter customer name" value={estimateForm.customerName} onChange={(e) => setEstimateForm({...estimateForm, customerName: e.target.value})} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Phone <span className="text-red-500">*</span></label>
                  <div className="flex">
                    <select className="px-2 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-sm bg-gray-50">
                      <option>+91</option>
                    </select>
                    <input type="tel" placeholder="10-digit phone number" value={estimateForm.phone} maxLength={10} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setEstimateForm({...estimateForm, phone: val}); }} className="flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg text-sm" />
                  </div>
                </div>
                <div>
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
            </div>
          </div>

          {/* AMC Package - Only show after property type is selected */}
          {estimateForm.propertyType ? (
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
                  <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                    <div className="px-5 py-3 flex items-center gap-3">
                      <Package className="w-5 h-5 text-amber-600" />
                      <span className="font-semibold text-gray-900">{pkg.name}</span>
                      <span className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded font-mono">{pkg.package_code || `AMC-${pkg.id}`}</span>
                    </div>
                    <table className="w-full text-sm bg-white">
                      <thead>
                        <tr className="border-y border-amber-100">
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Service</th>
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Frequency</th>
                          <th className="px-5 py-2.5 text-right text-xs font-semibold text-amber-600 uppercase">No. of Visits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {services.length > 0 ? services.map((svc, idx) => {
                          const freqType = svc.frequencyType || svc.frequency_type || 'Monthly';
                          const visits = FREQUENCY_COUNT_MAP?.[freqType] || 12;
                          return (
                            <tr key={idx}>
                              <td className="px-5 py-2.5 text-gray-800">{svc.service || svc.name || '-'}</td>
                              <td className="px-5 py-2.5 text-gray-600">{freqType}</td>
                              <td className="px-5 py-2.5 text-right text-gray-600">{visits}</td>
                            </tr>
                          );
                        }) : <tr><td colSpan={3} className="px-5 py-3 text-center text-gray-400">No services in package</td></tr>}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-amber-700">Total Package Price</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(pkg.price)}</span>
                      </div>
                      <div className="text-xs text-amber-600 mt-1">Service Period: <span className="capitalize">{billingDuration}</span></div>
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
                    const propertyType = selectedProperty?.property_type || selectedProperty?.entry_type || selectedProperty?.entryType || estimateForm?.propertyType;
                    const searchType = normalizePropertyType(propertyType);
                    const filteredAddons = searchType ? addons.filter(addon => normalizePropertyType(addon.property_type) === searchType) : addons;
                    if (searchType && filteredAddons.length === 0) return <option disabled>No add-ons for {propertyType}</option>;
                    return filteredAddons.map(addon => <option key={addon.id} value={addon.id}>{addon.service_name} - {formatCurrency(addon.price)}</option>);
                  })()}
                </select>
              </div>

              {/* Additional Services (Add-ons) Table - Only show when add-ons selected */}
              {estimateForm.selectedAddons.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-5 py-2.5 border-b border-amber-200">
                    <span className="text-sm font-semibold text-amber-700">Additional Services (Add-ons)</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-100 bg-white">
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Service</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-amber-600 uppercase">Frequency</th>
                        <th className="px-5 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase">No. of Visits</th>
                        <th className="px-5 py-2.5 text-right text-xs font-semibold text-amber-600 uppercase">Price</th>
                        <th className="px-5 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {estimateForm.selectedAddons.map((id, idx) => {
                        const addon = addons.find(a => a.id == id || a.id === parseInt(id));
                        if (!addon) return null;
                        const visits = FREQUENCY_COUNT_MAP?.[addon.frequency_type] || 12;
                        return (
                          <tr key={idx}>
                            <td className="px-5 py-2.5 text-gray-800">{addon.service_name}</td>
                            <td className="px-5 py-2.5 text-gray-600">{addon.frequency_type || 'Monthly'}</td>
                            <td className="px-5 py-2.5 text-center text-gray-600">{visits}</td>
                            <td className="px-5 py-2.5 text-right text-gray-800">{formatCurrency(addon.price)}</td>
                            <td className="px-5 py-2.5 text-center">
                              <button onClick={() => setEstimateForm({...estimateForm, selectedAddons: estimateForm.selectedAddons.filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-amber-50 border-t border-amber-200">
                      <tr>
                        <td colSpan={3} className="px-5 py-2.5 text-sm font-semibold text-amber-700">Total Add-ons</td>
                        <td className="px-5 py-2.5 text-right font-bold text-amber-700">{formatCurrency(estimateForm.selectedAddons.reduce((sum, id) => sum + (addons.find(a => a.id == id)?.price || 0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Description / Notes */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description / Notes</label>
                <textarea 
                  value={estimateForm.description} 
                  onChange={(e) => setEstimateForm({...estimateForm, description: e.target.value})}
                  placeholder="Add any additional notes or description for this estimate..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-y min-h-[100px]"
                />
              </div>
            </div>
          </div>

          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <p className="text-amber-700 font-medium">Please select a Property Type to see available AMC Packages</p>
            </div>
          )}

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
                        <input type="number" value={estimateForm.gst} onChange={(e) => setEstimateForm({...estimateForm, gst: parseFloat(e.target.value) || 0})} className="w-16 px-2 py-1 border border-amber-300 bg-amber-50 rounded text-sm text-center text-amber-700" />
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

          {/* Footer Note */}
          <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
            * Currency: INR (₹) | GST: 18% applied on total | Fields marked with * are mandatory
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setEstimateType(null)} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSaveEstimate} className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-yellow-600">Save</button>
          </div>
        </div>
      )}
    </div>
  );

  // ALL ESTIMATES
  const filteredEstimates = estimates.filter(e => {
    const matchSearch = (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.estimate_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.client_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchType = filterType === 'all' || e.estimate_type === filterType || (filterType === 'property_based' && (e.estimate_type === 'property_based' || e.estimate_type === 'property-based'));
    const matchCategory = filterCategory === 'all' || 
      e.property_type === filterCategory || 
      (e.property_type || '').toLowerCase().includes(filterCategory.toLowerCase()) ||
      filterCategory.toLowerCase().includes((e.property_type || '').toLowerCase());
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
  const renderAllEstimates = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search estimates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"><Filter className="w-4 h-4" />Filters<ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} /></button>
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
                  <option value="IV">IV - Individual Villa</option>
                  <option value="GC">GC - Gated Community</option>
                  <option value="Gated Community">Gated Community</option>
                  <option value="APT">APT - Apartment</option>
                  <option value="Apartment">Apartment</option>
                  <option value="COMM">COMM - Commercial</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Individual Villa">Individual Villa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
              </div>
            </div>
            <button onClick={() => { setFilterStatus('all'); setFilterType('all'); setFilterCategory('all'); setFilterFromDate(''); setFilterToDate(''); }} className="mt-3 text-sm text-amber-600 hover:text-blue-800 font-medium">Clear all filters</button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="py-16 text-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div> : filteredEstimates.length === 0 ? <div className="py-16 text-center"><DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No estimates found</p><p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Estimate ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEstimates.map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-mono text-sm text-gray-900">{est.estimate_id}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'}`}>
                        <Link2 className="w-3 h-3" />
                        {est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'Property' : 'Direct'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{est.client_name}</div>
                      {est.property_id && <div className="text-xs text-gray-400">{est.property_id}</div>}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {est.created_at ? new Date(est.created_at).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-900">{formatCurrency(est.total_amount)}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{est.created_by_name || '-'}</div>
                      <div className="text-xs text-gray-400 capitalize">{(est.created_by_role || '').replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const status = (est.status || 'draft').toLowerCase().trim();
                        const colors = {
                          approved: 'bg-green-100 text-green-700 border border-green-200',
                          sent: 'bg-amber-100 text-amber-700 border border-amber-200',
                          rejected: 'bg-red-100 text-red-700 border border-red-200',
                          pending: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
                          expired: 'bg-orange-100 text-orange-700 border border-orange-200',
                          draft: 'bg-gray-100 text-gray-600 border border-gray-200'
                        };
                        return (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || colors.draft}`}>
                            {est.status || 'draft'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewEstimate(est)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="View"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleExportPDF(est)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Download PDF"><Download className="w-4 h-4" /></button>
                        <button onClick={() => handleSendEmail(est)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Send Email"><Send className="w-4 h-4" /></button>
                        <button onClick={() => handleArchiveEstimate(est.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // AMC PACKAGES
  const filteredAmcPackages = filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => p.property_type === filterPropertyType);
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
      const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: amcForm.packageName, description: amcForm.description || '', property_type: selectedPropertyType, services: validSvc.map(r => ({ name: r.service, frequency_count: parseInt(r.frequencyCount) || 1, frequency_type: r.frequencyType })), price: parseFloat(amcForm.price), billing_duration: amcForm.billingDuration }) });
      const result = await res.json();
      if (result.success || res.status === 201) { showToast(isEditing ? 'AMC Package updated!' : 'AMC Package created!'); resetAmcForm(); loadData(); setAmcActiveTab('all-packages'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to save package', 'error'); }
  };
  const handleDeleteAmcPackage = async (id) => { if (!window.confirm('Delete this package?')) return; try { const res = await fetch(`/api/fp/amc-packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleAddServiceRow = () => setAmcForm({ ...amcForm, serviceRows: [...amcForm.serviceRows, { service: '', frequencyCount: 1, frequencyType: 'Monthly' }] });
  const handleUpdateServiceRow = (i, f, v) => { const rows = [...amcForm.serviceRows]; if (f === 'frequencyType') { const auto = FREQUENCY_COUNT_MAP[v]; rows[i] = { ...rows[i], [f]: v, frequencyCount: auto !== null ? auto : '' }; } else rows[i][f] = v; setAmcForm({ ...amcForm, serviceRows: rows }); };
  const handleRemoveServiceRow = (i) => { if (amcForm.serviceRows.length > 1) setAmcForm({ ...amcForm, serviceRows: amcForm.serviceRows.filter((_, idx) => idx !== i) }); };

  const getPrice = () => parseFloat(amcForm.price) || 0;
  const resetAmcForm = () => { setAmcForm({ packageName: '', description: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); setEditingAmcPackage(null); };
  const getBillingBadgeColor = (billing) => {
    switch (billing) {
      case 'monthly': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'quarterly': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'half-yearly': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'yearly': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
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
              </button>
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setFilterPropertyType(type.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${filterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  {type.label}
                </button>
              ))}
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
              <button onClick={() => setFilterPropertyType('all')} className="mt-2 text-sm text-amber-600 hover:underline">
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
                          <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                            {getPropertyTypeLabel(propertyType)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getBillingBadgeColor(billingDuration)}`}>
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
                                onClick={() => setViewAmcPackage({ ...pkg, servicesData: serviceRows, propertyType, billingDuration })}
                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingAmcPackage(pkg.id);
                                  setAmcForm({
                                    packageName: pkg.name || '',
                                    description: pkg.description || '',
                                    serviceRows: serviceRows.length > 0 ? serviceRows.map(s => ({
                                      service: s.name || s.service || '',
                                      frequencyCount: s.frequency_count || s.frequencyCount || 1,
                                      frequencyType: s.frequency_type || s.frequencyType || 'Monthly'
                                    })) : [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }],
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
                                      frequencyCount: s.frequency_count || s.frequencyCount || 1,
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
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
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
                              min="1"
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
                          <span className="font-medium text-gray-800 truncate ml-2">{amcForm.packageName || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Services</span>
                          <span className="font-medium text-gray-800">{amcForm.serviceRows.filter(r => r.service.trim()).length}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <span className="text-sm font-semibold text-gray-700">Total Rate</span>
                          <span className="text-2xl font-bold text-gray-800">₹{getPrice().toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description - Optional */}
                <div className="mt-6">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={amcForm.description || ''}
                    onChange={(e) => setAmcForm({ ...amcForm, description: e.target.value })}
                    placeholder="Add notes or description for this package..."
                    rows={3}
                    className="w-full max-w-2xl px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400 resize-y"
                  />
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
  const filteredAddons = addonFilterPropertyType === 'all' ? addons : addons.filter(a => a.property_type === addonFilterPropertyType);
  const handleSaveAddon = async () => {
    if (!addonSelectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!addonForm.serviceName.trim()) { showToast('Enter service name', 'error'); return; }
    if (!addonForm.price || parseFloat(addonForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    try {
      const res = await fetch('/api/fp/addons', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ property_type: addonSelectedPropertyType, service_name: addonForm.serviceName, frequency_count: parseInt(addonForm.frequencyCount) || 1, frequency_type: addonForm.frequencyType, billing_cycle: addonForm.billingCycle, price: parseFloat(addonForm.price), description: addonForm.description || '' }) });
      const result = await res.json();
      if (result.success || res.status === 201) { showToast('Add-on created!'); setAddonForm({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' }); setAddonSelectedPropertyType(null); loadData(); setAddonActiveTab('all-addons'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create add-on', 'error'); }
  };
  const handleDeleteAddon = async (id) => { if (!window.confirm('Delete this add-on?')) return; try { const res = await fetch(`/api/fp/addons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };

  const openEditAddon = (addon) => {
    setEditingAddon({
      id: addon.id,
      serviceName: addon.service_name || '',
      frequencyType: addon.frequency_type || 'Monthly',
      frequencyCount: addon.frequency_count || 1,
      propertyType: addon.property_type || 'GC',
      price: addon.price || '',
      description: addon.description || ''
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
      if (result.success || res.status === 201) {
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
              
              {/* Form Row */}
              <div className="flex items-end gap-4 mb-6">
                <div className="flex-1 max-w-xs">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Select Service</label>
                  <input 
                    type="text" 
                    value={addonForm.serviceName} 
                    onChange={(e) => setAddonForm({ ...addonForm, serviceName: e.target.value })} 
                    placeholder="Select or type service" 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400" 
                  />
                </div>
                <div className="w-36">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Frequency</label>
                  <div className="relative">
                    <select 
                      value={addonForm.frequencyType} 
                      onChange={(e) => { 
                        const v = e.target.value; 
                        const auto = FREQUENCY_COUNT_MAP[v]; 
                        setAddonForm({ ...addonForm, frequencyType: v, frequencyCount: auto !== null ? auto : '' }); 
                      }} 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white appearance-none focus:ring-2 focus:ring-gray-100 focus:border-gray-400"
                    >
                      {FREQUENCY_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="w-20">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Visits</label>
                  <input 
                    type="number" 
                    value={addonForm.frequencyCount} 
                    readOnly 
                    className="w-full px-3 py-2.5 border border-gray-300 bg-gray-50 rounded-lg text-sm text-center" 
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Price (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                    <input 
                      type="text" 
                      value={addonForm.price} 
                      onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value.replace(/[^0-9]/g, '') })} 
                      placeholder="0" 
                      className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400" 
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveAddon} 
                  className="px-6 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />Save
                </button>
              </div>
              
              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block uppercase tracking-wider">Description (Optional)</label>
                <textarea 
                  value={addonForm.description} 
                  onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} 
                  placeholder="Add notes or description for this add-on..." 
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400 resize-y" 
                />
              </div>
            </div>
          )}

          {/* Add-ons List for Selected Property Type */}
          {addonSelectedPropertyType && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-1">Add-ons for {PROPERTY_TYPE_OPTIONS.find(t => t.id === addonSelectedPropertyType)?.label}</h3>
              <p className="text-sm text-gray-500 mb-4">{addons.filter(a => a.property_type === addonSelectedPropertyType).length} add-on(s) available</p>
              
              {addons.filter(a => a.property_type === addonSelectedPropertyType).length === 0 ? (
                <div className="py-8 text-center text-gray-400">No add-ons created yet for this property type</div>
              ) : (
                <div className="space-y-3">
                  {addons.filter(a => a.property_type === addonSelectedPropertyType).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <PlusCircle className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{a.service_name}</p>
                          <p className="text-sm text-gray-500">{a.frequency_count}x {a.frequency_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase">Price</p>
                          <p className="font-bold text-gray-800">{formatCurrency(a.price)}</p>
                        </div>
                        {!isFPManager && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditAddon(a)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
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
              <div className="flex gap-2">
                <button onClick={() => setAddonFilterPropertyType('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${addonFilterPropertyType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All</button>
                {PROPERTY_TYPE_OPTIONS.map(t => (
                  <button key={t.id} onClick={() => setAddonFilterPropertyType(t.id)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${addonFilterPropertyType === t.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{t.label}</button>
                ))}
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
              <div className="divide-y divide-gray-100">
                {filteredAddons.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <PlusCircle className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{a.service_name}</p>
                        <p className="text-sm text-gray-500">{a.frequency_count}x {a.frequency_type} • {getPropertyTypeLabel(a.property_type)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase">Price</p>
                        <p className="font-bold text-gray-800">{formatCurrency(a.price)}</p>
                      </div>
                      {!isFPManager && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditAddon(a)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
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
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingAddon.serviceName}
                  onChange={(e) => setEditingAddon({ ...editingAddon, serviceName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <select
                    value={editingAddon.frequencyType}
                    onChange={(e) => {
                      const v = e.target.value;
                      const auto = FREQUENCY_COUNT_MAP[v];
                      setEditingAddon({ ...editingAddon, frequencyType: v, frequencyCount: auto !== null ? auto : editingAddon.frequencyCount });
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                  >
                    {FREQUENCY_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No.of visits</label>
                  <input
                    type="number"
                    value={editingAddon.frequencyCount}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-300 bg-gray-50 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Type <span className="text-red-500">*</span></label>
                <select
                  value={editingAddon.propertyType}
                  onChange={(e) => setEditingAddon({ ...editingAddon, propertyType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={editingAddon.description}
                  onChange={(e) => setEditingAddon({ ...editingAddon, description: e.target.value })}
                  rows={3}
                  placeholder="Add notes or description..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400 resize-none"
                />
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

  // ARCHIVED
  const handleArchiveEstimate = async (id) => { try { const res = await fetch(`/api/fp/estimates/${id}/archive`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate archived'); loadData(); } } catch (e) { showToast('Failed to archive', 'error'); } };
  const handleRestoreEstimate = async (id) => { try { const res = await fetch(`/api/fp/estimates/${id}/restore`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate restored'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleDeletePermanent = async (id) => { try { const res = await fetch(`/api/fp/estimates/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted permanently'); setDeleteConfirm(null); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleDeleteAllArchived = async () => { try { const res = await fetch('/api/fp/estimates/archived/delete-all', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const result = await res.json(); if (result.success || res.status === 201) { showToast(`${result.deletedCount || archivedEstimates.length} archived deleted`); setShowDeleteAllConfirm(false); loadData(); } else { showToast(result.message || 'Failed', 'error'); } } catch (e) { showToast('Failed to delete all', 'error'); } };
  const handleDownloadPDF = (estimate) => { try { exportEstimateToPDF(estimate); showToast('PDF downloaded!'); } catch (e) { showToast('PDF failed', 'error'); } };

  const renderArchived = () => (
    <div className="space-y-4">
      {archivedEstimates.length > 0 && !isFPManager && <div className="flex justify-end"><button onClick={() => setShowDeleteAllConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"><Trash2 className="w-4 h-4" />Delete All ({archivedEstimates.length})</button></div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{archivedEstimates.length === 0 ? <div className="py-16 text-center"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Client</th><th className="px-4 py-3 text-left font-medium text-gray-600">Archived On</th><th className="px-4 py-3 text-left font-medium text-gray-600">Total</th><th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{archivedEstimates.map(e => <tr key={e.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{e.estimate_id}</td><td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3">{e.client_name}</td><td className="px-4 py-3 text-gray-500">{e.archived_at ? new Date(e.archived_at).toLocaleDateString() : '-'}</td><td className="px-4 py-3 font-semibold">{formatCurrency(e.total_amount)}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button onClick={() => handleDownloadPDF(e)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Download PDF"><Download className="w-4 h-4" /></button><button className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"><Eye className="w-4 h-4" /></button><button onClick={() => handleRestoreEstimate(e.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"><RotateCcw className="w-4 h-4" /></button><button onClick={() => setDeleteConfirm(e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
      {deleteConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Permanently?</h3><p className="text-gray-600 mb-4">Are you sure you want to permanently delete estimate <strong>{deleteConfirm.estimate_id}</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button><button onClick={() => handleDeletePermanent(deleteConfirm.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button></div></div></div>}
      {showDeleteAllConfirm && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 max-w-md m-4"><h3 className="text-lg font-semibold text-red-600 mb-2">⚠️ Delete All Archived?</h3><p className="text-gray-600 mb-4">Are you sure you want to permanently delete <strong>all {archivedEstimates.length} archived estimates</strong>? This cannot be undone.</p><div className="flex gap-3 justify-end"><button onClick={() => setShowDeleteAllConfirm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button><button onClick={handleDeleteAllArchived} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete All</button></div></div></div>}
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
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{stats.estimates}</p><p className="text-xs text-gray-500">Active Estimates</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{stats.amcPackages}</p><p className="text-xs text-gray-500">AMC Packages</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{stats.addons}</p><p className="text-xs text-gray-500">Add-ons</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-gray-800">{stats.archived}</p><p className="text-xs text-gray-500">Archived</p></div>
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
              <button onClick={() => setViewEstimate(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div><p className="text-xs text-gray-500">Estimate ID</p><p className="font-medium text-sm">{viewEstimate.estimate_id}</p></div>
                <div><p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    viewEstimate.status === 'approved' ? 'bg-green-100 text-green-700' : 
                    viewEstimate.status === 'sent' ? 'bg-amber-100 text-amber-700' : 
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
                </div>
              </div>

              {/* Customer Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p>
                <div className="bg-amber-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Contact Name</p><p className="font-medium text-sm">{viewEstimate.client_name || viewEstimate.customer_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Phone</p><p className="font-medium text-sm">{viewEstimate.client_phone || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium text-sm">{viewEstimate.client_email || '-'}</p></div>
                </div>
              </div>

              {/* Package */}
              {viewEstimate.package_name && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p>
                  <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-lg">
                    <div>
                      <p className="font-semibold text-indigo-900">{viewEstimate.package_name}</p>
                      <p className="text-xs text-indigo-600">Yearly Billing</p>
                    </div>
                    <p className="text-lg font-bold text-indigo-700">₹{Number(viewEstimate.package_price || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Add-ons */}
              {viewEstimate.addons && viewEstimate.addons.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add-ons</p>
                  <div className="space-y-2">
                    {viewEstimate.addons.map((addon, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-green-50 p-3 rounded-lg">
                        <div>
                          <p className="font-medium text-green-900">{addon.name || addon.service_name}</p>
                          <p className="text-xs text-green-600">{addon.frequency_type || addon.frequencyType || 'One-time'}</p>
                        </div>
                        <p className="font-semibold text-green-700">₹{Number(addon.price || 0).toLocaleString()}</p>
                      </div>
                    ))}
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
                  <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({viewEstimate.gst_percent || 18}%)</span><span>₹{Number(viewEstimate.gst_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-indigo-600">₹{Number(viewEstimate.total_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Created By */}
              <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
                Created by: {viewEstimate.created_by_name || '-'} ({viewEstimate.created_by_role?.replace('_', ' ') || '-'})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View AMC Package Modal */}
      {viewAmcPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">AMC Package Details</h3>
              <button onClick={() => setViewAmcPackage(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Package Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-100">
                <h4 className="text-xl font-bold text-indigo-900">{viewAmcPackage.name}</h4>
                <p className="text-sm text-indigo-600 mt-1">{viewAmcPackage.package_code || `PKG-${viewAmcPackage.id}`}</p>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Property Type</p>
                  <p className="font-semibold text-sm">{getPropertyTypeLabel(viewAmcPackage.propertyType)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Billing Duration</p>
                  <p className="font-semibold text-sm capitalize">{viewAmcPackage.billingDuration || 'Monthly'}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Total Price</p>
                  <p className="font-bold text-lg text-green-700">{formatCurrency(viewAmcPackage.price || viewAmcPackage.base_price)}</p>
                </div>
              </div>

              {/* Description */}
              {viewAmcPackage.description && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Description</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewAmcPackage.description}</p>
                </div>
              )}

              {/* Services Included */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Services Included</p>
                {viewAmcPackage.servicesData && viewAmcPackage.servicesData.length > 0 ? (
                  <div className="space-y-2">
                    {viewAmcPackage.servicesData.map((svc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-amber-50 p-3 rounded-lg border border-amber-100">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                          <p className="font-medium text-amber-900">{svc.name || svc.service || 'Service'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-amber-700">
                            {svc.frequency_count || svc.frequencyCount || 1}x {svc.frequency_type || svc.frequencyType || 'Monthly'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No services listed</p>
                )}
              </div>

              {/* Created Info */}
              <div className="border-t border-gray-100 pt-4 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Created: {viewAmcPackage.created_at ? new Date(viewAmcPackage.created_at).toLocaleDateString() : '-'}</span>
                  <span>ID: {viewAmcPackage.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPEstimates;
