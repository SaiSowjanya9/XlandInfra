import { useState, useEffect } from 'react';
import {
  Search,
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  MapPin,
  X,
  AlertCircle,
  ChevronDown
} from 'lucide-react';

const ManagerEmployeeZones = ({ user, viewOnly = false }) => {
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedZones, setSelectedZones] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const token = sessionStorage.getItem('pm_auth_token');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, zoneRes] = await Promise.all([
        fetch('/api/manager/employees', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/manager/zones', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [empData, zoneData] = await Promise.all([
        empRes.json(),
        zoneRes.json()
      ]);

      if (empData.success) setEmployees(empData.data || []);
      if (zoneData.success) setZones(zoneData.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalEmployees = employees.length;
  const zonesAssigned = employees.filter(e => e.assigned_zones && e.assigned_zones.length > 0).length;
  const pendingAssignment = employees.filter(e => !e.assigned_zones || e.assigned_zones.length === 0).length;

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !searchTerm ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'assigned') {
      return matchesSearch && emp.assigned_zones && emp.assigned_zones.length > 0;
    }
    if (statusFilter === 'pending') {
      return matchesSearch && (!emp.assigned_zones || emp.assigned_zones.length === 0);
    }
    return matchesSearch;
  });

  const openAssignModal = (employee) => {
    setSelectedEmployee(employee);
    setSelectedZones(employee.assigned_zones || []);
    setShowAssignModal(true);
  };

  const handleAssignZones = async () => {
    if (!selectedEmployee) return;

    try {
      const response = await fetch(`/api/manager/employees/${selectedEmployee.id}/zones`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zones: selectedZones })
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Zones assigned successfully!' });
        setShowAssignModal(false);
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to assign zones' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign zones' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Zone Management</h1>
        <p className="text-gray-500 mt-1">
          Assign and manage zones for employees • <span className="text-blue-600">{totalEmployees} employees</span>
        </p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Employees */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        {/* Zones Assigned */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Zones Assigned</p>
            <p className="text-2xl font-bold text-green-600">{zonesAssigned}</p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>

        {/* Pending Assignment */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Pending Assignment</p>
            <p className="text-2xl font-bold text-amber-600">{pendingAssignment}</p>
          </div>
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <XCircle className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees by name, ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 min-w-[180px]"
        >
          <option value="all">All Employees</option>
          <option value="assigned">Zones Assigned</option>
          <option value="pending">Pending Assignment</option>
        </select>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No employees found</p>
            <p className="text-gray-400 text-sm mt-1">Add employees from the Add Employee page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Employee</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Assigned Zones</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  {!viewOnly && <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                        <p className="text-sm text-gray-500">{emp.user_id}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-600">{emp.email}</p>
                      <p className="text-xs text-gray-400">{emp.phone}</p>
                    </td>
                    <td className="py-4 px-4">
                      {emp.assigned_zones && emp.assigned_zones.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {emp.assigned_zones.slice(0, 2).map((zone, idx) => (
                            <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              {zone}
                            </span>
                          ))}
                          {emp.assigned_zones.length > 2 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              +{emp.assigned_zones.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No zones assigned</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {emp.assigned_zones && emp.assigned_zones.length > 0 ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Assigned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-sm">
                          <XCircle className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    {!viewOnly && (
                    <td className="py-4 px-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => openAssignModal(emp)}
                          className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                        >
                          <MapPin className="w-4 h-4 inline mr-1" />
                          Assign Zones
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Zones Modal - Only show when not in viewOnly mode */}
      {!viewOnly && showAssignModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Assign Zones</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </p>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Select zones to assign to this employee:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {zones.map((zone) => (
                  <label
                    key={zone.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedZones.includes(zone.name)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedZones.includes(zone.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZones([...selectedZones, zone.name]);
                        } else {
                          setSelectedZones(selectedZones.filter(z => z !== zone.name));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{zone.name}</p>
                      {zone.description && (
                        <p className="text-sm text-gray-500">{zone.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignZones}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Zones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerEmployeeZones;
