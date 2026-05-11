// User Store - Manages user authentication and roles
// Roles: Admin, Operations Manager, Franchise Partner
// NOTE: In production, authentication should be handled via backend API

const USER_STORAGE_KEY = 'pm_users';
const CURRENT_USER_KEY = 'pm_current_user';
const DEMO_MODE_KEY = 'pm_demo_mode';

// Demo user templates (no passwords stored - demo login is role-based)
const DEMO_USER_TEMPLATES = {
  Admin: {
    id: 'demo_admin',
    username: 'demo_admin',
    name: 'Demo Administrator',
    email: 'demo.admin@example.com',
    role: 'Admin',
    phone: '+91 0000000000',
    status: 'active',
    avatar: null,
    permissions: ['all'],
    isDemo: true
  },
  'Operations Manager': {
    id: 'demo_ops',
    username: 'demo_opsmanager',
    name: 'Demo Operations Manager',
    email: 'demo.ops@example.com',
    role: 'Operations Manager',
    phone: '+91 0000000001',
    status: 'active',
    avatar: null,
    permissions: ['view_properties', 'manage_vendors', 'manage_employees', 'view_reports', 'manage_work_orders'],
    isDemo: true
  },
  'Franchise Partner': {
    id: 'demo_franchise',
    username: 'demo_franchise',
    name: 'Demo Franchise Partner',
    email: 'demo.franchise@example.com',
    role: 'Franchise Partner',
    phone: '+91 0000000002',
    status: 'active',
    avatar: null,
    permissions: ['view_properties', 'view_reports', 'view_vendors'],
    isDemo: true
  }
};

// Default users array (populated from localStorage or empty for production)
const DEFAULT_USERS = [];

// Role definitions with colors and icons
export const USER_ROLES = {
  Admin: {
    label: 'Administrator',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Full system access with all permissions'
  },
  'Operations Manager': {
    label: 'Operations Manager',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Manage operations, vendors, and employees'
  },
  'Franchise Partner': {
    label: 'Franchise Partner',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Partner with limited access to view operations'
  }
};

// Version key to track role structure changes
const USER_VERSION_KEY = 'pm_users_version';
const CURRENT_VERSION = '2'; // Increment this when roles change

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

// Authenticate user via backend API
export const authenticateUser = async (username, password) => {
  try {
    // In production, authenticate via backend API
    const response = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      const user = {
        id: result.data.user?.id || result.data.id,
        username: result.data.user?.username || result.data.username,
        name: `${result.data.user?.firstName || result.data.firstName || ''} ${result.data.user?.lastName || result.data.lastName || ''}`.trim(),
        email: result.data.user?.email || result.data.email,
        role: result.data.user?.role || result.data.role,
        status: 'active',
        permissions: result.data.user?.permissions || ['all']
      };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return { success: true, user };
    }
    
    return { success: false, message: result.message || 'Invalid credentials' };
  } catch (error) {
    // Fallback: check localStorage users (for offline/demo scenarios without backend)
    const users = getUsers();
    const user = users.find(
      u => (u.username === username || u.email === username) && u.status === 'active'
    );
    
    if (user && user.isDemo) {
      // Demo users don't require password verification in offline mode
      const { ...userWithoutSensitive } = user;
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutSensitive));
      return { success: true, user: userWithoutSensitive };
    }
    
    return { success: false, message: 'Unable to authenticate. Please check your connection.' };
  }
};

// Demo login by role (no password required - for demo/testing purposes only)
export const demoLoginByRole = (role) => {
  const demoUser = DEMO_USER_TEMPLATES[role];
  if (!demoUser) {
    return { success: false, message: 'Invalid demo role' };
  }
  
  const userWithTimestamp = {
    ...demoUser,
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithTimestamp));
  localStorage.setItem(DEMO_MODE_KEY, 'true');
  return { success: true, user: userWithTimestamp };
};

// Get current logged in user
export const getCurrentUser = () => {
  const userData = localStorage.getItem(CURRENT_USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

// Logout user
export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(DEMO_MODE_KEY);
};

// Check if in demo mode
export const isDemoMode = () => {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
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
  
  const newUser = {
    id: `usr_${Date.now()}`,
    ...userData,
    status: 'active',
    createdAt: new Date().toISOString(),
    avatar: null
  };
  
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
  const admins = users.filter(u => u.role === 'Admin');
  if (users[index].role === 'Admin' && admins.length === 1) {
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
  if (currentUser.role === 'Admin' || currentUser.permissions?.includes('all')) {
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
      Admin: users.filter(u => u.role === 'Admin').length,
      'Operations Manager': users.filter(u => u.role === 'Operations Manager').length,
      'Franchise Partner': users.filter(u => u.role === 'Franchise Partner').length
    }
  };
};
