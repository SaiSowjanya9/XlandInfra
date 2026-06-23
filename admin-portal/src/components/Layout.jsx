import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  ClipboardList, 
  LogOut,
  Menu,
  X,
  FolderTree,
  FileInput,
  Crown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useState } from 'react';

const Layout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get user initials for avatar
  const getInitials = () => {
    const first = admin?.firstName?.[0] || '';
    const last = admin?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'A';
  };

  // Get role display
  const getRoleDisplay = () => {
    return admin?.role === 'admin' ? 'Admin' : 'Executive';
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/customer-submissions', icon: Building2, label: 'Property Management' },
    { path: '/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/categories', icon: FolderTree, label: 'Categories' },
    { path: '/create-customer', icon: FileInput, label: 'Create Customer' },
  ];

  const NavLink = ({ item, mobile = false, collapsed = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => mobile && setSidebarOpen(false)}
        className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-amber-400 text-slate-900 font-semibold'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
        title={collapsed ? item.label : ''}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="font-medium">{item.label}</span>}
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
        className={`fixed top-0 left-0 h-full bg-slate-900 shadow-xl z-50 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start gap-3'} px-3 h-20 border-b border-slate-700/50`}>
            <img src="/logo.png" alt="XLAND INFRA" className={`${sidebarCollapsed ? 'h-12' : 'h-14'} w-auto object-contain`} />
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-amber-400 tracking-wide">XLAND INFRA</span>
                <span className="text-[10px] text-amber-400/80 tracking-[0.2em]">PVT LTD</span>
              </div>
            )}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 rounded-xl hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile collapsed={sidebarCollapsed} />
            ))}
          </nav>

          {/* User Info */}
          <div className="px-3 py-3 border-t border-slate-700/50">
            {!sidebarCollapsed && (
              <div className="flex flex-col items-center text-center">
                <span className="text-sm font-semibold text-white">
                  {admin?.firstName} {admin?.lastName}
                </span>
                <span className="text-xs text-amber-400 font-medium">
                  {getRoleDisplay()}
                </span>
              </div>
            )}
          </div>

          {/* Logout Button at Bottom */}
          <div className="px-3 py-4 border-t border-slate-700/50">
            <button
              onClick={onLogout}
              className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-slate-800 text-amber-400 font-medium 
                       hover:bg-slate-700 transition-all duration-300 border border-slate-700`}
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
        className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-6 h-12 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-r-lg border border-l-0 border-slate-700 transition-all duration-300 shadow-md ${
          sidebarCollapsed ? 'left-20' : 'left-64'
        }`}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} min-h-screen transition-all duration-300`}>
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
