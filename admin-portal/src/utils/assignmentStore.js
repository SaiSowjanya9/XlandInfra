// Assignment store – manages vendor and employee assignments to properties

const VENDOR_ASSIGNMENT_KEY = 'xland_vendor_assignments';
const EMPLOYEE_ASSIGNMENT_KEY = 'xland_employee_assignments';

// ============================================
// Vendor Assignments
// ============================================

// Get all vendor assignments
export const getVendorAssignments = (status = 'active') => {
  try {
    const data = localStorage.getItem(VENDOR_ASSIGNMENT_KEY);
    const assignments = data ? JSON.parse(data) : [];
    if (status === 'all') return assignments;
    return assignments.filter(a => a.status === status);
  } catch {
    return [];
  }
};

// Get vendor assignments by property
export const getVendorAssignmentsByProperty = (propertyId) => {
  return getVendorAssignments('active').filter(a => a.propertyId === propertyId);
};

// Get vendor assignments by vendor
export const getVendorAssignmentsByVendor = (vendorId) => {
  return getVendorAssignments('active').filter(a => a.vendorId === vendorId);
};

// Assign vendor to property
export const assignVendorToProperty = (assignmentData) => {
  const assignments = getVendorAssignments('all');
  
  // Check if this vendor is already assigned to this property
  const existing = assignments.find(a => 
    a.vendorId === assignmentData.vendorId && 
    a.propertyId === assignmentData.propertyId &&
    a.status === 'active'
  );
  
  if (existing) {
    return { success: false, message: 'This vendor is already assigned to this property' };
  }
  
  const newAssignment = {
    id: `va_${Date.now()}`,
    vendorId: assignmentData.vendorId,
    vendorName: assignmentData.vendorName,
    vendorPhone: assignmentData.vendorPhone,
    vendorEmail: assignmentData.vendorEmail,
    serviceType: assignmentData.serviceType,
    propertyId: assignmentData.propertyId,
    propertyName: assignmentData.propertyName,
    propertyZone: assignmentData.propertyZone,
    assignedBy: assignmentData.assignedBy || 'system',
    assignedDate: new Date().toISOString(),
    status: 'active',
  };
  
  assignments.push(newAssignment);
  localStorage.setItem(VENDOR_ASSIGNMENT_KEY, JSON.stringify(assignments));
  
  return { success: true, data: newAssignment };
};

// Remove vendor assignment
export const removeVendorAssignment = (assignmentId) => {
  const assignments = getVendorAssignments('all');
  const index = assignments.findIndex(a => a.id === assignmentId);
  
  if (index === -1) {
    return { success: false, message: 'Assignment not found' };
  }
  
  assignments[index].status = 'removed';
  assignments[index].removedAt = new Date().toISOString();
  localStorage.setItem(VENDOR_ASSIGNMENT_KEY, JSON.stringify(assignments));
  
  return { success: true };
};

// Reassign vendor (remove old, create new)
export const reassignVendor = (oldAssignmentId, newAssignmentData) => {
  const removeResult = removeVendorAssignment(oldAssignmentId);
  if (!removeResult.success) return removeResult;
  
  return assignVendorToProperty(newAssignmentData);
};

// ============================================
// Employee Assignments
// ============================================

// Get all employee assignments
export const getEmployeeAssignments = (status = 'active') => {
  try {
    const data = localStorage.getItem(EMPLOYEE_ASSIGNMENT_KEY);
    const assignments = data ? JSON.parse(data) : [];
    if (status === 'all') return assignments;
    return assignments.filter(a => a.status === status);
  } catch {
    return [];
  }
};

// Get employee assignments by property
export const getEmployeeAssignmentsByProperty = (propertyId) => {
  return getEmployeeAssignments('active').filter(a => a.propertyId === propertyId);
};

// Get employee assignments by employee
export const getEmployeeAssignmentsByEmployee = (employeeId) => {
  return getEmployeeAssignments('active').filter(a => a.employeeId === employeeId);
};

// Assign employee to property
export const assignEmployeeToProperty = (assignmentData) => {
  const assignments = getEmployeeAssignments('all');
  
  // Check if this employee is already assigned to this property
  const existing = assignments.find(a => 
    a.employeeId === assignmentData.employeeId && 
    a.propertyId === assignmentData.propertyId &&
    a.status === 'active'
  );
  
  if (existing) {
    return { success: false, message: 'This employee is already assigned to this property' };
  }
  
  const newAssignment = {
    id: `ea_${Date.now()}`,
    employeeId: assignmentData.employeeId,
    employeeName: assignmentData.employeeName,
    employeePhone: assignmentData.employeePhone,
    employeeEmail: assignmentData.employeeEmail,
    propertyId: assignmentData.propertyId,
    propertyName: assignmentData.propertyName,
    propertyZone: assignmentData.propertyZone,
    assignedBy: assignmentData.assignedBy || 'system',
    assignedDate: new Date().toISOString(),
    status: 'active',
  };
  
  assignments.push(newAssignment);
  localStorage.setItem(EMPLOYEE_ASSIGNMENT_KEY, JSON.stringify(assignments));
  
  return { success: true, data: newAssignment };
};

// Remove employee assignment
export const removeEmployeeAssignment = (assignmentId) => {
  const assignments = getEmployeeAssignments('all');
  const index = assignments.findIndex(a => a.id === assignmentId);
  
  if (index === -1) {
    return { success: false, message: 'Assignment not found' };
  }
  
  assignments[index].status = 'removed';
  assignments[index].removedAt = new Date().toISOString();
  localStorage.setItem(EMPLOYEE_ASSIGNMENT_KEY, JSON.stringify(assignments));
  
  return { success: true };
};

// Reassign employee
export const reassignEmployee = (oldAssignmentId, newAssignmentData) => {
  const removeResult = removeEmployeeAssignment(oldAssignmentId);
  if (!removeResult.success) return removeResult;
  
  return assignEmployeeToProperty(newAssignmentData);
};

// ============================================
// Utility Functions
// ============================================

// Get all assignments for a property (both vendors and employees)
export const getPropertyAssignments = (propertyId) => {
  return {
    vendors: getVendorAssignmentsByProperty(propertyId),
    employees: getEmployeeAssignmentsByProperty(propertyId),
  };
};

// Clear all assignments (for testing)
export const clearAllAssignments = () => {
  localStorage.removeItem(VENDOR_ASSIGNMENT_KEY);
  localStorage.removeItem(EMPLOYEE_ASSIGNMENT_KEY);
};

// ============================================
// Service-Wise Vendor Assignments (for Estimates)
// ============================================

const SERVICE_VENDOR_ASSIGNMENT_KEY = 'xland_service_vendor_assignments';

// Get all service-wise vendor assignments
export const getServiceVendorAssignments = (status = 'active') => {
  try {
    const data = localStorage.getItem(SERVICE_VENDOR_ASSIGNMENT_KEY);
    const assignments = data ? JSON.parse(data) : [];
    if (status === 'all') return assignments;
    return assignments.filter(a => a.status === status);
  } catch {
    return [];
  }
};

// Get service vendor assignments by property and estimate
export const getServiceVendorAssignmentsByEstimate = (propertyId, estimateId) => {
  return getServiceVendorAssignments('active').filter(
    a => a.propertyId === propertyId && a.estimateId === estimateId
  );
};

// Get service vendor assignments by property
export const getServiceVendorAssignmentsByProperty = (propertyId) => {
  return getServiceVendorAssignments('active').filter(a => a.propertyId === propertyId);
};

// Get service vendor assignments by vendor
export const getServiceVendorAssignmentsByVendor = (vendorId) => {
  return getServiceVendorAssignments('active').filter(a => a.vendorId === vendorId);
};

// Save service-wise vendor assignments for an estimate
// This saves/updates all service assignments for a property-estimate combination at once
export const saveServiceVendorAssignments = (propertyId, estimateId, serviceAssignments, propertyInfo = {}) => {
  try {
    let assignments = getServiceVendorAssignments('all');
    
    // Remove existing active assignments for this property-estimate combination
    assignments = assignments.map(a => {
      if (a.propertyId === propertyId && a.estimateId === estimateId && a.status === 'active') {
        return { ...a, status: 'replaced', replacedAt: new Date().toISOString() };
      }
      return a;
    });
    
    // Add new assignments
    const timestamp = new Date().toISOString();
    const newAssignments = serviceAssignments
      .filter(sa => sa.vendorId) // Only save services with assigned vendors
      .map((sa, index) => ({
        id: `sva_${Date.now()}_${index}`,
        propertyId,
        estimateId,
        propertyName: propertyInfo.propertyName || '',
        propertyZone: propertyInfo.propertyZone || '',
        // Service info
        serviceType: sa.serviceType,
        frequencyCount: sa.frequencyCount,
        frequencyType: sa.frequencyType,
        // Vendor info
        vendorId: sa.vendorId,
        vendorName: sa.vendorName,
        vendorZone: sa.vendorZone,
        vendorServiceType: sa.vendorServiceType,
        // Metadata
        assignedBy: propertyInfo.assignedBy || 'system',
        assignedDate: timestamp,
        status: 'active'
      }));
    
    assignments = [...assignments, ...newAssignments];
    localStorage.setItem(SERVICE_VENDOR_ASSIGNMENT_KEY, JSON.stringify(assignments));
    
    return { 
      success: true, 
      data: newAssignments,
      message: `${newAssignments.length} service(s) assigned to vendors`
    };
  } catch (error) {
    console.error('Error saving service vendor assignments:', error);
    return { success: false, message: 'Failed to save assignments' };
  }
};

// Remove a single service vendor assignment
export const removeServiceVendorAssignment = (assignmentId) => {
  const assignments = getServiceVendorAssignments('all');
  const index = assignments.findIndex(a => a.id === assignmentId);
  
  if (index === -1) {
    return { success: false, message: 'Assignment not found' };
  }
  
  assignments[index].status = 'removed';
  assignments[index].removedAt = new Date().toISOString();
  localStorage.setItem(SERVICE_VENDOR_ASSIGNMENT_KEY, JSON.stringify(assignments));
  
  return { success: true };
};

// Check if property has any vendor assignments
export const hasVendorAssignments = (propertyId) => {
  const assignments = getServiceVendorAssignmentsByProperty(propertyId);
  return assignments.length > 0;
};

// Get assignment summary for a property
export const getPropertyAssignmentSummary = (propertyId) => {
  const assignments = getServiceVendorAssignmentsByProperty(propertyId);
  const estimateIds = [...new Set(assignments.map(a => a.estimateId))];
  
  return {
    totalAssignments: assignments.length,
    estimatesWithAssignments: estimateIds.length,
    assignmentsByEstimate: estimateIds.map(estId => ({
      estimateId: estId,
      assignments: assignments.filter(a => a.estimateId === estId)
    }))
  };
};
