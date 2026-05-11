import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  TrendingUp, 
  Compass, 
  HardHat, 
  Key, 
  Settings,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  Phone,
  Mail,
  MapPin,
  Users,
  Award,
  Target,
  Send,
  Menu,
  X,
  CheckCircle,
  Clock,
  Shield,
  Sparkles,
  ExternalLink,
  Play,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Circle
} from 'lucide-react';
import Logo from '../assets/LOGO 2.png';

// Services Data
const services = [
  {
    id: 'investment',
    title: 'Investment Consultation',
    subtitle: 'Advisory',
    description: 'Strategic investment guidance for real estate portfolios with market analysis and ROI projections.',
    icon: TrendingUp,
    features: ['Portfolio Analysis', 'Market Research', 'ROI Projections', 'Risk Assessment']
  },
  {
    id: 'design',
    title: 'Design & Conceptualization',
    subtitle: 'Planning',
    description: 'Innovative architectural designs and space planning that blend aesthetics with functionality.',
    icon: Compass,
    features: ['3D Visualization', 'Space Planning', 'Interior Design', 'Sustainable Design']
  },
  {
    id: 'construction',
    title: 'Construction & Delivery',
    subtitle: 'Execution',
    description: 'End-to-end construction management ensuring quality, safety, and timely project completion.',
    icon: HardHat,
    features: ['Project Management', 'Quality Control', 'Timeline Tracking', 'Safety Compliance']
  },
  {
    id: 'brokerage',
    title: 'Brokerage Services',
    subtitle: 'Sales',
    description: 'Comprehensive property sales and acquisition services with extensive market networks.',
    icon: Key,
    features: ['Property Sales', 'Acquisitions', 'Market Valuation', 'Negotiation']
  },
  {
    id: 'property-management',
    title: 'Property Management',
    subtitle: 'Operations',
    description: '360° property management solutions ensuring optimal asset performance and tenant satisfaction.',
    icon: Settings,
    features: ['Tenant Management', 'Maintenance', 'Financial Reporting', '24/7 Support']
  }
];

// Projects Data - India Real Estate Images
const projects = [
  {
    id: 1,
    title: 'Horizon Business Hub',
    location: 'Hyderabad, Telangana',
    type: 'Commercial',
    status: 'Completed',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
    value: '₹250 Cr'
  },
  {
    id: 2,
    title: 'Royal Palm Residences',
    location: 'Bangalore, Karnataka',
    type: 'Residential',
    status: 'Ongoing',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    value: '₹180 Cr'
  },
  {
    id: 3,
    title: 'Metro Trade Center',
    location: 'Mumbai, Maharashtra',
    type: 'Commercial',
    status: 'Completed',
    image: 'https://images.unsplash.com/photo-1464938050520-ef2571deec0f?w=800&q=80',
    value: '₹420 Cr'
  },
  {
    id: 4,
    title: 'Lakeside Villas',
    location: 'Chennai, Tamil Nadu',
    type: 'Residential',
    status: 'Upcoming',
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    value: '₹150 Cr'
  }
];

// Stats Data
const stats = [
  { value: '15+', label: 'Years Experience', icon: Clock },
  { value: '500+', label: 'Projects Delivered', icon: Building2 },
  { value: '₹5000Cr+', label: 'Assets Managed', icon: TrendingUp },
  { value: '10K+', label: 'Happy Clients', icon: Users }
];


function CorporateLanding() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      
      // Update active section based on scroll position
      const sections = ['home', 'about', 'services', 'projects', 'contact'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to section
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('Thank you for your inquiry. We will get back to you shortly.');
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services' },
    { id: 'projects', label: 'Projects' },
    { id: 'contact', label: 'Contact Us' }
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      {/* ============ PREMIUM NAVIGATION ============ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isScrolled 
          ? 'bg-[#0D0D0D]/95 backdrop-blur-2xl shadow-2xl shadow-black/80 border-b border-gold-500/20' 
          : 'bg-gradient-to-b from-black/60 to-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-4 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gold-400/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img src={Logo} alt="XLAND INFRA" className="h-14 w-auto relative transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="hidden sm:block">
                <span className="text-2xl font-bold tracking-tight">
                  <span className="text-white">XLAND</span>
                  <span className="text-gold-400">INFRA</span>
                </span>
                <p className="text-[10px] text-gray-500 tracking-[0.3em] uppercase">Private Limited</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={`relative px-5 py-2.5 text-sm font-medium tracking-wide transition-all duration-300 group ${
                    activeSection === link.id
                      ? 'text-gold-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {link.label}
                  <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-300 ${
                    activeSection === link.id ? 'w-8' : 'w-0 group-hover:w-6'
                  }`}></span>
                </button>
              ))}
            </div>

            {/* CTA Button */}
            <div className="hidden lg:flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="group relative px-8 py-3 overflow-hidden rounded-full"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 transition-transform duration-500 group-hover:scale-105"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative font-semibold text-[#0D0D0D] text-sm tracking-wide">Customer Login</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-3 rounded-xl text-gray-400 hover:text-gold-400 hover:bg-white/5 transition-all duration-300"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`lg:hidden overflow-hidden transition-all duration-500 ${
          mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-[#0D0D0D]/98 backdrop-blur-2xl border-t border-gold-500/10 px-6 py-8 space-y-2">
            {navLinks.map((link, index) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className={`block w-full text-left px-5 py-4 rounded-xl text-base font-medium transition-all duration-300 ${
                  activeSection === link.id
                    ? 'text-gold-400 bg-gold-400/10 border-l-2 border-gold-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {link.label}
              </button>
            ))}
            <div className="pt-6 mt-4 border-t border-white/10">
              <button
                onClick={() => navigate('/login')}
                className="block w-full py-4 bg-gradient-to-r from-gold-400 to-gold-600 text-[#0D0D0D] font-semibold rounded-xl text-center"
              >
                Customer Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ============ HERO SECTION WITH VIDEO ============ */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
        {/* Video/Image Background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            poster="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80"
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
          {/* Fallback image if video doesn't load */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80')] bg-cover bg-center"></div>
          
          {/* Premium Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-transparent to-[#0D0D0D]/60"></div>
          <div className="absolute inset-0 bg-[#0D0D0D]/40"></div>
        </div>

        {/* Animated Gold Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-gold-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gold-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
          {/* Geometric lines */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-gold-500/20 to-transparent"></div>
          <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-gold-500/10 to-transparent"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pt-32 pb-20">
          <div className="max-w-3xl">
            {/* Eyebrow Text */}
            <div className="flex items-center gap-3 mb-8 animate-fade-in">
              <div className="h-px w-12 bg-gradient-to-r from-gold-400 to-transparent"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.2em] uppercase">Real Estate & Infrastructure</span>
            </div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-8 leading-[1.1] animate-fade-in-up">
              <span className="text-white">Building</span>
              <br />
              <span className="text-gold-gradient">Dreams Into</span>
              <br />
              <span className="text-white">Reality</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-400 mb-10 leading-relaxed max-w-xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Premier real estate development and property management services across India. 
              Delivering excellence in every project since 2009.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <button
                onClick={() => scrollToSection('services')}
                className="group relative px-8 py-4 overflow-hidden rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-500 hover:shadow-2xl hover:shadow-gold-500/30"
              >
                <span className="relative flex items-center gap-2 font-semibold text-[#0D0D0D]">
                  Explore Services
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={() => scrollToSection('projects')}
                className="group px-8 py-4 rounded-full border border-white/20 hover:border-gold-400/50 hover:bg-white/5 transition-all duration-500"
              >
                <span className="flex items-center gap-2 font-semibold text-white group-hover:text-gold-400">
                  <Play className="w-4 h-4" />
                  View Projects
                </span>
              </button>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-8 md:gap-12 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              {[
                { value: '15+', label: 'Years' },
                { value: '500+', label: 'Projects' },
                { value: '₹5000Cr+', label: 'Assets' },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-3xl md:text-4xl font-display font-bold text-gold-400">{stat.value}</p>
                  <p className="text-sm text-gray-500 uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <button 
            onClick={() => scrollToSection('about')} 
            className="flex flex-col items-center gap-2 text-gray-500 hover:text-gold-400 transition-colors group"
          >
            <span className="text-xs tracking-[0.2em] uppercase">Explore</span>
            <div className="w-6 h-10 rounded-full border border-gray-600 group-hover:border-gold-400/50 flex items-start justify-center p-1 transition-colors">
              <div className="w-1 h-2 bg-gold-400 rounded-full animate-bounce"></div>
            </div>
          </button>
        </div>

        {/* Side Decoration */}
        <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center gap-4">
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-gold-500/30 to-transparent"></div>
            <span className="text-[10px] text-gray-500 tracking-[0.3em] uppercase vertical-text">XLAND INFRA</span>
            <div className="w-px h-20 bg-gradient-to-b from-transparent via-gold-500/30 to-transparent"></div>
          </div>
        </div>
      </section>

      {/* ============ ABOUT SECTION ============ */}
      <section id="about" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4 block">About Us</span>
            <h2 className="section-title mb-6">
              Redefining <span className="text-gold-gradient">Real Estate</span> Excellence
            </h2>
            <p className="section-subtitle mx-auto">
              With over 15 years of industry expertise, XLAND INFRA has established itself as a premier real estate and infrastructure company, delivering exceptional value across the complete property lifecycle.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="card-premium text-center group hover:border-gold-400/50 premium-card"
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gold-400/20 to-gold-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8 text-gold-400" />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-display font-bold text-gold-400 mb-2">{stat.value}</h3>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* About Content */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-display font-bold text-white">
                Your Trusted Partner in <span className="text-gold-400">Property Excellence</span>
              </h3>
              <p className="text-gray-400 leading-relaxed">
                At XLAND INFRA, we believe that every property tells a story. Our mission is to craft exceptional spaces that inspire, nurture growth, and create lasting value for our clients and communities.
              </p>
              <p className="text-gray-400 leading-relaxed">
                From strategic investment consultation to comprehensive property management, we offer a complete ecosystem of services designed to maximize your real estate potential.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4">
                {[
                  { icon: Shield, text: 'Trusted Excellence' },
                  { icon: Target, text: 'Result Driven' },
                  { icon: Award, text: 'Industry Leader' },
                  { icon: Users, text: 'Client Focused' }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center space-x-3 text-gray-300">
                      <Icon className="w-5 h-5 text-gold-400" />
                      <span className="text-sm">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"
                  alt="XLAND INFRA Office"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-br from-gold-400 to-gold-600 p-6 rounded-2xl shadow-2xl">
                <p className="text-charcoal-900 font-bold text-lg">15+ Years</p>
                <p className="text-charcoal-900/70 text-sm">of Excellence</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PREMIUM SERVICES SECTION - CONNECTED FLOW LAYOUT ============ */}
      <section id="services" className="py-24 md:py-32 relative bg-[#0D0D0D] overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #D8B25C 1px, transparent 0)', backgroundSize: '48px 48px' }}></div>
          {/* Ambient glow */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gold-600/5 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-[0.25em] uppercase">Our Services</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="section-title mb-6">
              Complete Real Estate <span className="text-gold-gradient">Lifecycle</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              A seamless ecosystem of services working together to maximize value at every stage of your property journey.
            </p>
          </div>

          {/* Horizontal Timeline Flow - Desktop */}
          <div className="hidden lg:block relative mb-20">
            {/* Central connecting line */}
            <div className="absolute top-[60px] left-0 right-0 h-[2px]">
              <div className="h-full bg-gradient-to-r from-transparent via-gold-500/30 to-transparent"></div>
              <div className="absolute inset-0 flow-line h-[2px]"></div>
            </div>

            {/* Service nodes */}
            <div className="flex justify-between items-start relative">
              {services.map((service, index) => {
                const Icon = service.icon;
                const isEven = index % 2 === 0;
                return (
                  <div
                    key={service.id}
                    className={`relative flex flex-col items-center w-1/5 ${isEven ? 'pt-0' : 'pt-32'}`}
                  >
                    {/* Connection dot */}
                    <div className={`absolute ${isEven ? 'top-[52px]' : 'top-[52px]'} left-1/2 -translate-x-1/2 z-20`}>
                      <div className="w-4 h-4 rounded-full bg-[#0D0D0D] border-2 border-gold-400 shadow-[0_0_20px_rgba(216,178,92,0.4)]">
                        <div className="absolute inset-1 rounded-full bg-gold-400"></div>
                      </div>
                    </div>

                    {/* Vertical connector */}
                    <div className={`absolute left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-gold-500/50 to-transparent ${isEven ? 'top-[68px] h-8' : 'top-[68px] h-8'}`}></div>

                    {/* Service Card */}
                    <div className={`group relative w-full ${isEven ? 'mt-20' : 'mt-12'}`}>
                      <div className="service-card-premium cursor-pointer">
                        {/* Step number badge */}
                        <div className="service-number">0{index + 1}</div>
                        
                        {/* Icon */}
                        <div className="w-14 h-14 mb-5 bg-gradient-to-br from-gold-400/10 to-gold-600/10 border border-gold-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:border-gold-400/50 transition-all duration-500">
                          <Icon className="w-7 h-7 text-gold-400" />
                        </div>

                        {/* Content */}
                        <h4 className="text-lg font-semibold text-white group-hover:text-gold-400 transition-colors mb-2 pr-12">
                          {service.title}
                        </h4>
                        <p className="text-gray-500 text-sm leading-relaxed mb-4">
                          {service.description}
                        </p>

                        {/* Features - Compact */}
                        <div className="space-y-1.5">
                          {service.features.slice(0, 2).map((feature, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <Circle className="w-1.5 h-1.5 fill-gold-500 text-gold-500" />
                              <span className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile/Tablet - Alternating Premium Cards */}
          <div className="lg:hidden space-y-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.id}
                  className="group relative"
                >
                  <div className="service-card-premium">
                    {/* Step number */}
                    <div className="service-number">0{index + 1}</div>
                    
                    <div className="flex items-start gap-5">
                      {/* Icon */}
                      <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-gold-400/10 to-gold-600/10 border border-gold-500/20 rounded-xl flex items-center justify-center group-hover:scale-105 group-hover:border-gold-400/50 transition-all duration-500">
                        <Icon className="w-8 h-8 text-gold-400" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pr-8">
                        <span className="text-gold-500/60 text-xs font-medium uppercase tracking-wider">{service.subtitle}</span>
                        <h4 className="text-xl font-semibold text-white group-hover:text-gold-400 transition-colors mt-1 mb-2">
                          {service.title}
                        </h4>
                        <p className="text-gray-500 text-sm leading-relaxed mb-4">
                          {service.description}
                        </p>

                        {/* Features */}
                        <div className="flex flex-wrap gap-2">
                          {service.features.map((feature, idx) => (
                            <span 
                              key={idx} 
                              className="px-3 py-1 bg-gold-500/5 border border-gold-500/10 rounded-full text-xs text-gray-400 group-hover:border-gold-500/20 group-hover:text-gray-300 transition-all"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connector line between cards */}
                  {index < services.length - 1 && (
                    <div className="flex justify-center py-2">
                      <div className="w-px h-6 bg-gradient-to-b from-gold-500/30 to-transparent"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Flow Indicator */}
          <div className="mt-16 flex justify-center">
            <div className="relative">
              {/* Glowing background */}
              <div className="absolute inset-0 bg-gold-500/10 blur-xl rounded-full"></div>
              
              <div className="relative inline-flex items-center gap-3 px-8 py-4 bg-[#0D0D0D] border border-gold-500/20 rounded-full backdrop-blur-sm">
                {services.map((service, index) => (
                  <div key={service.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(216,178,92,0.5)]"></div>
                      <span className="text-gray-400 text-sm hidden sm:inline">{service.subtitle}</span>
                      <span className="text-gray-400 text-xs sm:hidden">{index + 1}</span>
                    </div>
                    {index < services.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gold-500/50" />
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gold-500/20">
                  <Sparkles className="w-4 h-4 text-gold-400" />
                  <span className="text-gold-400 font-medium text-sm">Repeat</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PROJECTS SECTION ============ */}
      <section id="projects" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Our Portfolio</span>
            <h2 className="section-title mb-6">
              Featured <span className="text-gold-gradient">Projects</span>
            </h2>
            <p className="section-subtitle mx-auto">
              Showcasing our landmark developments that have transformed skylines and created lasting value.
            </p>
          </div>

          {/* Projects Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project, index) => (
              <div
                key={project.id}
                className="group relative rounded-2xl overflow-hidden premium-card cursor-pointer"
              >
                {/* Image */}
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900 via-charcoal-900/60 to-transparent"></div>
                
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 ${
                        project.status === 'Completed' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : project.status === 'Ongoing'
                          ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                          : 'bg-white/10 text-white border border-white/20'
                      }`}>
                        {project.status}
                      </span>
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-gold-400 transition-colors">
                        {project.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-gray-400 text-sm">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{project.location}</span>
                        </span>
                        <span className="text-gold-400 font-semibold">{project.value}</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-gold-400/20 border border-gold-500/30 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                      <ArrowUpRight className="w-5 h-5 text-gold-400" />
                    </div>
                  </div>
                </div>

                {/* Type Badge */}
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-charcoal-900/80 backdrop-blur-sm text-white text-xs font-medium rounded-full border border-white/10">
                    {project.type}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* View All Button */}
          <div className="text-center mt-12">
            <button className="btn-outline inline-flex items-center space-x-2 group">
              <span>View All Projects</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ============ INVESTMENT OPPORTUNITIES SECTION ============ */}
      <section className="py-24 md:py-32 relative bg-gradient-to-br from-charcoal-800 via-charcoal-900 to-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Investment Opportunities</span>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
                Grow Your Wealth with <span className="text-gold-gradient">Strategic Investments</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Partner with XLAND INFRA to unlock premium investment opportunities in high-growth real estate markets. Our expert team provides comprehensive analysis, risk assessment, and portfolio management to maximize your returns.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  'Curated investment opportunities with proven track records',
                  'Comprehensive due diligence and market analysis',
                  'Flexible investment structures for diverse portfolios',
                  'Transparent reporting and regular performance updates'
                ].map((item, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => scrollToSection('contact')}
                className="btn-primary inline-flex items-center space-x-2 group"
              >
                <span>Schedule Consultation</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80"
                  alt="Investment Growth"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-gold-400/20 to-gold-600/20 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-gold-400/20 to-gold-600/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PROPERTY MANAGEMENT SOLUTIONS ============ */}
      <section className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80"
                  alt="Property Management"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Property Management</span>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
                360° Property <span className="text-gold-gradient">Management Solutions</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Our comprehensive property management services ensure your assets perform optimally while providing exceptional experiences for tenants and stakeholders.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Users, title: 'Tenant Relations', desc: 'Seamless tenant management' },
                  { icon: Settings, title: 'Maintenance', desc: '24/7 maintenance support' },
                  { icon: TrendingUp, title: 'Financial', desc: 'Transparent reporting' },
                  { icon: Shield, title: 'Compliance', desc: 'Regulatory adherence' }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="p-4 bg-charcoal-800/50 rounded-xl border border-charcoal-700/50 hover:border-gold-500/30 transition-colors">
                      <Icon className="w-8 h-8 text-gold-400 mb-3" />
                      <h4 className="text-white font-semibold mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CUSTOMER LOGIN CTA SECTION ============ */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gold-600/20 via-gold-500/10 to-gold-600/20"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Already a Customer?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Access your personalized dashboard to manage properties, track work orders, view payments, and more.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="btn-premium inline-flex items-center space-x-2"
            >
              <span>Customer Portal Login</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/register')}
              className="btn-outline"
            >
              Register Now
            </button>
          </div>
        </div>
      </section>

      {/* ============ CONTACT SECTION ============ */}
      <section id="contact" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <span className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Contact Us</span>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
                Let's Build <span className="text-gold-gradient">Together</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Have a project in mind or need expert consultation? Our team is ready to help you navigate your real estate journey.
              </p>

              <div className="space-y-6 mb-10">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-400/10 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Phone</h4>
                    <p className="text-gray-400">+91 98765 43210</p>
                    <p className="text-gray-400">+91 40 1234 5678</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-400/10 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Email</h4>
                    <p className="text-gray-400">info@xlandinfra.com</p>
                    <p className="text-gray-400">support@xlandinfra.com</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-400/10 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Office</h4>
                    <p className="text-gray-400">123 Business Park, Tower A</p>
                    <p className="text-gray-400">Hyderabad, Telangana 500081</p>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h4 className="text-white font-semibold mb-4">Follow Us</h4>
                <div className="flex space-x-3">
                  <a href="#" className="social-icon" aria-label="Facebook">
                    <Facebook className="w-5 h-5" />
                  </a>
                  <a href="#" className="social-icon" aria-label="Instagram">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="#" className="social-icon" aria-label="LinkedIn">
                    <Linkedin className="w-5 h-5" />
                  </a>
                  <a href="#" className="social-icon" aria-label="YouTube">
                    <Youtube className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-gradient-to-br from-charcoal-800/80 to-charcoal-900/80 backdrop-blur-xl rounded-2xl border border-gold-500/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6">Send us a Message</h3>
              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Your Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      required
                      className="input-field"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      className="input-field"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                    className="input-field"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Subject</label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleFormChange}
                    required
                    className="select-field"
                  >
                    <option value="">Select a subject</option>
                    <option value="investment">Investment Inquiry</option>
                    <option value="property">Property Management</option>
                    <option value="construction">Construction Services</option>
                    <option value="sales">Property Sales</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleFormChange}
                    required
                    rows={4}
                    className="input-field resize-none"
                    placeholder="Tell us about your project or inquiry..."
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full flex items-center justify-center space-x-2 group"
                >
                  <span>Send Message</span>
                  <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-gold-500/20 bg-[#0A0A0A]">
        {/* Gold line accent */}
        <div className="gold-line"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Company Info */}
            <div className="lg:col-span-1">
              <Link to="/" className="flex items-center space-x-3 mb-6">
                <img src={Logo} alt="XLAND INFRA" className="h-12 w-auto" />
                <div>
                  <span className="text-xl font-bold text-white">
                    XLAND<span className="text-gold-400">INFRA</span>
                  </span>
                  <p className="text-xs text-gray-500">PVT LTD</p>
                </div>
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Building dreams into reality. Your trusted partner for quality construction and infrastructure development.
              </p>
              <div className="flex space-x-3">
                <a href="#" className="social-icon" aria-label="Facebook">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="social-icon" aria-label="Instagram">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="social-icon" aria-label="LinkedIn">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="social-icon" aria-label="YouTube">
                  <Youtube className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-6 flex items-center space-x-2">
                <span>Quick Links</span>
                <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent ml-3"></div>
              </h4>
              <ul className="space-y-3">
                {['Home', 'About Us', 'Services', 'Projects', 'Contact'].map((link) => (
                  <li key={link}>
                    <button
                      onClick={() => scrollToSection(link.toLowerCase().replace(' ', '-'))}
                      className="text-gray-400 hover:text-gold-400 text-sm transition-colors gold-underline"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-white font-semibold mb-6 flex items-center space-x-2">
                <span>Services</span>
                <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent ml-3"></div>
              </h4>
              <ul className="space-y-3">
                {['Investment Consultation', 'Design & Planning', 'Construction', 'Brokerage Services', 'Property Management'].map((service) => (
                  <li key={service}>
                    <a href="#" className="text-gray-400 hover:text-gold-400 text-sm transition-colors gold-underline">
                      {service}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold mb-6 flex items-center space-x-2">
                <span>Contact</span>
                <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent ml-3"></div>
              </h4>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <Phone className="w-4 h-4 text-gold-400 mt-1 flex-shrink-0" />
                  <div className="text-gray-400 text-sm">
                    <p>+91 98765 43210</p>
                    <p>+91 40 1234 5678</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <Mail className="w-4 h-4 text-gold-400 mt-1 flex-shrink-0" />
                  <div className="text-gray-400 text-sm">
                    <p>info@xlandinfra.com</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-gold-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-400 text-sm">
                    123 Business Park, Tower A<br />
                    Hyderabad, Telangana 500081
                  </p>
                </li>
              </ul>
            </div>
          </div>

          {/* Gold separator */}
          <div className="gold-line mb-8"></div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-sm">
              <a href="#" className="text-gray-500 hover:text-gold-400 transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-500 hover:text-gold-400 transition-colors">Terms of Service</a>
              <a href="#" className="text-gray-500 hover:text-gold-400 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default CorporateLanding;
