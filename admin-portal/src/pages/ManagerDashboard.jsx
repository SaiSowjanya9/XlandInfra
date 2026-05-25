import { useState, useEffect } from 'react';
import {
  Building2,
  Eye,
  Search,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  X
} from 'lucide-react';

const ManagerDashboard = ({ user }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  // Fetch properties
  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/manager/properties', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data || []);
      }
    } catch (error) {
      console.error('Fetch properties error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      pending: 'bg-yellow-100 text-yellow-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  // Filter properties
  const filteredProperties = properties.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.property_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.zone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.division?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your properties</p>
        </div>
        <button
          onClick={fetchProperties}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, zone, division..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No properties found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Zone</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Area</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Division</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Units</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Address</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Contacts</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Created By</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 text-sm">{property.name || property.community_name}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{property.property_id}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {property.property_type || property.entry_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{property.zone || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{property.area_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{property.division || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{property.total_units || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-[150px] truncate">{property.address || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {property.contact_name && <p className="text-gray-900">{property.contact_name}</p>}
                        {property.contact_phone && (
                          <p className="text-gray-500 text-xs flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {property.contact_phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{property.created_by || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{formatDate(property.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(property.status)}`}>
                        {property.status || 'active'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setSelectedProperty(property)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProperty(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Property Details</h2>
              <button onClick={() => setSelectedProperty(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Property ID</p>
                  <p className="font-medium">{selectedProperty.property_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{selectedProperty.name || selectedProperty.community_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium">{selectedProperty.property_type || selectedProperty.entry_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="font-medium">{selectedProperty.zone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Area</p>
                  <p className="font-medium">{selectedProperty.area_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Division</p>
                  <p className="font-medium">{selectedProperty.division || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Units</p>
                  <p className="font-medium">{selectedProperty.total_units || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedProperty.status)}`}>
                    {selectedProperty.status || 'active'}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium flex items-start gap-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    {selectedProperty.address || '-'}
                  </p>
                </div>
                {selectedProperty.contact_name && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Contact</p>
                    <p className="font-medium">{selectedProperty.contact_name}</p>
                    {selectedProperty.contact_phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selectedProperty.contact_phone}
                      </p>
                    )}
                    {selectedProperty.contact_email && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {selectedProperty.contact_email}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManagerDashboard;
