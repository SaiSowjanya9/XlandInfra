import { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  MapPin,
  Send,
  Key,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
];

const initialFormState = {
  name: '',
  phone: '',
  countryCode: '+91',
  email: '',
  aadhaar: '',
};

const FPAddEmployee = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [createdEmployee, setCreatedEmployee] = useState(null);

  const token = localStorage.getItem('pm_auth_token');

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePhone = (phone) => {
    const regex = /^\d{10}$/;
    return regex.test(phone);
  };

  const validateAadhaar = (aadhaar) => {
    const regex = /^\d{12}$/;
    return regex.test(aadhaar.replace(/\s/g, ''));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Employee name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.aadhaar.trim()) {
      newErrors.aadhaar = 'Aadhaar number is required';
    } else if (!validateAadhaar(formData.aadhaar)) {
      newErrors.aadhaar = 'Aadhaar must be 12 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const employeeData = {
        name: formData.name.trim(),
        phone: formData.phone,
        countryCode: formData.countryCode,
        email: formData.email.trim().toLowerCase(),
        aadhaar: formData.aadhaar.replace(/\s/g, ''),
        assignedZones: [],
        createdBy: user?.username || 'FP',
        createdAt: new Date().toISOString(),
      };

      const response = await fetch('/api/fp/employees', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      });

      const result = await response.json();

      if (result.success) {
        setCreatedEmployee(result.data);
        setSubmitted(true);
      } else {
        setErrors(prev => ({ ...prev, [result.field || 'general']: result.message || 'Failed to create employee' }));
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      setErrors(prev => ({ ...prev, general: 'Failed to create employee. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setSubmitted(false);
    setCreatedEmployee(null);
    setErrors({});
  };

  // Success Screen
  if (submitted && createdEmployee) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto p-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Employee Account Created!</h2>
          <p className="text-gray-500 mb-2">
            Employee ID: <span className="font-mono text-emerald-600">{createdEmployee.employeeId || createdEmployee.employee_id}</span>
          </p>
          <p className="text-gray-500 mb-4">
            {formData.name} has been registered in the system.
          </p>
          
          {/* Email Notification Status */}
          <div className={`rounded-xl border p-4 mb-4 ${
            createdEmployee.emailSent 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                createdEmployee.emailSent ? 'bg-blue-100' : 'bg-amber-100'
              }`}>
                {createdEmployee.emailSent 
                  ? <Send className="w-5 h-5 text-blue-600" />
                  : <AlertCircle className="w-5 h-5 text-amber-600" />
                }
              </div>
              <div className="text-left">
                <h3 className={`font-semibold ${createdEmployee.emailSent ? 'text-blue-800' : 'text-amber-800'}`}>
                  {createdEmployee.emailSent ? 'Login Credentials Sent!' : 'Email Delivery Issue'}
                </h3>
                <p className={`text-sm mt-1 ${createdEmployee.emailSent ? 'text-blue-700' : 'text-amber-700'}`}>
                  {createdEmployee.emailSent 
                    ? `A welcome email with temporary password and login instructions has been sent to ${createdEmployee.email}`
                    : 'Account created but email could not be delivered. Please share login credentials manually.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Login Instructions Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-left">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-800">Employee Login Instructions</h3>
            </div>
            <ol className="text-sm text-gray-600 space-y-2 ml-7 list-decimal">
              <li>Employee will receive an email with temporary password</li>
              <li>Login at the <strong>Employee Portal</strong> using email and temp password</li>
              <li>System will prompt to create a new secure password</li>
              <li>After password setup, account is fully activated</li>
            </ol>
          </div>
          
          {/* Zone Assignment Info */}
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
            <MapPin className="w-4 h-4 inline mr-1" />
            Zone assignment can be done in <strong>Employee Zone Management</strong>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/fp/employees/zones')}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Assign Zones
            </button>
            <button
              onClick={() => navigate('/fp/employees')}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              View Employee Details
            </button>
          </div>
          <button
            onClick={handleReset}
            className="mt-4 px-6 py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            + Add Another Employee
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/fp')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Add New Employee</h1>
        <p className="text-gray-500 text-sm mt-1">Register a new employee in the system</p>
      </div>

      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
              <p className="text-sm text-gray-500">Employee's basic details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter employee's full name"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.countryCode}
                  onChange={(e) => updateField('countryCode', e.target.value)}
                  className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                >
                  {COUNTRY_CODES.map(cc => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className={`flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none ${
                    errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="employee@example.com"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Aadhaar */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Aadhaar Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.aadhaar}
                onChange={(e) => updateField('aadhaar', e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="XXXX XXXX XXXX"
                maxLength={12}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none font-mono ${
                  errors.aadhaar ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.aadhaar && <p className="text-xs text-red-500 mt-1">{errors.aadhaar}</p>}
              <p className="text-xs text-gray-400 mt-1">Aadhaar number must be unique for each employee</p>
            </div>
          </div>
        </div>

        {/* Zone Assignment Info */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-medium text-amber-800">Zone Assignment</h3>
              <p className="text-sm text-amber-700 mt-0.5">
                Zones can be assigned after employee creation in the <strong>Employee Zone Management</strong> section.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/fp/employees')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Add Employee'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FPAddEmployee;
