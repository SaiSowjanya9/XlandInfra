import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import BrandLogo from './components/BrandLogo';

// Direct imports for critical post-login components (no loading delay)
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import WorkOrder from './pages/WorkOrder';
import Login from './pages/Login';

// Lazy load less frequently accessed components
const CorporateLanding = lazy(() => import('./pages/CorporateLanding'));
const CustomerHome = lazy(() => import('./pages/CustomerHome'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Payment = lazy(() => import('./pages/Payment'));
const Contact = lazy(() => import('./pages/Contact'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const PropertyManagement = lazy(() => import('./pages/services/PropertyManagement'));
const PropertySalesAdvisory = lazy(() => import('./pages/services/PropertySalesAdvisory'));
const InvestmentConsultation = lazy(() => import('./pages/services/InvestmentConsultation'));
const DesignConceptualization = lazy(() => import('./pages/services/DesignConceptualization'));
const ConstructionDelivery = lazy(() => import('./pages/services/ConstructionDelivery'));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const CookiePolicy = lazy(() => import('./pages/legal/CookiePolicy'));
const CookieConsent = lazy(() => import('./components/CookieConsent'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
    <div className="text-center">
      <div className="w-10 h-10 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>
  </div>
);

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

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

  // Check if session is still valid
  const isSessionValid = () => {
    const lastActivity = sessionStorage.getItem('lastActivity');
    if (!lastActivity) return false;
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed < SESSION_TIMEOUT;
  };

  // Update last activity timestamp
  const updateActivity = () => {
    sessionStorage.setItem('lastActivity', Date.now().toString());
  };

  useEffect(() => {
    try {
      const savedUser = sessionStorage.getItem('portalUser');
      
      if (savedUser && isSessionValid()) {
        setUser(JSON.parse(savedUser));
        updateActivity(); // Refresh activity on load
      } else if (savedUser) {
        // Session expired - clear everything
        sessionStorage.removeItem('portalUser');
        sessionStorage.removeItem('lastActivity');
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
      sessionStorage.removeItem('portalUser');
      sessionStorage.removeItem('lastActivity');
    }
    setLoading(false);
  }, []);

  // Track QR code visits (for printed QR codes) - every page load counts
  useEffect(() => {
    const trackVisit = async () => {
      // Detect which page based on path
      const path = window.location.pathname;
      // Main website: /, /portal, empty, or any path that's NOT /login or /dashboard
      const isLoginPage = path.includes('/login') || path.includes('/dashboard');
      const page = isLoginPage ? 'login' : 'main';
      
      try {
        await fetch('https://admin.xlandinfra.com/api/qr/track-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            page, 
            source: 'printed_qr',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
          }),
          credentials: 'include'
        });
      } catch (e) {
        // Silent fail
      }
    };
    trackVisit();
  }, []);

  // Track user activity to keep session alive
  useEffect(() => {
    if (!user) return;
    
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    let activityTimeout;
    
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updateActivity, 1000); // Debounce updates
    };
    
    activityEvents.forEach(event => window.addEventListener(event, handleActivity));
    
    // Check session validity periodically
    const intervalId = setInterval(() => {
      if (!isSessionValid()) {
        handleLogout();
        alert('Session expired due to inactivity. Please log in again.');
      }
    }, 60000); // Check every minute
    
    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(intervalId);
      clearTimeout(activityTimeout);
    };
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    sessionStorage.setItem('portalUser', JSON.stringify(userData));
    sessionStorage.setItem('lastActivity', Date.now().toString()); // Start session timer
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('portalUser');
    sessionStorage.removeItem('lastActivity');
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Corporate Landing Page as the entry point */}
          <Route path="/" element={<CorporateLanding />} />
        
        {/* Customer Portal Home (after login) */}
        <Route path="/portal" element={<CustomerHome />} />
        
        {/* Service Pages */}
        <Route path="/services/property-management" element={<PropertyManagement />} />
        <Route path="/services/property-sales-advisory" element={<PropertySalesAdvisory />} />
        <Route path="/services/investment-consultation" element={<InvestmentConsultation />} />
        <Route path="/services/design-conceptualization" element={<DesignConceptualization />} />
        <Route path="/services/construction-delivery" element={<ConstructionDelivery />} />
        
        {/* Legal Pages */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        
        {/* Customer Portal Routes - Login uses direct import for fast loading */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/forgot-password" element={
          user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />
        } />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/activate/:token" element={<ActivateAccount />} />
        {/* Dashboard routes use direct imports for instant loading after login */}
        <Route path="/dashboard/*" element={
          user ? (
            <Layout user={user} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/work-order" element={<WorkOrder user={user} />} />
                <Route path="/schedule" element={<Suspense fallback={<PageLoader />}><Schedule /></Suspense>} />
                <Route path="/payment" element={<Suspense fallback={<PageLoader />}><Payment /></Suspense>} />
                <Route path="/contact" element={<Suspense fallback={<PageLoader />}><Contact /></Suspense>} />
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
      </Suspense>
    </Router>
  );
}

export default App;
