// Employee store – manages employees in localStorage (can be migrated to backend later)

const EMPLOYEE_STORAGE_KEY = 'xland_employees';
const EMPLOYEE_NOTIFICATION_KEY = 'xland_employee_notifications';

// Generate sequential unique Employee ID (numeric-only, continuous sequence for all roles)
// Format: 001, 002, 003...
const generateEmployeeId = () => {
  try {
    // Get all employees to find the highest sequence number
    const data = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    const employees = data ? JSON.parse(data) : [];
    
    // Find max sequence from all employees with numeric IDs
    const numericIds = employees
      .filter(e => e.employeeId && /^\d+$/.test(e.employeeId))
      .map(e => parseInt(e.employeeId, 10))
      .filter(n => !isNaN(n));
    
    const maxSequence = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const nextSequence = maxSequence + 1;
    
    // Format with leading zeros (3 digits minimum, expandable)
    return String(nextSequence).padStart(3, '0');
  } catch (error) {
    console.error('Error generating employee ID:', error);
    // Fallback to timestamp-based if localStorage query fails
    return String(Date.now()).slice(-6);
  }
};

// Get all employees
export const getEmployees = (status = 'active') => {
  try {
    const data = localStorage.getItem(EMPLOYEE_STORAGE_KEY);
    const employees = data ? JSON.parse(data) : [];
    if (status === 'all') return employees;
    return employees.filter(e => e.status === status);
  } catch {
    return [];
  }
};

// Get employee by ID
export const getEmployeeById = (id) => {
  const employees = getEmployees('all');
  return employees.find(e => e.id === id || e.employeeId === id);
};

// Get employees by zone
export const getEmployeesByZone = (zoneName) => {
  const employees = getEmployees('active');
  return employees.filter(e => 
    e.assignedZones === 'all' || 
    (Array.isArray(e.assignedZones) && e.assignedZones.includes(zoneName))
  );
};

// Check for duplicate employee (by email, phone, or username)
export const checkDuplicateEmployee = (email, phone, usernameOrAadhaar, excludeId = null) => {
  const employees = getEmployees('all');
  
  for (const emp of employees) {
    if (excludeId && (emp.id === excludeId || emp.employeeId === excludeId)) continue;
    
    if (emp.email && email && emp.email.toLowerCase() === email.toLowerCase()) {
      return { isDuplicate: true, field: 'email', message: 'An employee with this email already exists' };
    }
    if (emp.phone && phone && emp.phone === phone) {
      return { isDuplicate: true, field: 'phone', message: 'An employee with this phone number already exists' };
    }
    // Check username (new field)
    if (emp.username && usernameOrAadhaar && emp.username.toLowerCase() === usernameOrAadhaar.toLowerCase()) {
      return { isDuplicate: true, field: 'username', message: 'An employee with this username already exists' };
    }
    // Legacy: Check aadhaar if it exists
    if (emp.aadhaar && usernameOrAadhaar && emp.aadhaar === usernameOrAadhaar) {
      return { isDuplicate: true, field: 'aadhaar', message: 'An employee with this Aadhaar number already exists' };
    }
  }
  
  return { isDuplicate: false };
};

// Create a new employee
export const createEmployee = (employeeData) => {
  const employees = getEmployees('all');
  
  // Check for duplicates (email, phone, username)
  const duplicateCheck = checkDuplicateEmployee(
    employeeData.email,
    employeeData.phone || '',
    employeeData.username || employeeData.aadhaar || ''
  );
  
  if (duplicateCheck.isDuplicate) {
    return { success: false, message: duplicateCheck.message, field: duplicateCheck.field };
  }
  
  const newEmployee = {
    id: `emp_${Date.now()}`,
    employeeId: generateEmployeeId(), // Auto-generated: EMP001, EMP002...
    name: employeeData.name || employeeData.fullName,
    fullName: employeeData.fullName || employeeData.name,
    username: employeeData.username || '',
    phone: employeeData.phone || '',
    countryCode: employeeData.countryCode || '+91',
    email: employeeData.email,
    role: employeeData.role || 'executive',
    roleLabel: employeeData.roleLabel || 'Executive',
    aadhaar: employeeData.aadhaar || '', // Legacy field - kept for backward compatibility
    assignedZones: employeeData.assignedZones || [], // 'all' or array of zone names
    status: employeeData.status || 'active',
    passwordChangeRequired: employeeData.passwordChangeRequired || true,
    createdBy: employeeData.createdBy || 'system',
    createdAt: new Date().toISOString(),
  };
  
  employees.push(newEmployee);
  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employees));
  
  // Add notification
  addEmployeeNotification({
    id: Date.now().toString(),
    type: 'employee_created',
    title: 'New Employee Added',
    message: `${newEmployee.name} (${newEmployee.employeeId}) has been added to the system.`,
    employeeId: newEmployee.employeeId,
    timestamp: new Date().toISOString(),
    read: false,
  });
  
  return { success: true, data: newEmployee };
};

// Update an employee
export const updateEmployee = (id, updates) => {
  const employees = getEmployees('all');
  const index = employees.findIndex(e => e.id === id || e.employeeId === id);
  
  if (index === -1) {
    return { success: false, message: 'Employee not found' };
  }
  
  // Check for duplicates if updating unique fields
  if (updates.email || updates.phone || updates.aadhaar) {
    const duplicateCheck = checkDuplicateEmployee(
      updates.email || employees[index].email,
      updates.phone || employees[index].phone,
      updates.aadhaar || employees[index].aadhaar,
      id
    );
    
    if (duplicateCheck.isDuplicate) {
      return { success: false, message: duplicateCheck.message, field: duplicateCheck.field };
    }
  }
  
  employees[index] = { ...employees[index], ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employees));
  
  return { success: true, data: employees[index] };
};

// Deactivate an employee (soft delete)
export const deactivateEmployee = (id) => {
  return updateEmployee(id, { status: 'inactive' });
};

// Reactivate an employee
export const reactivateEmployee = (id) => {
  return updateEmployee(id, { status: 'active' });
};

// Delete an employee permanently
export const deleteEmployee = (id) => {
  const employees = getEmployees('all');
  const filtered = employees.filter(e => e.id !== id && e.employeeId !== id);
  localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(filtered));
  return { success: true };
};

// Update employee zones
export const updateEmployeeZones = (id, zones) => {
  return updateEmployee(id, { assignedZones: zones });
};

// Get all zones that are already assigned to employees
export const getAssignedZones = (excludeEmployeeId = null) => {
  const employees = getEmployees('active');
  const assignedZones = new Set();
  
  for (const emp of employees) {
    // Skip the employee we're excluding (useful when editing)
    if (excludeEmployeeId && (emp.id === excludeEmployeeId || emp.employeeId === excludeEmployeeId)) {
      continue;
    }
    
    // If any employee has 'all' zones, all zones are assigned
    if (emp.assignedZones === 'all') {
      return { hasAllZonesEmployee: true, zones: [] };
    }
    
    // Add individual zones
    if (Array.isArray(emp.assignedZones)) {
      emp.assignedZones.forEach(zone => assignedZones.add(zone));
    }
  }
  
  return { hasAllZonesEmployee: false, zones: Array.from(assignedZones) };
};

// Get available zones for assignment (zones not assigned to other employees)
export const getAvailableZonesForEmployee = (allZones, excludeEmployeeId = null) => {
  const { hasAllZonesEmployee, zones: assignedZones } = getAssignedZones(excludeEmployeeId);
  
  // If someone has all zones assigned, no zones are available
  if (hasAllZonesEmployee) {
    return [];
  }
  
  // Return zones that are not already assigned
  return allZones.filter(zone => !assignedZones.includes(zone.name));
};

// ============================================
// Notifications
// ============================================

export const getEmployeeNotifications = () => {
  try {
    const data = localStorage.getItem(EMPLOYEE_NOTIFICATION_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addEmployeeNotification = (notification) => {
  const notifications = getEmployeeNotifications();
  notifications.unshift(notification);
  if (notifications.length > 50) notifications.length = 50;
  localStorage.setItem(EMPLOYEE_NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const markAllEmployeeNotificationsRead = () => {
  const notifications = getEmployeeNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(EMPLOYEE_NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const getEmployeeUnreadCount = () => {
  return getEmployeeNotifications().filter(n => !n.read).length;
};
