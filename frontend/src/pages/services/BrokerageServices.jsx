import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Shield, Users, Target, Sparkles, TrendingUp, CheckCircle, Award,
  ArrowRight, FileCheck, Search, UserCheck, Key, BarChart3, Home,
  MapPin, Briefcase, Globe, Phone
} from 'lucide-react';
import MainHeader from '../../components/MainHeader';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const BrokerageServices = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const services = [
    { icon: Building2, title: 'Property Buying & Selling', desc: 'Expert assistance in property transactions with verified listings and market knowledge' },
    { icon: Key, title: 'Property Acquisition', desc: 'Strategic property acquisition services for residential and commercial assets' },
    { icon: Briefcase, title: 'Deal Negotiation', desc: 'Professional negotiation to secure the best terms and pricing for clients' },
    { icon: Globe, title: 'Market Access', desc: 'Access to exclusive listings and off-market opportunities across India' },
    { icon: FileCheck, title: 'Transaction Support', desc: 'Complete documentation and legal compliance throughout the process' }
  ];

  const whyChooseUs = [
    { icon: TrendingUp, title: 'Extensive Network', desc: 'Strong connections with developers, investors, and property owners nationwide' },
    { icon: CheckCircle, title: 'Verified Listings', desc: 'Every property is thoroughly verified for authenticity and clear titles' },
    { icon: Award, title: 'Expert Negotiation', desc: 'Skilled negotiators ensuring optimal deal terms and pricing' },
    { icon: Sparkles, title: 'Strategic Execution', desc: 'End-to-end deal management with professional precision' }
  ];

  const howItWorks = [
    { step: '01', title: 'Requirement Analysis', desc: 'Understanding your property needs and investment goals', icon: Search },
    { step: '02', title: 'Property Shortlisting', desc: 'Curated selection matching your specific criteria', icon: Home },
    { step: '03', title: 'Site Visits & Evaluation', desc: 'Organized property tours with expert insights', icon: MapPin },
    { step: '04', title: 'Negotiation & Structuring', desc: 'Professional deal negotiation and terms structuring', icon: Briefcase },
    { step: '05', title: 'Transaction Closure', desc: 'Complete legal documentation and registration support', icon: Key }
  ];

  const whoWeHelp = [
    { 
      title: 'Property Buyers',
      desc: 'Find your ideal property with expert guidance, verified options, and seamless transaction support.',
      icon: Users,
      features: ['Verified Properties', 'Expert Guidance', 'Best Pricing']
    },
    { 
      title: 'Property Sellers',
      desc: 'Maximize returns with strategic marketing, qualified buyer matching, and professional sales execution.',
      icon: Building2,
      features: ['Wide Market Reach', 'Qualified Buyers', 'Optimal Pricing']
    },
    { 
      title: 'Real Estate Investors',
      desc: 'Strategic acquisition support with market analysis, ROI assessment, and portfolio optimization.',
      icon: TrendingUp,
      features: ['Investment Analysis', 'Market Insights', 'Portfolio Growth']
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Brokerage Services - Property Buying, Selling & Acquisition"
        description="Professional property brokerage services by XLAND INFRA. Expert buying, selling, acquisition support with verified listings, deal negotiation, and complete transaction management."
        keywords="brokerage services, property buying, property selling, real estate acquisition, deal negotiation, property transactions, XLAND INFRA"
        canonical="https://xlandinfra.com/services/brokerage-services"
      />
      
      <MainHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80')] bg-cover bg-center bg-fixed opacity-5"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a]"></div>
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gold-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-600/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3"></div>
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.2s_forwards]">
              <div className="h-px w-10 bg-gradient-to-r from-gold-400/80 to-transparent"></div>
              <span className="text-gold-400/90 text-sm font-medium tracking-[0.2em] uppercase">Brokerage Services</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 leading-[1.1] tracking-tight opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.4s_forwards]">
              <span className="text-white">PROFESSIONAL</span>
              <br />
              <span className="text-white">PROPERTY BROKERAGE</span>
              <br />
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">TRUSTED DEALS.</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mb-8 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.6s_forwards]">
              At XLAND INFRA PVT LTD, we deliver professional property buying, selling, and acquisition services through strong market networks, verified listings, and strategic deal execution. Our experienced team ensures seamless transactions with optimal outcomes for every client.
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
              Comprehensive <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Brokerage Solutions</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Expert brokerage services for seamless property transactions
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <div 
                  key={index}
                  className="group p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl hover:border-gold-500/30 transition-all duration-500 hover:shadow-[0_0_40px_rgba(216,178,92,0.1)]"
                >
                  <div className="w-14 h-14 mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-7 h-7 text-gold-400" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-white mb-3">{service.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{service.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Why Choose Us</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              The XLAND <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Advantage</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyChooseUs.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={index}
                  className="text-center p-8 bg-gradient-to-br from-charcoal-800/30 to-charcoal-900/30 border border-charcoal-700/30 rounded-2xl hover:border-gold-500/30 transition-all duration-500"
                >
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl flex items-center justify-center">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Our Process</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              How It <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Works</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative text-center">
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl flex items-center justify-center">
                      <Icon className="w-10 h-10 text-gold-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-gold-400 to-gold-600 text-[#0a0a0a] font-bold text-sm rounded-full flex items-center justify-center">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-display font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.desc}</p>
                  {index < howItWorks.length - 1 && (
                    <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-gold-500/30 to-transparent"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who We Help */}
      <section className="py-20 md:py-28 relative">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Who We Help</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-4">
              Our <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Clients</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {whoWeHelp.map((client, index) => {
              const Icon = client.icon;
              return (
                <div 
                  key={index}
                  className="p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl hover:border-gold-500/30 transition-all duration-500"
                >
                  <div className="w-16 h-16 mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl flex items-center justify-center">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-white mb-4">{client.title}</h3>
                  <p className="text-gray-400 leading-relaxed mb-6">{client.desc}</p>
                  <div className="space-y-3">
                    {client.features.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-center gap-3 text-sm text-gray-300">
                        <CheckCircle className="w-4 h-4 text-gold-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 relative bg-[#0D0D0D]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-gold-600/10 via-transparent to-gold-600/10"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
            Ready to Start Your <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Property Journey?</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
            Connect with our expert brokerage team for personalized property solutions
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => {
                navigate('/');
                setTimeout(() => {
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="group px-10 py-4 bg-gradient-to-r from-gold-400 to-gold-600 text-[#0a0a0a] font-semibold rounded-full hover:shadow-2xl hover:shadow-gold-500/30 transition-all duration-300"
            >
              <span className="flex items-center gap-2">
                Contact Us Today
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <a
              href="tel:+919876543210"
              className="px-10 py-4 border border-gold-500/30 text-gold-400 font-semibold rounded-full hover:bg-gold-500/10 hover:border-gold-400/50 transition-all duration-300 flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              Call Now
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
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

export default BrokerageServices;
