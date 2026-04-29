// Employee store – manages employees in localStorage (can be migrated to backend later)

const EMPLOYEE_STORAGE_KEY = 'xland_employees';
const EMPLOYEE_NOTIFICATION_KEY = 'xland_employee_notifications';

// Generate unique employee ID
const generateEmployeeId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EMP-${timestamp}-${random}`;
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

// Check for duplicate employee (by email, phone, or Aadhaar)
export const checkDuplicateEmployee = (email, phone, aadhaar, excludeId = null) => {
  const employees = getEmployees('all');
  
  for (const emp of employees) {
    if (excludeId && (emp.id === excludeId || emp.employeeId === excludeId)) continue;
    
    if (emp.email.toLowerCase() === email.toLowerCase()) {
      return { isDuplicate: true, field: 'email', message: 'An employee with this email already exists' };
    }
    if (emp.phone === phone) {
      return { isDuplicate: true, field: 'phone', message: 'An employee with this phone number already exists' };
    }
    if (emp.aadhaar === aadhaar) {
      return { isDuplicate: true, field: 'aadhaar', message: 'An employee with this Aadhaar number already exists' };
    }
  }
  
  return { isDuplicate: false };
};

// Create a new employee
export const createEmployee = (employeeData) => {
  const employees = getEmployees('all');
  
  // Check for duplicates
  const duplicateCheck = checkDuplicateEmployee(
    employeeData.email,
    employeeData.phone,
    employeeData.aadhaar
  );
  
  if (duplicateCheck.isDuplicate) {
    return { success: false, message: duplicateCheck.message, field: duplicateCheck.field };
  }
  
  const newEmployee = {
    id: `emp_${Date.now()}`,
    employeeId: generateEmployeeId(),
    name: employeeData.name,
    phone: employeeData.phone,
    countryCode: employeeData.countryCode || '+91',
    email: employeeData.email,
    aadhaar: employeeData.aadhaar,
    assignedZones: employeeData.assignedZones, // 'all' or array of zone names
    status: 'active',
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
