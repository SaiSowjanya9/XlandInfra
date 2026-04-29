import { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Globe,
  MapPin,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createEmployee, checkDuplicateEmployee, getAvailableZonesForEmployee } from '../utils/employeeStore';
import { getZones } from '../utils/zoneStore';

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
  selectedZones: [],
  assignAllZones: false,
};

const AddEmployee = ({ admin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [allZones, setAllZones] = useState([]);
  const [availableZones, setAvailableZones] = useState([]);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = () => {
    const zones = getZones('active');
    setAllZones(zones);
    const available = getAvailableZonesForEmployee(zones);
    setAvailableZones(available);
  };

  const handleZoneToggle = (zoneName) => {
    const currentZones = formData.selectedZones;
    if (currentZones.includes(zoneName)) {
      setFormData({
        ...formData,
        selectedZones: currentZones.filter(z => z !== zoneName),
        assignAllZones: false
      });
    } else {
      setFormData({
        ...formData,
        selectedZones: [...currentZones, zoneName],
        assignAllZones: false
      });
    }
  };

  const handleAssignAllZones = () => {
    if (formData.assignAllZones) {
      setFormData({
        ...formData,
        selectedZones: [],
        assignAllZones: false
      });
    } else {
      setFormData({
        ...formData,
        selectedZones: availableZones.map(z => z.name),
        assignAllZones: true
      });
    }
  };

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

    // Check for duplicates
    const duplicateCheck = checkDuplicateEmployee(
      formData.email,
      formData.phone,
      formData.aadhaar.replace(/\s/g, '')
    );

    if (duplicateCheck.isDuplicate) {
      setErrors(prev => ({ ...prev, [duplicateCheck.field]: duplicateCheck.message }));
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
        assignedZones: formData.assignAllZones ? 'all' : formData.selectedZones,
        createdBy: admin?.username || 'system',
      };

      const result = createEmployee(employeeData);

      if (result.success) {
        setCreatedEmployee(result.data);
        setSubmitted(true);
      } else {
        setErrors(prev => ({ ...prev, [result.field || 'general']: result.message }));
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Employee Added Successfully!</h2>
          <p className="text-gray-500 mb-2">
            Employee ID: <span className="font-mono text-emerald-600">{createdEmployee.employeeId}</span>
          </p>
          <p className="text-gray-500 mb-6">
            {createdEmployee.name} has been registered in the system.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/employee/employee-details')}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              View Employee Details
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Add Another Employee
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/employee')}
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

        {/* Zone Assignment Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Zone Assignment</h2>
              <p className="text-sm text-gray-500">Assign zones to this employee (only unassigned zones are shown)</p>
            </div>
          </div>

          {availableZones.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No zones available</p>
              <p className="text-sm text-gray-400 mt-1">
                All zones are already assigned to other employees or no zones exist.
              </p>
            </div>
          ) : (
            <>
              {/* All Zones Option */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleAssignAllZones}
                  className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                    formData.assignAllZones
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      formData.assignAllZones ? 'bg-emerald-600' : 'bg-gray-200'
                    }`}>
                      <Check className={`w-5 h-5 ${formData.assignAllZones ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-medium ${formData.assignAllZones ? 'text-emerald-700' : 'text-gray-700'}`}>
                        All Zones
                      </p>
                      <p className="text-sm text-gray-500">
                        Assign this employee to all available zones ({availableZones.length} zones)
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Individual Zone Selection */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableZones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleZoneToggle(zone.name)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      formData.selectedZones.includes(zone.name)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${
                        formData.selectedZones.includes(zone.name) ? 'bg-emerald-600' : 'bg-gray-200'
                      }`}>
                        {formData.selectedZones.includes(zone.name) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className={`font-medium text-sm ${
                        formData.selectedZones.includes(zone.name) ? 'text-emerald-700' : 'text-gray-700'
                      }`}>
                        {zone.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {formData.selectedZones.length > 0 && !formData.assignAllZones && (
                <p className="mt-3 text-sm text-emerald-600">
                  {formData.selectedZones.length} zone(s) selected
                </p>
              )}
            </>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/employee')}
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

export default AddEmployee;
