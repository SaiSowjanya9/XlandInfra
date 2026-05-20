import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, MapPin, BarChart3, Calculator, TrendingUp, FileText, Layers, Building, 
  Megaphone, Scale, LineChart, Droplets, Landmark, Frame, HardHat, RefreshCw, 
  ChevronDown, ArrowDownRight
} from 'lucide-react';
import MainHeader from '../../components/MainHeader';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const ConstructionDelivery = () => {
  const navigate = useNavigate();

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Primary stages - Gold highlighted (Investment & Planning Phase)
  const primaryStages = [
    { id: 1, title: 'Identifying Investment Areas & Sites', desc: 'Strategic location scouting and market analysis', icon: MapPin },
    { id: 2, title: 'Feasibility Analysis', desc: 'Comprehensive viability assessment', icon: BarChart3 },
    { id: 3, title: 'Precision Cost Planning', desc: 'Detailed budget and resource analysis', icon: Calculator },
    { id: 4, title: 'ROI Analysis', desc: 'Return optimization and projections', icon: TrendingUp },
  ];

  // Secondary stages - Silver/Charcoal (Design & Execution Phase)
  const secondaryStages = [
    { id: 5, title: 'Concept Planning', desc: 'Architectural blueprints and design', icon: FileText },
    { id: 6, title: 'Design Integration', desc: 'Unified design execution', icon: Layers },
    { id: 7, title: 'Approval Management', desc: 'Permit acquisition and compliance', icon: Building },
    { id: 8, title: 'Marketing Activation', desc: 'Strategic market positioning', icon: Megaphone },
    { id: 9, title: 'Legal Coordination', desc: 'Documentation and safeguards', icon: Scale },
  ];

  // Tertiary stages - Construction Phase
  const tertiaryStages = [
    { id: 1, title: 'Financial Forecasting', desc: 'Cash flow modeling and tracking', icon: LineChart },
    { id: 2, title: 'Infrastructure Development', desc: 'Utilities and site services', icon: Droplets },
    { id: 3, title: 'Foundation & Concrete', desc: 'Structural groundwork', icon: Landmark },
    { id: 4, title: 'Framing & Roofing', desc: 'Core structural assembly', icon: Frame },
    { id: 5, title: 'Construction Management', desc: 'End-to-end project delivery', icon: HardHat },
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <SEO 
        title="Construction & Delivery Services"
        description="End-to-end construction and delivery services by XLAND INFRA. Quality construction management, timely project completion, and seamless handover. Building excellence from foundation to finish."
        keywords="construction services, project delivery, construction management, building construction, quality control, XLAND INFRA, infrastructure development"
        canonical="https://xlandinfra.com/services/construction-delivery"
      />
      {/* Main Navigation */}
      <MainHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a]"></div>
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.2s_forwards]">
              <div className="h-px w-10 bg-gradient-to-r from-gold-400/80 to-transparent"></div>
              <span className="text-gold-400/90 text-sm font-medium tracking-wider uppercase">Construction & Delivery</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-8 leading-[1.1] tracking-tight opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.4s_forwards]">
              <span className="text-white">Building Excellence</span>
              <br />
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">From Foundation</span>
              <br />
              <span className="text-white">to Finish</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.6s_forwards]">
              Our end-to-end construction and delivery services ensure exceptional quality, timely completion, and seamless project handover.
            </p>

            <div className="mt-10 flex flex-wrap gap-4 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.8s_forwards]">
              <button
                onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="group px-8 py-4 bg-gradient-to-r from-gold-400 to-gold-600 text-[#0a0a0a] font-semibold rounded-full hover:shadow-2xl hover:shadow-gold-500/30 transition-all duration-300"
              >
                <span className="flex items-center gap-2">
                  Start Building
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-8 py-4 border border-gold-500/30 text-gold-400 font-semibold rounded-full hover:bg-gold-500/10 hover:border-gold-400/50 transition-all duration-300"
              >
                Explore All Services
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHAT WE DO - CARD BASED LAYOUT ============ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[#0D0D0D]">
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(to right, #D8B25C 1px, transparent 1px), linear-gradient(to bottom, #D8B25C 1px, transparent 1px)', backgroundSize: '80px 80px' }}></div>
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-gold-500/[0.03] rounded-full blur-[180px]"></div>
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gold-600/[0.02] rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.25em] uppercase">Our Process</span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-5 tracking-tight">
              WHAT WE <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">DO</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              A strategic lifecycle from investment planning to project delivery.
            </p>
          </div>

          {/* ===== PRIMARY STAGES - INVESTMENT & PLANNING ===== */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 bg-zinc-500 rounded-full"></div>
              <span className="text-zinc-400 text-xs font-semibold tracking-[0.15em] uppercase">Investment & Planning Phase</span>
              <div className="flex-1 h-px bg-gradient-to-r from-zinc-600/40 to-transparent"></div>
            </div>

            {/* Desktop - 4 Column Grid */}
            <div className="hidden md:grid md:grid-cols-4 gap-4">
              {primaryStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group relative">
                    <div className="h-full p-5 service-card-silver rounded-xl hover:border-zinc-500/50 transition-all duration-300 group-hover:translate-y-[-3px]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-zinc-800 border border-zinc-600/40 rounded-lg flex items-center justify-center group-hover:border-zinc-500/60 transition-colors">
                          <Icon className="w-6 h-6 text-zinc-400 group-hover:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h3 className="text-base font-semibold text-zinc-300 mb-2 leading-tight group-hover:text-white transition-colors">{stage.title}</h3>
                      <p className="text-zinc-600 text-sm leading-relaxed">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile - Compact List */}
            <div className="md:hidden space-y-2">
              {primaryStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group flex items-center gap-4 p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-xl hover:border-zinc-600/50 transition-all duration-300">
                    <div className="w-10 h-10 flex-shrink-0 bg-zinc-800 border border-zinc-700/50 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-zinc-300 truncate">{stage.title}</h3>
                      </div>
                      <p className="text-zinc-600 text-xs mt-0.5">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transition Arrow */}
          <div className="flex justify-center mb-16">
            <div className="flex flex-col items-center">
              <div className="w-px h-12 bg-gradient-to-b from-gold-400/40 to-zinc-600/30"></div>
              <div className="w-10 h-10 border-2 border-zinc-600 rounded-full bg-[#0D0D0D] flex items-center justify-center">
                <ChevronDown className="w-5 h-5 text-zinc-500" />
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-zinc-600/30 to-zinc-700/10"></div>
            </div>
          </div>

          {/* ===== SECONDARY STAGES - DESIGN & EXECUTION ===== */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 bg-zinc-500 rounded-full"></div>
              <span className="text-zinc-400 text-xs font-semibold tracking-[0.15em] uppercase">Design & Execution Phase</span>
              <div className="flex-1 h-px bg-gradient-to-r from-zinc-600/40 to-transparent"></div>
            </div>

            {/* Desktop - 5 Column Grid */}
            <div className="hidden md:grid md:grid-cols-5 gap-3">
              {secondaryStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group relative">
                    <div className="h-full p-4 service-card-silver rounded-xl hover:border-zinc-500/50 transition-all duration-300 group-hover:translate-y-[-3px]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-zinc-800 border border-zinc-600/40 rounded-lg flex items-center justify-center group-hover:border-zinc-500/60 transition-colors">
                          <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h3 className="text-sm font-medium text-zinc-300 mb-1.5 leading-tight group-hover:text-white transition-colors">{stage.title}</h3>
                      <p className="text-zinc-600 text-xs leading-relaxed">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile - Compact List */}
            <div className="md:hidden space-y-2">
              {secondaryStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group flex items-center gap-4 p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-xl hover:border-zinc-600/50 transition-all duration-300">
                    <div className="w-10 h-10 flex-shrink-0 bg-zinc-800 border border-zinc-700/50 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-zinc-300 truncate">{stage.title}</h3>
                      </div>
                      <p className="text-zinc-600 text-xs mt-0.5">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transition Arrow */}
          <div className="flex justify-center mb-16">
            <div className="flex flex-col items-center">
              <div className="w-px h-8 bg-gradient-to-b from-zinc-700/30 to-zinc-600/20"></div>
              <div className="w-8 h-8 border border-zinc-700 rounded-full bg-[#0D0D0D] flex items-center justify-center">
                <ChevronDown className="w-4 h-4 text-zinc-600" />
              </div>
              <div className="w-px h-8 bg-gradient-to-b from-zinc-600/20 to-zinc-700/10"></div>
            </div>
          </div>

          {/* ===== TERTIARY STAGES - CONSTRUCTION PHASE (GOLD HIGHLIGHTED) ===== */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-4 h-4 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full shadow-[0_0_15px_rgba(216,178,92,0.5)]"></div>
              <span className="text-gold-400 text-xs font-semibold tracking-[0.15em] uppercase">Construction & Delivery Phase</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gold-400/40 via-gold-400/20 to-transparent"></div>
            </div>

            {/* Desktop - 5 Column Grid */}
            <div className="hidden md:grid md:grid-cols-5 gap-4">
              {tertiaryStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group relative">
                    <div className="relative p-5 h-full rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/[0.08] via-gold-600/[0.04] to-transparent bg-[#0D0D0D]/80 hover:border-gold-400/60 hover:shadow-[0_0_50px_-15px_rgba(216,178,92,0.3)] transition-all duration-500 group-hover:translate-y-[-6px]">
                      {/* Gold Glow Overlay */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-gold-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      
                      
                      {/* Icon */}
                      <div className="w-14 h-14 mb-4 mt-4 bg-[#0D0D0D] border border-gold-400/30 rounded-xl flex items-center justify-center group-hover:border-gold-400/60 group-hover:shadow-[0_0_20px_-5px_rgba(216,178,92,0.4)] transition-all duration-300">
                        <Icon className="w-7 h-7 text-gold-400" strokeWidth={1.5} />
                      </div>
                      
                      {/* Content */}
                      <h3 className="text-base font-semibold text-white mb-2 leading-tight group-hover:text-gold-400 transition-colors duration-300">{stage.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile - Vertical Flow */}
            <div className="md:hidden space-y-4">
              {tertiaryStages.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group relative">
                    <div className="flex gap-4">
                      {/* Left - Number & Line */}
                      <div className="flex flex-col items-center">
<div className="w-3 h-3 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full shadow-[0_0_10px_rgba(216,178,92,0.3)]"></div>
                        {index < tertiaryStages.length - 1 && (
                          <div className="w-px h-full bg-gradient-to-b from-gold-400/50 to-gold-400/10 mt-2"></div>
                        )}
                      </div>
                      
                      {/* Right - Card */}
                      <div className="flex-1 pb-4">
                        <div className="p-5 bg-gradient-to-br from-gold-500/[0.08] to-transparent border border-gold-500/30 rounded-xl hover:border-gold-400/50 transition-all duration-300">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 flex-shrink-0 bg-[#0D0D0D] border border-gold-400/30 rounded-lg flex items-center justify-center">
                              <Icon className="w-6 h-6 text-gold-400" strokeWidth={1.5} />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-white mb-1">{stage.title}</h3>
                              <p className="text-gray-500 text-sm">{stage.desc}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Continuous Project Growth Loop */}
          <div className="flex justify-center">
            <div className="group relative inline-flex flex-col items-center">
              {/* Connection */}
              <div className="w-px h-8 bg-gradient-to-b from-zinc-700/20 via-gold-500/30 to-gold-400/50"></div>
              
              {/* Loop Element */}
              <div className="relative">
                
                <div className="relative px-8 py-6 bg-gradient-to-br from-gold-500/[0.1] via-gold-400/[0.06] to-transparent border border-gold-500/30 rounded-full bg-[#0D0D0D]/80 hover:border-gold-400/50 hover:shadow-[0_0_60px_-20px_rgba(216,178,92,0.35)] transition-all duration-500">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-[#0D0D0D] border-2 border-gold-400/40 rounded-full flex items-center justify-center group-hover:border-gold-400/70 group-hover:shadow-[0_0_30px_-8px_rgba(216,178,92,0.5)] transition-all duration-500">
                      <RefreshCw className="w-8 h-8 text-gold-400 group-hover:rotate-180 transition-transform duration-700" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1 tracking-tight">Continuous Project Growth</h3>
                      <p className="text-gold-400/60 text-sm">Ongoing development lifecycle & expansion</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Return Arrow */}
              <div className="mt-6 flex items-center gap-3 text-gold-400/40">
                <ArrowDownRight className="w-4 h-4 rotate-[135deg]" />
                <span className="text-xs font-medium tracking-wider uppercase">Begin New Project Cycle</span>
                <ArrowDownRight className="w-4 h-4 rotate-45 scale-x-[-1]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-14 md:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gold-600/[0.08] via-gold-500/[0.04] to-gold-600/[0.08]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[150px] bg-gold-400/10 rounded-full blur-[80px]"></div>
        
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center p-8 md:p-10 bg-gradient-to-b from-zinc-900/50 to-zinc-900/20 border border-gold-500/20 rounded-3xl bg-[#0D0D0D]/80 hover:border-gold-400/40 transition-all duration-500">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-3 tracking-tight">
              Ready to Build Your <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Dream Project</span>?
            </h2>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
              Partner with us for reliable, high-quality construction services delivered on time and within budget.
            </p>
            <button
              onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-gold-400 to-gold-600 text-[#0a0a0a] font-semibold rounded-full hover:shadow-xl hover:shadow-gold-500/25 hover:scale-105 transition-all duration-300"
            >
              <span>Start Building</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <BrandLogo size="sm" />
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} XLand Infra. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ConstructionDelivery;
