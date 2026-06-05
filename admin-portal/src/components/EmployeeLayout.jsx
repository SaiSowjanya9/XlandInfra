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
  Briefcase,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  Shield,
  MapPin,
  QrCode,
  UserCog,
  Building,
  RefreshCw,
  Home,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFP } from '../contexts/FPContext';

const EmployeeLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // FP Context for selecting franchise partner
  const { fpList, selectedFp, selectFp, selectedPropertyType, setSelectedPropertyType, loading: fpLoading, refreshFpList } = useFP();
  
  // Check if user is Operations Manager (restricted access)
  const isOpsManager = false;

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
    { path: '/employee/create-customer', icon: FileInput, label: 'Add Customer', adminOnly: true },
    { path: '/employee/user-management', icon: Shield, label: 'User Management', adminOnly: true },
    { path: '/employee/qr-management', icon: QrCode, label: 'QR Management' },
  ];
  
  // Filter nav items for Operations Manager
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

  // Vendor sub-items - Add Vendor hidden for Ops Manager
  const allVendorSubItems = [
    { path: '/employee/add-vendor', icon: UserPlus, label: 'Add Vendor', adminOnly: true },
    { path: '/employee/vendor-details', icon: Hammer, label: 'Vendor Details' },
    { path: '/employee/assigned-vendors', icon: ClipboardCheck, label: 'Assigned Vendors' },
  ];
  
  const vendorSubItems = isOpsManager
    ? allVendorSubItems.filter(item => !item.adminOnly)
    : allVendorSubItems;

  // Employee sub-items - Add Employee hidden for Ops Manager
  const allEmployeeSubItems = [
    { path: '/employee/add-employee', icon: UserPlus, label: 'Add Employee', adminOnly: true },
    { path: '/employee/employee-details', icon: Users, label: 'Employee Details' },
    { path: '/employee/employee-zone-management', icon: MapPin, label: 'Employee Zone Management' },
  ];
  
  const employeeSubItems = isOpsManager
    ? allEmployeeSubItems.filter(item => !item.adminOnly)
    : allEmployeeSubItems;

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
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-primary-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
            <Briefcase className="w-6 h-6 text-primary-600" />
            <span className="font-bold text-gray-900">{admin?.role === 'admin' ? 'Admin Portal' : 'Operations Manager'}</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Briefcase className="w-8 h-8 text-primary-600" />
              <span className="font-bold text-lg text-gray-900">{admin?.role === 'admin' ? 'Admin' : 'Ops Manager'}</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin Info */}
          <div className="px-6 py-3 border-b border-gray-200">
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-semibold text-gray-900">
              {admin?.firstName} {admin?.lastName}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
              {admin?.role === 'admin' ? 'Admin' : 'Operations Manager'}
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {/* Dashboard only */}
            <NavLink item={{ path: '/employee', icon: LayoutDashboard, label: 'Dashboard' }} mobile />

            {/* Property Management - Direct link, FP selection on page */}
            <NavLink item={{ path: '/employee/customer-submissions', icon: Building2, label: 'Property Management' }} mobile />

            {/* Other nav items (Work Orders, etc.) */}
            {navItems.filter(item => item.path !== '/employee').map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Vendor Management Section */}
            <div className="mt-2">
              <button
                onClick={() => setVendorOpen(!vendorOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  isVendorSectionActive && !vendorOpen
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {vendorSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Employee Management Section */}
            <div className="mt-2">
              <button
                onClick={() => setEmployeeOpen(!employeeOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  isEmployeeSectionActive && !employeeOpen
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {employeeSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

            {/* Estimates Section */}
            <div className="mt-2">
              <button
                onClick={() => setEstimatesOpen(!estimatesOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  isEstimatesSectionActive && !estimatesOpen
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default EmployeeLayout;
