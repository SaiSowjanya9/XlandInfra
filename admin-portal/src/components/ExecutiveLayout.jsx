import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  CheckCircle,
  Package,
  PlusCircle,
  Archive,
  MapPin,
  Eye,
  Briefcase
} from 'lucide-react';

const ExecutiveLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState(['work-orders', 'employees', 'estimates']);

  const navItems = [
    {
      path: '/executive',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      path: '/executive/properties',
      icon: Building2,
      label: 'Property Management'
    },
    {
      id: 'work-orders',
      icon: ClipboardList,
      label: 'Work Orders',
      subItems: [
        { path: '/executive/work-orders', label: 'All Work Orders', icon: ClipboardList },
        { path: '/executive/work-orders/pending', label: 'Pending', icon: Clock },
        { path: '/executive/work-orders/completed', label: 'Completed', icon: CheckCircle }
      ]
    },
    {
      path: '/executive/customers',
      icon: UserPlus,
      label: 'Add Customer'
    },
    {
      path: '/executive/vendors',
      icon: Store,
      label: 'Vendor Management'
    },
    {
      id: 'estimates',
      icon: FileText,
      label: 'Estimates / AMC',
      subItems: [
        { path: '/executive/estimates', label: 'All Estimates', icon: FileText },
        { path: '/executive/estimates/create', label: 'Create Estimate', icon: PlusCircle },
        { path: '/executive/estimates/archived', label: 'Archived', icon: Archive }
      ]
    }
  ];

  const toggleExpanded = (id) => {
    setExpandedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => {
    if (item.subItems) {
      return item.subItems.some(sub => location.pathname === sub.path);
    }
    return false;
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const renderNavItem = (item) => {
    if (item.subItems) {
      const isExpanded = expandedItems.includes(item.id);
      const parentActive = isParentActive(item);

      return (
        <div key={item.id}>
          <button
            onClick={() => toggleExpanded(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
              parentActive
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span className="font-medium">{item.label}</span>}
            </div>
            {sidebarOpen && (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            )}
          </button>
          {sidebarOpen && isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.subItems.map(sub => (
                <button
                  key={sub.path}
                  onClick={() => handleNavigation(sub.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive(sub.path)
                      ? 'bg-indigo-500 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <sub.icon className="w-4 h-4" />
                  <span>{sub.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.path}
        onClick={() => handleNavigation(item.path)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
          isActive(item.path)
            ? 'bg-indigo-500 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <item.icon className="w-5 h-5" />
        {sidebarOpen && <span className="font-medium">{item.label}</span>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-gray-900">Executive</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(renderNavItem)}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-gray-100">
          {sidebarOpen && (
            <div className="mb-3 px-3">
              <p className="font-medium text-gray-900 truncate">
                {admin?.firstName || 'Executive'}
              </p>
              <p className="text-sm text-gray-500 truncate">{admin?.email}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Executive</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navItems.map(renderNavItem)}
          </nav>
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:p-6 p-4 pt-20 md:pt-6 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default ExecutiveLayout;
