import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, User } from 'lucide-react';
import DismissPanel from './common/DismissPanel';
import NotificationBell from './NotificationBell';
import BottomNav from './BottomNav';
import { PortalRefreshProvider } from '../hooks/usePortalRefresh';

/**
 * The portal header: the brand, the bell and the account menu.
 */
const PortalHeader = ({ user, onLogout }) => {
  const [showAccount, setShowAccount] = useState(false);

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="flex items-center space-x-3">
            <img src="/logo-contract.png" alt="XLAND INFRA" className="h-9 sm:h-10 w-auto" />
            <div className="flex flex-col">
              <span className="text-gold-600 font-bold text-base sm:text-lg leading-tight tracking-wide">XLAND INFRA</span>
              <span className="text-gray-500 text-[10px] tracking-[0.2em] leading-tight">— PVT LTD —</span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell />

            <span className="hidden sm:block w-px h-6 bg-gray-200" aria-hidden="true" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAccount(!showAccount)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <span className="w-8 h-8 bg-gold-600/15 border border-gold-500/30 rounded-full flex items-center justify-center shrink-0">
                  {initials ? (
                    <span className="text-gold-600 font-semibold text-xs">{initials}</span>
                  ) : (
                    <User className="w-4 h-4 text-gold-600" />
                  )}
                </span>
                <span className="text-sm font-medium text-gray-900 max-w-[7rem] truncate">{user?.firstName}</span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showAccount ? 'rotate-180' : ''}`} />
              </button>

              <DismissPanel
                open={showAccount}
                onDismiss={() => setShowAccount(false)}
                className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-gray-200">
                  <p className="font-medium text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  {user?.propertyCode && (
                    <p className="text-xs text-gold-600 mt-1 truncate">Property ID: {user.propertyCode}</p>
                  )}
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              </DismissPanel>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const Layout = ({ children, user, onLogout }) => {
  // The SPA's <title> is the marketing site's — name the tab for what it is
  useEffect(() => {
    document.title = 'XLAND INFRA | Customer Portal';
  }, []);

  return (
  <PortalRefreshProvider>
    <div className="min-h-screen bg-warm-page flex flex-col">
      <PortalHeader user={user} onLogout={onLogout} />

      {/* The bottom bar is fixed, so the page keeps its own height clear of it: `pb-24` lifts at
          `lg` with the bar itself, since padding that stopped at `md` would leave a tablet's last
          card sitting under it. */}
      <main className="flex-1 pb-24 lg:pb-6">
        {children}
      </main>

      <BottomNav user={user} onLogout={onLogout} />
    </div>
  </PortalRefreshProvider>
  );
};

export default Layout;
