import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, Calendar, CreditCard, HelpCircle, Home, LogOut, User } from 'lucide-react';
import Logo from '../assets/LOGO 2.png';

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/dashboard/work-order', icon: ClipboardList, label: 'Work Order' },
    { path: '/dashboard/schedule', icon: Calendar, label: 'Schedule' },
    { path: '/dashboard/payment', icon: CreditCard, label: 'Payment' },
    { path: '/dashboard/contact', icon: HelpCircle, label: 'Contact / Help' },
  ];

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 shadow-lg border-b border-gold-600/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <img src={Logo} alt="XLand Infra" className="h-10 w-auto" />
              <span className="text-xl font-bold text-white hidden sm:block">
                Customer Portal
              </span>
            </Link>
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gold-600/20 text-gold-400 border border-gold-500/30'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-gold-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 text-sm">
                <div className="w-8 h-8 bg-gold-600/20 border border-gold-500/30 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gold-400" />
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-dark-400">Unit {user?.unitNumber}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-gold-600/20 z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-2 ${
                  isActive ? 'text-gold-400' : 'text-dark-400'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="text-xs mt-1 font-medium truncate max-w-[60px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
