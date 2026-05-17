import { Briefcase, Truck, Sparkles, Lock, ArrowRight } from 'lucide-react';

const PortalSelector = ({ onSelectPortal }) => {
  const portals = [
    { 
      id: 'employee', 
      label: 'Employee Portal', 
      icon: Briefcase,
      enabled: true
    },
    { 
      id: 'vendor', 
      label: 'Vendor Portal', 
      icon: Truck,
      enabled: false,
      comingSoon: true
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#0f0d08] to-[#0a0a0a] flex flex-col relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-amber-500/20 via-yellow-500/12 to-orange-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-amber-600/18 via-orange-500/10 to-yellow-600/8 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] bg-gradient-to-br from-yellow-400/10 via-amber-500/8 to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-[40%] left-[15%] w-[300px] h-[300px] bg-gradient-to-br from-orange-400/8 via-amber-400/6 to-transparent rounded-full blur-[60px] animate-pulse" style={{ animationDuration: '7s' }} />
        
        {/* Elegant grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(245,195,68,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,195,68,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        {/* Radial gradient center glow - enhanced */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-radial from-amber-500/10 via-amber-500/3 to-transparent rounded-full" />
        
        {/* Top edge gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        
        {/* Floating particles effect */}
        <div className="absolute top-[15%] left-[25%] w-2 h-2 bg-amber-400/30 rounded-full blur-sm animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute top-[60%] left-[70%] w-1.5 h-1.5 bg-yellow-400/25 rounded-full blur-sm animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute top-[75%] left-[20%] w-1 h-1 bg-amber-300/20 rounded-full blur-sm animate-bounce" style={{ animationDuration: '5s', animationDelay: '2s' }} />
        <div className="absolute top-[25%] left-[80%] w-1.5 h-1.5 bg-orange-400/25 rounded-full blur-sm animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
      </div>

      {/* Header */}
      <header className="w-full py-6 px-6 md:px-10 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <img
            src="/logo.png"
            alt="XLand Infra Logo"
            className="h-28 md:h-32 w-auto object-contain drop-shadow-[0_0_40px_rgba(245,195,68,0.4)] transition-transform duration-300 hover:scale-105"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-start justify-center px-6 pt-8 relative z-10">
        <div className="text-center max-w-5xl mx-auto">
          {/* Welcome Badge */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-amber-500/10 to-amber-400/5 border border-amber-500/20 rounded-full mb-24 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300/90 font-medium tracking-wide">Welcome to XLand Infra</span>
          </div>
          
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extralight text-white mb-4 tracking-tight leading-tight">
            XLandInfra{' '}
            <span className="font-normal bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 bg-clip-text text-transparent">
              Service
            </span>{' '}
            Portal
          </h1>
          
          <p className="text-zinc-500 text-base md:text-lg mb-10 font-light">
            Select your portal to continue
          </p>

          {/* Portal Cards - Pill Style */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <button
                  key={portal.id}
                  onClick={() => portal.enabled && onSelectPortal(portal.id)}
                  disabled={!portal.enabled}
                  className={`relative group transition-all duration-400 ease-out ${
                    portal.enabled ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  {/* Pill Container */}
                  <div className={`relative flex items-center gap-4 px-6 py-4 md:px-8 md:py-5 rounded-full border backdrop-blur-sm transition-all duration-400 ${
                    portal.enabled 
                      ? 'bg-gradient-to-r from-amber-500/[0.08] to-amber-400/[0.03] border-amber-500/20 group-hover:border-amber-400/40 group-hover:bg-gradient-to-r group-hover:from-amber-500/[0.12] group-hover:to-amber-400/[0.06] group-hover:shadow-[0_0_40px_-12px_rgba(245,195,68,0.25)]' 
                      : 'bg-zinc-800/20 border-zinc-700/30'
                  }`}>
                    
                    {/* Coming Soon Badge */}
                    {portal.comingSoon && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-zinc-800/90 border border-zinc-700/50 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                        <Lock className="w-2.5 h-2.5 text-zinc-500" strokeWidth={2} />
                        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Coming Soon</span>
                      </div>
                    )}

                    {/* Icon - Outlined only, soft gold tone */}
                    <div className={`flex items-center justify-center transition-all duration-300 ${
                      portal.enabled ? 'group-hover:scale-105' : ''
                    }`}>
                      <Icon 
                        className={`w-6 h-6 md:w-7 md:h-7 transition-colors duration-300 ${
                          portal.enabled 
                            ? 'text-amber-400/70 group-hover:text-amber-400/90' 
                            : 'text-zinc-600'
                        }`} 
                        strokeWidth={1.5} 
                      />
                    </div>

                    {/* Label */}
                    <span className={`text-base md:text-lg font-medium tracking-tight transition-colors duration-300 ${
                      portal.enabled 
                        ? 'text-amber-100/80 group-hover:text-amber-50' 
                        : 'text-zinc-500'
                    }`}>
                      {portal.label}
                    </span>

                    {/* Arrow Indicator */}
                    {portal.enabled && (
                      <ArrowRight 
                        className="w-4 h-4 md:w-5 md:h-5 text-amber-400/50 group-hover:text-amber-400/80 transition-all duration-300 group-hover:translate-x-0.5" 
                        strokeWidth={1.5} 
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center relative z-10">
        <p className="text-zinc-700 text-sm font-light tracking-wide">&copy; 2026 XLand Infra. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PortalSelector;
