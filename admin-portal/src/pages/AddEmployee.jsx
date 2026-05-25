import { useState } from 'react';
import {
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  MapPin,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { checkDuplicateEmployee } from '../utils/employeeStore';

// Employee roles with descriptions
const EMPLOYEE_ROLES = {
  manager: {
    label: 'Manager',
    description: 'Manages work orders, vendors, estimates, and schedules'
  },
  coordinator: {
    label: 'Coordinator',
    description: 'Coordinates daily operations and team activities'
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Supervises field staff and ensures quality standards'
  },
  executive: {
    label: 'Executive',
    description: 'Handles customer interactions and field work execution'
  }
};

const initialFormState = {
  role: 'manager',
  fullName: '',
  username: '',
  email: '',
  phone: '',
};

const AddEmployee = ({ admin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [createdEmployee, setCreatedEmployee] = useState(null);

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

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (!validateUsername(formData.username)) {
      newErrors.username = 'Username must be lowercase letters, numbers, underscores only (min 3 chars)';
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

    // Check for duplicates (email and username)
    const duplicateCheck = checkDuplicateEmployee(
      formData.email,
      formData.phone || '',
      formData.username
    );

    if (duplicateCheck.isDuplicate) {
      setErrors(prev => ({ ...prev, [duplicateCheck.field]: duplicateCheck.message }));
      return;
    }

    setSubmitting(true);

    try {
      // Parse full name into first and last name
      const nameParts = formData.fullName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      const employeeData = {
        firstName,
        lastName,
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || '',
        role: formData.role,
        sendEmail: true, // Send welcome email with credentials
      };

      // Call backend API to create employee
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify(employeeData)
      });

      const result = await response.json();

      if (result.success) {
        setCreatedEmployee({
          employeeId: result.data.userId,
          fullName: formData.fullName.trim(),
          email: result.data.email,
          role: result.data.role,
          emailSent: result.data.emailSent
        });
        setSubmitted(true);
      } else {
        setErrors(prev => ({ ...prev, general: result.message }));
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

  if (submitted && createdEmployee) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Employee Created Successfully!</h2>
          <p className="text-gray-500 mb-2">
            Employee ID: <span className="font-mono text-emerald-600">{createdEmployee.employeeId}</span>
          </p>
          <p className="text-gray-500 mb-4">
            <strong>{createdEmployee.fullName}</strong> ({EMPLOYEE_ROLES[createdEmployee.role]?.label}) has been added.
          </p>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
            <MapPin className="w-4 h-4 inline mr-1" />
            Zone assignment can be done in <strong>Employee Zone Management</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/employee/employee-zone-management')}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Assign Zones
            </button>
            <button
              onClick={() => navigate('/employee/employee-details')}
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
    <div className="max-w-2xl mx-auto">
      {/* Modal-style Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Add Employee</h1>
          <button
            onClick={() => navigate('/employee/employee-details')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {errors.general && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Employee Role Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => updateField('role', e.target.value)}
              className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none bg-white"
            >
              {Object.entries(EMPLOYEE_ROLES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-2">
              {EMPLOYEE_ROLES[formData.role].description}
            </p>
          </div>

          {/* Basic Information Section */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Basic Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="John Doe"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none ${
                    errors.fullName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
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
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none ${
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
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none ${
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
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Note about temporary password */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <span className="font-semibold text-blue-800">Note:</span> A temporary password will be auto-generated and sent to the employee's email address. They will be required to change it on first login.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/employee/employee-details')}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
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

export default AddEmployee;
