import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Briefcase, Phone, Mail, MapPin, Clock, CheckCircle, Award, Shield, Menu, X } from 'lucide-react';
import Logo from '../assets/LOGO 2.png';

const loginOptions = [
  {
    id: 'customer',
    title: 'Customer Login',
    description: 'Access your project details, track progress, view schedules, and manage payments',
    icon: Users,
    path: '/login',
  },
  {
    id: 'vendor',
    title: 'Vendor Login',
    description: 'Partner portal for associated vendors to manage contracts and deliveries',
    icon: Briefcase,
    path: '/vendor-login',
    comingSoon: true,
  },
  {
    id: 'company',
    title: 'Company Login',
    description: 'Administrative access with full control over all operations and management',
    icon: Building2,
    path: '/admin-login',
    comingSoon: true,
  },
];

const features = [
  {
    icon: CheckCircle,
    title: 'Quality Construction',
    description: 'We deliver excellence in every project with premium materials and skilled craftsmanship.',
  },
  {
    icon: Award,
    title: 'Award Winning',
    description: 'Recognized for our outstanding work in residential and commercial infrastructure.',
  },
  {
    icon: Shield,
    title: 'Trusted Partner',
    description: 'Over 15 years of experience building trust with our valued customers.',
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLoginSelect = (option) => {
    if (option.comingSoon) {
      alert('This portal is coming soon. Please check back later.');
      return;
    }
    navigate(option.path);
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-dark-900/95 backdrop-blur-md border-b border-gold-600/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <img src={Logo} alt="XlandInfra" className="h-12 md:h-14 w-auto" />
              <span className="text-xl md:text-2xl font-bold text-white hidden sm:block">
                Xland<span className="text-gold-400">Infra</span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('home')}
                className="text-dark-200 hover:text-gold-400 font-medium transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-dark-200 hover:text-gold-400 font-medium transition-colors"
              >
                About
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-dark-200 hover:text-gold-400 font-medium transition-colors"
              >
                Contact
              </button>
              <button
                onClick={() => scrollToSection('portal')}
                className="px-5 py-2 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Login Portal
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-dark-200 hover:text-gold-400"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gold-600/20">
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => scrollToSection('home')}
                  className="text-left px-4 py-2 text-dark-200 hover:text-gold-400 hover:bg-dark-800/50 rounded-lg transition-colors"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('about')}
                  className="text-left px-4 py-2 text-dark-200 hover:text-gold-400 hover:bg-dark-800/50 rounded-lg transition-colors"
                >
                  About
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="text-left px-4 py-2 text-dark-200 hover:text-gold-400 hover:bg-dark-800/50 rounded-lg transition-colors"
                >
                  Contact
                </button>
                <button
                  onClick={() => scrollToSection('portal')}
                  className="mx-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 text-dark-900 text-center"
                >
                  Login Portal
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative z-10 py-16 md:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center mb-8">
            <img 
              src={Logo} 
              alt="XlandInfra" 
              className="h-28 md:h-36 w-auto drop-shadow-2xl"
            />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Building <span className="text-gold-gradient">Dreams</span> Into Reality
          </h1>
          <p className="text-dark-300 text-lg md:text-xl max-w-3xl mx-auto mb-8">
            XlandInfra is a premier infrastructure and construction company dedicated to delivering 
            exceptional quality in residential and commercial projects across the region.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => scrollToSection('portal')}
              className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Access Portal
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="px-8 py-3 rounded-xl font-semibold border-2 border-gold-500 text-gold-400 hover:bg-gold-500/10 transition-all duration-200"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative z-10 py-16 md:py-24 px-4 bg-dark-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              About <span className="text-gold-gradient">XlandInfra</span>
            </h2>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto">
              Your trusted partner in building world-class infrastructure
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Our Story</h3>
              <p className="text-dark-300 mb-4">
                Founded in 2009, XlandInfra has grown from a small construction firm to one of the 
                leading infrastructure development companies in the region. Our commitment to quality, 
                innovation, and customer satisfaction has been the cornerstone of our success.
              </p>
              <p className="text-dark-300 mb-4">
                We specialize in residential complexes, commercial buildings, industrial facilities, 
                and large-scale infrastructure projects. Our team of experienced engineers, architects, 
                and project managers ensures that every project is delivered on time and exceeds expectations.
              </p>
              <p className="text-dark-300">
                With over 500+ completed projects and 10,000+ satisfied customers, we continue to 
                set new standards in the construction industry.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6 text-center">
                <p className="text-3xl font-bold text-gold-400 mb-2">15+</p>
                <p className="text-dark-300 text-sm">Years Experience</p>
              </div>
              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6 text-center">
                <p className="text-3xl font-bold text-gold-400 mb-2">500+</p>
                <p className="text-dark-300 text-sm">Projects Completed</p>
              </div>
              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6 text-center">
                <p className="text-3xl font-bold text-gold-400 mb-2">10K+</p>
                <p className="text-dark-300 text-sm">Happy Customers</p>
              </div>
              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6 text-center">
                <p className="text-3xl font-bold text-gold-400 mb-2">50+</p>
                <p className="text-dark-300 text-sm">Expert Team</p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6 text-center hover:border-gold-500/50 transition-all duration-300">
                  <div className="w-14 h-14 bg-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-7 h-7 text-gold-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-dark-300 text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative z-10 py-16 md:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Contact <span className="text-gold-gradient">Us</span>
            </h2>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto">
              Get in touch with our team for inquiries and support
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Head Office</h3>
                    <p className="text-dark-300">123 Business Park, Tower A</p>
                    <p className="text-dark-300">Hyderabad, Telangana 500081</p>
                  </div>
                </div>
              </div>

              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Phone</h3>
                    <p className="text-dark-300">+91 98765 43210</p>
                    <p className="text-dark-300">+91 40 1234 5678</p>
                  </div>
                </div>
              </div>

              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Email</h3>
                    <p className="text-dark-300">info@xlandinfra.com</p>
                    <p className="text-dark-300">support@xlandinfra.com</p>
                  </div>
                </div>
              </div>

              <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Business Hours</h3>
                    <p className="text-dark-300">Monday - Saturday</p>
                    <p className="text-dark-300">9:00 AM - 6:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-dark-800/60 border border-gold-600/20 rounded-xl p-6 md:p-8">
              <h3 className="text-xl font-bold text-white mb-6">Send us a Message</h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Full Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all"
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Phone</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all"
                    placeholder="Enter your phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Message</label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all resize-none"
                    placeholder="Enter your message"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Portal Section */}
      <section id="portal" className="relative z-10 py-16 md:py-24 px-4 bg-dark-800/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Access <span className="text-gold-gradient">Portal</span>
            </h2>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto">
              Select your login type to access the appropriate portal
            </p>
          </div>

          {/* Login Options */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {loginOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <div
                  key={option.id}
                  onClick={() => handleLoginSelect(option)}
                  className="relative group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:-translate-y-2"
                >
                  {option.comingSoon && (
                    <div className="absolute -top-3 -right-3 z-10 bg-gradient-to-r from-gold-500 to-gold-600 text-dark-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      Coming Soon
                    </div>
                  )}
                  <div className="bg-dark-800/60 backdrop-blur-sm rounded-2xl p-8 shadow-xl h-full border border-gold-600/20 hover:border-gold-500/50 transition-all duration-300 gold-glow-hover">
                    {/* Icon */}
                    <div className="w-16 h-16 bg-gradient-to-br from-gold-500/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <IconComponent className="w-8 h-8 text-gold-400" />
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-white mb-3">
                      {option.title}
                    </h3>
                    <p className="text-dark-300 text-sm leading-relaxed mb-6">
                      {option.description}
                    </p>
                    
                    {/* Button */}
                    <button
                      className="w-full py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transform transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      {option.comingSoon ? 'Coming Soon' : 'Continue'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-gold-600/20 bg-dark-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <img src={Logo} alt="XlandInfra" className="h-10 w-auto" />
                <span className="text-xl font-bold text-white">
                  Xland<span className="text-gold-400">Infra</span>
                </span>
              </div>
              <p className="text-dark-400 text-sm mb-4">
                Building dreams into reality. Your trusted partner for quality construction 
                and infrastructure development.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection('home')} className="text-dark-400 hover:text-gold-400 transition-colors">Home</button></li>
                <li><button onClick={() => scrollToSection('about')} className="text-dark-400 hover:text-gold-400 transition-colors">About Us</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="text-dark-400 hover:text-gold-400 transition-colors">Contact</button></li>
                <li><button onClick={() => scrollToSection('portal')} className="text-dark-400 hover:text-gold-400 transition-colors">Portal</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact Info</h4>
              <ul className="space-y-2 text-sm text-dark-400">
                <li>+91 98765 43210</li>
                <li>info@xlandinfra.com</li>
                <li>Hyderabad, India</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gold-600/10 text-center">
            <p className="text-dark-400 text-sm">
              © {new Date().getFullYear()} XlandInfra Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
