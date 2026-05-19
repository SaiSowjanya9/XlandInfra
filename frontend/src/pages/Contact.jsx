import { Phone, Mail, MapPin, Clock } from 'lucide-react';

const Contact = () => {
  const contactInfo = [
    {
      icon: Phone,
      title: 'Phone',
      details: '+91 8500101111',
      subtext: 'Mon-Sat, 8am-6pm',
    },
    {
      icon: Mail,
      title: 'Email',
      details: 'info@xlandinfra.com',
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
      details: 'Monday - Saturday',
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

        {/* Emergency Contact */}
        <div className="bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            Need Help?
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-red-900/20 rounded-xl border border-red-500/30">
              <h3 className="font-medium text-red-300 mb-2">Emergency?</h3>
              <p className="text-sm text-red-300/80 mb-3">
                For urgent maintenance issues, please call our emergency line
              </p>
              <a
                href="tel:+918500101111"
                className="inline-flex items-center space-x-2 text-red-400 font-medium hover:text-red-300 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>+91 8500101111</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
