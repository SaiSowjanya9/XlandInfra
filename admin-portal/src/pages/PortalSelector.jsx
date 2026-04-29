import { Users, Briefcase, Truck, ArrowRight, Sparkles, Shield, Clock } from 'lucide-react';

const PortalSelector = ({ onSelectPortal }) => {
  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gold gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-transparent rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-amber-600/15 via-orange-400/10 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
        
        {/* Diagonal shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-amber-500/5 to-transparent transform -skew-y-12" />
      </div>

      {/* Header with Employee Portal */}
      <header className="w-full py-5 px-6 md:px-10 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="XLand Infra Logo"
              className="h-16 w-auto object-contain drop-shadow-lg"
            />
          </div>
          
          {/* Employee Portal - Top Right */}
          <button
            onClick={() => onSelectPortal('employee')}
            className="group flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 hover:border-amber-500/50 rounded-full backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Briefcase className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-medium text-zinc-300 group-hover:text-amber-400 transition-colors">
              Employee Portal
            </span>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16 relative z-10">
        <div className="w-full max-w-5xl">
          {/* Title Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Welcome to XLand Infra</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-light text-white mb-5 tracking-tight">
              XLandInfra <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent font-normal">Service</span> Portal
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Select your portal to access personalized services and features
            </p>
          </div>

          {/* Portal Access Links */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
            {/* Customer Portal Link */}
            <button
              onClick={() => onSelectPortal('customer')}
              className="group flex items-center gap-3 px-6 py-3 bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/50 hover:border-amber-500/50 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Users className="w-5 h-5 text-black" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-medium text-white group-hover:text-amber-50 transition-colors">
                  Customer Portal
                </span>
                <span className="block text-xs text-zinc-500">Submit work orders & track requests</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all ml-2" />
            </button>

            {/* Divider */}
            <div className="hidden sm:block w-px h-10 bg-zinc-700/50" />
            <div className="sm:hidden w-16 h-px bg-zinc-700/50" />

            {/* Vendor Portal Link */}
            <button
              onClick={() => onSelectPortal('vendor')}
              className="group flex items-center gap-3 px-6 py-3 bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/50 hover:border-amber-500/50 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Truck className="w-5 h-5 text-black" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-medium text-white group-hover:text-amber-50 transition-colors">
                  Vendor Portal
                </span>
                <span className="block text-xs text-zinc-500">Manage contracts & assignments</span>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all ml-2" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-5 text-center relative z-10 border-t border-zinc-900">
        <p className="text-zinc-600 text-sm">&copy; 2026 XLand Infra. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PortalSelector;
