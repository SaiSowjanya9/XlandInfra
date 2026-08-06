import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  LogOut,
  Menu,
  X,
  ClipboardList,
  ChevronDown,
  UserPlus,
  Store,
  Users,
  FileText,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  MapPin,
  Hammer,
  ClipboardCheck,
  Crown,
  ChevronLeft,
  ChevronRight,
  Bell,
  AlertTriangle,
  Trash2,
  RefreshCw,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FPLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Check if user is FP Manager (restricted access - created under FP)
  const isFPManager = admin?.role === 'manager';
  
  // Get display role name
  const getRoleDisplay = () => {
    if (isFPManager) return 'Manager';
    return 'Franchise Partner';
  };

  // Get user initials for avatar
  const getInitials = () => {
    const first = admin?.firstName?.[0] || '';
    const last = admin?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'FP';
  };

  const [workOrdersOpen, setWorkOrdersOpen] = useState(
    location.pathname.startsWith('/fp/work-orders')
  );

  const [vendorOpen, setVendorOpen] = useState(
    location.pathname.startsWith('/fp/vendors')
  );

  const [employeeOpen, setEmployeeOpen] = useState(
    location.pathname.startsWith('/fp/employees')
  );

  const [estimatesOpen, setEstimatesOpen] = useState(
    location.pathname.startsWith('/fp/estimates')
  );

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const token = getAuthToken();

  // Get read/dismissed notification IDs from localStorage
  const getReadNotifications = () => {
    try {
      return JSON.parse(localStorage.getItem('fp_read_notifications') || '[]');
    } catch { return []; }
  };

  const getDismissedNotifications = () => {
    try {
      return JSON.parse(localStorage.getItem('fp_dismissed_notifications') || '[]');
    } catch { return []; }
  };

  // Fetch work orders approaching auto-deletion
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fp/work-orders/approaching-deletion`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        const readIds = getReadNotifications();
        const dismissedIds = getDismissedNotifications();
        
        const woNotifications = result.data
          .filter(wo => !dismissedIds.includes(`wo-delete-${wo.id}`))
          .map(wo => ({
            id: `wo-delete-${wo.id}`,
            type: 'warning',
            title: 'Work Order Auto-Delete',
            message: `${wo.workOrderId} - (${wo.daysUntilDeletion} days left)`,
            workOrderId: wo.workOrderId,
            daysRemaining: wo.daysUntilDeletion,
            read: readIds.includes(`wo-delete-${wo.id}`)
          }));
        setNotifications(woNotifications);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    }
  };

  // Fetch notifications on mount
  useEffect(() => {
    if (token) {
      fetchNotifications();
      // Refresh every 5 minutes
      const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark single notification as read
  const markAsRead = (id) => {
    const readIds = getReadNotifications();
    if (!readIds.includes(id)) {
      localStorage.setItem('fp_read_notifications', JSON.stringify([...readIds, id]));
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('fp_read_notifications', JSON.stringify(allIds));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Dismiss (remove) notification - stored in localStorage so it doesn't come back
  const dismissNotification = (id) => {
    const dismissedIds = getDismissedNotifications();
    localStorage.setItem('fp_dismissed_notifications', JSON.stringify([...dismissedIds, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Clear all dismissed notifications (to show them again)
  const resetDismissedNotifications = () => {
    localStorage.removeItem('fp_dismissed_notifications');
    localStorage.removeItem('fp_read_notifications');
    fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Accordion toggle functions - close other sections when opening one
  const toggleWorkOrders = () => {
    if (!sidebarCollapsed) {
      const opening = !workOrdersOpen;
      setWorkOrdersOpen(opening);
      if (opening) { setVendorOpen(false); setEmployeeOpen(false); setEstimatesOpen(false); }
    }
  };

  const toggleVendor = () => {
    if (!sidebarCollapsed) {
      const opening = !vendorOpen;
      setVendorOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setEmployeeOpen(false); setEstimatesOpen(false); }
    }
  };

  const toggleEmployee = () => {
    if (!sidebarCollapsed) {
      const opening = !employeeOpen;
      setEmployeeOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setVendorOpen(false); setEstimatesOpen(false); }
    }
  };

  const toggleEstimates = () => {
    if (!sidebarCollapsed) {
      const opening = !estimatesOpen;
      setEstimatesOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setVendorOpen(false); setEmployeeOpen(false); }
    }
  };

  // Base nav items - Add Customer is standalone (not expandable)
  const navItems = [
    { path: '/fp', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/fp/properties', icon: Building2, label: 'Property Management' },
    { path: '/fp/customers/add', icon: UserPlus, label: 'Add Customer' },
  ];

  // Work Orders sub-items
  const workOrdersSubItems = [
    { path: '/fp/work-orders/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/fp/work-orders/create', icon: Plus, label: 'Create Work Order' },
    { path: '/fp/work-orders', icon: List, label: 'All Work Orders' },
    { path: '/fp/work-orders/pending', icon: Clock, label: 'Pending' },
    { path: '/fp/work-orders/assigned', icon: UserPlus, label: 'Assigned' },
    { path: '/fp/work-orders/in-progress', icon: ClipboardList, label: 'In Progress' },
    { path: '/fp/work-orders/completed', icon: CheckCircle, label: 'Completed' },
    { path: '/fp/work-orders/closed', icon: Archive, label: 'Closed' },
    { path: '/fp/work-orders/cancelled', icon: XCircle, label: 'Cancelled' }
  ];

  // Vendor sub-items - Add Vendor hidden for FP Manager, Assigned Vendors is view-only
  const allVendorSubItems = [
    { path: '/fp/vendors/add', icon: UserPlus, label: 'Add New Vendor', fpOnly: true },
    { path: '/fp/vendors', icon: Hammer, label: 'Vendor Details' },
    { path: '/fp/vendors/assigned', icon: ClipboardCheck, label: 'Assigned Vendors' },
  ];
  
  const vendorSubItems = isFPManager
    ? allVendorSubItems.filter(item => !item.fpOnly)
    : allVendorSubItems;

  // Employee sub-items - For FP Manager: ONLY Zone Management visible
  const allEmployeeSubItems = [
    { path: '/fp/employees/add', icon: UserPlus, label: 'Add Employee', fpOnly: true },
    { path: '/fp/employees', icon: Users, label: 'Employee Details', fpOnly: true },
    { path: '/fp/employees/zones', icon: MapPin, label: 'Employee Zone Management' },
  ];
  
  const employeeSubItems = isFPManager
    ? allEmployeeSubItems.filter(item => !item.fpOnly)
    : allEmployeeSubItems;

  // Estimates sub-items - FP Manager can create estimates but not AMC Packages/Add-ons
  const allEstimatesSubItems = [
    { path: '/fp/estimates/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/fp/estimates/create', icon: Plus, label: 'Create Estimate' },
    { path: '/fp/estimates', icon: List, label: 'All Estimates' },
    { path: '/fp/estimates/amc', icon: Package, label: 'AMC Packages' },
    { path: '/fp/estimates/addons', icon: PlusCircle, label: 'Add-ons' },
    { path: '/fp/estimates/archived', icon: Archive, label: 'Archived Estimates' },
  ];
  
  const estimatesSubItems = allEstimatesSubItems;

  const isWorkOrdersSectionActive = workOrdersSubItems.some(item => location.pathname === item.path) || location.pathname.startsWith('/fp/work-orders');
  const isVendorSectionActive = vendorSubItems.some(item => location.pathname === item.path);
  const isEmployeeSectionActive = employeeSubItems.some(item => location.pathname === item.path);
  const isEstimatesSectionActive = estimatesSubItems.some(item => location.pathname === item.path);
  
  // Color constants for sidebar
  const colors = {
    sidebarBg: 'linear-gradient(180deg, #23201B 0%, #1C1A17 50%, #141210 100%)',
    hoverBg: '#2A241D',
    activeBg: 'linear-gradient(90deg, #6B5228 0%, #43351F 100%)',
    activeText: '#FFFFFF',
    primaryText: '#F5F5F5',
    secondaryText: '#B8B8B8',
    mutedText: '#8D8D8D',
    primaryGold: '#D4AF37',
    iconGold: '#D9B650',
    richGold: '#C9A227',
    divider: '#3A3127',
    softBorder: '#4A4033',
    profileBg: '#1F1C18',
  };

  // Check if any dropdown is open
  const isAnyDropdownOpen = workOrdersOpen || vendorOpen || employeeOpen || estimatesOpen;

  const NavLink = ({ item, mobile = false, isSubItem = false }) => {
    const Icon = item.icon;
    // Only highlight main nav if path matches AND no dropdown is open (for main nav items only)
    const isActive = isSubItem ? location.pathname === item.path : (location.pathname === item.path && !isAnyDropdownOpen);
    const handleClick = (e) => {
      if (mobile) setSidebarOpen(false);
      
      // Close all dropdowns only when clicking on main nav items (not sub-items)
      if (!isSubItem) {
        setWorkOrdersOpen(false);
        setVendorOpen(false);
        setEmployeeOpen(false);
        setEstimatesOpen(false);
      }

      if (localStorage.getItem('formDirty') === 'true') {
        e.preventDefault();
        const confirmed = window.confirm("You haven't submitted the form yet. Are you sure you want to leave this page?");
        if (confirmed) {
          localStorage.removeItem('formDirty');
          navigate(item.path);
        }
      }
    };
    return (
      <Link
        to={item.path}
        onClick={handleClick}
        className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
        style={{
          background: isActive ? colors.activeBg : 'transparent',
          color: isActive ? colors.activeText : colors.primaryText,
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        title={sidebarCollapsed ? item.label : ''}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: isActive ? colors.activeText : colors.iconGold }} />
        {!sidebarCollapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* Mobile Header */}
      <header className="lg:hidden bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu className="w-6 h-6 text-slate-700" />
          </button>
          <span className="font-semibold text-slate-800">{admin?.firstName} {admin?.lastName}</span>
          <div className="flex items-center gap-2">
            {/* Mobile Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Dropdown (Mobile only - Desktop uses FPDashboard) */}
      {showNotifications && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
          <div 
            ref={notificationRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-16 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  onClick={resetDismissedNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  title="Refresh notifications"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No notifications</p>
                  <button
                    onClick={resetDismissedNotifications}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Check for new notifications
                  </button>
                </div>
              ) : (
                <div>
                  {notifications.some(n => n.type === 'warning') && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                      <div className="flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium">Work Orders Approaching Auto-Delete</span>
                      </div>
                      <p className="text-xs text-amber-700 mt-1">
                        Closed/cancelled work orders are deleted 30 days after completion.
                      </p>
                    </div>
                  )}
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                      className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          {/* Unread indicator dot */}
                          <div className="relative">
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                              notification.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                            }`}>
                              {notification.type === 'warning' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                              ) : (
                                <Bell className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            {!notification.read && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {notification.workOrderId}
                            </p>
                            <p className={`text-xs mt-0.5 ${!notification.read ? 'text-amber-700' : 'text-amber-600/80'}`}>
                              {notification.daysRemaining} days until auto-delete
                            </p>
                            {!notification.read && (
                              <span className="inline-block mt-1 text-[10px] text-blue-600 font-medium">Click to mark as read</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id); }}
                          className="p-1.5 hover:bg-red-100 rounded-lg transition-colors group"
                          title="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full shadow-xl z-50 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
        style={{ background: colors.sidebarBg }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div 
            className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} px-3 h-20`}
            style={{ borderBottom: `1px solid ${colors.divider}` }}
          >
            <img src="/logo.webp" alt="XLAND INFRA" className={`${sidebarCollapsed ? 'h-10' : 'h-12'} w-auto object-contain`} />
            {!sidebarCollapsed && (
              <div className="flex flex-col ml-2">
                <span 
                  className="text-lg font-bold tracking-wider"
                  style={{ 
                    background: 'linear-gradient(180deg, #D4AF37 0%, #C9A227 50%, #B8960F 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >XLAND INFRA</span>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <div className="w-6 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A227)' }}></div>
                  <span className="text-[9px] tracking-[0.2em] font-medium" style={{ color: '#A08520' }}>PVT LTD</span>
                  <div className="w-6 h-[1px]" style={{ background: 'linear-gradient(90deg, #C9A227, transparent)' }}></div>
                </div>
              </div>
            )}
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden ml-auto p-2 rounded-xl transition-colors"
              style={{ color: colors.secondaryText }}
              onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Work Orders Section */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.divider}` }}>
              <button
                onClick={toggleWorkOrders}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{
                  background: (workOrdersOpen || (isWorkOrdersSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent',
                  color: (workOrdersOpen || (isWorkOrdersSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText,
                }}
                onMouseEnter={(e) => { if (!workOrdersOpen && !(isWorkOrdersSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!workOrdersOpen && !(isWorkOrdersSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Work Orders' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <ClipboardList className="w-5 h-5 flex-shrink-0" style={{ color: (workOrdersOpen || (isWorkOrdersSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span>Work Orders</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      workOrdersOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>
              {workOrdersOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {workOrdersSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

            {/* Vendor Management Section */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.divider}` }}>
              <button
                onClick={toggleVendor}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{
                  background: (vendorOpen || (isVendorSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent',
                  color: (vendorOpen || (isVendorSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText,
                }}
                onMouseEnter={(e) => { if (!vendorOpen && !(isVendorSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!vendorOpen && !(isVendorSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Vendor Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Store className="w-5 h-5 flex-shrink-0" style={{ color: (vendorOpen || (isVendorSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span>Vendor Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      vendorOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>
              {vendorOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {vendorSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

            {/* Employee Management Section */}
            <div className="mt-1">
              <button
                onClick={toggleEmployee}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{
                  background: (employeeOpen || (isEmployeeSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent',
                  color: (employeeOpen || (isEmployeeSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText,
                }}
                onMouseEnter={(e) => { if (!employeeOpen && !(isEmployeeSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!employeeOpen && !(isEmployeeSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Employee Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Users className="w-5 h-5 flex-shrink-0" style={{ color: (employeeOpen || (isEmployeeSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span>Employee Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      employeeOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>
              {employeeOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {employeeSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

            {/* Estimates Section */}
            <div className="mt-1">
              <button
                onClick={toggleEstimates}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{
                  background: (estimatesOpen || (isEstimatesSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent',
                  color: (estimatesOpen || (isEstimatesSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText,
                }}
                onMouseEnter={(e) => { if (!estimatesOpen && !(isEstimatesSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!estimatesOpen && !(isEstimatesSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Estimates / AMC' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <FileText className="w-5 h-5 flex-shrink-0" style={{ color: (estimatesOpen || (isEstimatesSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span>Estimates / AMC</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      estimatesOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>
              {estimatesOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* User Info & Logout */}
          <div className="px-3 py-4" style={{ borderTop: `1px solid ${colors.divider}` }}>
            {!sidebarCollapsed ? (
              <div 
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: colors.profileBg }}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: colors.primaryText }}>
                    {admin?.firstName} {admin?.lastName}
                  </span>
                  <span className="text-xs font-medium" style={{ color: colors.primaryGold }}>
                    {getRoleDisplay()}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center p-2.5 rounded-xl transition-all duration-300"
                  style={{ 
                    border: `1px solid ${colors.richGold}`,
                    color: colors.primaryGold,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogout}
                className="flex items-center justify-center p-2.5 w-full rounded-xl transition-all duration-300"
                style={{ 
                  border: `1px solid ${colors.richGold}`,
                  color: colors.primaryGold,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Collapse Toggle Button - Outside Sidebar */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-6 h-12 rounded-r-lg transition-all duration-300 shadow-md ${
          sidebarCollapsed ? 'left-20' : 'left-64'
        }`}
        style={{
          background: '#1C1A17',
          border: `1px solid ${colors.divider}`,
          borderLeft: 'none',
          color: colors.iconGold,
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg}
        onMouseLeave={(e) => e.currentTarget.style.background = '#1C1A17'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} min-h-screen transition-all duration-300`}>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default FPLayout;
