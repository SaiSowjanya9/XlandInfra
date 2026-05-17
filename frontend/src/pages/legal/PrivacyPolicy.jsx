import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Mail, Phone } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const sections = [
    {
      icon: Database,
      title: 'Information We Collect',
      content: [
        {
          subtitle: 'Personal Information',
          text: 'We collect information you provide directly, including name, email address, phone number, postal address, and any other information you choose to provide when contacting us, registering for services, or making inquiries about properties.'
        },
        {
          subtitle: 'Property Information',
          text: 'Details about properties you own, manage, or are interested in, including property addresses, ownership documents, and transaction history.'
        },
        {
          subtitle: 'Usage Information',
          text: 'Information about how you interact with our website and services, including IP address, browser type, pages visited, time spent on pages, and referring URLs.'
        },
        {
          subtitle: 'Financial Information',
          text: 'Payment details, bank account information, and transaction records when you engage in financial transactions through our platform.'
        }
      ]
    },
    {
      icon: Eye,
      title: 'How We Use Your Information',
      content: [
        {
          subtitle: 'Service Delivery',
          text: 'To provide, maintain, and improve our real estate services, process transactions, and manage your account.'
        },
        {
          subtitle: 'Communication',
          text: 'To send you updates about your properties, service notifications, marketing communications (with your consent), and respond to your inquiries.'
        },
        {
          subtitle: 'Legal Compliance',
          text: 'To comply with legal obligations, resolve disputes, and enforce our agreements.'
        },
        {
          subtitle: 'Analytics',
          text: 'To analyze usage patterns, improve our website functionality, and enhance user experience.'
        }
      ]
    },
    {
      icon: UserCheck,
      title: 'Information Sharing',
      content: [
        {
          subtitle: 'Service Providers',
          text: 'We may share information with trusted third-party service providers who assist us in operating our business, such as payment processors, legal advisors, and property verification agencies.'
        },
        {
          subtitle: 'Legal Requirements',
          text: 'We may disclose information when required by law, court order, or government regulations, or to protect our rights and safety.'
        },
        {
          subtitle: 'Business Transfers',
          text: 'In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.'
        },
        {
          subtitle: 'With Your Consent',
          text: 'We may share your information with third parties when you have given us explicit consent to do so.'
        }
      ]
    },
    {
      icon: Lock,
      title: 'Data Security',
      content: [
        {
          subtitle: 'Security Measures',
          text: 'We implement industry-standard security measures including encryption, secure servers, firewalls, and access controls to protect your personal information.'
        },
        {
          subtitle: 'Data Retention',
          text: 'We retain your information for as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required by law.'
        },
        {
          subtitle: 'Breach Notification',
          text: 'In the event of a data breach that affects your personal information, we will notify you and relevant authorities as required by applicable laws.'
        }
      ]
    },
    {
      icon: Shield,
      title: 'Your Rights',
      content: [
        {
          subtitle: 'Access & Correction',
          text: 'You have the right to access, correct, or update your personal information at any time through your account or by contacting us.'
        },
        {
          subtitle: 'Deletion',
          text: 'You may request deletion of your personal information, subject to legal retention requirements and legitimate business purposes.'
        },
        {
          subtitle: 'Opt-Out',
          text: 'You can opt out of marketing communications at any time by clicking the unsubscribe link in emails or contacting us directly.'
        },
        {
          subtitle: 'Data Portability',
          text: 'You may request a copy of your personal data in a structured, commonly used format.'
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Privacy Policy - XLAND INFRA"
        description="Privacy Policy for XLAND INFRA PVT LTD. Learn how we collect, use, protect, and share your personal information."
        keywords="privacy policy, data protection, personal information, XLAND INFRA, real estate privacy"
        canonical="https://xlandinfra.com/privacy-policy"
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
            <Shield className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            Privacy <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Policy</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-4">
            Your privacy is important to us. This policy outlines how XLAND INFRA PVT LTD collects, uses, and protects your personal information.
          </p>
          <p className="text-gray-500 text-sm">
            Last Updated: May 1, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="mb-12 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <p className="text-gray-300 leading-relaxed">
              XLAND INFRA PVT LTD ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, or interact with us in any way. By using our services, you consent to the practices described in this policy.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <div key={index} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white">{section.title}</h2>
                  </div>
                  
                  <div className="ml-16 space-y-6">
                    {section.content.map((item, idx) => (
                      <div key={idx}>
                        <h3 className="text-lg font-semibold text-gold-400 mb-2">{item.subtitle}</h3>
                        <p className="text-gray-400 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact Section */}
          <div className="mt-16 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-6">Contact Us</h2>
            <p className="text-gray-400 mb-6">
              If you have questions about this Privacy Policy or our privacy practices, please contact us:
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <Mail className="w-5 h-5 text-gold-400" />
                <span>info@xlandinfra.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Phone className="w-5 h-5 text-gold-400" />
                <span>+91 8500 101 111</span>
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

export default PrivacyPolicy;
