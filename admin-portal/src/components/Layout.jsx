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
  ChevronDown,
  Plus,
  List,
  Clock,
  UserPlus,
  CheckCircle,
  Archive,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const Layout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workOrdersOpen, setWorkOrdersOpen] = useState(
    location.pathname.startsWith('/work-orders')
  );

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
    { path: '/categories', icon: FolderTree, label: 'Categories' },
    { path: '/create-customer', icon: FileInput, label: 'Create Customer' },
  ];

  // Work Orders sub-items
  const workOrdersSubItems = [
    { path: '/work-orders/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/work-orders', icon: List, label: 'All Work Orders' }
  ];

  const isWorkOrdersSectionActive = workOrdersSubItems.some(item => location.pathname === item.path) || location.pathname.startsWith('/work-orders');

  useEffect(() => {
    if (isWorkOrdersSectionActive) setWorkOrdersOpen(true);
  }, [location.pathname]);

  const toggleWorkOrders = () => {
    if (!sidebarCollapsed) {
      setWorkOrdersOpen(!workOrdersOpen);
    }
  };

  // Color constants for sidebar
  const colors = {
    sidebarBg: 'linear-gradient(180deg, #23201B 0%, #1C1A17 50%, #141210 100%)',
    hoverBg: '#2A241D',
    activeBg: 'linear-gradient(90deg, #6B5228 0%, #43351F 100%)',
    activeText: '#FFFFFF',
    primaryText: '#F5F5F5',
    secondaryText: '#B8B8B8',
    primaryGold: '#D4AF37',
    iconGold: '#D9B650',
    richGold: '#C9A227',
    divider: '#3A3127',
    profileBg: '#1F1C18',
  };

  const NavLink = ({ item, mobile = false, collapsed = false, isSubItem = false }) => {
    const Icon = item.icon;
    // Only highlight main nav if path matches AND work orders dropdown is not open (for main nav items only)
    const isActive = isSubItem ? location.pathname === item.path : (location.pathname === item.path && !workOrdersOpen);
    const handleClick = () => {
      if (mobile) setSidebarOpen(false);
      // Close work orders dropdown when clicking on main nav items (not sub-items)
      if (!isSubItem) setWorkOrdersOpen(false);
    };
    return (
      <Link
        to={item.path}
        onClick={handleClick}
        className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
        style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        title={collapsed ? item.label : ''}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: isActive ? colors.activeText : colors.iconGold }} />
        {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
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
        className={`fixed top-0 left-0 h-full shadow-xl z-50 transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
        style={{ background: colors.sidebarBg }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} px-3 h-20`} style={{ borderBottom: `1px solid ${colors.divider}` }}>
            <img src="/logo.webp" alt="XLAND INFRA" className={`${sidebarCollapsed ? 'h-10' : 'h-12'} w-auto object-contain`} />
            {!sidebarCollapsed && (
              <div className="flex flex-col ml-2">
                <span className="text-lg font-bold tracking-wider" style={{ background: 'linear-gradient(180deg, #D4AF37 0%, #C9A227 50%, #B8960F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>XLAND INFRA</span>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <div className="w-6 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A227)' }}></div>
                  <span className="text-[9px] tracking-[0.2em] font-medium" style={{ color: '#A08520' }}>PVT LTD</span>
                  <div className="w-6 h-[1px]" style={{ background: 'linear-gradient(90deg, #C9A227, transparent)' }}></div>
                </div>
              </div>
            )}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 rounded-xl transition-colors" style={{ color: colors.secondaryText }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} mobile collapsed={sidebarCollapsed} />
            ))}

            {/* Work Orders Section */}
            <div className="mt-3 pt-3" >
              <button
                onClick={toggleWorkOrders}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
                style={{ background: (workOrdersOpen || isWorkOrdersSectionActive) ? colors.activeBg : 'transparent', color: (workOrdersOpen || isWorkOrdersSectionActive) ? colors.activeText : colors.primaryText }}
                onMouseEnter={(e) => { if (!workOrdersOpen && !isWorkOrdersSectionActive) e.currentTarget.style.background = colors.hoverBg; }}
                onMouseLeave={(e) => { if (!workOrdersOpen && !isWorkOrdersSectionActive) e.currentTarget.style.background = 'transparent'; }}
                title={sidebarCollapsed ? 'Work Orders' : ''}
              >
                <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                  <ClipboardList className="w-5 h-5 flex-shrink-0" style={{ color: (workOrdersOpen || isWorkOrdersSectionActive) ? colors.activeText : colors.iconGold }} />
                  {!sidebarCollapsed && <span className="text-sm whitespace-nowrap">Work Orders</span>}
                </div>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${workOrdersOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {workOrdersOpen && !sidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1 pl-3" >
                  {workOrdersSubItems.map((item) => (
                    <NavLink key={item.path} item={item} mobile collapsed={sidebarCollapsed} isSubItem />
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* User Info & Logout */}
          <div className="px-3 py-4" >
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: colors.profileBg }}>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: colors.primaryText }}>{admin?.firstName} {admin?.lastName}</span>
                  <span className="text-xs font-medium" style={{ color: colors.primaryGold }}>{getRoleDisplay()}</span>
                </div>
                <button onClick={onLogout} className="flex items-center justify-center p-2.5 rounded-xl transition-all duration-300" style={{ border: `1px solid ${colors.richGold}`, color: colors.primaryGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={onLogout} className="flex items-center justify-center p-2.5 w-full rounded-xl transition-all duration-300" style={{ border: `1px solid ${colors.richGold}`, color: colors.primaryGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Collapse Toggle Button - Outside Sidebar */}
      <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 items-center justify-center w-6 h-12 rounded-r-lg transition-all duration-300 shadow-md ${sidebarCollapsed ? 'left-20' : 'left-64'}`} style={{ background: '#1C1A17', border: `1px solid ${colors.divider}`, borderLeft: 'none', color: colors.iconGold }} onMouseEnter={(e) => e.currentTarget.style.background = colors.hoverBg} onMouseLeave={(e) => e.currentTarget.style.background = '#1C1A17'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
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
