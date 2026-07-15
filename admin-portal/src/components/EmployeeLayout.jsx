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
    { path: '/employee/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/employee/create-customer', icon: FileInput, label: 'Add Customer' },
    { path: '/employee/user-management', icon: Shield, label: 'User Management', adminOnly: true },
    { path: '/employee/qr-management', icon: QrCode, label: 'QR Management' },
  ];
  
  // Filter nav items for Operations Manager (only User Management is hidden)
  const navItems = isOpsManager 
    ? allNavItems.filter(item => !item.adminOnly)
    : allNavItems;

  const [estimatesOpen, setEstimatesOpen] = useState(
    location.pathname.startsWith('/employee/estimates')
  );

  // Estimates sub-items - Create Estimate hidden for Ops Manager
  const allEstimatesSubItems = [
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
    { path: '/employee/employee-zone-management', icon: MapPin, label: 'Employee Zone Management' },
  ];

  const isVendorSectionActive = vendorSubItems.some(item => location.pathname === item.path);
  const isEmployeeSectionActive = employeeSubItems.some(item => location.pathname === item.path);

  // Accordion toggle functions - close other sections when opening one
  const toggleVendor = () => {
    if (!sidebarCollapsed) {
      const opening = !vendorOpen;
      setVendorOpen(opening);
      if (opening) { setEmployeeOpen(false); setEstimatesOpen(false); }
    }
  };

  const toggleEmployee = () => {
    if (!sidebarCollapsed) {
      const opening = !employeeOpen;
      setEmployeeOpen(opening);
      if (opening) { setVendorOpen(false); setEstimatesOpen(false); }
    }
  };

  const toggleEstimates = () => {
    if (!sidebarCollapsed) {
      const opening = !estimatesOpen;
      setEstimatesOpen(opening);
      if (opening) { setVendorOpen(false); setEmployeeOpen(false); }
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

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const handleClick = (e) => {
      if (mobile) setSidebarOpen(false);

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
        {!sidebarCollapsed && <span className="text-sm max-w-[160px] leading-tight">{item.label}</span>}
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
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
        style={{ background: colors.sidebarBg }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} px-3 h-20`} style={{ borderBottom: `1px solid ${colors.divider}` }}>
            <img src="/logo.webp" alt="XLAND INFRA" className={`${sidebarCollapsed ? 'h-10' : 'h-12'} w-auto object-contain`} />
            {!sidebarCollapsed && (
              <div className="flex flex-col ml-2">
                <span className="text-lg font-bold tracking-wider" style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #C9A227 50%, #B8960F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>XLAND INFRA</span>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <div className="w-6 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A227)' }}></div>
                  <span className="text-[9px] tracking-[0.2em] font-medium" style={{ color: '#A08520' }}>PVT LTD</span>
                  <div className="w-6 h-[1px]" style={{ background: 'linear-gradient(90deg, #C9A227, transparent)' }}></div>
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

            {/* Other nav items (Work Orders, etc.) */}
            {navItems.filter(item => item.path !== '/employee').map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Vendor Management Section */}
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.divider}` }}>
              <button
                onClick={toggleVendor}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{ background: isVendorSectionActive ? colors.activeBg : 'transparent', color: isVendorSectionActive ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!isVendorSectionActive) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!isVendorSectionActive) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Vendor Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Store className="w-5 h-5 flex-shrink-0" style={{ color: isVendorSectionActive ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm">Vendor Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${vendorOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {vendorOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {vendorSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Employee Management Section */}
            <div className="mt-1">
              <button
                onClick={toggleEmployee}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{ background: isEmployeeSectionActive ? colors.activeBg : 'transparent', color: isEmployeeSectionActive ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!isEmployeeSectionActive) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!isEmployeeSectionActive) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Employee Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Users className="w-5 h-5 flex-shrink-0" style={{ color: isEmployeeSectionActive ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm">Employee Management</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${employeeOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {employeeOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {employeeSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Estimates Section */}
            <div className="mt-1">
              <button
                onClick={toggleEstimates}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{ background: isEstimatesSectionActive ? colors.activeBg : 'transparent', color: isEstimatesSectionActive ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!isEstimatesSectionActive) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!isEstimatesSectionActive) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Estimates / AMC' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <FileText className="w-5 h-5 flex-shrink-0" style={{ color: isEstimatesSectionActive ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm">Estimates / AMC</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${estimatesOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {estimatesOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" style={{ borderLeft: `2px solid ${colors.divider}` }}>
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* User Info & Logout */}
          <div className="px-3 py-4" style={{ borderTop: `1px solid ${colors.divider}` }}>
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
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-6 h-12 rounded-r-lg transition-all duration-300 shadow-md ${sidebarCollapsed ? 'left-20' : 'left-64'}`} style={{ background: '#1C1A17', border: `1px solid ${colors.divider}`, borderLeft: 'none', color: colors.iconGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = '#1C1A17'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} min-h-screen transition-all duration-300`}>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default EmployeeLayout;
