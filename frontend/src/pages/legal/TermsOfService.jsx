import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, AlertTriangle, CheckCircle, XCircle, Mail, Phone } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import SEO from '../../components/SEO';

const TermsOfService = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const sections = [
    {
      icon: CheckCircle,
      title: 'Acceptance of Terms',
      content: `By accessing or using the services provided by XLAND INFRA PVT LTD ("Company," "we," "our," or "us"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

These terms apply to all visitors, users, and others who access or use our website, customer portal, property management services, property sales services, investment consultation, design services, construction services, and any other services we provide.`
    },
    {
      icon: FileText,
      title: 'Services Description',
      content: `XLAND INFRA provides comprehensive real estate services including:

• Property Management: Complete facility management solutions including maintenance, AMC services, and end-to-end property care
• Property Sales & Advisory: Verified property listings, marketing, buyer matching, and end-to-end sales support
• Investment Consultation: Strategic real estate investment guidance and portfolio analysis
• Design & Conceptualization: Architectural concepts and space planning solutions
• Construction & Delivery: End-to-end construction execution and project management

We reserve the right to modify, suspend, or discontinue any service at any time without prior notice.`
    },
    {
      icon: Scale,
      title: 'User Responsibilities',
      content: `By using our services, you agree to:

• Provide accurate, current, and complete information during registration and transactions
• Maintain the confidentiality of your account credentials
• Notify us immediately of any unauthorized access to your account
• Use our services only for lawful purposes and in compliance with applicable laws
• Not engage in any activity that could harm, disable, or impair our services
• Not attempt to gain unauthorized access to our systems or networks
• Respect intellectual property rights and not reproduce our content without permission
• Comply with all applicable real estate laws and regulations`
    },
    {
      icon: AlertTriangle,
      title: 'Property Transactions',
      content: `For property-related transactions:

• All property listings are subject to verification and availability
• Prices, terms, and conditions are subject to change without notice
• We act as intermediaries and do not guarantee the completion of any transaction
• Users are responsible for conducting their own due diligence before any property transaction
• All legal documentation must be verified by qualified legal professionals
• We are not liable for disputes arising between buyers and sellers
• Transaction fees and commissions are as per the agreed service terms
• Property valuations are estimates and not guarantees of market value`
    },
    {
      icon: XCircle,
      title: 'Limitation of Liability',
      content: `To the maximum extent permitted by law:

• Our services are provided "as is" without warranties of any kind
• We do not guarantee the accuracy, completeness, or reliability of any information
• We are not liable for any indirect, incidental, special, or consequential damages
• Our total liability shall not exceed the fees paid by you for the specific service
• We are not responsible for third-party actions, services, or content
• We do not guarantee investment returns or property appreciation
• Force majeure events may affect service delivery without liability`
    },
    {
      icon: FileText,
      title: 'Intellectual Property',
      content: `All content on our website and services, including:

• Logos, trademarks, and brand elements
• Website design, layout, and graphics
• Text, images, and multimedia content
• Software, code, and technical systems
• Property listings and marketing materials

are the exclusive property of XLAND INFRA PVT LTD or our licensors. Unauthorized use, reproduction, or distribution is prohibited.`
    },
    {
      icon: Scale,
      title: 'Dispute Resolution',
      content: `Any disputes arising from these terms or our services:

• Shall first be attempted to be resolved through good-faith negotiation
• If unresolved within 30 days, may be submitted to mediation
• Shall be governed by the laws of India
• Shall be subject to the exclusive jurisdiction of courts in Hyderabad, Telangana
• Class action waivers apply where permitted by law
• Arbitration may be pursued as an alternative to litigation`
    },
    {
      icon: AlertTriangle,
      title: 'Termination',
      content: `We reserve the right to:

• Suspend or terminate your access to our services at any time
• Remove or disable access to any content that violates these terms
• Take legal action against users who violate these terms

You may terminate your account at any time by contacting us. Upon termination, your right to use our services ceases immediately, though certain provisions of these terms will survive termination.`
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO 
        title="Terms of Service - XLAND INFRA"
        description="Terms of Service for XLAND INFRA PVT LTD. Read our terms and conditions for using our real estate services."
        keywords="terms of service, terms and conditions, legal terms, XLAND INFRA, real estate terms"
        canonical="https://xlandinfra.com/terms-of-service"
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
            <FileText className="w-8 h-8 text-gold-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            Terms of <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">Service</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-4">
            Please read these terms carefully before using our services. By using XLAND INFRA services, you agree to these terms.
          </p>
          <p className="text-gray-500 text-sm">
            Last Updated: May 1, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Sections */}
          <div className="space-y-12">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <div key={index} className="p-8 bg-gradient-to-br from-charcoal-800/30 to-charcoal-900/30 border border-charcoal-700/30 rounded-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-gold-400/20 to-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gold-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white">{section.title}</h2>
                  </div>
                  <div className="text-gray-400 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact Section */}
          <div className="mt-16 p-8 bg-gradient-to-br from-charcoal-800/50 to-charcoal-900/50 border border-charcoal-700/50 rounded-2xl">
            <h2 className="text-2xl font-display font-bold text-white mb-6">Questions?</h2>
            <p className="text-gray-400 mb-6">
              If you have any questions about these Terms of Service, please contact us:
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

export default TermsOfService;
