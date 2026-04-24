import { useState, useEffect } from 'react';
import { 
  Search, Trash2, X, Check, Building2, Home, TreePine, Map,
  Eye, ChevronDown, AlertCircle, Bell, Clock, Briefcase, Lock, 
  ArrowLeft, Download, ExternalLink, Layers
} from 'lucide-react';
import { getProperties, deleteProperty, getNotifications, markAllNotificationsRead } from '../utils/propertyStore';
import * as XLSX from 'xlsx';

// Category options for Properties (same as Onboarding)
const PROPERTY_CATEGORIES = [
  {
    id: 'residential',
    name: 'Residential',
    icon: Home,
    color: 'bg-emerald-500',
    description: 'View residential properties including gated communities, apartments, and villas',
    locked: false
  },
  {
    id: 'commercial',
    name: 'Commercial',
    icon: Briefcase,
    color: 'bg-blue-500',
    description: 'View commercial properties and office spaces',
    locked: true
  }
];

const TABS = [
  { id: 'all', label: 'All Properties', icon: Building2 },
  { id: 'GC', label: 'Gated Communities', icon: Layers },
  { id: 'APT', label: 'Apartments', icon: Home },
  { id: 'VILLA', label: 'Villas', icon: TreePine },
  { id: 'PLOT', label: 'Plots', icon: Map },
];

const TYPE_STYLES = {
  GC: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', accent: 'bg-blue-500' },
  APT: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', accent: 'bg-emerald-500' },
  VILLA: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', accent: 'bg-amber-500' },
  PLOT: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', accent: 'bg-rose-500' },
};

const TYPE_LABELS = { GC: 'Gated Community', APT: 'Apartment', VILLA: 'Villa', PLOT: 'Plot' };

const Properties = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [properties, setProperties] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewProperty, setViewProperty] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Load properties from backend API and notifications from localStorage
  const loadData = async () => {
    const props = await getProperties();
    setProperties(props);
    setNotifications(getNotifications());
  };

  useEffect(() => {
    loadData();
    // Poll for new entries every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Delete handler
  const handleDelete = async (id) => {
    const success = await deleteProperty(id);
    if (success) {
      await loadData();
      showToast('Property deleted successfully');
    } else {
      showToast('Failed to delete property', 'error');
    }
    setDeleteConfirm(null);
  };

  // Mark all notifications as read
  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setNotifications(getNotifications());
  };

  // Export single property to Excel
  const handleExportProperty = (property) => {
    const p = property;
    
    // Create detailed export data for a single property
    const exportData = [{
      'Property ID': p.propertyId || '',
      'Name': p.name || '',
      'Type': TYPE_LABELS[p.entryType] || '',
      'Zone': p.zone || '',
      'Area Name': p.areaName || '',
      'Division': p.division || '',
      'Property Type': p.propertyType || '',
      'Total Units': p.totalUnits || 0,
      'Number of Blocks': p.numberOfBlocks || '',
      'Block Info': p.blockNA ? 'N/A' : (p.blockInfo || ''),
      'Villa/Plot Number': p.villaPlotNumber || '',
      'Address': p.address || '',
      'Address Line 1': p.addressLine1 || '',
      'Apt/Suite/Unit': p.aptSuiteNA ? 'N/A' : (p.aptSuiteUnit || ''),
      'City': p.city || '',
      'State': p.state || '',
      'Postal Code': p.postalCode || '',
      'Landmark': p.landmark || '',
      'Map Coordinates': p.mapLocation?.lat && p.mapLocation?.lng 
        ? `${p.mapLocation.lat}, ${p.mapLocation.lng}` 
        : '',
      'Map Address': p.mapLocation?.address || '',
      'Map Link': p.mapLocation?.lat && p.mapLocation?.lng 
        ? `https://www.google.com/maps?q=${p.mapLocation.lat},${p.mapLocation.lng}` 
        : '',
      'Notes': p.notes || '',
      'Created At': p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : ''
    }];

    // Add contacts as separate rows if present
    if (p.contacts && p.contacts.length > 0) {
      p.contacts.forEach((c, i) => {
        exportData[0][`Contact ${i + 1} Name`] = c.name || '';
        exportData[0][`Contact ${i + 1} Email`] = c.email || '';
        exportData[0][`Contact ${i + 1} Phone`] = `${c.countryCode || '+91'} ${c.phone}` || '';
      });
    }

    // Add blocks info for GC
    if (p.entryType === 'GC' && p.unitsPerBlock) {
      Object.entries(p.unitsPerBlock).forEach(([blockNum, units]) => {
        const blockName = p.blockNames?.[blockNum] || `Block ${blockNum}`;
        exportData[0][`${blockName} Units`] = units;
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Property Details');
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 20)
    }));
    ws['!cols'] = colWidths;

    const fileName = `${p.propertyId || p.name || 'Property'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Property exported successfully');
  };

  // Derived data
  const divisions = [...new Set(properties.map(p => p.division).filter(Boolean))];
  const zones = [...new Set(properties.map(p => p.zone).filter(Boolean))];
  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredProperties = properties.filter(p => {
    if (activeTab !== 'all' && p.entryType !== activeTab) return false;
    if (divisionFilter && p.division !== divisionFilter) return false;
    if (zoneFilter && p.zone !== zoneFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.propertyId?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.zone?.toLowerCase().includes(q) ||
        p.areaName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats per type
  const statsByType = TABS.filter(t => t.id !== 'all').map(tab => ({
    ...tab,
    count: properties.filter(p => p.entryType === tab.id).length,
    units: properties.filter(p => p.entryType === tab.id).reduce((sum, p) => sum + (p.totalUnits || 0), 0)
  }));

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Category Selection Screen (shown first)
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-600 mt-1">View and manage onboarded properties</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Category</h2>
          <p className="text-gray-600 mb-8">Choose the property category to view</p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
            {PROPERTY_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => !category.locked && setSelectedCategory(category.id)}
                  disabled={category.locked}
                  className={`group relative p-6 bg-white border-2 rounded-xl transition-all duration-200 text-left ${
                    category.locked
                      ? 'border-gray-200 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 hover:border-primary-500 hover:shadow-lg'
                  }`}
                >
                  {category.locked && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
                      <Lock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-medium text-gray-500">Coming Soon</span>
                    </div>
                  )}
                  <div className={`w-14 h-14 ${category.color} rounded-xl flex items-center justify-center mb-4 ${
                    category.locked ? '' : 'group-hover:scale-110'
                  } transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h3>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Residential Properties View (main content)
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border animate-slide-in ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Categories"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
            <p className="text-gray-500 text-sm mt-1">
              {properties.length} total properties
            </p>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          {/* Notification Bell */}
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

          {/* Notification Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
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
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.id === 'all' ? properties.length : properties.filter(p => p.entryType === tab.id).length}
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
              placeholder="Search by name, ID, zone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none"
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
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none"
              >
                <option value="">All Zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            {(divisionFilter || zoneFilter || searchTerm) && (
              <button
                onClick={() => { setDivisionFilter(''); setZoneFilter(''); setSearchTerm(''); }}
                className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Property Table */}
        {filteredProperties.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No properties found</p>
            <p className="text-gray-400 text-sm mt-1">
              {properties.length === 0 
                ? 'Properties created from Onboarding will appear here.' 
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Zone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Area</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Division</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Property Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Units</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">City</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Contacts</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProperties.map((property) => {
                  const style = TYPE_STYLES[property.entryType] || TYPE_STYLES.GC;
                  return (
                    <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {property.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {property.propertyId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                          {TYPE_LABELS[property.entryType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.zone || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.areaName || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.division || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.propertyType || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-center">
                        {property.totalUnits || 0}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[200px] truncate" title={property.address}>
                        {property.address || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.city || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-center">
                        {property.contacts?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(property.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewProperty(property)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExportProperty(property)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Export to Excel"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(property)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
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

        {/* Footer count */}
        {filteredProperties.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Showing {filteredProperties.length} of {properties.length} properties
          </div>
        )}
      </div>

      {/* View Property Modal */}
      {viewProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewProperty(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{viewProperty.name}</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[viewProperty.entryType]?.badge}`}>
                    {TYPE_LABELS[viewProperty.entryType]}
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{viewProperty.propertyId}</p>
              </div>
              <button onClick={() => setViewProperty(null)} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content - Form-like layout */}
            <div className="px-6 py-5 space-y-6">
              {/* Property Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Property Information</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Zone</label>
                    <p className="text-sm text-gray-900">{viewProperty.zone || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Area Name</label>
                    <p className="text-sm text-gray-900">{viewProperty.areaName || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Division</label>
                    <p className="text-sm text-gray-900">{viewProperty.division || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Property Type</label>
                    <p className="text-sm text-gray-900">{viewProperty.propertyType || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Total Units</label>
                    <p className="text-sm text-gray-900">{viewProperty.totalUnits || 0}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Created Date</label>
                    <p className="text-sm text-gray-900">{formatDate(viewProperty.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Blocks (GC) */}
              {viewProperty.entryType === 'GC' && viewProperty.unitsPerBlock && Object.keys(viewProperty.unitsPerBlock).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Block Details</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {Object.entries(viewProperty.unitsPerBlock).map(([blockNum, units]) => (
                      <div key={blockNum}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {viewProperty.blockNames?.[blockNum] || `Block ${blockNum}`}
                        </label>
                        <p className="text-sm text-gray-900">{units} units</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Block Info (APT) */}
              {viewProperty.entryType === 'APT' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Block Information</h3>
                  <p className="text-sm text-gray-900">
                    {viewProperty.blockNA ? 'N/A' : (viewProperty.blockInfo || '-')}
                  </p>
                </div>
              )}

              {/* Villa/Plot Number */}
              {(viewProperty.entryType === 'VILLA' || viewProperty.entryType === 'PLOT') && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
                    {viewProperty.entryType === 'VILLA' ? 'Villa Details' : 'Plot Details'}
                  </h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      {viewProperty.entryType === 'VILLA' ? 'Villa Number' : 'Plot Number'}
                    </label>
                    <p className="text-sm text-gray-900">{viewProperty.villaPlotNumber || '-'}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Address</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Street Address</label>
                    <p className="text-sm text-gray-900">{viewProperty.address || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Apt/Suite</label>
                    <p className="text-sm text-gray-900">
                      {viewProperty.aptSuiteNA ? 'N/A' : (viewProperty.aptSuiteUnit || '-')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">City</label>
                    <p className="text-sm text-gray-900">{viewProperty.city || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">State/Province</label>
                    <p className="text-sm text-gray-900">{viewProperty.state || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ZIP/Postal Code</label>
                    <p className="text-sm text-gray-900">{viewProperty.postalCode || '-'}</p>
                  </div>
                  {viewProperty.landmark && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Landmark</label>
                      <p className="text-sm text-gray-900">{viewProperty.landmark}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Location with clickable link */}
              {viewProperty.mapLocation?.lat && viewProperty.mapLocation?.lng && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Map Location</h3>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
                    {viewProperty.mapLocation.address && (
                      <p className="text-sm text-gray-700 mb-3">{viewProperty.mapLocation.address}</p>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${viewProperty.mapLocation.lat},${viewProperty.mapLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Maps
                    </a>
                    <p className="text-xs text-gray-500 mt-2 font-mono">
                      {viewProperty.mapLocation.lat.toFixed(6)}, {viewProperty.mapLocation.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              {/* Contacts */}
              {viewProperty.contacts && viewProperty.contacts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Contact Information</h3>
                  <div className="space-y-3">
                    {viewProperty.contacts.map((c, i) => (
                      <div key={i} className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-md">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Name</label>
                          <p className="text-sm text-gray-900">{c.name}</p>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email</label>
                          <p className="text-sm text-gray-900">{c.email}</p>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Phone</label>
                          <p className="text-sm text-gray-900">{c.countryCode || '+91'} {c.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewProperty.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Notes</h3>
                  <p className="text-sm text-gray-700">{viewProperty.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center sticky bottom-0">
              <button
                onClick={() => { setDeleteConfirm(viewProperty); setViewProperty(null); }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportProperty(viewProperty)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
                <button
                  onClick={() => setViewProperty(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Property?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              This will permanently remove <strong>{deleteConfirm.name}</strong> ({deleteConfirm.propertyId}). This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;
