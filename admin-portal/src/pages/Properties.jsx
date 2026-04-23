import { useState, useEffect } from 'react';
import { 
  Search, Trash2, X, Check, Building2, Home, TreePine, Map,
  Eye, Filter, ChevronDown, MapPin, Users, Layers, AlertCircle,
  Bell, Clock, Grid3X3
} from 'lucide-react';
import { getProperties, deleteProperty, getNotifications, markAllNotificationsRead } from '../utils/propertyStore';

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-gray-500 text-sm mt-1">
            {properties.length} total properties across {statsByType.filter(s => s.count > 0).length} categories
          </p>
        </div>
        {/* Notification Bell */}
        <div className="relative mt-3 sm:mt-0">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
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
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${!n.read ? 'bg-primary-50/40' : ''}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-primary-500' : 'bg-transparent'}`} />
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

      {/* Category Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsByType.map(stat => {
          const style = TYPE_STYLES[stat.id];
          const TabIcon = stat.icon;
          return (
            <button
              key={stat.id}
              onClick={() => setActiveTab(activeTab === stat.id ? 'all' : stat.id)}
              className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                activeTab === stat.id ? `${style.bg} ${style.border} ring-2 ring-offset-1 ring-${style.text.replace('text-', '')}` : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-6 -mt-6 opacity-10 ${style.accent}`} />
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${style.badge}`}>
                  <TabIcon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500">{stat.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{stat.units} total units</p>
            </button>
          );
        })}
      </div>

      {/* Tabs + Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-gray-100 px-4 flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.id === 'all' ? properties.length : properties.filter(p => p.entryType === tab.id).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, zone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-500 outline-none"
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
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-500 outline-none"
              >
                <option value="">All Zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            {(divisionFilter || zoneFilter || searchTerm) && (
              <button
                onClick={() => { setDivisionFilter(''); setZoneFilter(''); setSearchTerm(''); }}
                className="px-3 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Property List */}
        <div className="divide-y divide-gray-50">
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
            filteredProperties.map((property) => {
              const style = TYPE_STYLES[property.entryType] || TYPE_STYLES.GC;
              return (
                <div key={property.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors group">
                  <div className="flex items-start gap-4">
                    {/* Type indicator */}
                    <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${style.accent}`} />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-sm font-semibold text-gray-900">{property.name}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.badge}`}>
                              {TYPE_LABELS[property.entryType]}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-gray-400 mt-0.5">{property.propertyId}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => setViewProperty(property)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(property)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        {property.zone && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {property.zone}
                          </span>
                        )}
                        {property.division && (
                          <span className="flex items-center gap-1">
                            <Grid3X3 className="w-3 h-3" /> {property.division}
                          </span>
                        )}
                        {property.areaName && (
                          <span className="flex items-center gap-1">
                            <Map className="w-3 h-3" /> {property.areaName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" /> {property.totalUnits || 0} units
                        </span>
                        {property.contacts && property.contacts.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {property.contacts.length} contact{property.contacts.length > 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(property.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer count */}
        {filteredProperties.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Showing {filteredProperties.length} of {properties.length} properties
          </div>
        )}
      </div>

      {/* View Property Modal */}
      {viewProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewProperty(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b border-gray-100 ${TYPE_STYLES[viewProperty.entryType]?.bg || 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${TYPE_STYLES[viewProperty.entryType]?.badge}`}>
                    {TYPE_LABELS[viewProperty.entryType]}
                  </span>
                  <h2 className="text-lg font-bold text-gray-900">{viewProperty.name}</h2>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{viewProperty.propertyId}</p>
                </div>
                <button onClick={() => setViewProperty(null)} className="p-2 hover:bg-white/70 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Zone', value: viewProperty.zone },
                  { label: 'Area', value: viewProperty.areaName },
                  { label: 'Division', value: viewProperty.division },
                  { label: 'Property Type', value: viewProperty.propertyType },
                  { label: 'Total Units', value: viewProperty.totalUnits },
                  { label: 'Created', value: formatDate(viewProperty.createdAt) },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase font-medium">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{item.value || '-'}</p>
                  </div>
                ))}
              </div>

              {/* Blocks (GC) */}
              {viewProperty.entryType === 'GC' && viewProperty.unitsPerBlock && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Blocks</p>
                  <div className="space-y-1.5">
                    {Object.entries(viewProperty.unitsPerBlock).map(([blockNum, units]) => (
                      <div key={blockNum} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">
                          {viewProperty.blockNames?.[blockNum] || `Block ${blockNum}`}
                        </span>
                        <span className="text-sm text-gray-500">{units} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Address */}
              {viewProperty.address && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Address</p>
                  <p className="text-sm text-gray-700">{viewProperty.address}</p>
                </div>
              )}

              {/* Map Location */}
              {viewProperty.mapLocation?.address && (
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-green-700">Pinned Location</p>
                    <p className="text-xs text-green-600 mt-0.5">{viewProperty.mapLocation.address}</p>
                  </div>
                </div>
              )}

              {/* Contacts */}
              {viewProperty.contacts && viewProperty.contacts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contacts</p>
                  <div className="space-y-2">
                    {viewProperty.contacts.map((c, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                          {c.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.email} &middot; {c.countryCode || '+91'} {c.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewProperty.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-gray-600">{viewProperty.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button
                onClick={() => { setDeleteConfirm(viewProperty); setViewProperty(null); }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button
                onClick={() => setViewProperty(null)}
                className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
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
