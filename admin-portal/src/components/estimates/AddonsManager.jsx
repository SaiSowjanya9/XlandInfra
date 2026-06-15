import { useState, useEffect } from 'react';
import { Trash2, PlusCircle, ChevronDown, Plus, Layers, Edit2, X } from 'lucide-react';
import {
  getAddons, createAddon, deleteAddon, updateAddon, fetchAddons,
  getServices, FREQUENCY_TYPES, FREQUENCY_COUNT_MAP
} from '../../utils/estimateStore';

// Property Type options for Add-ons (simple style matching other sections)
const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'APT', label: 'Apartment' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'PLOT', label: 'Plot' },
];

// Helper to normalize property type for consistent filtering
const normalizePropertyType = (type) => {
  if (!type) return '';
  const upper = type.toUpperCase();
  if (upper === 'GC' || upper.includes('GATED')) return 'GC';
  if (upper === 'APT' || upper.includes('APARTMENT')) return 'APT';
  if (upper === 'VILLA') return 'VILLA';
  if (upper === 'FLAT') return 'FLAT';
  if (upper === 'PLOT') return 'PLOT';
  return upper;
};

// Abbreviate long frequency types for better display in badges
const abbreviateFrequency = (freq) => {
  if (!freq) return 'Monthly';
  const map = {
    'Every 2 Months': 'Bi-Monthly',
    'Every 3 Months': 'Quarterly',
    'Half-Yearly': 'Half-Yr',
    'Half-yearly': 'Half-Yr',
  };
  return map[freq] || freq;
};

const API_BASE = import.meta.env.VITE_API_URL || '';

const AddonsManager = ({ admin, showToast, selectedFp, onRefresh }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  const token = sessionStorage.getItem('pm_auth_token');
  
  // Operations Manager defaults to 'all-addons' tab (no create access)
  const [activeTab, setActiveTab] = useState(isOpsManager ? 'all-addons' : 'create'); // 'create' or 'all-addons'
  const [addons, setAddons] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);
  const [filterPropertyType, setFilterPropertyType] = useState('all'); // Filter for All Add-ons tab
  const [addonForm, setAddonForm] = useState({
    serviceName: '',
    frequencyCount: 12,
    frequencyType: 'Monthly',
    billingCycle: 'Monthly',
    price: '',
    description: ''
  });

  // Service period options
  const SERVICE_PERIODS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAddon, setEditingAddon] = useState(null);
  const [editForm, setEditForm] = useState({
    serviceName: '',
    frequencyCount: 12,
    frequencyType: 'Monthly',
    description: '',
    billingCycle: 'Monthly',
    price: '',
    propertyType: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedFp?.id]);

  const loadData = async () => {
    try {
      let url;
      // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
      if (selectedFp?.id === 'all') {
        url = `${API_BASE}/api/admin/all-addons`;
      } else if (selectedFp?.id) {
        url = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/addons`;
      } else {
        // Fallback to default fetch
        const currentAddons = await fetchAddons();
        setAddons(currentAddons);
        setServices(getServices());
        return;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAddons(result.data || []);
      } else {
        setAddons([]);
      }
      setServices(getServices());
    } catch (error) {
      console.error('Error loading addons:', error);
      // Fallback to default fetch
      const currentAddons = await fetchAddons();
      setAddons(currentAddons);
      setServices(getServices());
    }
  };

  // Filter addons by selected property type
  const filteredAddons = selectedPropertyType 
    ? addons.filter(addon => addon.propertyType === selectedPropertyType)
    : addons;

  const handleSaveAddon = async () => {
    if (!selectedPropertyType) {
      showToast('Please select a property type', 'error');
      return;
    }
    if (!addonForm.serviceName.trim()) {
      showToast('Please select or enter a service name', 'error');
      return;
    }
    if (!addonForm.price || parseFloat(addonForm.price) <= 0) {
      showToast('Please enter a valid price', 'error');
      return;
    }

    const addonData = {
      propertyType: selectedPropertyType,
      propertyTypeName: PROPERTY_TYPE_OPTIONS.find(t => t.id === selectedPropertyType)?.label || selectedPropertyType,
      services: [{
        name: addonForm.serviceName.trim(),
        frequency: parseInt(addonForm.frequencyCount) || 1,
        frequencyType: addonForm.frequencyType,
        price: parseFloat(addonForm.price),
        description: addonForm.description?.trim() || ''
      }],
      billingCycle: addonForm.billingCycle,
      totalPrice: parseFloat(addonForm.price),
      description: addonForm.description?.trim() || ''
    };

    try {
      await createAddon(addonData);
      showToast('Add-on created!');
      resetForm();
      await loadData();
    } catch (error) {
      showToast('Failed to create add-on', 'error');
    }
  };

  const resetForm = () => {
    setAddonForm({
      serviceName: '',
      frequencyCount: 12,
      frequencyType: 'Monthly',
      billingCycle: 'Monthly',
      price: '',
      description: ''
    });
  };

  const handleDeleteAddon = async (addon) => {
    if (window.confirm('Are you sure you want to delete this add-on?')) {
      try {
        // Use admin endpoint for fp_addons (uses numeric id), else use addonId
        const deleteId = addon.id || addon.addonId;
        const url = addon.id 
          ? `${API_BASE}/api/admin/addons/${addon.id}`
          : `${API_BASE}/api/addons/${addon.addonId}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
          setAddons(prevAddons => prevAddons.filter(a => 
            (a.id !== addon.id) && (a.addonId !== addon.addonId)
          ));
          showToast('Add-on deleted');
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete add-on', 'error');
      }
    }
  };

  // Open edit modal with addon data
  const handleEditAddon = (addon) => {
    setEditingAddon(addon);
    setEditForm({
      serviceName: addon.services?.[0]?.name || '',
      frequencyCount: addon.services?.[0]?.frequency || 1,
      frequencyType: addon.services?.[0]?.frequencyType || 'Monthly',
      billingCycle: addon.billingCycle || 'Monthly',
      price: addon.services?.[0]?.price?.toString() || addon.totalPrice?.toString() || '',
      propertyType: addon.propertyType || 'GC',
      description: addon.services?.[0]?.description || addon.description || ''
    });
    setShowEditModal(true);
  };

  // Save edited addon
  const handleUpdateAddon = async () => {
    if (!editForm.serviceName.trim()) {
      showToast('Please enter a service name', 'error');
      return;
    }
    if (!editForm.price || parseFloat(editForm.price) <= 0) {
      showToast('Please enter a valid price', 'error');
      return;
    }

    const updates = {
      propertyType: editForm.propertyType,
      propertyTypeName: PROPERTY_TYPE_OPTIONS.find(t => t.id === editForm.propertyType)?.label || editForm.propertyType,
      services: [{
        name: editForm.serviceName.trim(),
        frequency: parseInt(editForm.frequencyCount) || 1,
        frequencyType: editForm.frequencyType,
        price: parseFloat(editForm.price),
        description: editForm.description?.trim() || ''
      }],
      billingCycle: editForm.billingCycle,
      totalPrice: parseFloat(editForm.price),
      description: editForm.description?.trim() || ''
    };

    try {
      await updateAddon(editingAddon.addonId, updates);
      setAddons(prevAddons => prevAddons.map(addon => 
        addon.addonId === editingAddon.addonId 
          ? { ...addon, ...updates }
          : addon
      ));
      setShowEditModal(false);
      setEditingAddon(null);
      showToast('Add-on updated successfully');
    } catch (error) {
      showToast('Failed to update add-on', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-stone-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Add-ons</h1>
            <p className="text-sm text-gray-500">Create optional services for AMC packages by property type</p>
          </div>
        </div>
      </div>

      {/* Tabs - Create tab hidden for Operations Manager */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {!isOpsManager && (
          <button
            onClick={() => setActiveTab('create')}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-white text-stone-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Add-on
            </div>
          </button>
        )}
        <button
          onClick={() => setActiveTab('all-addons')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'all-addons'
              ? 'bg-white text-stone-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            All Add-ons
            {addons.length > 0 && (
              <span className="px-1.5 py-0.5 bg-stone-600 text-white rounded-full text-xs">
                {addons.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Create Add-on Tab */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Property Type Selection - Evenly distributed layout */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Select Property Type</h2>
            <p className="text-sm text-gray-500 mb-4">Choose the property type this package will be configured for</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {PROPERTY_TYPE_OPTIONS.map((type) => {
                const isSelected = selectedPropertyType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedPropertyType(type.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 text-sm font-medium text-center ${
                      isSelected 
                        ? 'border-slate-400 bg-slate-100 text-slate-800 shadow-sm' 
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add-on Form - Show only after property type selection */}
          {selectedPropertyType && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Create Add-on</h3>
                  <p className="text-sm text-gray-500">
                    For: <span className="font-medium text-gray-700">
                      {PROPERTY_TYPE_OPTIONS.find(t => t.id === selectedPropertyType)?.label}
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {/* Single Row Layout: Select Service | Frequency Type | Frequency Count | Billing | Price | Save */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                  {/* Select Service */}
                  <div className="sm:col-span-1 lg:col-span-3">
                    <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Select Service</label>
                    <input
                      type="text"
                      list="service-options"
                      value={addonForm.serviceName}
                      onChange={(e) => setAddonForm({ ...addonForm, serviceName: e.target.value })}
                      placeholder="Select or type service"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400"
                    />
                    <datalist id="service-options">
                      {services.map((service, idx) => (
                        <option key={idx} value={service} />
                      ))}
                    </datalist>
                  </div>

                  {/* Frequency */}
                  <div className="sm:col-span-1 lg:col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Frequency</label>
                    <div className="relative">
                      <select
                        value={addonForm.frequencyType}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const autoCount = FREQUENCY_COUNT_MAP[newType];
                          setAddonForm({ 
                            ...addonForm, 
                            frequencyType: newType,
                            frequencyCount: autoCount || 1
                          });
                        }}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400 bg-white appearance-none"
                      >
                        {FREQUENCY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* No. of visits */}
                  <div className="sm:col-span-1 lg:col-span-1 relative">
                    <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider whitespace-nowrap">Visits</label>
                    <input
                      type="number"
                      min="1"
                      value={addonForm.frequencyCount}
                      readOnly
                      className="w-full px-2 py-2.5 border border-gray-300 bg-gray-100 rounded-lg text-sm text-center cursor-not-allowed"
                    />
                  </div>

                  {/* Price */}
                  <div className="sm:col-span-1 lg:col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Price (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={addonForm.price}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setAddonForm({ ...addonForm, price: value });
                        }}
                        placeholder="0"
                        className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400 font-medium"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="text-xs font-medium text-transparent mb-2 block uppercase tracking-wider">Action</label>
                    <button
                      onClick={handleSaveAddon}
                      className="w-full px-4 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 font-medium transition-colors flex items-center justify-center"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Description - Optional */}
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Description (Optional)</label>
                  <textarea
                    value={addonForm.description}
                    onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                    placeholder="Add notes or description for this add-on..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400 resize-y"
                    style={{ minHeight: '80px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Add-ons for Selected Property Type */}
          {selectedPropertyType && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800">
                  Add-ons for {PROPERTY_TYPE_OPTIONS.find(t => t.id === selectedPropertyType)?.label}
                </h3>
                <p className="text-sm text-gray-500">{filteredAddons.length} add-on(s) available</p>
              </div>
              {filteredAddons.length === 0 ? (
                <div className="p-12 text-center">
                  <PlusCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No add-ons for this property type yet</p>
                  <p className="text-sm text-gray-400">Create your first add-on above</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredAddons.map((addon) => (
                    <div key={addon.addonId} className="p-4 hover:bg-stone-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                            <PlusCircle className="w-5 h-5 text-stone-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">
                              {addon.services?.[0]?.name || addon.addonId}
                            </p>
                            <p className="text-sm text-gray-500">
                              {abbreviateFrequency(addon.services?.[0]?.frequencyType)} - {addon.services?.[0]?.frequency || 1} visits
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right mr-2">
                            <p className="text-xs text-gray-500 uppercase">Price</p>
                            <p className="text-lg font-semibold text-stone-700">
                              ₹{(addon.totalPrice || addon.services?.[0]?.price || 0).toLocaleString()}
                            </p>
                          </div>
                          {/* Edit/Delete buttons - Hidden for Operations Manager */}
                          {!isOpsManager && (
                            <>
                              <button
                                onClick={() => handleEditAddon(addon)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAddon(addon)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* All Add-ons Tab - With Property Type Filter and Table Layout */}
      {activeTab === 'all-addons' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">All Add-ons</h3>
                <p className="text-sm text-gray-500">
                  {filterPropertyType === 'all' 
                    ? `${addons.length} add-on(s) available` 
                    : `${addons.filter(a => normalizePropertyType(a.propertyType || a.property_type) === filterPropertyType).length} add-on(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
                </p>
              </div>
            </div>
            
            {/* Property Type Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterPropertyType('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  filterPropertyType === 'all'
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setFilterPropertyType(type.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                    filterPropertyType === type.id
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          {addons.length === 0 ? (
            <div className="p-12 text-center">
              <PlusCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No add-ons yet</p>
              <p className="text-sm text-gray-400 mb-4">Create your first add-on in the Create tab</p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Create Add-on
              </button>
            </div>
          ) : (
            <>
              {/* Filtered Add-ons - Table Layout */}
              {(() => {
                const filteredAddons = filterPropertyType === 'all' 
                  ? addons 
                  : addons.filter(a => normalizePropertyType(a.propertyType || a.property_type) === filterPropertyType);
                
                if (filteredAddons.length === 0) {
                  return (
                    <div className="p-8 text-center">
                      <p className="text-gray-500">No add-ons found for this property type</p>
                      <button
                        onClick={() => setFilterPropertyType('all')}
                        className="mt-2 text-sm text-blue-600 hover:underline"
                      >
                        Show all add-ons
                      </button>
                    </div>
                  );
                }
                
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      {/* Table Header */}
                      <thead className="bg-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[25%]">
                            Add-on Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[18%]">
                            Property Type
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-[18%]">
                            Frequency
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-[10%]">
                            Visits
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider w-[15%]">
                            Total Rate
                          </th>
                          {/* Actions column - Hidden for Operations Manager */}
                          {!isOpsManager && (
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-[14%]">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      {/* Table Body */}
                      <tbody className="divide-y divide-gray-100">
                        {filteredAddons.map((addon) => (
                          <tr key={addon.addonId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4">
                              <span className="font-medium text-gray-900">
                                {addon.services?.[0]?.name || addon.addonId}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-block px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md border border-slate-200 whitespace-nowrap">
                                {PROPERTY_TYPE_OPTIONS.find(t => t.id === normalizePropertyType(addon.propertyType || addon.property_type))?.label || addon.propertyType || addon.property_type || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-block px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md border border-blue-200 whitespace-nowrap">
                                {abbreviateFrequency(addon.services?.[0]?.frequencyType)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-sm text-gray-600">
                              {addon.services?.[0]?.frequency || 1}x
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-lg font-bold text-slate-800">
                                ₹{(addon.totalPrice || addon.services?.[0]?.price || 0).toLocaleString()}
                              </span>
                            </td>
                            {/* Actions column - Hidden for Operations Manager */}
                            {!isOpsManager && (
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleEditAddon(addon)}
                                    className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAddon(addon)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Edit Add-on Modal */}
      {showEditModal && editingAddon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Add-on</h3>
              <button
                onClick={() => { setShowEditModal(false); setEditingAddon(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  list="edit-service-options"
                  value={editForm.serviceName}
                  onChange={(e) => setEditForm({ ...editForm, serviceName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none"
                  placeholder="Service name"
                />
                <datalist id="edit-service-options">
                  {services.map((service, idx) => (
                    <option key={idx} value={service} />
                  ))}
                </datalist>
              </div>

              {/* Frequency & No.of visits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={editForm.frequencyType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      const autoCount = FREQUENCY_COUNT_MAP[newType];
                      setEditForm({ 
                        ...editForm, 
                        frequencyType: newType,
                        frequencyCount: autoCount || 1
                      });
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none"
                  >
                    {FREQUENCY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No.of visits</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.frequencyCount}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-200 bg-gray-100 rounded-xl outline-none"
                  />
                </div>
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
                <select
                  value={editForm.propertyType}
                  onChange={(e) => setEditForm({ ...editForm, propertyType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none"
                >
                  {PROPERTY_TYPE_OPTIONS.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.price}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setEditForm({ ...editForm, price: value });
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none"
                  placeholder="0"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Add notes or description..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-stone-500 outline-none resize-y"
                  style={{ minHeight: '80px' }}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => { setShowEditModal(false); setEditingAddon(null); }}
                  className="px-4 py-2.5 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateAddon}
                  className="px-4 py-2.5 bg-stone-700 text-white rounded-xl hover:bg-stone-800"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddonsManager;
