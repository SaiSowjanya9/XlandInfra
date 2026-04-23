import { Link, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  FolderTree,
  LogOut,
  Users,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const CustomerLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/customer', icon: ClipboardList, label: 'Work Orders' },
    { path: '/customer/categories', icon: FolderTree, label: 'Categories' },
  ];

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => mobile && setSidebarOpen(false)}
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
            : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-emerald-50/30">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white shadow-sm border-b border-emerald-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-emerald-50">
            <Menu className="w-6 h-6 text-emerald-600" />
          </button>
          <div className="flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-gray-900">Customer Portal</span>
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
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-emerald-100 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-emerald-100">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">Customer</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-emerald-50">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin Info */}
          <div className="px-6 py-4 border-b border-emerald-50">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Signed in as</p>
            <p className="font-semibold text-gray-900 mt-1">
              {admin?.firstName} {admin?.lastName}
            </p>
            <span className="inline-block mt-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
              Customer
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Menu</p>
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile />
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-emerald-50">
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
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default CustomerLayout;
