import { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Send,
  Key,
  MapPin,
  ChevronDown,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const EMPLOYEE_ROLES = [
  { value: 'manager', label: 'Manager', description: 'Manages work orders, vendors, estimates, and schedules' },
  { value: 'coordinator', label: 'Coordinator', description: 'Coordinates field operations and team assignments' },
  { value: 'supervisor', label: 'Supervisor', description: 'Supervises field employees and monitors work progress' },
  { value: 'executive', label: 'Executive', description: 'Executes field tasks and reports work status' },
];

const initialFormState = {
  role: 'manager',
  name: '',
  username: '',
  email: '',
  phone: '',
};

const FPAddEmployee = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [createdEmployee, setCreatedEmployee] = useState(null);

  const token = getAuthToken();

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

  const validateUsername = (username) => {
    const regex = /^[a-z0-9_]+$/;
    return regex.test(username) && username.length >= 3;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.role) {
      newErrors.role = 'Please select a role';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (!validateUsername(formData.username)) {
      newErrors.username = 'Username must be lowercase letters, numbers, or underscores (min 3 chars)';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
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
        role: formData.role,
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || null,
        createdBy: user?.username || 'FP',
      };

      const response = await fetch(`${API_BASE}/api/fp/employees`, {
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

  const selectedRole = EMPLOYEE_ROLES.find(r => r.value === formData.role);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h1 className="text-xl font-semibold text-gray-900">Add Employee</h1>
          <button
            onClick={() => navigate('/fp/employees')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.general && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          {/* Employee Role Section */}
          <div className="border border-gray-200 rounded-xl p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee Role <span className="text-red-500">*</span>
            </label>
            <div className="relative w-full md:w-1/2">
              <select
                value={formData.role}
                onChange={(e) => updateField('role', e.target.value)}
                className={`w-full px-4 py-3 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer ${
                  errors.role ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                {EMPLOYEE_ROLES.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            {selectedRole && (
              <p className="text-sm text-gray-500 mt-2">{selectedRole.description}</p>
            )}
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>

          {/* Basic Information Section */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="John Doe"
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none ${
                    errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="johndoe"
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none ${
                    errors.username ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  placeholder="9876543210"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100"></div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/fp/employees')}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Employee'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FPAddEmployee;
