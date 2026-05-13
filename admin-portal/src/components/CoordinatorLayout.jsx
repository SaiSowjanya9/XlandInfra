import { useState } from 'react';
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
  Clock,
  CheckCircle2,
  Plus,
  ListChecks,
  MapPin,
  Package,
  PlusCircle,
  Archive,
  User
} from 'lucide-react';

const CoordinatorLayout = ({ admin, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  const navItems = [
    { 
      path: '/coordinator', 
      icon: LayoutDashboard, 
      label: 'Dashboard',
      exact: true
    },
    { 
      path: '/coordinator/properties', 
      icon: Building2, 
      label: 'Property Management' 
    },
    { 
      path: '/coordinator/work-orders', 
      icon: ClipboardList, 
      label: 'Work Orders',
      subItems: [
        { path: '/coordinator/work-orders', label: 'All Work Orders', icon: ListChecks },
        { path: '/coordinator/work-orders/pending', label: 'Pending', icon: Clock },
        { path: '/coordinator/work-orders/completed', label: 'Completed', icon: CheckCircle2 }
      ]
    },
    { 
      path: '/coordinator/customers', 
      icon: UserPlus, 
      label: 'Add Customer' 
    },
    { 
      path: '/coordinator/vendors', 
      icon: Store, 
      label: 'Vendor Management',
      subItems: [
        { path: '/coordinator/vendors', label: 'All Vendors', icon: Store },
        { path: '/coordinator/vendors/assigned', label: 'Assigned Vendors', icon: ListChecks }
      ]
    },
    { 
      path: '/coordinator/estimates', 
      icon: FileText, 
      label: 'Estimates / AMC',
      subItems: [
        { path: '/coordinator/estimates', label: 'All Estimates', icon: FileText },
        { path: '/coordinator/estimates/create', label: 'Create Estimate', icon: Plus },
        { path: '/coordinator/estimates/archived', label: 'Archived', icon: Archive }
      ]
    }
  ];

  const toggleExpand = (path) => {
    setExpandedItems(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  const handleNavClick = (item) => {
    if (item.subItems) {
      toggleExpand(item.path);
    } else {
      navigate(item.path);
      setMobileMenuOpen(false);
    }
  };

  const handleSubItemClick = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('pm_auth_token');
    localStorage.removeItem('pm_current_user');
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="font-semibold text-gray-900">Coordinator Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-teal-600" />
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64' : 'w-20'}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900">Coordinator</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center mx-auto">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:block p-1 hover:bg-gray-100 rounded"
          >
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* User Info */}
        {sidebarOpen && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <span className="text-teal-700 font-semibold">
                  {admin?.firstName?.[0] || 'C'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {admin?.firstName} {admin?.lastName}
                </p>
                <p className="text-xs text-gray-500">Coordinator</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {navItems.map((item) => {
            const active = isActive(item);
            const expanded = expandedItems[item.path];
            const Icon = item.icon;

            return (
              <div key={item.path}>
                <button
                  onClick={() => handleNavClick(item)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                    ${active 
                      ? 'bg-teal-50 text-teal-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-teal-600' : ''}`} />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                      {item.subItems && (
                        expanded 
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                      )}
                    </>
                  )}
                </button>

                {/* Sub Items */}
                {sidebarOpen && item.subItems && expanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
                    {item.subItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const subActive = location.pathname === subItem.path;

                      return (
                        <button
                          key={subItem.path}
                          onClick={() => handleSubItemClick(subItem.path)}
                          className={`
                            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                            ${subActive 
                              ? 'bg-teal-50 text-teal-700' 
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                            }
                          `}
                        >
                          <SubIcon className="w-4 h-4" />
                          <span>{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-100 bg-white">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`
        transition-all duration-300 ease-in-out
        pt-16 lg:pt-0
        ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}
      `}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CoordinatorLayout;
