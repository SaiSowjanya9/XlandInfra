/**
 * Roles and Permissions Configuration
 * PM Software - Role-Based Access Control (RBAC)
 * 
 * ============================================
 * ROLE HIERARCHY & SUMMARY
 * ============================================
 * 1. Admin - Full system control, manage users, override all actions
 * 2. Operations Manager - Estimates, schedules, assigns vendor, closes work
 * 3. Site Supervisor - Raises request and tracks work
 * 4. Data Entry Executive - Enters basic data only
 * 5. Vendor - Executes work and updates status
 * 
 * ============================================
 * WORKFLOW SPECIFICATIONS
 * ============================================
 * 
 * FLOW 1 - DATA ENTRY (Executive/Supervisor/Manager/Admin)
 * Steps: Enter client details → Enter vendor details → Enter property details → Save data
 * 
 * FLOW 2 - ESTIMATE CREATION (Manager/Admin)
 * Steps: Select estimate type → Add service/package → Add pricing → Save → Approve if needed
 * Rules: Manager can view pricing, Supervisor can only view estimate, Executive cannot access
 * 
 * FLOW 3 - SCHEDULE CREATION (Manager/Admin)
 * Steps: Estimate created → Package confirmed → Manager creates schedule → Assign date/cycle/frequency
 * Rules: Schedule created ONLY after package/service from estimate, Supervisor cannot create/edit
 * 
 * FLOW 4 - WORK ORDER REQUEST (Supervisor/Manager/Admin)
 * Steps: Request raised → Goes to Manager/Admin → Supervisor can create & track
 * Rules: Supervisor cannot assign vendor, Supervisor cannot close work order
 * 
 * FLOW 5 - VENDOR ASSIGNMENT (Manager/Admin)
 * Steps: Manager reviews request → Assigns vendor → Vendor receives work order
 * Rules: Supervisor can only view
 * 
 * FLOW 6 - VENDOR WORK STATUS UPDATE (Vendor)
 * Steps: Vendor accepts → Updates status → Marks completed
 * Status options: Assigned → Accepted → In Progress → Completed
 * Rules: Vendor cannot close work order
 * 
 * FLOW 7 - WORK ORDER CLOSURE (Manager/Admin)
 * Steps: Vendor marks completed → Manager checks → Manager closes
 * Rules: Only Manager/Admin can close, Supervisor can view only
 * 
 * ============================================
 * STATUS FLOW
 * ============================================
 * Draft → Requested → Under Review → Assigned → Accepted → In Progress → Completed → Verified → Closed
 * 
 */

// User Roles
const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',           // Operations Manager
  SUPERVISOR: 'supervisor',     // Site Supervisor
  EXECUTIVE: 'executive',       // Data Entry Executive
  VENDOR: 'vendor'
};

// Role Display Names (Professional Names)
const ROLE_NAMES = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Operations Manager',
  [ROLES.SUPERVISOR]: 'Site Supervisor',
  [ROLES.EXECUTIVE]: 'Data Entry Executive',
  [ROLES.VENDOR]: 'Vendor'
};

// Role Descriptions
const ROLE_DESCRIPTIONS = {
  [ROLES.ADMIN]: 'Full system control - Can access all modules and perform all actions',
  [ROLES.MANAGER]: 'Main operations handling - Manages work orders, vendors, estimates, and schedules',
  [ROLES.SUPERVISOR]: 'Monitoring and request-raising - Creates work order requests and tracks progress',
  [ROLES.EXECUTIVE]: 'Basic data collection - Adds client and vendor details',
  [ROLES.VENDOR]: 'External service provider - Accepts and completes assigned work orders'
};

// Modules in the system
const MODULES = {
  DASHBOARD: 'dashboard',
  MASTER_DATA: 'master_data',
  STAFF_MANAGEMENT: 'staff_management',
  VENDOR_MANAGEMENT: 'vendor_management',
  DATA_ENTRY: 'data_entry',
  ESTIMATE: 'estimate',
  PRICING: 'pricing',
  SCHEDULES: 'schedules',
  WORK_ORDER_REQUEST: 'work_order_request',
  WORK_ORDERS: 'work_orders',
  ASSIGN_VENDOR: 'assign_vendor',
  CLOSE_WORK_ORDER: 'close_work_order',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings'
};

// Access Levels
const ACCESS_LEVELS = {
  FULL: 'full',
  LIMITED: 'limited',
  VIEW_ONLY: 'view_only',
  CREATE_VIEW: 'create_view',
  LIMITED_ENTRY: 'limited_entry',
  NO_ACCESS: 'no_access'
};

/**
 * Module Access Matrix by Role
 * 
 * Admin: Full access to ALL modules
 * Manager: Full - Dashboard, Vendor Management, Data Entry, Estimate, Pricing, Schedules, Work Order Request, 
 *         Assign Vendor, Close Work Order, Notifications
 *         Limited - Master Data, Reports
 *         No Access - Staff Management, Settings
 * Supervisor: View - Dashboard, Notifications
 *             View Only - Vendor Management, Estimate, Schedules
 *             Full - Data Entry
 *             Create/View - Work Order Request
 *             Limited - Reports
 *             No Access - Master Data, Staff Management, Pricing, Assign Vendor, Close Work Order, Settings
 * Executive: Limited Entry - Vendor Management
 *            Limited - Data Entry
 *            No Access - Everything else
 * Vendor: Limited - Dashboard, Work Orders (assigned only)
 *         View - Notifications
 */
const MODULE_ACCESS = {
  [ROLES.ADMIN]: {
    [MODULES.DASHBOARD]: ACCESS_LEVELS.FULL,
    [MODULES.MASTER_DATA]: ACCESS_LEVELS.FULL,
    [MODULES.STAFF_MANAGEMENT]: ACCESS_LEVELS.FULL,
    [MODULES.VENDOR_MANAGEMENT]: ACCESS_LEVELS.FULL,
    [MODULES.DATA_ENTRY]: ACCESS_LEVELS.FULL,
    [MODULES.ESTIMATE]: ACCESS_LEVELS.FULL,
    [MODULES.PRICING]: ACCESS_LEVELS.FULL,
    [MODULES.SCHEDULES]: ACCESS_LEVELS.FULL,
    [MODULES.WORK_ORDER_REQUEST]: ACCESS_LEVELS.FULL,
    [MODULES.WORK_ORDERS]: ACCESS_LEVELS.FULL,
    [MODULES.ASSIGN_VENDOR]: ACCESS_LEVELS.FULL,
    [MODULES.CLOSE_WORK_ORDER]: ACCESS_LEVELS.FULL,
    [MODULES.REPORTS]: ACCESS_LEVELS.FULL,
    [MODULES.NOTIFICATIONS]: ACCESS_LEVELS.FULL,
    [MODULES.SETTINGS]: ACCESS_LEVELS.FULL
  },
  [ROLES.MANAGER]: {
    [MODULES.DASHBOARD]: ACCESS_LEVELS.FULL,             // Full access
    [MODULES.MASTER_DATA]: ACCESS_LEVELS.LIMITED,        // Limited access to master data
    [MODULES.STAFF_MANAGEMENT]: ACCESS_LEVELS.NO_ACCESS, // No access to staff management
    [MODULES.VENDOR_MANAGEMENT]: ACCESS_LEVELS.FULL,     // Full access - manage vendors
    [MODULES.DATA_ENTRY]: ACCESS_LEVELS.FULL,            // Full access - create/edit records
    [MODULES.ESTIMATE]: ACCESS_LEVELS.FULL,              // Full access - create estimates
    [MODULES.PRICING]: ACCESS_LEVELS.FULL,               // Full access to pricing
    [MODULES.SCHEDULES]: ACCESS_LEVELS.FULL,             // Full access - create schedules
    [MODULES.WORK_ORDER_REQUEST]: ACCESS_LEVELS.FULL,    // Full access - receive/process requests
    [MODULES.WORK_ORDERS]: ACCESS_LEVELS.FULL,           // Full access - monitor/manage
    [MODULES.ASSIGN_VENDOR]: ACCESS_LEVELS.FULL,         // Full access - assign vendors
    [MODULES.CLOSE_WORK_ORDER]: ACCESS_LEVELS.FULL,      // Full access - close work orders
    [MODULES.REPORTS]: ACCESS_LEVELS.LIMITED,            // Limited access to reports
    [MODULES.NOTIFICATIONS]: ACCESS_LEVELS.FULL,         // Full access to notifications
    [MODULES.SETTINGS]: ACCESS_LEVELS.NO_ACCESS          // No access to settings
  },
  [ROLES.SUPERVISOR]: {
    [MODULES.DASHBOARD]: ACCESS_LEVELS.VIEW_ONLY,        // View access to dashboard
    [MODULES.MASTER_DATA]: ACCESS_LEVELS.NO_ACCESS,      // No access
    [MODULES.STAFF_MANAGEMENT]: ACCESS_LEVELS.NO_ACCESS, // No access
    [MODULES.VENDOR_MANAGEMENT]: ACCESS_LEVELS.VIEW_ONLY,// View-only access
    [MODULES.DATA_ENTRY]: ACCESS_LEVELS.FULL,            // Full access to data entry
    [MODULES.ESTIMATE]: ACCESS_LEVELS.VIEW_ONLY,         // View-only access
    [MODULES.PRICING]: ACCESS_LEVELS.NO_ACCESS,          // No access to pricing
    [MODULES.SCHEDULES]: ACCESS_LEVELS.VIEW_ONLY,        // View-only access
    [MODULES.WORK_ORDER_REQUEST]: ACCESS_LEVELS.CREATE_VIEW, // Create/view access
    [MODULES.WORK_ORDERS]: ACCESS_LEVELS.VIEW_ONLY,      // View-only for tracking
    [MODULES.ASSIGN_VENDOR]: ACCESS_LEVELS.NO_ACCESS,    // No access
    [MODULES.CLOSE_WORK_ORDER]: ACCESS_LEVELS.NO_ACCESS, // No access
    [MODULES.REPORTS]: ACCESS_LEVELS.LIMITED,            // Limited view access to reports
    [MODULES.NOTIFICATIONS]: ACCESS_LEVELS.VIEW_ONLY,    // View access
    [MODULES.SETTINGS]: ACCESS_LEVELS.NO_ACCESS          // No access
  },
  [ROLES.EXECUTIVE]: {
    [MODULES.DASHBOARD]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.MASTER_DATA]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.STAFF_MANAGEMENT]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.VENDOR_MANAGEMENT]: ACCESS_LEVELS.LIMITED_ENTRY, // Add vendor details only
    [MODULES.DATA_ENTRY]: ACCESS_LEVELS.LIMITED,         // Add/edit client details only
    [MODULES.ESTIMATE]: ACCESS_LEVELS.NO_ACCESS,         // Cannot access estimate
    [MODULES.PRICING]: ACCESS_LEVELS.NO_ACCESS,          // Cannot view pricing
    [MODULES.SCHEDULES]: ACCESS_LEVELS.NO_ACCESS,        // Cannot access schedules
    [MODULES.WORK_ORDER_REQUEST]: ACCESS_LEVELS.NO_ACCESS, // Cannot raise work orders
    [MODULES.WORK_ORDERS]: ACCESS_LEVELS.NO_ACCESS,      // Cannot access work orders
    [MODULES.ASSIGN_VENDOR]: ACCESS_LEVELS.NO_ACCESS,    // Cannot assign vendors
    [MODULES.CLOSE_WORK_ORDER]: ACCESS_LEVELS.NO_ACCESS, // Cannot close work orders
    [MODULES.REPORTS]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.NOTIFICATIONS]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.SETTINGS]: ACCESS_LEVELS.NO_ACCESS
  },
  [ROLES.VENDOR]: {
    [MODULES.DASHBOARD]: ACCESS_LEVELS.LIMITED,          // Limited dashboard for vendors
    [MODULES.MASTER_DATA]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.STAFF_MANAGEMENT]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.VENDOR_MANAGEMENT]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.DATA_ENTRY]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.ESTIMATE]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.PRICING]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.SCHEDULES]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.WORK_ORDER_REQUEST]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.WORK_ORDERS]: ACCESS_LEVELS.LIMITED,        // View assigned work orders and update status
    [MODULES.ASSIGN_VENDOR]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.CLOSE_WORK_ORDER]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.REPORTS]: ACCESS_LEVELS.NO_ACCESS,
    [MODULES.NOTIFICATIONS]: ACCESS_LEVELS.VIEW_ONLY,
    [MODULES.SETTINGS]: ACCESS_LEVELS.NO_ACCESS
  }
};

// Permission Types
const PERMISSIONS = {
  VIEW: 'can_view',
  CREATE: 'can_create',
  EDIT: 'can_edit',
  DELETE: 'can_delete',
  APPROVE: 'can_approve',
  ASSIGN: 'can_assign',
  CLOSE: 'can_close'
};

/**
 * Permission Matrix by Role (Backend Permission Logic)
 * 
 * Permission Fields: can_view, can_create, can_edit, can_delete, can_approve, can_assign, can_close
 * 
 * VIEW:    Admin ✓, Manager ✓, Supervisor ✓, Executive limited
 * CREATE:  Admin ✓, Manager ✓, Supervisor selected_modules, Executive data_only
 * EDIT:    Admin ✓, Manager ✓, Supervisor limited, Executive limited
 * DELETE:  Admin ✓, Manager limited, Supervisor ✗, Executive ✗
 * APPROVE: Admin ✓, Manager ✓, Supervisor ✗, Executive ✗
 * ASSIGN:  Admin ✓, Manager ✓, Supervisor ✗, Executive ✗
 * CLOSE:   Admin ✓, Manager ✓, Supervisor ✗, Executive ✗
 */
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    [PERMISSIONS.VIEW]: true,            // Full view access
    [PERMISSIONS.CREATE]: true,          // Full create access
    [PERMISSIONS.EDIT]: true,            // Full edit access
    [PERMISSIONS.DELETE]: true,          // Full delete access
    [PERMISSIONS.APPROVE]: true,         // Full approve access
    [PERMISSIONS.ASSIGN]: true,          // Full assign access
    [PERMISSIONS.CLOSE]: true            // Full close access
  },
  [ROLES.MANAGER]: {
    [PERMISSIONS.VIEW]: true,            // Full view access
    [PERMISSIONS.CREATE]: true,          // Full create access
    [PERMISSIONS.EDIT]: true,            // Full edit access
    [PERMISSIONS.DELETE]: 'limited',     // Limited delete (cannot delete all records)
    [PERMISSIONS.APPROVE]: true,         // Can approve
    [PERMISSIONS.ASSIGN]: true,          // Can assign vendors
    [PERMISSIONS.CLOSE]: true            // Can close work orders
  },
  [ROLES.SUPERVISOR]: {
    [PERMISSIONS.VIEW]: true,            // Full view access (where module allows)
    [PERMISSIONS.CREATE]: 'selected_modules', // Create only in selected modules (work order request, data entry)
    [PERMISSIONS.EDIT]: 'limited',       // Limited edit access
    [PERMISSIONS.DELETE]: false,         // No delete access
    [PERMISSIONS.APPROVE]: false,        // No approve access
    [PERMISSIONS.ASSIGN]: false,         // No assign access
    [PERMISSIONS.CLOSE]: false           // No close access
  },
  [ROLES.EXECUTIVE]: {
    [PERMISSIONS.VIEW]: 'limited',       // Limited view (data entry only)
    [PERMISSIONS.CREATE]: 'data_only',   // Create data only (client/vendor details)
    [PERMISSIONS.EDIT]: 'limited',       // Limited edit (contact details only)
    [PERMISSIONS.DELETE]: false,         // No delete access
    [PERMISSIONS.APPROVE]: false,        // No approve access
    [PERMISSIONS.ASSIGN]: false,         // No assign access
    [PERMISSIONS.CLOSE]: false           // No close access
  },
  [ROLES.VENDOR]: {
    [PERMISSIONS.VIEW]: 'assigned_only', // View assigned work orders only
    [PERMISSIONS.CREATE]: false,         // No create access
    [PERMISSIONS.EDIT]: 'status_only',   // Edit work order status only
    [PERMISSIONS.DELETE]: false,         // No delete access
    [PERMISSIONS.APPROVE]: false,        // No approve access
    [PERMISSIONS.ASSIGN]: false,         // No assign access
    [PERMISSIONS.CLOSE]: false           // No close access
  }
};

/**
 * Work Order Status Flow
 * Draft → Requested → Under Review → Assigned → Accepted → In Progress → Completed → Verified → Closed
 */
const WORK_ORDER_STATUS = {
  DRAFT: 'draft',                    // Initial state
  REQUESTED: 'requested',            // Work Order Requested (by Supervisor/Manager/Admin)
  UNDER_REVIEW: 'under_review',      // Under Review (by Manager/Admin)
  ASSIGNED: 'assigned',              // Assigned to Vendor (by Manager/Admin)
  ACCEPTED: 'accepted',              // Accepted by Vendor
  IN_PROGRESS: 'in_progress',        // In Progress (Vendor working)
  COMPLETED: 'completed',            // Completed by Vendor
  VERIFIED: 'verified',              // Verified by Manager
  CLOSED: 'closed',                  // Closed (by Manager/Admin)
  CANCELLED: 'cancelled'             // Cancelled (by Manager/Admin)
};

// Status Transition Rules
const STATUS_TRANSITIONS = {
  [WORK_ORDER_STATUS.DRAFT]: [WORK_ORDER_STATUS.REQUESTED],
  [WORK_ORDER_STATUS.REQUESTED]: [WORK_ORDER_STATUS.UNDER_REVIEW, WORK_ORDER_STATUS.CANCELLED],
  [WORK_ORDER_STATUS.UNDER_REVIEW]: [WORK_ORDER_STATUS.ASSIGNED, WORK_ORDER_STATUS.CANCELLED],
  [WORK_ORDER_STATUS.ASSIGNED]: [WORK_ORDER_STATUS.ACCEPTED, WORK_ORDER_STATUS.CANCELLED],
  [WORK_ORDER_STATUS.ACCEPTED]: [WORK_ORDER_STATUS.IN_PROGRESS],
  [WORK_ORDER_STATUS.IN_PROGRESS]: [WORK_ORDER_STATUS.COMPLETED],
  [WORK_ORDER_STATUS.COMPLETED]: [WORK_ORDER_STATUS.VERIFIED],
  [WORK_ORDER_STATUS.VERIFIED]: [WORK_ORDER_STATUS.CLOSED],
  [WORK_ORDER_STATUS.CLOSED]: []  // Final state (Admin can reopen)
};

// Who can perform status transitions
const STATUS_TRANSITION_ROLES = {
  [WORK_ORDER_STATUS.DRAFT]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR],
  [WORK_ORDER_STATUS.REQUESTED]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR],
  [WORK_ORDER_STATUS.UNDER_REVIEW]: [ROLES.ADMIN, ROLES.MANAGER],
  [WORK_ORDER_STATUS.ASSIGNED]: [ROLES.ADMIN, ROLES.MANAGER],
  [WORK_ORDER_STATUS.ACCEPTED]: [ROLES.VENDOR],
  [WORK_ORDER_STATUS.IN_PROGRESS]: [ROLES.VENDOR],
  [WORK_ORDER_STATUS.COMPLETED]: [ROLES.VENDOR],
  [WORK_ORDER_STATUS.VERIFIED]: [ROLES.ADMIN, ROLES.MANAGER],
  [WORK_ORDER_STATUS.CLOSED]: [ROLES.ADMIN, ROLES.MANAGER],
  [WORK_ORDER_STATUS.CANCELLED]: [ROLES.ADMIN, ROLES.MANAGER]
};

/**
 * Menu Configuration by Role (Login-based role visibility)
 * 
 * Admin sees: Dashboard, Master Data, Staff Management, Vendor Management, Work Orders, Estimate, Schedules, Reports, Settings
 * Manager sees: Dashboard, Data Entry, Estimate, Schedules, Work Orders, Vendors, Reports
 * Supervisor sees: Dashboard, Data Entry, Estimate (view), Schedule (view), Work Order Request, Work Order Tracking
 * Executive sees: Data Entry only
 * Vendor sees: Dashboard, My Work Orders, Notifications
 */
const MENU_CONFIG = {
  [ROLES.ADMIN]: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
    { key: 'master_data', label: 'Master Data', icon: 'Database', path: '/master-data' },
    { key: 'staff_management', label: 'Staff Management', icon: 'Users', path: '/staff' },
    { key: 'vendor_management', label: 'Vendor Management', icon: 'Truck', path: '/vendors' },
    { key: 'data_entry', label: 'Data Entry', icon: 'FileEdit', path: '/data-entry' },
    { key: 'estimate', label: 'Estimate', icon: 'Calculator', path: '/estimates' },
    { key: 'pricing', label: 'Pricing', icon: 'DollarSign', path: '/pricing' },
    { key: 'schedules', label: 'Schedules', icon: 'Calendar', path: '/schedules' },
    { key: 'work_orders', label: 'Work Orders', icon: 'ClipboardList', path: '/work-orders' },
    { key: 'reports', label: 'Reports', icon: 'BarChart2', path: '/reports' },
    { key: 'notifications', label: 'Notifications', icon: 'Bell', path: '/notifications' },
    { key: 'settings', label: 'Settings', icon: 'Settings', path: '/settings' }
  ],
  [ROLES.MANAGER]: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
    { key: 'data_entry', label: 'Data Entry', icon: 'FileEdit', path: '/data-entry' },
    { key: 'estimate', label: 'Estimate', icon: 'Calculator', path: '/estimates' },
    { key: 'pricing', label: 'Pricing', icon: 'DollarSign', path: '/pricing' },
    { key: 'schedules', label: 'Schedules', icon: 'Calendar', path: '/schedules' },
    { key: 'work_orders', label: 'Work Orders', icon: 'ClipboardList', path: '/work-orders' },
    { key: 'vendor_management', label: 'Vendors', icon: 'Truck', path: '/vendors' },
    { key: 'reports', label: 'Reports', icon: 'BarChart2', path: '/reports' },
    { key: 'notifications', label: 'Notifications', icon: 'Bell', path: '/notifications' }
  ],
  [ROLES.SUPERVISOR]: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', viewOnly: true },
    { key: 'data_entry', label: 'Data Entry', icon: 'FileEdit', path: '/data-entry' },
    { key: 'estimate', label: 'Estimate', icon: 'Calculator', path: '/estimates', viewOnly: true },
    { key: 'schedules', label: 'Schedules', icon: 'Calendar', path: '/schedules', viewOnly: true },
    { key: 'work_order_request', label: 'Work Order Request', icon: 'FilePlus', path: '/work-order-request' },
    { key: 'work_orders', label: 'Work Order Tracking', icon: 'ClipboardList', path: '/work-orders', viewOnly: true },
    { key: 'notifications', label: 'Notifications', icon: 'Bell', path: '/notifications', viewOnly: true }
  ],
  [ROLES.EXECUTIVE]: [
    { key: 'data_entry', label: 'Data Entry', icon: 'FileEdit', path: '/data-entry' }
  ],
  [ROLES.VENDOR]: [
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/vendor/dashboard' },
    { key: 'work_orders', label: 'My Work Orders', icon: 'ClipboardList', path: '/vendor/work-orders' },
    { key: 'notifications', label: 'Notifications', icon: 'Bell', path: '/vendor/notifications' }
  ]
};

// Helper Functions
const hasModuleAccess = (role, module) => {
  const access = MODULE_ACCESS[role]?.[module];
  return access && access !== ACCESS_LEVELS.NO_ACCESS;
};

const getModuleAccessLevel = (role, module) => {
  return MODULE_ACCESS[role]?.[module] || ACCESS_LEVELS.NO_ACCESS;
};

const hasPermission = (role, permission) => {
  const perm = ROLE_PERMISSIONS[role]?.[permission];
  return perm === true || (typeof perm === 'string' && perm !== 'false');
};

const canTransitionStatus = (role, fromStatus, toStatus) => {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowedTransitions.includes(toStatus)) {
    return false;
  }
  const allowedRoles = STATUS_TRANSITION_ROLES[toStatus] || [];
  return allowedRoles.includes(role);
};

const getMenuForRole = (role) => {
  return MENU_CONFIG[role] || [];
};

// Role check helpers
const isAdmin = (role) => role === ROLES.ADMIN;
const isManager = (role) => role === ROLES.MANAGER;
const isSupervisor = (role) => role === ROLES.SUPERVISOR;
const isExecutive = (role) => role === ROLES.EXECUTIVE;
const isVendor = (role) => role === ROLES.VENDOR;

/**
 * Capability Checks - Based on Role Requirements
 */

// Admin-only capabilities
const canManageUsers = (role) => role === ROLES.ADMIN;           // Manage all users and permissions
const canManageSettings = (role) => role === ROLES.ADMIN;        // Change full system settings
const canOverrideManagerActions = (role) => role === ROLES.ADMIN; // Override manager actions
const canReopenWorkOrder = (role) => role === ROLES.ADMIN;       // Reopen closed work orders
const canDeleteAllRecords = (role) => role === ROLES.ADMIN;      // Delete all records
const canFullAccessMasterData = (role) => role === ROLES.ADMIN;  // Full master data management

// Admin and Manager capabilities (Approve permission)
const canApproveEstimate = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role); // Approve estimates

// Admin and Manager capabilities
const canAccessMasterData = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role); // Master data access (Admin full, Manager limited)
const canViewPricing = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role);      // Full pricing access
const canCreateEstimate = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role);   // Create estimates
const canCreateSchedule = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role);   // Create schedules
const canAssignVendor = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role);     // Assign vendors
const canCloseWorkOrder = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role);   // Close work orders
const canMonitorVendorProgress = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role); // Monitor vendor progress
const canReceiveWorkOrderRequest = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role); // Receive WO requests
const canManageVendors = (role) => [ROLES.ADMIN, ROLES.MANAGER].includes(role);    // Full vendor management

// Admin, Manager, Supervisor - Reports access (Admin/Manager full, Supervisor limited)
const canViewReports = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR].includes(role);

// Admin, Manager, Supervisor capabilities
const canCreateWorkOrderRequest = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR].includes(role);
const canViewEstimate = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR].includes(role);
const canViewSchedule = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR].includes(role);
const canTrackWorkOrder = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR].includes(role);
const canAccessDashboard = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.VENDOR].includes(role);

// Data Entry capabilities (Admin, Manager, Supervisor, Executive)
const canAccessDataEntry = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.EXECUTIVE].includes(role);
const canAddClientDetails = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.EXECUTIVE].includes(role);
const canAddVendorDetails = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.EXECUTIVE].includes(role);
const canEditContactDetails = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.EXECUTIVE].includes(role);

// Vendor-specific capabilities
const canUpdateWorkOrderStatus = (role) => [ROLES.ADMIN, ROLES.MANAGER, ROLES.VENDOR].includes(role);
const canViewAssignedWorkOrders = (role) => role === ROLES.VENDOR;

/**
 * Get all capabilities for a role
 * Returns an object with all capability checks for the given role
 */
const getRoleCapabilities = (role) => {
  return {
    // Module Access
    canAccessDashboard: canAccessDashboard(role),
    canAccessMasterData: canAccessMasterData(role),
    canFullAccessMasterData: canFullAccessMasterData(role),
    canManageUsers: canManageUsers(role),
    canAccessDataEntry: canAccessDataEntry(role),
    canViewReports: canViewReports(role),
    canManageSettings: canManageSettings(role),
    
    // Data Entry
    canAddClientDetails: canAddClientDetails(role),
    canAddVendorDetails: canAddVendorDetails(role),
    canEditContactDetails: canEditContactDetails(role),
    
    // Estimates & Pricing
    canViewEstimate: canViewEstimate(role),
    canCreateEstimate: canCreateEstimate(role),
    canApproveEstimate: canApproveEstimate(role),
    canViewPricing: canViewPricing(role),
    
    // Schedules
    canViewSchedule: canViewSchedule(role),
    canCreateSchedule: canCreateSchedule(role),
    
    // Work Orders
    canCreateWorkOrderRequest: canCreateWorkOrderRequest(role),
    canReceiveWorkOrderRequest: canReceiveWorkOrderRequest(role),
    canTrackWorkOrder: canTrackWorkOrder(role),
    canUpdateWorkOrderStatus: canUpdateWorkOrderStatus(role),
    canCloseWorkOrder: canCloseWorkOrder(role),
    canReopenWorkOrder: canReopenWorkOrder(role),
    
    // Vendors
    canManageVendors: canManageVendors(role),
    canAssignVendor: canAssignVendor(role),
    canMonitorVendorProgress: canMonitorVendorProgress(role),
    canViewAssignedWorkOrders: canViewAssignedWorkOrders(role),
    
    // Admin Override
    canOverrideManagerActions: canOverrideManagerActions(role),
    canDeleteAllRecords: canDeleteAllRecords(role)
  };
};

module.exports = {
  ROLES,
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  MODULES,
  ACCESS_LEVELS,
  MODULE_ACCESS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  WORK_ORDER_STATUS,
  STATUS_TRANSITIONS,
  STATUS_TRANSITION_ROLES,
  MENU_CONFIG,
  // Helper functions
  hasModuleAccess,
  getModuleAccessLevel,
  hasPermission,
  canTransitionStatus,
  getMenuForRole,
  getRoleCapabilities,
  // Role checks
  isAdmin,
  isManager,
  isSupervisor,
  isExecutive,
  isVendor,
  // Admin-only capabilities
  canManageUsers,
  canManageSettings,
  canOverrideManagerActions,
  canReopenWorkOrder,
  canApproveEstimate,
  canFullAccessMasterData,
  canDeleteAllRecords,
  canAccessMasterData,
  // Admin + Manager capabilities
  canViewPricing,
  canCreateEstimate,
  canCreateSchedule,
  canAssignVendor,
  canCloseWorkOrder,
  canMonitorVendorProgress,
  canReceiveWorkOrderRequest,
  canManageVendors,
  canViewReports,
  // Admin + Manager + Supervisor capabilities
  canCreateWorkOrderRequest,
  canViewEstimate,
  canViewSchedule,
  canTrackWorkOrder,
  canAccessDashboard,
  // Data entry capabilities
  canAccessDataEntry,
  canAddClientDetails,
  canAddVendorDetails,
  canEditContactDetails,
  // Vendor capabilities
  canUpdateWorkOrderStatus,
  canViewAssignedWorkOrders
};
