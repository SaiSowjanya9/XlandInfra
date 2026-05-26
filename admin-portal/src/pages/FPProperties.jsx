import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Home,
  Building,
  Lock,
  Grid3X3,
  Landmark,
  LayoutGrid,
  Users,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  UserPlus,
  Truck,
  MoreVertical,
  Trash2
} from 'lucide-react';

const FPProperties = ({ user }) => {
  // Check if user is FP Manager (restricted access - view only)
  const isFPManager = user?.role === 'manager';
  
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [actionDropdown, setActionDropdown] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fp/properties', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data);
      }
    } catch (error) {
      console.error('Fetch properties error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await fetch('/api/fp/zones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setZones(result.data);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchZones();
  }, []);

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    
    try {
      const response = await fetch(`/api/fp/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Property deleted successfully' });
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete property' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete property' });
    }
    setActionDropdown(null);
  };

  // Property type tabs
  const tabs = [
    { id: 'all', label: 'All Customers', icon: Users },
    { id: 'gated_community', label: 'Gated Communities', icon: Grid3X3 },
    { id: 'apartment', label: 'Apartments', icon: Building },
    { id: 'villa', label: 'Villas', icon: Home },
    { id: 'plot', label: 'Plots', icon: LayoutGrid },
    { id: 'flat', label: 'Flats', icon: Landmark }
  ];

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    const colors = {
      'apartment': 'bg-blue-100 text-blue-700',
      'gated_community': 'bg-teal-100 text-teal-700',
      'villa': 'bg-amber-100 text-amber-700',
      'plot': 'bg-purple-100 text-purple-700',
      'flat': 'bg-pink-100 text-pink-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // Filter properties
  const filteredProperties = properties.filter(p => {
    // Tab filter
    if (activeTab !== 'all' && p.property_type !== activeTab) return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!(
        p.name?.toLowerCase().includes(search) ||
        p.property_id?.toLowerCase().includes(search) ||
        p.zone_name?.toLowerCase().includes(search) ||
        p.address?.toLowerCase().includes(search)
      )) return false;
    }
    
    // Zone filter
    if (selectedZone && p.zone_id !== parseInt(selectedZone)) return false;
    
    // Division filter
    if (selectedDivision && p.division !== selectedDivision) return false;
    
    return true;
  });

  // Count properties by type
  const getTypeCount = (type) => {
    if (type === 'all') return properties.length;
    return properties.filter(p => p.property_type === type).length;
  };

  // Get unique divisions from properties
  const uniqueDivisions = [...new Set(properties.map(p => p.division).filter(Boolean))];

  // Category Selection View
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">View and manage created customers</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Selection */}
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900">Select Category</h2>
            <p className="text-gray-500 mt-1">Choose the customer category to view</p>
          </div>

          <div className="flex justify-center gap-6">
            {/* Residential Card */}
            <button
              onClick={() => setSelectedCategory('residential')}
              className="w-48 p-6 border-2 border-teal-500 rounded-xl hover:shadow-lg transition-all duration-200 bg-white group"
            >
              <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Home className="w-7 h-7 text-white" />
              </div>
              <p className="font-semibold text-gray-900">Residential</p>
            </button>

            {/* Commercial Card - Coming Soon */}
            <div className="w-48 p-6 border border-gray-200 rounded-xl bg-white relative cursor-not-allowed">
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full border border-gray-200">
                <Lock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Building className="w-7 h-7 text-gray-400" />
              </div>
              <p className="font-medium text-gray-400">Commercial</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to categories"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500">{properties.length} total customers</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = getTypeCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters - Hidden for FP Manager */}
      {!isFPManager && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, zone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        
        <div className="relative">
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="">All Divisions</option>
            {uniqueDivisions.map((div) => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="">All Zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="active">Active Customers</option>
            <option value="all">All Customers</option>
            <option value="inactive">Inactive Customers</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      )}

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No properties found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Zone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Area</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Division</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Units</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">City</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contacts</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-900">{property.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">{property.property_id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(property.property_type)}`}>
                          {property.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.zone_name || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.area || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.division || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.units || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 max-w-[150px] truncate block">{property.address || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.city || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.contact_phone || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">{formatDate(property.created_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          property.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {property.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 relative">
                        <button
                          onClick={() => setActionDropdown(actionDropdown === property.id ? null : property.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        
                        {actionDropdown === property.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              onClick={() => {
                                setSelectedProperty(property);
                                setShowDetailsModal(true);
                                setActionDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4" />
                              View Details
                            </button>
                            {!isFPManager && (
                              <>
                                <button
                                  onClick={() => {
                                    setMessage({ type: 'info', text: 'Assign Vendor feature coming soon' });
                                    setActionDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Truck className="w-4 h-4" />
                                  Assign Vendor
                                </button>
                                <button
                                  onClick={() => {
                                    setMessage({ type: 'info', text: 'Assign Employee feature coming soon' });
                                    setActionDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Assign Employee
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => handleDeleteProperty(property.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {filteredProperties.length} of {properties.length} properties
              </p>
            </div>
          </>
        )}
      </div>

      {/* View Details Modal */}
      {showDetailsModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Property Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedProperty(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Property Name</p>
                  <p className="text-sm font-medium">{selectedProperty.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Property ID</p>
                  <p className="text-sm font-medium">{selectedProperty.property_id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  <p className="text-sm font-medium">{selectedProperty.property_type?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Zone</p>
                  <p className="text-sm font-medium">{selectedProperty.zone_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Division</p>
                  <p className="text-sm font-medium">{selectedProperty.division || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Units</p>
                  <p className="text-sm font-medium">{selectedProperty.units || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Address</p>
                  <p className="text-sm font-medium">{selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Contact Person</p>
                  <p className="text-sm font-medium">{selectedProperty.contact_person || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Contact Phone</p>
                  <p className="text-sm font-medium">{selectedProperty.contact_phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Contact Email</p>
                  <p className="text-sm font-medium">{selectedProperty.contact_email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    selectedProperty.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedProperty.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedProperty(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPProperties;
