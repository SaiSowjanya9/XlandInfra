import { Link } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import BrandLogo from './BrandLogo';

const Layout = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 shadow-lg border-b border-gold-600/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-4">
              <BrandLogo size="sm" className="hidden sm:flex" />
              <BrandLogo size="xs" showText={false} className="sm:hidden" />
            </Link>
            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-3 text-sm bg-dark-700/50 px-3 py-2 rounded-xl border border-dark-600/50">
                <div className="w-9 h-9 bg-gradient-to-br from-gold-500/30 to-gold-600/20 border border-gold-500/40 rounded-full flex items-center justify-center shadow-lg shadow-gold-500/10">
                  <User className="w-4 h-4 text-gold-400" />
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{user?.firstName} {user?.lastName}</p>
                </div>
                <LogOut 
                  onClick={onLogout}
                  className="w-5 h-5 text-dark-400 hover:text-red-400 cursor-pointer transition-colors ml-2"
                  title="Logout"
                />
              </div>
              <button
                onClick={onLogout}
                className="sm:hidden p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
