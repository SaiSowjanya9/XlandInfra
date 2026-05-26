import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  Settings,
  Store,
  UserPlus,
  Hammer,
  ClipboardCheck,
  MapPin,
  Home,
  Users
} from 'lucide-react';

const ManagerLayout = ({ admin, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});

  // Check if this is an FP-created Manager (has franchisePartnerId)
  const isFPManager = !!admin?.franchisePartnerId;

  // Nav items - Add Customer removed for all managers
  const navItems = [
    { path: '/manager', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/manager/properties', icon: Building2, label: 'Property Management' },
    { path: '/manager/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/manager/employees/zones', icon: MapPin, label: 'Employee Zone Management' },
  ];

  // Vendor sub-items - Add Vendor hidden for FP Manager
  const allVendorSubItems = [
    { path: '/manager/vendors/add', icon: UserPlus, label: 'Add Vendor', adminOnly: true },
    { path: '/manager/vendors', icon: Hammer, label: 'Vendor Details' },
    { path: '/manager/vendors/assigned', icon: ClipboardCheck, label: 'Assigned Vendors' }
  ];
  const vendorSubItems = isFPManager ? allVendorSubItems.filter(item => !item.adminOnly) : allVendorSubItems;

  // Estimates sub-items
  const estimatesSubItems = [
    { path: '/manager/estimates/create', icon: Plus, label: 'Create Estimate' },
    { path: '/manager/estimates', icon: List, label: 'All Estimates' },
    { path: '/manager/estimates/amc', icon: Package, label: 'AMC Packages' },
    { path: '/manager/estimates/addons', icon: PlusCircle, label: 'Add-ons' },
    { path: '/manager/estimates/archived', icon: Archive, label: 'Archived' }
  ];

  // Customer sub-items
  const customerSubItems = [
    { path: '/manager/customers/add', icon: UserPlus, label: 'Add Customer' },
    { path: '/manager/customers', icon: List, label: 'Customer List' }
  ];

  const isVendorActive = vendorSubItems.some(item => location.pathname === item.path);
  const isEstimatesActive = estimatesSubItems.some(item => location.pathname === item.path) || location.pathname === '/manager/estimates';
  const isCustomerActive = customerSubItems.some(item => location.pathname === item.path);

  useEffect(() => {
    if (isVendorActive) setExpandedMenus(prev => ({ ...prev, vendors: true }));
    if (isEstimatesActive) setExpandedMenus(prev => ({ ...prev, estimates: true }));
    if (isCustomerActive) setExpandedMenus(prev => ({ ...prev, customers: true }));
  }, [location.pathname]);

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => mobile && setSidebarOpen(false)}
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
            <Settings className="w-6 h-6 text-primary-600" />
            <span className="font-bold text-gray-900">Manager</span>
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
              <Settings className="w-8 h-8 text-primary-600" />
              <span className="font-bold text-lg text-gray-900">Manager</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin Info */}
          <div className="px-6 py-4 border-b border-gray-200">
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-semibold text-gray-900">
              {admin?.firstName} {admin?.lastName}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
              Manager
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Customer Management Section */}
            <div className="mt-2">
              <button
                onClick={() => setExpandedMenus(prev => ({ ...prev, customers: !prev.customers }))}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  isCustomerActive && !expandedMenus.customers
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Home className="w-5 h-5" />
                  <span className="font-medium">Customer Management</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.customers ? 'rotate-180' : ''}`} />
              </button>
              {expandedMenus.customers && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {customerSubItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                          location.pathname === item.path
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vendor Management Section */}
            <div className="mt-2">
              <button
                onClick={() => setExpandedMenus(prev => ({ ...prev, vendors: !prev.vendors }))}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  isVendorActive && !expandedMenus.vendors
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Store className="w-5 h-5" />
                  <span className="font-medium">Vendor Management</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.vendors ? 'rotate-180' : ''}`} />
              </button>
              {expandedMenus.vendors && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {vendorSubItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                          location.pathname === item.path
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Estimates Section */}
            <div className="mt-2">
              <button
                onClick={() => setExpandedMenus(prev => ({ ...prev, estimates: !prev.estimates }))}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  isEstimatesActive && !expandedMenus.estimates
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Estimates / AMC</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.estimates ? 'rotate-180' : ''}`} />
              </button>
              {expandedMenus.estimates && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                  {estimatesSubItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                          location.pathname === item.path
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
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
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default ManagerLayout;
