import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, X, Check, AlertCircle, Package, PlusCircle, Archive,
  List, ChevronDown, Building2, User, Trash2, Edit2, Eye, RotateCcw, Calendar,
  DollarSign, Layers, Filter, Download, Mail, Save, Edit, RefreshCw
} from 'lucide-react';
import { FREQUENCY_TYPES, FREQUENCY_COUNT_MAP } from '../utils/estimateStore';
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
  return normalize(filterId) === normalizedValue || 
         (filterOption && normalize(filterOption.label) === normalizedValue);
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
  // Check if this is an FP-created Manager (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
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
  const [estimateType, setEstimateType] = useState(null);
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  // Managers cannot create packages - always default to all-packages
  const [amcActiveTab, setAmcActiveTab] = useState('all-packages');
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);
  const [amcForm, setAmcForm] = useState({ packageName: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' });
  const [filterPropertyType, setFilterPropertyType] = useState('all');
  // Managers cannot create add-ons - always default to all-addons
  const [addonActiveTab, setAddonActiveTab] = useState('all-addons');
  const [addonSelectedPropertyType, setAddonSelectedPropertyType] = useState(null);
  const [addonFilterPropertyType, setAddonFilterPropertyType] = useState('all');
  const [addonForm, setAddonForm] = useState({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [viewAmcPackage, setViewAmcPackage] = useState(null);
  const [viewAddon, setViewAddon] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  // Auto-refresh every 30 seconds to sync with FP updates
  useEffect(() => { 
    loadData(); 
    const interval = setInterval(() => {
      loadData(true); // silent refresh
    }, 30000);
    return () => clearInterval(interval);
  }, [defaultTab]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [estRes, amcRes, addRes, propRes, archivedRes] = await Promise.all([
        fetch('/api/coordinator/estimates?archived=false', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/estimates?archived=true', { headers: { 'Authorization': `Bearer ${token}` } })
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

  // CREATE ESTIMATE - State for new form
  const [selectedAmcPackage, setSelectedAmcPackage] = useState('');
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  
  // Direct Estimate form state
  const [directForm, setDirectForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    propertyType: '',
    propertyName: '',
    zone: '',
    city: '',
    address: ''
  });

  // Calculate price summary
  const calculatePriceSummary = () => {
    let subTotal = 0;
    const pkg = amcPackages.find(p => p.id?.toString() === selectedAmcPackage);
    if (pkg) subTotal += parseFloat(pkg.price) || 0;
    selectedAddons.forEach(addonId => {
      const addon = addons.find(a => a.id?.toString() === addonId);
      if (addon) subTotal += parseFloat(addon.price) || 0;
    });
    const discountAmount = (subTotal * discountPercent) / 100;
    const afterDiscount = subTotal - discountAmount;
    const gstAmount = (afterDiscount * gstPercent) / 100;
    const totalAmount = afterDiscount + gstAmount;
    return { subTotal, discountAmount, gstAmount, totalAmount };
  };

  const priceSummary = calculatePriceSummary();

  const handleSaveEstimate = async () => {
    if (!propertyIdInput) { showToast('Enter Property ID', 'error'); return; }
    if (!selectedAmcPackage) { showToast('Select AMC Package', 'error'); return; }
    try {
      const res = await fetch('/api/coordinator/estimates', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyIdInput,
          amc_package_id: selectedAmcPackage,
          addon_ids: selectedAddons,
          discount_percent: discountPercent,
          gst_percent: gstPercent,
          sub_total: priceSummary.subTotal,
          total_amount: priceSummary.totalAmount
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast('Estimate created successfully!');
        setPropertyIdInput('');
        setSelectedAmcPackage('');
        setSelectedAddons([]);
        setDiscountPercent(0);
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
    setDiscountPercent(0);
    setGstPercent(18);
    setDirectForm({
      customerName: '', phone: '', email: '',
      propertyType: '', propertyName: '', zone: '', city: '', address: ''
    });
  };

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
                const propertyType = selectedProperty?.entryType || selectedProperty?.propertyType || directForm?.propertyType;
                const filteredPkgs = propertyType ? amcPackages.filter(pkg => {
                  const pkgType = (pkg.property_type || pkg.propertyType || '').toUpperCase();
                  const searchType = propertyType.toUpperCase();
                  return pkgType === searchType || pkgType === 'GC' && searchType === 'GC';
                }) : amcPackages;
                const otherPkgs = propertyType ? amcPackages.filter(pkg => !filteredPkgs.includes(pkg)) : [];
                return (<>
                  {filteredPkgs.length > 0 && propertyType && <optgroup label={`For ${propertyType}`}>{filteredPkgs.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>)}</optgroup>}
                  {otherPkgs.length > 0 && <optgroup label="Other Packages">{otherPkgs.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>)}</optgroup>}
                  {!propertyType && amcPackages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>)}
                </>);
              })()}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Service from Add-ons</label>
            <select
              onChange={(e) => {
                if (e.target.value && !selectedAddons.includes(e.target.value)) {
                  setSelectedAddons([...selectedAddons, e.target.value]);
                }
                e.target.value = '';
              }}
              className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            >
              <option value="">+ Select Add-on to add</option>
              {(() => {
                const propertyType = selectedProperty?.entryType || selectedProperty?.propertyType || directForm?.propertyType;
                const filteredAddons = propertyType ? addons.filter(addon => {
                  const addonType = (addon.property_type || addon.propertyType || '').toUpperCase();
                  const searchType = propertyType.toUpperCase();
                  return addonType === searchType || addonType === 'GC' && searchType === 'GC';
                }) : addons;
                const otherAddons = propertyType ? addons.filter(addon => !filteredAddons.includes(addon)) : [];
                return (<>
                  {filteredAddons.length > 0 && propertyType && <optgroup label={`For ${propertyType}`}>{filteredAddons.map(addon => <option key={addon.id} value={addon.id}>{addon.name} - {formatCurrency(addon.price)}</option>)}</optgroup>}
                  {otherAddons.length > 0 && <optgroup label="Other Add-ons">{otherAddons.map(addon => <option key={addon.id} value={addon.id}>{addon.name} - {formatCurrency(addon.price)}</option>)}</optgroup>}
                  {!propertyType && addons.map(addon => <option key={addon.id} value={addon.id}>{addon.name} - {formatCurrency(addon.price)}</option>)}
                </>);
              })()}
            </select>
          </div>
          {selectedAddons.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-amber-700">No add-ons selected. Use the dropdown above to add services.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedAddons.map(addonId => {
                const addon = addons.find(a => a.id?.toString() === addonId);
                return addon ? (
                  <div key={addonId} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <span className="text-blue-800">{addon.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-blue-700">{formatCurrency(addon.price)}</span>
                      <button onClick={() => setSelectedAddons(selectedAddons.filter(id => id !== addonId))} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : null;
              })}
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

      {/* Footer Note & Buttons */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">* Currency: INR (₹) | GST: 18% applied on total | Fields marked with * are mandatory | Direct estimates are saved to Archive section</p>
        <div className="flex gap-3">
          <button onClick={resetEstimateForm} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
          {showSaveButton && (
            <button onClick={handleSaveEstimate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
          )}
        </div>
      </div>
    </>
  );

  const renderCreateEstimate = () => (
    <div className="space-y-6">
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
            <button onClick={() => setEstimateType('direct')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
              <User className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-blue-600">Direct Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
            </button>
          </div>
        </div>
      )}

      {/* Property-Based Estimate */}
      {estimateType === 'property-based' && (
        <>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Estimate Details</h2>
              <button onClick={() => setEstimateType(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
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
                        <input type="text" value={`${selectedProperty.units || selectedProperty.total_units || selectedProperty.number_of_units || 1} Units`} readOnly className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {renderAmcAndPriceSummary(false)}
        </>
      )}

      {/* Direct Estimate */}
      {estimateType === 'direct' && (
        <>
          {/* Customer Information */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Customer Information</h2>
              <button onClick={() => setEstimateType(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" value={directForm.customerName} onChange={(e) => setDirectForm({...directForm, customerName: e.target.value})} placeholder="Enter customer name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone <span className="text-red-500">*</span></label>
                  <div className="flex">
                    <select className="px-3 py-3 border border-gray-300 rounded-l-lg bg-gray-50 text-sm">
                      <option>+91</option>
                    </select>
                    <input type="tel" value={directForm.phone} onChange={(e) => setDirectForm({...directForm, phone: e.target.value})} placeholder="10-digit phone number" className="flex-1 px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
                <div>
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
            </div>
          </div>

          {renderAmcAndPriceSummary(true)}
        </>
      )}
    </div>
  );

  // ALL ESTIMATES
  const filteredEstimates = estimates.filter(e => (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.estimate_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const renderAllEstimates = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search estimates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"><Filter className="w-4 h-4" />Filters<ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="py-16 text-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div> : filteredEstimates.length === 0 ? <div className="py-16 text-center"><DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No estimates found</p><p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs">Estimate ID</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs">Client</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden sm:table-cell">Type</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs">Amount</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden md:table-cell">Status</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden lg:table-cell">Created By</th><th className="px-3 py-3 text-left font-medium text-gray-600 whitespace-nowrap text-xs hidden lg:table-cell">Created</th><th className="px-3 py-3 text-center font-medium text-gray-600 whitespace-nowrap text-xs">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{filteredEstimates.map((est) => <tr key={est.id} className="hover:bg-gray-50"><td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{est.estimate_id}</td><td className="px-3 py-3 truncate max-w-[120px]">{est.client_name}</td><td className="px-3 py-3 whitespace-nowrap hidden sm:table-cell"><span className={`px-2 py-0.5 rounded text-xs font-medium ${est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{est.estimate_type === 'property_based' || est.estimate_type === 'property-based' ? 'Property' : 'Direct'}</span></td><td className="px-3 py-3 font-semibold whitespace-nowrap">{formatCurrency(est.total_amount)}</td><td className="px-3 py-3 hidden md:table-cell"><span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${est.status === 'approved' ? 'bg-green-100 text-green-700' : est.status === 'rejected' ? 'bg-red-100 text-red-700' : est.status === 'sent' ? 'bg-blue-100 text-blue-700' : est.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{est.status || 'draft'}</span></td><td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden lg:table-cell truncate max-w-[100px]">{est.created_by_name || '-'}</td><td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden lg:table-cell">{est.created_at ? new Date(est.created_at).toLocaleDateString() : '-'}</td><td className="px-3 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewEstimate(est)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // AMC PACKAGES
  const filteredAmcPackages = filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => matchPropertyType(p.property_type, filterPropertyType));
  const handleSaveAmcPackage = async () => {
    if (!amcForm.packageName.trim()) { showToast('Enter package name', 'error'); return; }
    if (!selectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!amcForm.price || parseFloat(amcForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    const validSvc = amcForm.serviceRows.filter(r => r.service.trim());
    if (validSvc.length === 0) { showToast('Add at least one service', 'error'); return; }
    try {
      const res = await fetch('/api/coordinator/amc-packages', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: amcForm.packageName, property_type: selectedPropertyType, services: validSvc.map(r => ({ name: r.service, frequency_count: parseInt(r.frequencyCount) || 1, frequency_type: r.frequencyType })), price: parseFloat(amcForm.price), billing_duration: amcForm.billingDuration }) });
      const result = await res.json();
      if (result.success) { showToast('AMC Package created!'); setAmcForm({ packageName: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); loadData(); setAmcActiveTab('all-packages'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create package', 'error'); }
  };
  const handleDeleteAmcPackage = async (id) => { if (!window.confirm('Delete this package?')) return; try { const res = await fetch(`/api/coordinator/amc-packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleAddServiceRow = () => setAmcForm({ ...amcForm, serviceRows: [...amcForm.serviceRows, { service: '', frequencyCount: 1, frequencyType: 'Monthly' }] });
  const handleUpdateServiceRow = (i, f, v) => { const rows = [...amcForm.serviceRows]; if (f === 'frequencyType') { const auto = FREQUENCY_COUNT_MAP[v]; rows[i] = { ...rows[i], [f]: v, frequencyCount: auto !== null ? auto : '' }; } else rows[i][f] = v; setAmcForm({ ...amcForm, serviceRows: rows }); };
  const handleRemoveServiceRow = (i) => { if (amcForm.serviceRows.length > 1) setAmcForm({ ...amcForm, serviceRows: amcForm.serviceRows.filter((_, idx) => idx !== i) }); };

  const getPrice = () => parseFloat(amcForm.price) || 0;
  const resetAmcForm = () => { setAmcForm({ packageName: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); };
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
                    // Property type and billing duration might be in services JSON or as separate columns
                    const propertyType = pkg.property_type || servicesData?.property_type || '-';
                    const billingDuration = pkg.billing_duration || servicesData?.billing_duration || 'monthly';
                    return (
                      <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{pkg.name || 'Unnamed Package'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                            {PROPERTY_TYPE_OPTIONS.find(t => t.id === propertyType)?.label || propertyType || '-'}
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
                        <td className="px-4 py-4 text-right">
                          <span className="text-lg font-bold text-slate-800">{formatCurrency(pkg.price || pkg.base_price)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center">
                            <button 
                              onClick={() => setViewAmcPackage({ ...pkg, servicesData, serviceRows, propertyType, billingDuration })}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
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
      const res = await fetch('/api/coordinator/addons', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ property_type: addonSelectedPropertyType, service_name: addonForm.serviceName, frequency_count: parseInt(addonForm.frequencyCount) || 1, frequency_type: addonForm.frequencyType, billing_cycle: addonForm.billingCycle, price: parseFloat(addonForm.price), description: addonForm.description || '' }) });
      const result = await res.json();
      if (result.success) { showToast('Add-on created!'); setAddonForm({ serviceName: '', frequencyCount: 12, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '', description: '' }); setAddonSelectedPropertyType(null); loadData(); setAddonActiveTab('all-addons'); }
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
                  <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Price (₹)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span><input type="text" value={addonForm.price} onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0" className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div></div>
                  <div className="col-span-2"><button onClick={handleSaveAddon} className="w-full px-4 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 font-medium flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Save</button></div>
                </div>
                <div className="mt-3"><input type="text" value={addonForm.description} onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })} placeholder="Add description/notes (optional)" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
            </div>
          )}
        </div>
      )}
      {addonActiveTab === 'all-addons' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-gray-900">All Add-ons</h3><p className="text-sm text-gray-500">{addons.length} add-on(s) available</p></div><div className="flex gap-2"><button onClick={() => setAddonFilterPropertyType('all')} className={`px-3 py-1.5 text-sm rounded-lg ${addonFilterPropertyType === 'all' ? 'bg-stone-700 text-white' : 'bg-gray-100 text-gray-700'}`}>All</button>{PROPERTY_TYPE_OPTIONS.map(t => <button key={t.id} onClick={() => setAddonFilterPropertyType(t.id)} className={`px-3 py-1.5 text-sm rounded-lg ${addonFilterPropertyType === t.id ? 'bg-stone-700 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.label}</button>)}</div></div></div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{filteredAddons.length === 0 ? <div className="py-16 text-center"><p className="text-gray-500">No add-ons found</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Add-on Name</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Property Type</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Frequency</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">No.of visits</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Total Rate</th><th className="px-4 py-3 text-center font-medium text-gray-600 uppercase text-xs">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredAddons.map(a => <tr key={a.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{a.service_name}</td><td className="px-4 py-3 text-gray-500">{PROPERTY_TYPE_OPTIONS.find(t => t.id === a.property_type)?.label || '-'}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.frequency_type === 'Monthly' ? 'bg-blue-100 text-blue-700' : a.frequency_type === 'Quarterly' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{a.frequency_type}</span></td><td className="px-4 py-3 text-gray-600">{a.frequency_count}x</td><td className="px-4 py-3 font-semibold">{formatCurrency(a.price)}</td><td className="px-4 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewAddon(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{archivedEstimates.length === 0 ? <div className="py-16 text-center"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Client</th><th className="px-4 py-3 text-left font-medium text-gray-600">Archived On</th><th className="px-4 py-3 text-left font-medium text-gray-600">Total</th><th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{archivedEstimates.map(e => <tr key={e.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{e.estimate_id}</td><td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3">{e.client_name}</td><td className="px-4 py-3 text-gray-500">{e.archived_at ? new Date(e.archived_at).toLocaleDateString() : '-'}</td><td className="px-4 py-3 font-semibold">{formatCurrency(e.total_amount)}</td><td className="px-4 py-3"><div className="flex items-center justify-center"><button onClick={() => setViewEstimate(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="View Details"><Eye className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
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
                Created by: {viewEstimate.created_by_name || '-'}
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
                  <p className="font-semibold text-sm">{PROPERTY_TYPE_OPTIONS.find(t => t.id === viewAmcPackage.propertyType)?.label || viewAmcPackage.propertyType || '-'}</p>
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
                {viewAmcPackage.serviceRows && viewAmcPackage.serviceRows.length > 0 ? (
                  <div className="space-y-2">
                    {viewAmcPackage.serviceRows.map((svc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                          <p className="font-medium text-blue-900">{svc.name || svc.service || 'Service'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-blue-700">
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
                <p className="text-lg font-semibold text-green-900">{viewAddon.service_name}</p>
                <p className="text-sm text-green-600">{PROPERTY_TYPE_OPTIONS.find(t => t.id === viewAddon.property_type)?.label || viewAddon.property_type}</p>
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
                  <p className="text-sm text-gray-700">{viewAddon.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorEstimates;

