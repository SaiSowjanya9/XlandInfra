import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Settings, BarChart3, Target, Shield, Mail, Phone } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const CookiePolicy = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const cookieTypes = [
    {
      icon: Shield,
      title: 'Essential Cookies',
      required: true,
      description: 'These cookies are necessary for the website to function properly. They enable basic functions like page navigation, secure access to protected areas, and remembering your preferences.',
      examples: [
        'Session management cookies',
        'Authentication cookies',
        'Security cookies',
        'Load balancing cookies'
      ]
    },
    {
      icon: BarChart3,
      title: 'Analytics Cookies',
      required: false,
      description: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our services and user experience.',
      examples: [
        'Google Analytics',
        'Page view tracking',
        'User journey analysis',
        'Performance monitoring'
      ]
    },
    {
      icon: Settings,
      title: 'Functional Cookies',
      required: false,
      description: 'These cookies enable enhanced functionality and personalization, such as remembering your preferences, language settings, and customization choices.',
      examples: [
        'Language preferences',
        'Region settings',
        'User interface customizations',
        'Previously viewed properties'
      ]
    },
    {
      icon: Target,
      title: 'Marketing Cookies',
      required: false,
      description: 'These cookies are used to track visitors across websites to display relevant advertisements. They help us measure the effectiveness of our marketing campaigns.',
      examples: [
        'Advertising cookies',
        'Social media cookies',
        'Retargeting cookies',
        'Campaign tracking'
      ]
    }
  ];

  const managingCookies = [
    {
      browser: 'Google Chrome',
      instructions: 'Settings → Privacy and Security → Cookies and other site data'
    },
    {
      browser: 'Mozilla Firefox',
      instructions: 'Settings → Privacy & Security → Cookies and Site Data'
    },
    {
      browser: 'Safari',
      instructions: 'Preferences → Privacy → Manage Website Data'
    },
    {
      browser: 'Microsoft Edge',
      instructions: 'Settings → Cookies and site permissions → Cookies and site data'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Cookie Policy - XLAND INFRA"
        description="Cookie Policy for XLAND INFRA PVT LTD. Learn about how we use cookies and similar technologies on our website."
        keywords="cookie policy, cookies, tracking, website cookies, XLAND INFRA, privacy"
        canonical="https://xlandinfra.com/cookie-policy"
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/">
              <BrandLogo size="sm" />
            </Link>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gold-400 hover:text-gold-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-2xl">
            <Cookie className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            Cookie <span className="text-gold-hero">Policy</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-4">
            This policy explains how XLAND INFRA uses cookies and similar technologies to recognize you when you visit our website.
          </p>
          <p className="text-gray-500 text-sm">
            Last Updated: May 1, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* What Are Cookies */}
          <div className="mb-12 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-4">What Are Cookies?</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites work more efficiently and to provide information to website owners.
            </p>
            <p className="text-gray-400 leading-relaxed">
              Cookies allow us to recognize your device and remember your preferences, providing you with a better browsing experience. They also help us understand how you use our website so we can improve our services.
            </p>
          </div>

          {/* Types of Cookies */}
          <h2 className="text-2xl font-display font-bold text-white mb-8">Types of Cookies We Use</h2>
          <div className="space-y-6 mb-12">
            {cookieTypes.map((cookie, index) => {
              const Icon = cookie.icon;
              return (
                <div key={index} className="p-6 bg-gradient-to-br from-charcoal-800/30 to-charcoal-900/30 border border-charcoal-700/30 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-gold-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-display font-bold text-white">{cookie.title}</h3>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          cookie.required 
                            ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' 
                            : 'bg-charcoal-700/50 text-gray-400 border border-charcoal-600'
                        }`}>
                          {cookie.required ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <p className="text-gray-400 leading-relaxed mb-4">{cookie.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {cookie.examples.map((example, idx) => (
                          <span key={idx} className="px-3 py-1 text-sm bg-charcoal-800/50 text-gray-300 rounded-lg">
                            {example}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Managing Cookies */}
          <div className="mb-12 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-6">Managing Your Cookie Preferences</h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              You can control and manage cookies in various ways. Please note that removing or blocking cookies may impact your user experience and some functionality may no longer be available.
            </p>
            
            <h3 className="text-lg font-semibold text-gold-400 mb-4">Browser Settings</h3>
            <p className="text-gray-400 mb-4">
              Most browsers allow you to refuse or accept cookies through their settings. Here's how to access cookie settings in popular browsers:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {managingCookies.map((item, index) => (
                <div key={index} className="p-4 bg-charcoal-800/50 rounded-xl">
                  <h4 className="font-semibold text-white mb-1">{item.browser}</h4>
                  <p className="text-gray-400 text-sm">{item.instructions}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Third-Party Cookies */}
          <div className="mb-12 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-4">Third-Party Cookies</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              In addition to our own cookies, we may also use various third-party cookies to report usage statistics, deliver advertisements, and provide other services. These third parties have their own privacy policies and may collect information about your online activities across different websites.
            </p>
            <p className="text-gray-400 leading-relaxed">
              We use services from trusted partners including Google Analytics for website analytics, and social media platforms for content sharing functionality.
            </p>
          </div>

          {/* Updates */}
          <div className="mb-12 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-4">Updates to This Policy</h2>
            <p className="text-gray-400 leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our data practices. When we make changes, we will update the "Last Updated" date at the top of this policy. We encourage you to review this policy periodically to stay informed about our use of cookies.
            </p>
          </div>

          {/* Contact Section */}
          <div className="p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-6">Contact Us</h2>
            <p className="text-gray-400 mb-6">
              If you have questions about our use of cookies or this policy, please contact us:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <Mail className="w-5 h-5 text-gold-400" />
                <span>info@xlandinfra.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Phone className="w-5 h-5 text-gold-400" />
                <span>+91 8500 010 111</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-charcoal-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} XLAND INFRA PVT LTD. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CookiePolicy;
