// User Store - Manages user authentication and roles
// Roles: Admin, Operations Manager, Franchise Partner
// NOTE: In production, authentication should be handled via backend API

const USER_STORAGE_KEY = 'pm_users';
const CURRENT_USER_KEY = 'pm_current_user';
const AUTH_TOKEN_KEY = 'pm_auth_token';

// Default users array (populated from localStorage or empty for production)
const DEFAULT_USERS = [];

// Role definitions with colors and icons (using backend role keys)
export const USER_ROLES = {
  admin: {
    label: 'Super Admin',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Full system access with all permissions'
  },
  operations_manager: {
    label: 'Operations Manager',
    color: 'bg-purple-500',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Full system access with all permissions (same as Admin)'
  },
  franchise_partner: {
    label: 'Franchise Partner',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Franchise partner with scoped access'
  }
};

// Version key to track role structure changes
const USER_VERSION_KEY = 'pm_users_version';
const CURRENT_VERSION = '3'; // Increment this when roles change - v3: cleared test data

// Initialize users in localStorage
export const initializeUsers = () => {
  const storedVersion = localStorage.getItem(USER_VERSION_KEY);
  const existingUsers = localStorage.getItem(USER_STORAGE_KEY);
  
  // Reset users if version changed or no users exist
  if (!existingUsers || storedVersion !== CURRENT_VERSION) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    localStorage.setItem(USER_VERSION_KEY, CURRENT_VERSION);
  }
};

// Get all users
export const getUsers = () => {
  initializeUsers();
  return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '[]');
};

// Get users by role
export const getUsersByRole = (role) => {
  const users = getUsers();
  return users.filter(user => user.role === role);
};

// Get user by ID
export const getUserById = (id) => {
  const users = getUsers();
  return users.find(user => user.id === id);
};

// Authenticate user via backend API (with auto role detection)
export const authenticateUser = async (username, password, role = null) => {
  // Validate inputs
  if (!username || !password) {
    return { success: false, message: 'Username and password are required' };
  }

  try {
    // Authenticate via unified employee login API
    const response = await fetch('/api/employee/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, message: errorData.message || `Login failed (${response.status})` };
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      const userRole = result.data.user?.role || result.data.role;
      
      const user = {
        id: result.data.user?.id || result.data.id,
        username: result.data.user?.username || result.data.username,
        name: `${result.data.user?.firstName || result.data.firstName || ''} ${result.data.user?.lastName || result.data.lastName || ''}`.trim(),
        email: result.data.user?.email || result.data.email,
        role: userRole,
        status: 'active',
        permissions: result.data.user?.permissions || ['all'],
        franchisePartnerId: result.data.user?.franchisePartnerId,
        managerId: result.data.user?.managerId,
        coordinatorId: result.data.user?.coordinatorId,
        supervisorId: result.data.user?.supervisorId,
        executiveId: result.data.user?.executiveId
      };
      
      // Store token and user data
      if (result.data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, result.data.token);
      }
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      
      // Return user with detected portal type
      const portalType = getPortalTypeFromRole(userRole);
      return { success: true, user: { ...user, portal: portalType } };
    }
    
    return { success: false, message: result.message || 'Invalid credentials' };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, message: 'Unable to connect to server. Please check if the backend is running.' };
  }
};

// Map role to portal type - Each role gets its dedicated portal
export const getPortalTypeFromRole = (role) => {
  const rolePortalMap = {
    'admin': 'employee',
    'operations_manager': 'employee',
    'franchise_partner': 'franchise',
    'franchise': 'franchise',
    'manager': 'manager',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor',
    'executive': 'executive',
    'fp_admin': 'franchise',
    'fp_manager': 'franchise',
    'fp_supervisor': 'franchise',
    'fp_executive': 'franchise'
  };
  return rolePortalMap[role] || 'employee';
};

// Get current logged in user
export const getCurrentUser = () => {
  const userData = localStorage.getItem(CURRENT_USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

// Logout user
export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

// Get auth token
export const getAuthToken = () => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

// Generate unique User ID based on role
const generateUserId = (role) => {
  const prefixes = {
    admin: 'ADM',
    operations_manager: 'OPM',
    franchise_partner: 'FRP',
    franchise: 'FRP'
  };
  const prefix = prefixes[role] || 'USR';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
};

// Generate temporary password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Add new user
export const addUser = (userData) => {
  const users = getUsers();
  
  // Check if username or email already exists
  if (users.some(u => u.username === userData.username)) {
    return { success: false, message: 'Username already exists' };
  }
  if (users.some(u => u.email === userData.email)) {
    return { success: false, message: 'Email already exists' };
  }
  
  // Generate unique User ID and temp password
  const userId = generateUserId(userData.role);
  const tempPassword = generateTempPassword();
  
  const newUser = {
    id: `usr_${Date.now()}`,
    userId: userId,
    ...userData,
    password: tempPassword, // Store temp password (in real app, this would be hashed)
    mustChangePassword: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    avatar: null
  };
  
  // Add Franchise Partner specific fields if applicable
  if (userData.role === 'franchise_partner' || userData.role === 'franchise') {
    newUser.franchiseId = userData.franchiseId || '';
    newUser.franchiseName = userData.franchiseName || '';
    newUser.companyName = userData.companyName || '';
    newUser.gstNumber = userData.gstNumber || '';
    newUser.panNumber = userData.panNumber || '';
    newUser.address = userData.address || '';
    newUser.city = userData.city || '';
    newUser.state = userData.state || '';
    newUser.pincode = userData.pincode || '';
    newUser.bankName = userData.bankName || '';
    newUser.accountNumber = userData.accountNumber || '';
    newUser.ifscCode = userData.ifscCode || '';
    newUser.commissionRate = userData.commissionRate || 0;
  }
  
  users.push(newUser);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
  return { success: true, user: newUser };
};

// Update user
export const updateUser = (id, updates) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return { success: false, message: 'User not found' };
  }
  
  // Check for duplicate username/email
  if (updates.username && users.some(u => u.id !== id && u.username === updates.username)) {
    return { success: false, message: 'Username already exists' };
  }
  if (updates.email && users.some(u => u.id !== id && u.email === updates.email)) {
    return { success: false, message: 'Email already exists' };
  }
  
  users[index] = { ...users[index], ...updates };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
  
  // Update current user if they updated their own profile
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === id) {
    const { password: _, ...userWithoutPassword } = users[index];
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
  }
  
  return { success: true, user: users[index] };
};

// Delete user
export const deleteUser = (id) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return { success: false, message: 'User not found' };
  }
  
  // Prevent deleting the last admin
  const admins = users.filter(u => u.role === 'admin');
  if (users[index].role === 'admin' && admins.length === 1) {
    return { success: false, message: 'Cannot delete the last administrator' };
  }
  
  users.splice(index, 1);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
  return { success: true };
};

// Toggle user status
export const toggleUserStatus = (id) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return { success: false, message: 'User not found' };
  }
  
  users[index].status = users[index].status === 'active' ? 'inactive' : 'active';
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
  return { success: true, user: users[index] };
};

// Check if user has permission
export const hasPermission = (permission) => {
  const currentUser = getCurrentUser();
  if (!currentUser) return false;
  
  // Admins have all permissions
  if (currentUser.role === 'admin' || currentUser.permissions?.includes('all')) {
    return true;
  }
  
  return currentUser.permissions?.includes(permission) || false;
};

// Get role statistics
export const getRoleStats = () => {
  const users = getUsers();
  return {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    byRole: {
      admin: users.filter(u => u.role === 'admin').length,
      operations_manager: users.filter(u => u.role === 'operations_manager').length,
      franchise_partner: users.filter(u => u.role === 'franchise_partner' || u.role === 'franchise').length
    }
  };
};
