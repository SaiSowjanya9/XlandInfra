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
  Download,
  Mail,
  Calendar,
  Tag,
  Layers,
  ChevronDown,
} from 'lucide-react';
import {
  getAMCPackages,
  createAMCPackage,
  updateAMCPackage,
  deleteAMCPackage,
  BILLING_DURATIONS,
  FREQUENCY_TYPES,
  seedTestData,
  getAMCPackageByPropertyType,
} from '../../utils/estimateStore';
import { exportPackageToPDF } from '../../utils/pdfExport';
import { Home, Building, TreePine, Map, Layers as LayersIcon } from 'lucide-react';

// Property Types for AMC Package Configuration (simple style)
const PROPERTY_TYPE_OPTIONS = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'Apt', label: 'Apartment' },
  { id: 'Villa', label: 'Villa' },
  { id: 'Flat', label: 'Flat' },
  { id: 'Plot', label: 'Plot' },
];

// Auto-calculate frequency count based on frequency type
const FREQUENCY_COUNT_MAP = {
  'Monthly': 1,
  'Quarterly': 3,
  'Half-yearly': 6,
  'Yearly': 12,
  'Custom Months': null // User enters manually
};

const AMCPackageManager = ({ admin, showToast }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  
  // Operations Manager defaults to 'all-packages' tab (no create access)
  const [activeTab, setActiveTab] = useState(isOpsManager ? 'all-packages' : 'create'); // 'create' or 'all-packages'
  const [amcPackages, setAmcPackages] = useState([]);
  const [filterPropertyType, setFilterPropertyType] = useState('all'); // Filter for All Packages tab
  const [exportingId, setExportingId] = useState(null); // Track PDF export state
  
  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  // Selected property type for package
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);

  // Package form with dynamic service rows
  const [amcForm, setAmcForm] = useState({
    packageName: '',
    serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }],
    price: '',
    billingDuration: 'monthly',
  });

  const loadData = () => {
    // Don't call seedTestData here - it can cause deleted items to reappear
    const currentPackages = getAMCPackages();
    setAmcPackages(currentPackages);
  };

  useEffect(() => {
    loadData();
  }, []);


  // Calculate price
  const getPrice = () => parseFloat(amcForm.price) || 0;

  // Service row handlers
  const handleAddServiceRow = () => {
    setAmcForm({
      ...amcForm,
      serviceRows: [...amcForm.serviceRows, { service: '', frequencyCount: 1, frequencyType: 'Monthly' }]
    });
  };

  const handleUpdateServiceRow = (index, field, value) => {
    const newRows = [...amcForm.serviceRows];
    
    // If frequency type changes, auto-set frequency count
    if (field === 'frequencyType') {
      const autoCount = FREQUENCY_COUNT_MAP[value];
      newRows[index] = {
        ...newRows[index],
        [field]: value,
        frequencyCount: autoCount !== null ? autoCount : ''
      };
    } else {
      newRows[index][field] = value;
    }
    
    setAmcForm({ ...amcForm, serviceRows: newRows });
  };

  const handleRemoveServiceRow = (index) => {
    if (amcForm.serviceRows.length > 1) {
      const newRows = amcForm.serviceRows.filter((_, i) => i !== index);
      setAmcForm({ ...amcForm, serviceRows: newRows });
    }
  };

  // Form actions
  const handleSavePackage = () => {
    if (!amcForm.packageName.trim()) {
      showToast?.('Please enter a package name', 'error');
      return;
    }

    // Filter out empty service rows
    const validServices = amcForm.serviceRows.filter(row => row.service.trim());
    if (validServices.length === 0) {
      showToast?.('Please add at least one service', 'error');
      return;
    }

    if (!amcForm.price || parseFloat(amcForm.price) <= 0) {
      showToast?.('Please enter a valid price', 'error');
      return;
    }

    if (!selectedPropertyType) {
      showToast?.('Please select a property type', 'error');
      return;
    }

    const packageData = {
      packageName: amcForm.packageName.trim(),
      propertyType: selectedPropertyType, // Link package to property type
      serviceRows: validServices.map(row => ({
        service: row.service.trim(),
        frequencyCount: parseInt(row.frequencyCount) || 1,
        frequencyType: row.frequencyType
      })),
      services: validServices.map(r => r.service).join(', '), // For backward compatibility
      rate: parseFloat(amcForm.price),
      billingDuration: amcForm.billingDuration,
      totalRate: getPrice(),
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
    
    // Load property type
    setSelectedPropertyType(pkg.propertyType || null);
    
    // Load service rows if they exist, otherwise create from services string
    let loadedServiceRows = [];
    if (Array.isArray(pkg.serviceRows) && pkg.serviceRows.length > 0) {
      loadedServiceRows = pkg.serviceRows.map(row => ({
        service: row.service || '',
        frequencyCount: row.frequencyCount || 1,
        frequencyType: row.frequencyType || 'Monthly'
      }));
    } else if (typeof pkg.services === 'string' && pkg.services) {
      loadedServiceRows = pkg.services.split(',').map(s => ({
        service: s.trim(),
        frequencyCount: 1,
        frequencyType: 'Monthly'
      }));
    } else {
      loadedServiceRows = [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }];
    }
    
    setAmcForm({
      packageName: pkg.packageName || '',
      serviceRows: loadedServiceRows,
      price: pkg.rate?.toString() || '',
      billingDuration: pkg.billingDuration || 'monthly',
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
      // Delete from storage
      deleteAMCPackage(packageId);
      // Update local state immediately (without calling loadData to avoid any re-seeding)
      setAmcPackages(prevPackages => prevPackages.filter(pkg => pkg.packageId !== packageId));
      showToast?.('AMC Package deleted', 'success');
      if (showEditModal) setShowEditModal(false);
    }
  };

  const resetForm = () => {
    setAmcForm({
      packageName: '',
      serviceRows: [{ service: '', frequencyCount: 1, frequencyType: 'Monthly' }],
      price: '',
      billingDuration: 'monthly',
    });
    setSelectedPropertyType(null);
    setEditingPackage(null);
  };

  // Export to PDF - Single download only
  const handleExportPDF = (e, pkg) => {
    e.stopPropagation();
    e.preventDefault();
    if (exportingId) return;
    setExportingId(pkg.packageId);
    showToast?.('Generating PDF...', 'info');
    
    // Use setTimeout to ensure single execution
    setTimeout(() => {
      try {
        const success = exportPackageToPDF(pkg);
        if (success) {
          showToast?.('PDF downloaded successfully!', 'success');
        }
      } catch (err) {
        console.error('PDF Error:', err);
      } finally {
        setExportingId(null);
      }
    }, 100);
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

      {/* Tabs - Create tab hidden for Operations Manager */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {!isOpsManager && (
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
        )}
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

      {/* All AMC Packages Tab - With Property Type Filter */}
      {activeTab === 'all-packages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">All Packages</h3>
                <p className="text-sm text-gray-500">
                  {filterPropertyType === 'all' 
                    ? `${amcPackages.length} package(s) available` 
                    : `${amcPackages.filter(p => p.propertyType === filterPropertyType).length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
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
            <>
              {(() => {
                const filteredPackages = filterPropertyType === 'all' 
                  ? amcPackages 
                  : amcPackages.filter(p => p.propertyType === filterPropertyType);
                
                if (filteredPackages.length === 0) {
                  return (
                    <div className="p-8 text-center">
                      <p className="text-gray-500">No packages found for this property type</p>
                      <button
                        onClick={() => setFilterPropertyType('all')}
                        className="mt-2 text-sm text-blue-600 hover:underline"
                      >
                        Show all packages
                      </button>
                    </div>
                  );
                }
                
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      {/* Table Header */}
                      <thead className="bg-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Package Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Property Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Billing
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Services Included
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Total Rate
                          </th>
                          {/* Actions column - Hidden for Operations Manager */}
                          {!isOpsManager && (
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      {/* Table Body */}
                      <tbody className="divide-y divide-gray-100">
                        {filteredPackages.map((pkg) => {
                          const addonsTotal = Array.isArray(pkg.addons) 
                            ? pkg.addons.reduce((sum, a) => sum + (parseFloat(a.cost) || 0), 0) 
                            : 0;
                          const totalRate = (pkg.rate || 0) + addonsTotal;
                          const servicesText = typeof pkg.services === 'string' 
                            ? pkg.services 
                            : Array.isArray(pkg.services) 
                              ? pkg.services.map(s => s.name).filter(Boolean).join(', ')
                              : '';
                          
                          return (
                            <tr key={pkg.packageId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-semibold text-gray-900">
                                  {pkg.packageName || 'Unnamed Package'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                                  {PROPERTY_TYPE_OPTIONS.find(t => t.id === pkg.propertyType)?.label || pkg.propertyType || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                                  {BILLING_DURATIONS.find(d => d.value === pkg.billingDuration)?.label || 'Monthly'}
                                </span>
                              </td>
                              <td className="px-4 py-4 max-w-xs">
                                <p className="text-sm text-gray-600 truncate" title={servicesText}>
                                  {servicesText || '-'}
                                </p>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <span className="text-lg font-bold text-slate-800">
                                  ₹{totalRate.toLocaleString()}
                                </span>
                              </td>
                              {/* Actions column - Hidden for Operations Manager */}
                              {!isOpsManager && (
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleOpenEditModal(pkg)}
                                      className="p-2 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="Edit"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => handleExportPDF(e, pkg)}
                                      disabled={exportingId === pkg.packageId}
                                      className={`p-2 rounded-lg transition-colors ${exportingId === pkg.packageId ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
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
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Create Package Tab */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Property Type Selection - Evenly distributed */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Select Property Type</h2>
            <p className="text-sm text-gray-500 mb-4">Choose the property type this package will be configured for</p>
            
            <div className="grid grid-cols-5 gap-4">
              {PROPERTY_TYPE_OPTIONS.map((type) => {
                const isSelected = selectedPropertyType === type.id;
                return (
                  <button
                    key={type.id}
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
                        
                        {/* Frequency Type - First to trigger auto-calculation */}
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
                        
                        {/* Frequency Count - Auto-set based on type, manual only for 'Custom Months' */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="1"
                            value={row.frequencyCount}
                            onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                            placeholder={row.frequencyType === 'Custom Months' ? 'Enter months' : ''}
                            readOnly={row.frequencyType !== 'Custom Months'}
                            title={row.frequencyType === 'Custom Months' ? 'Enter the number of months manually' : `Auto-set to ${FREQUENCY_COUNT_MAP[row.frequencyType] || 1}`}
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

                {/* Price Section - Right Side - LIGHT/ELEGANT Design */}
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
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setAmcForm({ ...amcForm, price: value });
                          }}
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
                            <option key={duration.value} value={duration.value}>
                              {duration.label}
                            </option>
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
                onClick={resetForm}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSavePackage}
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

      {/* Edit Package Modal */}
      {showEditModal && editingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
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
              {/* Property Type Selection - Evenly distributed */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">Property Type</label>
                <div className="grid grid-cols-5 gap-3">
                  {PROPERTY_TYPE_OPTIONS.map((type) => {
                    const isSelected = selectedPropertyType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedPropertyType(type.id)}
                        className={`px-3 py-2.5 rounded-lg border transition-all duration-200 text-sm font-medium text-center ${
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

              {/* Package Name and Price Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={amcForm.packageName}
                    onChange={(e) => setAmcForm({ ...amcForm, packageName: e.target.value })}
                    placeholder="e.g., Gold Package"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amcForm.price}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setAmcForm({ ...amcForm, price: value });
                        }}
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      Service Period
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
              </div>

              {/* Service Rows */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Service Configuration</h4>
                  <button
                    onClick={handleAddServiceRow}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Row
                  </button>
                </div>
                
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 px-3 py-2 bg-slate-50 rounded-lg mb-2">
                  <div className="col-span-5"><span className="text-xs font-semibold text-gray-600 uppercase">Service</span></div>
                  <div className="col-span-3"><span className="text-xs font-semibold text-gray-600 uppercase">Frequency Type</span></div>
                  <div className="col-span-3"><span className="text-xs font-semibold text-gray-600 uppercase">Frequency Count</span></div>
                  <div className="col-span-1"></div>
                </div>
                
                <div className="space-y-2">
                  {amcForm.serviceRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={row.service}
                          onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                          placeholder="Service name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      {/* Frequency Type - First to trigger auto-calculation */}
                      <div className="col-span-3">
                        <select
                          value={row.frequencyType}
                          onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          {FREQUENCY_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      {/* Frequency Count - Auto-set based on type, manual only for 'Custom Months' */}
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="1"
                          value={row.frequencyCount}
                          onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                          placeholder={row.frequencyType === 'Custom Months' ? 'Enter months' : ''}
                          readOnly={row.frequencyType !== 'Custom Months'}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${
                            row.frequencyType === 'Custom Months' 
                              ? 'border-blue-300 bg-blue-50' 
                              : 'border-gray-300 bg-gray-100 cursor-not-allowed'
                          }`}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => handleRemoveServiceRow(index)}
                          disabled={amcForm.serviceRows.length === 1}
                          className={`p-1.5 rounded ${amcForm.serviceRows.length === 1 ? 'text-gray-300' : 'text-red-500 hover:bg-red-50'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Summary - LIGHT Design */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-500 text-xs">Package</span>
                    <p className="font-semibold text-gray-800">{amcForm.packageName || 'Not specified'}</p>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500 text-xs">Services</span>
                    <p className="font-semibold text-gray-800">{amcForm.serviceRows.filter(r => r.service.trim()).length}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 text-xs">Total Rate</span>
                    <p className="text-2xl font-bold text-gray-800">₹{getPrice().toLocaleString()}</p>
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
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 flex items-center gap-2"
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
