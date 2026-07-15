import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
  Bell,
  Settings,
  FileText,
  Users,
} from 'lucide-react';
import { useState } from 'react';

const VendorLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/vendor', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/vendor/orders', icon: FileText, label: 'Orders' },
    { path: '/vendor/clients', icon: Users, label: 'Clients' },
  ];

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => mobile && setSidebarOpen(false)}
        className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ${
          isActive
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-amber-400'}`} />
          <span className="font-medium whitespace-nowrap text-sm">{item.label}</span>
        </div>
        {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Mobile Header */}
      <header className="lg:hidden bg-slate-900/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Menu className="w-6 h-6 text-amber-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Vendor Portal</span>
          </div>
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors relative">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-white/5 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 h-20 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-lg">Vendor</span>
                <span className="text-xs text-slate-500 block">Portal</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Admin Info */}
          <div className="px-6 py-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-white/10">
                <span className="text-white font-semibold text-sm">
                  {admin?.firstName?.[0]}{admin?.lastName?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">
                  {admin?.firstName} {admin?.lastName}
                </p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  Partner
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            <p className="px-4 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-4">Navigation</p>
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/5 space-y-2">
            <button className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white rounded-xl transition-all duration-300">
              <Settings className="w-5 h-5" />
              <span className="font-medium whitespace-nowrap text-sm">Settings</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium whitespace-nowrap text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen bg-slate-950">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default VendorLayout;
