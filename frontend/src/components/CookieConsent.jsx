import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, Check, Settings } from 'lucide-react';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: false,
    functional: false,
    marketing: false
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(essentialOnly));
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    const savedPreferences = {
      ...preferences,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(savedPreferences));
    setIsVisible(false);
  };

  const togglePreference = (key) => {
    if (key === 'essential') return;
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!isVisible) return null;

  // Using inline styles to guarantee rendering
  const backdropStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 9998
  };

  const bannerContainerStyle = {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '672px',
    padding: '0 16px',
    zIndex: 9999
  };

  const bannerStyle = {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
    border: '1px solid #333',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    position: 'relative'
  };

  return (
    <>
      {/* Backdrop */}
      <div style={backdropStyle} />
      
      {/* Cookie Banner */}
      <div style={bannerContainerStyle}>
        <div style={bannerStyle}>
          <div className="p-6">
          {!showPreferences ? (
            <>
              {/* Main Content */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-normal text-white mb-2">
                    We Value Your Privacy
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. 
                    By clicking "Accept All", you consent to our use of cookies. 
                    <Link to="/cookie-policy" className="text-gold-400 hover:text-gold-300 ml-1">
                      Learn more
                    </Link>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#D4AF37] text-[#0D0D0D] font-semibold rounded-xl hover:bg-[#C9A227] hover:shadow-lg hover:shadow-gold-500/25 transition-all duration-300"
                >
                  <Check className="w-4 h-4" />
                  Accept All
                </button>
                <button
                  onClick={handleRejectAll}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-charcoal-600 text-gray-300 font-semibold rounded-xl hover:border-gold-500/50 hover:text-white transition-all duration-300"
                >
                  <X className="w-4 h-4" />
                  Reject All
                </button>
                <button
                  onClick={() => setShowPreferences(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-charcoal-600 text-gray-300 font-semibold rounded-xl hover:border-gold-500/50 hover:text-white transition-all duration-300"
                >
                  <Settings className="w-4 h-4" />
                  Preferences
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Preferences View */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-normal text-white">Cookie Preferences</h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {[
                  { key: 'essential', label: 'Essential Cookies', desc: 'Required for basic website functionality', required: true },
                  { key: 'analytics', label: 'Analytics Cookies', desc: 'Help us understand how visitors use our site', required: false },
                  { key: 'functional', label: 'Functional Cookies', desc: 'Enable personalization and enhanced features', required: false },
                  { key: 'marketing', label: 'Marketing Cookies', desc: 'Used for targeted advertising and promotions', required: false }
                ].map((cookie) => (
                  <div key={cookie.key} className="flex items-center justify-between p-4 bg-charcoal-800/50 rounded-xl border border-charcoal-700/30">
                    <div>
                      <h4 className="text-white font-medium mb-1">{cookie.label}</h4>
                      <p className="text-gray-500 text-sm">{cookie.desc}</p>
                    </div>
                    <button
                      onClick={() => togglePreference(cookie.key)}
                      disabled={cookie.required}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                        preferences[cookie.key] 
                          ? 'bg-[#D4AF37]' 
                          : 'bg-charcoal-600'
                      } ${cookie.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${
                        preferences[cookie.key] ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="flex-1 px-6 py-3 border border-charcoal-600 text-gray-300 font-semibold rounded-xl hover:border-gold-500/50 hover:text-white transition-all duration-300"
                >
                  Back
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="flex-1 px-6 py-3 bg-[#D4AF37] hover:bg-[#C9A227] text-[#0D0D0D] font-semibold rounded-xl hover:shadow-lg hover:shadow-gold-500/25 transition-all duration-300"
                >
                  Save Preferences
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CookieConsent;
