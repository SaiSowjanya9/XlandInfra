import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  UserPlus,
  Store,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Hammer,
  MapPin,
  Plus,
  List,
  Package,
  PlusCircle,
  Archive,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

const ExecutiveLayout = ({ admin, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});

  // Check if this is an FP Executive
  const isFPExecutive = !!admin?.franchisePartnerId;

  // Get user initials for avatar
  const getInitials = () => {
    const first = admin?.firstName?.[0] || '';
    const last = admin?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'E';
  };

  const navItems = [
    { path: '/executive', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/executive/properties', icon: Building2, label: 'Property Management' },
    { path: '/executive/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/executive/customers/add', icon: UserPlus, label: 'Add Customer' },
    { path: '/executive/employees/zones', icon: MapPin, label: 'Employee Zone Management' },
  ];

  // FP Executive nav items - same structure as Supervisor
  const fpNavItems = [
    { path: '/executive', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/executive/properties', icon: Building2, label: 'Property Management' },
    { path: '/executive/work-orders', icon: ClipboardList, label: 'Work Orders' },
    { path: '/executive/customers/add', icon: UserPlus, label: 'Add Customer' },
  ];

  const vendorSubItems = [
    { path: '/executive/vendors/add', icon: UserPlus, label: 'Add New Vendor' },
    { path: '/executive/vendors', icon: Hammer, label: 'Vendor Details' },
    { path: '/executive/vendors/assigned', icon: ClipboardList, label: 'Assigned Vendors' }
  ];

  const estimatesSubItems = [
    { path: '/executive/estimates/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/executive/estimates/create', icon: Plus, label: 'Create Estimate' },
    { path: '/executive/estimates', icon: List, label: 'All Estimates' },
    { path: '/executive/estimates/amc', icon: Package, label: 'AMC Packages' },
    { path: '/executive/estimates/addons', icon: PlusCircle, label: 'Add-ons' },
    { path: '/executive/estimates/archived', icon: Archive, label: 'Archived' }
  ];

  const isVendorActive = vendorSubItems.some(item => location.pathname === item.path);
  const isEstimatesActive = estimatesSubItems.some(item => location.pathname === item.path) || location.pathname === '/executive/estimates';
  
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

  useEffect(() => {
    if (isVendorActive) setExpandedMenus(prev => ({ ...prev, vendors: true }));
    if (isEstimatesActive) setExpandedMenus(prev => ({ ...prev, estimates: true }));
  }, [location.pathname, isVendorActive, isEstimatesActive]);

  // Accordion toggle functions - close other sections when opening one
  const toggleVendors = () => {
    if (!sidebarCollapsed) {
      const opening = !expandedMenus.vendors;
      setExpandedMenus({ vendors: opening, estimates: false });
    }
  };

  const toggleEstimates = () => {
    if (!sidebarCollapsed) {
      const opening = !expandedMenus.estimates;
      setExpandedMenus({ vendors: false, estimates: opening });
    }
  };

  // Check if any dropdown is open
  const isAnyDropdownOpen = expandedMenus.vendors || expandedMenus.estimates;

  const NavLink = ({ item, mobile = false }) => {
    const Icon = item.icon;
    // Only highlight main nav if path matches AND no dropdown is open
    const isActive = location.pathname === item.path && !isAnyDropdownOpen;
    const handleClick = () => {
      if (mobile) setSidebarOpen(false);
      // Close all dropdowns when clicking on main nav items
      setExpandedMenus({ vendors: false, estimates: false });
    };
    return (
      <Link
        to={item.path}
        onClick={handleClick}
        className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`}
        style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        title={sidebarCollapsed ? item.label : ''}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: isActive ? colors.activeText : colors.iconGold }} />
        {!sidebarCollapsed && <span className="text-sm max-w-[160px] leading-tight">{item.label}</span>}
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
            {/* Both FP Executive and regular Executive use same structure */}
            {isFPExecutive ? (
              <>
                {fpNavItems.map((item) => (
                  <NavLink key={item.path} item={item} mobile />
                ))}
                
                {/* Vendor Management Section */}
                <div className="mt-3 pt-3" >
                  <button onClick={toggleVendors} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`} style={{ background: (expandedMenus.vendors || (isVendorActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (expandedMenus.vendors || (isVendorActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!expandedMenus.vendors && !(isVendorActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!expandedMenus.vendors && !(isVendorActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }} title={sidebarCollapsed ? 'Vendor Management' : ''}>
                    <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                      <Store className="w-5 h-5 flex-shrink-0" style={{ color: (expandedMenus.vendors || (isVendorActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                      {!sidebarCollapsed && <span className="text-sm">Vendor Management</span>}
                    </div>
                    {!sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.vendors ? 'rotate-180' : ''}`} />}
                  </button>
                  {expandedMenus.vendors && !sidebarCollapsed && (
                    <div className="ml-4 mt-1 space-y-1 pl-3" >
                      {vendorSubItems.map((item) => { const Icon = item.icon; const isActive = location.pathname === item.path; return (
                        <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm transition-all duration-200 font-medium" style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          <Icon className="w-4 h-4" style={{ color: isActive ? colors.activeText : colors.iconGold }} /><span>{item.label}</span>
                        </Link>
                      ); })}
                    </div>
                  )}
                </div>

                {/* Estimates / AMC Section */}
                <div className="mt-1">
                  <button onClick={toggleEstimates} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`} style={{ background: (expandedMenus.estimates || (isEstimatesActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (expandedMenus.estimates || (isEstimatesActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!expandedMenus.estimates && !(isEstimatesActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!expandedMenus.estimates && !(isEstimatesActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }} title={sidebarCollapsed ? 'Estimates / AMC' : ''}>
                    <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: (expandedMenus.estimates || (isEstimatesActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                      {!sidebarCollapsed && <span className="text-sm">Estimates / AMC</span>}
                    </div>
                    {!sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.estimates ? 'rotate-180' : ''}`} />}
                  </button>
                  {expandedMenus.estimates && !sidebarCollapsed && (
                    <div className="ml-4 mt-1 space-y-1 pl-3" >
                      {estimatesSubItems.map((item) => { const Icon = item.icon; const isActive = location.pathname === item.path; return (
                        <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm transition-all duration-200 font-medium" style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          <Icon className="w-4 h-4" style={{ color: isActive ? colors.activeText : colors.iconGold }} /><span>{item.label}</span>
                        </Link>
                      ); })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {navItems.map((item) => (<NavLink key={item.path} item={item} mobile />))}

                {/* Vendor Management Section - Only for regular executives */}
                <div className="mt-3 pt-3" >
                  <button onClick={toggleVendors} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`} style={{ background: (expandedMenus.vendors || (isVendorActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (expandedMenus.vendors || (isVendorActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!expandedMenus.vendors && !(isVendorActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!expandedMenus.vendors && !(isVendorActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }} title={sidebarCollapsed ? 'Vendor Management' : ''}>
                    <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                      <Store className="w-5 h-5 flex-shrink-0" style={{ color: (expandedMenus.vendors || (isVendorActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                      {!sidebarCollapsed && <span className="text-sm">Vendor Management</span>}
                    </div>
                    {!sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.vendors ? 'rotate-180' : ''}`} />}
                  </button>
                  {expandedMenus.vendors && !sidebarCollapsed && (
                    <div className="ml-4 mt-1 space-y-1 pl-3" >
                      {vendorSubItems.map((item) => { const Icon = item.icon; const isActive = location.pathname === item.path; return (
                        <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm transition-all duration-200 font-medium" style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          <Icon className="w-4 h-4" style={{ color: isActive ? colors.activeText : colors.iconGold }} /><span>{item.label}</span>
                        </Link>
                      ); })}
                    </div>
                  )}
                </div>

                {/* Estimates Section - Only for regular executives */}
                <div className="mt-1">
                  <button onClick={toggleEstimates} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} w-full px-4 py-2.5 rounded-xl transition-all duration-200 font-medium`} style={{ background: (expandedMenus.estimates || (isEstimatesActive && !isAnyDropdownOpen)) ? colors.activeBg : 'transparent', color: (expandedMenus.estimates || (isEstimatesActive && !isAnyDropdownOpen)) ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!expandedMenus.estimates && !(isEstimatesActive && !isAnyDropdownOpen)) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!expandedMenus.estimates && !(isEstimatesActive && !isAnyDropdownOpen)) e.currentTarget.style.background = 'transparent'; }} title={sidebarCollapsed ? 'Estimates / AMC' : ''}>
                    <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: (expandedMenus.estimates || (isEstimatesActive && !isAnyDropdownOpen)) ? colors.activeText : colors.iconGold }} />
                      {!sidebarCollapsed && <span className="text-sm">Estimates / AMC</span>}
                    </div>
                    {!sidebarCollapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.estimates ? 'rotate-180' : ''}`} />}
                  </button>
                  {expandedMenus.estimates && !sidebarCollapsed && (
                    <div className="ml-4 mt-1 space-y-1 pl-3" >
                      {estimatesSubItems.map((item) => { const Icon = item.icon; const isActive = location.pathname === item.path; return (
                        <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm transition-all duration-200 font-medium" style={{ background: isActive ? colors.activeBg : 'transparent', color: isActive ? colors.activeText : colors.primaryText }} onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }} onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                          <Icon className="w-4 h-4" style={{ color: isActive ? colors.activeText : colors.iconGold }} /><span>{item.label}</span>
                        </Link>
                      ); })}
                    </div>
                  )}
                </div>

              </>
            )}
          </nav>

          {/* User Info & Logout */}
          <div className="px-3 py-4" >
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: colors.profileBg }}>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: colors.primaryText }}>{admin?.firstName} {admin?.lastName}</span>
                  <span className="text-xs font-medium" style={{ color: colors.primaryGold }}>Executive</span>
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

export default ExecutiveLayout;
