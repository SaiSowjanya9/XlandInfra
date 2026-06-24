import { useState, useEffect } from 'react';
import { 
  Truck,
  MapPin,
  Users,
  User,
  Phone,
  IndianRupee,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Country codes with flag emojis
const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
];

// Service types
const SERVICE_TYPES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Cleaning',
  'Security',
  'Carpentry',
  'Painting',
  'Pest Control',
  'Landscaping',
  'General Maintenance'
];

// Initial form state
const initialFormState = {
  serviceType: '',
  serviceVerified: false,
  zone: '',
  areaName: '',
  division: '',
  ownerName: '',
  ownerMobile: '',
  ownerEmail: '',
  ownerAadhar: '',
  ownerCountryCode: '+91',
  managerName: '',
  managerMobile: '',
  managerEmail: '',
  managerCountryCode: '+91',
  pocName: '',
  pocMobile: '',
  pocEmail: '',
  pocCountryCode: '+91',
  ratePerVisit: '',
  coveragePerDay: ''
};

const FPAddVendor = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [createdVendor, setCreatedVendor] = useState(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [serviceTypes, setServiceTypes] = useState(SERVICE_TYPES);
  const [serviceTypeData, setServiceTypeData] = useState([]); // Full data with id, name, is_global
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceType, setNewServiceType] = useState('');

  // Zone & Area autocomplete
  const [zoneSuggestions, setZoneSuggestions] = useState([]);
  const [areaSuggestions, setAreaSuggestions] = useState([]);
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  
  // Division
  const [divisionSuggestions, setDivisionSuggestions] = useState([]);
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);
  const [showAddDivisionModal, setShowAddDivisionModal] = useState(false);
  const [newDivision, setNewDivision] = useState('');

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchZones = () => {
    fetch('/api/fp/zones', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(res => { if (res.success) setZoneSuggestions(res.data || []); }).catch(() => {});
  };

  const fetchDivisions = () => {
    fetch('/api/fp/divisions', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(res => { if (res.success) setDivisionSuggestions(res.data || []); }).catch(() => {});
  };

  const fetchServiceTypes = () => {
    fetch('/api/fp/service-types', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => { 
        if (res.success && res.data?.length > 0) {
          setServiceTypeData(res.data);
          setServiceTypes(res.data.map(s => s.name));
        }
      })
      .catch(() => {});
  };

  const handleDeleteServiceType = async (serviceId, serviceName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${serviceName}" service type?`)) return;
    try {
      const res = await fetch(`/api/fp/service-types/${serviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if ((await res.json()).success) {
        fetchServiceTypes();
        if (formData.serviceType === serviceName) {
          updateField('serviceType', '');
        }
      }
    } catch (e) {
      console.error('Error deleting service type:', e);
    }
  };

  useEffect(() => {
    fetchZones();
    fetchDivisions();
    fetchServiceTypes();
    fetch('/api/onboarding/suggestions/areas', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(res => { if (res.success) setAreaSuggestions(res.data || []); }).catch(() => {});
  }, [token]);

  const autoSaveZone = async (zoneName) => {
    if (!zoneName?.trim()) return;
    const exists = zoneSuggestions.some(z => z.name?.toLowerCase() === zoneName.toLowerCase());
    if (!exists) {
      try { await fetch('/api/fp/zones', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: zoneName.trim() }) }); } catch (e) {}
    }
  };

  const handleDeleteZone = async (zoneId, e) => {
    e.stopPropagation(); if (!window.confirm('Delete this zone?')) return;
    try { const res = await fetch(`/api/fp/zones/${zoneId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) fetchZones(); } catch (e) {}
  };

  const handleAddDivision = async () => {
    if (!newDivision.trim()) return;
    if (divisionSuggestions.some(d => d.name?.toLowerCase() === newDivision.trim().toLowerCase())) return;
    try {
      const res = await fetch('/api/fp/divisions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDivision.trim() })
      });
      if ((await res.json()).success) {
        fetchDivisions();
        updateField('division', newDivision.trim());
        setNewDivision('');
        setShowAddDivisionModal(false);
      }
    } catch (e) { console.error('Error adding division:', e); }
  };

  const handleDeleteDivision = async (divisionId, e) => {
    e.stopPropagation(); if (!window.confirm('Delete this division?')) return;
    try { const res = await fetch(`/api/fp/divisions/${divisionId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) fetchDivisions(); } catch (e) {}
  };

  const filteredZones = zoneSuggestions.filter(z => z.name?.toLowerCase().includes((formData.zone || '').toLowerCase()));
  const filteredDivisions = divisionSuggestions.filter(d => d.name?.toLowerCase().includes((formData.division || '').toLowerCase()));
  const filteredAreas = areaSuggestions.filter(a =>
    a.toLowerCase().includes((formData.areaName || '').toLowerCase())
  );
  const filteredServices = serviceTypeData.filter(s =>
    s.name?.toLowerCase().includes((formData.serviceType || '').toLowerCase())
  );

  const handleAddServiceType = async () => {
    if (!newServiceType.trim()) return;
    if (serviceTypes.some(s => s.toLowerCase() === newServiceType.trim().toLowerCase())) {
      return; // Already exists
    }
    
    try {
      const response = await fetch('/api/fp/service-types', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newServiceType.trim() })
      });
      const result = await response.json();
      if (result.success) {
        setServiceTypes([...serviceTypes, newServiceType.trim()]);
        updateField('serviceType', newServiceType.trim());
        setNewServiceType('');
        setShowAddServiceModal(false);
      }
    } catch (error) {
      console.error('Error adding service type:', error);
      // Still add locally if API fails
      setServiceTypes([...serviceTypes, newServiceType.trim()]);
      updateField('serviceType', newServiceType.trim());
      setNewServiceType('');
      setShowAddServiceModal(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.serviceType) newErrors.serviceType = 'Service type is required';
    if (!formData.zone) newErrors.zone = 'Zone is required';
    if (!formData.areaName.trim()) newErrors.areaName = 'Area name is required';
    
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
    if (!formData.ownerMobile.trim()) newErrors.ownerMobile = 'Owner mobile is required';
    if (!formData.ownerEmail.trim()) newErrors.ownerEmail = 'Owner email is required';
    if (!formData.ownerAadhar.trim()) newErrors.ownerAadhar = 'Aadhar number is required';
    else if (!/^\d{12}$/.test(formData.ownerAadhar.replace(/\s/g, ''))) {
      newErrors.ownerAadhar = 'Aadhar must be 12 digits';
    }
    
    if (!formData.ratePerVisit) newErrors.ratePerVisit = 'Rate per visit is required';
    if (!formData.coveragePerDay) newErrors.coveragePerDay = 'Coverage per day is required';
    
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
      // Auto-save zone if new
      if (formData.zone) await autoSaveZone(formData.zone);
      
      const response = await fetch('/api/fp/vendors', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          createdBy: user?.username || 'FP',
          createdAt: new Date().toISOString()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setCreatedVendor(result.data);
        setSubmitted(true);
      } else {
        alert(result.message || 'Failed to add vendor');
      }
    } catch (error) {
      console.error('Error saving vendor:', error);
      alert('Failed to save vendor. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setSubmitted(false);
    setCreatedVendor(null);
    setErrors({});
  };

  // Success Screen
  if (submitted && createdVendor) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vendor Added Successfully!</h2>
          <p className="text-gray-500 mb-2">Vendor ID: <span className="font-mono text-emerald-600">{createdVendor.vendorId || createdVendor.vendor_id}</span></p>
          <p className="text-gray-500 mb-6">
            {formData.ownerName} has been registered as a {formData.serviceType} vendor.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/fp/vendors')}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              View Vendor Details
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Add Another Vendor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/fp')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Add New Vendor</h1>
        <p className="text-gray-500 text-sm mt-1">Register a new service provider in the system</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Service Information</h2>
              <p className="text-sm text-gray-500">Select the type of service this vendor provides</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Type */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Service Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.serviceType}
                    onChange={(e) => {
                      updateField('serviceType', e.target.value);
                      setShowServiceDropdown(true);
                    }}
                    onFocus={() => setShowServiceDropdown(true)}
                    onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                    placeholder="Select service type..."
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:outline-none ${
                      errors.serviceType ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {showServiceDropdown && filteredServices.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredServices.map(s => (
                        <div
                          key={s.id || s.name}
                          className={`flex items-center justify-between px-3 py-2 hover:bg-amber-50 transition-colors cursor-pointer ${
                            formData.serviceType === s.name ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          <span
                            onMouseDown={() => {
                              updateField('serviceType', s.name);
                              setShowServiceDropdown(false);
                            }}
                            className="flex-1 text-sm"
                          >
                            {s.name}
                          </span>
                          {s.id && (
                            <button
                              type="button"
                              onMouseDown={(e) => handleDeleteServiceType(s.id, s.name, e)}
                              className="ml-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete service type"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(true)}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  + Add
                </button>
              </div>
              {errors.serviceType && <p className="text-xs text-red-500 mt-1">{errors.serviceType}</p>}
            </div>

            </div>
        </div>

        {/* Location Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Location & Division</h2>
              <p className="text-sm text-gray-500">Assign vendor to operational zone and division</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Zone */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zone <span className="text-red-500">*</span></label>
              <input type="text" value={formData.zone}
                onChange={(e) => { updateField('zone', e.target.value); setShowZoneDropdown(true); }}
                onFocus={() => setShowZoneDropdown(true)} onBlur={() => setTimeout(() => setShowZoneDropdown(false), 200)}
                placeholder="Type or select zone..."
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none ${errors.zone ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
              {showZoneDropdown && filteredZones.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredZones.map(z => (
                    <div key={z.id || z.name} className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 ${formData.zone === z.name ? 'bg-blue-50' : ''}`}>
                      <button type="button" onMouseDown={() => { updateField('zone', z.name); setShowZoneDropdown(false); }}
                        className={`flex-1 text-left text-sm ${formData.zone === z.name ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{z.name}</button>
                      {z.id && !String(z.id).startsWith('custom-') && (
                        <button type="button" onMouseDown={(e) => handleDeleteZone(z.id, e)} className="p-1 text-red-400 hover:text-red-600 rounded"><span className="text-xs">✕</span></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {errors.zone && <p className="text-xs text-red-500 mt-1">{errors.zone}</p>}
            </div>

            {/* Area Name */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Area Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.areaName}
                onChange={(e) => {
                  updateField('areaName', e.target.value);
                  setShowAreaDropdown(true);
                }}
                onFocus={() => setShowAreaDropdown(true)}
                onBlur={() => setTimeout(() => setShowAreaDropdown(false), 200)}
                placeholder="Type or select area name..."
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none ${
                  errors.areaName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {showAreaDropdown && filteredAreas.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredAreas.map(a => (
                    <button
                      key={a}
                      type="button"
                      onMouseDown={() => {
                        updateField('areaName', a);
                        setShowAreaDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                        formData.areaName === a ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
              {errors.areaName && <p className="text-xs text-red-500 mt-1">{errors.areaName}</p>}
            </div>

            {/* Division */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Division</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type="text" value={formData.division}
                    onChange={(e) => { updateField('division', e.target.value); setShowDivisionDropdown(true); }}
                    onFocus={() => setShowDivisionDropdown(true)} onBlur={() => setTimeout(() => setShowDivisionDropdown(false), 200)}
                    placeholder="Select division..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none" />
                  {showDivisionDropdown && filteredDivisions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredDivisions.map(d => (
                        <div key={d.id || d.name} className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 ${formData.division === d.name ? 'bg-blue-50' : ''}`}>
                          <button type="button" onMouseDown={() => { updateField('division', d.name); setShowDivisionDropdown(false); }}
                            className={`flex-1 text-left text-sm ${formData.division === d.name ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{d.name}</button>
                          {d.id && (
                            <button type="button" onMouseDown={(e) => handleDeleteDivision(d.id, e)} className="p-1 text-red-400 hover:text-red-600 rounded"><X className="w-3 h-3" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setShowAddDivisionModal(true)} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ Add</button>
              </div>
            </div>
          </div>
        </div>

        {/* Owner Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Owner Details</h2>
              <p className="text-sm text-gray-500">Vendor owner's information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Owner Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => updateField('ownerName', e.target.value)}
                placeholder="Enter owner's full name"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:outline-none ${
                  errors.ownerName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.ownerName && <p className="text-xs text-red-500 mt-1">{errors.ownerName}</p>}
            </div>

            {/* Owner Mobile */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.ownerCountryCode}
                  onChange={(e) => updateField('ownerCountryCode', e.target.value)}
                  className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:outline-none"
                >
                  {COUNTRY_CODES.map(cc => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.ownerMobile}
                  onChange={(e) => updateField('ownerMobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Mobile number"
                  className={`flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:outline-none ${
                    errors.ownerMobile ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.ownerMobile && <p className="text-xs text-red-500 mt-1">{errors.ownerMobile}</p>}
            </div>

            {/* Owner Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => updateField('ownerEmail', e.target.value)}
                placeholder="owner@example.com"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:outline-none ${
                  errors.ownerEmail ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.ownerEmail && <p className="text-xs text-red-500 mt-1">{errors.ownerEmail}</p>}
            </div>

            {/* Owner Aadhar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Aadhar Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ownerAadhar}
                onChange={(e) => updateField('ownerAadhar', e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="XXXX XXXX XXXX"
                maxLength={12}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500 focus:outline-none font-mono ${
                  errors.ownerAadhar ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.ownerAadhar && <p className="text-xs text-red-500 mt-1">{errors.ownerAadhar}</p>}
            </div>
          </div>
        </div>

        {/* Primary/Manager Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Primary / Manager Contact</h2>
              <p className="text-sm text-gray-500">Authorized representative details (optional)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={formData.managerName}
                onChange={(e) => updateField('managerName', e.target.value)}
                placeholder="Manager name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.managerEmail}
                onChange={(e) => updateField('managerEmail', e.target.value)}
                placeholder="manager@example.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile</label>
              <div className="flex gap-2">
                <select
                  value={formData.managerCountryCode}
                  onChange={(e) => updateField('managerCountryCode', e.target.value)}
                  className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:outline-none"
                >
                  {COUNTRY_CODES.map(cc => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.managerMobile}
                  onChange={(e) => updateField('managerMobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Mobile"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Point of Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Point of Contact</h2>
              <p className="text-sm text-gray-500">Day-to-day operational contact (optional)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={formData.pocName}
                onChange={(e) => updateField('pocName', e.target.value)}
                placeholder="Contact person name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.pocEmail}
                onChange={(e) => updateField('pocEmail', e.target.value)}
                placeholder="poc@example.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile</label>
              <div className="flex gap-2">
                <select
                  value={formData.pocCountryCode}
                  onChange={(e) => updateField('pocCountryCode', e.target.value)}
                  className="w-24 px-2 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-500 focus:outline-none"
                >
                  {COUNTRY_CODES.map(cc => (
                    <option key={cc.code} value={cc.code}>{cc.flag} {cc.code}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formData.pocMobile}
                  onChange={(e) => updateField('pocMobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Mobile"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rate & Coverage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Rate & Coverage</h2>
              <p className="text-sm text-gray-500">Service pricing and capacity details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rate Per Visit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Rate Per Visit (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={formData.ratePerVisit}
                  onChange={(e) => updateField('ratePerVisit', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={`w-full pl-8 pr-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none ${
                    errors.ratePerVisit ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.ratePerVisit && <p className="text-xs text-red-500 mt-1">{errors.ratePerVisit}</p>}
              <p className="text-xs text-gray-400 mt-1">Service charge for each visit or job</p>
            </div>

            {/* Coverage Per Day */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Coverage Per Day <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.coveragePerDay}
                onChange={(e) => updateField('coveragePerDay', e.target.value)}
                placeholder="0"
                min="1"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 focus:outline-none ${
                  errors.coveragePerDay ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {errors.coveragePerDay && <p className="text-xs text-red-500 mt-1">{errors.coveragePerDay}</p>}
              <p className="text-xs text-gray-400 mt-1">Maximum visits/jobs vendor can handle per day</p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/fp/vendors')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Add Vendor'
            )}
          </button>
        </div>
      </form>

      {/* Add Service Type Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Add New Service Type</h2>
                <button 
                  onClick={() => { setShowAddServiceModal(false); setNewServiceType(''); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <span className="text-xl">&times;</span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Type Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newServiceType}
                onChange={(e) => setNewServiceType(e.target.value)}
                placeholder="Enter service type name"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddServiceType()}
              />
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddServiceModal(false); setNewServiceType(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddServiceType}
                disabled={!newServiceType.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Service Type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Division Modal */}
      {showAddDivisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Add New Division</h2>
                <button onClick={() => { setShowAddDivisionModal(false); setNewDivision(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <span className="text-xl">&times;</span>
                </button>
              </div>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Division Name <span className="text-red-500">*</span></label>
              <input type="text" value={newDivision} onChange={(e) => setNewDivision(e.target.value)}
                placeholder="Enter division name" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddDivision()} />
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowAddDivisionModal(false); setNewDivision(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleAddDivision} disabled={!newDivision.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Add Division</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FPAddVendor;
