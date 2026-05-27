import { useState, useEffect } from 'react';
import { FileText, Plus, Search, RefreshCw, X, Save, AlertCircle, CheckCircle, Package, PlusCircle, Archive, List, Trash2, Eye, Layers, Edit, Download, Mail, EyeOff, Calendar, Filter, Home, Building2 } from 'lucide-react';

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

const ExecutiveEstimates = ({ user, defaultTab = 'list' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [estimates, setEstimates] = useState([]);
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

  const [estimateForm, setEstimateForm] = useState({ clientId: '', propertyId: '', title: '', description: '', estimateType: 'property_based', subtotal: 0, taxPercentage: 18, discountPercentage: 0, validUntil: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] });
  const [amcForm, setAmcForm] = useState({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true });
  const [addonForm, setAddonForm] = useState({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true });

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
      const [estRes, amcRes, addRes, custRes, propRes, catRes] = await Promise.all([
        fetch(`/api/executive/estimates${activeTab === 'archived' ? '?archived=true' : '?archived=false'}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/executive/categories', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [estData, amcData, addData, custData, propData, catData] = await Promise.all([estRes.json(), amcRes.json(), addRes.json(), custRes.json(), propRes.json(), catRes.json()]);
      if (estData.success) setEstimates(estData.data);
      if (amcData.success) setAmcPackages(amcData.data);
      if (addData.success) setAddons(addData.data);
      if (custData.success) setCustomers(custData.data);
      if (propData.success) setProperties(propData.data);
      if (catData.success) setCategories(catData.data);
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

  const resetEstimateForm = () => { setEstimateForm({ clientId: '', propertyId: '', title: '', description: '', estimateType: 'property_based', subtotal: 0, taxPercentage: 18, discountPercentage: 0, validUntil: '', items: [{ description: '', quantity: 1, unitPrice: 0 }] }); };
  const resetAmcForm = () => { setAmcForm({ name: '', description: '', durationMonths: 12, basePrice: 0, services: '', termsConditions: '', hidePricing: true }); };
  const resetAddonForm = () => { setAddonForm({ name: '', description: '', price: 0, unit: 'per_service', categoryId: '', hidePricing: true }); };

  const addLineItem = () => { setEstimateForm({ ...estimateForm, items: [...estimateForm.items, { description: '', quantity: 1, unitPrice: 0 }] }); };
  const removeLineItem = (index) => { if (estimateForm.items.length > 1) setEstimateForm({ ...estimateForm, items: estimateForm.items.filter((_, i) => i !== index) }); };
  const updateLineItem = (index, field, value) => { const updatedItems = [...estimateForm.items]; updatedItems[index][field] = value; setEstimateForm({ ...estimateForm, items: updatedItems }); };

  const getStatusColor = (status) => { const colors = { draft: 'bg-gray-100 text-gray-700', pending_approval: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', converted: 'bg-blue-100 text-blue-700', archived: 'bg-gray-100 text-gray-500' }; return colors[status] || 'bg-gray-100 text-gray-700'; };
  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);
  const calculateTotals = () => { const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0); const tax = (subtotal * estimateForm.taxPercentage) / 100; const discount = (subtotal * estimateForm.discountPercentage) / 100; return { subtotal, tax, discount, total: subtotal + tax - discount }; };

  const filteredEstimates = estimates.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.estimate_id?.toLowerCase().includes(searchTerm.toLowerCase()) || e.client_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* View Only Access Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Eye className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-800">View Only Access</h3>
          <p className="text-sm text-amber-700">You can create estimates but AMC packages and add-ons are view-only. Pricing is hidden.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Estimates / AMC Management</h1><p className="text-gray-500 mt-1">Create estimates and view AMC packages</p></div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-1">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
      ) : (
        <>
          {(activeTab === 'list' || activeTab === 'archived') && (
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
                        <tr><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimate ID</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th><th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th><th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEstimates.map((estimate) => {
                          const TypeIcon = estimate.property_type === 'Apt' ? Home : Building2;
                          return (
                            <tr key={estimate.id} className="hover:bg-gray-50">
                              <td className="py-4 px-4"><span className="font-medium text-gray-900">{estimate.estimate_id || `EST-${estimate.id}`}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-gray-400" /><span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">{estimate.property_type || 'GC'}</span></div></td>
                              <td className="py-4 px-4"><span className="text-gray-700">{estimate.client_name || '-'}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center gap-1.5 text-gray-600"><Calendar className="w-4 h-4" />{estimate.created_at ? new Date(estimate.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '-'}</div></td>
                              <td className="py-4 px-4"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(estimate.status)}`}>{estimate.status?.charAt(0).toUpperCase() + estimate.status?.slice(1) || 'Draft'}</span></td>
                              <td className="py-4 px-4"><div className="flex items-center justify-center"><button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button></div></td>
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
              {!estimateForm.estimateType || estimateForm.estimateType === 'select' ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Select Estimate Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'property_based' })} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-center">
                      <FileText className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                      <p className="font-semibold text-gray-900">Property-Based Estimate</p>
                      <p className="text-sm text-indigo-600 mt-1">Enter Property ID to auto-fill details</p>
                    </button>
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'direct' })} className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-center">
                      <Eye className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                      <p className="font-semibold text-gray-900">Direct-Based Estimate</p>
                      <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEstimateSubmit} className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Estimate Details</h3></div>
                    <div className="p-6">
                      {estimateForm.estimateType === 'property_based' ? (
                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Property ID <span className="text-red-500">*</span></label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Type Property ID (e.g., GC-2024-001)" value={estimateForm.propertyId} onChange={(e) => setEstimateForm({ ...estimateForm, propertyId: e.target.value })} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div></div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label><input type="text" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Customer name" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input type="text" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Phone number" /></div>
                          <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg" placeholder="Email address" /></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">AMC Package</h3></div>
                    <div className="p-6 space-y-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Select AMC Package <span className="text-red-500">*</span></label><select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"><option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>{amcPackages.map((pkg) => (<option key={pkg.id} value={pkg.id}>{pkg.name}</option>))}</select></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Add Service from Add-ons</label><select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"><option value="">+ Select Add-on to add</option>{addons.map((addon) => (<option key={addon.id} value={addon.id}>{addon.name}</option>))}</select><div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center text-sm text-amber-700">No add-ons selected. Use the dropdown above to add services.</div></div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setEstimateForm({ ...estimateForm, estimateType: 'select' })} className="px-6 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium">Save</button>
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
                          : `${amcPackages.filter(p => p.property_type === filterPropertyType).length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
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
                ) : (filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => p.property_type === filterPropertyType)).length === 0 ? (
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
                        {(filterPropertyType === 'all' ? amcPackages : amcPackages.filter(p => p.property_type === filterPropertyType)).map((pkg) => {
                          const servicesText = pkg.services || (pkg.services_data ? pkg.services_data.map(s => s.name).join(', ') : '-');
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
                              <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">{PROPERTY_TYPE_OPTIONS.find(t => t.id === pkg.property_type)?.label || pkg.property_type || '-'}</span></td>
                              <td className="px-4 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getBillingBadgeColor(pkg.billing_duration)}`}>{BILLING_DURATIONS.find(d => d.value === pkg.billing_duration)?.label || 'Monthly'}</span></td>
                              <td className="px-4 py-4 max-w-xs"><p className="text-sm text-gray-600 truncate" title={servicesText}>{servicesText}</p></td>
                              <td className="px-4 py-4 text-right"><span className="text-sm text-gray-400 italic flex items-center justify-end gap-1"><EyeOff className="w-3 h-3" /> Hidden</span></td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                                  <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Export PDF"><Download className="w-4 h-4" /></button>
                                  <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Email"><Mail className="w-4 h-4" /></button>
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
                    <div><h3 className="text-lg font-semibold text-gray-800">All Add-ons</h3><p className="text-sm text-gray-500">{addonFilterPropertyType === 'all' ? `${addons.length} add-on(s) available` : `${addons.filter(a => a.property_type === addonFilterPropertyType).length} add-on(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === addonFilterPropertyType)?.label}`}</p></div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setAddonFilterPropertyType('all')} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${addonFilterPropertyType === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>All</button>
                    {PROPERTY_TYPE_OPTIONS.map((type) => (<button key={type.id} onClick={() => setAddonFilterPropertyType(type.id)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${addonFilterPropertyType === type.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>{type.label}</button>))}
                  </div>
                </div>
                {addons.length === 0 ? (<div className="p-12 text-center"><PlusCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No add-ons available</p></div>
                ) : (addonFilterPropertyType === 'all' ? addons : addons.filter(a => a.property_type === addonFilterPropertyType)).length === 0 ? (<div className="p-8 text-center"><p className="text-gray-500">No add-ons found for this property type</p><button onClick={() => setAddonFilterPropertyType('all')} className="mt-2 text-sm text-blue-600 hover:underline">Show all add-ons</button></div>
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
                        {(addonFilterPropertyType === 'all' ? addons : addons.filter(a => a.property_type === addonFilterPropertyType)).map((addon) => {
                          const getFrequencyBadgeColor = (freq) => { switch(freq?.toLowerCase()) { case 'monthly': return 'bg-blue-100 text-blue-700 border-blue-200'; case 'every 2 months': return 'bg-cyan-100 text-cyan-700 border-cyan-200'; case 'quarterly': return 'bg-purple-100 text-purple-700 border-purple-200'; default: return 'bg-gray-100 text-gray-700 border-gray-200'; } };
                          return (
                            <tr key={addon.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4"><span className="font-semibold text-gray-900">{addon.name || 'Unnamed Add-on'}</span></td>
                              <td className="px-4 py-4"><span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">{PROPERTY_TYPE_OPTIONS.find(t => t.id === addon.property_type)?.label || addon.property_type || '-'}</span></td>
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
    </div>
  );
};

export default ExecutiveEstimates;
