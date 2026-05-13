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
  PanelLeft,
  PanelLeftClose,
  Briefcase,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  Shield,
  MapPin,
  Truck,
} from 'lucide-react';
import { useState } from 'react';

const FPLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [vendorOpen, setVendorOpen] = useState(
    location.pathname.startsWith('/fp/vendors')
  );

  const [employeeOpen, setEmployeeOpen] = useState(
    location.pathname.startsWith('/fp/employees')
  );

  const [estimatesOpen, setEstimatesOpen] = useState(
    location.pathname.startsWith('/fp/estimates')
  );

  const navItems = [
    { path: '/fp', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/fp/properties', icon: Building2, label: 'Property Management' },
    { path: '/fp/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/fp/customers', icon: UserPlus, label: 'Add Customer' },
  ];

  const vendorSubItems = [
    { path: '/fp/vendors', icon: Store, label: 'All Vendors' },
    { path: '/fp/vendors/add', icon: Plus, label: 'Add Vendor' },
    { path: '/fp/vendors/assigned', icon: Truck, label: 'Assigned Vendors' },
  ];

  const employeeSubItems = [
    { path: '/fp/employees', icon: Users, label: 'All Employees' },
    { path: '/fp/employees/add', icon: Plus, label: 'Add Employee' },
    { path: '/fp/employees/zones', icon: MapPin, label: 'Zone Management' },
  ];

  const estimatesSubItems = [
    { path: '/fp/estimates', icon: List, label: 'All Estimates' },
    { path: '/fp/estimates/create', icon: Plus, label: 'Create Estimate' },
    { path: '/fp/estimates/amc', icon: Package, label: 'AMC Packages' },
    { path: '/fp/estimates/addons', icon: PlusCircle, label: 'Add-ons' },
    { path: '/fp/estimates/archived', icon: Archive, label: 'Archived' },
  ];

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
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30'
            : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white shadow-sm border-b border-emerald-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-emerald-50">
            <Menu className="w-6 h-6 text-emerald-600" />
          </button>
          <div className="flex items-center space-x-2">
            <Briefcase className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-gray-900">FP Portal</span>
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
        className={`fixed top-0 left-0 h-full ${sidebarExpanded ? 'lg:w-80' : 'w-64'} bg-white/95 backdrop-blur-sm border-r border-emerald-100 z-50 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/80">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-300/50">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">Franchise Partner</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarExpanded((prev) => !prev)}
                className="hidden lg:flex p-2 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors duration-200"
                title={sidebarExpanded ? 'Set normal width' : 'Expand panel width'}
                aria-label={sidebarExpanded ? 'Set normal width' : 'Expand panel width'}
              >
                {sidebarExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-emerald-50">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Admin Info */}
          <div className="px-6 py-4 border-b border-emerald-50 bg-white">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Signed in as</p>
            <p className="font-semibold text-gray-900 mt-1">
              {admin?.firstName || admin?.name?.split(' ')[0]} {admin?.lastName || admin?.name?.split(' ').slice(1).join(' ')}
            </p>
            {admin?.companyName && (
              <p className="text-sm text-slate-500 mt-0.5">{admin.companyName}</p>
            )}
            <span className="inline-block mt-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
              Franchise Partner
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/80">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Menu</p>
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}

            {/* Vendor Management Section */}
            <div className="mt-2">
              <button
                onClick={() => setVendorOpen(!vendorOpen)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                  isVendorSectionActive && !vendorOpen
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-emerald-100 pl-2">
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
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                  isEmployeeSectionActive && !employeeOpen
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-emerald-100 pl-2">
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
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${
                  isEstimatesSectionActive && !estimatesOpen
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
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
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-emerald-100 pl-2">
                  {estimatesSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile />
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-emerald-50 bg-white">
            <button
              onClick={onLogout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarExpanded ? 'lg:ml-80' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default FPLayout;
