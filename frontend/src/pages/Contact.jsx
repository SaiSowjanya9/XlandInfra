import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';

const Contact = () => {
  const contactInfo = [
    {
      icon: Phone,
      title: 'Phone',
      details: '+1 (555) 123-4567',
      subtext: 'Mon-Fri, 8am-6pm',
    },
    {
      icon: Mail,
      title: 'Email',
      details: 'support@xlandinfra.com',
      subtext: 'We reply within 24 hours',
    },
    {
      icon: MapPin,
      title: 'Address',
      details: '123 Main Street',
      subtext: 'City, State 12345',
    },
    {
      icon: Clock,
      title: 'Business Hours',
      details: 'Monday - Friday',
      subtext: '8:00 AM - 6:00 PM',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Contact / Help
        </h1>
        <p className="text-dark-300">
          Get in touch with our support team
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div className="bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            Contact Information
          </h2>
          <div className="space-y-6">
            {contactInfo.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{item.title}</h3>
                    <p className="text-dark-200">{item.details}</p>
                    <p className="text-sm text-dark-400">{item.subtext}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Help */}
        <div className="bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            Need Help?
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-gold-600/10 rounded-xl border border-gold-500/30">
              <div className="flex items-center space-x-3 mb-2">
                <MessageCircle className="w-5 h-5 text-gold-400" />
                <h3 className="font-medium text-white">Live Chat</h3>
              </div>
              <p className="text-sm text-dark-300 mb-3">
                Chat with our support team for immediate assistance
              </p>
              <button className="py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl">
                Start Chat
              </button>
            </div>

            <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600">
              <h3 className="font-medium text-white mb-2">FAQs</h3>
              <ul className="space-y-2 text-sm text-dark-300">
                <li className="hover:text-gold-400 cursor-pointer transition-colors">
                  • How do I submit a work order?
                </li>
                <li className="hover:text-gold-400 cursor-pointer transition-colors">
                  • What are the service hours?
                </li>
                <li className="hover:text-gold-400 cursor-pointer transition-colors">
                  • How can I track my work order status?
                </li>
                <li className="hover:text-gold-400 cursor-pointer transition-colors">
                  • What payment methods are accepted?
                </li>
              </ul>
            </div>

            <div className="p-4 bg-red-900/20 rounded-xl border border-red-500/30">
              <h3 className="font-medium text-red-300 mb-2">Emergency?</h3>
              <p className="text-sm text-red-300/80 mb-3">
                For urgent maintenance issues, please call our emergency line
              </p>
              <a
                href="tel:+15551234567"
                className="inline-flex items-center space-x-2 text-red-400 font-medium hover:text-red-300 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>+1 (555) 123-4567</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
