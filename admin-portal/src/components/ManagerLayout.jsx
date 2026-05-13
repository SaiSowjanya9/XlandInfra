import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  UserPlus,
  Store,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bell,
  Settings
} from 'lucide-react';

const ManagerLayout = ({ admin, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});

  const navItems = [
    {
      path: '/manager',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      path: '/manager/properties',
      icon: Building2,
      label: 'Property Management'
    },
    {
      path: '/manager/work-orders',
      icon: ClipboardList,
      label: 'Work Orders',
      subItems: [
        { path: '/manager/work-orders', label: 'All Work Orders' },
        { path: '/manager/work-orders/pending', label: 'Pending' },
        { path: '/manager/work-orders/completed', label: 'Completed' }
      ]
    },
    {
      path: '/manager/customers',
      icon: UserPlus,
      label: 'Add Customer'
    },
    {
      path: '/manager/vendors',
      icon: Store,
      label: 'Vendor Management',
      subItems: [
        { path: '/manager/vendors', label: 'All Vendors' },
        { path: '/manager/vendors/add', label: 'Add Vendor' },
        { path: '/manager/vendors/assigned', label: 'Assigned Vendors' }
      ]
    },
    {
      path: '/manager/estimates',
      icon: FileText,
      label: 'Estimates / AMC',
      subItems: [
        { path: '/manager/estimates', label: 'All Estimates' },
        { path: '/manager/estimates/create', label: 'Create Estimate' },
        { path: '/manager/estimates/archived', label: 'Archived' }
      ]
    }
  ];

  const isActive = (path) => {
    if (path === '/manager') {
      return location.pathname === '/manager';
    }
    return location.pathname.startsWith(path);
  };

  const toggleSubmenu = (path) => {
    setExpandedMenus(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  useEffect(() => {
    // Expand menu if a subitem is active
    navItems.forEach(item => {
      if (item.subItems) {
        const isSubActive = item.subItems.some(sub => location.pathname === sub.path);
        if (isSubActive) {
          setExpandedMenus(prev => ({ ...prev, [item.path]: true }));
        }
      }
    });
  }, [location.pathname]);

  const handleNavigation = (item) => {
    if (item.subItems) {
      toggleSubmenu(item.path);
    } else {
      navigate(item.path);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Manager Portal</span>
        </div>
        <button className="p-2 rounded-lg hover:bg-gray-100">
          <Bell className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40 transition-all duration-300 
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            {isSidebarOpen && (
              <div>
                <h1 className="font-bold text-gray-900 text-sm">Manager Portal</h1>
                <p className="text-xs text-gray-500">Operations Management</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:block p-1.5 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-8rem)]">
          {navItems.map((item) => (
            <div key={item.path}>
              <button
                onClick={() => handleNavigation(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isActive(item.path)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.path) ? 'text-blue-600' : ''}`} />
                {isSidebarOpen && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    {item.subItems && (
                      expandedMenus[item.path]
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                    )}
                  </>
                )}
              </button>

              {/* Submenu */}
              {item.subItems && expandedMenus[item.path] && isSidebarOpen && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.subItems.map((subItem) => (
                    <button
                      key={subItem.path}
                      onClick={() => {
                        navigate(subItem.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                        ${location.pathname === subItem.path
                          ? 'text-blue-700 bg-blue-50 font-medium'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-100 bg-white">
          <div className={`flex items-center gap-3 ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
              {admin?.firstName?.[0] || admin?.username?.[0] || 'M'}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {admin?.firstName} {admin?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">Manager</p>
              </div>
            )}
            {isSidebarOpen && (
              <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} pt-16 lg:pt-0`}>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default ManagerLayout;
