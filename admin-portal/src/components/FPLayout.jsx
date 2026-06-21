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
} from 'lucide-react';
import { useState } from 'react';

const FPLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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

  const [vendorOpen, setVendorOpen] = useState(
    location.pathname.startsWith('/fp/vendors')
  );

  const [employeeOpen, setEmployeeOpen] = useState(
    location.pathname.startsWith('/fp/employees')
  );

  const [estimatesOpen, setEstimatesOpen] = useState(
    location.pathname.startsWith('/fp/estimates')
  );

  // Base nav items - Add Customer is standalone (not expandable)
  const navItems = [
    { path: '/fp', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/fp/properties', icon: Building2, label: 'Property Management' },
    { path: '/fp/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/fp/customers/add', icon: UserPlus, label: 'Add Customer' },
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
    { path: '/fp/estimates/create', icon: Plus, label: 'Create Estimate' },
    { path: '/fp/estimates', icon: List, label: 'All Estimates' },
    { path: '/fp/estimates/amc', icon: Package, label: 'AMC Packages' },
    { path: '/fp/estimates/addons', icon: PlusCircle, label: 'Add-ons' },
    { path: '/fp/estimates/archived', icon: Archive, label: 'Archived Estimates' },
  ];
  
  const estimatesSubItems = allEstimatesSubItems;

  const isVendorSectionActive = vendorSubItems.some(item => location.pathname === item.path);
  const isEmployeeSectionActive = employeeSubItems.some(item => location.pathname === item.path);
  const isEstimatesSectionActive = estimatesSubItems.some(item => location.pathname === item.path);

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
        className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-900 shadow-md font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Desktop Top Header Bar */}
      <header className="hidden lg:flex fixed top-0 right-0 left-64 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/50 z-30 items-center justify-end px-6 shadow-sm">
        <div className="flex items-center gap-4">
          {/* User Profile */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm shadow-md">
              {getInitials()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">
                {admin?.firstName} {admin?.lastName}
              </span>
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Crown className="w-3 h-3" />
                {getRoleDisplay()}
              </span>
            </div>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 text-amber-400 font-medium 
                     hover:from-slate-700 hover:to-slate-600 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02]
                     border border-slate-600/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <Menu className="w-6 h-6 text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-900 font-bold text-xs">
              {getInitials()}
            </div>
            <span className="font-semibold text-slate-800">{admin?.firstName}</span>
          </div>
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
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                <Crown className="w-5 h-5 text-slate-900" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-sm">{getRoleDisplay()}</span>
                <span className="text-xs text-slate-500">Portal</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Vendor Management Section */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setVendorOpen(!vendorOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isVendorSectionActive && !vendorOpen
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Store className="w-5 h-5" />
                  <span className="font-medium">Vendor Management</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    vendorOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {vendorOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-amber-200 pl-3">
                  {vendorSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Employee Management Section */}
            <div className="mt-1">
              <button
                onClick={() => setEmployeeOpen(!employeeOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isEmployeeSectionActive && !employeeOpen
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Employee Management</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    employeeOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {employeeOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-amber-200 pl-3">
                  {employeeSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Estimates Section */}
            <div className="mt-1">
              <button
                onClick={() => setEstimatesOpen(!estimatesOpen)}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isEstimatesSectionActive && !estimatesOpen
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Estimates / AMC</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    estimatesOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {estimatesOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-amber-200 pl-3">
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* Footer branding */}
          <div className="p-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-xs text-slate-400">XLAND INFRA</p>
              <p className="text-xs text-slate-300">Management System</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 lg:pt-16 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default FPLayout;
