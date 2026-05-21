import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Search, X, Check, AlertCircle, Package, PlusCircle, Archive,
  List, ChevronDown, Building2, User, Trash2, Edit2, Eye, RotateCcw, Calendar,
  DollarSign, Layers, Filter, Download, Mail, Save, Edit
} from 'lucide-react';

const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'Apt', label: 'Apartment' },
  { id: 'Villa', label: 'Villa' },
  { id: 'Flat', label: 'Flat' },
  { id: 'Plot', label: 'Plot' },
];

const FREQUENCY_TYPES = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Custom Months'];
const FREQUENCY_COUNT_MAP = { 'Monthly': 1, 'Quarterly': 3, 'Half-yearly': 6, 'Yearly': 12, 'Custom Months': null };
const BILLING_DURATIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' }
];

const TAB_TITLES = {
  'create': 'Create Estimate', 'list': 'All Estimates', 'amc': 'AMC Packages', 'addons': 'Add-ons', 'archived': 'Archived Estimates'
};

const ManagerEstimates = ({ user, defaultTab = 'list' }) => {
  const navigate = useNavigate();
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
  const [amcActiveTab, setAmcActiveTab] = useState('create');
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);
  const [amcForm, setAmcForm] = useState({ packageName: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' });
  const [filterPropertyType, setFilterPropertyType] = useState('all');
  const [addonActiveTab, setAddonActiveTab] = useState('create');
  const [addonSelectedPropertyType, setAddonSelectedPropertyType] = useState(null);
  const [addonFilterPropertyType, setAddonFilterPropertyType] = useState('all');
  const [addonForm, setAddonForm] = useState({ serviceName: '', frequencyCount: 1, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  useEffect(() => { loadData(); }, [defaultTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [estRes, amcRes, addRes, propRes, archivedRes] = await Promise.all([
        fetch('/api/manager/estimates?archived=false', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/estimates?archived=true', { headers: { 'Authorization': `Bearer ${token}` } })
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

  // CREATE ESTIMATE
  const renderCreateEstimate = () => (
    <div className="space-y-6">
      {!estimateType && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Estimate Type</h2>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <button onClick={() => setEstimateType('property-based')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <Building2 className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-indigo-600">Property-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
            </button>
            <button onClick={() => setEstimateType('direct')} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group">
              <User className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800 group-hover:text-indigo-600">Direct-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
            </button>
          </div>
        </div>
      )}
      {estimateType === 'property-based' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Property-Based Estimate</h2>
            <button onClick={() => { setEstimateType(null); setSelectedProperty(null); setPropertyIdInput(''); }} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={propertyIdInput} onChange={(e) => { setPropertyIdInput(e.target.value); const m = properties.find(p => p.property_id?.toLowerCase() === e.target.value.toLowerCase()); setSelectedProperty(m || null); }} placeholder="Enter property ID..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
              </div>
            </div>
            {selectedProperty && <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4"><p className="font-semibold text-indigo-800">{selectedProperty.community_name || selectedProperty.property_name}</p><p className="text-sm text-indigo-600">{selectedProperty.property_id} • {selectedProperty.property_type}</p></div>}
            <div className="pt-4 border-t border-gray-100"><button onClick={() => navigate('/manager/estimates')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Continue to AMC Packages</button></div>
          </div>
        </div>
      )}
      {estimateType === 'direct' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Direct-Based Estimate</h2>
            <button onClick={() => setEstimateType(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label><input type="text" placeholder="Enter customer name" className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label><input type="tel" placeholder="Enter phone number" className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" placeholder="Enter email" className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label><select className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"><option value="">Select</option>{PROPERTY_TYPE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-100"><button onClick={() => navigate('/manager/estimates')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Continue to AMC Packages</button></div>
        </div>
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th><th className="px-4 py-3 text-left font-medium text-gray-600">Client</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th><th className="px-4 py-3 text-left font-medium text-gray-600">Status</th><th className="px-4 py-3 text-left font-medium text-gray-600">Created</th><th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{filteredEstimates.map((est) => <tr key={est.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{est.estimate_id}</td><td className="px-4 py-3">{est.client_name}</td><td className="px-4 py-3 capitalize">{est.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3 font-semibold">{formatCurrency(est.total_amount)}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.status === 'approved' ? 'bg-green-100 text-green-700' : est.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>{est.status}</span></td><td className="px-4 py-3 text-gray-500">{est.created_at ? new Date(est.created_at).toLocaleDateString() : '-'}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button><button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Archive className="w-4 h-4" /></button></div></td></tr>)}</tbody>
          </table>
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
      const res = await fetch('/api/manager/amc-packages', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: amcForm.packageName, property_type: selectedPropertyType, services: validSvc.map(r => ({ name: r.service, frequency_count: parseInt(r.frequencyCount) || 1, frequency_type: r.frequencyType })), price: parseFloat(amcForm.price), billing_duration: amcForm.billingDuration }) });
      const result = await res.json();
      if (result.success) { showToast('AMC Package created!'); setAmcForm({ packageName: '', serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }], price: '', billingDuration: 'monthly' }); setSelectedPropertyType(null); loadData(); setAmcActiveTab('all-packages'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create package', 'error'); }
  };
  const handleDeleteAmcPackage = async (id) => { if (!window.confirm('Delete this package?')) return; try { const res = await fetch(`/api/manager/amc-packages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setAmcActiveTab('create')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${amcActiveTab === 'create' ? 'bg-white text-slate-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Package
          </div>
        </button>
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
                    const servicesText = pkg.services || (pkg.services_data ? pkg.services_data.map(s => s.name).join(', ') : '-');
                    return (
                      <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{pkg.name || 'Unnamed Package'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                            {PROPERTY_TYPE_OPTIONS.find(t => t.id === pkg.property_type)?.label || pkg.property_type || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getBillingBadgeColor(pkg.billing_duration)}`}>
                            {BILLING_DURATIONS.find(d => d.value === pkg.billing_duration)?.label || 'Monthly'}
                          </span>
                        </td>
                        <td className="px-4 py-4 max-w-xs">
                          <p className="text-sm text-gray-600 truncate" title={servicesText}>{servicesText}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-lg font-bold text-slate-800">{formatCurrency(pkg.price)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Export PDF">
                              <Download className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Email">
                              <Mail className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteAmcPackage(pkg.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
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
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency Type</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency Count</span>
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
                              onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                              placeholder={row.frequencyType === 'Custom Months' ? 'Enter months' : ''}
                              readOnly={row.frequencyType !== 'Custom Months'}
                              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 ${
                                row.frequencyType === 'Custom Months' 
                                  ? 'border-blue-300 bg-blue-50' 
                                  : 'border-gray-300 bg-gray-100 cursor-not-allowed'
                              }`}
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
  const filteredAddons = addonFilterPropertyType === 'all' ? addons : addons.filter(a => a.property_type === addonFilterPropertyType);
  const handleSaveAddon = async () => {
    if (!addonSelectedPropertyType) { showToast('Select property type', 'error'); return; }
    if (!addonForm.serviceName.trim()) { showToast('Enter service name', 'error'); return; }
    if (!addonForm.price || parseFloat(addonForm.price) <= 0) { showToast('Enter valid price', 'error'); return; }
    try {
      const res = await fetch('/api/manager/addons', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ property_type: addonSelectedPropertyType, service_name: addonForm.serviceName, frequency_count: parseInt(addonForm.frequencyCount) || 1, frequency_type: addonForm.frequencyType, billing_cycle: addonForm.billingCycle, price: parseFloat(addonForm.price) }) });
      const result = await res.json();
      if (result.success) { showToast('Add-on created!'); setAddonForm({ serviceName: '', frequencyCount: 1, frequencyType: 'Monthly', billingCycle: 'Monthly', price: '' }); setAddonSelectedPropertyType(null); loadData(); setAddonActiveTab('all-addons'); }
      else showToast(result.message || 'Failed', 'error');
    } catch (e) { showToast('Failed to create add-on', 'error'); }
  };
  const handleDeleteAddon = async (id) => { if (!window.confirm('Delete this add-on?')) return; try { const res = await fetch(`/api/manager/addons/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };

  const renderAddons = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center"><PlusCircle className="w-5 h-5 text-stone-600" /></div><div><h2 className="text-xl font-bold text-gray-900">Add-ons</h2><p className="text-sm text-gray-500">Create optional services for AMC packages by property type</p></div></div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setAddonActiveTab('create')} className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${addonActiveTab === 'create' ? 'bg-white text-stone-700 shadow-sm' : 'text-gray-600'}`}><Plus className="w-4 h-4" />Create Add-on</button>
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
                  <div className="col-span-1"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Count</label><input type="number" value={addonForm.frequencyCount} onChange={(e) => setAddonForm({ ...addonForm, frequencyCount: e.target.value })} readOnly={addonForm.frequencyType !== 'Custom Months'} className={`w-full px-2 py-2.5 border rounded-lg text-sm text-center ${addonForm.frequencyType === 'Custom Months' ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-100'}`} /></div>
                  <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Period</label><select value={addonForm.billingCycle} onChange={(e) => setAddonForm({ ...addonForm, billingCycle: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Half-Yearly">Half-Yearly</option><option value="Yearly">Yearly</option></select></div>
                  <div className="col-span-2"><label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Price (₹)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span><input type="text" value={addonForm.price} onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value.replace(/[^0-9]/g, '') })} placeholder="0" className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm" /></div></div>
                  <div className="col-span-2"><button onClick={handleSaveAddon} className="w-full px-4 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 font-medium flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Save</button></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {addonActiveTab === 'all-addons' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-gray-900">All Add-ons</h3><p className="text-sm text-gray-500">{addons.length} add-on(s) available</p></div><div className="flex gap-2"><button onClick={() => setAddonFilterPropertyType('all')} className={`px-3 py-1.5 text-sm rounded-lg ${addonFilterPropertyType === 'all' ? 'bg-stone-700 text-white' : 'bg-gray-100 text-gray-700'}`}>All</button>{PROPERTY_TYPE_OPTIONS.map(t => <button key={t.id} onClick={() => setAddonFilterPropertyType(t.id)} className={`px-3 py-1.5 text-sm rounded-lg ${addonFilterPropertyType === t.id ? 'bg-stone-700 text-white' : 'bg-gray-100 text-gray-700'}`}>{t.label}</button>)}</div></div></div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{filteredAddons.length === 0 ? <div className="py-16 text-center"><PlusCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No add-ons found</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Add-on Name</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Property Type</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Frequency</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Count</th><th className="px-4 py-3 text-left font-medium text-gray-600 uppercase text-xs">Total Rate</th><th className="px-4 py-3 text-center font-medium text-gray-600 uppercase text-xs">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredAddons.map(a => <tr key={a.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{a.service_name}</td><td className="px-4 py-3 text-gray-500">{PROPERTY_TYPE_OPTIONS.find(t => t.id === a.property_type)?.label || '-'}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.frequency_type === 'Monthly' ? 'bg-blue-100 text-blue-700' : a.frequency_type === 'Quarterly' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>{a.frequency_type}</span></td><td className="px-4 py-3 text-gray-600">{a.frequency_count}x</td><td className="px-4 py-3 font-semibold">{formatCurrency(a.price)}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteAddon(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
        </div>
      )}
    </div>
  );

  // ARCHIVED
  const handleRestoreEstimate = async (id) => { try { const res = await fetch(`/api/manager/estimates/${id}/restore`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Estimate restored'); loadData(); } } catch (e) { showToast('Failed', 'error'); } };
  const handleDeletePermanent = async (id) => { try { const res = await fetch(`/api/manager/estimates/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) { showToast('Deleted permanently'); setDeleteConfirm(null); loadData(); } } catch (e) { showToast('Failed', 'error'); } };

  const renderArchived = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">{archivedEstimates.length === 0 ? <div className="py-16 text-center"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-medium">No archived estimates</p><p className="text-sm text-gray-400">Archived estimates will appear here</p></div> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left font-medium text-gray-600">Estimate ID</th><th className="px-4 py-3 text-left font-medium text-gray-600">Type</th><th className="px-4 py-3 text-left font-medium text-gray-600">Client</th><th className="px-4 py-3 text-left font-medium text-gray-600">Archived On</th><th className="px-4 py-3 text-left font-medium text-gray-600">Total</th><th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{archivedEstimates.map(e => <tr key={e.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{e.estimate_id}</td><td className="px-4 py-3 capitalize">{e.estimate_type?.replace('_', ' ')}</td><td className="px-4 py-3">{e.client_name}</td><td className="px-4 py-3 text-gray-500">{e.archived_at ? new Date(e.archived_at).toLocaleDateString() : '-'}</td><td className="px-4 py-3 font-semibold">{formatCurrency(e.total_amount)}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button><button onClick={() => handleRestoreEstimate(e.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"><RotateCcw className="w-4 h-4" /></button><button onClick={() => setDeleteConfirm(e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></td></tr>)}</tbody></table>}</div>
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
            <div className="flex gap-6">
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
    </div>
  );
};

export default ManagerEstimates;
