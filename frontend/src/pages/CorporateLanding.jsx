import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  TrendingUp, 
  Compass, 
  HardHat,
  Settings,
  Scale,
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
import BrandLogo from '../components/BrandLogo';
import SEO from '../components/SEO';

// Services Data - Property Management → Property Sales → Investment → Design → Construction
const services = [
  {
    id: 'property-management',
    title: 'Property Management',
    subtitle: 'Management',
    description: 'Complete facility management solutions including residential & commercial maintenance, AMC services, operations management, and end-to-end property care.',
    icon: Settings,
    features: ['Facility Management', 'AMC Services', 'Vendor Coordination'],
    link: '/services/property-management'
  },
  {
    id: 'property-sales',
    title: 'Property Sales & Advisory',
    subtitle: 'Sales & Advisory',
    description: 'Complete property sales solutions with verified listings, professional marketing, buyer matching, legal verification, and end-to-end transaction support.',
    icon: Scale,
    features: ['Verified Listings', 'Buyer Matching', 'Legal Support'],
    link: '/services/property-sales-advisory'
  },
  {
    id: 'investment',
    title: 'Investment Consultation',
    subtitle: 'Advisory',
    description: 'Offer strategic real estate investment guidance with market insights, ROI-focused planning, portfolio analysis, and growth opportunities.',
    icon: TrendingUp,
    features: ['Portfolio Analysis', 'Market Research', 'ROI Planning'],
    link: '/services/investment-consultation'
  },
  {
    id: 'design',
    title: 'Design & Conceptualization',
    subtitle: 'Planning',
    description: 'Create innovative architectural concepts and space planning solutions that combine luxury aesthetics with modern functionality.',
    icon: Compass,
    features: ['3D Visualization', 'Space Planning', 'Concept Development'],
    link: '/services/design-conceptualization'
  },
  {
    id: 'construction',
    title: 'Construction & Delivery',
    subtitle: 'Execution',
    description: 'Manage end-to-end construction execution with a focus on quality control, timely delivery, project management, and safety standards.',
    icon: HardHat,
    features: ['Project Management', 'Quality Control', 'Timely Delivery'],
    link: '/services/construction-delivery'
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

// Hero Rotating Services Data
const heroServices = [
  {
    id: 'property-management',
    title: 'Property Management',
    subtitle: 'Complete facility management solutions including maintenance, AMC services, vendor coordination, and end-to-end property care.',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80',
    icon: Settings
  },
  {
    id: 'property-sales',
    title: 'Property Sales & Advisory',
    subtitle: 'Verified property listings, strategic marketing, buyer matching, and end-to-end sales execution under one trusted platform.',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80',
    icon: Scale
  },
  {
    id: 'investment',
    title: 'Investment Consultation',
    subtitle: 'Strategic real estate investment guidance with market insights, ROI planning, and portfolio growth solutions.',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80',
    icon: TrendingUp
  },
  {
    id: 'design',
    title: 'Design & Conceptualization',
    subtitle: 'Innovative architectural concepts and modern space planning that blend luxury with functionality.',
    image: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1920&q=80',
    icon: Compass
  },
  {
    id: 'construction',
    title: 'Construction & Delivery',
    subtitle: 'End-to-end construction execution with quality control, project management, and timely delivery.',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1920&q=80',
    icon: HardHat
  }
];


function CorporateLanding() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [heroPhase, setHeroPhase] = useState('intro'); // 'intro' or 'services'
  const [activeHeroService, setActiveHeroService] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Hero two-phase effect: Intro (3s) → Services rotation (3s each)
  useEffect(() => {
    // Phase 1: Show intro for 3 seconds, then transition to services
    const introTimeout = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setHeroPhase('services');
        setIsTransitioning(false);
      }, 800); // Cinematic fade duration
    }, 3000);

    return () => clearTimeout(introTimeout);
  }, []);

  // Phase 2: Rotate services every 3 seconds (only after intro phase)
  useEffect(() => {
    if (heroPhase !== 'services') return;

    const rotationInterval = setInterval(() => {
      setActiveHeroService((prev) => (prev + 1) % heroServices.length);
    }, 4000);

    return () => clearInterval(rotationInterval);
  }, [heroPhase]);

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      
      // Update active section based on scroll position
      const sections = ['home', 'about', 'services', 'contact'];
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
    const { name, value } = e.target;
    
    // For phone field, only allow digits and limit to 10
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setFormData({ ...formData, [name]: digitsOnly });
      return;
    }
    
    setFormData({ ...formData, [name]: value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: `Subject: ${formData.subject}\n\n${formData.message}`
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setFormSuccess(true);
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
        setTimeout(() => setFormSuccess(false), 5000);
      } else {
        alert('Error submitting form. Please try again.');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('Error submitting form. Please try again or contact us directly.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const servicePages = [
    { label: 'Property Management', path: '/services/property-management' },
    { label: 'Property Sales & Advisory', path: '/services/property-sales-advisory' },
    { label: 'Investment Consultation', path: '/services/investment-consultation' },
    { label: 'Design & Conceptualization', path: '/services/design-conceptualization' },
    { label: 'Construction & Delivery', path: '/services/construction-delivery' },
  ];

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services', hasDropdown: true },
    // { id: 'projects', label: 'Projects' }, // Hidden for now
    { id: 'contact', label: 'Contact Us' }
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <SEO 
        title="Premium Real Estate Development & Infrastructure Services"
        description="XLAND INFRA - Leading real estate development company in India. Expert Investment Consultation, Design & Conceptualization, Construction & Delivery services. 15+ years, 500+ projects, ₹5000Cr+ assets managed."
        keywords="XLAND INFRA, real estate development, infrastructure, property investment, construction, design, Mangalagiri, Guntur, Andhra Pradesh"
        canonical="https://xlandinfra.com/"
      />
      {/* ============ PREMIUM NAVIGATION ============ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        isScrolled 
          ? 'bg-[#0D0D0D]/95 backdrop-blur-2xl shadow-2xl shadow-black/80 border-b border-gold-500/20' 
          : 'bg-gradient-to-b from-black/60 to-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            {/* Logo */}
            <Link to="/" className="group">
              <div className="relative">
                <div className="absolute inset-0 bg-gold-400/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative transition-transform duration-500 group-hover:scale-105">
                  <BrandLogo size="default" className="hidden sm:flex" />
                  <BrandLogo size="sm" showText={false} className="sm:hidden" />
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              {navLinks.map((link) => (
                <div key={link.id} className="relative">
                  {link.hasDropdown ? (
                    /* Services with Dropdown */
                    <div 
                      className="relative z-[60]"
                      onMouseEnter={() => setServicesDropdownOpen(true)}
                      onMouseLeave={() => setServicesDropdownOpen(false)}
                    >
                      <button
                        onClick={() => scrollToSection(link.id)}
                        className={`relative px-5 py-2.5 text-lg font-medium tracking-wide transition-all duration-300 group flex items-center gap-1.5 ${
                          activeSection === link.id
                            ? 'text-gold-400'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {link.label}
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
                        <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-300 ${
                          activeSection === link.id ? 'w-8' : 'w-0 group-hover:w-6'
                        }`}></span>
                      </button>
                      
                      {/* Dropdown Menu */}
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 transition-all duration-300 z-[100] ${
                        servicesDropdownOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                      }`}>
                        <div className="w-64 bg-[#0D0D0D] border border-gold-500/20 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">
                          {/* Dropdown Arrow */}
                          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0D0D0D] border-l border-t border-gold-500/20 rotate-45"></div>
                          
                          <div className="py-2">
                            {servicePages.map((service, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (service.path) {
                                    navigate(service.path);
                                    window.scrollTo(0, 0);
                                  } else if (service.scrollTo) {
                                    scrollToSection(service.scrollTo);
                                  }
                                  setServicesDropdownOpen(false);
                                }}
                                className="w-full px-5 py-3 text-left text-sm text-gray-400 hover:text-gold-400 hover:bg-gold-500/5 transition-all duration-200 flex items-center gap-3 group"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-gold-400/40 group-hover:bg-gold-400 group-hover:shadow-[0_0_8px_rgba(216,178,92,0.5)] transition-all"></div>
                                <span className="font-medium">{service.label}</span>
                              </button>
                            ))}
                          </div>
                          
                          {/* View All Services */}
                          <div className="border-t border-gold-500/10 px-5 py-3">
                            <button
                              onClick={() => {
                                scrollToSection('services');
                                setServicesDropdownOpen(false);
                              }}
                              className="text-xs text-gold-400/70 hover:text-gold-400 font-medium tracking-wider uppercase transition-colors flex items-center gap-1.5"
                            >
                              View All Services
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Regular Nav Link */
                    <button
                      onClick={() => scrollToSection(link.id)}
                      className={`relative px-5 py-2.5 text-lg font-medium tracking-wide transition-all duration-300 group ${
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
                  )}
                </div>
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
                <span className="relative font-semibold text-[#0D0D0D] text-sm tracking-wide">HomeHub Login</span>
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
          mobileMenuOpen ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-[#0D0D0D]/98 backdrop-blur-2xl border-t border-gold-500/10 px-6 py-8 space-y-2">
            {navLinks.map((link, index) => (
              <div key={link.id}>
                {link.hasDropdown ? (
                  /* Services with expandable menu */
                  <div>
                    <button
                      onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                      className={`flex items-center justify-between w-full text-left px-5 py-4 rounded-xl text-base font-medium transition-all duration-300 ${
                        activeSection === link.id
                          ? 'text-gold-400 bg-gold-400/10 border-l-2 border-gold-400'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {link.label}
                      <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Service Sub-pages */}
                    <div className={`overflow-hidden transition-all duration-300 ${servicesDropdownOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="pl-6 py-2 space-y-1">
                        {servicePages.map((service, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              if (service.path) {
                                navigate(service.path);
                              } else if (service.scrollTo) {
                                scrollToSection(service.scrollTo);
                              }
                              setMobileMenuOpen(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-gray-500 hover:text-gold-400 transition-colors rounded-lg"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-gold-400/50"></div>
                            {service.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
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
                )}
              </div>
            ))}
            <div className="pt-6 mt-4 border-t border-white/10">
              <button
                onClick={() => navigate('/login')}
                className="block w-full py-4 bg-gradient-to-r from-gold-400 to-gold-600 text-[#0D0D0D] font-semibold rounded-xl text-center"
              >
                HomeHub Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ============ HERO SECTION - TWO PHASE CINEMATIC ============ */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
        {/* ===== BACKGROUND IMAGES LAYER (z-0) ===== */}
        <div className="absolute inset-0 z-0">
          {/* Intro Phase Background */}
          <div 
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              heroPhase === 'intro' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: "url('https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1920&q=80')",
                animation: 'slowZoom 20s ease-out infinite alternate'
              }}
            ></div>
          </div>

          {/* Services Phase - Rotating Backgrounds */}
          {heroServices.map((service, index) => (
            <div
              key={service.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                heroPhase === 'services' && index === activeHeroService
                  ? 'opacity-100' 
                  : 'opacity-0'
              }`}
            >
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ 
                  backgroundImage: `url('${service.image}')`,
                  transform: heroPhase === 'services' && index === activeHeroService ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 8s ease-out'
                }}
              ></div>
            </div>
          ))}
        </div>

        {/* ===== DARK OVERLAY LAYER (z-[1]) - Always on top of all backgrounds ===== */}
        <div className="absolute inset-0 z-[1]">
          {/* Primary left-side dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent"></div>
          {/* Strong left reinforcement for text area */}
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/80 to-transparent"></div>
          {/* Overall darkening */}
          <div className="absolute inset-0 bg-[#0a0a0a]/30"></div>
          {/* Top and bottom framing */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-transparent to-[#0a0a0a]"></div>
        </div>

        {/* ===== GOLD ACCENT LAYER (z-[2]) ===== */}
        <div className="absolute inset-0 z-[2] overflow-hidden pointer-events-none">
          {/* Top-left gold glow */}
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-gradient-to-br from-gold-500/15 via-gold-600/8 to-transparent rounded-full blur-[100px]"></div>
          {/* Bottom-right subtle glow */}
          <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-gradient-to-tl from-gold-500/10 via-gold-400/5 to-transparent rounded-full blur-[80px]"></div>
          {/* Center-left accent */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[300px] h-[400px] bg-gradient-to-r from-gold-500/10 to-transparent rounded-full blur-[60px]"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pt-32 pb-20">
          <div className="max-w-3xl">
            
            {/* ===== PHASE 1: INTRO CONTENT ===== */}
            <div className={`transition-all duration-700 ease-out ${
              heroPhase === 'intro'
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 -translate-y-4 pointer-events-none absolute'
            }`}>
              {/* Eyebrow Text */}
              <div className="flex items-center gap-3 mb-6 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.2s_forwards]">
                <div className="h-px w-10 bg-gradient-to-r from-gold-400/80 to-transparent"></div>
                <span className="text-gold-400/90 text-sm font-medium tracking-[0.15em] uppercase">Real Estate & Infrastructure</span>
              </div>

              {/* Main Title */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-8 leading-[1.05] tracking-tight">
                <span className="inline-block text-white opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.3s_forwards]">Building</span>
                <br />
                <span className="inline-block opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.5s_forwards]">
                  <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(216,178,92,0.3)]">Dreams Into</span>
                </span>
                <br />
                <span className="inline-block text-white opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.7s_forwards]">Reality</span>
              </h1>

              {/* Intro Subheading */}
              <p className="text-lg md:text-xl text-gray-400 mb-10 leading-relaxed max-w-xl opacity-0 animate-[fadeSlideIn_0.8s_ease-out_0.9s_forwards]">
                Premier real estate development and property services across India.
              </p>

              {/* CTA Buttons - Intro Phase */}
              <div className="flex flex-wrap gap-4 opacity-0 animate-[fadeSlideIn_0.8s_ease-out_1.1s_forwards]">
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
                  onClick={() => scrollToSection('contact')}
                  className="group px-8 py-4 rounded-full border border-white/20 hover:border-gold-400/50 hover:bg-white/5 transition-all duration-500"
                >
                  <span className="flex items-center gap-2 font-semibold text-white group-hover:text-gold-400">
                    <Phone className="w-4 h-4" />
                    Contact Us
                  </span>
                </button>
              </div>
            </div>

            {/* ===== PHASE 2: ROTATING SERVICES CONTENT ===== */}
            <div className={`transition-all duration-700 ease-out ${
              heroPhase === 'services'
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8 pointer-events-none absolute'
            }`}>
              {/* Active Service Icon */}
              <div className="w-14 h-14 mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(216,178,92,0.2)]">
                {heroServices[activeHeroService] && (() => {
                  const Icon = heroServices[activeHeroService].icon;
                  return <Icon className="w-7 h-7 text-gold-400" />;
                })()}
              </div>

              {/* All Service Titles - Stacked with Faded Effect */}
              <div className="space-y-3 mb-8">
                {heroServices.map((service, index) => {
                  const isActive = index === activeHeroService;
                  return (
                    <div
                      key={service.id}
                      className={`transition-all duration-500 ease-out cursor-pointer ${
                        isActive 
                          ? 'opacity-100 scale-100' 
                          : 'opacity-30 scale-95 hover:opacity-50'
                      }`}
                      onClick={() => setActiveHeroService(index)}
                    >
                      <h2 className={`font-display font-bold leading-[1.1] transition-all duration-500 ${
                        isActive 
                          ? 'text-3xl md:text-4xl lg:text-5xl text-white' 
                          : 'text-xl md:text-2xl lg:text-3xl text-gray-500'
                      }`}>
                        {service.title}
                      </h2>
                    </div>
                  );
                })}
              </div>

              {/* Active Service Description */}
              <div className="transition-all duration-500 ease-out">
                <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl">
                  {heroServices[activeHeroService]?.subtitle}
                </p>
              </div>

              {/* CTA Buttons - Services Phase */}
              <div className="flex flex-wrap gap-4 mt-8">
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
                  onClick={() => scrollToSection('contact')}
                  className="group px-8 py-4 rounded-full border border-white/20 hover:border-gold-400/50 hover:bg-white/5 transition-all duration-500"
                >
                  <span className="flex items-center gap-2 font-semibold text-white group-hover:text-gold-400">
                    <Phone className="w-4 h-4" />
                    Contact Us
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Service Progress Indicators - Center Bottom */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 transition-all duration-700 ${
          heroPhase === 'services' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <div className="flex items-center gap-3">
            {heroServices.map((service, index) => (
              <button
                key={service.id}
                onClick={() => {
                  if (heroPhase === 'services') {
                    setActiveHeroService(index);
                  }
                }}
                className="group relative h-2 rounded-full overflow-hidden transition-all duration-500"
                style={{ width: index === activeHeroService ? '48px' : '12px' }}
                aria-label={service.title}
              >
                <div className={`absolute inset-0 transition-all duration-500 ${
                  index === activeHeroService 
                    ? 'bg-gradient-to-r from-gold-400 to-gold-600 shadow-[0_0_15px_rgba(216,178,92,0.6)]' 
                    : 'bg-white/30 group-hover:bg-white/50'
                }`}></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ABOUT SECTION ============ */}
      <section id="about" className="py-16 md:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <span className="text-gold-400 text-sm font-semibold tracking-wider uppercase mb-3 block">About Us</span>
            <h2 className="section-title mb-5 tracking-tight">
              Redefining <span className="text-gold-gradient">Real Estate</span> Excellence
            </h2>
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
                From strategic investment consultation to premium property sales & advisory, we offer a complete ecosystem of services designed to maximize your real estate potential.
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
              {/* Badge overlay removed for cleaner design */}
            </div>
          </div>
        </div>
      </section>

      {/* ============ PREMIUM SERVICES SECTION - CONNECTED FLOW LAYOUT ============ */}
      <section id="services" className="pt-28 pb-16 md:pt-32 md:pb-20 relative bg-[#0D0D0D] overflow-hidden">
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
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 mb-5">
              <div className="h-px w-10 bg-gradient-to-r from-transparent to-gold-400"></div>
              <span className="text-gold-400 text-sm font-medium tracking-wider uppercase">Our Services</span>
              <div className="h-px w-10 bg-gradient-to-l from-transparent to-gold-400"></div>
            </div>
            <h2 className="section-title mb-5 tracking-tight">
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
                    <div 
                      className={`group relative w-full ${isEven ? 'mt-20' : 'mt-12'}`}
                      onClick={() => service.link && navigate(service.link)}
                    >
                      <div className={`service-card-premium ${service.link ? 'cursor-pointer' : ''}`}>
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

                        {/* Learn More Link */}
                        {service.link && (
                          <div className="mt-4 pt-3 border-t border-gold-500/10">
                            <span className="text-gold-400/70 text-xs font-medium group-hover:text-gold-400 transition-colors flex items-center gap-1">
                              Learn More <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        )}
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
                  onClick={() => service.link && navigate(service.link)}
                >
                  <div className={`service-card-premium ${service.link ? 'cursor-pointer' : ''}`}>
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

                        {/* Features - Clean list style */}
                        <div className="space-y-1.5 mb-3">
                          {service.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <Circle className="w-1.5 h-1.5 fill-gold-500 text-gold-500" />
                              <span className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {/* Learn More Link */}
                        {service.link && (
                          <span className="text-gold-400/70 text-xs font-medium group-hover:text-gold-400 transition-colors flex items-center gap-1">
                            Learn More <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
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

        </div>
      </section>

      {/* ============ PROJECTS SECTION - HIDDEN FOR NOW ============ */}
      {/* 
      <section id="projects" className="py-16 md:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-gold-400 text-sm font-semibold tracking-wider uppercase mb-3 block">Our Portfolio</span>
            <h2 className="section-title mb-5 tracking-tight">
              Featured <span className="text-gold-gradient">Projects</span>
            </h2>
            <p className="section-subtitle mx-auto">
              Showcasing our landmark developments that have transformed skylines and created lasting value.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project, index) => (
              <div
                key={project.id}
                className="group relative rounded-2xl overflow-hidden premium-card cursor-pointer"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900 via-charcoal-900/60 to-transparent"></div>
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
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-charcoal-900/80 backdrop-blur-sm text-white text-xs font-medium rounded-full border border-white/10">
                    {project.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <button className="btn-outline inline-flex items-center space-x-2 group">
              <span>View All Projects</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
      */}

      {/* ============ INVESTMENT OPPORTUNITIES SECTION ============ */}
      <section className="py-16 md:py-20 relative bg-gradient-to-br from-charcoal-800 via-charcoal-900 to-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-gold-400 text-sm font-semibold tracking-wider uppercase mb-3 block">Investment Opportunities</span>
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

      {/* ============ CUSTOMER LOGIN CTA SECTION ============ */}
      <section className="py-14 md:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gold-600/20 via-gold-500/10 to-gold-600/20"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Already a Customer?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Access your personalized dashboard to manage properties, track work orders, view payments, and more.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-premium inline-flex items-center space-x-2"
          >
            <span>HomeHub Login</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ============ CONTACT SECTION ============ */}
      <section id="contact" className="py-16 md:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <span className="text-gold-400 text-sm font-semibold tracking-wider uppercase mb-3 block">Contact Us</span>
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
                    <p className="text-gray-400">+91 8500 101 111</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-400/10 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Email</h4>
                    <a href="mailto:info@xlandinfra.com" className="text-gray-400 hover:text-gold-400 transition-colors">info@xlandinfra.com</a>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-400/10 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Office</h4>
                    <p className="text-gray-400">D.No. 7-333/A/1, Nri Hospital Road</p>
                    <p className="text-gray-400">Mangalagiri, Guntur, 522503</p>
                  </div>
                </div>
              </div>

              {/* Social Links - Hidden from UI, code preserved */}
              <div className="hidden">
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
                    <label className="block text-gray-400 text-sm mb-2">Your Name <span className="text-red-400">*</span></label>
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
                    <label className="block text-gray-400 text-sm mb-2">Phone Number <span className="text-red-400">*</span></label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleFormChange}
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      minLength={10}
                      title="Please enter exactly 10 digits"
                      className="input-field"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Email Address <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                    pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                    title="Please enter a valid email address"
                    className="input-field"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Subject <span className="text-red-400">*</span></label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleFormChange}
                    required
                    className="select-field"
                  >
                    <option value="">Select a subject</option>
                    <option value="property-management">Property Management</option>
                    <option value="property-sales">Property Sales & Advisory</option>
                    <option value="investment">Investment Consultation</option>
                    <option value="design">Design & Conceptualization</option>
                    <option value="construction">Construction & Delivery</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Message <span className="text-red-400">*</span></label>
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
                {formSuccess ? (
                  <div className="w-full py-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-center font-medium">
                    ✓ Thank you! We'll get back to you shortly.
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="btn-primary w-full flex items-center justify-center space-x-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{formSubmitting ? 'Sending...' : 'Send Message'}</span>
                    {!formSubmitting && <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </button>
                )}
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
              <Link to="/" className="inline-block mb-6">
                <BrandLogo size="sm" />
              </Link>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Building dreams into reality. Your trusted partner for quality construction and infrastructure development.
              </p>
              {/* Social icons hidden from UI, code preserved */}
              <div className="hidden flex space-x-3">
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
                {['Home', 'About Us', 'Services', 'Contact'].map((link) => (
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
                {['Property Management', 'Property Sales & Advisory', 'Investment Consultation', 'Design & Conceptualization', 'Construction & Delivery'].map((service) => (
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
                    <p>+91 8500 101 111</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <Mail className="w-4 h-4 text-gold-400 mt-1 flex-shrink-0" />
                  <div className="text-sm">
                    <a href="mailto:info@xlandinfra.com" className="text-gray-400 hover:text-gold-400 transition-colors">info@xlandinfra.com</a>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <MapPin className="w-4 h-4 text-gold-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-400 text-sm">
                    D.No. 7-333/A/1, Nri Hospital Road<br />
                    Mangalagiri, Guntur, 522503
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
              <Link to="/privacy-policy" className="text-gray-500 hover:text-gold-400 transition-colors">Privacy Policy</Link>
              <Link to="/terms-of-service" className="text-gray-500 hover:text-gold-400 transition-colors">Terms of Service</Link>
              <Link to="/cookie-policy" className="text-gray-500 hover:text-gold-400 transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default CorporateLanding;
