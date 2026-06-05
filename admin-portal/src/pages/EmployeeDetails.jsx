import { useState, useEffect } from 'react';
import {
  Search,
  Trash2,
  X,
  Check,
  Eye,
  ChevronDown,
  AlertCircle,
  Users,
  Edit2,
  RotateCcw,
  MapPin,
  Phone,
  Mail,
  Calendar,
  UserX,
  ExternalLink,
  UserPlus,
  Briefcase,
  AtSign,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Employee roles for display
const EMPLOYEE_ROLES = {
  manager: { label: 'Manager', color: 'bg-purple-100 text-purple-700' },
  coordinator: { label: 'Coordinator', color: 'bg-blue-100 text-blue-700' },
  supervisor: { label: 'Supervisor', color: 'bg-teal-100 text-teal-700' },
  executive: { label: 'Executive', color: 'bg-orange-100 text-orange-700' }
};
import { useNavigate } from 'react-router-dom';
import {
  getEmployees,
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  deleteEmployee,
  getEmployeeNotifications,
  markAllEmployeeNotificationsRead,
} from '../utils/employeeStore';
import { getZones } from '../utils/zoneStore';

const EmployeeDetails = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get selected FP from context
  const { selectedFp, fpList, selectFp } = useFP();
  const token = sessionStorage.getItem('pm_auth_token');
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
  };

  useEffect(() => {
    if (selectedFp) {
      loadData();
    }
  }, [statusFilter, selectedFp]);

  const loadData = async () => {
    if (!selectedFp) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Fetch employees from FP-specific API
      const response = await fetch(`${API_BASE}/api/admin/fp-view/${selectedFp.id}/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        let empList = result.data || [];
        // Filter by status
        if (statusFilter !== 'all') {
          empList = empList.filter(e => (e.status || (e.is_active ? 'active' : 'inactive')) === statusFilter);
        }
        setEmployees(empList);
      } else {
        setEmployees([]);
      }
      setZones(getZones('active'));
    } catch (error) {
      console.error('Error fetching employees:', error);
      // Fallback to localStorage
      setEmployees(getEmployees(statusFilter));
      setZones(getZones('active'));
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDeactivate = async (employee) => {
    try {
      const response = await fetch(`/api/staff/${employee.id}/status`, {
        method: 'PATCH',
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
      // Fallback to localStorage
      const result = deactivateEmployee(employee.id);
      if (result.success) {
        showToast(`${employee.name} has been deactivated`);
        loadData();
      } else {
        showToast(result.message, 'error');
      }
    }
  };

  const handleReactivate = async (employee) => {
    try {
      const response = await fetch(`/api/staff/${employee.id}/status`, {
        method: 'PATCH',
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
      // Fallback to localStorage
      const result = reactivateEmployee(employee.id);
      if (result.success) {
        showToast(`${employee.name} has been reactivated`);
        loadData();
      } else {
        showToast(result.message, 'error');
      }
    }
  };

  const handleDelete = async (employee) => {
    try {
      const response = await fetch(`/api/staff/${employee.id}`, {
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
      // Fallback to localStorage
      deleteEmployee(employee.id);
      showToast(`${employee.name} has been permanently deleted`);
      setDeleteConfirm(null);
      loadData();
    }
  };

  const goToZoneManagement = () => {
    navigate('/employee/employee-zone-management');
  };

  const hasZonesAssigned = (employee) => {
    return employee.assignedZones === 'all' || 
      (Array.isArray(employee.assignedZones) && employee.assignedZones.length > 0);
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
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchesSearch = 
        e.name?.toLowerCase().includes(q) ||
        e.fullName?.toLowerCase().includes(q) ||
        e.username?.toLowerCase().includes(q) ||
        e.employeeId?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        EMPLOYEE_ROLES[e.role]?.label?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    
    if (zoneFilter) {
      if (e.assignedZones === 'all') return true;
      if (Array.isArray(e.assignedZones) && e.assignedZones.includes(zoneFilter)) return true;
      return false;
    }
    
    return true;
  });

  // Show FP selection if no FP selected
  if (!selectedFp) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Details</h1>
          <p className="text-gray-500 mt-1">Select a Franchise Partner to view employees</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select Franchise Partner</h2>
          <p className="text-gray-500 mb-6">Choose an FP from the list to view employees</p>
          <div className="flex flex-wrap justify-center gap-3">
            {fpList.map(fp => (
              <button
                key={fp.id}
                onClick={() => handleFpSelect(fp)}
                className="px-6 py-3 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors"
              >
                {fp.fpId} - {fp.companyName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Employee Details</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {employees.length} employees for {selectedFp.companyName}
          </p>
        </div>
        <button
          onClick={() => navigate('/employee/add-employee')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          Add Employee
        </button>
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
        {filteredEmployees.length === 0 ? (
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Assigned Zones</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-semibold text-sm">
                            {(employee.fullName || employee.name)?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 block">{employee.fullName || employee.name}</span>
                          <span className="text-xs text-gray-400 font-mono">{employee.employeeId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        EMPLOYEE_ROLES[employee.role]?.color || 'bg-gray-100 text-gray-700'
                      }`}>
                        {EMPLOYEE_ROLES[employee.role]?.label || employee.roleLabel || 'Employee'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      <span className="font-mono text-sm">@{employee.username || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {employee.email}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {employee.phone || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {hasZonesAssigned(employee) ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          employee.assignedZones === 'all'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {employee.assignedZones === 'all' 
                            ? 'All Zones' 
                            : `${employee.assignedZones?.length || 0} Zones`
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        employee.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {employee.status === 'active' ? 'Active' : 'Inactive'}
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
                        <button
                          onClick={() => setEditEmployee({ ...employee, fullName: employee.fullName || employee.name })}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Modify"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {employee.status === 'active' ? (
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
                      </div>
                    </td>
                  </tr>
                ))}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-lg">
                    {(viewEmployee.fullName || viewEmployee.name)?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{viewEmployee.fullName || viewEmployee.name}</h2>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-gray-500">{viewEmployee.employeeId}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      EMPLOYEE_ROLES[viewEmployee.role]?.color || 'bg-gray-100 text-gray-700'
                    }`}>
                      {EMPLOYEE_ROLES[viewEmployee.role]?.label || viewEmployee.roleLabel || 'Employee'}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewEmployee(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <AtSign className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Username</p>
                    <p className="text-sm font-mono font-medium text-gray-900">@{viewEmployee.username || '-'}</p>
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
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-gray-900">{viewEmployee.phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(viewEmployee.createdAt)}</p>
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
                    {formatZones(viewEmployee.assignedZones)}
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
                  viewEmployee.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {viewEmployee.status === 'active' ? 'Active' : 'Inactive'}
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

      {/* Edit Employee Modal */}
      {editEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditEmployee(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Modify Employee</h2>
              </div>
              <button
                onClick={() => setEditEmployee(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editEmployee.fullName || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, fullName: e.target.value, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={editEmployee.username || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmployee.email || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editEmployee.phone || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editEmployee.role || ''}
                  onChange={(e) => setEditEmployee({ ...editEmployee, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="manager">Manager</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editEmployee.status || 'active'}
                  onChange={(e) => setEditEmployee({ ...editEmployee, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setEditEmployee(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const result = updateEmployee(editEmployee.id || editEmployee.employeeId, editEmployee);
                  if (result.success) {
                    showToast('Employee updated successfully');
                    setEditEmployee(null);
                    loadData();
                  } else {
                    showToast(result.message || 'Failed to update employee', 'error');
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDetails;
