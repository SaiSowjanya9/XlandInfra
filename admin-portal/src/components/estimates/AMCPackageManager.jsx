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
  if (html == null) return '';
  // Never hand a non-string to JSX: React throws #31 and the whole page goes blank
  if (typeof html !== 'string') return typeof html === 'number' || typeof html === 'boolean' ? String(html) : '';
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
  frequencyOptionStyle,
  FREQUENCY_COUNT_MAP,
  isCustomFrequency,
  seedTestData,
  getAMCPackageByPropertyType,
} from '../../utils/estimateStore';
import { getPackagePropertyTypes, packageMatchesPropertyType, formatCurrency } from '../../utils/estimatePackageUtils';
import { applyPackageMarkup, hasMarkup, packageTotals, quotePackageRow, rowInput } from '../../utils/packageServicePricing';
import { applyRowPatches, duplicatePackageName, packageRowForSave, packageRowFromDialog, packageRowFromSaved, updatePackageRow } from '../../utils/packageRows';
import { capitalizeFirst } from '../../utils/text';
import { PRICING_METHODS, methodLabel } from './AddServicePage';
import PackageServicePicker from './PackageServicePicker';
import CustomServiceDialog from './CustomServiceDialog';
import { CapacitySlabSelect } from './CapacitySlabList';
import { exportPackageToPDF } from '../../utils/pdfExport';
import { Home, Building, TreePine, Map, Layers as LayersIcon } from 'lucide-react';
import AMCPackageDetailView, { packageServiceRows } from './AMCPackageDetailView';

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

// The package's service table sizes its own columns: twelve equal ones could not hold Method and
// Input separately without squeezing the service name.
// The description is not a column: it runs the full width of the row underneath, so there is room
// to read and type it.
const PACKAGE_ROW_GRID = 'md:grid-cols-[minmax(10rem,2fr)_6.5rem_9.5rem_9.5rem_4rem_6.5rem_4rem]';

const AMCPackageManager = ({ admin, showToast, selectedFp, onRefresh }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  const token = getAuthToken();
  
  // Operations Manager defaults to 'all-packages' tab (no create access)
  // The list is the landing view; Create Package is the highlighted action on the right
  const [activeTab, setActiveTab] = useState('all-packages'); // 'create' or 'all-packages'
  const [amcPackages, setAmcPackages] = useState([]);
  const [filterPropertyType, setFilterPropertyType] = useState('all'); // Filter for All Packages tab
  const [exportingId, setExportingId] = useState(null); // Track PDF export state
  
  // The package being edited in the create form, or null for a new one
  const [editingPackage, setEditingPackage] = useState(null);
  
  // View Modal state
  const [viewAmcPackage, setViewAmcPackage] = useState(null);

  // A package can apply to several property types, so the same one is configured once
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState([]);
  // Open while the configured services are being browsed; Add Row still adds a blank row to type into
  const [showServicePicker, setShowServicePicker] = useState(false);

  // Package form with dynamic service rows
  const [amcForm, setAmcForm] = useState({
    packageName: '',
    markupPercentage: '',
    serviceRows: [],
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


  // The package's price is what its configured services add up to, so it is derived rather than typed
  // Every row's price follows the package's markup, exactly as a service's own markup prices it
  // on the service form. Blank leaves each row on the price it already has.
  const totals = packageTotals(amcForm.serviceRows, amcForm.markupPercentage);
  const pricedRows = applyPackageMarkup(amcForm.serviceRows, amcForm.markupPercentage);
  const getPrice = () => totals.price;
  // Each row is quoted against a type its own service covers -- see quotePropertyType -- because the
  // quote refuses one it does not, which left a row unpriced before any type was ticked.
  const catalogPath = selectedFp?.id && selectedFp.id !== 'all' ? '/api/admin/service-catalog' : '/api/admin/service-catalog';
  const [pricingError, setPricingError] = useState('');

  // Prices every row that came from the catalog and has its amount filled in. Runs on the rows'
  // pricing inputs only, so typing a description does not re-quote the package.
  const pricingKey = JSON.stringify(amcForm.serviceRows.map(row =>
    [row.catalogServiceId, row.inputValue, row.frequencyType, row.frequencyCount]));
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let failure = '';
      const snapshot = amcForm.serviceRows;
      const patches = await Promise.all(snapshot.map(async row => {
        const result = await quotePackageRow(row, { apiPath: catalogPath, propertyTypes: selectedPropertyTypes, fpId: selectedFp?.id, token, signal: controller.signal })
          .catch(error => (error.name === 'AbortError' ? { skipped: true } : { error: error.message }));
        if (result.error) { failure = result.error; return { price: undefined, vendorCost: undefined }; }
        if (result.priced) return result.priced;
        if (result.cleared) return { price: undefined, vendorCost: undefined, operatingCost: undefined, marginPercentage: undefined };
        return null;
      }));
      if (controller.signal.aborted) return;
      setPricingError(failure);
      // Applied to the rows as they are now: whatever was typed while the quotes ran is kept, and
      // nothing is written back when no figure changed, or this would loop
      setAmcForm(prev => {
        const serviceRows = applyRowPatches(prev.serviceRows, snapshot, patches);
        return serviceRows === prev.serviceRows ? prev : { ...prev, serviceRows };
      });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [pricingKey, selectedPropertyTypes, catalogPath, selectedFp?.id, token]);

  // A slab carries its own frequency and visit count, so choosing one takes them with it. Leaving
  // the row on a different frequency has the quote refused -- "Frequency override is disabled for
  // this service" -- and the row stays unpriced.
  const handleChooseSlab = (index, capacity, slab) => {
    setAmcForm(prev => ({
      ...prev,
      serviceRows: prev.serviceRows.map((row, i) => (i === index ? {
        ...row, inputValue: capacity,
        ...(slab ? {
          frequencyType: slab.defaultFrequency ?? row.defaultFrequency ?? row.frequencyType,
          frequencyCount: slab.defaultVisitsPerYear ?? row.defaultVisitsPerYear ?? row.frequencyCount
        } : {})
      } : row))
    }));
  };

  // Service row handlers
  const handleAddServiceRow = () => setCustomRowOpen(true);
  // Add Row opens the same dialog an estimate's hand-entered service uses, because a row has no
  // room for what one needs: a category, a quantity, a schedule and what the vendor charges. The
  // figure asked for is the vendor price -- a package is bought here, not sold -- so it lands on
  // the row as its vendor cost and shows in the Internal figures.
  const [customRowOpen, setCustomRowOpen] = useState(false);

  // Configured services arrive as ordinary rows, editable afterwards like any typed one. The blank
  // starter row is replaced rather than left above them.
  const handleAddCatalogServices = (rows) => {
    if (!rows.length) return;
    setAmcForm(prev => {
      const existing = prev.serviceRows.filter(row => String(row.service || '').trim() !== '');
      return { ...prev, serviceRows: [...existing, ...rows] };
    });
  };

  // Functional updates on new row objects: the old version assigned into the row React was holding,
  // from a copy of the form taken at render time
  const handleUpdateServiceRow = (index, field, value) => {
    const next = field === 'service' || field === 'description' ? capitalizeFirst(value) : value;
    setAmcForm(prev => ({ ...prev, serviceRows: updatePackageRow(prev.serviceRows, index, field, next, FREQUENCY_COUNT_MAP) }));
  };

  // Any row may go, the last one included: the table is allowed to be empty, and saving already
  // refuses a package with no services.
  const handleRemoveServiceRow = (index) => {
    setAmcForm(prev => ({ ...prev, serviceRows: prev.serviceRows.filter((_, i) => i !== index) }));
  };

  // Form actions
  const handleSavePackage = async () => {
    if (!amcForm.packageName.trim()) {
      showToast?.('Please enter a package name', 'error');
      return;
    }
    if (packageNameTaken) {
      showToast?.(`A package named "${packageNameTaken.packageName || packageNameTaken.name}" already exists`, 'error');
      return;
    }

    // Filter out empty service rows
    const validServices = amcForm.serviceRows.filter(row => String(row.service || '').trim());
    if (validServices.length === 0) {
      showToast?.('Please add at least one service', 'error');
      return;
    }

    // The price is the sum of the configured services, so it is they that must be priced
    if (totals.price <= 0) {
      showToast?.('Add a configured service and its amount so the package has a price', 'error');
      return;
    }

    if (!selectedPropertyTypes.length) {
      showToast?.('Please select at least one property type', 'error');
      return;
    }

    // Check if FP is selected (required for admin mode)
    if (selectedFp?.id && selectedFp.id !== 'all') {
      // Use admin API endpoint to save to fp_amc_packages table
      const packageData = {
        fpId: selectedFp.id,
        packageName: amcForm.packageName.trim(),
        propertyType: selectedPropertyTypes[0],
        propertyTypes: selectedPropertyTypes,
        // What each row was priced from and what it came to, so the package reads back and re-prices
        // exactly as it was configured
        serviceRows: validServices.map(packageRowForSave),
        rate: totals.price,
        markupPercentage: amcForm.markupPercentage === '' ? null : Number(amcForm.markupPercentage),
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

  // Editing opens the same form a package is created in. The modal it used to open had no Method,
  // Input or Price columns and no markup, and its own Price box was ignored on save, so a package
  // could not be edited into the shape it was created in.
  const handleOpenEditModal = (pkg) => {
    setEditingPackage(pkg);
    
    // Load every property type the package applies to
    setSelectedPropertyTypes(getPackagePropertyTypes(pkg));
    
    // Load service rows if they exist, otherwise create from services string
    let loadedServiceRows = [];
    if (Array.isArray(pkg.serviceRows) && pkg.serviceRows.length > 0) {
      // A row saved from the catalog reopens on the service and amount it was priced from
      loadedServiceRows = pkg.serviceRows.map(row => packageRowFromSaved(row, decodeHtml));
    } else if (typeof pkg.services === 'string' && pkg.services) {
      loadedServiceRows = pkg.services.split(',').map(s => ({
        service: decodeHtml(s.trim()),
        description: '',
        frequencyCount: 12,
        frequencyType: 'Monthly'
      }));
    } else {
      loadedServiceRows = [];
    }
    
    setAmcForm({
      packageName: decodeHtml(pkg.packageName) || '',
      serviceRows: loadedServiceRows,
      price: pkg.rate?.toString() || '',
      // Reopening a package brings back the markup it was priced with, so its rows do not silently
      // revert to whatever each service's own markup says
      markupPercentage: pkg.markupPercentage ?? pkg.markup_percentage ?? '',
      billingDuration: pkg.billingDuration || 'monthly',
      description: decodeHtml(pkg.description) || ''
    });
    setActiveTab('create');
  };

  const handleCloseEditModal = () => {
    resetForm();
    setActiveTab('all-packages');
  };

  // The same package name twice in one franchise is two entries nobody can tell apart in a dropdown
  const packageNameTaken = duplicatePackageName(
    selectedFp?.id && selectedFp.id !== 'all' ? amcPackages.filter(pkg => String(pkg.franchisePartnerId ?? selectedFp.id) === String(selectedFp.id)) : amcPackages,
    amcForm.packageName, editingPackage?.id ?? editingPackage?.packageId);

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
          // Deleting the package open in the form leaves nothing to save it back to
          if (editingPackage && (editingPackage.id ?? editingPackage.packageId) === (pkg.id ?? pkg.packageId)) handleCloseEditModal();
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
      markupPercentage: '',
      serviceRows: [],
      price: '',
      billingDuration: 'monthly',
      description: ''
    });
    setSelectedPropertyTypes([]);
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
    <div className="space-y-4">
      {/* All Packages is the landing view; Create Package is the highlighted action on
          the right and stays there while the form is open. Hidden for Operations Manager. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
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
        {!isOpsManager && (
          <button
            onClick={() => { resetForm(); setActiveTab('create'); }}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Package
          </button>
        )}
      </div>

      {/* All AMC Packages Tab - With Property Type Filter */}
      {/* A package opens here, in place of the list, as an estimate does in All Estimates */}
      {activeTab === 'all-packages' && viewAmcPackage && <AMCPackageDetailView pkg={viewAmcPackage} onClose={() => setViewAmcPackage(null)} internal />}
      {activeTab === 'all-packages' && !viewAmcPackage && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">All Packages</h3>
                <p className="text-sm text-gray-500">
                  {filterPropertyType === 'all' 
                    ? `${amcPackages.length} package(s) available` 
                    : `${amcPackages.filter(p => packageMatchesPropertyType(p, filterPropertyType)).length} package(s) for ${PROPERTY_TYPE_OPTIONS.find(t => t.id === filterPropertyType)?.label}`}
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
                const count = amcPackages.filter(p => packageMatchesPropertyType(p, type.id)).length;
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
                  : amcPackages.filter(p => packageMatchesPropertyType(p, filterPropertyType));
                
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
                    <table className="list-table w-full">
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
                          
                          // The row and its name open the package full screen, as an estimate opens
                          // from All Estimates. The Operations Manager has no actions column, so
                          // this is also how they read a package at all.
                          const openPackage = () => setViewAmcPackage({ ...pkg, servicesData: packageServiceRows(pkg) });
                          return (
                            <tr key={pkg.packageId} onClick={openPackage} className="hover:bg-gray-50 transition-colors cursor-pointer" title="View package">
                              <td className="px-4 md:px-6 py-4">
                                <button type="button" onClick={(e) => { e.stopPropagation(); openPackage(); }}
                                  className="text-left font-semibold text-gray-900 text-sm md:text-base hover:text-amber-600 hover:underline">
                                  {decodeHtml(pkg.packageName) || 'Unnamed Package'}
                                </button>
                              </td>
                              <td className="px-3 md:px-4 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {(getPackagePropertyTypes(pkg).length ? getPackagePropertyTypes(pkg) : ['-']).map(type => (
                                    <span key={type} className="inline-block px-2 md:px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg border border-slate-200 whitespace-nowrap text-center">
                                      {PROPERTY_TYPE_OPTIONS.find(t => t.id === type)?.label || type}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 md:px-4 py-4">
                                <span className="inline-block px-2 md:px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200 whitespace-nowrap">
                                  {BILLING_DURATIONS.find(d => d.value === pkg.billingDuration)?.label || 'Monthly'}
                                </span>
                              </td>
                              <td className="px-3 md:px-4 py-4 max-w-[200px] hidden sm:table-cell">
                                <p className="text-sm text-gray-600 truncate" title={decodeHtml(servicesText)}>
                                  {decodeHtml(servicesText) || '-'}
                                </p>
                              </td>
                              <td className="px-3 md:px-4 py-4 text-right">
                                <span className="text-base md:text-lg font-bold text-slate-800 whitespace-nowrap">
                                  ₹{totalRate.toLocaleString()}
                                </span>
                              </td>
                              {/* Actions column - Hidden for Operations Manager */}
                              {!isOpsManager && (
                                <td className="px-4 py-4 cursor-default" onClick={(e) => e.stopPropagation()}>
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

      {/* Create Package Tab, read top to bottom: what the package applies to, what is in it, then
          what it comes to. */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {editingPackage && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
              <p className="text-sm text-amber-800">Editing <span className="font-semibold">{decodeHtml(editingPackage.packageName) || 'package'}</span> <span className="text-amber-600">({editingPackage.packageId})</span></p>
              <button onClick={handleCloseEditModal} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100">Cancel editing</button>
            </div>
          )}
          <div className="space-y-6">
          {/* What the package applies to, before what is in it */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900">Applicable Property Types <span className="text-red-500">*</span></h2>
            <p className="mt-1 text-xs text-gray-500">Every property type this package applies to</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <label key={type.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${selectedPropertyTypes.includes(type.id) ? 'border-slate-400 bg-slate-50 text-slate-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <input
                    type="checkbox"
                    checked={selectedPropertyTypes.includes(type.id)}
                    onChange={() => setSelectedPropertyTypes(prev => prev.includes(type.id) ? prev.filter(value => value !== type.id) : [...prev, type.id])}
                    className="h-4 w-4 rounded border-gray-300 text-slate-600 focus:ring-slate-200"
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>

          {/* Package Configuration Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* Header with Add Button */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Package Configuration</h2>
              <div className="flex items-center gap-2">
                {/* Add Row is for a service typed by hand; Add Service picks a configured one */}
                <button
                  onClick={handleAddServiceRow}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add Row
                </button>
                <button
                  onClick={() => setShowServicePicker(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Service
                </button>
              </div>
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
                  onChange={(e) => { const packageName = capitalizeFirst(e.target.value); setAmcForm(prev => ({ ...prev, packageName })); }}
                  placeholder="e.g., Gold Package"
                  maxLength={150}
                  className={`w-full max-w-md px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-gray-100 focus:border-gray-400 ${packageNameTaken ? 'border-red-300' : 'border-gray-300'}`}
                />
                {packageNameTaken && <p role="alert" className="mt-1.5 text-xs text-red-600">A package with this name already exists. Choose another name or edit the existing package.</p>}
              </div>

              {/* What the package covers, as a whole. Saved with the package and shown on its view. */}
              <div className="mb-6">
                <label htmlFor="package-description" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">Package Description</label>
                <textarea
                  id="package-description"
                  rows={5}
                  maxLength={1000}
                  value={amcForm.description}
                  onChange={(e) => { const description = capitalizeFirst(e.target.value); setAmcForm(prev => ({ ...prev, description })); }}
                  placeholder="What this package covers, visit terms, exclusions..."
                  className="w-full min-h-[120px] px-4 py-3 border border-gray-300 rounded-lg text-sm leading-relaxed resize-y focus:ring-2 focus:ring-gray-100 focus:border-gray-400"
                />
                <p className="mt-1 text-right text-[11px] text-gray-400">{(amcForm.description || '').length} / 1000</p>
              </div>

              {/* Service Configuration. Every column a configured service needs to be priced: what it
                  is, how it is priced, the amount it is priced on, its schedule and what it comes to. */}
              <div className="overflow-x-auto">
                <div className="min-w-[54rem]">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Service Configuration</h3>
                  
                  {/* Table Header. Method and Input are separate columns -- one states how the
                      service is priced, the other takes the amount -- so the row sizes its own
                      columns rather than dividing twelve of them. */}
                  <div className={`hidden md:grid ${PACKAGE_ROW_GRID} gap-2 px-3 py-2 bg-slate-50 rounded-lg mb-3`}>
                    {[['Service', 'text-left'], ['Method', 'text-left'], ['Input', 'text-left'],
                      ['Frequency', 'text-left'], ['Visits', 'text-left'], ['Price', 'text-right'], ['Action', 'text-center']].map(([label, align]) => (
                      <div key={label} className={`px-2 ${align}`}>
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{label}</span>
                      </div>
                    ))}
                  </div>

                    {/* Service Rows. The table starts empty: a row arrives only when Add Service
                        picks a configured one or Add Row makes a blank one. */}
                  <div className="space-y-3">
                    {!amcForm.serviceRows.length && (
                      <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                        No services yet. Use <span className="font-medium">Add Service</span> to price one from the catalog, or <span className="font-medium">Add Row</span> to type one in.
                      </p>
                    )}
                    {amcForm.serviceRows.map((row, index) => (
                      <div key={index} className={`flex flex-col md:grid ${PACKAGE_ROW_GRID} gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 items-start`}>
                        {/* Service Name */}
                        <div>
                          <input
                            type="text"
                            value={row.service}
                            onChange={(e) => handleUpdateServiceRow(index, 'service', e.target.value)}
                            placeholder="e.g., Deep Cleaning"
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                          />
                          {row.category && <p className="mt-1 px-1 text-[11px] text-gray-500 truncate" title={row.category}>{row.category}</p>}
                        </div>

                        {/* How the service is priced. A configured service brings its own method, so
                            that one is stated; a row typed by hand chooses one, which decides what
                            its Input asks for. */}
                        <div className={row.catalogServiceId ? 'py-2' : 'relative'}>
                          {row.catalogServiceId
                            ? <span className="block px-2 text-xs text-gray-600">{methodLabel(row.pricingMethod)}</span>
                            : <>
                              <select
                                value={row.pricingMethod || ''}
                                onChange={(e) => handleUpdateServiceRow(index, 'pricingMethod', e.target.value)}
                                aria-label={`${row.service || 'Service'} pricing method`}
                                className="w-full pl-2 pr-6 py-2 border border-gray-300 rounded-lg text-sm bg-white appearance-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                              >
                                <option value="">Method</option>
                                {PRICING_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            </>}
                        </div>

                        {/* The amount that method is priced on: a quantity, an area, a capacity or a
                            headcount. Fixed Price measures nothing, so it asks for nothing. */}
                        <div>
                          {(() => {
                            const input = rowInput(row);
                            // Capacity Slab prices from a table, so the row offers its bands rather
                            // than asking for a capacity to be looked up against them
                            if (row.pricingMethod === 'capacity_slab' && row.capacitySlabs?.length) {
                              return <CapacitySlabSelect slabs={row.capacitySlabs} unit={row.unit} capacity={row.inputValue}
                                onChange={(value, slab) => handleChooseSlab(index, value, slab)}
                                ariaLabel={`${row.service || 'Service'} slab`}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400" />;
                            }
                            return input ? (
                              <input
                                type="number" min={input.min} step={input.step}
                                value={row.inputValue ?? ''}
                                onChange={(e) => handleUpdateServiceRow(index, 'inputValue', e.target.value)}
                                placeholder={input.unit || input.label}
                                title={`${input.label}${input.unit ? ` (${input.unit})` : ''}`}
                                aria-label={`${row.service || 'Service'} ${input.label}`}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                              />
                            ) : <p className="px-1 py-2 text-xs text-gray-400">—</p>;
                          })()}
                        </div>
                        
                        {/* Frequency Type - First to trigger auto-calculation */}
                        <div className="relative">
                          {/* A service that forbids a frequency change has its quote refused when the
                              row carries a different one, so the row is not allowed to create that
                              conflict: the service's own schedule stands, and a slab's stands over it. */}
                          <select
                            value={row.frequencyType}
                            disabled={row.catalogServiceId && row.allowFrequencyOverride === false}
                            title={row.catalogServiceId && row.allowFrequencyOverride === false ? 'This service sets its own frequency' : undefined}
                            onChange={(e) => handleUpdateServiceRow(index, 'frequencyType', e.target.value)}
                            className="w-full pl-2 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-white appearance-none"
                          >
                            {FREQUENCY_TYPES.map(type => (
                              <option key={type} value={type} style={frequencyOptionStyle(type)}>{type}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        
                        {/* Visits - Auto-set based on frequency */}
                        <div>
                          <input
                            type="number"
                            min="0"
                            value={row.frequencyCount}
                            readOnly={!isCustomFrequency(row.frequencyType)}
                            onChange={(e) => handleUpdateServiceRow(index, 'frequencyCount', e.target.value)}
                            title={isCustomFrequency(row.frequencyType) ? 'Enter the visit count' : `${row.frequencyType} means ${FREQUENCY_COUNT_MAP[row.frequencyType] ?? 1} visits a year. Choose Custom to set your own.`}
                            placeholder={isCustomFrequency(row.frequencyType) ? 'Enter visits' : ''}
                            className={`w-full px-2 py-2 border border-gray-300 rounded-lg text-sm ${isCustomFrequency(row.frequencyType) ? 'bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400' : 'bg-gray-100 cursor-not-allowed'}`}
                            />
                        </div>

                        {/* What this service comes to. A configured row opens on the server's quote
                            and a hand-typed one on nothing, and either may be typed over -- the
                            quote then refreshes the costs behind it without touching the figure. */}
                        <div>
                          <input
                            type="number" min="0" step="0.01"
                            value={pricedRows[index]?.price ?? ''}
                            onChange={(e) => handleUpdateServiceRow(index, 'price', e.target.value)}
                            placeholder={row.catalogServiceId ? 'Quoted' : '0'}
                            aria-label={`${row.service || 'Service'} price`}
                            title={row.priceOverridden ? 'Typed over the quote' : undefined}
                            className={`w-full px-2 py-2 text-right border rounded-lg text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 ${row.priceOverridden ? 'border-amber-300 bg-amber-50/50' : 'border-gray-300'}`}
                          />
                        </div>
                        
                        {/* Delete Button */}
                        <div className="flex justify-end md:justify-center">
                          <button
                            onClick={() => handleRemoveServiceRow(index)}
                            aria-label={`Remove ${row.service || 'service'}`}
                            className="p-2 rounded-lg text-red-500 transition-colors hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Description: the full width of the row, so it can be read and typed */}
                        <div className="w-full md:col-span-full">
                          <textarea
                            rows={3}
                            maxLength={1000}
                            value={row.description || ''}
                            onChange={(e) => handleUpdateServiceRow(index, 'description', e.target.value)}
                            placeholder="Service description — what this service covers in the package"
                            aria-label={`${row.service || 'Service'} description`}
                            className="w-full min-h-[80px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm leading-relaxed resize-y bg-white focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
                {pricingError && <p role="alert" className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{pricingError}</p>}
                {/* A row with no configured service behind it cannot be priced, and the package's
                    price is the sum of the priced ones -- so it is said plainly rather than left to
                    be inferred from two dashes. */}
                {amcForm.serviceRows.some(row => String(row.service || '').trim() && !row.catalogServiceId) && (
                  <p className="mt-3 text-xs text-gray-500">
                    A row added with <span className="font-medium">Add Row</span> states what the vendor charges, which counts towards the vendor cost below. Every row's Price may be typed over: a configured one opens on its quote, and a figure entered by hand stands until the field is cleared.
                  </p>
                )}
                {/* No slab table under the rows. A Capacity Slab row offers its bands in the Input
                    column and pricing the chosen one is the whole of the job here -- the full table
                    belongs to the service's own configuration, not to a package being assembled. */}
              </div>
            </div>
          </div>
          </div>

          {/* What the package comes to, under what is in it. Its three parts sit side by side now
              that the panel has the full width rather than a column of its own. */}
          <div className="w-full">
            <div className="w-full">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 h-full">
                    <h3 className="text-gray-600 text-xs uppercase tracking-wider mb-4 font-semibold">Price Summary</h3>
                    {/* What is decided on the left, what it comes to on the right. The two were
                        interleaved -- price, markup, period, then the totals again -- so the
                        figures were read before the fields that set them, and the panel repeated
                        the same amount in two places a column apart. */}
                    <div className="grid gap-6 lg:grid-cols-2">

                    {/* The two figures that decide the price, in the order they are answered */}
                    <div className="space-y-4">
                      {/* Every row is priced at what the vendor charges, so this is XLAND's margin on
                          the package -- the same relationship a service's own markup has to its
                          vendor rate. Blank leaves the package at cost, which is why it says so. */}
                      <div>
                        <label className="text-gray-600 text-xs mb-2 block font-medium" htmlFor="package-markup">Markup (%) <span className="font-normal text-gray-400">on the vendor cost</span></label>
                        <input
                          id="package-markup" type="number" min="0" max="1000" step="0.01"
                          value={amcForm.markupPercentage ?? ''}
                          onChange={(e) => { const markupPercentage = e.target.value; setAmcForm(prev => ({ ...prev, markupPercentage })); }}
                          placeholder="None"
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-gray-200 focus:border-gray-400"
                        />
                      </div>

                      {/* Service Period */}
                      <div>
                        <label className="text-gray-600 text-xs mb-2 block font-medium">Service Period</label>
                        <div className="relative">
                          <select
                            value={amcForm.billingDuration}
                            onChange={(e) => { const billingDuration = e.target.value; setAmcForm(prev => ({ ...prev, billingDuration })); }}
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
                    </div>

                    {/* What it comes to: one card on the right, stating the price once. The package's
                        own name was a line of it and is gone -- the field that sets it is directly
                        above this panel, so repeating it here said nothing. */}
                    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 lg:justify-self-end lg:w-full lg:max-w-sm">
                      <p className="text-gray-600 text-xs font-medium">Price (₹)</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(totals.price)}</p>
                      {/* A row is priced at the vendor's rate, so with no markup the package is
                          sold at cost -- said plainly rather than left to be worked out */}
                      <p className="mt-1 text-[11px] text-gray-500">{totals.pricedCount
                        ? `From ${totals.pricedCount} configured service${totals.pricedCount === 1 ? '' : 's'}, priced at vendor cost${hasMarkup(amcForm.markupPercentage) ? ` plus ${Number(amcForm.markupPercentage)}% markup` : ' — add a markup to earn on it'}`
                        : 'Add a configured service and its amount'}</p>
                      <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Services</span>
                          <span className="font-medium text-gray-800 tabular-nums">{amcForm.serviceRows.filter(r => r.service.trim()).length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Total Rate</span>
                          <span className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(totals.price)}</span>
                        </div>
                      </div>
                    </div>

                    {/* What the package costs XLAND. Internal to this screen, like the service form's
                        pricing preview, and never part of what a customer is shown.
                        Each figure is a cell with its label above it: as a row of label-value pairs
                        one figure ran straight into the next label -- "₹1,200 XLAND Cost ₹360
                        Customer Price" -- and which number belonged to which word was a guess.
                        The reading order is also the arithmetic: cost, plus margin, is the price. */}
                    <div className="lg:col-span-2 border-t border-gray-200 pt-4">
                      <p className="text-gray-600 text-[11px] uppercase tracking-wider font-semibold">Internal <span className="font-normal normal-case tracking-normal text-gray-400">(not shown to customers)</span></p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ['Annual Vendor Cost', formatCurrency(totals.vendorCost), 'text-gray-900'],
                          // The markup in rupees, as on the service form: vendor cost plus this is
                          // the customer price. It used to show `operatingCost`, an overhead no
                          // configured service carries, so it sat at ₹0 beside a real margin.
                          ['XLAND Cost', formatCurrency(totals.xlandCost), 'text-gray-900'],
                          ['Customer Price', formatCurrency(totals.price), 'text-gray-900'],
                          ['Margin', totals.marginPercent == null ? '—' : `${totals.marginPercent}%`,
                            totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600']
                        ].map(([label, value, tone]) => (
                          <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                            <dt className="truncate text-[11px] text-gray-500" title={label}>{label}</dt>
                            <dd className={`mt-1 truncate text-sm font-bold tabular-nums ${tone}`} title={value}>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    </div>
                  </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex justify-between items-center">
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
        </div>
      )}


      {/* Shared by the create form and the edit modal: both fill the same service rows */}
      {/* Add Row opens the estimate's own hand-entered service dialog, asking for the vendor price:
          a package row is bought from a vendor rather than sold to a customer. */}
      <CustomServiceDialog
        open={customRowOpen}
        onClose={() => setCustomRowOpen(false)}
        onSubmit={values => { handleAddCatalogServices([packageRowFromDialog(values)]); setCustomRowOpen(false); }}
        title="Add Service Row"
        priceLabel="Vendor Price"
        subtitle="Typed in by hand, so what the vendor charges is set here rather than quoted from the catalog"
        fpId={selectedFp?.id}
      />
      <PackageServicePicker
        open={showServicePicker}
        onClose={() => setShowServicePicker(false)}
        onAdd={handleAddCatalogServices}
        propertyTypes={selectedPropertyTypes}
        fpId={selectedFp?.id}
      />
    </div>
  );
};

export default AMCPackageManager;

