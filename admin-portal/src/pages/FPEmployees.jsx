import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  X,
  Check,
  Eye,
  ChevronDown,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  UserX,
  RotateCcw,
  Trash2,
  ExternalLink,
  UserPlus,
  Edit2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FPEmployees = ({ user }) => {
  const navigate = useNavigate();
  
  // Check if user is FP Manager (restricted access - view only)
  const isFPManager = user?.role === 'manager';
  
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewEmployee, setViewEmployee] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empResponse, zoneResponse] = await Promise.all([
        fetch('/api/fp/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fp/zones', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const empResult = await empResponse.json();
      const zoneResult = await zoneResponse.json();
      
      if (empResult.success) {
        const empData = Array.isArray(empResult.data) ? empResult.data : [];
        setEmployees(empData);
      }
      if (zoneResult.success) {
        setZones(Array.isArray(zoneResult.data) ? zoneResult.data : []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDeactivate = async (employee) => {
    try {
      const response = await fetch(`/api/fp/employees/${employee.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'inactive' })
      });
      const result = await response.json();
      if (result.success) {
        showToast(`${employee.name} has been deactivated`);
        loadData();
      } else {
        showToast(result.message || 'Failed to deactivate', 'error');
      }
    } catch (error) {
      showToast('Failed to deactivate employee', 'error');
    }
  };

  const handleReactivate = async (employee) => {
    try {
      const response = await fetch(`/api/fp/employees/${employee.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'active' })
      });
      const result = await response.json();
      if (result.success) {
        showToast(`${employee.name} has been reactivated`);
        loadData();
      } else {
        showToast(result.message || 'Failed to reactivate', 'error');
      }
    } catch (error) {
      showToast('Failed to reactivate employee', 'error');
    }
  };

  const handleDelete = async (employee) => {
    try {
      const response = await fetch(`/api/fp/employees/${employee.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast(`${employee.name} has been permanently deleted`);
        setDeleteConfirm(null);
        loadData();
      } else {
        showToast(result.message || 'Failed to delete', 'error');
      }
    } catch (error) {
      showToast('Failed to delete employee', 'error');
    }
  };

  const goToZoneManagement = () => {
    navigate('/fp/employees/zones');
  };

  const hasZonesAssigned = (employee) => {
    const empZones = employee.assignedZones || employee.assigned_zones;
    return empZones === 'all' || (Array.isArray(empZones) && empZones.length > 0);
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatZones = (zones) => {
    if (zones === 'all') return 'All Zones';
    if (Array.isArray(zones)) return zones.join(', ');
    return '-';
  };

  const filteredEmployees = employees.filter(e => {
    // Status filter
    const empStatus = e.status || (e.is_active ? 'active' : 'inactive');
    if (statusFilter === 'active' && empStatus !== 'active') return false;
    if (statusFilter === 'inactive' && empStatus !== 'inactive') return false;
    
    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (e.name || '').toLowerCase().includes(q) ||
        (e.employeeId || e.employee_id || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(q);
      if (!matchesSearch) return false;
    }
    
    // Zone filter
    if (zoneFilter) {
      const empZones = e.assignedZones || e.assigned_zones;
      if (empZones === 'all') return true;
      if (Array.isArray(empZones) && empZones.includes(zoneFilter)) return true;
      return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employee Details</h1>
          <p className="text-gray-500 text-sm mt-1">
            {employees.length} employees • Manage and view all registered employees
          </p>
        </div>
        {!isFPManager && (
          <button
            onClick={() => navigate('/fp/employees/add')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
            >
              <option value="">All Zones</option>
              {zones.map(z => (
                <option key={z.id} value={z.name}>{z.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none ${
                statusFilter === 'inactive' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 bg-white'
              }`}
            >
              <option value="active">Active Employees</option>
              <option value="inactive">Inactive Employees</option>
              <option value="all">All Employees</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          {(searchTerm || zoneFilter || statusFilter !== 'active') && (
            <button
              onClick={() => { setSearchTerm(''); setZoneFilter(''); setStatusFilter('active'); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No employees found</p>
            <p className="text-gray-400 text-sm mt-1">
              {employees.length === 0 
                ? 'Add employees from the Add Employee page.' 
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Employee ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Aadhaar</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Assigned Zones</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map((employee, index) => {
                  const empStatus = employee.status || (employee.is_active ? 'active' : 'inactive');
                  const empZones = employee.assignedZones || employee.assigned_zones;
                  
                  // Different colors for each employee
                  const colors = [
                    { bg: 'bg-blue-100', text: 'text-blue-700', avatar: 'bg-blue-500' },
                    { bg: 'bg-purple-100', text: 'text-purple-700', avatar: 'bg-purple-500' },
                    { bg: 'bg-green-100', text: 'text-green-700', avatar: 'bg-green-500' },
                    { bg: 'bg-amber-100', text: 'text-amber-700', avatar: 'bg-amber-500' },
                    { bg: 'bg-rose-100', text: 'text-rose-700', avatar: 'bg-rose-500' },
                    { bg: 'bg-cyan-100', text: 'text-cyan-700', avatar: 'bg-cyan-500' },
                    { bg: 'bg-indigo-100', text: 'text-indigo-700', avatar: 'bg-indigo-500' },
                    { bg: 'bg-teal-100', text: 'text-teal-700', avatar: 'bg-teal-500' }
                  ];
                  const color = colors[index % colors.length];
                  const zoneCount = Array.isArray(empZones) ? empZones.length : (empZones === 'all' ? 'All' : 0);
                  
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 ${color.avatar} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                            {(employee.name || 'E')[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{employee.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {employee.employee_code || employee.employeeId || employee.employee_id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          employee.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                          employee.role === 'supervisor' ? 'bg-purple-100 text-purple-700' :
                          employee.role === 'coordinator' ? 'bg-amber-100 text-amber-700' :
                          employee.role === 'executive' ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {employee.role || 'Field Staff'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        +91 {employee.phone}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {employee.email}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {employee.aadhaar?.replace(/(\d{4})/g, '$1 ').trim() || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasZonesAssigned(employee) ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            empZones === 'all'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {empZones === 'all' 
                              ? 'All Zones' 
                              : `${empZones?.length || 0} Zones`
                            }
                          </span>
                        ) : (
                          <button
                            onClick={goToZoneManagement}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            Assign Zones
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(employee.createdAt || employee.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          empStatus === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {empStatus === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewEmployee(employee)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Modify/Deactivate/Reactivate/Delete buttons - Hidden for FP Manager */}
                          {!isFPManager && (
                            <>
                              <button
                                onClick={() => navigate(`/fp/employees/edit/${employee.id}`)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                title="Modify"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {empStatus === 'active' ? (
                                <button
                                  onClick={() => handleDeactivate(employee)}
                                  className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="Deactivate"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivate(employee)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Reactivate"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteConfirm(employee)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredEmployees.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        )}
      </div>

      {/* View Employee Modal */}
      {viewEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewEmployee(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-lg">
                    {viewEmployee.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{viewEmployee.name}</h2>
                  <p className="text-xs font-mono text-gray-500">{viewEmployee.employeeId || viewEmployee.employee_id}</p>
                </div>
              </div>
              <button onClick={() => setViewEmployee(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{viewEmployee.countryCode || '+91'} {viewEmployee.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{viewEmployee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Aadhaar</p>
                    <p className="text-sm font-mono font-medium text-gray-900">
                      {viewEmployee.aadhaar?.replace(/(\d{4})/g, '$1 ').trim() || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(viewEmployee.createdAt || viewEmployee.created_at)}</p>
                  </div>
                </div>
              </div>
              <div className={`p-3 rounded-lg ${
                hasZonesAssigned(viewEmployee) ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-5 h-5 ${hasZonesAssigned(viewEmployee) ? 'text-emerald-500' : 'text-amber-500'}`} />
                    <p className={`text-xs ${hasZonesAssigned(viewEmployee) ? 'text-emerald-600' : 'text-amber-600'}`}>Assigned Zones</p>
                  </div>
                  <button
                    onClick={() => { setViewEmployee(null); goToZoneManagement(); }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    Manage <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                {hasZonesAssigned(viewEmployee) ? (
                  <p className="text-sm font-medium text-emerald-700">
                    {formatZones(viewEmployee.assignedZones || viewEmployee.assigned_zones)}
                  </p>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-amber-700">No zones assigned</p>
                    <button
                      onClick={() => { setViewEmployee(null); goToZoneManagement(); }}
                      className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Assign Zones
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  (viewEmployee.status || (viewEmployee.is_active ? 'active' : 'inactive')) === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {(viewEmployee.status || (viewEmployee.is_active ? 'active' : 'inactive')) === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Employee?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to permanently delete {deleteConfirm.name}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPEmployees;
