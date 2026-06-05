import { useState, useEffect } from 'react';
import { 
  Search, Trash2, X, Truck, Eye, ChevronDown, Bell, 
  ArrowLeft, Download, RefreshCw, Wrench, Zap, Wind, 
  Sparkles, Shield, TreePine, Bug, Paintbrush, Hammer,
  Settings, Flame, ArrowUpDown, Droplets, Trash, Waves,
  FileCheck, Edit3, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Service Type Tabs (like Client Submissions tabs)
const TABS = [
  { id: 'all', label: 'All Vendors', icon: Truck },
  { id: 'Plumbing', label: 'Plumbing', icon: Wrench },
  { id: 'Electrical', label: 'Electrical', icon: Zap },
  { id: 'HVAC', label: 'HVAC', icon: Wind },
  { id: 'Cleaning', label: 'Cleaning', icon: Sparkles },
  { id: 'Security', label: 'Security', icon: Shield },
];

const VendorDetails = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewVendor, setViewVendor] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState(null);

  // Get selected FP from context
  const { selectedFp, fpList, selectFp } = useFP();
  const token = sessionStorage.getItem('pm_auth_token');
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
  };

  // Load vendors from API
  const loadData = async () => {
    if (!selectedFp) {
      setVendors([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setFetchError(null);
    try {
      let url;
      // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
      if (selectedFp.id === 'all') {
        url = `${API_BASE}/api/admin/all-vendors`;
      } else {
        url = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/vendors`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVendors(result.data || []);
      } else {
        setVendors([]);
      }
      setNotifications([]);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setFetchError('Failed to load vendors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFp) {
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedFp, statusFilter]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        await loadData();
        showToast('Vendor deleted successfully');
      } else {
        showToast(result.message || 'Failed to delete vendor', 'error');
      }
    } catch (error) {
      console.error('Error deleting vendor:', error);
      showToast('Failed to delete vendor', 'error');
    }
    setDeleteConfirm(null);
  };

  const handleMarkAllRead = () => {
    setNotifications([]);
  };

  const handleOpenEdit = (vendor) => {
    setEditVendor(vendor);
    setEditForm({
      serviceType: vendor.serviceType || vendor.service_type || '',
      serviceVerified: vendor.serviceVerified || vendor.service_verified || false,
      zone: vendor.zone || vendor.zone_name || '',
      areaName: vendor.areaName || vendor.area_name || vendor.area || '',
      division: vendor.division || '',
      ownerName: vendor.ownerName || vendor.owner_name || vendor.company_name || '',
      ownerMobile: vendor.ownerMobile || vendor.owner_mobile || vendor.phone || '',
      ownerEmail: vendor.ownerEmail || vendor.owner_email || vendor.email || '',
      ownerAadhar: vendor.ownerAadhar || vendor.owner_aadhar || '',
      ownerCountryCode: vendor.ownerCountryCode || vendor.owner_country_code || '+91',
      managerName: vendor.managerName || vendor.manager_name || '',
      managerMobile: vendor.managerMobile || vendor.manager_mobile || '',
      managerEmail: vendor.managerEmail || vendor.manager_email || '',
      managerCountryCode: vendor.managerCountryCode || vendor.manager_country_code || '+91',
      pocName: vendor.pocName || vendor.poc_name || '',
      pocMobile: vendor.pocMobile || vendor.poc_mobile || '',
      pocEmail: vendor.pocEmail || vendor.poc_email || '',
      pocCountryCode: vendor.pocCountryCode || vendor.poc_country_code || '+91',
      ratePerVisit: vendor.ratePerVisit || vendor.rate_per_visit || 0,
      coveragePerDay: vendor.coveragePerDay || vendor.coverage_per_day || 0,
      // Business Documents
      gstNumber: vendor.gstNumber || vendor.gst_number || '',
      panNumber: vendor.panNumber || vendor.pan_number || '',
      licenseNumber: vendor.licenseNumber || vendor.license_number || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editVendor) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/vendors/${editVendor.id || editVendor.vendorId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      const result = await response.json();
      if (result.success) {
        showToast('Vendor updated successfully');
        setEditVendor(null);
        await loadData();
      } else {
        showToast(result.message || 'Failed to update vendor', 'error');
      }
    } catch (error) {
      console.error('Error updating vendor:', error);
      showToast('Failed to update vendor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleExportVendor = (vendor) => {
    const exportData = [{
      'Vendor ID': vendor.vendorId || vendor.vendor_id,
      'Service Type': vendor.serviceType || vendor.service_type,
      'Verified': (vendor.serviceVerified || vendor.service_verified) ? 'Yes' : 'No',
      'Zone': vendor.zone || vendor.zone_name || '-',
      'Area': vendor.areaName || vendor.area_name || vendor.area || '-',
      'Division': vendor.division || '-',
      'Owner Name': vendor.ownerName || vendor.owner_name || vendor.company_name,
      'Owner Mobile': `${vendor.ownerCountryCode || vendor.owner_country_code || '+91'} ${vendor.ownerMobile || vendor.owner_mobile || vendor.phone || '-'}`,
      'Owner Email': vendor.ownerEmail || vendor.owner_email || vendor.email || '-',
      'Owner Aadhar': vendor.ownerAadhar || vendor.owner_aadhar || '-',
      'Manager Name': vendor.managerName || vendor.manager_name || '-',
      'Manager Mobile': (vendor.managerMobile || vendor.manager_mobile) ? `${vendor.managerCountryCode || vendor.manager_country_code || '+91'} ${vendor.managerMobile || vendor.manager_mobile}` : '-',
      'Manager Email': vendor.managerEmail || vendor.manager_email || '-',
      'POC Name': vendor.pocName || vendor.poc_name || '-',
      'POC Mobile': (vendor.pocMobile || vendor.poc_mobile) ? `${vendor.pocCountryCode || vendor.poc_country_code || '+91'} ${vendor.pocMobile || vendor.poc_mobile}` : '-',
      'POC Email': vendor.pocEmail || vendor.poc_email || '-',
      'Rate Per Visit': `₹${vendor.ratePerVisit || vendor.rate_per_visit || 0}`,
      'Coverage Per Day': vendor.coveragePerDay || vendor.coverage_per_day || 0,
      'Created By': vendor.created_by_name || vendor.createdBy || 'System',
      'Status': vendor.status || 'active',
      'Created': new Date(vendor.createdAt || vendor.created_at).toLocaleDateString()
    }];
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor');
    XLSX.writeFile(wb, `Vendor_${vendor.vendorId || vendor.vendor_id}.xlsx`);
    showToast('Vendor exported successfully');
  };

  const handleExportAll = () => {
    const exportData = filteredVendors.map(v => ({
      'Vendor ID': v.vendorId || v.vendor_id,
      'Service Type': v.serviceType || v.service_type,
      'Zone': v.zone || v.zone_name || '-',
      'Area': v.areaName || v.area_name || v.area || '-',
      'Division': v.division || '-',
      'Owner Name': v.ownerName || v.owner_name || v.company_name,
      'Owner Mobile': `${v.ownerCountryCode || v.owner_country_code || '+91'} ${v.ownerMobile || v.owner_mobile || v.phone || '-'}`,
      'Rate Per Visit': `₹${v.ratePerVisit || v.rate_per_visit || 0}`,
      'Coverage Per Day': v.coveragePerDay || v.coverage_per_day || 0,
      'Created By': v.created_by_name || v.createdBy || 'System',
      'Status': v.status || 'active',
      'Created': new Date(v.createdAt || v.created_at).toLocaleDateString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Vendors');
    XLSX.writeFile(wb, `All_Vendors_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('All vendors exported successfully');
  };

  // Derived data
  const divisions = [...new Set(vendors.map(v => v.division).filter(Boolean))];
  const zones = [...new Set(vendors.map(v => v.zone || v.zone_name).filter(Boolean))];
  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredVendors = vendors.filter(v => {
    const serviceType = v.serviceType || v.service_type;
    if (activeTab !== 'all' && serviceType !== activeTab) return false;
    if (divisionFilter && v.division !== divisionFilter) return false;
    const zone = v.zone || v.zone_name;
    if (zoneFilter && zone !== zoneFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const ownerName = v.ownerName || v.owner_name || v.company_name || '';
      const vendorId = v.vendorId || v.vendor_id || '';
      const areaName = v.areaName || v.area_name || v.area || '';
      return (
        ownerName.toLowerCase().includes(q) ||
        vendorId.toLowerCase().includes(q) ||
        (serviceType || '').toLowerCase().includes(q) ||
        (zone || '').toLowerCase().includes(q) ||
        areaName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats per service type
  const statsByType = TABS.filter(t => t.id !== 'all').map(tab => ({
    ...tab,
    count: vendors.filter(v => (v.serviceType || v.service_type) === tab.id).length,
  }));

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const timeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Show FP selection if no FP selected
  if (!selectedFp) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Details</h1>
          <p className="text-gray-500 mt-1">Select a Franchise Partner to view vendors</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select Franchise Partner</h2>
          <p className="text-gray-500 mb-6">Choose an FP from the list to view vendors</p>
          <div className="flex flex-wrap justify-center gap-3">
            {fpList.map(fp => (
              <button
                key={fp.id}
                onClick={() => handleFpSelect(fp)}
                className="px-6 py-3 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors"
              >
                {fp.fpId} - {fp.companyName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header with FP Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Details</h1>
          <p className="text-gray-500 text-sm mt-1">{vendors.length} total vendors</p>
        </div>
        <div className="flex items-center gap-3">
          {/* FP Switcher */}
          <div className="relative">
            <button
              onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
              <span className="font-medium text-gray-700">
                {selectedFp.id === 'all' ? 'Admin (All FPs)' : selectedFp.fpId}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {fpDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                <button
                  onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' })}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-gray-100 ${
                    selectedFp.id === 'all' ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className="font-medium flex items-center gap-2 text-slate-700">
                    <Shield className="w-4 h-4" />
                    Admin (All FPs)
                  </div>
                </button>
                {fpList.map(fp => (
                  <button
                    key={fp.id}
                    onClick={() => handleFpSelect(fp)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                      selectedFp.id === fp.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{fp.fpId}</span>
                      <span className="text-xs text-gray-500">{fp.ownerName}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={loadData}
            className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                    ) : (
                      notifications.slice(0, 15).map(n => (
                        <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${!n.read ? 'bg-amber-50/40' : ''}`}>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-amber-500' : 'bg-transparent'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-gray-200 px-4 flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'all' ? vendors.length : vendors.filter(v => (v.serviceType || v.service_type) === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, service, or zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
              >
                <option value="">All Divisions</option>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
              >
                <option value="">All Zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`appearance-none pl-3 pr-8 py-2 border rounded-md text-sm focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none ${
                  statusFilter === 'deleted' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                }`}
              >
                <option value="active" className="bg-white text-gray-900">Active Vendors</option>
                <option value="deleted" className="bg-white text-gray-900">Deleted Vendors</option>
                <option value="all" className="bg-white text-gray-900">All Vendors</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            {(divisionFilter || zoneFilter || searchTerm || statusFilter !== 'active') && (
              <button
                onClick={() => { setDivisionFilter(''); setZoneFilter(''); setSearchTerm(''); setStatusFilter('active'); }}
                className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {fetchError && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm mb-3">
              <span>⚠️ {fetchError}</span>
            </div>
            <div>
              <button onClick={loadData} className="text-sm text-amber-600 hover:text-amber-700 font-medium underline">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Vendor Table */}
        {!fetchError && filteredVendors.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vendors found</p>
            <p className="text-gray-400 text-sm mt-1">
              {vendors.length === 0 
                ? 'Add vendors using the Add Vendor page.' 
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Vendor ID</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Service</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Owner</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden lg:table-cell">Zone</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden xl:table-cell">Area</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden md:table-cell">Rate</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden lg:table-cell">Coverage</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden xl:table-cell">Created By</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden sm:table-cell">Created</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {vendor.vendorId || vendor.vendor_id}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        {vendor.serviceType || vendor.service_type || '-'}
                        {(vendor.serviceVerified === true || vendor.serviceVerified === 1 || vendor.service_verified === true || vendor.service_verified === 1) && <FileCheck className="w-3 h-3 text-emerald-500" />}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap text-sm truncate max-w-[100px]">
                      {vendor.ownerName || vendor.owner_name || vendor.company_name || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden lg:table-cell">
                      {vendor.zone || vendor.zone_name || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden xl:table-cell">
                      {vendor.areaName || vendor.area_name || vendor.area || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden md:table-cell">
                      ₹{vendor.ratePerVisit || vendor.rate_per_visit || 0}
                    </td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-center hidden lg:table-cell">
                      {vendor.coveragePerDay || vendor.coverage_per_day || 0}
                    </td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden xl:table-cell">
                      {vendor.created_by_name || vendor.createdBy || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden sm:table-cell">
                      {formatDate(vendor.createdAt || vendor.created_at)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        (vendor.status === 'deleted' || vendor.is_active === 0 || vendor.is_active === false)
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {(vendor.status === 'deleted' || vendor.is_active === 0 || vendor.is_active === false) ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewVendor(vendor)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(vendor)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Modify vendor"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportVendor(vendor)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Export to Excel"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {(vendor.status === 'deleted' || vendor.is_active === 0 || vendor.is_active === false) ? (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/vendors/${vendor.id || vendor.vendorId}/restore`, {
                                  method: 'PUT',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                const result = await response.json();
                                if (result.success) {
                                  showToast('Vendor restored successfully');
                                  loadData();
                                } else {
                                  showToast(result.message || 'Failed to restore vendor', 'error');
                                }
                              } catch (error) {
                                showToast('Failed to restore vendor', 'error');
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Restore Vendor"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(vendor)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </div>
          </div>
        )}
      </div>

      {/* Export All Button */}
      {filteredVendors.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export All Vendors
          </button>
        </div>
      )}

      {/* View Vendor Modal */}
      {viewVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewVendor(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gray-50 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{viewVendor.ownerName || viewVendor.owner_name || viewVendor.company_name}</h2>
                <p className="text-sm text-gray-500 font-mono">{viewVendor.vendorId || viewVendor.vendor_id}</p>
              </div>
              <button onClick={() => setViewVendor(null)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Service Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Service Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-xs text-gray-400">Service Type</span><p className="text-sm font-medium text-gray-900">{viewVendor.serviceType || viewVendor.service_type || '-'}</p></div>
                  <div><span className="text-xs text-gray-400">Verified</span><p className="text-sm font-medium text-gray-900">{(viewVendor.serviceVerified || viewVendor.service_verified) ? 'Yes' : 'No'}</p></div>
                </div>
              </div>
              {/* Location */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-xs text-gray-400">Zone</span><p className="text-sm font-medium text-gray-900">{viewVendor.zone || viewVendor.zone_name || '-'}</p></div>
                  <div><span className="text-xs text-gray-400">Area</span><p className="text-sm font-medium text-gray-900">{viewVendor.areaName || viewVendor.area_name || viewVendor.area || '-'}</p></div>
                  <div><span className="text-xs text-gray-400">Division</span><p className="text-sm font-medium text-gray-900">{viewVendor.division || '-'}</p></div>
                </div>
              </div>
              {/* Owner */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Owner Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-xs text-gray-400">Name</span><p className="text-sm font-medium text-gray-900">{viewVendor.ownerName || viewVendor.owner_name || viewVendor.company_name || '-'}</p></div>
                  <div><span className="text-xs text-gray-400">Mobile</span><p className="text-sm font-medium text-gray-900">{viewVendor.ownerCountryCode || viewVendor.owner_country_code || '+91'} {viewVendor.ownerMobile || viewVendor.owner_mobile || viewVendor.phone || '-'}</p></div>
                  <div><span className="text-xs text-gray-400">Email</span><p className="text-sm font-medium text-gray-900">{viewVendor.ownerEmail || viewVendor.owner_email || viewVendor.email || '-'}</p></div>
                  <div><span className="text-xs text-gray-400">Aadhar</span><p className="text-sm font-medium text-gray-900">{viewVendor.ownerAadhar || viewVendor.owner_aadhar || '-'}</p></div>
                </div>
              </div>
              {/* Rate & Coverage */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Rate & Coverage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-xs text-gray-400">Rate Per Visit</span><p className="text-sm font-medium text-gray-900">₹{viewVendor.ratePerVisit || viewVendor.rate_per_visit || 0}</p></div>
                  <div><span className="text-xs text-gray-400">Coverage Per Day</span><p className="text-sm font-medium text-gray-900">{viewVendor.coveragePerDay || viewVendor.coverage_per_day || 0}</p></div>
                </div>
              </div>
              {/* Manager Details */}
              {(viewVendor.managerName || viewVendor.manager_name) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Manager / Primary Contact</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-xs text-gray-400">Name</span><p className="text-sm font-medium text-gray-900">{viewVendor.managerName || viewVendor.manager_name || '-'}</p></div>
                    <div><span className="text-xs text-gray-400">Mobile</span><p className="text-sm font-medium text-gray-900">{viewVendor.managerMobile || viewVendor.manager_mobile || '-'}</p></div>
                    <div><span className="text-xs text-gray-400">Email</span><p className="text-sm font-medium text-gray-900">{viewVendor.managerEmail || viewVendor.manager_email || '-'}</p></div>
                  </div>
                </div>
              )}
              {/* POC Details */}
              {(viewVendor.pocName || viewVendor.poc_name) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Point of Contact</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-xs text-gray-400">Name</span><p className="text-sm font-medium text-gray-900">{viewVendor.pocName || viewVendor.poc_name || '-'}</p></div>
                    <div><span className="text-xs text-gray-400">Mobile</span><p className="text-sm font-medium text-gray-900">{viewVendor.pocMobile || viewVendor.poc_mobile || '-'}</p></div>
                    <div><span className="text-xs text-gray-400">Email</span><p className="text-sm font-medium text-gray-900">{viewVendor.pocEmail || viewVendor.poc_email || '-'}</p></div>
                  </div>
                </div>
              )}
              {/* Metadata */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Metadata</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-gray-400">Created By</span>
                    <p className="text-sm font-medium text-gray-900">{viewVendor.created_by_name || viewVendor.createdBy || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Created</span>
                    <p className="text-sm font-medium text-gray-900">{formatDate(viewVendor.createdAt || viewVendor.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Status</span>
                    <p className={`text-sm font-medium ${(viewVendor.status === 'deleted' || viewVendor.is_active === 0) ? 'text-red-600' : 'text-green-600'}`}>
                      {(viewVendor.status === 'deleted' || viewVendor.is_active === 0) ? 'Inactive' : 'Active'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Vendor</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.ownerName}</strong> ({deleteConfirm.vendorId})? This action will mark the vendor as deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditVendor(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  Modify Vendor
                </h2>
                <p className="text-sm text-gray-500 font-mono mt-1">{editVendor.vendorId}</p>
              </div>
              <button onClick={() => setEditVendor(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Service Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  Service Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Service Type</label>
                    <select
                      value={editForm.serviceType}
                      onChange={(e) => handleEditFormChange('serviceType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                    >
                      <option value="">Select Service</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="HVAC">HVAC</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Security">Security</option>
                      <option value="Landscaping">Landscaping</option>
                      <option value="Pest Control">Pest Control</option>
                      <option value="Painting">Painting</option>
                      <option value="Carpentry">Carpentry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Division</label>
                    <select
                      value={editForm.division}
                      onChange={(e) => handleEditFormChange('division', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                    >
                      <option value="">Select Division</option>
                      <option value="Residential">Residential</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Industrial">Industrial</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="serviceVerified"
                      checked={editForm.serviceVerified}
                      onChange={(e) => handleEditFormChange('serviceVerified', e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                    <label htmlFor="serviceVerified" className="text-sm text-gray-700">Service Verified</label>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-amber-600" />
                  Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Zone</label>
                    <select
                      value={editForm.zone}
                      onChange={(e) => handleEditFormChange('zone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                    >
                      <option value="">Select Zone</option>
                      {zones.map(z => <option key={z} value={z}>{z}</option>)}
                      {!zones.includes(editForm.zone) && editForm.zone && (
                        <option value={editForm.zone}>{editForm.zone}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Area Name</label>
                    <input
                      type="text"
                      value={editForm.areaName}
                      onChange={(e) => handleEditFormChange('areaName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter area name"
                    />
                  </div>
                </div>
              </div>

              {/* Owner Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600" />
                  Owner Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Owner Name *</label>
                    <input
                      type="text"
                      value={editForm.ownerName}
                      onChange={(e) => handleEditFormChange('ownerName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter owner name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Owner Mobile *</label>
                    <div className="flex gap-2">
                      <select
                        value={editForm.ownerCountryCode}
                        onChange={(e) => handleEditFormChange('ownerCountryCode', e.target.value)}
                        className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      >
                        <option value="+91">+91</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                      </select>
                      <input
                        type="tel"
                        value={editForm.ownerMobile}
                        onChange={(e) => handleEditFormChange('ownerMobile', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                        placeholder="Enter mobile number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Owner Email</label>
                    <input
                      type="email"
                      value={editForm.ownerEmail}
                      onChange={(e) => handleEditFormChange('ownerEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Owner Aadhar</label>
                    <input
                      type="text"
                      value={editForm.ownerAadhar}
                      onChange={(e) => handleEditFormChange('ownerAadhar', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="XXXX-XXXX-XXXX"
                    />
                  </div>
                </div>
              </div>

              {/* Manager Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Manager Details (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager Name</label>
                    <input
                      type="text"
                      value={editForm.managerName}
                      onChange={(e) => handleEditFormChange('managerName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter manager name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager Mobile</label>
                    <input
                      type="tel"
                      value={editForm.managerMobile}
                      onChange={(e) => handleEditFormChange('managerMobile', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter mobile number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager Email</label>
                    <input
                      type="email"
                      value={editForm.managerEmail}
                      onChange={(e) => handleEditFormChange('managerEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
              </div>

              {/* POC Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Point of Contact (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">POC Name</label>
                    <input
                      type="text"
                      value={editForm.pocName}
                      onChange={(e) => handleEditFormChange('pocName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter POC name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">POC Mobile</label>
                    <input
                      type="tel"
                      value={editForm.pocMobile}
                      onChange={(e) => handleEditFormChange('pocMobile', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter mobile number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">POC Email</label>
                    <input
                      type="email"
                      value={editForm.pocEmail}
                      onChange={(e) => handleEditFormChange('pocEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
              </div>

              {/* Rate & Coverage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Rate & Coverage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Rate Per Visit (₹)</label>
                    <input
                      type="number"
                      value={editForm.ratePerVisit}
                      onChange={(e) => handleEditFormChange('ratePerVisit', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter rate per visit"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Coverage Per Day</label>
                    <input
                      type="number"
                      value={editForm.coveragePerDay}
                      onChange={(e) => handleEditFormChange('coveragePerDay', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter coverage per day"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Business Documents */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Business Documents (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">GST Number</label>
                    <input
                      type="text"
                      value={editForm.gstNumber || ''}
                      onChange={(e) => handleEditFormChange('gstNumber', e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">PAN Number</label>
                    <input
                      type="text"
                      value={editForm.panNumber || ''}
                      onChange={(e) => handleEditFormChange('panNumber', e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">License Number</label>
                    <input
                      type="text"
                      value={editForm.licenseNumber || ''}
                      onChange={(e) => handleEditFormChange('licenseNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                      placeholder="Enter license number"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setEditVendor(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.ownerName || !editForm.ownerMobile}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDetails;
