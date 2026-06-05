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
  Briefcase,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  MapPin,
  Truck,
  Hammer,
  ClipboardCheck,
  Home,
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
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-amber-100 text-amber-900'
            : 'text-gray-600 hover:bg-gray-50'
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
      <header className="lg:hidden bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="px-3 py-1 text-sm font-medium text-teal-700 bg-teal-50 rounded-full">
            Franchise Partner
          </span>
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
          {/* Top - Logged in as with badge */}
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-sm text-gray-400 mb-1.5">Logged in as</p>
            <span className="inline-block px-3 py-1 text-sm font-medium text-teal-700 bg-teal-50 rounded-full">
              Franchise Partner
            </span>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden absolute right-4 top-4 p-2 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
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

          {/* Bottom - Logout */}
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 text-sm w-full"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
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

export default FPLayout;
