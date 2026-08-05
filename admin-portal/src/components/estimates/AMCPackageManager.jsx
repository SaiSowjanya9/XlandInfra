import { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/safeStorage';
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
  Eye,
} from 'lucide-react';

// Decode HTML entities (e.g., &#x2F; -> /)
const decodeHtml = (html) => {
  if (!html || typeof html !== 'string') return html;
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

import {
  getAMCPackages,
  fetchAMCPackages,
  createAMCPackage,
  updateAMCPackage,
  deleteAMCPackage,
  BILLING_DURATIONS,
  FREQUENCY_TYPES,
  FREQUENCY_COUNT_MAP,
  seedTestData,
  getAMCPackageByPropertyType,
} from '../../utils/estimateStore';
import { exportPackageToPDF } from '../../utils/pdfExport';
import { Home, Building, TreePine, Map, Layers as LayersIcon } from 'lucide-react';

// Property Types for AMC Package Configuration (simple style)
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

// FREQUENCY_COUNT_MAP imported from estimateStore

const API_BASE = import.meta.env.VITE_API_URL || '';

const AMCPackageManager = ({ admin, showToast, selectedFp, onRefresh }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  const token = getAuthToken();
  
  // Operations Manager defaults to 'all-packages' tab (no create access)
  const [activeTab, setActiveTab] = useState(isOpsManager ? 'all-packages' : 'create'); // 'create' or 'all-packages'
  const [amcPackages, setAmcPackages] = useState([]);
  const [filterPropertyType, setFilterPropertyType] = useState('all'); // Filter for All Packages tab
  const [exportingId, setExportingId] = useState(null); // Track PDF export state
  
  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  
  // View Modal state
  const [viewAmcPackage, setViewAmcPackage] = useState(null);

  // Selected property type for package
  const [selectedPropertyType, setSelectedPropertyType] = useState(null);

  // Package form with dynamic service rows
  const [amcForm, setAmcForm] = useState({
    packageName: '',
    serviceRows: [{ service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }],
    price: '',
    billingDuration: 'monthly',
    description: ''
  });

  const loadData = async () => {
    try {
      let url;
      // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
      if (selectedFp?.id === 'all') {
        url = `${API_BASE}/api/admin/all-amc-packages`;
      } else if (selectedFp?.id) {
        url = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/amc-packages`;
      } else {
        // Fallback to default fetch
        const currentPackages = await fetchAMCPackages();
        setAmcPackages(currentPackages);
        return;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAmcPackages(result.data || []);
      } else {
        setAmcPackages([]);
      }
    } catch (error) {
      console.error('Error loading AMC packages:', error);
      // Fallback to default fetch
      const currentPackages = await fetchAMCPackages();
      setAmcPackages(currentPackages);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFp?.id]);


  // Calculate price
  const getPrice = () => parseFloat(amcForm.price) || 0;

  // Service row handlers
  const handleAddServiceRow = () => {
    setAmcForm({
      ...amcForm,
      serviceRows: [...amcForm.serviceRows, { service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }]
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
        // For 'Other', set to 0 (editable), otherwise use auto-calculated value
        frequencyCount: autoCount !== null ? autoCount : 0
      };
    } else if (field === 'frequencyCount') {
      // Ensure frequencyCount is stored as a number
      const numValue = value === '' ? 0 : parseInt(value) || 0;
      newRows[index][field] = numValue;
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
  const handleSavePackage = async () => {
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

    // Check if FP is selected (required for admin mode)
    if (selectedFp?.id && selectedFp.id !== 'all') {
      // Use admin API endpoint to save to fp_amc_packages table
      const packageData = {
        fpId: selectedFp.id,
        packageName: amcForm.packageName.trim(),
        propertyType: selectedPropertyType,
        serviceRows: validServices.map(row => ({
          service: row.service.trim(),
          description: row.description || '',
          frequencyCount: typeof row.frequencyCount === 'number' ? row.frequencyCount : (parseInt(row.frequencyCount) || 0),
          frequencyType: row.frequencyType
        })),
        rate: parseFloat(amcForm.price),
        billingDuration: amcForm.billingDuration,
        description: amcForm.description?.trim() || ''
      };

      try {
        const url = editingPackage 
          ? `${API_BASE}/api/admin/amc-packages/${editingPackage.id || editingPackage.packageId}`
          : `${API_BASE}/api/admin/amc-packages`;
        const method = editingPackage ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method,
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(packageData)
        });
        
        const result = await response.json();
        if (result.success) {
          showToast?.(editingPackage ? 'AMC Package updated successfully!' : 'AMC Package created successfully!', 'success');
          if (editingPackage) setShowEditModal(false);
          resetForm();
          await loadData();
          setActiveTab('all-packages'); // Switch to All Packages tab after creation
        } else {
          showToast?.(result.message || 'Failed to save package', 'error');
        }
      } catch (error) {
        console.error('Save package error:', error);
        showToast?.('Failed to save package', 'error');
      }
    } else {
      // No FP selected - show error
      showToast?.('Please select a Franchise Partner first', 'error');
    }
  };

  const handleOpenEditModal = (pkg) => {
    setEditingPackage(pkg);
    
    // Load property type
    setSelectedPropertyType(pkg.propertyType || null);
    
    // Load service rows if they exist, otherwise create from services string
    let loadedServiceRows = [];
    if (Array.isArray(pkg.serviceRows) && pkg.serviceRows.length > 0) {
      loadedServiceRows = pkg.serviceRows.map(row => ({
        service: decodeHtml(row.service || row.name) || '',
        description: decodeHtml(row.description) || '',
        frequencyCount: row.frequency_count ?? row.frequencyCount ?? 1,
        frequencyType: row.frequency_type || row.frequencyType || 'Monthly'
      }));
    } else if (typeof pkg.services === 'string' && pkg.services) {
      loadedServiceRows = pkg.services.split(',').map(s => ({
        service: decodeHtml(s.trim()),
        description: '',
        frequencyCount: 12,
        frequencyType: 'Monthly'
      }));
    } else {
      loadedServiceRows = [{ service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }];
    }
    
    setAmcForm({
      packageName: decodeHtml(pkg.packageName) || '',
      serviceRows: loadedServiceRows,
      price: pkg.rate?.toString() || '',
      billingDuration: pkg.billingDuration || 'monthly',
      description: decodeHtml(pkg.description) || ''
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingPackage(null);
    resetForm();
  };

  const handleDeletePackage = async (pkg) => {
    if (window.confirm('Are you sure you want to delete this AMC package?')) {
      try {
        // Use admin endpoint for fp_amc_packages (uses numeric id), else use packageId
        const deleteId = pkg.id || pkg.packageId;
        const url = pkg.id 
          ? `${API_BASE}/api/admin/amc-packages/${pkg.id}`
          : `${API_BASE}/api/amc-packages/${pkg.packageId}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
          // Update local state immediately
          setAmcPackages(prevPackages => prevPackages.filter(p => 
            (p.id !== pkg.id) && (p.packageId !== pkg.packageId)
          ));
          showToast?.('AMC Package deleted', 'success');
          if (showEditModal) setShowEditModal(false);
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('Delete error:', error);
        showToast?.('Failed to delete AMC package', 'error');
      }
    }
  };

  const resetForm = () => {
    setAmcForm({
      packageName: '',
      serviceRows: [{ service: '', description: '', frequencyCount: 12, frequencyType: 'Monthly' }],
      price: '',
      billingDuration: 'monthly',
      description: ''
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
                    : `${amcPackages.filter(p => normalizePropertyType(p.propertyType) === filterPropertyType).length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
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
                {amcPackages.length > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{amcPackages.length}</span>
                )}
              </button>
              {PROPERTY_TYPE_OPTIONS.map((type) => {
                const count = amcPackages.filter(p => normalizePropertyType(p.propertyType) === type.id).length;
                return (
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
                    {count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${filterPropertyType === type.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
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
                  : amcPackages.filter(p => normalizePropertyType(p.propertyType) === filterPropertyType);
                
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
                          <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            Package Name
                          </th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                            Property Type
                          </th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            Billing
                          </th>
                          <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
                            Services Included
                          </th>
                          <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
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
                          // Get services text from services field or serviceRows fallback
                          let servicesText = '';
                          if (typeof pkg.services === 'string' && pkg.services.trim()) {
                            servicesText = pkg.services;
                          } else if (Array.isArray(pkg.services) && pkg.services.length > 0) {
                            servicesText = pkg.services.map(s => typeof s === 'string' ? s : s.name).filter(Boolean).join(', ');
                          } else if (Array.isArray(pkg.serviceRows) && pkg.serviceRows.length > 0) {
                            servicesText = pkg.serviceRows.map(r => r.service || r.name).filter(Boolean).join(', ');
                          }
                          
                          return (
                            <tr key={pkg.packageId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 md:px-6 py-4">
                                <span className="font-semibold text-gray-900 text-sm md:text-base">
                                  {pkg.packageName || 'Unnamed Package'}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-4">
                                <span className="inline-block px-2 md:px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap text-center">
                                  {PROPERTY_TYPE_OPTIONS.find(t => t.id === pkg.propertyType)?.label || pkg.propertyType || '-'}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-4">
                                <span className="inline-block px-2 md:px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200 whitespace-nowrap">
                                  {BILLING_DURATIONS.find(d => d.value === pkg.billingDuration)?.label || 'Monthly'}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-4 max-w-[200px] hidden sm:table-cell">
                                <p className="text-sm text-gray-600 truncate" title={servicesText}>
                                  {servicesText || '-'}
                                </p>
                              </td>
                              <td className="px-3 md:px-4 py-4 text-right">
                                <span className="text-base md:text-lg font-bold text-slate-800 whitespace-nowrap">
                                  ₹{totalRate.toLocaleString()}
                                </span>
                              </td>
                              {/* Actions column - Hidden for Operations Manager */}
                              {!isOpsManager && (
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => {
                                        // Use already-parsed serviceRows from backend, or parse services if needed
                                        let serviceRows = pkg.serviceRows || [];
                                        if (serviceRows.length === 0 && pkg.services) {
                                          let servicesData = pkg.services;
                                          if (typeof servicesData === 'string') {
                                            try { servicesData = JSON.parse(servicesData); } catch (e) { servicesData = null; }
                                          }
                                          serviceRows = servicesData?.serviceRows || (Array.isArray(servicesData) ? servicesData : []);
                                        }
                                        setViewAmcPackage({ ...pkg, servicesData: serviceRows });
                                      }}
                                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                      title="View"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
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
                                      onClick={() => handleDeletePackage(pkg)}
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
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
              {PROPERTY_TYPE_OPTIONS.map((type) => {
                const isSelected = selectedPropertyType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedPropertyType(type.id)}
                    className={`px-3 md:px-4 py-2.5 md:py-3 rounded-lg border transition-all duration-200 text-sm font-medium text-center ${
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
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
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
              <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto">
                {/* Service Rows Section */}
                <div className="flex-1 min-w-[550px]">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Service Configuration</h3>
                  
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 rounded-lg mb-3">
                    <div className="col-span-3">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</span>
                    </div>
                    <div className="col-span-3">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Visits</span>
                    </div>
                    <div className="col-span-1">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</span>
                    </div>
                  </div>

                    {/* Service Rows */}
                  <div className="space-y-3">
                    {amcForm.serviceRows.map((row, index) => (
                      <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        {/* Service Name */}
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            value={row.service}
                            onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                            placeholder="e.g., Deep Cleaning"
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                          />
                        </div>
                        
                        {/* Description */}
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            value={row.description || ''}
                            onChange={(e) => handleUpdateServiceRow(index, 'description', e.target.value)}
                            placeholder="Service description..."
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                          />
                        </div>
                        
                        {/* Frequency Type - First to trigger auto-calculation */}
                        <div className="md:col-span-3 relative">
                          <select
                            value={row.frequencyType}
                            onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-white appearance-none"
                          >
                            {FREQUENCY_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        
                        {/* Visits - Auto-set based on frequency */}
                        <div className="md:col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={row.frequencyCount}
                            readOnly={row.frequencyType !== 'Other'}
                            onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                            title={row.frequencyType === 'Other' ? 'Enter custom visit count' : `Auto-set to ${FREQUENCY_COUNT_MAP[row.frequencyType] || 1} visits`}
                            placeholder={row.frequencyType === 'Other' ? 'Enter visits' : ''}
                            className={`w-full px-2 py-2 border border-gray-300 rounded-lg text-sm ${row.frequencyType === 'Other' ? 'bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400' : 'bg-gray-100 cursor-not-allowed'}`}
                            />
                        </div>
                        
                        {/* Delete Button */}
                        <div className="md:col-span-1 flex justify-end md:justify-center">
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
                <div className="w-full lg:w-72 flex-shrink-0">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                  {PROPERTY_TYPE_OPTIONS.map((type) => {
                    const isSelected = selectedPropertyType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedPropertyType(type.id)}
                        className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border transition-all duration-200 text-xs sm:text-sm font-medium text-center ${
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Add Row
                  </button>
                </div>
                
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 rounded-lg mb-2">
                  <div className="col-span-3"><span className="text-xs font-semibold text-gray-600 uppercase">Service</span></div>
                  <div className="col-span-4"><span className="text-xs font-semibold text-gray-600 uppercase">Description</span></div>
                  <div className="col-span-2"><span className="text-xs font-semibold text-gray-600 uppercase">Frequency</span></div>
                  <div className="col-span-2"><span className="text-xs font-semibold text-gray-600 uppercase">Visits</span></div>
                  <div className="col-span-1"></div>
                </div>
                
                <div className="space-y-2">
                  {amcForm.serviceRows.map((row, index) => (
                    <div key={index} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={row.service}
                          onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                          placeholder="Service name"
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      {/* Description */}
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={row.description || ''}
                          onChange={(e) => handleUpdateServiceRow(index, 'description', e.target.value)}
                          placeholder="Description..."
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      {/* Frequency Type - First to trigger auto-calculation */}
                      <div className="sm:col-span-2">
                        <select
                          value={row.frequencyType}
                          onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          {FREQUENCY_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      {/* Visits - Auto-set based on frequency, editable for Other */}
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          value={row.frequencyCount}
                          readOnly={row.frequencyType !== 'Other'}
                          onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                          className={`w-full px-2 py-2 border border-gray-300 rounded-lg text-sm ${row.frequencyType === 'Other' ? 'bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400' : 'bg-gray-100 cursor-not-allowed'}`}
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end sm:justify-center">
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                  <div>
                    <span className="text-gray-500 text-xs">Package</span>
                    <p className="font-semibold text-gray-800 truncate max-w-[200px]">{amcForm.packageName || 'Not specified'}</p>
                  </div>
                  <div className="sm:text-center">
                    <span className="text-gray-500 text-xs">Services</span>
                    <p className="font-semibold text-gray-800">{amcForm.serviceRows.filter(r => r.service.trim()).length}</p>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-gray-500 text-xs">Total Rate</span>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">₹{getPrice().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 sticky bottom-0">
              <button
                onClick={() => handleDeletePackage(editingPackage)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2 order-last sm:order-first"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleCloseEditModal}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePackage}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
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
                <h4 className="text-xl font-bold text-indigo-900">{viewAmcPackage.name || viewAmcPackage.packageName}</h4>
                <p className="text-sm text-indigo-600 mt-1">{viewAmcPackage.packageId || viewAmcPackage.package_code || `PKG-${viewAmcPackage.id}`}</p>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Property Type</p>
                  <p className="font-semibold text-sm capitalize">{viewAmcPackage.propertyType || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Billing</p>
                  <p className="font-semibold text-sm capitalize whitespace-nowrap">{(viewAmcPackage.billingDuration || viewAmcPackage.billingCycle || 'Yearly')?.replace('-', ' ')}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Total Price</p>
                  <p className="font-bold text-lg text-green-700">₹{(viewAmcPackage.price || viewAmcPackage.rate || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Services Included */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Services Included</p>
                {viewAmcPackage.servicesData && viewAmcPackage.servicesData.length > 0 ? (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <div className="space-y-2 min-w-[500px]">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                        <div className="col-span-1 text-xs font-semibold text-gray-600">#</div>
                        <div className="col-span-3 text-xs font-semibold text-gray-600">Service</div>
                        <div className="col-span-4 text-xs font-semibold text-gray-600 text-center">Description</div>
                        <div className="col-span-2 text-xs font-semibold text-gray-600 text-center">Frequency</div>
                        <div className="col-span-2 text-xs font-semibold text-gray-600 text-center">Visits</div>
                      </div>
                      {viewAmcPackage.servicesData.map((svc, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-amber-50 px-3 py-3 rounded-lg border border-amber-100">
                          <div className="col-span-1">
                            <span className="w-6 h-6 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                          </div>
                          <div className="col-span-3">
                            <p className="font-medium text-amber-900 text-sm">{decodeHtml(svc.name || svc.service) || 'Service'}</p>
                          </div>
                          <div className="col-span-4 overflow-hidden">
                            <p className={`text-xs text-amber-700 break-all whitespace-normal ${!(svc.description && svc.description.trim() && svc.description.trim() !== '-') ? 'text-center' : ''}`}>{decodeHtml(svc.description)?.trim() || '-'}</p>
                          </div>
                          <div className="col-span-2 text-center">
                            <p className="text-sm font-medium text-amber-700">{svc.frequency_type || svc.frequencyType || 'Monthly'}</p>
                          </div>
                          <div className="col-span-2 text-center">
                            <p className="text-sm font-medium text-amber-700">{svc.frequency_count ?? svc.frequencyCount ?? 0}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No services listed</p>
                )}
              </div>

              {/* Price Summary */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3 text-center uppercase">Price Summary</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="font-semibold text-gray-900">₹{(viewAmcPackage.price || viewAmcPackage.rate || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">GST (0%):</span>
                    <span className="font-semibold text-gray-900">₹0</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-800">TOTAL:</span>
                    <span className="font-bold text-lg text-green-700">₹{(viewAmcPackage.price || viewAmcPackage.rate || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button onClick={() => setViewAmcPackage(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AMCPackageManager;

