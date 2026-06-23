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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" />
      
      {/* Cookie Banner */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-2xl mx-4 px-4">
        <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#333] rounded-2xl shadow-2xl">
          {/* Gold accent line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
          
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
