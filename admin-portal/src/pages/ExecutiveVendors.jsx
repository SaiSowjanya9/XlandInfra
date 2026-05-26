import { useState, useEffect } from 'react';
import { Store, Search, RefreshCw, X, AlertCircle, CheckCircle, Phone, Mail, MapPin, Eye, Calendar } from 'lucide-react';

const ExecutiveVendors = ({ user }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/executive/vendors', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) setVendors(result.data.all || result.data || []);
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const viewVendorDetails = (vendor) => {
    setSelectedVendor(vendor);
    setShowDetailModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      pending: 'bg-yellow-100 text-yellow-700'
    };
    return colors[status] || colors.active;
  };

  const filteredVendors = vendors.filter(v => v.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || v.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) || v.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1><p className="text-gray-500 mt-1">View and manage vendors</p></div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search vendors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" /></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12"><Store className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No vendors found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Service Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Owner</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Area</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Coverage/Day</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{vendor.vendor_id || '-'}</p>
                      <p className="text-xs text-gray-500">{vendor.company_name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-700">{vendor.service_type || vendor.vendor_type || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-700">{vendor.contact_person || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{vendor.zone_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{vendor.city || vendor.area || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{vendor.coverage_per_day || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{vendor.created_by_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500">{formatDate(vendor.created_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vendor.status || 'active')}`}>
                        {vendor.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => viewVendorDetails(vendor)}
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
      {showDetailModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Vendor Details</h2>
                <p className="text-sm text-gray-500">{selectedVendor.vendor_id}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Company Name</p>
                  <p className="font-medium text-gray-900">{selectedVendor.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Service Type</p>
                  <p className="font-medium text-gray-900">{selectedVendor.service_type || selectedVendor.vendor_type || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Owner/Contact Person</p>
                  <p className="font-medium text-gray-900">{selectedVendor.contact_person || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="font-medium text-gray-900">{selectedVendor.zone_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Area</p>
                  <p className="font-medium text-gray-900">{selectedVendor.city || selectedVendor.area || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Coverage/Day</p>
                  <p className="font-medium text-gray-900">{selectedVendor.coverage_per_day || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedVendor.status || 'active')}`}>
                    {selectedVendor.status || 'Active'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created By</p>
                  <p className="font-medium text-gray-900">{selectedVendor.created_by_name || '-'}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedVendor.phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedVendor.email || '-'}</span>
                  </div>
                  <div className="col-span-2 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">
                      {[selectedVendor.address, selectedVendor.city, selectedVendor.state, selectedVendor.zip_code].filter(Boolean).join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Additional Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">GST Number</p>
                    <p className="font-medium text-gray-900">{selectedVendor.gst_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">PAN Number</p>
                    <p className="font-medium text-gray-900">{selectedVendor.pan_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created Date</p>
                    <p className="font-medium text-gray-900 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(selectedVendor.created_at)}
                    </p>
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

export default ExecutiveVendors;
