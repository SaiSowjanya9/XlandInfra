import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

const ManagerCustomers = ({ user }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/manager/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('Fetch customers error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.client_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500 mt-1">View customer information</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchCustomers}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.client_id}</p>
                        {customer.company_name && (
                          <p className="text-sm text-gray-400">{customer.company_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                        {customer.client_type}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {customer.phone && (
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </p>
                        )}
                        {customer.email && (
                          <p className="text-sm text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {customer.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{customer.property_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600">
                          {customer.city ? `${customer.city}, ${customer.state || ''}` : '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerCustomers;
