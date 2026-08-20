import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAuthToken, safeStorage } from '../utils/safeStorage';
import {
  LayoutDashboard,
  Building2,
  FileInput,
  LogOut,
  Hammer,
  Menu,
  X,
  ClipboardList,
  ChevronDown,
  UserPlus,
  Store,
  Users,
  ClipboardCheck,
  FileText,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  Shield,
  MapPin,
  QrCode,
  User,
  Crown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Receipt,
  Wallet,
  History,
  Calendar,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFP } from '../contexts/FPContext';

const EmployeeLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // FP Context for selecting franchise partner
  const { fpList, selectedFp, selectFp, selectedPropertyType, setSelectedPropertyType, loading: fpLoading, refreshFpList } = useFP();
  
  // Ensure FP list is loaded when layout mounts with a valid session
  useEffect(() => {
    const token = getAuthToken();
    const isAdmin = admin?.role === 'admin' || admin?.role === 'operations_manager' || admin?.isSuperAdmin;
    
    // If we have a token, admin role, but no FP list - trigger refresh
    if (token && isAdmin && fpList.length === 0 && !fpLoading) {
      refreshFpList();
    }
  }, [admin, fpList.length, fpLoading, refreshFpList]);
  
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';

  // Get role display name
  const getRoleDisplay = () => {
    if (admin?.isSuperAdmin) return 'Super Admin';
    if (admin?.role === 'admin') return 'Admin';
    return 'Operations Manager';
  };

  // Get user initials for avatar
  const getInitials = () => {
    const first = admin?.firstName?.[0] || '';
    const last = admin?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  const [workOrdersOpen, setWorkOrdersOpen] = useState(
    location.pathname.startsWith('/employee/work-orders')
  );

  const [vendorOpen, setVendorOpen] = useState(
    location.pathname.startsWith('/employee/add-vendor') ||
    location.pathname.startsWith('/employee/vendor-details') ||
    location.pathname.startsWith('/employee/assigned-vendors')
  );

  const [employeeOpen, setEmployeeOpen] = useState(
    location.pathname.startsWith('/employee/add-employee') ||
    location.pathname.startsWith('/employee/employee-details') ||
    location.pathname.startsWith('/employee/employee-zone-management')
  );

  // Base nav items - filtered based on role
  const allNavItems = [
    { path: '/employee', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/employee/create-customer', icon: FileInput, label: 'Add Customer' },
    { path: '/employee/user-management', icon: Shield, label: 'User Management', adminOnly: true },
    { path: '/employee/qr-management', icon: QrCode, label: 'QR Management' },
  ];
  
  // Filter nav items for Operations Manager (only User Management is hidden)
  const navItems = isOpsManager 
    ? allNavItems.filter(item => !item.adminOnly)
    : allNavItems;

  // Work Orders sub-items
  const workOrdersSubItems = [
    { path: '/employee/work-orders/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/employee/work-orders', icon: List, label: 'All Work Orders' }
  ];

  const filteredWorkOrdersSubItems = isOpsManager
    ? workOrdersSubItems.filter(item => !item.adminOnly)
    : workOrdersSubItems;

  const isWorkOrdersSectionActive = workOrdersSubItems.some(item => location.pathname === item.path) || location.pathname.startsWith('/employee/work-orders');

  const [estimatesOpen, setEstimatesOpen] = useState(
    location.pathname.startsWith('/employee/estimates')
  );

  const [billingPaymentsOpen, setBillingPaymentsOpen] = useState(
    location.pathname.startsWith('/employee/billing')
  );

  const [schedulesOpen, setSchedulesOpen] = useState(
    location.pathname.startsWith('/employee/schedules')
  );

  // Estimates sub-items - Create Estimate hidden for Ops Manager
  const allEstimatesSubItems = [
    { path: '/employee/estimates/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/employee/estimates/create', icon: Plus, label: 'Create Estimate', adminOnly: true },
    { path: '/employee/estimates/list', icon: List, label: 'All Estimates' },
    { path: '/employee/estimates/amc-manager', icon: Package, label: 'AMC Packages' },
    { path: '/employee/estimates/addons', icon: PlusCircle, label: 'Add-ons' },
    { path: '/employee/estimates/archived', icon: Archive, label: 'Archived' },
  ];
  
  const estimatesSubItems = isOpsManager
    ? allEstimatesSubItems.filter(item => !item.adminOnly)
    : allEstimatesSubItems;

  const isEstimatesSectionActive = estimatesSubItems.some(item => location.pathname === item.path) || location.pathname === '/employee/estimates';

  // Vendor sub-items - All visible for Ops Manager (view-only inside)
  const vendorSubItems = [
    { path: '/employee/add-vendor', icon: UserPlus, label: 'Add Vendor' },
    { path: '/employee/vendor-details', icon: Hammer, label: 'Vendor Details' },
    { path: '/employee/assigned-vendors', icon: ClipboardCheck, label: 'Assigned Vendors' },
  ];

  // Employee sub-items - All visible for Ops Manager (view-only inside)
  const employeeSubItems = [
    { path: '/employee/add-employee', icon: UserPlus, label: 'Add Employee' },
    { path: '/employee/employee-details', icon: Users, label: 'Employee Details' },
    { path: '/employee/employee-zone-management', icon: MapPin, label: 'Employee Zone', subLabel: 'Management' },
  ];

  const isVendorSectionActive = vendorSubItems.some(item => location.pathname === item.path);
  const isEmployeeSectionActive = employeeSubItems.some(item => location.pathname === item.path);

  // Billing & Payments sub-items
  const billingPaymentsSubItems = [
    { path: '/employee/billing/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/employee/billing/generate-invoices', icon: FileText, label: 'Generated Invoices' },
    { path: '/employee/billing/invoices', icon: Receipt, label: 'Invoices' },
    { path: '/employee/billing/payments', icon: CreditCard, label: 'Payments' },
    { path: '/employee/billing/make-payments', icon: Wallet, label: 'Make Payments' },
    { path: '/employee/billing/payment-history', icon: History, label: 'Payment History' },
    { path: '/employee/billing/archived', icon: Archive, label: 'Archived' }
  ];

  // Schedules sub-items
  const schedulesSubItems = [
    { path: '/employee/schedules/dashboard', icon: BarChart3, label: 'Dashboard' },
  ];

  const isBillingPaymentsSectionActive = billingPaymentsSubItems.some(item => location.pathname === item.path) || location.pathname.startsWith('/employee/billing');
  const isSchedulesSectionActive = schedulesSubItems.some(item => location.pathname === item.path) || location.pathname.startsWith('/employee/schedules');
  
  // Accordion toggle functions - close other sections when opening one
  const toggleWorkOrders = () => {
    if (!sidebarCollapsed) {
      const opening = !workOrdersOpen;
      setWorkOrdersOpen(opening);
      if (opening) { setVendorOpen(false); setEmployeeOpen(false); setEstimatesOpen(false); setBillingPaymentsOpen(false); setSchedulesOpen(false); }
    }
  };

  const toggleVendor = () => {
    if (!sidebarCollapsed) {
      const opening = !vendorOpen;
      setVendorOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setEmployeeOpen(false); setEstimatesOpen(false); setBillingPaymentsOpen(false); setSchedulesOpen(false); }
    }
  };

  const toggleEmployee = () => {
    if (!sidebarCollapsed) {
      const opening = !employeeOpen;
      setEmployeeOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setVendorOpen(false); setEstimatesOpen(false); setBillingPaymentsOpen(false); setSchedulesOpen(false); }
    }
  };

  const toggleEstimates = () => {
    if (!sidebarCollapsed) {
      const opening = !estimatesOpen;
      setEstimatesOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setVendorOpen(false); setEmployeeOpen(false); setBillingPaymentsOpen(false); setSchedulesOpen(false); }
    }
  };

  const toggleBillingPayments = () => {
    if (!sidebarCollapsed) {
      const opening = !billingPaymentsOpen;
      setBillingPaymentsOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setVendorOpen(false); setEmployeeOpen(false); setEstimatesOpen(false); setSchedulesOpen(false); }
    }
  };

  const toggleSchedules = () => {
    if (!sidebarCollapsed) {
      const opening = !schedulesOpen;
      setSchedulesOpen(opening);
      if (opening) { setWorkOrdersOpen(false); setVendorOpen(false); setEmployeeOpen(false); setEstimatesOpen(false); setBillingPaymentsOpen(false); }
    }
  };

  // Color constants for sidebar
  const colors = {
    sidebarBg: 'linear-gradient(180deg, #23201B 0%, #1C1A17 50%, #141210 100%)',
    hoverBg: '#2A241D',
    activeBg: 'linear-gradient(90deg, #6B5228 0%, #43351F 100%)',
    activeText: '#FFFFFF',
    primaryText: '#F5F5F5',
    secondaryText: '#B8B8B8',
    primaryGold: '#D4AF37',
    iconGold: '#D9B650',
    richGold: '#C9A227',
    divider: '#3A3127',
    profileBg: '#1F1C18',
  };

  // Check if any dropdown is open
  const isAnyDropdownOpen = workOrdersOpen || vendorOpen || employeeOpen || estimatesOpen || billingPaymentsOpen || schedulesOpen;

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
        setBillingPaymentsOpen(false);
        setSchedulesOpen(false);
      }

      if (safeStorage.getItem('formDirty') === 'true') {
        e.preventDefault();
        const confirmed = window.confirm("You haven't submitted the form yet. Are you sure you want to leave this page?");
        if (confirmed) {
          safeStorage.removeItem('formDirty');
          navigate(item.path);
        }
      }
    };
    return (
      <Link
        to={item.path}
        onClick={handleClick}
        className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
        style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        title={sidebarCollapsed ? item.label : ''}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: isActive ? colors.activeText : colors.iconGold }} />
        {!sidebarCollapsed && (
          item.subLabel ? (
            <span className="flex flex-col leading-tight text-sm">
              <span>{item.label}</span>
              <span>{item.subLabel}</span>
            </span>
          ) : (
            <span className="text-sm whitespace-nowrap">{item.label}</span>
          )
        )}
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
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full shadow-xl z-50 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} w-72`}
        style={{ background: colors.sidebarBg }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} px-3 h-20`} style={{ borderBottom: `1px solid ${colors.divider}` }}>
            <img src="/logo.webp" alt="XLAND INFRA" className={`${sidebarCollapsed ? 'h-12' : 'h-14'} w-auto object-contain`} />
            {!sidebarCollapsed && (
              <div className="flex flex-col ml-2">
                <span className="text-sm font-bold tracking-wider" style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #C9A227 50%, #B8960F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>XLAND INFRA</span>
                <div className="flex items-center gap-1 -mt-0.5">
                  <div className="w-5 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A227)' }}></div>
                  <span className="text-[8px] tracking-[0.15em] font-medium" style={{ color: '#A08520' }}>PVT LTD</span>
                  <div className="w-5 h-[1px]" style={{ background: 'linear-gradient(90deg, #C9A227, transparent)' }}></div>
                </div>
              </div>
            )}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 rounded-xl transition-colors" style={{ color: colors.secondaryText }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {/* Dashboard only */}
            <NavLink item={{ path: '/employee', icon: LayoutDashboard, label: 'Dashboard' }} mobile />

            {/* Property Management - Direct link, FP selection on page */}
            <NavLink item={{ path: '/employee/customer-submissions', icon: Building2, label: 'Property Management' }} mobile />

            {/* Other nav items */}
            {navItems.filter(item => item.path !== '/employee').map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Work Orders Section */}
            <div className="mt-3 pt-3" >
              <button
                onClick={toggleWorkOrders}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{ background: (workOrdersOpen || (isWorkOrdersSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (workOrdersOpen || (isWorkOrdersSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!workOrdersOpen && !(isWorkOrdersSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!workOrdersOpen && !(isWorkOrdersSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Work Orders' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <ClipboardList className="w-5 h-5 flex-shrink-0" style={{ color: (workOrdersOpen || (isWorkOrdersSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm whitespace-nowrap">Work Orders</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ${
                    workOrdersOpen ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        workOrdersOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: workOrdersOpen ? colors.activeText : colors.iconGold }}
                    />
                  </span>
                )}
              </button>
              {workOrdersOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" >
                  {filteredWorkOrdersSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

            {/* Vendor Management Section */}
            <div className="mt-3 pt-3" >
              <button
                onClick={toggleVendor}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{ background: (vendorOpen || (isVendorSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (vendorOpen || (isVendorSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!vendorOpen && !(isVendorSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!vendorOpen && !(isVendorSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Vendor Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Store className="w-5 h-5 flex-shrink-0" style={{ color: (vendorOpen || (isVendorSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm whitespace-nowrap">Vendor Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ${
                    vendorOpen ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        vendorOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: vendorOpen ? colors.activeText : colors.iconGold }}
                    />
                  </span>
                )}
              </button>
              {vendorOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" >
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
                style={{ background: (employeeOpen || (isEmployeeSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (employeeOpen || (isEmployeeSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!employeeOpen && !(isEmployeeSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!employeeOpen && !(isEmployeeSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Employee Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Users className="w-5 h-5 flex-shrink-0" style={{ color: (employeeOpen || (isEmployeeSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm whitespace-nowrap">Employee Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ${
                    employeeOpen ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        employeeOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: employeeOpen ? colors.activeText : colors.iconGold }}
                    />
                  </span>
                )}
              </button>
              {employeeOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" >
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
                style={{ background: (estimatesOpen || (isEstimatesSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (estimatesOpen || (isEstimatesSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!estimatesOpen && !(isEstimatesSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!estimatesOpen && !(isEstimatesSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Estimates / AMC' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <FileText className="w-5 h-5 flex-shrink-0" style={{ color: (estimatesOpen || (isEstimatesSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm whitespace-nowrap">Estimates / AMC</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ${
                    estimatesOpen ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        estimatesOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: estimatesOpen ? colors.activeText : colors.iconGold }}
                    />
                  </span>
                )}
              </button>
              {estimatesOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" >
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

            {/* Billing & Payments Section */}
            <div className="mt-1">
              <button
                onClick={toggleBillingPayments}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{
                  background: (billingPaymentsOpen || (isBillingPaymentsSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent',
                  color: (billingPaymentsOpen || (isBillingPaymentsSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText,
                }}
                onMouseEnter={(e) => { if (!billingPaymentsOpen && !(isBillingPaymentsSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!billingPaymentsOpen && !(isBillingPaymentsSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Billing & Payments' : ''}
              >
                <div className={`flex items-center flex-1 min-w-0 ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <CreditCard className="w-5 h-5 flex-shrink-0" style={{ color: (billingPaymentsOpen || (isBillingPaymentsSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm truncate">Billing & Payments</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ml-2 ${
                    billingPaymentsOpen ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        billingPaymentsOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: billingPaymentsOpen ? colors.activeText : colors.iconGold }}
                    />
                  </span>
                )}
              </button>
              {billingPaymentsOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3">
                  {billingPaymentsSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

            {/* Schedules Section */}
            <div className="mt-1">
              <button
                onClick={toggleSchedules}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{
                  background: (schedulesOpen || (isSchedulesSectionActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent',
                  color: (schedulesOpen || (isSchedulesSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText,
                }}
                onMouseEnter={(e) => { if (!schedulesOpen && !(isSchedulesSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!schedulesOpen && !(isSchedulesSectionActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Schedules' : ''}
              >
                <div className={`flex items-center flex-1 min-w-0 ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: (schedulesOpen || (isSchedulesSectionActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm truncate">Schedules</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ml-2 ${
                    schedulesOpen ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        schedulesOpen ? 'rotate-180' : ''
                      }`}
                      style={{ color: schedulesOpen ? colors.activeText : colors.iconGold }}
                    />
                  </span>
                )}
              </button>
              {schedulesOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3">
                  {schedulesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile isSubItem />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* User Info & Logout */}
          <div className="px-3 py-4" >
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: colors.profileBg }}>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: colors.primaryText }}>{admin?.firstName} {admin?.lastName}</span>
                  <span className="text-xs font-medium" style={{ color: colors.primaryGold }}>{getRoleDisplay()}</span>
                </div>
                <button onClick={onLogout} className="flex items-center justify-center p-2.5 rounded-xl transition-all duration-300" style={{ border: `1px solid ${colors.richGold}`, color: colors.primaryGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={onLogout} className="flex items-center justify-center p-2.5 w-full rounded-xl transition-all duration-300" style={{ border: `1px solid ${colors.richGold}`, color: colors.primaryGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Collapse Toggle Button - Outside Sidebar */}
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-6 h-12 rounded-r-lg transition-all duration-300 shadow-md ${sidebarCollapsed ? 'left-20' : 'left-72'}`} style={{ background: '#1C1A17', border: `1px solid ${colors.divider}`, borderLeft: 'none', color: colors.iconGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = '#1C1A17'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} min-h-screen transition-all duration-300`}>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default EmployeeLayout;
