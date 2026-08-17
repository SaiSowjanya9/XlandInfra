/**
 * Menu Routes
 * Returns role-based menu configuration and user permissions
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { 
  ROLES, 
  MODULES, 
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  MENU_CONFIG,
  MODULE_ACCESS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  getMenuForRole,
  getModuleAccessLevel,
  hasPermission,
  getRoleCapabilities
} = require('../config/roles');

// Get menu items for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    const menuItems = getMenuForRole(userRole);

    res.json({
      success: true,
      data: {
        role: userRole,
        roleName: ROLE_NAMES[userRole],
        menu: menuItems
      }
    });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu configuration',
      error: error.message
    });
  }
});

// Get all permissions for current user
router.get('/permissions', authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    // Get module access levels
    const moduleAccess = {};
    Object.values(MODULES).forEach(module => {
      moduleAccess[module] = getModuleAccessLevel(userRole, module);
    });

    // Get general permissions
    const permissions = {
      canView: hasPermission(userRole, PERMISSIONS.VIEW),
      canCreate: hasPermission(userRole, PERMISSIONS.CREATE),
      canEdit: hasPermission(userRole, PERMISSIONS.EDIT),
      canDelete: hasPermission(userRole, PERMISSIONS.DELETE),
      canApprove: hasPermission(userRole, PERMISSIONS.APPROVE),
      canAssign: hasPermission(userRole, PERMISSIONS.ASSIGN),
      canClose: hasPermission(userRole, PERMISSIONS.CLOSE)
    };

    // Get detailed capabilities
    const capabilities = getRoleCapabilities(userRole);

    res.json({
      success: true,
      data: {
        role: userRole,
        roleName: ROLE_NAMES[userRole],
        roleDescription: ROLE_DESCRIPTIONS[userRole],
        moduleAccess,
        permissions,
        capabilities
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching permissions',
      error: error.message
    });
  }
});

// Get role information (for admin)
router.get('/roles', authenticate, async (req, res) => {
  try {
    const roles = Object.entries(ROLE_NAMES).map(([key, name]) => ({
      value: key,
      label: name,
      description: ROLE_DESCRIPTIONS[key],
      permissions: ROLE_PERMISSIONS[key],
      moduleAccess: MODULE_ACCESS[key],
      capabilities: getRoleCapabilities(key)
    }));

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roles',
      error: error.message
    });
  }
});

// Check specific permission
router.get('/check/:module/:action', authenticate, async (req, res) => {
  try {
    const { module, action } = req.params;
    const userRole = req.user.role;

    const accessLevel = getModuleAccessLevel(userRole, module);
    const hasAccess = accessLevel !== 'no_access';
    const canPerformAction = hasPermission(userRole, `can_${action}`);

    res.json({
      success: true,
      data: {
        module,
        action,
        accessLevel,
        hasAccess,
        canPerformAction,
        allowed: hasAccess && canPerformAction
      }
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking permission',
      error: error.message
    });
  }
});

module.exports = router;
