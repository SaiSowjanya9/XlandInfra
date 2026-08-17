import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const EMPLOYEE_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'executive', label: 'Executive' },
  { value: 'field_staff', label: 'Field Staff' },
];

const FPEditEmployee = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    countryCode: '+91',
    aadhaar: '',
    role: 'field_staff',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  const token = getAuthToken();

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const response = await fetch(`/api/fp/employees/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success && result.data) {
          const emp = result.data;
          setFormData({
            firstName: emp.first_name || '',
            email: emp.email || '',
            phone: emp.phone || '',
            countryCode: emp.country_code || '+91',
            aadhaar: emp.aadhaar || '',
            role: emp.role || 'field_staff',
          });
        } else {
          setMessage({ type: 'error', text: 'Employee not found' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to load employee data' });
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, token]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`/api/fp/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Employee updated successfully!' });
        setTimeout(() => navigate('/fp/employees'), 1500);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update employee' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update employee' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/fp/employees')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Edit Employee</h1>
          <p className="text-gray-500 text-sm mt-1">Update employee information</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <select
            value={formData.role}
            onChange={(e) => updateField('role', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {EMPLOYEE_ROLES.map(role => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>

        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.firstName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter first name"
            />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter email address"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="w-16 px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm">
              +91
            </div>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              className={`flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.phone ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter phone number"
              maxLength={10}
            />
          </div>
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/fp/employees')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FPEditEmployee;
