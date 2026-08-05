import { useState, useEffect } from 'react';
import {
  Search, Filter, Eye, Edit, Edit2, Download, Send, Trash2, X, ChevronDown, Save, RefreshCw,
  Calendar, DollarSign, Building2, User, Home, LayoutGrid, Layers,
  TreePine, Map, Briefcase, Archive, CheckSquare, Square
} from 'lucide-react';
import {
  searchEstimates, updateEstimate, deleteEstimate, calculateEstimateTotal,
  PROPERTY_TYPES, ESTIMATE_STATUSES, normalizePropertyType
} from '../../utils/estimateStore';
import { exportEstimateToPDF } from '../../utils/pdfExport';
import * as XLSX from 'xlsx';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PROPERTY_ICONS = {
  APT: Home,
  FLAT: LayoutGrid,
  GC: Layers,
  VILLA: TreePine,
  PLOT: Map
};

const STATUS_STYLES = {
  Draft: 'bg-gray-100 text-gray-700',
  draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  sent: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  Expired: 'bg-orange-100 text-orange-700',
  expired: 'bg-orange-100 text-orange-700',
  Archived: 'bg-slate-100 text-slate-700',
  archived: 'bg-slate-100 text-slate-700'
};

// Format date in IST format (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '-';
  // If already in yyyy-mm-dd format, parse directly to avoid timezone issues
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse dd/mm/yyyy to yyyy-mm-dd (internal format)
const parseISTDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle date input change with auto-formatting
const handleDateInput = (value, setter) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  setter(cleaned);
};

const EstimatesList = ({ 
  admin, 
  estimates = [], 
  onRefresh, 
  showToast,
  estimateTypeFilter: externalEstimateTypeFilter,
  onEstimateTypeFilterChange 
}) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const [selectedEstimates, setSelectedEstimates] = useState([]);
  const [archivingSelected, setArchivingSelected] = useState(false);
  const [dateFromDisplay, setDateFromDisplay] = useState('');
  const [dateToDisplay, setDateToDisplay] = useState('');
  const [filters, setFilters] = useState({
    estimateType: externalEstimateTypeFilter || 'all',
    status: 'all',
    propertyType: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewEstimate, setViewEstimate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editEstimate, setEditEstimate] = useState(null);
  const [editEstimateForm, setEditEstimateForm] = useState(null);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const token = getAuthToken();

  // Sync internal filter with external prop when it changes
  useEffect(() => {
    if (externalEstimateTypeFilter !== undefined && externalEstimateTypeFilter !== filters.estimateType) {
      setFilters(prev => ({ ...prev, estimateType: externalEstimateTypeFilter }));
    }
  }, [externalEstimateTypeFilter]);
  // Load AMC packages and addons for edit modal
  useEffect(() => {
    const loadPackagesAndAddons = async () => {
      try {
        const [pkgRes, addRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/all-amc-packages`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/admin/all-addons`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const pkgData = await pkgRes.json();
        const addData = await addRes.json();
        if (pkgData.success) setAmcPackages(pkgData.data || []);
        if (addData.success) setAddons(addData.data || []);
      } catch (e) { console.log('Load packages/addons error:', e); }
    };
    loadPackagesAndAddons();
  }, [token]);

  // Open edit estimate modal
  const openEditEstimate = (estimate) => {
    let selectedAddonsWithQty = [];
    if (estimate.addons_data || estimate.addons) {
      try {
        const addonsData = estimate.addons || (typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data);
        selectedAddonsWithQty = (addonsData || []).map(a => ({ id: a.id || a.addon_id, quantity: a.quantity || 1 })).filter(a => a.id);
      } catch (e) { console.log('Addon parse error:', e); }
    }
    setEditEstimate(estimate);
    setEditEstimateForm({
      client_name: estimate.client_name || estimate.clientName || '',
      client_phone: estimate.client_phone || estimate.clientPhone || '',
      client_email: estimate.client_email || estimate.clientEmail || '',
      property_name: estimate.property_name || estimate.propertyName || '',
      zone: estimate.zone || '',
      city: estimate.city || '',
      address: estimate.address || '',
      package_id: estimate.package_id || '',
      selectedAddons: selectedAddonsWithQty,
      discount_percent: estimate.discount_percent || estimate.discountPercent || 0,
      gst_percent: estimate.gst_percent || estimate.gstPercent || 0,
      description: estimate.description || ''
    });
  };

  // Calculate pricing for edit form
  const calculateEditPricing = () => {
    if (!editEstimateForm) return { subtotal: 0, discountAmt: 0, gstAmt: 0, total: 0 };
    const pkg = amcPackages.find(p => p.id == editEstimateForm.package_id);
    const pkgPrice = parseFloat(pkg?.price) || parseFloat(editEstimate?.package_price) || 0;
    const addonsPrice = (editEstimateForm.selectedAddons || []).reduce((sum, item) => {
      const addon = addons.find(a => a.id == item.id);
      const qty = item.quantity || 1;
      return sum + ((parseFloat(addon?.price) || 0) * qty);
    }, 0);
    const subtotal = pkgPrice + addonsPrice;
    const discount = parseFloat(editEstimateForm.discount_percent) || 0;
    const gst = parseFloat(editEstimateForm.gst_percent) || 0;
    const discountAmt = (subtotal * discount) / 100;
    const gstAmt = ((subtotal - discountAmt) * gst) / 100;
    const total = subtotal - discountAmt + gstAmt;
    return { subtotal, discountAmt, gstAmt, total };
  };

  // Format currency
  const formatCurrency = (amt) => {
    const num = parseFloat(amt);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(isNaN(num) ? 0 : Math.round(num));
  };

  // Handle update estimate
  const handleUpdateEstimate = async () => {
    if (!editEstimate || !editEstimateForm) return;
    if (!editEstimateForm.client_name?.trim()) { showToast('Customer name is required', 'error'); return; }
    setSavingEstimate(true);
    try {
      const pkg = amcPackages.find(p => p.id == editEstimateForm.package_id);
      const pricing = calculateEditPricing();
      
      // Get package services if package changed
      let packageServices = null;
      if (pkg && pkg.services) {
        packageServices = typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services;
      }
      
      // Build addons data with descriptions and quantities
      const selectedAddonsList = (editEstimateForm.selectedAddons || []).map(item => {
        const addon = addons.find(a => a.id == item.id);
        return addon ? { 
          id: addon.id, 
          name: addon.service_name, 
          description: addon.description || '',
          price: addon.price, 
          frequency_type: addon.frequency_type, 
          frequency_count: addon.frequency_count,
          quantity: item.quantity || 1
        } : null;
      }).filter(Boolean);
      
      const payload = {
        client_name: editEstimateForm.client_name, 
        client_phone: editEstimateForm.client_phone, 
        client_email: editEstimateForm.client_email,
        property_name: editEstimateForm.property_name, 
        zone: editEstimateForm.zone, 
        city: editEstimateForm.city, 
        address: editEstimateForm.address,
        package_id: editEstimateForm.package_id, 
        package_name: pkg?.name || editEstimate.package_name || editEstimate.packageName, 
        package_price: pkg?.price || editEstimate.package_price || editEstimate.packagePrice,
        amc_package_description: pkg?.description || editEstimate.amc_package_description,
        package_services: packageServices,
        billing_duration: pkg?.billing_duration || editEstimate.billing_duration,
        subtotal: pricing.subtotal, 
        discount_percent: editEstimateForm.discount_percent, 
        discount_amount: pricing.discountAmt,
        gst_percent: editEstimateForm.gst_percent, 
        gst_amount: pricing.gstAmt, 
        total_amount: pricing.total,
        addons_data: selectedAddonsList, 
        description: editEstimateForm.description
      };
      
      const res = await fetch(`${API_BASE}/api/admin/estimates/${editEstimate.id}`, {
        method: 'PUT', 
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) { 
        showToast('Estimate updated successfully'); 
        setEditEstimate(null); 
        setEditEstimateForm(null); 
        onRefresh(); 
      } else { 
        showToast(result.message || 'Failed to update estimate', 'error'); 
      }
    } catch (e) { 
      console.error('Update estimate error:', e); 
      showToast('Failed to update estimate', 'error'); 
    } finally { 
      setSavingEstimate(false); 
    }
  };


  // Handler for estimate type filter change - syncs with parent
  const handleEstimateTypeChange = (value) => {
    setFilters(prev => ({ ...prev, estimateType: value }));
    if (onEstimateTypeFilterChange) {
      onEstimateTypeFilterChange(value);
    }
  };

  // Filter estimates based on search and filters
  const filteredEstimates = estimates.filter(est => {
    const search = searchTerm.toLowerCase();
    const matchSearch = !search || 
      est.estimateId?.toLowerCase().includes(search) ||
      est.customerName?.toLowerCase().includes(search) ||
      est.propertyName?.toLowerCase().includes(search);
    
    // Normalize estimate type for comparison (handle property_based vs property-based)
    const estType = (est.estimateType || '').toLowerCase().replace(/_/g, '-');
    const filterType = (filters.estimateType || '').toLowerCase().replace(/_/g, '-');
    const matchType = filters.estimateType === 'all' || estType === filterType;
    
    // Normalize status for case-insensitive comparison
    const estStatus = (est.status || '').toLowerCase();
    const filterStatus = (filters.status || '').toLowerCase();
    const matchStatus = filters.status === 'all' || estStatus === filterStatus;
    
    // Property category filter should work for ALL estimates that have a property type (both direct and property-based)
    const matchProperty = filters.propertyType === 'all' || 
      (est.propertyType && normalizePropertyType(est.propertyType) === filters.propertyType);
    
    // Date filtering
    const estDate = new Date(est.createdAt);
    const matchFromDate = !filters.dateFrom || estDate >= new Date(filters.dateFrom);
    const matchToDate = !filters.dateTo || estDate <= new Date(filters.dateTo + 'T23:59:59');
    
    return matchSearch && matchType && matchStatus && matchProperty && matchFromDate && matchToDate;
  });

  // Export all estimates to Excel
  const exportAllEstimates = () => {
    if (filteredEstimates.length === 0) {
      showToast('No estimates to export', 'error');
      return;
    }
    const exportData = filteredEstimates.map(e => ({
      'Estimate ID': e.estimateId || e.estimate_id || '-',
      'Type': e.estimateType === 'property_based' || e.estimateType === 'property-based' ? 'Property Based' : 'Direct',
      'Client Name': e.clientName || e.client_name || '-',
      'Property': e.propertyName || e.property_name || '-',
      'Property Type': e.propertyType || e.property_type || '-',
      'AMC Package': e.packageName || e.package_name || '-',
      'Subtotal': e.subtotal || 0,
      'Discount': e.discount || 0,
      'GST': e.gst || 0,
      'Total': e.total || 0,
      'Status': e.status || '-',
      'Created By': e.createdByName || e.created_by_name || '-',
      'Created Date': formatDateIST(e.createdAt || e.created_at)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimates');
    XLSX.writeFile(wb, `All_Estimates_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Estimates exported successfully');
  };

  const handleSendEstimate = async (estimate) => {
    try {
      const response = await fetch(`/api/estimates-sync/${estimate.estimateId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.success) {
        showToast(`Estimate sent to ${result.email}`);
        onRefresh();
      } else {
        showToast(result.message || 'Failed to send estimate', 'error');
      }
    } catch (error) {
      console.error('Send estimate error:', error);
      showToast('Failed to send estimate', 'error');
    }
  };

  const handleArchiveEstimate = async (estimateId) => {
    try {
      const response = await fetch(`/api/estimates-sync/${estimateId}/archive`, { method: 'PUT' });
      const result = await response.json();
      if (result.success) {
        showToast('Estimate archived');
        onRefresh();
      }
    } catch (error) {
      showToast('Failed to archive', 'error');
    }
    setDeleteConfirm(null);
  };

  // Multi-select handlers
  const handleSelectEstimate = (id) => {
    setSelectedEstimates(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedEstimates.length === filteredEstimates.length) {
      setSelectedEstimates([]);
    } else {
      setSelectedEstimates(filteredEstimates.map(e => e.id));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedEstimates.length === 0) {
      showToast('No estimates selected', 'error');
      return;
    }
    
    setArchivingSelected(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/estimates/bulk-archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedEstimates })
      });
      const result = await response.json();
      if (result.success) {
        showToast(`${result.archivedCount || selectedEstimates.length} estimate(s) archived`);
        setSelectedEstimates([]);
        onRefresh();
      } else {
        showToast(result.message || 'Failed to archive estimates', 'error');
      }
    } catch (error) {
      console.error('Bulk archive error:', error);
      showToast('Failed to archive estimates', 'error');
    } finally {
      setArchivingSelected(false);
    }
  };

  const handleDownloadPDF = (e, estimate) => {
    e.stopPropagation();
    e.preventDefault();
    if (exportingId) return;
    setExportingId(estimate.estimateId || estimate.estimate_id);
    showToast('Generating PDF...');
    
    setTimeout(() => {
      try {
        console.log('PDF Export - Full estimate:', estimate);
        
        // Parse addons from multiple possible sources (same as FP portal)
        let addonsArray = [];
        if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
          addonsArray = estimate.addons;
        } else if (estimate.addons_data) {
          try {
            const parsed = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
            if (Array.isArray(parsed)) addonsArray = parsed;
          } catch (e) { console.log('Addon parse error:', e); }
        } else if (estimate.selected_addons) {
          try {
            const parsed = typeof estimate.selected_addons === 'string' ? JSON.parse(estimate.selected_addons) : estimate.selected_addons;
            if (Array.isArray(parsed)) addonsArray = parsed;
          } catch (e) { console.log('Selected addons parse error:', e); }
        }
        
        // Parse package services from multiple sources (same as FP portal)
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
        // Try packageServices
        else if (estimate.packageServices) {
          try {
            const parsed = typeof estimate.packageServices === 'string' ? JSON.parse(estimate.packageServices) : estimate.packageServices;
            if (Array.isArray(parsed)) packageServices = parsed;
          } catch (e) { console.log('Package services parse error:', e); }
        }
        
        console.log('PDF Export - Package Services:', packageServices, 'Addons:', addonsArray);
        
        // Prepare estimate data for PDF (same mapping as FP portal)
        const pdfData = {
          ...estimate,
          estimateId: estimate.estimateId || estimate.estimate_id,
          estimateType: estimate.estimateType || estimate.estimate_type,
          propertyId: estimate.property_code || estimate.propertyId,
          propertyType: estimate.propertyType || estimate.property_type,
          propertyName: estimate.propertyName || estimate.property_name,
          communityName: estimate.communityName || estimate.property_name,
          zone: estimate.zone,
          division: estimate.division || '',
          // APT specific fields
          towerName: estimate.towerName || estimate.tower_name,
          blockNumber: estimate.blockNumber || estimate.block_number,
          // GC specific fields
          numberOfBlocks: estimate.numberOfBlocks || estimate.number_of_blocks,
          totalUnits: estimate.totalUnits || estimate.total_units,
          // Villa/Plot specific
          villaPlotNumber: estimate.villaPlotNumber || estimate.villa_plot_number,
          city: estimate.city,
          customerName: estimate.customerName || estimate.clientName || estimate.client_name,
          customerPhone: estimate.customerPhone || estimate.phone || estimate.client_phone,
          customerEmail: estimate.customerEmail || estimate.email || estimate.client_email,
          address: estimate.address || estimate.propertyAddress,
          packageName: estimate.packageName || estimate.package_name,
          billingDuration: estimate.billingDuration || 'Yearly',
          subtotal: parseFloat(estimate.subtotal) || 0,
          totalPrice: parseFloat(estimate.totalPrice || estimate.total || estimate.total_amount) || 0,
          discountPercent: parseFloat(estimate.discount_percent || estimate.discount) || 0,
          discountAmount: parseFloat(estimate.discount_amount) || 0,
          gstPercent: parseFloat(estimate.gst_percent || estimate.gst) || 0,
          gstAmount: parseFloat(estimate.gst_amount) || 0,
          description: estimate.description || estimate.notes || '',
          // Include package services with descriptions (same as FP portal)
          packageServices: packageServices.map(s => ({
            name: s.service || s.name || s.serviceName || 'Service',
            frequencyCount: s.frequencyCount || s.frequency_count || s.frequency || 1,
            frequencyType: s.frequencyType || s.frequency_type || 'Monthly',
            description: s.description || ''
          })),
          // Include addons with descriptions (same as FP portal)
          addons: addonsArray.map(a => ({
            name: a.name || a.service_name || a.serviceName || 'Add-on',
            frequencyType: a.frequency_type || a.frequencyType || 'One-time',
            frequencyCount: a.frequency_count || a.frequencyCount || 1,
            description: a.description || ''
          }))
        };
        
        console.log('PDF Data:', pdfData);
        const success = exportEstimateToPDF(pdfData);
        if (success) {
          showToast('PDF downloaded successfully!');
        }
      } catch (err) {
        console.error('PDF Error:', err);
      } finally {
        setExportingId(null);
      }
    }, 100);
  };

  const clearFilters = () => {
    setFilters({
      estimateType: 'all',
      status: 'all',
      propertyType: 'all',
      dateFrom: '',
      dateTo: ''
    });
    setDateFromDisplay('');
    setDateToDisplay('');
    setSearchTerm('');
    // Sync with parent
    if (onEstimateTypeFilterChange) {
      onEstimateTypeFilterChange('all');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search estimates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              showFilters ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={exportAllEstimates}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
          {/* Archive Selected button - only visible when items are selected and not ops manager */}
          {!isOpsManager && selectedEstimates.length > 0 && (
            <button
              onClick={handleBulkArchive}
              disabled={archivingSelected}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              {archivingSelected ? 'Archiving...' : `Archive Selected (${selectedEstimates.length})`}
            </button>
          )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimate Type</label>
                <select
                  value={filters.estimateType}
                  onChange={(e) => handleEstimateTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Estimates</option>
                  <option value="property-based">Property ID Based</option>
                  <option value="direct">Direct Estimate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Statuses</option>
                  {ESTIMATE_STATUSES.filter(s => s !== 'Archived').map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Property Category</label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {PROPERTY_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dateFromDisplay}
                    onChange={(e) => {
                      handleDateInput(e.target.value, setDateFromDisplay);
                      const parsed = parseISTDate(e.target.value);
                      if (parsed) setFilters({ ...filters, dateFrom: parsed });
                    }}
                    onBlur={() => {
                      const parsed = parseISTDate(dateFromDisplay);
                      if (parsed) setFilters({ ...filters, dateFrom: parsed });
                      else if (dateFromDisplay && dateFromDisplay.length < 10) setDateFromDisplay('');
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilters({ ...filters, dateFrom: e.target.value }); setDateFromDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dateToDisplay}
                    onChange={(e) => {
                      handleDateInput(e.target.value, setDateToDisplay);
                      const parsed = parseISTDate(e.target.value);
                      if (parsed) setFilters({ ...filters, dateTo: parsed });
                    }}
                    onBlur={() => {
                      const parsed = parseISTDate(dateToDisplay);
                      if (parsed) setFilters({ ...filters, dateTo: parsed });
                      else if (dateToDisplay && dateToDisplay.length < 10) setDateToDisplay('');
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setFilters({ ...filters, dateTo: e.target.value }); setDateToDisplay(formatDateIST(e.target.value)); }}} />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Estimates List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredEstimates.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No estimates found</p>
            <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {/* Checkbox column - hidden for ops manager */}
                {!isOpsManager && (
                  <th className="px-3 py-3 text-center w-10">
                    <button
                      onClick={handleSelectAll}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={selectedEstimates.length === filteredEstimates.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedEstimates.length === filteredEstimates.length && filteredEstimates.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Estimate ID</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden sm:table-cell">Type</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden md:table-cell">Division</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Client</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden md:table-cell">Date</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Total</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap hidden lg:table-cell">Status</th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEstimates.map((estimate) => {
                const Icon = PROPERTY_ICONS[estimate.propertyType] || (estimate.estimateType === 'direct' ? User : Building2);
                const isSelected = selectedEstimates.includes(estimate.id);
                return (
                  <tr key={estimate.estimateId} className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                    {/* Checkbox cell - hidden for ops manager */}
                    {!isOpsManager && (
                      <td className="px-3 py-3 sm:py-4 text-center">
                        <button
                          onClick={() => handleSelectEstimate(estimate.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="font-medium text-gray-800 text-xs sm:text-sm">{estimate.estimateId}</span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className={`text-sm whitespace-nowrap px-2 py-0.5 rounded ${
                          estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId 
                            ? 'Property' 
                            : 'Direct'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-600">
                        {(estimate.estimateType === 'property-based' || estimate.estimateType === 'property_based' || estimate.propertyId) 
                          ? (estimate.division || estimate.property_division || '-') 
                          : '-'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <p className="text-xs sm:text-sm text-gray-800 truncate max-w-[100px] sm:max-w-none">
                        {estimate.clientName || estimate.customerName}
                      </p>
                      {estimate.propertyId && (
                        <p className="text-xs text-gray-500 truncate">{estimate.propertyId}</p>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                        <Calendar className="w-4 h-4" />
                        {formatDateIST(estimate.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="font-semibold text-gray-800 text-xs sm:text-sm whitespace-nowrap">
                        â‚¹{(estimate.totalPrice || calculateEstimateTotal(estimate)).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[estimate.status] || 'bg-gray-100 text-gray-700'}`}>
                        {estimate.status?.charAt(0).toUpperCase() + estimate.status?.slice(1) || 'Draft'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewEstimate(estimate)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isOpsManager && (
                          <button onClick={() => openEditEstimate(estimate)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        )}
                        {/* All other actions hidden for Operations Manager */}
                        {!isOpsManager && (
                          <>
                            {/* Download PDF */}
                            <button
                              onClick={(e) => handleDownloadPDF(e, estimate)}
                              disabled={exportingId === estimate.estimateId}
                              className={`p-2 rounded-lg ${exportingId === estimate.estimateId ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {/* Archive */}
                            <button
                              onClick={() => setDeleteConfirm(estimate)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Archive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
                <div><p className="text-xs text-gray-500">Estimate ID</p><p className="font-medium text-sm">{viewEstimate.estimateId || viewEstimate.estimate_id}</p></div>
                <div><p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[viewEstimate.status] || 'bg-gray-100 text-gray-700'}`}>{viewEstimate.status?.charAt(0).toUpperCase() + viewEstimate.status?.slice(1) || 'Draft'}</span>
                </div>
                <div><p className="text-xs text-gray-500">Type</p><p className="font-medium text-sm capitalize">{(viewEstimate.estimateType || viewEstimate.estimate_type)?.replace('_', ' ') || '-'}</p></div>
                <div><p className="text-xs text-gray-500">Created</p><p className="font-medium text-sm">{formatDateIST(viewEstimate.createdAt || viewEstimate.created_at)}</p></div>
              </div>

              {/* Property Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Property Details</p>
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Property ID</p><p className="font-medium text-sm">{viewEstimate.propertyId || viewEstimate.property_code || viewEstimate.property_id || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Name</p><p className="font-medium text-sm">{viewEstimate.propertyName || viewEstimate.property_name || viewEstimate.communityName || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Property Type</p><p className="font-medium text-sm">{viewEstimate.propertyType || viewEstimate.property_type || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Zone</p><p className="font-medium text-sm">{viewEstimate.zone || '-'}</p></div>
                  {((viewEstimate.estimateType || viewEstimate.estimate_type) === 'property_based' || viewEstimate.propertyId || viewEstimate.property_id) && viewEstimate.division && (
                    <div><p className="text-xs text-gray-500">Division</p><p className="font-medium text-sm">{viewEstimate.division}</p></div>
                  )}
                  <div><p className="text-xs text-gray-500">City</p><p className="font-medium text-sm">{viewEstimate.city || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="font-medium text-sm">{viewEstimate.propertyAddress || viewEstimate.address || '-'}</p></div>
                  {/* GC-specific: Number of Blocks, Block Names, Units per Block */}
                  {['GC', 'gated_community', 'Gated Community'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (
                    <>
                      <div><p className="text-xs text-gray-500">Number of Blocks</p><p className="font-medium text-sm">{viewEstimate.numberOfBlocks || viewEstimate.number_of_blocks || '-'}</p></div>
                      <div><p className="text-xs text-gray-500">Total Units</p><p className="font-medium text-sm">{viewEstimate.totalUnits || viewEstimate.total_units || '-'}</p></div>
                      {(() => {
                        const bn = viewEstimate.blockNames || viewEstimate.block_names;
                        const upb = viewEstimate.unitsPerBlock || viewEstimate.units_per_block;
                        const but = viewEstimate.blockUnitTypes || viewEstimate.block_unit_types;
                        const blockNames = bn ? (typeof bn === 'string' ? JSON.parse(bn) : bn) : {};
                        const unitsPerBlock = upb ? (typeof upb === 'string' ? JSON.parse(upb) : upb) : {};
                        const blockUnitTypes = but ? (typeof but === 'string' ? JSON.parse(but) : but) : {};
                        const hasBlockData = Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0;
                        if (!hasBlockData) return null;
                        
                        // Get all block keys (from blockNames or unitsPerBlock)
                        const blockKeys = Object.keys(blockNames).length > 0 ? Object.keys(blockNames) : Object.keys(unitsPerBlock);
                        
                        return (
                          <div className="col-span-2 mt-2">
                            <p className="text-xs text-gray-500 mb-2">Block Details</p>
                            <div className="space-y-3">
                              {blockKeys.map((key) => {
                                const blockName = blockNames[key] || `Block ${key}`;
                                const units = unitsPerBlock[key] || 0;
                                const unitTypes = blockUnitTypes[key] || {};
                                const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                                
                                return (
                                  <div key={key} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                      <p className="text-sm text-blue-600 font-semibold">{blockName}</p>
                                      <p className="text-sm text-gray-700 font-medium">{units} units</p>
                                    </div>
                                    {hasUnitTypes && (
                                      <div className="flex flex-wrap gap-2">
                                        {Object.entries(unitTypes).filter(([_, count]) => count > 0).map(([type, count]) => {
                                          const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK', fiveBed: '5 BHK' };
                                          return (
                                            <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                              {unitTypeLabels[type] || type}: {count}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {/* Apartment-specific fields */}
                  {['APT', 'Apt', 'apartment', 'Apartment'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (
                    <>
                      {(viewEstimate.towerName || viewEstimate.tower_name) && <div><p className="text-xs text-gray-500">Tower/Building Name</p><p className="font-medium text-sm">{viewEstimate.towerName || viewEstimate.tower_name}</p></div>}
                      {(viewEstimate.blockNumber || viewEstimate.block_number) && <div><p className="text-xs text-gray-500">Block Number</p><p className="font-medium text-sm">{viewEstimate.blockNumber || viewEstimate.block_number}</p></div>}
                      <div><p className="text-xs text-gray-500">Number of Units</p><p className="font-medium text-sm">{viewEstimate.totalUnits || viewEstimate.total_units || '-'}</p></div>
                    </>
                  )}
                  {/* Villa/Plot-specific fields */}
                  {['VILLA', 'Villa', 'villa', 'PLOT', 'Plot', 'plot'].includes(viewEstimate.propertyType || viewEstimate.property_type) && (viewEstimate.villaPlotNumber || viewEstimate.villa_plot_number) && (
                    <div><p className="text-xs text-gray-500">Villa/Plot Number</p><p className="font-medium text-sm">{viewEstimate.villaPlotNumber || viewEstimate.villa_plot_number}</p></div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p>
                <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Contact Name</p><p className="font-medium text-sm">{viewEstimate.customerName || viewEstimate.clientName || viewEstimate.client_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Phone</p><p className="font-medium text-sm">{viewEstimate.customerPhone || viewEstimate.phone || viewEstimate.client_phone || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium text-sm">{viewEstimate.customerEmail || viewEstimate.email || viewEstimate.client_email || '-'}</p></div>
                </div>
              </div>

              {/* AMC Package */}
              {(viewEstimate.amcPackage || viewEstimate.packageName || viewEstimate.package_name) && (() => {
                // Get package description from various sources
                const pkgDescription = viewEstimate.amc_package_description || viewEstimate.amcPackageDescription || viewEstimate.amcPackage?.description || '';
                // Get services from various sources
                let pkgServices = [];
                if (viewEstimate.package_services) {
                  pkgServices = typeof viewEstimate.package_services === 'string' ? JSON.parse(viewEstimate.package_services) : viewEstimate.package_services;
                } else if (viewEstimate.packageServices) {
                  const svc = typeof viewEstimate.packageServices === 'string' ? JSON.parse(viewEstimate.packageServices) : viewEstimate.packageServices;
                  pkgServices = svc?.serviceRows || svc?.services || svc || [];
                } else if (viewEstimate.amcPackage?.serviceRows) {
                  pkgServices = viewEstimate.amcPackage.serviceRows;
                }
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">AMC Package</p>
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-indigo-600">{viewEstimate.amcPackage?.billingDuration || viewEstimate.billingDuration || 'Yearly'} Billing</p>
                        </div>
                        <p className="text-lg font-bold text-indigo-700">â‚¹{Number(viewEstimate.amcPackage?.rate || viewEstimate.amcPackage?.totalRate || viewEstimate.amcPrice || viewEstimate.packagePrice || viewEstimate.package_price || viewEstimate.subtotal || 0).toLocaleString()}</p>
                      </div>
                      {pkgDescription && (
                        <p className="text-sm text-indigo-700 mt-2 pt-2 border-t border-indigo-100">{pkgDescription}</p>
                      )}
                    </div>
                    {/* Package Services - Horizontal Table */}
                    {pkgServices.length > 0 && (
                      <div className="mt-3">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-indigo-100 rounded-t-lg">
                          <div className="col-span-1 text-xs font-semibold text-indigo-700">#</div>
                          <div className="col-span-3 text-xs font-semibold text-indigo-700">Service</div>
                          <div className="col-span-5 text-xs font-semibold text-indigo-700">Description</div>
                          <div className="col-span-2 text-xs font-semibold text-indigo-700 text-center">Frequency</div>
                          <div className="col-span-1 text-xs font-semibold text-indigo-700 text-right">Visits</div>
                        </div>
                        <div className="border border-indigo-100 rounded-b-lg divide-y divide-indigo-50">
                          {pkgServices.map((svc, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                              <div className="col-span-1">
                                <span className="w-5 h-5 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                              </div>
                              <div className="col-span-3">
                                <p className="font-medium text-gray-800 text-sm">{svc.name || svc.service}</p>
                              </div>
                              <div className="col-span-5">
                                <p className={`text-xs text-gray-500 break-words whitespace-normal ${!svc.description ? 'text-center' : ''}`}>{svc.description || '-'}</p>
                              </div>
                              <div className="col-span-2 text-center">
                                <p className="text-sm text-indigo-600">{svc.frequencyType || svc.frequency_type || 'Monthly'}</p>
                              </div>
                              <div className="col-span-1 text-right">
                                <p className="text-sm text-indigo-700 font-semibold">{svc.frequencyCount || svc.frequency_count || 1}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Services */}
              {viewEstimate.services?.length > 0 && !viewEstimate.amcPackage && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Services</p>
                  <div className="space-y-2">
                    {viewEstimate.services.map((service, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <div>
                          <p className="font-medium">{service.name || service.service || service.serviceName || 'Service'}</p>
                          {(service.frequency || service.frequencyCount) && service.frequencyType && (
                            <p className="text-xs text-gray-500">{service.frequencyType} - {service.frequency || service.frequencyCount} visits</p>
                          )}
                        </div>
                        <p className="font-semibold">â‚¹{Number(service.price || service.rate || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons - Horizontal Table */}
              {viewEstimate.addons?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Add-on Services</p>
                  <div>
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-green-100 rounded-t-lg">
                      <div className="col-span-1 text-xs font-semibold text-green-700">#</div>
                      <div className="col-span-3 text-xs font-semibold text-green-700">Service</div>
                      <div className="col-span-5 text-xs font-semibold text-green-700">Description</div>
                      <div className="col-span-2 text-xs font-semibold text-green-700 text-center">Frequency</div>
                      <div className="col-span-1 text-xs font-semibold text-green-700 text-right">Visits</div>
                    </div>
                    <div className="border border-green-100 divide-y divide-green-50">
                      {viewEstimate.addons.map((addon, idx) => {
                        const addonName = typeof addon === 'number' ? `Add-on ${idx + 1}` : (addon.name || addon.serviceName || addon.service_name || `Add-on ${idx + 1}`);
                        const frequencyCount = typeof addon === 'object' ? (addon.frequency_count || addon.frequencyCount || 1) : 1;
                        const frequencyType = typeof addon === 'object' ? (addon.frequencyType || addon.frequency_type || 'Monthly') : 'Monthly';
                        const addonDesc = typeof addon === 'object' ? (addon.description || '') : '';
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
                            <div className="col-span-1">
                              <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                            </div>
                            <div className="col-span-3">
                              <p className="font-medium text-gray-800 text-sm">{addonName}</p>
                            </div>
                            <div className="col-span-5">
                              <p className={`text-xs text-gray-500 break-words whitespace-normal ${!addonDesc ? 'text-center' : ''}`}>{addonDesc || '-'}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <p className="text-sm text-green-600">{frequencyType}</p>
                            </div>
                            <div className="col-span-1 text-right">
                              <p className="text-sm text-green-700 font-semibold">{frequencyCount}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center bg-green-100 p-3 rounded-b-lg">
                      <p className="font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">â‚¹{viewEstimate.addons.reduce((sum, a) => sum + Number(typeof a === 'number' ? a : (a.price || 0)), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Summary */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Price Summary</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>â‚¹{Number(viewEstimate.subtotal || viewEstimate.package_price || 0).toLocaleString()}</span></div>
                  {(viewEstimate.discount > 0 || viewEstimate.discount_amount > 0) && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-â‚¹{Number(viewEstimate.discount || viewEstimate.discount_amount || 0).toLocaleString()}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({viewEstimate.gst_percent || 0}%)</span><span>â‚¹{Number(viewEstimate.tax || viewEstimate.gst || viewEstimate.gst_amount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <p className="text-lg font-semibold">Total</p>
                    <p className="text-2xl font-bold text-indigo-600">â‚¹{Number(viewEstimate.total || viewEstimate.totalPrice || viewEstimate.total_amount || calculateEstimateTotal(viewEstimate) || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Description / Notes - After Price Summary */}
              {(viewEstimate.notes || viewEstimate.description) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Description / Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{viewEstimate.notes || viewEstimate.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md m-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Archive Estimate?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to archive estimate <strong>{deleteConfirm.estimateId || deleteConfirm.estimate_id}</strong>? 
              You can restore it later from the Archived tab.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchiveEstimate(deleteConfirm.estimateId || deleteConfirm.estimate_id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Estimate Modal */}
      {editEstimate && editEstimateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div><h3 className="text-lg font-semibold">Edit Estimate</h3><p className="text-sm text-gray-500">{editEstimate.estimateId || editEstimate.estimate_id}</p></div>
              <button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div><p className="text-sm font-semibold mb-3">Customer Details</p><div className="grid grid-cols-3 gap-4"><div><label className="block text-xs mb-1">Name *</label><input type="text" value={editEstimateForm.client_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_name: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div><div><label className="block text-xs mb-1">Phone</label><input type="text" value={editEstimateForm.client_phone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_phone: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div><div><label className="block text-xs mb-1">Email</label><input type="email" value={editEstimateForm.client_email} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, client_email: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div></div></div>
              <div><p className="text-sm font-semibold mb-3">Property</p><div className="grid grid-cols-2 gap-4">{(editEstimate.property_code || editEstimate.propertyId) && <div><label className="block text-xs mb-1">Property ID</label><input type="text" value={editEstimate.property_code || editEstimate.propertyId || ""} readOnly disabled className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" /></div>}<div><label className="block text-xs mb-1">Name</label><input type="text" value={editEstimateForm.property_name} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, property_name: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div><div><label className="block text-xs mb-1">Zone</label><input type="text" value={editEstimateForm.zone} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, zone: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div><div><label className="block text-xs mb-1">City</label><input type="text" value={editEstimateForm.city} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, city: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div><div><label className="block text-xs mb-1">Address</label><input type="text" value={editEstimateForm.address} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, address: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div></div></div>
              <div><p className="text-sm font-semibold mb-3">AMC Package</p><select value={editEstimateForm.package_id || ''} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, package_id: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg"><option value="">Select</option>{amcPackages.filter(p => normalizePropertyType(p.property_type) === normalizePropertyType(editEstimate.propertyType || editEstimate.property_type)).map(pkg => (<option key={pkg.id} value={pkg.id}>{pkg.name} - {formatCurrency(pkg.price)}</option>))}</select></div>
              <div><p className="text-sm font-semibold mb-3">Add-ons</p><div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">{addons.filter(a => normalizePropertyType(a.property_type) === normalizePropertyType(editEstimate.propertyType || editEstimate.property_type)).map(addon => { const existing = (editEstimateForm.selectedAddons || []).find(item => item.id === addon.id); const qty = existing?.quantity || 0; return (<div key={addon.id} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded"><span className="text-sm text-gray-700 flex-1">{addon.service_name}</span><div className="flex items-center gap-2"><button type="button" onClick={() => { const current = editEstimateForm.selectedAddons || []; if (qty <= 1) { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.filter(item => item.id !== addon.id) }); } else { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.map(item => item.id === addon.id ? { ...item, quantity: item.quantity - 1 } : item) }); } }} className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50" disabled={qty === 0}>-</button><span className="w-6 text-center text-sm font-medium">{qty}</span><button type="button" onClick={() => { const current = editEstimateForm.selectedAddons || []; if (qty === 0) { setEditEstimateForm({ ...editEstimateForm, selectedAddons: [...current, { id: addon.id, quantity: 1 }] }); } else { setEditEstimateForm({ ...editEstimateForm, selectedAddons: current.map(item => item.id === addon.id ? { ...item, quantity: item.quantity + 1 } : item) }); } }} className="w-7 h-7 flex items-center justify-center rounded-full border border-amber-500 text-amber-600 hover:bg-amber-50">+</button></div></div>); })}</div></div>
              <div><p className="text-sm font-semibold mb-3">Pricing</p><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs mb-1">Discount %</label><input type="number" min="0" max="100" value={editEstimateForm.discount_percent} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, discount_percent: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div><div><label className="block text-xs mb-1">GST %</label><input type="number" min="0" max="100" value={editEstimateForm.gst_percent} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, gst_percent: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg" /></div></div><div className="mt-4 bg-gray-50 p-4 rounded-lg space-y-2"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(calculateEditPricing().subtotal)}</span></div><div className="flex justify-between text-sm"><span>Discount</span><span className="text-red-500">-{formatCurrency(calculateEditPricing().discountAmt)}</span></div><div className="flex justify-between text-sm"><span>GST</span><span>{formatCurrency(calculateEditPricing().gstAmt)}</span></div><div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span className="text-amber-600">{formatCurrency(calculateEditPricing().total)}</span></div></div></div>
              <div><label className="block text-xs mb-1">Notes</label><textarea value={editEstimateForm.description} onChange={(e) => setEditEstimateForm({ ...editEstimateForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border rounded-lg" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={() => { setEditEstimate(null); setEditEstimateForm(null); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={handleUpdateEstimate} disabled={savingEstimate} className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg flex items-center gap-2">{savingEstimate ? 'Saving...' : 'Save'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstimatesList;
