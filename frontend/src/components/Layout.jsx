import { Link } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import BrandLogo from './BrandLogo';

const Layout = ({ children, user, onLogout }) => {
  return (
    <div className="min-h-screen bg-warm-page flex flex-col">
      {/* Header */}
      <header className="bg-warm-section shadow-lg border-b border-warm-accent-hover/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <img src="/logo.png" alt="XLAND INFRA" className="h-10 w-auto" />
              <div className="flex flex-col">
                <span className="text-warm-accent-hover font-bold text-lg leading-tight tracking-wide">XLAND INFRA</span>
                <span className="text-warm-muted text-[10px] tracking-[0.2em] leading-tight">— PVT LTD —</span>
              </div>
            </Link>
            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-3 text-sm bg-warm-accent-soft px-3 py-2 rounded-xl border border-warm-border">
                <div className="w-9 h-9 bg-gradient-to-br from-warm-accent/30 to-warm-accent-hover/20 border border-warm-accent/40 rounded-full flex items-center justify-center shadow-lg shadow-warm-accent/10">
                  <User className="w-4 h-4 text-warm-accent-hover" />
                </div>
                <div className="text-right">
                  <p className="font-medium text-warm-text">{user?.firstName} {user?.lastName}</p>
                </div>
                <LogOut 
                  onClick={onLogout}
                  className="w-5 h-5 text-warm-muted hover:text-red-600 cursor-pointer transition-colors ml-2"
                  title="Logout"
                />
              </div>
              <button
                onClick={onLogout}
                className="sm:hidden p-2 text-warm-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
