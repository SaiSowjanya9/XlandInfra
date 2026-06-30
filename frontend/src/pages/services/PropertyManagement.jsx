import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Shield, Users, Target, Sparkles, TrendingUp, CheckCircle, Award,
  ArrowRight, Phone, Mail, MapPin, Clock, Wrench, HeadphonesIcon, DollarSign,
  ShieldCheck, UserCheck, Zap, FileText, Eye, Settings, Home, Briefcase,
  AlertTriangle, ThumbsUp, Heart, Lock, BarChart3, Star, Check, X as XIcon
} from 'lucide-react';
import MainHeader from '../../components/MainHeader';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const PropertyManagement = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const comparisonPoints = [
    { 
      aspect: 'Property Verification',
      market: 'Not always verified or incomplete',
      xland: '100% Verified & Documented'
    },
    { 
      aspect: 'Vendor Management',
      market: 'Multiple vendors, unorganized',
      xland: 'Verified vendors, structured system'
    },
    { 
      aspect: 'Response Time',
      market: 'Slow response, delayed action',
      xland: 'Fast response, quick resolution'
    },
    { 
      aspect: 'Transparency',
      market: 'Limited updates, unclear reports',
      xland: 'Real-time updates, transparent reports'
    },
    { 
      aspect: 'Maintenance Approach',
      market: 'Reactive, after problems occur',
      xland: 'Proactive, preventive care'
    },
    { 
      aspect: 'Cost Control',
      market: 'High cost, no optimization',
      xland: 'Cost-effective & optimized'
    },
    { 
      aspect: 'Supervision',
      market: 'Inconsistent supervision',
      xland: 'Dedicated team, strict supervision'
    },
    { 
      aspect: 'End-to-End Service',
      market: 'Partial services, coordination by client',
      xland: 'Complete solution under one roof'
    }
  ];

  const coreBenefits = [
    { 
      icon: Settings, 
      title: 'Hassle-Free Management', 
      desc: 'Complete property care without the stress. We handle everything from routine maintenance to emergency repairs.'
    },
    { 
      icon: UserCheck, 
      title: 'Expert Professionals', 
      desc: 'Skilled technicians and managers with years of experience in residential and commercial property management.'
    },
    { 
      icon: ShieldCheck, 
      title: 'Safe & Well-Maintained', 
      desc: 'Regular inspections, preventive maintenance, and strict safety protocols to protect your investment.'
    },
    { 
      icon: DollarSign, 
      title: 'Cost Effective Solutions', 
      desc: 'Optimized vendor contracts, bulk purchasing, and efficient operations to minimize your expenses.'
    },
    { 
      icon: HeadphonesIcon, 
      title: '24/7 Support', 
      desc: 'Round-the-clock assistance for emergencies. Our team is always ready to respond when you need us.'
    }
  ];

  const withoutXland = [
    'Lift Maintenance',
    'Generator AMC',
    'Plumbing/Electrical',
    'Housekeeping',
    'Security Management',
    'Vendor Coordination',
    'Supervision & Follow-up',
    'Repairs & Emergency'
  ];

  const withXland = [
    'One Team',
    'Verified Vendors',
    'Preventive Maintenance',
    'Timely Service',
    'Transparent Reporting',
    'Cost Optimization',
    'Better Control',
    'Peace of Mind'
  ];

  const roiItems = [
    { icon: TrendingUp, title: 'Reduced Maintenance Cost', desc: 'Up to 30% savings through preventive care and optimized vendor management' },
    { icon: Building2, title: 'Increased Property Life & Value', desc: 'Regular maintenance extends asset life and preserves market value' },
    { icon: Users, title: 'Higher Tenant Satisfaction', desc: 'Quick response times and quality service keeps tenants happy' },
    { icon: Shield, title: 'Lower Risk & More Security', desc: 'Proactive monitoring reduces liability and protects your investment' }
  ];

  const trustItems = [
    { 
      icon: Award, 
      title: 'Trusted Experts',
      points: ['Experienced professionals', 'Industry knowledge', 'Proven track record']
    },
    { 
      icon: Target, 
      title: 'Tailored Solutions',
      points: ['Customized property solutions', 'Flexible service packages', 'Scalable operations']
    },
    { 
      icon: Heart, 
      title: 'Complete Peace of Mind',
      points: ['Reliable service', 'Efficient operations', 'Long-term maintenance value']
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Property Management - Complete Facility Management Solutions"
        description="Professional property management services by XLAND INFRA. Residential & commercial maintenance, AMC services, operations management, vendor coordination, and end-to-end property care."
        keywords="property management, facility management, AMC services, maintenance, operations management, vendor coordination, XLAND INFRA"
        canonical="https://xlandinfra.com/services/property-management"
      />
      
      <MainHeader />

      {/* ============ HERO SECTION ============ */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0">
          {/* Premium gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]"></div>
          {/* Elegant gold ambient glow */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-gold-500/8 via-gold-600/4 to-transparent rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-gold-500/6 via-gold-400/3 to-transparent rounded-full blur-[100px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold-500/3 rounded-full blur-[120px]"></div>
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'linear-gradient(rgba(216,178,92,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(216,178,92,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.2s_forwards]">
                <div className="h-px w-10 bg-gradient-to-r from-gold-400/80 to-transparent"></div>
                <span className="text-gold-400/90 text-sm font-medium tracking-[0.2em] uppercase">Property Management</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-normal mb-6 leading-[1.1] tracking-tight opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.4s_forwards]">
                <span className="text-white">YOUR PROPERTY.</span>
                <br />
                <span className="text-gold-hero">OUR PRIORITY.</span>
              </h1>

              <h2 className="text-xl md:text-2xl text-gold-400/80 font-semibold mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.5s_forwards]">
                Complete Facility Management Solution
              </h2>

              <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-xl mb-8 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.6s_forwards]">
                Residential & Commercial maintenance, AMC services, operations management, complaints handling, vendor coordination, supervision, and end-to-end property care.
              </p>

              <div className="flex flex-wrap gap-4 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.8s_forwards]">
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
                    Get Started
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative hidden lg:block opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.6s_forwards]">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-gold-400/20 to-gold-600/20 rounded-3xl blur-3xl"></div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gold-500/20">
                  <img 
                    src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80" 
                    alt="Luxury Property" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
                </div>
                {/* Floating Logo Card */}
                <div className="absolute -bottom-6 -left-6 bg-[#0D0D0D] border border-gold-500/30 rounded-2xl p-4 shadow-2xl">
                  <BrandLogo size="sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHY CHOOSE XLAND INFRA - COMPARISON SECTION ============ */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Why Choose Us</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-4">
              One Partner. <span className="text-gold-hero">Better Control. Better Value.</span>
            </h2>
          </div>

          {/* Comparison Table */}
          <div className="max-w-5xl mx-auto overflow-hidden">
            {/* Desktop Header Row - Hidden on mobile */}
            <div className="hidden md:grid grid-cols-3 gap-3 lg:gap-4 mb-6">
              <div className="p-3 lg:p-4"></div>
              <div className="p-3 lg:p-4 bg-charcoal-800/50 border border-charcoal-700/50 rounded-xl text-center">
                <span className="text-gray-400 font-semibold text-base lg:text-lg">Typical Market</span>
              </div>
              <div className="p-3 lg:p-4 bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/30 rounded-xl text-center">
                <span className="text-gold-400 font-bold text-base lg:text-lg">XLAND INFRA</span>
              </div>
            </div>

            {/* Comparison Rows - Stack on mobile, grid on desktop */}
            <div className="space-y-4 md:space-y-3">
              {comparisonPoints.map((point, index) => (
                <div 
                  key={index} 
                  className="group"
                >
                  {/* Mobile Layout - Stacked cards */}
                  <div className="md:hidden bg-charcoal-800/30 border border-charcoal-700/30 rounded-xl p-4 space-y-3">
                    <h4 className="text-white font-semibold text-sm border-b border-charcoal-700/30 pb-2">{point.aspect}</h4>
                    <div className="flex items-start gap-3 text-red-400/80">
                      <XIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Market</span>
                        <span className="text-gray-400 text-sm">{point.market}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-gold-500/5 border border-gold-500/20 rounded-lg p-3 -mx-1">
                      <CheckCircle className="w-4 h-4 text-gold-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-gold-400/80 text-xs uppercase tracking-wider block mb-1">XLAND INFRA</span>
                        <span className="text-gray-300 text-sm font-medium">{point.xland}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout - Grid */}
                  <div className="hidden md:grid grid-cols-3 gap-3 lg:gap-4">
                    <div className="p-3 lg:p-4 bg-charcoal-800/30 border border-charcoal-700/30 rounded-xl flex items-center">
                      <span className="text-white font-medium text-sm lg:text-base break-words">{point.aspect}</span>
                    </div>
                    <div className="p-3 lg:p-4 bg-charcoal-800/20 border border-charcoal-700/20 rounded-xl flex items-center gap-2 lg:gap-3 group-hover:bg-charcoal-800/40 transition-colors overflow-hidden">
                      <XIcon className="w-4 h-4 lg:w-5 lg:h-5 text-red-400/70 flex-shrink-0" />
                      <span className="text-gray-500 text-xs lg:text-sm break-words min-w-0">{point.market}</span>
                    </div>
                    <div className="p-3 lg:p-4 bg-gold-500/5 border border-gold-500/20 rounded-xl flex items-center gap-2 lg:gap-3 group-hover:bg-gold-500/10 group-hover:border-gold-500/30 transition-all overflow-hidden">
                      <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-gold-400 flex-shrink-0" />
                      <span className="text-gray-300 text-xs lg:text-sm font-medium break-words min-w-0">{point.xland}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CORE BENEFITS SECTION ============ */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Core Benefits</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-4">
              We Take Care of Your Property, <br />
              <span className="text-gold-hero">So You Can Focus on What Matters</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreBenefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div 
                  key={index}
                  className={`group p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl hover:border-gold-500/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(216,178,92,0.1)] ${index === 4 ? 'lg:col-start-2' : ''}`}
                >
                  <div className="w-16 h-16 mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h3 className="text-xl font-display font-normal text-white mb-3 group-hover:text-gold-400 transition-colors">{benefit.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ REAL COST DIFFERENCE SECTION ============ */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Cost Comparison</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-4">
              The Real <span className="text-gold-hero">Cost Difference</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Without XLAND INFRA */}
            <div className="relative group">
              <div className="absolute inset-0 bg-red-500/5 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative p-8 bg-gradient-to-br from-charcoal-800/80 to-charcoal-900/80 border border-charcoal-700/50 rounded-2xl h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Without XLAND INFRA</h3>
                </div>
                
                <div className="space-y-3 mb-8">
                  {withoutXland.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-red-400/50"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-charcoal-700/50">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-red-400">Total Cost: Higher</span>
                    <p className="text-gray-500 text-sm mt-2">More vendors. More costs. More problems.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* With XLAND INFRA */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gold-500/10 rounded-3xl blur-xl"></div>
              <div className="relative p-8 bg-gradient-to-br from-gold-500/10 to-gold-600/5 border border-gold-500/30 rounded-2xl h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gold-500/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
                    <ThumbsUp className="w-6 h-6 text-gold-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">With XLAND INFRA</h3>
                </div>
                
                <div className="space-y-3 mb-8">
                  {withXland.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 text-gray-300">
                      <CheckCircle className="w-5 h-5 text-gold-400 flex-shrink-0" />
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-gold-500/20">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-gold-400">Total Cost: Optimized</span>
                    <p className="text-gray-400 text-sm mt-2">One Partner. Better Control. More Value. Less Hassle.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ROI / VALUE SECTION ============ */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Return on Investment</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-4">
              The ROI of <span className="text-gold-hero">Smart Property Management</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roiItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={index}
                  className="group text-center p-8 bg-gradient-to-br from-charcoal-800/30 to-charcoal-900/30 border border-charcoal-700/30 rounded-2xl hover:border-gold-500/30 transition-all duration-500"
                >
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h3 className="text-lg font-display font-normal text-white mb-3 group-hover:text-gold-400 transition-colors">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ TRUST & COMMITMENT SECTION ============ */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
          <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Trust & Commitment</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-4">
              Why Owners Choose <span className="text-gold-hero">XLAND INFRA</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {trustItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={index}
                  className="group p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl hover:border-gold-500/30 transition-all duration-500"
                >
                  <div className="w-16 h-16 mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h3 className="text-2xl font-display font-normal text-white mb-4 group-hover:text-gold-400 transition-colors">{item.title}</h3>
                  <div className="space-y-3">
                    {item.points.map((point, pIndex) => (
                      <div key={pIndex} className="flex items-center gap-3 text-gray-400">
                        <CheckCircle className="w-4 h-4 text-gold-400 flex-shrink-0" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ CTA SECTION ============ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0D0D0D] to-[#0a0a0a]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold-500/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Heading */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-normal text-white mb-6">
            One Partner. All Solutions. <br />
            <span className="text-gold-hero">Total Peace of Mind.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
            Ready to experience hassle-free property management? Let's discuss how we can help protect and grow your investment.
          </p>

          {/* Contact Details */}
          <div className="flex flex-wrap justify-center gap-8 mb-10">
            <a href="tel:+918500010111" className="flex items-center gap-3 text-gray-300 hover:text-gold-400 transition-colors">
              <div className="w-10 h-10 bg-gold-400/10 border border-gold-500/30 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-gold-400" />
              </div>
              <span className="font-medium">+91 8500 010 111</span>
            </a>
            <a href="mailto:info@xlandinfra.com" className="flex items-center gap-3 text-gray-300 hover:text-gold-400 transition-colors">
              <div className="w-10 h-10 bg-gold-400/10 border border-gold-500/30 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-gold-400" />
              </div>
              <span className="font-medium">info@xlandinfra.com</span>
            </a>
            <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 bg-gold-400/10 border border-gold-500/30 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-gold-400" />
              </div>
              <span className="font-medium">Mangalagiri, Guntur</span>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => {
              navigate('/');
              setTimeout(() => {
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="group px-10 py-5 bg-[#D4AF37] hover:bg-[#C9A227] text-[#0a0a0a] font-bold text-lg rounded-full hover:shadow-2xl hover:shadow-gold-500/30 transition-all duration-300"
          >
            <span className="flex items-center justify-center gap-3">
              Contact Us Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-12 border-t border-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <BrandLogo size="sm" />
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} XLAND INFRA PVT LTD. All rights reserved.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-gold-400 hover:text-gold-300 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              Back to Home
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PropertyManagement;
