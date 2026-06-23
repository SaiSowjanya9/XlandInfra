import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { useState } from 'react';
import { useFP } from '../contexts/FPContext';

const EmployeeLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // FP Context for selecting franchise partner
  const { fpList, selectedFp, selectFp, selectedPropertyType, setSelectedPropertyType, loading: fpLoading, refreshFpList } = useFP();
  
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

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const handleClick = (e) => {
      if (mobile) setSidebarOpen(false);

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
        className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
        title={sidebarCollapsed ? item.label : ''}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
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
        className={`fixed top-0 left-0 h-full bg-slate-800 shadow-xl z-50 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} px-3 h-24 border-b border-slate-700/50`}>
            <img src="/logo.png" alt="XLAND INFRA" className={`${sidebarCollapsed ? 'h-12' : 'h-16'} w-auto object-contain`} />
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 rounded-xl hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
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
            <div className="mt-3 pt-3 border-t border-slate-700">
              <button
                onClick={() => !sidebarCollapsed && setVendorOpen(!vendorOpen)}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isVendorSectionActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                title={sidebarCollapsed ? 'Vendor Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Store className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="font-medium">Vendor Management</span>}
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-3">
                  {vendorSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Employee Management Section */}
            <div className="mt-1">
              <button
                onClick={() => !sidebarCollapsed && setEmployeeOpen(!employeeOpen)}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isEmployeeSectionActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                title={sidebarCollapsed ? 'Employee Management' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <Users className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="font-medium">Employee Management</span>}
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-3">
                  {employeeSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Estimates Section */}
            <div className="mt-1">
              <button
                onClick={() => !sidebarCollapsed && setEstimatesOpen(!estimatesOpen)}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isEstimatesSectionActive
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
                title={sidebarCollapsed ? 'Estimates / AMC' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span className="font-medium">Estimates / AMC</span>}
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-3">
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* User Info */}
          <div className="px-3 py-3 border-t border-slate-700/50">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              {!sidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">
                    {admin?.firstName} {admin?.lastName}
                  </span>
                  <span className="text-xs text-amber-400 font-medium">
                    {getRoleDisplay()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Logout Button at Bottom */}
          <div className="px-3 py-4 border-t border-slate-700/50">
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-slate-800 text-amber-400 font-medium 
                       hover:bg-slate-700 transition-all duration-300 border border-slate-700"
              title={sidebarCollapsed ? 'Logout' : ''}
            >
              <LogOut className="w-4 h-4" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Collapse Toggle Button - Outside Sidebar */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-6 h-12 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-r-lg border border-l-0 border-slate-600 transition-all duration-300 shadow-md ${
          sidebarCollapsed ? 'left-20' : 'left-64'
        }`}
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

export default EmployeeLayout;
