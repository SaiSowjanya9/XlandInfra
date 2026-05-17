import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Shield, Users, Target, Sparkles, TrendingUp, CheckCircle, Award,
  ArrowRight, FileCheck, Search, UserCheck, Key, FileText, BarChart3, Home
} from 'lucide-react';
import MainHeader from '../../components/MainHeader';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const PropertySalesAdvisory = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const services = [
    { icon: Building2, title: 'Property Listing & Marketing', desc: 'Professional listing with premium marketing reach across multiple channels' },
    { icon: Shield, title: 'Legal Verification', desc: 'Complete legal due diligence and documentation verification' },
    { icon: Users, title: 'Targeted Buyer Matching', desc: 'Connect with verified and qualified potential buyers' },
    { icon: Target, title: 'Sales Execution', desc: 'Professional handling of complete sales process' },
    { icon: Sparkles, title: 'Advisory Solutions', desc: 'Expert property advisory and strategic consultation' }
  ];

  const whyChooseUs = [
    { icon: TrendingUp, title: 'Wider Market Reach', desc: 'Access to extensive network of buyers and investors across India' },
    { icon: CheckCircle, title: 'Verified & Trusted Listings', desc: 'Every property is thoroughly verified for authenticity and legal compliance' },
    { icon: Award, title: 'Professional Sales Handling', desc: 'Expert negotiation and seamless deal management' },
    { icon: Sparkles, title: 'Better Price & Returns', desc: 'Maximize property value with strategic pricing and marketing' }
  ];

  const howItWorks = [
    { step: '01', title: 'Property Verification', desc: 'Complete legal and documentation verification', icon: FileCheck },
    { step: '02', title: 'Listing on Our Portal', desc: 'Professional listing with premium visibility', icon: Home },
    { step: '03', title: 'Marketing & Buyer Search', desc: 'Targeted marketing to qualified buyers', icon: Search },
    { step: '04', title: 'Site Visits & Negotiation', desc: 'Managed viewings and price negotiations', icon: UserCheck },
    { step: '05', title: 'Deal Closure', desc: 'Complete transaction and documentation support', icon: Key }
  ];

  const whoWeHelp = [
    { 
      title: 'Buyers',
      desc: 'Find your perfect property with verified listings, expert guidance, and transparent transactions.',
      icon: Users,
      features: ['Verified Properties', 'Expert Guidance', 'Transparent Process']
    },
    { 
      title: 'Sellers & Developers',
      desc: 'Maximize property value with professional marketing, wider reach, and strategic pricing.',
      icon: Building2,
      features: ['Premium Marketing', 'Wide Network', 'Best Returns']
    },
    { 
      title: 'Investors',
      desc: 'Strategic investment opportunities with comprehensive analysis and ROI-focused recommendations.',
      icon: TrendingUp,
      features: ['ROI Analysis', 'Market Insights', 'Portfolio Growth']
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Property Sales & Advisory Services"
        description="Complete end-to-end property sales and advisory solutions by XLAND INFRA. Verified listings, strategic marketing, buyer matching, negotiation handling, and deal closure support."
        keywords="property sales, real estate advisory, property listing, buyer matching, sales execution, property verification, XLAND INFRA"
        canonical="https://xlandinfra.com/services/property-sales-advisory"
      />
      
      <MainHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80')] bg-cover bg-center bg-fixed opacity-5"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a]"></div>
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3"></div>
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.2s_forwards]">
              <div className="h-px w-10 bg-gradient-to-r from-gold-400/80 to-transparent"></div>
              <span className="text-gold-400/90 text-sm font-medium tracking-[0.2em] uppercase">Property Sales & Advisory</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 leading-[1.1] tracking-tight opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.4s_forwards]">
              <span className="text-white">WE VERIFY, LIST,</span>
              <br />
              <span className="text-white">MARKET AND SELL –</span>
              <br />
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">ALL IN ONE PLACE.</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mb-8 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.6s_forwards]">
              At XLAND INFRA PVT LTD, we provide complete property sales and advisory solutions with verified listings, professional marketing, buyer matching, and end-to-end transaction support. From legal verification to final deal closure, we simplify the entire property selling process under one trusted platform.
            </p>

            <div className="flex flex-wrap gap-4 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.8s_forwards]">
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
                  Get Started
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

      {/* Our Services */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Our Services</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              Complete <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Property Solutions</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              End-to-end services designed to simplify your property journey
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-gold-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative p-6 bg-[#0D0D0D] border border-gold-500/10 rounded-2xl hover:border-gold-500/30 transition-all duration-500 h-full group-hover:translate-y-[-4px]">
                    <div className="w-14 h-14 mb-5 bg-gradient-to-br from-gold-400/10 to-gold-600/10 border border-gold-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:border-gold-400/50 transition-all duration-500 shadow-[0_0_20px_rgba(216,178,92,0.1)]">
                      <Icon className="w-7 h-7 text-gold-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-white group-hover:text-gold-400 transition-colors mb-2">{service.title}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{service.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 md:py-28 relative bg-[#080808]">
        <div className="absolute inset-0">
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gold-600/5 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Why <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Choose Us</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyChooseUs.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="text-center p-6 bg-gradient-to-b from-gold-500/5 to-transparent rounded-2xl border border-gold-500/10 hover:border-gold-500/30 transition-all duration-500 group hover:translate-y-[-4px]">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gold-400/20 to-gold-600/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(216,178,92,0.15)] group-hover:shadow-[0_0_40px_rgba(216,178,92,0.25)] transition-all">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-gold-400 transition-colors">{item.title}</h4>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              How It <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Works</span>
            </h2>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent"></div>
            
            <div className="grid lg:grid-cols-5 gap-8">
              {howItWorks.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="relative text-center group">
                    <div className="relative z-10 w-16 h-16 mx-auto mb-6 bg-[#0D0D0D] border-2 border-gold-500/30 rounded-full flex items-center justify-center group-hover:border-gold-400 group-hover:shadow-[0_0_30px_rgba(216,178,92,0.3)] transition-all duration-500">
                      <span className="text-gold-400 font-bold text-lg">{item.step}</span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-gold-400 transition-colors">{item.title}</h4>
                    <p className="text-gray-500 text-sm">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Who We Help */}
      <section className="py-20 md:py-28 relative bg-[#080808]">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gold-600/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Who We <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Help</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {whoWeHelp.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="group relative overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-500/10 via-transparent to-gold-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative p-8 bg-[#0D0D0D] border border-gold-500/10 rounded-2xl hover:border-gold-500/30 transition-all duration-500 h-full group-hover:translate-y-[-4px]">
                    <div className="w-16 h-16 mb-6 bg-gradient-to-br from-gold-400/10 to-gold-600/10 border border-gold-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <Icon className="w-8 h-8 text-gold-400" />
                    </div>
                    <h4 className="text-2xl font-bold text-white group-hover:text-gold-400 transition-colors mb-3">{item.title}</h4>
                    <p className="text-gray-400 leading-relaxed mb-6">{item.desc}</p>
                    <div className="space-y-2">
                      {item.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-gold-400" />
                          <span className="text-gray-400 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium CTAs */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[200px]"></div>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gold-500/20 blur-2xl rounded-full"></div>
            <h3 className="relative text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white leading-tight">
              RIGHT PROPERTY. RIGHT PRICE.<br />
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">RIGHT DECISION.</span>
            </h3>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="px-8 py-4 bg-gradient-to-r from-gold-500/10 to-gold-600/10 border border-gold-500/20 rounded-full">
              <p className="text-gold-400 font-semibold tracking-wide">FROM LISTING TO CLOSING – WE DELIVER RESULTS.</p>
            </div>
          </div>

          <p className="text-2xl md:text-3xl font-display text-white">
            ONE PARTNER. ALL SOLUTIONS. <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent font-bold">TOTAL PEACE OF MIND.</span>
          </p>

          <div className="pt-4">
            <button
              onClick={() => {
                navigate('/');
                setTimeout(() => {
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="group relative px-10 py-5 overflow-hidden rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-500 hover:shadow-2xl hover:shadow-gold-500/30"
            >
              <span className="relative flex items-center gap-3 font-bold text-lg text-[#0D0D0D]">
                Get Started Today
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
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

export default PropertySalesAdvisory;
