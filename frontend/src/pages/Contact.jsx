import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, MapPin, Clock, Loader2, CheckCircle, AlertCircle, FileWarning } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Keep in step with CONCERN_OPTIONS in backend/utils/marketingComplaints.js and
// admin-portal/src/pages/FPMarketingComplaintForm.jsx.
const CONCERN_OPTIONS = ['Service Delay', 'Poor Quality Work', 'Incomplete Work', 'Safety Issue', 'Vendor Issue', 'Maintenance Issue', 'Pricing/Payments', 'Other'];

// Where a complaint has got to, in the customer's own words. The statuses themselves are the
// server's (backend/utils/marketingComplaints.js) — this is only how they read here, the same way
// admin-portal/src/utils/complaintStatus.js tints them for the staff portals.
const STATUS_COPY = {
  Open: { label: 'Received', note: 'Logged with our service team', style: 'bg-gray-100 text-gray-700 border-gray-200' },
  Assigned: { label: 'Assigned', note: 'With a member of our team', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  'In Review': { label: 'In Review', note: 'Attended to, now being verified by our team', style: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  Closed: { label: 'Resolved', note: 'Verified and closed', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

// 'In Progress' and 'Reviewed' were the two steps In Review replaced (schema_v54). The server
// normalises stored rows on the way out, so these only matter for a tab left open across the
// change — but a complaint whose status tag fell back to "Received" would read as if the work had
// never started.
const RETIRED_STATUSES = { 'In Progress': 'In Review', Reviewed: 'In Review' };

const statusCopy = (status) => (
  STATUS_COPY[RETIRED_STATUSES[status] || status] || STATUS_COPY.Open
);

// A saved concern is a fixed option, or the typed text where that option was "Other".
const displayConcern = (complaint) => {
  if (!complaint.concern_with) return '-';
  if (complaint.concern_with === 'Other') return complaint.concern_with_other || 'Other';
  return complaint.concern_with;
};

// dd/mm/yyyy, in IST, like every other date in the portals.
const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Contact = () => {
  const [concernWith, setConcernWith] = useState('');
  const [concernOther, setConcernOther] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(true);

  // The customer's own complaints, so the status they are emailed about is also here to look up.
  const loadComplaints = useCallback(async () => {
    const token = localStorage.getItem('customerToken');
    if (!token) { setComplaintsLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/complaints`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) setComplaints(result.data || []);
    } catch (err) {
      // The form above still works; an empty list is not worth an error banner over it.
    } finally {
      setComplaintsLoading(false);
    }
  }, []);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const contactInfo = [
    {
      icon: Phone,
      title: 'Phone',
      details: '+91 8500 010 111',
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
      details: '7-333/A/1, NRI Hospital Road',
      subtext: 'Mangalagiri, Guntur, 522503',
    },
    {
      icon: Clock,
      title: 'Business Hours',
      details: 'Monday - Saturday',
      subtext: '8:00 AM - 6:00 PM',
    },
  ];

  const submitComplaint = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!concernWith) {
      setFormError('Please select a concern');
      return;
    }
    if (concernWith === 'Other' && !concernOther.trim()) {
      setFormError('Please specify the concern');
      return;
    }
    if (!comments.trim()) {
      setFormError('Please describe the complaint');
      return;
    }

    const token = localStorage.getItem('customerToken');
    if (!token) {
      setFormError('Please log in to file a complaint');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          concern_with: concernWith,
          concern_with_other: concernWith === 'Other' ? concernOther.trim() : undefined,
          comments: comments.trim()
        })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitted(true);
        setConcernWith('');
        setConcernOther('');
        setComments('');
        loadComplaints();
      } else {
        setFormError(result.message || 'Failed to submit complaint');
      }
    } catch (err) {
      setFormError('Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-2';
  const autoGrowField = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Contact / Help
        </h1>
        <p className="text-gray-500">
          Get in touch with our support team
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-lg border border-gold-600/20 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Contact Information
          </h2>
          <div className="space-y-6">
            {contactInfo.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-gold-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <p className="text-gray-900">{item.details}</p>
                    <p className="text-sm text-gray-500">{item.subtext}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-2xl shadow-lg border border-gold-600/20 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Need Help?
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <h3 className="font-medium text-red-600 mb-2">Emergency?</h3>
              <p className="text-sm text-red-600/80 mb-3">
                For urgent maintenance issues, please call our emergency line
              </p>
              <a
                href="tel:+918500010111"
                className="inline-flex items-center space-x-2 text-red-600 font-medium hover:text-red-600 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>+91 8500 010 111</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* File a Complaint -- lands in the franchise partner's Marketing > Complaint Form list
          with property, zone, contact and phone filled from this account's profile. */}
      <div className="bg-white rounded-2xl shadow-lg border border-gold-600/20 p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          File a Complaint
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Tell us what went wrong and our team will get back to you.
        </p>

        {submitted ? (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Complaint submitted</p>
              <p className="text-sm text-emerald-700 mt-0.5">Our team has received your complaint and will reach out to you.</p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-800 underline"
              >
                File another complaint
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitComplaint}>
            {formError && (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            <div className="mb-5">
              <label className={labelCls}>
                Concern With <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {CONCERN_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="customer-concern"
                      checked={concernWith === option}
                      onChange={() => setConcernWith(option)}
                      className="w-4 h-4 border-gray-300 text-gold-600 focus:ring-gold-500/30 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-900">{option === 'Other' ? 'Other:' : option}</span>
                  </label>
                ))}
              </div>
              {/* text-gray-900 and bg-white are not decoration on the box below: this
                  portal's body text is #f1f5f9 on a near-black background (index.css), so a
                  white field that does not set its own colour renders near-white text on
                  white and what the customer types is invisible. Every other field on this
                  form takes those from inputCls; this one is sized differently and so
                  carries its own class list, which is how it was missed. */}
              {concernWith === 'Other' && (
                <textarea
                  ref={autoGrowField}
                  onInput={(e) => autoGrowField(e.currentTarget)}
                  value={concernOther}
                  onChange={(e) => setConcernOther(e.target.value)}
                  maxLength={255}
                  rows={1}
                  placeholder="Please specify"
                  className="mt-2 w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 resize-none overflow-hidden focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                />
              )}
            </div>

            <div className="mb-5">
              <label className={labelCls}>
                Comments <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={4000}
                rows={5}
                placeholder="Describe the complaint"
                className={`${inputCls} resize-y`}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#D4AF37] hover:bg-[#C9A227] text-charcoal-900 font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Your Complaints -- the same status the emails announce, so a customer who missed one can
          still see where their complaint stands. Complaints our team files about your property
          appear here too. The field notes stay with the service team. */}
      {(complaintsLoading || complaints.length > 0) && (
        <div className="bg-white rounded-2xl shadow-lg border border-gold-600/20 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Complaints</h2>
          <p className="text-sm text-gray-500 mb-6">
            We email you whenever one of these moves, and the latest status is always here
          </p>

          {complaintsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gold-600" />
              <span className="ml-2 text-sm text-gray-500">Loading your complaints...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {complaints.map((complaint) => {
                const copy = statusCopy(complaint.status);
                return (
                  <div key={complaint.id} className="p-4 border border-gray-200 rounded-xl">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{complaint.reference}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${copy.style}`}>
                            {copy.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 mt-1 [overflow-wrap:anywhere]">{displayConcern(complaint)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{copy.note}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">Filed {formatDate(complaint.created_at)}</p>
                        {complaint.closed_at ? (
                          <p className="text-xs text-emerald-700">Closed {formatDate(complaint.closed_at)}</p>
                        ) : complaint.status_updated_at ? (
                          <p className="text-xs text-gray-500">Updated {formatDate(complaint.status_updated_at)}</p>
                        ) : null}
                      </div>
                    </div>
                    {complaint.comments && (
                      <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] border-t border-gray-100 pt-2">
                        {complaint.comments}
                      </p>
                    )}
                  </div>
                );
              })}
              {complaints.length === 0 && (
                <div className="py-6 text-center">
                  <FileWarning className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">You have not filed any complaints yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Contact;
