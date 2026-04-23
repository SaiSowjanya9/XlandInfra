/**
 * Role-Based Access Control (RBAC) Middleware
 * Handles permission checks based on user roles
 */

const {
  ROLES,
  MODULES,
  PERMISSIONS,
  hasModuleAccess,
  getModuleAccessLevel,
  hasPermission,
  canTransitionStatus,
  getRoleCapabilities,
  // Admin-only capabilities
  canManageUsers,
  canManageSettings,
  canOverrideManagerActions,
  canReopenWorkOrder,
  canApproveEstimate,
  canFullAccessMasterData,
  canDeleteAllRecords,
  // Admin + Manager capabilities
  canAccessMasterData,
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
  canViewAssignedWorkOrders,
  ACCESS_LEVELS
} = require('../config/roles');

// Check if user has required role(s)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient role permissions.'
      });
    }

    next();
  };
};

// Check if user has access to a specific module
const requireModuleAccess = (module, requiredLevel = null) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const accessLevel = getModuleAccessLevel(req.user.role, module);
    
    if (accessLevel === ACCESS_LEVELS.NO_ACCESS) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You don't have access to this module.`
      });
    }

    // If a specific level is required, check it
    if (requiredLevel) {
      const levelHierarchy = [
        ACCESS_LEVELS.NO_ACCESS,
        ACCESS_LEVELS.LIMITED_ENTRY,
        ACCESS_LEVELS.VIEW_ONLY,
        ACCESS_LEVELS.CREATE_VIEW,
        ACCESS_LEVELS.LIMITED,
        ACCESS_LEVELS.FULL
      ];
      
      const userLevelIndex = levelHierarchy.indexOf(accessLevel);
      const requiredLevelIndex = levelHierarchy.indexOf(requiredLevel);
      
      if (userLevelIndex < requiredLevelIndex) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient access level for this operation.'
        });
      }
    }

    // Attach access level to request for route handlers to use
    req.accessLevel = accessLevel;
    next();
  };
};

// Check if user has specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission for this action.'
      });
    }

    next();
  };
};

// Check multiple permissions (AND logic)
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    for (const permission of permissions) {
      if (!hasPermission(req.user.role, permission)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have all required permissions.'
        });
      }
    }

    next();
  };
};

// Check multiple permissions (OR logic)
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    for (const permission of permissions) {
      if (hasPermission(req.user.role, permission)) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have any of the required permissions.'
    });
  };
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

// Manager or Admin middleware
const managerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (![ROLES.ADMIN, ROLES.MANAGER].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Manager or Admin privileges required.'
    });
  }

  next();
};

// Vendor assignment check
const canAssign = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canAssignVendor(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot assign vendors.'
    });
  }

  next();
};

// Work order close check
const canClose = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canCloseWorkOrder(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot close work orders.'
    });
  }

  next();
};

// Work order reopen check (Admin only)
const canReopen = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canReopenWorkOrder(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Admin can reopen work orders.'
    });
  }

  next();
};

// Work order request creation check
const canCreateRequest = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canCreateWorkOrderRequest(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot create work order requests.'
    });
  }

  next();
};

// Pricing view check
const canSeePricing = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canViewPricing(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot view pricing information.'
    });
  }

  next();
};

// Estimate creation check
const canMakeEstimate = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canCreateEstimate(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot create estimates.'
    });
  }

  next();
};

// Schedule creation check
const canMakeSchedule = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canCreateSchedule(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot create schedules.'
    });
  }

  next();
};

// User management check
const canManageStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canManageUsers(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot manage users.'
    });
  }

  next();
};

// Settings management check
const canEditSettings = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canManageSettings(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot manage settings.'
    });
  }

  next();
};

// Master data access check (Admin full, Manager limited)
const requireMasterDataAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canAccessMasterData(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have access to master data.'
    });
  }

  // Attach access level for route handlers to use
  req.masterDataAccessLevel = canFullAccessMasterData(req.user.role) ? 'full' : 'limited';
  next();
};

// Full master data access check (Admin only - for create/edit/delete)
const requireFullMasterDataAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canFullAccessMasterData(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Admin can modify master data.'
    });
  }

  next();
};

// Estimate approval check (Admin and Manager)
const canApprove = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canApproveEstimate(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have approval permissions.'
    });
  }

  next();
};

// View estimate check (Admin, Manager, Supervisor)
const canSeeEstimate = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canViewEstimate(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot view estimates.'
    });
  }

  next();
};

// View schedule check (Admin, Manager, Supervisor)
const canSeeSchedule = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canViewSchedule(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot view schedules.'
    });
  }

  next();
};

// Track work order check (Admin, Manager, Supervisor)
const canTrack = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canTrackWorkOrder(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot track work orders.'
    });
  }

  next();
};

// Monitor vendor progress check (Admin, Manager)
const canMonitorVendor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canMonitorVendorProgress(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot monitor vendor progress.'
    });
  }

  next();
};

// View reports check (Admin, Manager)
const canSeeReports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canViewReports(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot view reports.'
    });
  }

  next();
};

// Data entry access check (Admin, Manager, Supervisor, Executive)
const canDoDataEntry = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canAccessDataEntry(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot access data entry.'
    });
  }

  next();
};

// Add client details check
const canAddClient = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canAddClientDetails(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot add client details.'
    });
  }

  next();
};

// Add vendor details check (Admin, Manager, Executive)
const canAddVendor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canAddVendorDetails(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot add vendor details.'
    });
  }

  next();
};

// Delete all records check (Admin only)
const canDeleteAll = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!canDeleteAllRecords(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Admin can delete all records.'
    });
  }

  next();
};

// Supervisor or above middleware (Admin, Manager, Supervisor)
const supervisorOrAbove = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (![ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Supervisor or above privileges required.'
    });
  }

  next();
};

// Data entry roles middleware (Admin, Manager, Supervisor, Executive)
const dataEntryRoles = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (![ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR, ROLES.EXECUTIVE].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Data entry privileges required.'
    });
  }

  next();
};

// Vendor-specific middleware (only vendors can access)
const vendorOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== ROLES.VENDOR) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. This action is only for vendors.'
    });
  }

  next();
};

// Check work order status transition
const validateStatusTransition = (fromStatus, toStatus) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!canTransitionStatus(req.user.role, fromStatus, toStatus)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You cannot change status from '${fromStatus}' to '${toStatus}'.`
      });
    }

    next();
  };
};

// Attach permissions info to response
const attachPermissions = (req, res, next) => {
  if (req.user) {
    // Get all capabilities for the user's role
    req.userPermissions = {
      role: req.user.role,
      // Basic permissions
      canView: hasPermission(req.user.role, PERMISSIONS.VIEW),
      canCreate: hasPermission(req.user.role, PERMISSIONS.CREATE),
      canEdit: hasPermission(req.user.role, PERMISSIONS.EDIT),
      canDelete: hasPermission(req.user.role, PERMISSIONS.DELETE),
      canApprove: hasPermission(req.user.role, PERMISSIONS.APPROVE),
      canAssign: hasPermission(req.user.role, PERMISSIONS.ASSIGN),
      canClose: hasPermission(req.user.role, PERMISSIONS.CLOSE),
      // Detailed capabilities
      capabilities: getRoleCapabilities(req.user.role)
    };
  }
  next();
};

module.exports = {
  // Role requirement middleware
  requireRole,
  requireModuleAccess,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  
  // Role-based middleware
  adminOnly,
  managerOrAdmin,
  supervisorOrAbove,
  dataEntryRoles,
  vendorOnly,
  
  // Capability-based middleware
  canAssign,
  canClose,
  canReopen,
  canCreateRequest,
  canSeePricing,
  canMakeEstimate,
  canMakeSchedule,
  canManageStaff,
  canEditSettings,
  requireMasterDataAccess,
  requireFullMasterDataAccess,
  canApprove,
  canSeeEstimate,
  canSeeSchedule,
  canTrack,
  canMonitorVendor,
  canSeeReports,
  canDoDataEntry,
  canAddClient,
  canAddVendor,
  canDeleteAll,
  
  // Status and permissions
  validateStatusTransition,
  attachPermissions,
  
  // Re-export constants for convenience
  ROLES,
  MODULES,
  PERMISSIONS
};
