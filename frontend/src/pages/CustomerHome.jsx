import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CreditCard, 
  ClipboardList, 
  Calendar, 
  Phone, 
  LogIn, 
  Settings, 
  LogOut, 
  Home, 
  Wallet,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Megaphone,
  Star,
  AlertCircle,
  Gift,
  ArrowRight,
  Sparkles,
  PartyPopper,
  Users,
  Building2,
  Mail,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube
} from 'lucide-react';
import Logo from '../assets/LOGO 2.png';
import HeroVideo from '../assets/Sample_Video.mp4';

const navigationModules = [
  { id: 'payments', label: 'Payments', icon: CreditCard, path: '/dashboard/payment' },
  { id: 'workorders', label: 'Work Orders', icon: ClipboardList, path: '/dashboard/work-order' },
  { id: 'schedules', label: 'Schedules', icon: Calendar, path: '/dashboard/schedule' },
  { id: 'contact', label: 'Contact', icon: Phone, path: '/dashboard/contact' },
];

const quickAccessModules = [
  { 
    id: 'payments', 
    label: 'Payments', 
    description: 'View and manage your payment history',
    icon: CreditCard, 
    path: '/dashboard/payment',
    color: 'from-emerald-500/20 to-emerald-600/20',
    borderColor: 'border-emerald-500/30',
    iconColor: 'text-emerald-400'
  },
  { 
    id: 'workorders', 
    label: 'Work Orders', 
    description: 'Submit and track maintenance requests',
    icon: ClipboardList, 
    path: '/dashboard/work-order',
    color: 'from-blue-500/20 to-blue-600/20',
    borderColor: 'border-blue-500/30',
    iconColor: 'text-blue-400'
  },
  { 
    id: 'schedules', 
    label: 'Schedules', 
    description: 'View upcoming appointments and events',
    icon: Calendar, 
    path: '/dashboard/schedule',
    color: 'from-purple-500/20 to-purple-600/20',
    borderColor: 'border-purple-500/30',
    iconColor: 'text-purple-400'
  },
];

const announcementsData = [
  {
    id: 1,
    type: 'event',
    title: 'Community Meet & Greet',
    description: 'Join us for our annual community gathering. Meet your neighbors, enjoy refreshments, and participate in fun activities for all ages!',
    date: 'May 5, 2026',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    icon: Users
  },
  {
    id: 2,
    type: 'announcement',
    title: 'New Amenity Opening',
    description: 'We are excited to announce the grand opening of our new fitness center with state-of-the-art equipment and facilities.',
    date: 'Apr 28, 2026',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    icon: Building2
  },
  {
    id: 3,
    type: 'promotion',
    title: 'Early Payment Rewards',
    description: 'Pay your dues before the 15th of each month and earn reward points redeemable for exclusive discounts and offers!',
    date: 'Ongoing',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
    icon: Gift
  },
  {
    id: 4,
    type: 'event',
    title: 'Summer Festival 2026',
    description: 'Get ready for the biggest celebration of the year! Live music, food stalls, games, and fireworks await you.',
    date: 'Jun 21, 2026',
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
    icon: PartyPopper
  },
  {
    id: 5,
    type: 'announcement',
    title: 'Portal Upgrade Complete',
    description: 'Our customer portal has been upgraded with new features including real-time work order tracking and enhanced payment options.',
    date: 'Apr 15, 2026',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    icon: Sparkles
  },
];

function CustomerHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const sliderRef = useRef(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('portalUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Auto-slide for announcements
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % announcementsData.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % announcementsData.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + announcementsData.length) % announcementsData.length);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('portalUser');
    setShowAccountMenu(false);
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleNavigation = (path) => {
    if (user) {
      navigate(path);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0D0D0D' }}>
      {/* ============ HERO VIDEO BANNER ============ */}
      <section className="relative h-[70vh] md:h-[80vh] overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={HeroVideo} type="video/mp4" />
        </video>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-950/70 via-dark-900/50 to-dark-950/90"></div>
        
        {/* Hero Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          {/* Logo */}
          <img src={Logo} alt="XlandInfra" className="h-20 md:h-28 w-auto mb-6 drop-shadow-2xl" />
          
          {/* Main Heading - Styled to POP */}
          <h1 className="relative">
            <span className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight">
              <span className="text-white">X</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 via-gold-300 to-gold-500">Land</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-500 via-amber-400 to-gold-600">Infra</span>
            </span>
            {/* Subtle Glow Effect */}
            <span className="absolute inset-0 text-5xl md:text-7xl lg:text-8xl font-black tracking-tight blur-xl opacity-20">
              <span className="text-gold-400">XLandInfra</span>
            </span>
          </h1>
          
          {/* Tagline */}
          <p className="mt-6 text-lg md:text-xl text-dark-200 max-w-2xl font-light tracking-wide">
            Building <span className="text-gold-400 font-medium">Dreams</span> Into Reality
          </p>
          
          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-dark-900 transition-all duration-300 shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40 hover:scale-105"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-dark-900 transition-all duration-300 shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40 hover:scale-105"
                >
                  Login to Portal
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="px-8 py-3 rounded-xl font-semibold border-2 border-gold-500/50 text-gold-400 hover:bg-gold-500/10 hover:border-gold-400 transition-all duration-300"
                >
                  Register Now
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gold-500/50 rounded-full flex justify-center">
            <div className="w-1.5 h-3 bg-gold-400 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* ============ TOP NAVIGATION SECTION ============ */}
      <header className="relative z-50 bg-dark-900/95 backdrop-blur-md border-b border-gold-600/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img src={Logo} alt="XlandInfra" className="h-10 md:h-12 w-auto" />
              <div className="hidden sm:block">
                <span className="text-lg md:text-xl font-bold text-white">
                  Xland<span className="text-gold-400">Infra</span>
                </span>
                <p className="text-xs text-dark-400">Customer Portal</p>
              </div>
            </div>

            {/* Main Navigation Modules */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigationModules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.id}
                    onClick={() => handleNavigation(module.path)}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-dark-200 hover:text-gold-400 hover:bg-dark-800/60 transition-all duration-200 group"
                  >
                    <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-medium">{module.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Login / Account Section (Top Right) */}
            <div className="relative">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-dark-800/60 border border-gold-600/20 hover:border-gold-500/40 transition-all duration-200"
                  >
                    <div className="w-8 h-8 bg-gold-600/20 border border-gold-500/30 rounded-full flex items-center justify-center">
                      <span className="text-gold-400 font-semibold text-sm">
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-white">{user.firstName}</p>
                      <p className="text-xs text-dark-400">Account</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${showAccountMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Account Dropdown Menu */}
                  {showAccountMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-dark-800 border border-gold-600/20 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="p-4 border-b border-dark-700">
                        <p className="text-white font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-dark-400">{user.email}</p>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => { handleNavigation('/dashboard/payment'); setShowAccountMenu(false); }}
                          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-dark-200 hover:text-gold-400 hover:bg-dark-700/50 transition-all"
                        >
                          <Wallet className="w-5 h-5" />
                          <span>Manage Payments</span>
                        </button>
                        <button
                          onClick={() => { handleNavigation('/dashboard'); setShowAccountMenu(false); }}
                          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-dark-200 hover:text-gold-400 hover:bg-dark-700/50 transition-all"
                        >
                          <Settings className="w-5 h-5" />
                          <span>Settings</span>
                        </button>
                        <div className="border-t border-dark-700 mt-2 pt-2">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <LogOut className="w-5 h-5" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden pb-4">
            <div className="flex justify-around">
              {navigationModules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.id}
                    onClick={() => handleNavigation(module.path)}
                    className="flex flex-col items-center space-y-1 px-3 py-2 rounded-lg text-dark-300 hover:text-gold-400 transition-all"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{module.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ============ HORIZONTAL DIVIDER ============ */}
      <div className="relative z-10">
        <div className="h-px bg-gradient-to-r from-transparent via-gold-600/40 to-transparent"></div>
      </div>

      {/* ============ MAIN CONTENT SECTION ============ */}
      <main className="relative z-10 flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          
          {/* ============ ANNOUNCEMENTS & EVENTS SLIDER ============ */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gold-500/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
                  <Megaphone className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">Announcements & Events</h2>
                  <p className="text-sm text-dark-400">Stay updated with the latest news and upcoming events</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2 text-stone-400 text-sm">
                <span>{currentSlide + 1} / {announcementsData.length}</span>
              </div>
            </div>

            {/* Slider Container */}
            <div className="relative overflow-hidden rounded-2xl group/slider">
              {/* Left Arrow - Modern Style */}
              <button 
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 hover:border-gold-500/50 rounded-full flex items-center justify-center text-white hover:text-gold-400 transition-all duration-300 opacity-0 group-hover/slider:opacity-100"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              {/* Right Arrow - Modern Style */}
              <button 
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 hover:border-gold-500/50 rounded-full flex items-center justify-center text-white hover:text-gold-400 transition-all duration-300 opacity-0 group-hover/slider:opacity-100"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              
              <div 
                ref={sliderRef}
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {announcementsData.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.id} className="w-full flex-shrink-0">
                      <div className="relative h-[400px] md:h-[450px] rounded-2xl overflow-hidden group">
                        {/* Background Image */}
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-dark-950/80 via-transparent to-transparent"></div>
                        
                        {/* Content */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                          <div className="max-w-2xl">
                            {/* Type Badge */}
                            <div className="flex items-center space-x-3 mb-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                item.type === 'event' 
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                  : item.type === 'promotion'
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                  : 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                              }`}>
                                {item.type}
                              </span>
                              <span className="text-dark-400 text-sm">{item.date}</span>
                            </div>
                            
                            {/* Title */}
                            <h3 className="text-2xl md:text-4xl font-bold text-white mb-3 leading-tight">
                              {item.title}
                            </h3>
                            
                            {/* Description */}
                            <p className="text-dark-300 text-base md:text-lg leading-relaxed mb-6 line-clamp-2">
                              {item.description}
                            </p>
                            
                            {/* Action Button */}
                            <button className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gold-500/20 border border-gold-500/30 text-gold-400 hover:bg-gold-500/30 hover:border-gold-400/50 transition-all duration-300">
                              <span className="font-medium">Learn More</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Icon Decoration */}
                        <div className="absolute top-6 right-6 w-14 h-14 bg-dark-900/60 backdrop-blur-sm border border-gold-500/20 rounded-xl flex items-center justify-center">
                          <ItemIcon className="w-7 h-7 text-gold-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Slide Indicators */}
              <div className="absolute bottom-6 right-6 flex items-center space-x-2">
                {announcementsData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentSlide === index 
                        ? 'w-8 bg-gold-400' 
                        : 'w-2 bg-dark-500 hover:bg-dark-400'
                    }`}
                  />
                ))}
              </div>
              
            </div>
          </section>

          {/* ============ HORIZONTAL DIVIDER ============ */}
          <div className="py-6">
            <div className="h-px bg-gradient-to-r from-transparent via-gold-600/30 to-transparent"></div>
          </div>

          {/* ============ QUICK ACCESS MODULES - Payments, Work Orders, Schedules ============ */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gold-500/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">Quick Access</h2>
                  <p className="text-sm text-dark-400">Access your most used features</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {quickAccessModules.map((module) => {
                const ModuleIcon = module.icon;
                return (
                  <button
                    key={module.id}
                    onClick={() => handleNavigation(module.path)}
                    className="group relative overflow-hidden bg-dark-800/60 backdrop-blur-sm border border-dark-700 hover:border-gold-500/40 rounded-2xl p-6 md:p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-gold-500/10"
                  >
                    {/* Background Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                    
                    {/* Content */}
                    <div className="relative z-10">
                      <div className={`w-14 h-14 bg-gradient-to-br ${module.color} ${module.borderColor} border rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                        <ModuleIcon className={`w-7 h-7 ${module.iconColor}`} />
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gold-400 transition-colors">
                        {module.label}
                      </h3>
                      
                      <p className="text-dark-400 text-sm leading-relaxed mb-4">
                        {module.description}
                      </p>
                      
                      <div className="flex items-center text-gold-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span>Access Now</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    
                    {/* Corner Decoration */}
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-tl from-gold-500/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="relative z-10 border-t" style={{ backgroundColor: '#0D0D0D', borderColor: 'rgba(216, 178, 92, 0.3)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <img src={Logo} alt="XlandInfra" className="h-12 w-auto" />
                <span className="text-2xl font-bold text-white">
                  Xland<span style={{ color: '#D8B25C' }}>Infra</span>
                </span>
              </div>
              <p className="text-stone-400 text-sm leading-relaxed mb-6 max-w-md">
                Building dreams into reality. Your trusted partner for quality construction 
                and infrastructure development across the region.
              </p>
              {/* Social Media Icons - Modern Style */}
              <div className="flex items-center space-x-3">
                <a href="#" className="group w-11 h-11 bg-stone-800/80 hover:bg-[#1877F2] border border-stone-700/50 hover:border-[#1877F2] rounded-xl flex items-center justify-center text-stone-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-[#1877F2]/20">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="group w-11 h-11 bg-stone-800/80 hover:bg-black border border-stone-700/50 hover:border-white/20 rounded-xl flex items-center justify-center text-stone-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="#" className="group w-11 h-11 bg-stone-800/80 hover:bg-gradient-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#F77737] border border-stone-700/50 hover:border-transparent rounded-xl flex items-center justify-center text-stone-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-[#E1306C]/20">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="group w-11 h-11 bg-stone-800/80 hover:bg-[#0A66C2] border border-stone-700/50 hover:border-[#0A66C2] rounded-xl flex items-center justify-center text-stone-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-[#0A66C2]/20">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="group w-11 h-11 bg-stone-800/80 hover:bg-[#FF0000] border border-stone-700/50 hover:border-[#FF0000] rounded-xl flex items-center justify-center text-stone-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-[#FF0000]/20">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li><button onClick={() => navigate('/')} className="text-stone-400 hover:text-[#D8B25C] text-sm transition-colors">Home</button></li>
                <li><button onClick={() => handleNavigation('/dashboard')} className="text-stone-400 hover:text-[#D8B25C] text-sm transition-colors">Dashboard</button></li>
                <li><button onClick={() => handleNavigation('/dashboard/work-order')} className="text-stone-400 hover:text-[#D8B25C] text-sm transition-colors">Work Orders</button></li>
                <li><button onClick={() => handleNavigation('/dashboard/payment')} className="text-stone-400 hover:text-[#D8B25C] text-sm transition-colors">Payments</button></li>
                <li><button onClick={() => handleNavigation('/dashboard/contact')} className="text-stone-400 hover:text-[#D8B25C] text-sm transition-colors">Contact</button></li>
              </ul>
            </div>
            
            {/* Contact Info */}
            <div>
              <h4 className="text-white font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-center space-x-3 text-stone-400 text-sm">
                  <Phone className="w-4 h-4" style={{ color: '#D8B25C' }} />
                  <span>+91 98765 43210</span>
                </li>
                <li className="flex items-center space-x-3 text-stone-400 text-sm">
                  <Phone className="w-4 h-4" style={{ color: '#D8B25C' }} />
                  <span>+91 40 1234 5678</span>
                </li>
                <li className="flex items-center space-x-3 text-stone-400 text-sm">
                  <Mail className="w-4 h-4" style={{ color: '#D8B25C' }} />
                  <span>info@xlandinfra.com</span>
                </li>
                <li className="flex items-center space-x-3 text-stone-400 text-sm">
                  <Mail className="w-4 h-4" style={{ color: '#D8B25C' }} />
                  <span>support@xlandinfra.com</span>
                </li>
                <li className="flex items-start space-x-3 text-stone-400 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5" style={{ color: '#D8B25C' }} />
                  <span>123 Business Park, Tower A<br/>Hyderabad, Telangana 500081</span>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-stone-500 text-sm">
              © {new Date().getFullYear()} XlandInfra Pvt Ltd. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-sm">
              <a href="#" className="text-stone-500 hover:text-[#D8B25C] transition-colors">Privacy Policy</a>
              <a href="#" className="text-stone-500 hover:text-[#D8B25C] transition-colors">Terms of Service</a>
              <a href="#" className="text-stone-500 hover:text-[#D8B25C] transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Click outside to close dropdown */}
      {showAccountMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAccountMenu(false)}
        ></div>
      )}
    </div>
  );
}

export default CustomerHome;
