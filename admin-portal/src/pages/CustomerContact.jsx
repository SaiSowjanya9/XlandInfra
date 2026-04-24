import { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Building2,
  Headphones,
} from 'lucide-react';

const CustomerContact = ({ user }) => {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess('Your message has been sent! We will get back to you shortly.');
      setFormData({ subject: '', message: '' });
      setTimeout(() => setSuccess(''), 5000);
    }, 1000);
  };

  const contactInfo = [
    {
      icon: Phone,
      label: 'Phone',
      value: '(555) 123-4567',
      subtext: 'Call us anytime',
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      icon: Mail,
      label: 'Email',
      value: 'support@property.com',
      subtext: 'We reply within 24 hrs',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: MapPin,
      label: 'Office',
      value: '123 Property Lane',
      subtext: 'Visit our office',
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  const emergencyContacts = [
    { label: 'Emergency Maintenance', number: '(555) 999-8888' },
    { label: 'After Hours Security', number: '(555) 777-6666' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Phone className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
            <p className="text-gray-500">Get in touch with your property management team</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start space-x-3 text-green-700">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {contactInfo.map((info, index) => {
          const Icon = info.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all"
            >
              <div className={`w-12 h-12 ${info.color} rounded-xl flex items-center justify-center mb-4`}>
                <Icon className="w-6 h-6" />
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{info.label}</p>
              <p className="font-semibold text-gray-900 mt-1">{info.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{info.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Message Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Send us a Message</h2>
            <p className="text-sm text-gray-500">We typically respond within 24 hours</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="">Select a topic...</option>
              <option value="general">General Inquiry</option>
              <option value="lease">Lease Questions</option>
              <option value="billing">Billing Questions</option>
              <option value="amenities">Amenities</option>
              <option value="complaint">Complaint</option>
              <option value="feedback">Feedback</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Type your message here..."
              required
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all ${
              isSubmitting
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Send Message</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Office Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Office Hours</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Monday - Friday</span>
              <span className="font-medium text-gray-900">9:00 AM - 6:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Saturday</span>
              <span className="font-medium text-gray-900">10:00 AM - 4:00 PM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sunday</span>
              <span className="font-medium text-gray-500">Closed</span>
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 p-5">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Emergency Contacts</h3>
          </div>
          <div className="space-y-3">
            {emergencyContacts.map((contact, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{contact.label}</span>
                <a
                  href={`tel:${contact.number.replace(/[^0-9]/g, '')}`}
                  className="font-semibold text-red-600 hover:text-red-700"
                >
                  {contact.number}
                </a>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 mt-3">
            For life-threatening emergencies, always call 911 first.
          </p>
        </div>
      </div>

      {/* Live Chat Banner */}
      <div className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-5 text-white">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Headphones className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Need immediate help?</h3>
            <p className="text-sm text-emerald-100 mt-0.5">
              Our support team is available during office hours for live assistance
            </p>
          </div>
          <button className="px-5 py-2.5 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors">
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerContact;
