import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ArrowRight } from 'lucide-react';
import BrandLogo from './BrandLogo';

const MainHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);

  const servicePages = [
    { label: 'Property Management', path: '/services/property-management' },
    { label: 'Property Sales & Advisory', path: '/services/property-sales-advisory' },
    { label: 'Investment Consultation', path: '/services/investment-consultation' },
    { label: 'Design & Conceptualization', path: '/services/design-conceptualization' },
    { label: 'Construction & Delivery', path: '/services/construction-delivery' },
  ];

  const navLinks = [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'about', label: 'About Us', path: '/#about' },
    { id: 'services', label: 'Services', path: '/#services', hasDropdown: true },
    // { id: 'projects', label: 'Projects', path: '/#projects' }, // Hidden for now
    { id: 'contact', label: 'Contact Us', path: '/#contact' }
  ];

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (link) => {
    if (link.path.startsWith('/#')) {
      // If we're not on the home page, navigate there first
      if (location.pathname !== '/') {
        navigate(link.path);
      } else {
        // Scroll to section on same page
        const sectionId = link.path.replace('/#', '');
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } else {
      navigate(link.path);
    }
    setMobileMenuOpen(false);
  };

  const isServicePage = location.pathname.startsWith('/services/');

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[999] transition-all duration-500 ${
      isScrolled || isServicePage || servicesDropdownOpen
        ? 'bg-[#0D0D0D] shadow-2xl shadow-black/80 border-b border-gold-500/20' 
        : 'bg-[#0D0D0D]/95 backdrop-blur-xl'
    }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <Link to="/" className="group">
            <div className="relative">
              <div className="absolute inset-0 bg-gold-400/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative transition-transform duration-500 group-hover:scale-105">
                <BrandLogo size="xl" className="hidden sm:flex" />
                <BrandLogo size="sm" className="sm:hidden" />
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
                    className="relative z-[1000]"
                    onMouseEnter={() => setServicesDropdownOpen(true)}
                    onMouseLeave={() => setServicesDropdownOpen(false)}
                  >
                    <button
                      onClick={() => handleNavClick(link)}
                      className={`relative px-5 py-2.5 text-lg font-medium tracking-wide transition-all duration-300 group flex items-center gap-1.5 ${
                        isServicePage
                          ? 'text-gold-400'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {link.label}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
                      <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-300 ${
                        isServicePage ? 'w-8' : 'w-0 group-hover:w-6'
                      }`}></span>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className={`absolute top-full left-0 pt-1 transition-opacity duration-150 z-[1001] ${
                      servicesDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
                    }`}>
                      {/* Invisible bridge to prevent gap */}
                      <div className="absolute top-0 left-0 right-0 h-2 bg-transparent"></div>
                      <div className="w-56 mt-1 rounded-lg shadow-xl border border-gold-500/20 overflow-hidden bg-[#0D0D0D]">
                        <div className="py-1">
                          {servicePages.map((service, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                navigate(service.path);
                                setServicesDropdownOpen(false);
                                window.scrollTo(0, 0);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center gap-3 ${
                                location.pathname === service.path 
                                  ? 'text-gold-400 bg-gold-500/10' 
                                  : 'text-gray-300 hover:text-gold-400 hover:bg-white/5'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                                location.pathname === service.path 
                                  ? 'bg-gold-400 shadow-[0_0_8px_rgba(216,178,92,0.5)]' 
                                  : 'bg-gold-400/40 group-hover:bg-gold-400 group-hover:shadow-[0_0_8px_rgba(216,178,92,0.5)]'
                              }`}></div>
                              <span className="font-medium">{service.label}</span>
                            </button>
                          ))}
                        </div>
                        
                        {/* View All Services */}
                        <div className="px-4 py-2.5 border-t border-gold-500/10 bg-[#0D0D0D]">
                          <button
                            onClick={() => {
                              handleNavClick({ path: '/#services' });
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
                    onClick={() => handleNavClick(link)}
                    className="relative px-5 py-2.5 text-lg font-medium tracking-wide transition-all duration-300 group text-gray-400 hover:text-white"
                  >
                    {link.label}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-300 w-0 group-hover:w-6"></span>
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
              <span className="relative font-semibold text-[#0D0D0D] text-base tracking-wide">HomeHub Login</span>
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
          {navLinks.map((link) => (
            <div key={link.id}>
              {link.hasDropdown ? (
                /* Services with expandable menu */
                <div>
                  <button
                    onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                    className={`flex items-center justify-between w-full text-left px-5 py-4 rounded-xl text-base font-medium transition-all duration-300 ${
                      isServicePage
                        ? 'text-gold-400 bg-gold-400/10 border-l-2 border-gold-400'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                    <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${servicesDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Service Sub-pages */}
                  <div className={`overflow-hidden transition-all duration-300 ${servicesDropdownOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-6 py-2 space-y-1">
                      {servicePages.map((service, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            navigate(service.path);
                            setMobileMenuOpen(false);
                          }}
                          className={`flex items-center gap-3 w-full px-4 py-3 text-left text-sm transition-colors rounded-lg ${
                            location.pathname === service.path 
                              ? 'text-gold-400' 
                              : 'text-gray-500 hover:text-gold-400'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            location.pathname === service.path ? 'bg-gold-400' : 'bg-gold-400/50'
                          }`}></div>
                          {service.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleNavClick(link)}
                  className="block w-full text-left px-5 py-4 rounded-xl text-base font-medium transition-all duration-300 text-gray-400 hover:text-white hover:bg-white/5"
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
  );
};

export default MainHeader;
