// User Store - Manages user authentication and roles
// Roles: Admin, Operations Manager, Franchise Partner

const USER_STORAGE_KEY = 'pm_users';
const CURRENT_USER_KEY = 'pm_current_user';

// Default users with different roles
const DEFAULT_USERS = [
  {
    id: 'usr_001',
    username: 'admin',
    password: 'admin123',
    name: 'System Administrator',
    email: 'admin@propertymanagement.com',
    role: 'Admin',
    phone: '+91 9876543210',
    status: 'active',
    createdAt: new Date().toISOString(),
    avatar: null,
    permissions: ['all']
  },
  {
    id: 'usr_002',
    username: 'opsmanager1',
    password: 'ops123',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@propertymanagement.com',
    role: 'Operations Manager',
    phone: '+91 9876543211',
    status: 'active',
    createdAt: new Date().toISOString(),
    avatar: null,
    permissions: ['view_properties', 'manage_vendors', 'manage_employees', 'view_reports', 'manage_work_orders']
  },
  {
    id: 'usr_003',
    username: 'franchise1',
    password: 'franchise123',
    name: 'Priya Patel',
    email: 'priya.patel@propertymanagement.com',
    role: 'Franchise Partner',
    phone: '+91 9876543212',
    status: 'active',
    createdAt: new Date().toISOString(),
    avatar: null,
    permissions: ['view_properties', 'view_reports', 'view_vendors']
  }
];

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

// Authenticate user
export const authenticateUser = (username, password) => {
  const users = getUsers();
  const user = users.find(
    u => (u.username === username || u.email === username) && u.password === password && u.status === 'active'
  );
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }
  
  return { success: false, message: 'Invalid username or password' };
};

// Get current logged in user
export const getCurrentUser = () => {
  const userData = localStorage.getItem(CURRENT_USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

// Logout user
export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
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
