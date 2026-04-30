import { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Shield, Briefcase, UserCheck, 
  Edit2, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff,
  Phone, Mail, Calendar, ChevronDown, Filter,
  UserPlus, CheckCircle, XCircle, MoreVertical
} from 'lucide-react';
import { 
  getUsers, addUser, updateUser, deleteUser, toggleUserStatus,
  USER_ROLES, getRoleStats 
} from '../utils/userStore';

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

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role: 'Executive'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter, statusFilter]);

  const loadUsers = () => {
    const loadedUsers = getUsers();
    setUsers(loadedUsers);
    setStats(getRoleStats());
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
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      phone: '',
      role: 'Executive'
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingUser) {
      const updates = { ...formData };
      if (!updates.password) delete updates.password;
      
      const result = updateUser(editingUser.id, updates);
      if (result.success) {
        showToast('User updated successfully');
        loadUsers();
        setShowModal(false);
        resetForm();
      } else {
        showToast(result.message, 'error');
      }
    } else {
      if (!formData.password) {
        showToast('Password is required for new users', 'error');
        return;
      }
      
      const result = addUser(formData);
      if (result.success) {
        showToast('User created successfully');
        loadUsers();
        setShowModal(false);
        resetForm();
      } else {
        showToast(result.message, 'error');
      }
    }
  };

  const handleToggleStatus = (user) => {
    const result = toggleUserStatus(user.id);
    if (result.success) {
      showToast(`User ${result.user.status === 'active' ? 'activated' : 'deactivated'}`);
      loadUsers();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleDelete = (user) => {
    const result = deleteUser(user.id);
    if (result.success) {
      showToast('User deleted successfully');
      loadUsers();
      setShowDeleteConfirm(null);
    } else {
      showToast(result.message, 'error');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Admin': return Shield;
      case 'Manager': return Briefcase;
      case 'Supervisor': return UserCheck;
      default: return Users;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500 mt-1">Manage employee accounts and permissions</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5"
          >
            <UserPlus className="w-5 h-5" />
            Add New User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>
          {Object.entries(stats.byRole).map(([role, count]) => {
            const roleInfo = USER_ROLES[role];
            const Icon = getRoleIcon(role);
            return (
              <div key={role} className={`bg-white rounded-xl p-5 border ${roleInfo.borderColor} shadow-sm`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{role}s</p>
                    <p className="text-3xl font-bold text-gray-900">{count}</p>
                  </div>
                  <div className={`w-12 h-12 ${roleInfo.bgColor} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${roleInfo.textColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Executive">Executive</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => {
              const roleInfo = USER_ROLES[user.role];
              const Icon = getRoleIcon(user.role);
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${roleInfo.bgColor} rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-bold ${roleInfo.textColor}`}>
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${roleInfo.bgColor} ${roleInfo.textColor}`}>
                      <Icon className="w-3 h-3" />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </p>
                      {user.phone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {user.phone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <>
                          <ToggleRight className="w-4 h-4" />
                          Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4" />
                          Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(user)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="johndoe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none pr-12"
                    placeholder="••••••••"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  >
                    {Object.keys(USER_ROLES).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2.5 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete User</h3>
              <p className="text-gray-500 mt-2">
                Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? 
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-6 py-2.5 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700"
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

export default UserManagement;
