import { useState, useEffect } from 'react';
import { 
  Users, Search, Briefcase, UserCog, ClipboardList, FileSpreadsheet,
  Edit2, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff,
  Phone, Mail, Filter,
  UserPlus, CheckCircle, XCircle,
  Loader2
} from 'lucide-react';

// Employee role definitions with colors
const EMPLOYEE_ROLES = {
  manager: {
    label: 'Manager',
    color: 'bg-purple-500',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Manages work orders, vendors, estimates, and schedules'
  },
  coordinator: {
    label: 'Coordinator',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Manages assigned properties, work orders, and field operations'
  },
  supervisor: {
    label: 'Supervisor',
    color: 'bg-amber-500',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Creates work order requests and tracks progress'
  },
  executive: {
    label: 'Executive',
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    description: 'Basic data collection - Adds client and vendor details'
  }
};

// Employee Management only shows these roles
const EMPLOYEE_MANAGEMENT_ROLES = ['manager', 'coordinator', 'supervisor', 'executive'];

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  const initialFormData = {
    role: 'manager',
    username: '',
    password: '',
    name: '',
    email: '',
    phone: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchQuery, roleFilter, statusFilter]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/staff', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        // Filter to only show Employee roles (Manager, Coordinator, Supervisor, Executive)
        const loadedEmployees = result.data
          .filter(u => EMPLOYEE_MANAGEMENT_ROLES.includes(u.role))
          .map(u => ({
            id: u.id,
            oderId: u.userId,
            username: u.username,
            email: u.email,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
            firstName: u.firstName,
            lastName: u.lastName,
            phone: u.phone,
            role: u.role,
            roleName: u.roleName,
            status: u.isActive ? 'active' : 'inactive',
            isActive: u.isActive,
            lastLogin: u.lastLogin,
            createdAt: u.createdAt,
            createdBy: u.createdBy
          }));
        setEmployees(loadedEmployees);
        
        // Calculate stats for Employee Management roles only
        const statsData = {
          total: loadedEmployees.length,
          active: loadedEmployees.filter(u => u.status === 'active').length,
          byRole: {
            manager: loadedEmployees.filter(u => u.role === 'manager').length,
            coordinator: loadedEmployees.filter(u => u.role === 'coordinator').length,
            supervisor: loadedEmployees.filter(u => u.role === 'supervisor').length,
            executive: loadedEmployees.filter(u => u.role === 'executive').length
          }
        };
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(query) ||
        emp.username.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(emp => emp.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(emp => emp.status === statusFilter);
    }

    setFilteredEmployees(filtered);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingEmployee(null);
    setShowPassword(false);
  };

  const handleOpenModal = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        role: employee.role || 'manager',
        username: employee.username || '',
        password: '',
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingEmployee) {
        // Update existing employee
        const updates = {
          username: formData.username,
          email: formData.email,
          firstName: formData.name.split(' ')[0],
          lastName: formData.name.split(' ').slice(1).join(' ') || '',
          phone: formData.phone,
          role: formData.role
        };
        if (formData.password) {
          updates.password = formData.password;
        }
        
        const response = await fetch(`/api/staff/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast('Employee updated successfully');
          loadEmployees();
          setShowModal(false);
          resetForm();
        } else {
          showToast(result.message || 'Failed to update employee', 'error');
        }
      } else {
        // Create new employee - password is auto-generated by backend
        const nameParts = formData.name.trim().split(' ');
        const employeeData = {
          username: formData.username,
          email: formData.email,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || '',
          phone: formData.phone,
          role: formData.role,
          sendEmail: true
        };
        
        const response = await fetch('/api/staff', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(employeeData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          setCreatedEmployee(result.data);
          showToast(
            result.data.emailSent 
              ? `Employee created! Email sent to ${formData.email}.` 
              : 'Employee created successfully!'
          );
          loadEmployees();
          setShowModal(false);
          resetForm();
        } else {
          showToast(result.message || 'Failed to create employee', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      showToast('Failed to save employee', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (employee) => {
    try {
      const response = await fetch(`/api/staff/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !employee.isActive })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(`Employee ${employee.isActive ? 'deactivated' : 'activated'} successfully`);
        loadEmployees();
      } else {
        showToast(result.message || 'Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast('Failed to update status', 'error');
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
        showToast('Employee deleted successfully');
        loadEmployees();
        setShowDeleteConfirm(null);
      } else {
        showToast(result.message || 'Failed to delete employee', 'error');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      showToast('Failed to delete employee', 'error');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'manager': return Briefcase;
      case 'coordinator': return UserCog;
      case 'supervisor': return ClipboardList;
      case 'executive': return FileSpreadsheet;
      default: return Users;
    }
  };

  const getRoleLabel = (role) => {
    return EMPLOYEE_ROLES[role]?.label || role;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-md flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {toast.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
            <p className="text-gray-500 mt-1">Manage employee accounts and permissions</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-6">
            {/* Total Employees */}
            <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Employees</p>
              </div>
            </div>
            
            {/* Role Stats */}
            <div className="flex flex-wrap items-center gap-4">
              {Object.entries(stats.byRole).map(([role, count]) => {
                const roleInfo = EMPLOYEE_ROLES[role] || {
                  label: role,
                  textColor: 'text-gray-600',
                  bgColor: 'bg-gray-50'
                };
                const Icon = getRoleIcon(role);
                return (
                  <div key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 ${roleInfo.bgColor} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${roleInfo.textColor}`} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{count}</p>
                      <p className="text-xs text-gray-500">{getRoleLabel(role)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="all">All Roles</option>
              <option value="manager">Manager</option>
              <option value="coordinator">Coordinator</option>
              <option value="supervisor">Supervisor</option>
              <option value="executive">Executive</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee Details Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Employee Details</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
                  <p className="mt-2 text-gray-500">Loading employees...</p>
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                  No employees found
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const roleInfo = EMPLOYEE_ROLES[emp.role] || {
                  label: emp.role,
                  textColor: 'text-gray-600',
                  bgColor: 'bg-gray-50'
                };
                const Icon = getRoleIcon(emp.role);
                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                        {emp.userId || emp.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${roleInfo.bgColor} rounded-full flex items-center justify-center`}>
                          <span className={`text-xs font-semibold ${roleInfo.textColor}`}>
                            {emp.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{emp.name}</p>
                          <p className="text-xs text-gray-500">@{emp.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${roleInfo.bgColor} ${roleInfo.textColor}`}>
                        <Icon className="w-3 h-3" />
                        {getRoleLabel(emp.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {emp.email}
                        </p>
                        {emp.phone && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {emp.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        emp.status === 'active' 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {emp.status === 'active' ? (
                          <><CheckCircle className="w-3 h-3" /> Active</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Inactive</>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          className={`p-1.5 rounded transition-colors ${
                            emp.status === 'active'
                              ? 'text-green-500 hover:text-green-700 hover:bg-green-50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title={emp.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {emp.status === 'active' ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenModal(emp)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(emp)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEmployee ? 'Edit Employee' : 'Add Employee'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Employee Role Selection - FIRST at top-left */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                  required
                >
                  {Object.entries(EMPLOYEE_ROLES).map(([role, info]) => (
                    <option key={role} value={role}>{info.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  {EMPLOYEE_ROLES[formData.role]?.description || 'Select a role to see description'}
                </p>
              </div>

              {/* Basic Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="johndoe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Password field only for editing */}
              {editingEmployee && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Change Password (Optional)</h4>
                  <div className="relative max-w-xs">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="Leave blank to keep current"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Info for new employee */}
              {!editingEmployee && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> A temporary password will be auto-generated and sent to the employee's email address. 
                    They will be required to change it on first login.
                  </p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Employee Details</h3>
              <button
                onClick={() => setViewingEmployee(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 ${EMPLOYEE_ROLES[viewingEmployee.role]?.bgColor || 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                  <span className={`text-xl font-bold ${EMPLOYEE_ROLES[viewingEmployee.role]?.textColor || 'text-gray-600'}`}>
                    {viewingEmployee.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{viewingEmployee.name}</h4>
                  <p className="text-sm text-gray-500">@{viewingEmployee.username}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${EMPLOYEE_ROLES[viewingEmployee.role]?.bgColor || 'bg-gray-100'} ${EMPLOYEE_ROLES[viewingEmployee.role]?.textColor || 'text-gray-600'} mt-1`}>
                    {getRoleLabel(viewingEmployee.role)}
                  </span>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{viewingEmployee.email}</span>
                </div>
                {viewingEmployee.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{viewingEmployee.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${viewingEmployee.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {viewingEmployee.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {viewingEmployee.lastLogin && (
                  <div className="text-xs text-gray-500 pt-2">
                    Last login: {new Date(viewingEmployee.lastLogin).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Employee</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
