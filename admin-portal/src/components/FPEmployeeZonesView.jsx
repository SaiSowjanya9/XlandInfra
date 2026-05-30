import { useState, useEffect } from 'react';
import { Users, MapPin, Eye, X, RefreshCw, Search } from 'lucide-react';

const FPEmployeeZonesView = ({ apiEndpoint, title = "Team Zone Assignments" }) => {
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiEndpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setEmployees(result.data.employees || []);
        setZones(result.data.zones || []);
      } else {
        setError(result.message || 'Failed to load data');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load employee zone assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.zone_names?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role) => {
    const colors = {
      manager: 'bg-blue-100 text-blue-700',
      supervisor: 'bg-purple-100 text-purple-700',
      executive: 'bg-green-100 text-green-700',
      coordinator: 'bg-orange-100 text-orange-700'
    };
    return colors[role?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-600">Loading zone assignments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <div className="text-center text-gray-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">View team members and their assigned zones</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, role, or zone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Employees List */}
      <div className="p-6">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No employees found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="border border-gray-100 rounded-lg p-4 hover:border-teal-200 hover:bg-teal-50/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{emp.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{emp.email}</p>
                  </div>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(emp.role)}`}>
                    {emp.role}
                  </span>
                </div>

                <div className="mt-3 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {emp.zone_names === 'No zones assigned' ? (
                        <span className="text-gray-400 italic">No zones assigned</span>
                      ) : (
                        emp.zone_names
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => { setSelectedEmployee(emp); setShowModal(true); }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Modal */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Employee Details</h2>
                <button
                  onClick={() => { setShowModal(false); setSelectedEmployee(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{selectedEmployee.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(selectedEmployee.role)}`}>
                    {selectedEmployee.role}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-900">{selectedEmployee.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-gray-900">{selectedEmployee.phone || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Assigned Zones</p>
                {selectedEmployee.zone_ids?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedEmployee.zone_names?.split(',').map((zone, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm"
                      >
                        {zone.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No zones assigned</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => { setShowModal(false); setSelectedEmployee(null); }}
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

export default FPEmployeeZonesView;
