import { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import { 
  Users, Search, Shield, Briefcase,
  Edit2, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff,
  Phone, Mail, Filter, Building2,
  UserPlus, CheckCircle, XCircle, MapPin, AlertCircle,
  Landmark, Percent, Send, Key, Loader2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { USER_ROLES } from '../utils/userStore';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const token = getAuthToken();

  const initialFormData = {
    role: 'operations_manager',
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    // Franchise Partner specific fields (no franchiseId - auto-generated)
    franchiseName: '',
    companyName: '',
    gstNumber: '',
    panNumber: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    commissionRate: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter, statusFilter]);

  // User Management only shows: Admin, Operations Manager, and Franchise Partner roles
  const USER_MANAGEMENT_ROLES = ['admin', 'operations_manager', 'franchise_partner', 'franchise'];

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        // Filter to only show Admin, Operations Manager, and Franchise Partner users
        const loadedUsers = result.data
          .filter(u => USER_MANAGEMENT_ROLES.includes(u.role))
          .map(u => ({
            id: u.id,
            userId: u.userId,
            username: u.username,
            email: u.email,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
            firstName: u.firstName,
            lastName: u.lastName,
            phone: u.phone,
            role: u.role,
            roleName: u.roleName,
            visiblePassword: u.visiblePassword,
            mustChangePassword: u.mustChangePassword,
            status: u.isActive ? 'active' : 'inactive',
            isActive: u.isActive,
            isSuperAdmin: u.isSuperAdmin || false,
            lastLogin: u.lastLogin,
            createdAt: u.createdAt,
            createdBy: u.createdBy,
            // Franchise Partner fields
            franchiseName: u.franchiseName || '',
            ownerName: u.ownerName || '',
            companyName: u.companyName || '',
            gstNumber: u.gstNumber || '',
            panNumber: u.panNumber || ''
          }));
        setUsers(loadedUsers);
        
        // Calculate stats for User Management roles only
        const statsData = {
          total: loadedUsers.length,
          active: loadedUsers.filter(u => u.status === 'active').length,
          byRole: {
            admin: loadedUsers.filter(u => u.role === 'admin').length,
            operations_manager: loadedUsers.filter(u => u.role === 'operations_manager').length,
            franchise_partner: loadedUsers.filter(u => u.role === 'franchise_partner' || u.role === 'franchise').length
          }
        };
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        role: user.role || 'operations_manager',
        username: user.username || '',
        password: '',
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        franchiseName: user.franchiseName || '',
        companyName: user.companyName || '',
        gstNumber: user.gstNumber || '',
        panNumber: user.panNumber || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        pincode: user.pincode || '',
        bankName: user.bankName || '',
        accountNumber: user.accountNumber || '',
        ifscCode: user.ifscCode || '',
        commissionRate: user.commissionRate || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const isFranchisePartner = formData.role === 'franchise_partner' || formData.role === 'franchise';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingUser) {
        // Update existing user
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
        
        const response = await fetch(`/api/staff/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast('User updated successfully');
          loadUsers();
          setShowModal(false);
          resetForm();
        } else {
          showToast(result.message || 'Failed to update user', 'error');
        }
      } else {
        // Create new user - password is auto-generated by backend
        const nameParts = formData.name.trim().split(' ');
        const userData = {
          username: formData.username,
          email: formData.email,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || '',
          phone: formData.phone,
          role: formData.role,
          sendEmail: true
        };
        
        // Add FP-specific fields if creating a franchise partner (franchiseId auto-generated)
        if (formData.role === 'franchise_partner' || formData.role === 'franchise') {
          userData.franchiseName = formData.franchiseName;
          userData.companyName = formData.companyName;
          userData.gstNumber = formData.gstNumber;
          userData.panNumber = formData.panNumber;
          userData.address = formData.address;
          userData.city = formData.city;
          userData.state = formData.state;
          userData.pincode = formData.pincode;
          userData.bankName = formData.bankName;
          userData.accountNumber = formData.accountNumber;
          userData.ifscCode = formData.ifscCode;
          userData.commissionRate = formData.commissionRate;
        }
        
        const response = await fetch(`${API_BASE}/api/staff`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (result.success) {
          setCreatedUser(result.data);
          showToast(
            result.data.emailSent 
              ? `User created! Email sent to ${formData.email}. Ask user to check spam folder if not received.` 
              : 'User created but email could not be sent',
            result.data.emailSent ? 'success' : 'warning'
          );
          loadUsers();
          setShowModal(false);
          resetForm();
        } else {
          showToast(result.message || 'Failed to create user', 'error');
        }
      }
    } catch (error) {
      console.error('Error submitting user:', error);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = user.status === 'active' ? false : true;
      const response = await fetch(`/api/staff/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: newStatus })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(`User ${newStatus ? 'activated' : 'deactivated'}`);
        loadUsers();
      } else {
        showToast(result.message || 'Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (user) => {
    try {
      const response = await fetch(`/api/staff/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast('User deleted successfully');
        loadUsers();
        setShowDeleteConfirm(null);
      } else {
        showToast(result.message || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Failed to delete user', 'error');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return Shield;
      case 'operations_manager': return Briefcase;
      case 'franchise_partner':
      case 'franchise': return Building2;
      default: return Users;
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Super Admin',
      operations_manager: 'Operations Manager',
      franchise_partner: 'Franchise Partner',
      franchise: 'Franchise Partner'
    };
    return labels[role] || role;
  };

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
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
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500 mt-1">Manage employee accounts and permissions</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add New User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-6">
            {/* Total Users */}
            <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Users</p>
              </div>
            </div>
            
            {/* Role Stats */}
            <div className="flex flex-wrap items-center gap-4">
              {Object.entries(stats.byRole).map(([role, count]) => {
                const roleInfo = USER_ROLES[role] || {
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
              <option value="admin">Super Admin</option>
              <option value="operations_manager">Operations Manager</option>
              <option value="franchise_partner">FP User</option>
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

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">User ID</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">User</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Role</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Password</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Contact</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => {
              const roleInfo = USER_ROLES[user.role] || {
                label: user.role,
                textColor: 'text-gray-600',
                bgColor: 'bg-gray-50'
              };
              const Icon = getRoleIcon(user.role);
              const isFP = user.role === 'franchise_partner' || user.role === 'franchise';
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">
                      {user.userId || user.id}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${roleInfo.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-xs font-semibold ${roleInfo.textColor}`}>
                          {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate max-w-[100px]">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${roleInfo.bgColor} ${roleInfo.textColor}`}>
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[80px]">{getRoleLabel(user.role)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                    {user.visiblePassword ? (
                      <div className="flex items-center gap-1">
                        <code className={`text-xs px-2 py-1 rounded font-mono ${
                          user.mustChangePassword 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {visiblePasswords[user.id] ? user.visiblePassword : '••••••••'}
                        </code>
                        <button
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title={visiblePasswords[user.id] ? 'Hide password' : 'Show password'}
                        >
                          {visiblePasswords[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {user.mustChangePassword && (
                          <span className="text-[10px] text-amber-600 font-medium">(Temp)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Changed by user</span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap hidden md:table-cell">
                    <div className="space-y-0.5">
                      <p className="text-xs text-gray-600 flex items-center gap-1 truncate max-w-[150px]">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </p>
                      {user.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {user.phone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {user.isSuperAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 cursor-not-allowed opacity-75">
                        <ToggleRight className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          user.status === 'active'
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {user.status === 'active' ? (
                          <>
                            <ToggleRight className="w-3.5 h-3.5" />
                            Active
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-3.5 h-3.5" />
                            Inactive
                          </>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setViewingUser(user)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Hide delete button for Super Admins */}
                      {!user.isSuperAdmin && (
                        <button
                          onClick={() => setShowDeleteConfirm(user)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {user.isSuperAdmin && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full font-medium" title="Super Admin - Cannot be deleted">
                          Protected
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No users found</p>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Role Selection - FIRST at top-left */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                  required
                >
                  {Object.keys(USER_ROLES)
                    .filter(role => USER_MANAGEMENT_ROLES.includes(role))
                    .map(role => (
                      <option key={role} value={role}>{getRoleLabel(role)}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  {USER_ROLES[formData.role]?.description || 'Select a role to see description'}
                </p>
              </div>

              {/* Basic Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {isFranchisePartner ? 'Owner Name *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder={isFranchisePartner ? "Owner's Full Name" : "John Doe"}
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
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, phone: value });
                      }}
                      maxLength={10}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Password - Only show for editing */}
              {editingUser ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Password (leave blank to keep current)
                  </label>
                  <div className="relative max-w-xs">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Email Notification</p>
                      <p className="text-xs text-blue-600 mt-1">
                        A temporary password will be auto-generated and sent to the user's email address. 
                        The user will be required to set their own password on first login.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Franchise Partner Specific Fields */}
              {isFranchisePartner && (
                <>
                  {/* Franchise Partner Details */}
                  <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary-600" />
                      Franchise Partner Details
                    </h4>
                    <p className="text-xs text-gray-500 mb-3 bg-blue-50 p-2 rounded">
                      User ID will be auto-generated (XFP001, XFP002...)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Franchise Name *</label>
                        <input
                          type="text"
                          value={formData.franchiseName}
                          onChange={(e) => setFormData({ ...formData, franchiseName: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="ABC Franchise"
                          required={isFranchisePartner}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="Company Pvt Ltd"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">GST Number</label>
                        <input
                          type="text"
                          value={formData.gstNumber}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            if (value.length <= 15) {
                              setFormData({ ...formData, gstNumber: value });
                            }
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                          pattern="[A-Z0-9]{15}"
                        />
                        {formData.gstNumber && formData.gstNumber.length !== 15 && (
                          <p className="text-xs text-red-500 mt-1">GST must be 15 characters</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">PAN Number</label>
                        <input
                          type="text"
                          value={formData.panNumber}
                          onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="ABCDE1234F"
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Owner Name, Phone Number, and Email are captured in the Basic Information section above.
                    </p>
                  </div>

                  {/* Address Details */}
                  <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-teal-600" />
                      Address Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="123, Street Name, Area"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="Mumbai"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="Maharashtra"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                        <input
                          type="text"
                          value={formData.pincode}
                          onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="400001"
                          maxLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bank & Commission Details */}
                  <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      Bank & Commission Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={formData.bankName}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="HDFC Bank"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                        <input
                          type="text"
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, '') })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="1234567890123456"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          value={formData.ifscCode}
                          onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="HDFC0001234"
                          maxLength={11}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Commission Rate (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.commissionRate}
                            onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none pr-8"
                            placeholder="10"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingUser ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingUser ? 'Update User' : 'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm p-6 shadow-xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? 
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
              <button
                onClick={() => setViewingUser(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* User Header */}
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 ${USER_ROLES[viewingUser.role]?.bgColor || 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                  <span className={`text-lg font-semibold ${USER_ROLES[viewingUser.role]?.textColor || 'text-gray-600'}`}>
                    {viewingUser.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {viewingUser.userId || viewingUser.id}
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">{viewingUser.name}</h4>
                  <p className="text-sm text-gray-500">@{viewingUser.username}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded text-xs font-medium ${USER_ROLES[viewingUser.role]?.bgColor || 'bg-gray-100'} ${USER_ROLES[viewingUser.role]?.textColor || 'text-gray-600'}`}>
                    {getRoleLabel(viewingUser.role)}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-900 mb-3">Contact Information</h5>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {viewingUser.email}
                  </p>
                  {viewingUser.phone && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {viewingUser.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Password Info */}
              <div className={`rounded-lg p-4 ${viewingUser.mustChangePassword ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-500" />
                  Password Information
                </h5>
                <div className="space-y-2">
                  {viewingUser.visiblePassword ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">Current Password:</span>
                      <div className="flex items-center gap-2">
                        <code className={`text-sm px-3 py-1.5 rounded font-mono ${
                          viewingUser.mustChangePassword 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}>
                          {visiblePasswords[`view_${viewingUser.id}`] ? viewingUser.visiblePassword : '••••••••••••'}
                        </code>
                        <button
                          onClick={() => setVisiblePasswords(prev => ({
                            ...prev,
                            [`view_${viewingUser.id}`]: !prev[`view_${viewingUser.id}`]
                          }))}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded transition-colors"
                          title={visiblePasswords[`view_${viewingUser.id}`] ? 'Hide password' : 'Show password'}
                        >
                          {visiblePasswords[`view_${viewingUser.id}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">User has set their own password</p>
                  )}
                  {viewingUser.mustChangePassword && (
                    <p className="text-xs text-amber-700 flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      This is a temporary password. User must change it on first login.
                    </p>
                  )}
                </div>
              </div>

              {/* Franchise Partner Details */}
              {(viewingUser.role === 'franchise_partner' || viewingUser.role === 'franchise') && (
                <>
                  {/* Company Details Section */}
                  <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
                    <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      Franchise Partner Details
                    </h5>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">User ID</p>
                        <p className="text-gray-900 font-medium font-mono">{viewingUser.userId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Franchise Name</p>
                        <p className="text-gray-900 font-medium">{viewingUser.franchiseName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Owner Name</p>
                        <p className="text-gray-900 font-medium">{viewingUser.name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Company Name</p>
                        <p className="text-gray-900 font-medium">{viewingUser.companyName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">GST Number</p>
                        <p className="text-gray-900 font-medium font-mono text-xs">{viewingUser.gstNumber || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">PAN Number</p>
                        <p className="text-gray-900 font-medium font-mono text-xs">{viewingUser.panNumber || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Address Details Section */}
                  {(viewingUser.address || viewingUser.city || viewingUser.state || viewingUser.pincode) && (
                    <div className="bg-teal-50/50 rounded-lg p-4 border border-teal-100">
                      <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-600" />
                        Address Details
                      </h5>
                      <div className="text-sm">
                        {viewingUser.address && (
                          <p className="text-gray-700">{viewingUser.address}</p>
                        )}
                        <div className="grid grid-cols-3 gap-3 mt-2">
                          <div>
                            <p className="text-gray-500 text-xs">City</p>
                            <p className="text-gray-900 font-medium">{viewingUser.city || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">State</p>
                            <p className="text-gray-900 font-medium">{viewingUser.state || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs">Pincode</p>
                            <p className="text-gray-900 font-medium">{viewingUser.pincode || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank & Commission Details Section */}
                  {(viewingUser.bankName || viewingUser.accountNumber || viewingUser.ifscCode || viewingUser.commissionRate) && (
                    <div className="bg-indigo-50/50 rounded-lg p-4 border border-indigo-100">
                      <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-indigo-600" />
                        Bank & Commission Details
                      </h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Bank Name</p>
                          <p className="text-gray-900 font-medium">{viewingUser.bankName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Account Number</p>
                          <p className="text-gray-900 font-medium font-mono text-xs">
                            {viewingUser.accountNumber ? `****${viewingUser.accountNumber.slice(-4)}` : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">IFSC Code</p>
                          <p className="text-gray-900 font-medium font-mono text-xs">{viewingUser.ifscCode || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Commission Rate</p>
                          <p className="text-gray-900 font-medium flex items-center gap-1">
                            {viewingUser.commissionRate ? `${viewingUser.commissionRate}%` : '-'}
                            {viewingUser.commissionRate && <Percent className="w-3 h-3 text-gray-400" />}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Status & Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    viewingUser.status === 'active'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {viewingUser.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setViewingUser(null);
                      handleOpenModal(viewingUser);
                    }}
                    className="px-3 py-1.5 text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => setViewingUser(null)}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
