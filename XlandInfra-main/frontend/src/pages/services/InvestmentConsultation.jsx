import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, BarChart3, Calculator, TrendingUp, ArrowRight, Target, Shield, Users, Sparkles,
  FileText, Layers, Building, Megaphone, Scale, LineChart, Droplets, Landmark, Frame, HardHat, RefreshCw, ChevronRight
} from 'lucide-react';
import MainHeader from '../../components/MainHeader';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const InvestmentConsultation = () => {
  const navigate = useNavigate();

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benefits = [
    { icon: Target, title: 'Data-Driven Insights', desc: 'Market intelligence backed by thorough research' },
    { icon: Shield, title: 'Risk Mitigation', desc: 'Strategic planning to protect your investments' },
    { icon: Users, title: 'Expert Advisory', desc: 'Guidance from seasoned real estate professionals' },
    { icon: Sparkles, title: 'Tailored Strategies', desc: 'Customized plans aligned with your goals' },
  ];

  // Investment Success Roadmap - All 14 stages
  const roadmapStages = [
    // Primary Stages (Gold Highlighted)
    { id: 1, title: 'Identifying Investment Areas & Sites', desc: 'Strategic location scouting for high-growth potential', icon: MapPin, isPrimary: true },
    { id: 2, title: 'Feasibility Analysis', desc: 'Comprehensive viability assessment and risk evaluation', icon: BarChart3, isPrimary: true },
    { id: 3, title: 'Precision Cost Planning', desc: 'Detailed budgeting with transparent financial clarity', icon: Calculator, isPrimary: true },
    { id: 4, title: 'ROI Analysis', desc: 'Return projections and value optimization strategy', icon: TrendingUp, isPrimary: true },
    // Secondary Stages (Silver/Charcoal)
    { id: 5, title: 'Concept Planning', desc: 'Architectural vision and development blueprint', icon: FileText, isPrimary: false },
    { id: 6, title: 'Design Integration & Coordination', desc: 'Unified design execution across all disciplines', icon: Layers, isPrimary: false },
    { id: 7, title: 'Approval Management', desc: 'Permit acquisition and regulatory compliance', icon: Building, isPrimary: false },
    { id: 8, title: 'Sales & Marketing Activation', desc: 'Strategic market positioning and buyer engagement', icon: Megaphone, isPrimary: false },
    { id: 9, title: 'Legal Coordination', desc: 'Contracts, documentation, and legal safeguards', icon: Scale, isPrimary: false },
    { id: 10, title: 'Financial Forecasting', desc: 'Cash flow modeling and investment projections', icon: LineChart, isPrimary: false },
    { id: 11, title: 'Infrastructure Development', desc: 'Utilities, roads, and essential site services', icon: Droplets, isPrimary: false },
    { id: 12, title: 'Foundation & Concrete Works', desc: 'Structural groundwork and base construction', icon: Landmark, isPrimary: false },
    { id: 13, title: 'Structural Framing & Roofing', desc: 'Core structure assembly and weather protection', icon: Frame, isPrimary: false },
    { id: 14, title: 'End-to-End Construction Management', desc: 'Full-cycle project delivery and quality assurance', icon: HardHat, isPrimary: false },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Investment Consultation Services"
        description="Expert real estate investment consultation services by XLAND INFRA. Data-driven insights, risk mitigation, ROI analysis, and strategic investment guidance for maximum returns."
        keywords="investment consultation, real estate investment, property investment, ROI analysis, market research, portfolio analysis, XLAND INFRA"
        canonical="https://xlandinfra.com/services/investment-consultation"
      />
      {/* Main Navigation */}
      <MainHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a]"></div>
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3"></div>
          {/* Geometric Pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.2s_forwards]">
              <div className="h-px w-10 bg-gradient-to-r from-gold-400/80 to-transparent"></div>
              <span className="text-gold-400/90 text-sm font-medium tracking-wider uppercase">Investment Consultation</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-normal mb-8 leading-[1.1] tracking-tight opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.4s_forwards]">
              <span className="text-white">Strategic Real Estate</span>
              <br />
              <span className="text-gold-hero">Investment Guidance</span>
              <br />
              <span className="text-white">for Long-Term Growth</span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.6s_forwards]">
              With extensive expertise in the real estate sector, we help investors make informed and confident decisions through strategic planning and market-driven insights. Our Investment Consultation services are designed to identify high-potential opportunities, simplify complex market dynamics, and create personalized investment strategies focused on long-term value and sustainable returns.
            </p>

            {/* Highlight Text */}
            <div className="mt-8 p-6 bg-gradient-to-r from-gold-500/[0.08] to-transparent border-l-2 border-gold-400 rounded-r-xl opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.8s_forwards]">
              <p className="text-gold-100/90 text-lg font-light italic">
                "At Xland Infra, we act as a trusted advisory partner committed to maximizing the potential of every investment."
              </p>
            </div>

            {/* CTA */}
            <div className="mt-10 flex flex-wrap gap-4 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_1s_forwards]">
              <button
                onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="group px-8 py-4 bg-[#D4AF37] text-[#0a0a0a] font-semibold rounded-full hover:bg-[#C9A227] hover:shadow-2xl hover:shadow-gold-500/30 transition-all duration-300"
              >
                <span className="flex items-center gap-2">
                  Schedule Consultation
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

      {/* ============ INVESTMENT SUCCESS ROADMAP ============ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[#0D0D0D]">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gold-500/[0.04] rounded-full blur-[150px]"></div>
          <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-gold-600/[0.03] rounded-full blur-[120px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Complete Journey</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-4 tracking-tight">
              Investment Success <span className="text-gold-hero">Roadmap</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              A strategic process designed to maximize real estate growth and long-term returns.
            </p>
          </div>

          {/* Primary Stages - Gold Highlighted (First 4) */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-gold-400 rounded-full shadow-[0_0_12px_rgba(216,178,92,0.6)]"></div>
              <span className="text-gold-400 text-xs font-semibold tracking-wider uppercase">Strategic Foundation</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gold-400/30 to-transparent"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {roadmapStages.slice(0, 4).map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group relative">
                    {/* Connector Line */}
                    {index < 3 && (
                      <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px bg-gradient-to-r from-gold-400/50 to-gold-400/20 z-10">
                        <ChevronRight className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gold-400/40" />
                      </div>
                    )}
                    
                    {/* Card */}
                    <div className="h-full p-5 service-card-gold rounded-2xl hover:border-gold-400/60 transition-all duration-300 group-hover:translate-y-[-4px]">
                      
                      {/* Icon */}
                      <div className="w-12 h-12 mb-4 bg-[#0D0D0D] border border-gold-400/40 rounded-xl flex items-center justify-center group-hover:border-gold-400 group-hover:shadow-[0_0_20px_-5px_rgba(216,178,92,0.3)] transition-all duration-300">
                        <Icon className="w-6 h-6 text-gold-400" strokeWidth={1.5} />
                      </div>
                      
                      {/* Content */}
                      <h3 className="text-base font-semibold text-white mb-2 leading-tight group-hover:text-gold-400 transition-colors">{stage.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flow Connector */}
          <div className="flex justify-center mb-12">
            <div className="flex flex-col items-center">
              <div className="w-px h-8 bg-gradient-to-b from-gold-400/50 to-zinc-600/30"></div>
              <div className="w-3 h-3 border-2 border-zinc-600 rounded-full bg-[#0D0D0D]"></div>
              <div className="w-px h-8 bg-gradient-to-b from-zinc-600/30 to-zinc-700/20"></div>
            </div>
          </div>

          {/* Secondary Stages - Silver/Charcoal (5-10) */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-zinc-500 rounded-full"></div>
              <span className="text-zinc-400 text-xs font-semibold tracking-wider uppercase">Planning & Coordination</span>
              <div className="flex-1 h-px bg-gradient-to-r from-zinc-600/30 to-transparent"></div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {roadmapStages.slice(4, 9).map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group">
                    <div className="h-full p-4 service-card-silver rounded-xl hover:border-zinc-500/50 transition-all duration-300 group-hover:translate-y-[-2px]">
                      {/* Stage Number */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 bg-zinc-800 border border-zinc-600/50 rounded-lg flex items-center justify-center group-hover:border-zinc-500 transition-colors">
                          <Icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <h3 className="text-sm font-medium text-zinc-300 mb-1 leading-tight group-hover:text-white transition-colors">{stage.title}</h3>
                      <p className="text-zinc-600 text-xs leading-relaxed">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Flow Connector */}
          <div className="flex justify-center mb-12">
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-gradient-to-b from-zinc-700/20 to-zinc-700/10"></div>
              <div className="w-2 h-2 border border-zinc-700 rounded-full bg-[#0D0D0D]"></div>
              <div className="w-px h-6 bg-gradient-to-b from-zinc-700/10 to-zinc-800/5"></div>
            </div>
          </div>

          {/* Tertiary Stages - Execution (11-14) */}
          <div className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-zinc-600 rounded-full"></div>
              <span className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Execution & Delivery</span>
              <div className="flex-1 h-px bg-gradient-to-r from-zinc-700/20 to-transparent"></div>
            </div>
            
            {/* Desktop Grid */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-3">
              {roadmapStages.slice(9, 14).map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group">
                    <div className="h-full p-4 service-card-dark rounded-xl hover:border-zinc-600/50 transition-all duration-300 group-hover:translate-y-[-2px]">
                      <div className="flex flex-col">
                        <div className="w-10 h-10 mb-3 flex-shrink-0 bg-zinc-800/50 border border-zinc-700/30 rounded-lg flex items-center justify-center group-hover:border-zinc-600/50 transition-colors">
                          <Icon className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-white group-hover:text-zinc-300 transition-colors leading-tight">{stage.title}</h3>
                          <p className="text-zinc-600 text-xs leading-relaxed mt-1">{stage.desc}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden space-y-2">
              {roadmapStages.slice(9, 14).map((stage) => {
                const Icon = stage.icon;
                return (
                  <div key={stage.id} className="group p-4 service-card-dark rounded-xl hover:border-zinc-600/50 transition-all duration-300">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex-shrink-0 bg-zinc-800/50 border border-zinc-700/30 rounded-lg flex items-center justify-center group-hover:border-zinc-600/50 transition-colors">
                        <Icon className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-white group-hover:text-zinc-300 transition-colors leading-tight">{stage.title}</h3>
                        <p className="text-zinc-600 text-xs leading-relaxed mt-1">{stage.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Repeat & Scale Growth Loop */}
          <div className="flex justify-center">
            <div className="group relative inline-flex flex-col items-center">
              {/* Connection line up */}
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-gold-500/30 to-gold-400/50"></div>
              
              {/* Loop Element */}
              <div className="relative px-8 py-5 bg-gradient-to-r from-gold-500/[0.08] via-gold-400/[0.12] to-gold-500/[0.08] border border-gold-500/30 rounded-2xl bg-[#0D0D0D]/80 hover:border-gold-400/50 hover:shadow-[0_0_50px_-15px_rgba(216,178,92,0.3)] transition-all duration-500">
                
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#0D0D0D] border-2 border-gold-400/50 rounded-full flex items-center justify-center group-hover:border-gold-400 group-hover:shadow-[0_0_25px_-5px_rgba(216,178,92,0.4)] transition-all duration-300">
                    <RefreshCw className="w-7 h-7 text-gold-400 group-hover:rotate-180 transition-transform duration-700" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Repeat & Scale Growth</h3>
                    <p className="text-gold-400/70 text-sm">Continuous investment success cycle</p>
                  </div>
                </div>
              </div>
              
              {/* Arrow back indicator */}
              <div className="mt-4 flex items-center gap-2 text-gold-400/50">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-gold-400/30"></div>
                <span className="text-xs font-medium tracking-wider uppercase">Start New Cycle</span>
                <div className="w-8 h-px bg-gradient-to-l from-transparent to-gold-400/30"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={index}
                  className="group p-6 bg-gradient-to-b from-zinc-900/60 to-zinc-900/30 border border-zinc-800/50 rounded-2xl hover:border-gold-500/30 hover:shadow-[0_0_30px_-10px_rgba(216,178,92,0.15)] transition-all duration-300"
                >
                  <div className="w-14 h-14 mb-4 bg-gradient-to-br from-gold-400/10 to-gold-600/10 border border-gold-500/20 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Icon className="w-7 h-7 text-gold-400" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                  <p className="text-gray-500 text-sm">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section - Premium Compact */}
      <section className="py-14 md:py-16 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-gold-600/[0.08] via-gold-500/[0.04] to-gold-600/[0.08]"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-gold-400/10 rounded-full blur-[100px]"></div>
        </div>
        
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* CTA Card */}
          <div className="text-center p-8 md:p-10 bg-gradient-to-b from-zinc-900/60 to-zinc-900/30 border border-gold-500/20 rounded-3xl bg-[#0D0D0D]/80 hover:border-gold-400/40 transition-all duration-500">
            <h2 className="text-2xl md:text-3xl font-display font-normal text-white mb-3 tracking-tight">
              Ready to Build Your Next <span className="text-gold-hero">Investment Success</span>?
            </h2>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
              Connect with XLand Infra today and take the first step toward strategic real estate growth and long-term value.
            </p>
            <button
              onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-[#D4AF37] text-[#0a0a0a] font-semibold rounded-full hover:bg-[#C9A227] hover:shadow-xl hover:shadow-gold-500/25 hover:scale-105 transition-all duration-300"
            >
              <span>Contact Us</span>
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

export default InvestmentConsultation;
