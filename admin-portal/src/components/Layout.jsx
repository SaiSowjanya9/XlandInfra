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
} from 'lucide-react';
import { useState } from 'react';

const Layout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => mobile && setSidebarOpen(false)}
        className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900 shadow-xl z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="flex items-center justify-between px-4 h-20 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="XLAND INFRA" className="h-14 w-auto object-contain" />
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-xl hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 lg:pt-16 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
