import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Layout from './components/Layout';
import CorporateLanding from './pages/CorporateLanding';
import CustomerHome from './pages/CustomerHome';
import Dashboard from './pages/Dashboard';
import WorkOrder from './pages/WorkOrder';
import Schedule from './pages/Schedule';
import Payment from './pages/Payment';
import Contact from './pages/Contact';
import Login from './pages/Login';
import ActivateAccount from './pages/ActivateAccount';
import InvestmentConsultation from './pages/services/InvestmentConsultation';
import DesignConceptualization from './pages/services/DesignConceptualization';
import ConstructionDelivery from './pages/services/ConstructionDelivery';
import PropertySalesAdvisory from './pages/services/PropertySalesAdvisory';
import BrokerageServices from './pages/services/BrokerageServices';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsOfService from './pages/legal/TermsOfService';
import CookiePolicy from './pages/legal/CookiePolicy';
import BrandLogo from './components/BrandLogo';
import CookieConsent from './components/CookieConsent';

// Vendor Portal Coming Soon Component
function VendorPortalComingSoon() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-900 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8 float-slow">
          <BrandLogo size="xl" />
        </div>
        
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
          Vendor <span className="text-gold-gradient">Portal</span>
        </h1>
        
        {/* Coming Soon Badge */}
        <div className="inline-flex items-center space-x-2 px-6 py-3 bg-gold-500/10 border border-gold-500/30 rounded-full mb-8">
          <div className="w-2 h-2 bg-gold-400 rounded-full animate-pulse"></div>
          <span className="text-gold-400 font-semibold tracking-wider uppercase text-sm">Coming Soon</span>
        </div>
        
        {/* Description */}
        <p className="text-gray-400 text-lg mb-10 leading-relaxed">
          We're building something amazing for our valued vendor partners. 
          Our new vendor portal will streamline collaboration, enhance communication, 
          and provide powerful tools to manage your partnership with XLAND INFRA.
        </p>
        
        {/* Features Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { title: 'Project Management', desc: 'Track assignments' },
            { title: 'Invoice Processing', desc: 'Streamlined payments' },
            { title: 'Real-time Updates', desc: 'Stay connected' }
          ].map((feature, index) => (
            <div key={index} className="p-4 bg-charcoal-800/50 border border-charcoal-700/50 rounded-xl">
              <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
              <p className="text-gray-500 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
        
        {/* Back Button */}
        <Link 
          to="/" 
          className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-gold-400 to-gold-600 text-charcoal-900 font-semibold rounded-xl hover:from-gold-300 hover:to-gold-500 transition-all duration-300 shadow-lg hover:shadow-gold-500/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Home</span>
        </Link>
        
        {/* Contact info */}
        <p className="mt-8 text-gray-500 text-sm">
          For vendor inquiries, contact us at{' '}
          <a href="mailto:vendors@xlandinfra.com" className="text-gold-400 hover:text-gold-300">
            vendors@xlandinfra.com
          </a>
        </p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('portalUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('portalUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('portalUser');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-900">
        <div className="text-center">
          <div className="flex justify-center mb-6 animate-pulse">
            <BrandLogo size="lg" />
          </div>
          <div className="w-12 h-12 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Corporate Landing Page as the entry point */}
        <Route path="/" element={<CorporateLanding />} />
        
        {/* Customer Portal Home (after login) */}
        <Route path="/portal" element={<CustomerHome />} />
        
        {/* Service Pages */}
                <Route path="/services/investment-consultation" element={<InvestmentConsultation />} />
        <Route path="/services/design-conceptualization" element={<DesignConceptualization />} />
        <Route path="/services/construction-delivery" element={<ConstructionDelivery />} />
        <Route path="/services/property-sales-advisory" element={<PropertySalesAdvisory />} />
        <Route path="/services/brokerage-services" element={<BrokerageServices />} />
        
        {/* Legal Pages */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        
        {/* Customer Portal Routes */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/activate/:token" element={<ActivateAccount />} />
        <Route path="/dashboard/*" element={
          user ? (
            <Layout user={user} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/work-order" element={<WorkOrder user={user} />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/contact" element={<Contact />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        
        {/* Vendor Portal Routes (Coming Soon - UI Only, Backend Preserved) */}
        <Route path="/vendor-login" element={<VendorPortalComingSoon />} />
        <Route path="/vendor/*" element={<VendorPortalComingSoon />} />
        
        {/* Admin Portal Routes (Coming Soon) */}
        <Route path="/admin-login" element={
          <div className="min-h-screen flex items-center justify-center bg-charcoal-900 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl"></div>
            </div>
            <div className="relative z-10 text-center px-6">
              <div className="flex justify-center mb-8">
                <BrandLogo size="xl" />
              </div>
              <h1 className="text-4xl font-display font-bold text-white mb-4">
                Admin <span className="text-gold-gradient">Portal</span>
              </h1>
              <div className="inline-flex items-center space-x-2 px-6 py-3 bg-gold-500/10 border border-gold-500/30 rounded-full mb-8">
                <div className="w-2 h-2 bg-gold-400 rounded-full animate-pulse"></div>
                <span className="text-gold-400 font-semibold tracking-wider uppercase text-sm">Coming Soon</span>
              </div>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                The administrative portal is currently under development. Please check back soon.
              </p>
              <Link to="/" className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-gold-400 to-gold-600 text-charcoal-900 font-semibold rounded-xl hover:from-gold-300 hover:to-gold-500 transition-all duration-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        } />
      </Routes>
      <CookieConsent />
    </Router>
  );
}

export default App;
