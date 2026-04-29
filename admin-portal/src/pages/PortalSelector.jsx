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
              className="h-10 w-auto object-contain drop-shadow-lg"
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
              System <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent font-normal">Administration</span> Portal
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Select your portal to access personalized services and features
            </p>
          </div>

          {/* Main Portal Cards - Customer & Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Customer Portal Card */}
            <button
              onClick={() => onSelectPortal('customer')}
              className="group relative bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-zinc-800/90 backdrop-blur-xl border border-zinc-800 hover:border-amber-500/50 rounded-3xl p-8 text-left transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 overflow-hidden"
            >
              {/* Gold gradient border on top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 opacity-70 group-hover:opacity-100 transition-opacity" />
              
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/0 via-amber-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Shine effect on hover */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden">
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              </div>

              {/* Icon */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <Users className="w-8 h-8 text-black" />
              </div>

              {/* Title */}
              <h3 className="relative text-2xl font-semibold text-white mb-3 group-hover:text-amber-50 transition-colors">
                Customer Portal
              </h3>

              {/* Description */}
              <p className="relative text-zinc-400 mb-6 leading-relaxed group-hover:text-zinc-300 transition-colors">
                Submit work orders, browse service categories, track your requests in real-time, and manage payments.
              </p>

              {/* Features */}
              <div className="relative flex flex-wrap gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400">
                  <Clock className="w-3 h-3" /> Real-time Tracking
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400">
                  <Shield className="w-3 h-3" /> Secure Access
                </span>
              </div>

              {/* CTA */}
              <div className="relative inline-flex items-center gap-2 text-sm font-semibold text-amber-400 group-hover:text-amber-300">
                <span>Enter Customer Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Vendor Portal Card */}
            <button
              onClick={() => onSelectPortal('vendor')}
              className="group relative bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-zinc-800/90 backdrop-blur-xl border border-zinc-800 hover:border-amber-500/50 rounded-3xl p-8 text-left transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 overflow-hidden"
            >
              {/* Gold gradient border on top */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400 opacity-70 group-hover:opacity-100 transition-opacity" />
              
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/0 via-amber-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Shine effect on hover */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden">
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              </div>

              {/* Icon */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <Truck className="w-8 h-8 text-black" />
              </div>

              {/* Title */}
              <h3 className="relative text-2xl font-semibold text-white mb-3 group-hover:text-amber-50 transition-colors">
                Vendor Portal
              </h3>

              {/* Description */}
              <p className="relative text-zinc-400 mb-6 leading-relaxed group-hover:text-zinc-300 transition-colors">
                Manage your vendor profile, view assigned contracts, handle service requests, and track assignments.
              </p>

              {/* Features */}
              <div className="relative flex flex-wrap gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400">
                  <Clock className="w-3 h-3" /> Contract Management
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400">
                  <Shield className="w-3 h-3" /> Verified Partner
                </span>
              </div>

              {/* CTA */}
              <div className="relative inline-flex items-center gap-2 text-sm font-semibold text-amber-400 group-hover:text-amber-300">
                <span>Enter Vendor Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-5 text-center relative z-10 border-t border-zinc-900">
        <p className="text-zinc-600 text-sm">&copy; 2025 XLand Infra. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PortalSelector;
