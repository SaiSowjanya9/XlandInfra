import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  DollarSign,
  Edit,
  X,
  FileText,
  Download,
  Mail,
  Calendar,
  Tag,
  Layers,
} from 'lucide-react';
import {
  getAMCPackages,
  createAMCPackage,
  updateAMCPackage,
  deleteAMCPackage,
  BILLING_DURATIONS,
  seedTestData,
} from '../../utils/estimateStore';

const AMCPackageManager = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'all-packages'
  const [amcPackages, setAmcPackages] = useState([]);
  
  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  // Package form with add-ons support
  const [amcForm, setAmcForm] = useState({
    packageName: '',
    services: '',
    rate: '',
    billingDuration: 'monthly',
    addons: [], // Array of { name: '', cost: '' }
  });

  const loadData = () => {
    // Seed test data if none exists
    seedTestData();
    setAmcPackages(getAMCPackages());
  };

  useEffect(() => {
    loadData();
  }, []);


  // Calculate totals
  const getPackageCost = () => parseFloat(amcForm.rate) || 0;
  const getAddonsCost = () => amcForm.addons.reduce((sum, addon) => sum + (parseFloat(addon.cost) || 0), 0);
  const getTotalCost = () => getPackageCost() + getAddonsCost();

  // Add-on handlers
  const handleAddAddon = () => {
    setAmcForm({
      ...amcForm,
      addons: [...amcForm.addons, { name: '', cost: '' }]
    });
  };

  const handleUpdateAddon = (index, field, value) => {
    const newAddons = [...amcForm.addons];
    newAddons[index][field] = value;
    setAmcForm({ ...amcForm, addons: newAddons });
  };

  const handleRemoveAddon = (index) => {
    const newAddons = amcForm.addons.filter((_, i) => i !== index);
    setAmcForm({ ...amcForm, addons: newAddons });
  };

  // Form actions
  const handleSavePackage = () => {
    if (!amcForm.packageName.trim()) {
      showToast?.('Please enter a package name', 'error');
      return;
    }

    if (!amcForm.services.trim()) {
      showToast?.('Please enter services', 'error');
      return;
    }

    if (!amcForm.rate || parseFloat(amcForm.rate) <= 0) {
      showToast?.('Please enter a valid rate', 'error');
      return;
    }

    // Filter out empty add-ons
    const validAddons = amcForm.addons.filter(addon => addon.name.trim() && addon.cost);

    const packageData = {
      packageName: amcForm.packageName.trim(),
      services: amcForm.services.trim(),
      rate: parseFloat(amcForm.rate),
      billingDuration: amcForm.billingDuration,
      addons: validAddons.map(addon => ({ name: addon.name.trim(), cost: parseFloat(addon.cost) })),
      totalRate: getTotalCost(),
      status: 'active',
    };

    if (editingPackage) {
      updateAMCPackage(editingPackage.packageId, packageData);
      showToast?.('AMC Package updated successfully!', 'success');
      setShowEditModal(false);
    } else {
      createAMCPackage(packageData);
      showToast?.('AMC Package created successfully!', 'success');
    }

    resetForm();
    loadData();
  };

  const handleOpenEditModal = (pkg) => {
    setEditingPackage(pkg);
    // Handle old format (array) vs new format (string) for services
    let servicesText = '';
    if (typeof pkg.services === 'string') {
      servicesText = pkg.services;
    } else if (Array.isArray(pkg.services)) {
      servicesText = pkg.services.map(s => s.name).filter(Boolean).join(', ');
    }
    
    // Load addons if they exist
    const loadedAddons = Array.isArray(pkg.addons) 
      ? pkg.addons.map(addon => ({ name: addon.name || '', cost: addon.cost?.toString() || '' }))
      : [];
    
    setAmcForm({
      packageName: pkg.packageName || '',
      services: servicesText,
      rate: pkg.rate?.toString() || '',
      billingDuration: pkg.billingDuration || 'monthly',
      addons: loadedAddons,
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingPackage(null);
    resetForm();
  };

  const handleDeletePackage = (packageId) => {
    if (window.confirm('Are you sure you want to delete this AMC package?')) {
      deleteAMCPackage(packageId);
      showToast?.('AMC Package deleted', 'success');
      if (showEditModal) setShowEditModal(false);
      loadData();
    }
  };

  const resetForm = () => {
    setAmcForm({
      packageName: '',
      services: '',
      rate: '',
      billingDuration: 'monthly',
      addons: [],
    });
    setEditingPackage(null);
  };

  // Export to PDF (placeholder)
  const handleExportPDF = (pkg) => {
    showToast?.('PDF export feature coming soon!', 'info');
  };

  // Email package (placeholder)
  const handleEmailPackage = (pkg) => {
    showToast?.('Email feature coming soon!', 'info');
  };

  return (
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
          onClick={() => setActiveTab('create')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'create'
              ? 'bg-white text-slate-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Package
          </div>
        </button>
        <button
          onClick={() => setActiveTab('all-packages')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'all-packages'
              ? 'bg-white text-slate-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            All Packages
            {amcPackages.length > 0 && (
              <span className="px-1.5 py-0.5 bg-slate-600 text-white rounded-full text-xs">
                {amcPackages.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* All AMC Packages Tab */}
      {activeTab === 'all-packages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">All Packages</h3>
              <p className="text-sm text-gray-500">{amcPackages.length} package(s) available</p>
            </div>
          </div>

          {amcPackages.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No AMC packages yet</p>
              <p className="text-sm text-gray-400 mb-4">Create your first package to get started</p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Create Package
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {amcPackages.map((pkg) => {
                const addonsTotal = Array.isArray(pkg.addons) 
                  ? pkg.addons.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0) 
                  : 0;
                const totalRate = (pkg.rate || 0) + addonsTotal;
                
                return (
                  <div key={pkg.packageId} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200">
                          <Package className="w-6 h-6 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">
                              {pkg.packageName || 'Unnamed Package'}
                            </p>
                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                              {BILLING_DURATIONS.find(d => d.value === pkg.billingDuration)?.label || 'Monthly'}
                            </span>
                          </div>
                          
                          {/* Services */}
                          {pkg.services && (
                            <p className="text-sm text-gray-600 mb-2">
                              {typeof pkg.services === 'string' 
                                ? pkg.services 
                                : Array.isArray(pkg.services) 
                                  ? pkg.services.map(s => s.name).filter(Boolean).join(', ')
                                  : ''}
                            </p>
                          )}
                          
                          {/* Add-ons */}
                          {Array.isArray(pkg.addons) && pkg.addons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {pkg.addons.map((addon, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg">
                                  <Plus className="w-3 h-3" />
                                  {addon.name} <span className="text-gray-500">₹{(addon.cost || 0).toLocaleString()}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-0.5">Total Rate</p>
                          <p className="text-xl font-bold text-slate-800">₹{totalRate.toLocaleString()}</p>
                          {addonsTotal > 0 && (
                            <p className="text-xs text-gray-400">Base: ₹{(pkg.rate || 0).toLocaleString()} + Add-ons: ₹{addonsTotal.toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex gap-1 border-l border-gray-200 pl-4">
                          <button
                            onClick={() => handleOpenEditModal(pkg)}
                            className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExportPDF(pkg)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Export PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEmailPackage(pkg)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg.packageId)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Package Tab */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Package Configuration Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Package Configuration</h2>
              
              {/* Main Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Package Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 text-slate-500" />
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.packageName}
                    onChange={(e) => setAmcForm({ ...amcForm, packageName: e.target.value })}
                    placeholder="e.g., Gold Package"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                  />
                </div>

                {/* Services Included */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Services Included <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.services}
                    onChange={(e) => setAmcForm({ ...amcForm, services: e.target.value })}
                    placeholder="Cleaning, Security, HVAC..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                  />
                </div>

                {/* Package Rate */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Package Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amcForm.rate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setAmcForm({ ...amcForm, rate: value });
                      }}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-medium"
                    />
                  </div>
                </div>

                {/* Billing Cycle */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    Billing Cycle
                  </label>
                  <select
                    value={amcForm.billingDuration}
                    onChange={(e) => setAmcForm({ ...amcForm, billingDuration: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-white"
                  >
                    {BILLING_DURATIONS.map(duration => (
                      <option key={duration.value} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add-on Services Section */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-slate-500" />
                    Add-on Services (Optional)
                  </h3>
                  <button
                    onClick={handleAddAddon}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Service
                  </button>
                </div>

                {amcForm.addons.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Plus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No add-on services added yet</p>
                    <p className="text-xs text-gray-400">Click "Add Service" to include additional services</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {amcForm.addons.map((addon, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 mb-1 block">Service Name</label>
                          <input
                            type="text"
                            value={addon.name}
                            onChange={(e) => handleUpdateAddon(index, 'name', e.target.value)}
                            placeholder="e.g., Deep Cleaning"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                          />
                        </div>
                        <div className="w-40">
                          <label className="text-xs text-gray-500 mb-1 block">Cost (₹)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={addon.cost}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                handleUpdateAddon(index, 'cost', value);
                              }}
                              placeholder="0"
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAddon(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Price Summary
              </h3>
            </div>
            <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 m-4 rounded-xl p-6 text-white">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Package Name</p>
                  <p className="text-xl font-bold mt-1">{amcForm.packageName || 'Not specified'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Billing</p>
                  <p className="font-semibold mt-1">
                    {BILLING_DURATIONS.find(d => d.value === amcForm.billingDuration)?.label || 'Monthly'}
                  </p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Package Cost</span>
                  <span className="font-medium">₹{getPackageCost().toLocaleString()}</span>
                </div>
                {amcForm.addons.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Add-on Cost ({amcForm.addons.length} service{amcForm.addons.length > 1 ? 's' : ''})</span>
                    <span className="font-medium">₹{getAddonsCost().toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-white/10">
                  <span className="text-lg font-semibold">Total Package Rate</span>
                  <span className="text-3xl font-bold text-emerald-400">₹{getTotalCost().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              <span className="text-red-500">*</span> Required fields
            </p>
            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSavePackage}
                className="px-6 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save AMC Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {showEditModal && editingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                  <Edit className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Edit AMC Package</h3>
                  <p className="text-sm text-gray-500">{editingPackage.packageId}</p>
                </div>
              </div>
              <button
                onClick={handleCloseEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Main Fields Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Package Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 text-slate-500" />
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.packageName}
                    onChange={(e) => setAmcForm({ ...amcForm, packageName: e.target.value })}
                    placeholder="e.g., Gold Package"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                  />
                </div>

                {/* Services */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Services <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.services}
                    onChange={(e) => setAmcForm({ ...amcForm, services: e.target.value })}
                    placeholder="Cleaning, Security, HVAC..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                  />
                </div>

                {/* Package Rate */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Package Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={amcForm.rate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setAmcForm({ ...amcForm, rate: value });
                      }}
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-semibold"
                    />
                  </div>
                </div>

                {/* Billing Duration */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    Billing Cycle
                  </label>
                  <select
                    value={amcForm.billingDuration}
                    onChange={(e) => setAmcForm({ ...amcForm, billingDuration: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-white"
                  >
                    {BILLING_DURATIONS.map(duration => (
                      <option key={duration.value} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add-on Services */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-slate-500" />
                    Add-on Services
                  </h4>
                  <button
                    onClick={handleAddAddon}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                {amcForm.addons.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No add-ons</p>
                ) : (
                  <div className="space-y-2">
                    {amcForm.addons.map((addon, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="text"
                          value={addon.name}
                          onChange={(e) => handleUpdateAddon(index, 'name', e.target.value)}
                          placeholder="Service name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={addon.cost}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              handleUpdateAddon(index, 'cost', value);
                            }}
                            placeholder="0"
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveAddon(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg p-4 text-white">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-slate-400 text-xs">Package</span>
                    <p className="font-semibold">{amcForm.packageName || 'Not specified'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-xs">Billing</span>
                    <p className="font-semibold">
                      {BILLING_DURATIONS.find(d => d.value === amcForm.billingDuration)?.label || 'Monthly'}
                    </p>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Package Cost</span>
                    <span>₹{getPackageCost().toLocaleString()}</span>
                  </div>
                  {amcForm.addons.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Add-ons</span>
                      <span>₹{getAddonsCost().toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-bold text-emerald-400">₹{getTotalCost().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between sticky bottom-0">
              <button
                onClick={() => handleDeletePackage(editingPackage.packageId)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePackage}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
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

export default AMCPackageManager;
