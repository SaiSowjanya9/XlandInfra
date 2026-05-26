import { useState, useEffect } from 'react';
import {
  Building2, Search, RefreshCw, MapPin, Phone, X, AlertCircle, CheckCircle, Eye
} from 'lucide-react';

const ExecutiveProperties = ({ user }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/executive/properties', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) setProperties(result.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const viewPropertyDetails = (property) => {
    setSelectedProperty(property);
    setShowDetailModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      pending: 'bg-yellow-100 text-yellow-700'
    };
    return colors[status] || colors.active;
  };

  const filteredProperties = properties.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.property_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* View Only Access Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Eye className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-800">View Only Access</h3>
          <p className="text-sm text-amber-700">You have view-only access to properties.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">View your assigned properties</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search properties..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12"><Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No properties found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Area</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Division</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Units</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Address</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">City</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contacts</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{property.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 font-mono">{property.property_id}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium capitalize">{property.property_type}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{property.zone_name || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{property.area || property.city || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{property.division || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{property.units || property.total_units || 1}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600 max-w-[100px] truncate" title={property.address}>
                        {property.address || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{property.city || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{property.contact_person || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(property.status || 'active')}`}>
                        {property.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => viewPropertyDetails(property)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {showDetailModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Property Details</h2>
                <p className="text-sm text-gray-500">{selectedProperty.property_id}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{selectedProperty.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <span className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium capitalize">{selectedProperty.property_type}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="font-medium text-gray-900">{selectedProperty.zone_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Area</p>
                  <p className="font-medium text-gray-900">{selectedProperty.area || selectedProperty.city || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Division</p>
                  <p className="font-medium text-gray-900">{selectedProperty.division || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Units</p>
                  <p className="font-medium text-gray-900">{selectedProperty.units || selectedProperty.total_units || 1}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedProperty.status || 'active')}`}>
                    {selectedProperty.status || 'Active'}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium text-gray-900 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      {selectedProperty.address || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">City</p>
                    <p className="font-medium text-gray-900">{selectedProperty.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">State</p>
                    <p className="font-medium text-gray-900">{selectedProperty.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ZIP Code</p>
                    <p className="font-medium text-gray-900">{selectedProperty.zip_code || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Contact Person</p>
                    <p className="font-medium text-gray-900">{selectedProperty.contact_person || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900 flex items-center gap-1">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {selectedProperty.contact_phone || '-'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{selectedProperty.contact_email || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={() => setShowDetailModal(false)} className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveProperties;
