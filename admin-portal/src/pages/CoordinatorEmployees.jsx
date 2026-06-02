import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Eye,
  Lock
} from 'lucide-react';

const CoordinatorEmployees = ({ user }) => {
  // Check if this is an FP-created Coordinator (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
  const location = useLocation();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'coord_executive',
    assignedZones: []
  });

  const viewType = location.pathname.includes('/add') ? 'add' 
                 : location.pathname.includes('/zones') ? 'zones' 
                 : 'all';

  const token = sessionStorage.getItem('pm_auth_token');

  const roleOptions = [
    { value: 'coord_supervisor', label: 'Supervisor' },
    { value: 'coord_executive', label: 'Executive' }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isFPCoordinator) {
        // FP Coordinator: Fetch all FP employees with zones (view-only)
        const response = await fetch('/api/coordinator/fp-employee-zones', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          // Transform data to match expected format
          const transformedEmployees = (result.data.employees || []).map(emp => ({
            ...emp,
            assigned_zones: emp.zone_names && emp.zone_names !== 'No zones assigned' 
              ? emp.zone_names.split(',').map(z => z.trim()) 
              : []
          }));
          setEmployees(transformedEmployees);
          setZones(result.data.zones || []);
        }
      } else {
        // Standalone Coordinator: Fetch own employees
        const [empRes, zoneRes] = await Promise.all([
          fetch('/api/coordinator/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/coordinator/zones', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const [empData, zoneData] = await Promise.all([
          empRes.json(),
          zoneRes.json()
        ]);

        if (empData.success) setEmployees(empData.data || []);
        if (zoneData.success) setZones(zoneData.data || []);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeDetails = async (id) => {
    try {
      const response = await fetch(`/api/coordinator/employees/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setSelectedEmployee(result.data);
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error('Fetch employee details error:', error);
    }
  };

  useEffect(() => {
    fetchData();
    if (viewType === 'add' && !isFPCoordinator) {
      resetForm();
      setShowModal(true);
    }
  }, [viewType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const url = editingEmployee 
        ? `/api/coordinator/employees/${editingEmployee.id}`
        : '/api/coordinator/employees';
      
      const response = await fetch(url, {
        method: editingEmployee ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `Employee ${editingEmployee ? 'updated' : 'created'} successfully!` });
        setShowModal(false);
        resetForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save employee' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;

    try {
      const response = await fetch(`/api/coordinator/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Employee deleted successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Delete failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete employee' });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/coordinator/export/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'coordinator_employees_export.json';
      a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      role: employee.role || 'coord_executive',
      assignedZones: []
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'coord_executive',
      assignedZones: []
    });
  };

  const handleZoneToggle = (zoneId) => {
    const currentZones = formData.assignedZones;
    if (currentZones.includes(zoneId)) {
      setFormData({
        ...formData,
        assignedZones: currentZones.filter(id => id !== zoneId)
      });
    } else {
      setFormData({
        ...formData,
        assignedZones: [...currentZones, zoneId]
      });
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      coord_supervisor: 'bg-purple-100 text-purple-700',
      coord_executive: 'bg-gray-100 text-gray-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const getRoleLabel = (role) => {
    return roleOptions.find(r => r.value === role)?.label || role;
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !searchTerm ||
      emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());

    const hasZones = (emp.assigned_zones && emp.assigned_zones.length > 0) || 
                     (emp.zone_names && emp.zone_names !== 'No zones assigned');

    if (statusFilter === 'assigned') {
      return matchesSearch && hasZones;
    }
    if (statusFilter === 'pending') {
      return matchesSearch && !hasZones;
    }
    return matchesSearch;
  });

  // Calculate stats
  const totalEmployees = employees.length;
  const zonesAssigned = employees.filter(e => (e.assigned_zones && e.assigned_zones.length > 0) || (e.zone_names && e.zone_names !== 'No zones assigned')).length;
  const pendingAssignment = employees.filter(e => (!e.assigned_zones || e.assigned_zones.length === 0) && (!e.zone_names || e.zone_names === 'No zones assigned')).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Zone Management</h1>
        <p className="text-gray-500 mt-1">
          View team zone assignments • <span className="text-teal-600 font-medium">{totalEmployees} employees</span>
        </p>
        {isFPCoordinator && (
          <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Zone assignments are managed by your Franchise Partner
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
          </div>
          <Users className="w-10 h-10 text-blue-500" />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Zones Assigned</p>
            <p className="text-2xl font-bold text-green-600">{zonesAssigned}</p>
          </div>
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Pending Assignment</p>
            <p className="text-2xl font-bold text-orange-600">{pendingAssignment}</p>
          </div>
          <XCircle className="w-10 h-10 text-orange-500" />
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

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees by name, ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Employees</option>
            <option value="assigned">Zones Assigned</option>
            <option value="pending">Pending Assignment</option>
          </select>
        </div>
      </div>

      {/* Employees List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No employees found</p>
            <p className="text-sm text-gray-400 mt-1">Add employees from the Add Employee page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Employee</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zones</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{employee.employee_code}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(employee.role)}`}>
                        {getRoleLabel(employee.role)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {employee.phone && (
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {employee.phone}
                          </p>
                        )}
                        {employee.email && (
                          <p className="text-sm text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {employee.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600">
                          {employee.zone_names || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        employee.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details - Always visible (Employee Details allowed) */}
                        <button
                          onClick={() => fetchEmployeeDetails(employee.id)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Edit - Hidden for FP Coordinator */}
                        {!isFPCoordinator && (
                          <button
                            onClick={() => openEditModal(employee)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Employee"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {/* Delete - Hidden for FP Coordinator */}
                        {!isFPCoordinator && (
                          <button
                            onClick={() => handleDelete(employee.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Employee"
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
          </div>
        )}
      </div>

      {/* Add/Edit Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: value });
                  }}
                  maxLength={10}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  {roleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Zones</label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {zones.length === 0 ? (
                    <p className="text-sm text-gray-500">No zones available</p>
                  ) : (
                    zones.map(zone => (
                      <label key={zone.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assignedZones.includes(zone.id)}
                          onChange={() => handleZoneToggle(zone.id)}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm text-gray-700">{zone.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingEmployee ? 'Update' : 'Add'} Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Employee Details</h2>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-teal-700">
                    {selectedEmployee.first_name?.[0]}{selectedEmployee.last_name?.[0]}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h3>
                <p className="text-sm text-gray-500">{selectedEmployee.employee_code}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(selectedEmployee.role)}`}>
                  {getRoleLabel(selectedEmployee.role)}
                </span>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                {selectedEmployee.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedEmployee.phone}</span>
                  </div>
                )}
                {selectedEmployee.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedEmployee.email}</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Assigned Zones</p>
                    <span className="text-gray-700">{selectedEmployee.zone_names || 'No zones assigned'}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    selectedEmployee.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedEmployee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              {/* Zone Management Button - Hidden for FP Coordinator */}
              {!isFPCoordinator && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openEditModal(selectedEmployee);
                  }}
                  className="px-4 py-2 text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50"
                >
                  Edit Employee
                </button>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
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

export default CoordinatorEmployees;
