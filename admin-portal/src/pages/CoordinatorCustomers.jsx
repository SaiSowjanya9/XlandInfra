import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Building2,
  Home,
  Store,
  Truck,
  Lock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Grid3X3,
  Layers,
  Loader2,
  Navigation,
  Trash2,
  Triangle,
  Map
} from 'lucide-react';
import GPSLocationCapture from '../components/common/GPSLocationCapture';

// Category options matching Admin Portal
const CATEGORIES = [
  {
    id: 'residential',
    name: 'Residential',
    icon: Home,
    color: 'bg-emerald-500',
    locked: false
  },
  {
    id: 'commercial',
    name: 'Commercial',
    icon: Store,
    color: 'bg-blue-500',
    locked: true
  }
];

// Entry types for Residential
const ENTRY_TYPES = [
  { id: 'GC', name: 'Gated Community', icon: Building2, color: 'bg-gradient-to-br from-blue-500 to-blue-600' },
  { id: 'APT', name: 'Apartment', icon: Home, color: 'bg-gradient-to-br from-emerald-500 to-emerald-600' },
  { id: 'VILLA', name: 'Villa', icon: Triangle, color: 'bg-gradient-to-br from-amber-500 to-amber-600' },
  { id: 'FLAT', name: 'Flat', icon: Grid3X3, color: 'bg-gradient-to-br from-cyan-500 to-cyan-600' },
  { id: 'PLOT', name: 'Plot', icon: Map, color: 'bg-gradient-to-br from-rose-500 to-rose-600' }
];

// Unit types for block details
const UNIT_TYPES = [
  { key: 'studio', label: 'Studio' },
  { key: 'oneBed', label: '1 Bed' },
  { key: 'twoBed', label: '2 Bed' },
  { key: 'threeBed', label: '3 Bed' },
  { key: 'fourBed', label: '4 Bed' }
];

// Property types per entry type
const PROPERTY_TYPES = {
  GC: ['Gated Community'],
  APT: ['Apartment'],
  VILLA: ['Villa'],
  PLOT: ['Plot'],
  FLAT: ['Flat']
};

// Country codes
const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' }
];

// Import division functions from fieldOptionsStore
import { getDivisions, addDivision as addDivisionToStore } from '../utils/fieldOptionsStore';

// Indian States in alphabetical order
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const CoordinatorCustomers = ({ user, defaultTab = 'list' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL-based step management
  const urlStep = searchParams.get('step');
  const urlType = searchParams.get('type');
  const urlCategory = searchParams.get('category');
  
  const [customers, setCustomers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // View states - 'list' or 'add'
  const [activeView, setActiveView] = useState(defaultTab);
  const [selectedCategory, setSelectedCategory] = useState(() => urlCategory || null);
  const [selectedEntryType, setSelectedEntryType] = useState(() => urlType || null);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  // Push initial history entry when page first loads
  useEffect(() => {
    if (!urlStep) {
      // If defaultTab is 'add', go to category selection, otherwise list
      navigate(defaultTab === 'add' ? '?step=category' : '?step=list', { replace: true });
    }
  }, []); // Only run once on mount
  
  // Sync state with URL when browser back/forward is used
  useEffect(() => {
    if (urlStep === 'form' && urlType) {
      setSelectedCategory(urlCategory || 'residential');
      setSelectedEntryType(urlType);
      setActiveView('add');
    } else if (urlStep === 'type' && urlCategory) {
      setSelectedCategory(urlCategory);
      setSelectedEntryType(null);
      setActiveView('add');
    } else if (urlStep === 'category') {
      setSelectedCategory(null);
      setSelectedEntryType(null);
      setActiveView('add');
    } else if (urlStep === 'list') {
      setSelectedCategory(null);
      setSelectedEntryType(null);
      setActiveView('list');
    } else if (!urlStep && defaultTab !== 'add') {
      // Only default to list if defaultTab is not 'add'
      setSelectedCategory(null);
      setSelectedEntryType(null);
      setActiveView('list');
    }
  }, [urlStep, urlType, urlCategory]);
  
  // Navigation helpers
  const handleSelectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    navigate(`?step=type&category=${categoryId}`);
  };
  
  const handleSelectEntryType = (typeId) => {
    setSelectedEntryType(typeId);
    navigate(`?step=form&category=${selectedCategory}&type=${typeId}`);
  };
  
  const [formData, setFormData] = useState({
    zone: '',
    areaName: '',
    division: '',
    propertyType: '',
    communityName: '',
    associationContacts: [{ name: '', email: '', phone: '', countryCode: '+91' }],
    numberOfBlocks: 1,
    unitsPerBlock: {},
    blockNames: {},
    blockUnitTypes: {},
    numberOfUnits: '',
    villaPlotNumber: '',
    blockInfo: '',
    blockNA: false,
    flatBlockInfo: '',
    flatBlockNA: false,
    plotNA: false,
    address: '',
    city: '',
    state: '',
    postalCode: '',
    landmark: '',
    mapLocation: { lat: null, lng: null, address: '' },
    notes: '',
    watchmanName: '',
    watchmanContact: ''
  });

  const [showAddressDetails, setShowAddressDetails] = useState(false);
  const [showZoneDropdown, setShowZoneDropdown] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [zoneSuggestions, setZoneSuggestions] = useState([]);
  const [areaSuggestions, setAreaSuggestions] = useState([]);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [divisions, setDivisions] = useState(() => getDivisions());
  const [showAddDivisionModal, setShowAddDivisionModal] = useState(false);
  const [newDivision, setNewDivision] = useState('');
  const formRef = useRef(null);

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/coordinator/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error('Fetch customers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/coordinator/properties', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data);
      }
    } catch (error) {
      console.error('Fetch properties error:', error);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await fetch('/api/coordinator/zones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setZones(result.data || []);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  const autoSaveZone = async (zoneName) => {
    if (!zoneName?.trim()) return;
    const exists = zones.some(z => z.name?.toLowerCase() === zoneName.toLowerCase());
    if (!exists) {
      try { await fetch('/api/coordinator/zones', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: zoneName.trim() }) }); } catch (e) {}
    }
  };

  const handleDeleteZone = async (zoneId, e) => {
    e.stopPropagation(); if (!window.confirm('Delete this zone?')) return;
    try { const res = await fetch(`/api/coordinator/zones/${zoneId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if ((await res.json()).success) fetchZones(); } catch (e) {}
  };

  useEffect(() => {
    fetchCustomers();
    fetchProperties();
    fetchZones();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setMessage({ type: '', text: '' });

    // Validate form
    if (!isFormValid()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setSubmitting(true);
    try {
      // Auto-save zone if new
      if (formData.zone) await autoSaveZone(formData.zone);
      
      const response = await fetch('/api/coordinator/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          entryType: selectedEntryType,
          category: selectedCategory
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Customer created successfully!' });
        resetForm();
        setSelectedEntryType(null);
        setSelectedCategory(null);
        // Redirect back to category selection for adding another customer
        setActiveView('add');
        navigate('?step=category');
        fetchCustomers();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create customer' });
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    const contact = formData.associationContacts[0];
    const basicValid = formData.zone.trim() && formData.areaName.trim() && 
                       formData.division && formData.propertyType && formData.communityName.trim();
    const contactValid = contact.name.trim() && contact.email.trim() && contact.phone.trim();
    const addressValid = formData.address.trim() && formData.city.trim() && 
                         formData.state.trim() && formData.postalCode.trim();

    // Entry type specific validation
    if (selectedEntryType === 'GC') {
      const blocksValid = formData.numberOfBlocks >= 1 && 
        Object.keys(formData.unitsPerBlock).length === formData.numberOfBlocks &&
        Object.values(formData.unitsPerBlock).every(u => u > 0);
      return basicValid && contactValid && addressValid && blocksValid;
    }
    
    if (selectedEntryType === 'APT') {
      const aptValid = (formData.blockNA || formData.blockInfo.trim()) && 
                       formData.numberOfUnits && formData.numberOfUnits > 0;
      return basicValid && contactValid && addressValid && aptValid;
    }
    
    if (selectedEntryType === 'VILLA') {
      const numberValid = formData.villaPlotNumber.trim();
      return basicValid && contactValid && addressValid && numberValid;
    }
    
    if (selectedEntryType === 'FLAT') {
      const flatNumberValid = formData.villaPlotNumber.trim();
      const flatBlockValid = formData.flatBlockNA || formData.flatBlockInfo.trim();
      return basicValid && contactValid && addressValid && flatNumberValid && flatBlockValid;
    }
    
    if (selectedEntryType === 'PLOT') {
      const plotValid = formData.plotNA || formData.villaPlotNumber.trim();
      return basicValid && contactValid && addressValid && plotValid;
    }

    return basicValid && contactValid && addressValid;
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone) => /^\d{10}$/.test(phone);

  const resetForm = () => {
    setFormData({
      zone: '',
      areaName: '',
      division: '',
      propertyType: '',
      communityName: '',
      associationContacts: [{ name: '', email: '', phone: '', countryCode: '+91' }],
      numberOfBlocks: 1,
      unitsPerBlock: {},
      blockNames: {},
      numberOfUnits: '',
      villaPlotNumber: '',
      blockInfo: '',
      blockNA: false,
      flatBlockInfo: '',
      flatBlockNA: false,
      plotNA: false,
      address: '',
      city: '',
      state: '',
      postalCode: '',
      landmark: '',
      mapLocation: { lat: null, lng: null, address: '' },
      notes: '',
      watchmanName: '',
      watchmanContact: ''
    });
    setCurrentStep(1);
    setShowAddressDetails(false);
    setAttemptedSubmit(false);
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateUnitsForBlock = (blockNum, units) => {
    setFormData(prev => ({
      ...prev,
      unitsPerBlock: { ...prev.unitsPerBlock, [blockNum]: units }
    }));
  };

  const updateBlockName = (blockNum, name) => {
    setFormData(prev => ({
      ...prev,
      blockNames: { ...prev.blockNames, [blockNum]: name }
    }));
  };

  const calculateTotalFlats = () => {
    return Object.values(formData.unitsPerBlock).reduce((sum, units) => sum + (parseInt(units) || 0), 0);
  };

  // Update unit type for a specific block
  const updateBlockUnitType = (blockNum, unitType, value) => {
    setFormData(prev => {
      const currentBlockUnits = prev.blockUnitTypes[blockNum] || {
        studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0
      };
      const updatedBlockUnits = {
        ...currentBlockUnits,
        [unitType]: parseInt(value) || 0
      };
      const totalUnitsForBlock = Object.values(updatedBlockUnits).reduce((sum, v) => sum + v, 0);
      return {
        ...prev,
        blockUnitTypes: { ...prev.blockUnitTypes, [blockNum]: updatedBlockUnits },
        unitsPerBlock: { ...prev.unitsPerBlock, [blockNum]: totalUnitsForBlock }
      };
    });
  };

  // Get unit type value for a block
  const getBlockUnitTypeValue = (blockNum, unitType) => {
    const val = formData.blockUnitTypes[blockNum]?.[unitType];
    return val === undefined || val === null || val === 0 ? '' : val;
  };

  const addAssociationContact = () => {
    setFormData(prev => ({
      ...prev,
      associationContacts: [...prev.associationContacts, { name: '', email: '', phone: '', countryCode: '+91' }]
    }));
  };

  const removeAssociationContact = (index) => {
    if (formData.associationContacts.length > 1) {
      setFormData(prev => ({
        ...prev,
        associationContacts: prev.associationContacts.filter((_, i) => i !== index)
      }));
    }
  };

  const updateAssociationContact = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      associationContacts: prev.associationContacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const goBack = () => {
    if (selectedEntryType) {
      setSelectedEntryType(null);
      resetForm();
      navigate(`?step=type&category=${selectedCategory}`);
    } else if (selectedCategory) {
      setSelectedCategory(null);
      navigate('?step=category');
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.client_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Customer List View
  if (activeView === 'list' && !selectedCategory) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-500 mt-1">{filteredCustomers.length} customers</p>
          </div>
          <button
            onClick={() => setActiveView('add')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-xl border border-gray-100">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
              <p className="text-gray-500 mt-2">Loading customers...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customers found</p>
              <button
                onClick={() => setActiveView('add')}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Add your first customer
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold">
                          {customer.name?.charAt(0).toUpperCase() || 'C'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name || customer.community_name}</p>
                        <p className="text-sm text-gray-500">{customer.email || customer.client_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{customer.phone}</p>
                      <p className="text-xs text-gray-400">{customer.property_type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Category Selection View (Add Customer)
  if (activeView === 'add' && !selectedCategory) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('list')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Customer</h1>
            <p className="text-gray-500 mt-1">Customer Creation Module</p>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Selection Card */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-12 shadow-sm">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
            <p className="text-gray-500 mt-2">Choose the customer category to proceed</p>
          </div>

          <div className="flex justify-center gap-8">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return category.locked ? (
                <div
                  key={category.id}
                  className="w-72 h-52 p-8 border border-gray-200 rounded-2xl bg-white relative cursor-not-allowed flex flex-col items-start justify-center shadow-sm"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">Coming Soon</span>
                  </div>
                  <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-5">
                    <Icon className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-400">{category.name}</p>
                </div>
              ) : (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category.id)}
                  className="w-72 h-52 p-8 border-2 border-teal-400 rounded-2xl hover:shadow-xl transition-all duration-200 bg-white shadow-sm group flex flex-col items-start justify-center"
                >
                  <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{category.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Entry Type Selection View (after selecting Residential)
  if (selectedCategory && !selectedEntryType) {
    return (
      <div className="space-y-6">
        {/* Header with Back to Categories */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Customer</h1>
            <p className="text-gray-500 mt-1">Customer Creation Module</p>
          </div>
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Categories
          </button>
        </div>

        {/* Entry Type Selection */}
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900">Select Entry Type</h2>
            <p className="text-gray-500 mt-1">Choose the type of customer data you want to enter</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-3xl mx-auto">
            {ENTRY_TYPES.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  onClick={() => handleSelectEntryType(entry.id)}
                  className="flex flex-col items-center p-4 md:p-5 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className={`w-11 h-11 md:w-12 md:h-12 ${entry.color} rounded-xl flex items-center justify-center mb-2 md:mb-3`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <p className="font-medium text-gray-900 text-xs md:text-sm text-center leading-tight">{entry.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Customer Creation Form (after selecting entry type)
  if (selectedEntryType) {
    const entryTypeInfo = ENTRY_TYPES.find(t => t.id === selectedEntryType);
    const hasError = attemptedSubmit && !isFormValid();

    const inputClass = (fieldError) =>
      `w-full px-3 py-2.5 border rounded-md transition-colors focus:ring-1 focus:outline-none text-sm ${
        fieldError
          ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
          : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
      }`;

    const selectClass = (fieldError) =>
      `w-full px-3 py-2.5 border rounded-md transition-colors focus:ring-1 focus:outline-none appearance-none bg-white text-sm ${
        fieldError
          ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
          : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
      }`;

    const FieldError = ({ show, message }) =>
      show ? <p className="text-xs text-red-500 mt-1">{message}</p> : null;

    return (
      <div className="space-y-6">
        {/* Header with Back button */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Create Customer</h1>
            <p className="text-gray-500 text-sm mt-1">
              {entryTypeInfo?.name} • Complete all required fields
            </p>
          </div>
          <button
            onClick={goBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors text-sm"
          >
            ← Back
          </button>
        </div>

        {/* Form Container */}
        <div className="max-w-3xl">
          <form ref={formRef} onSubmit={handleSubmit} className="bg-white border-l-4 border-l-blue-500 shadow-sm">
            
            {/* Property Information Section */}
            <div className="p-8 border-b border-gray-200">
              <h2 className="text-xl font-medium text-gray-800 mb-6">Property Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {/* Zone */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Zone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.zone}
                      onChange={(e) => updateFormData('zone', e.target.value)}
                      onFocus={() => setShowZoneDropdown(true)}
                      onBlur={() => setTimeout(() => setShowZoneDropdown(false), 400)}
                      className={inputClass(hasError && !formData.zone.trim())}
                      placeholder="Type or select zone..."
                    />
                    {showZoneDropdown && zones.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {zones.filter(z => z.name?.toLowerCase().includes(formData.zone.toLowerCase())).map(z => (
                          <div key={z.id || z.name} className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 ${formData.zone === z.name ? 'bg-blue-50' : ''}`}>
                            <button type="button" onMouseDown={() => { updateFormData('zone', z.name); setShowZoneDropdown(false); }}
                              className={`flex-1 text-left text-sm ${formData.zone === z.name ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{z.name}</button>
                            {z.id && !String(z.id).startsWith('custom-') && (
                              <button type="button" onMouseDown={(e) => handleDeleteZone(z.id, e)} className="p-1 text-red-400 hover:text-red-600 rounded"><span className="text-xs">✕</span></button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <FieldError show={hasError && !formData.zone.trim()} message="Zone is required" />
                </div>

                {/* Area Name */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Area Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.areaName}
                    onChange={(e) => updateFormData('areaName', e.target.value)}
                    className={inputClass(hasError && !formData.areaName.trim())}
                    placeholder="Type or select area name..."
                  />
                  <FieldError show={hasError && !formData.areaName.trim()} message="Area name is required" />
                </div>

                {/* Division with Add button */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Division <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={formData.division}
                        onChange={(e) => updateFormData('division', e.target.value)}
                        className={selectClass(hasError && !formData.division)}
                      >
                        <option value="">Select a division</option>
                        {divisions.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddDivisionModal(true)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  <FieldError show={hasError && !formData.division} message="Please select a division" />
                </div>

                {/* Property Type */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Property Type <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.propertyType}
                      onChange={(e) => updateFormData('propertyType', e.target.value)}
                      className={selectClass(hasError && !formData.propertyType)}
                    >
                      <option value="">Select a property type</option>
                      {PROPERTY_TYPES[selectedEntryType]?.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
                  </div>
                  <FieldError show={hasError && !formData.propertyType} message="Please select a property type" />
                </div>

                {/* Community Name - Full width */}
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Community Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.communityName}
                    onChange={(e) => updateFormData('communityName', e.target.value)}
                    className={inputClass(hasError && !formData.communityName.trim())}
                    placeholder="Enter community name"
                  />
                  <FieldError show={hasError && !formData.communityName.trim()} message="Community name is required" />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium text-gray-800">Contact Information</h2>
                <button
                  type="button"
                  onClick={addAssociationContact}
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              </div>

              {formData.associationContacts.map((contact, index) => {
                const nameError = hasError && contact.name.trim() === '';
                const emailError = hasError && (contact.email.trim() === '' || (contact.email.trim() !== '' && !isValidEmail(contact.email)));
                const phoneError = hasError && (contact.phone.trim() === '' || (contact.phone.trim() !== '' && !isValidPhone(contact.phone)));
                
                return (
                  <div key={index} className="mb-6 pb-6 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-600">Contact {index + 1}</span>
                      {formData.associationContacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAssociationContact(index)}
                          className="text-red-400 hover:text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1.5">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => updateAssociationContact(index, 'name', e.target.value)}
                          className={inputClass(nameError)}
                          placeholder="Contact name"
                        />
                        <FieldError show={nameError} message="Name is required" />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1.5">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateAssociationContact(index, 'email', e.target.value)}
                          className={inputClass(emailError)}
                          placeholder="example@email.com"
                        />
                        <FieldError show={hasError && contact.email.trim() === ''} message="Email is required" />
                        <FieldError show={hasError && contact.email.trim() !== '' && !isValidEmail(contact.email)} message="Please enter a valid email" />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-700 mb-1.5">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2 max-w-md">
                          <div className="w-16 flex-shrink-0 px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600">
                            +91
                          </div>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={contact.phone}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                              updateAssociationContact(index, 'phone', digits);
                            }}
                            className={`flex-1 ${inputClass(phoneError)}`}
                            placeholder="10-digit number"
                          />
                        </div>
                        <FieldError show={hasError && contact.phone.trim() === ''} message="Phone number is required" />
                        <FieldError show={hasError && contact.phone.trim() !== '' && !isValidPhone(contact.phone)} message="Phone number must be exactly 10 digits" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Watchman Information Section - Only for GC and APT */}
            {(selectedEntryType === 'GC' || selectedEntryType === 'APT') && (
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800 mb-6">
                  Watchman Information <span className="text-gray-400 text-sm font-normal">(Optional)</span>
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">Watchman Name</label>
                    <input
                      type="text"
                      value={formData.watchmanName}
                      onChange={(e) => updateFormData('watchmanName', e.target.value)}
                      className={inputClass(false)}
                      placeholder="Enter watchman name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">Watchman Contact</label>
                    <div className="flex gap-2">
                      <div className="w-16 flex-shrink-0 px-3 py-2.5 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-600 flex items-center justify-center">
                        +91
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={formData.watchmanContact}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          updateFormData('watchmanContact', digits);
                        }}
                        className={`flex-1 ${inputClass(false)}`}
                        placeholder="10-digit number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Block Details Section (for Gated Community) */}
            {selectedEntryType === 'GC' && (
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800 mb-6">Block Details</h2>
                
                <div className="space-y-5">
                  <div className="max-w-xs">
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Number of Blocks <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.numberOfBlocks || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateFormData('numberOfBlocks', val === '' ? '' : Math.max(1, parseInt(val) || 1));
                      }}
                      onBlur={(e) => {
                        if (!formData.numberOfBlocks || formData.numberOfBlocks < 1) {
                          updateFormData('numberOfBlocks', 1);
                        }
                      }}
                      className={inputClass(hasError && formData.numberOfBlocks < 1)}
                      placeholder="1"
                    />
                  </div>

                  {/* Units per Block with Unit Type Breakdown */}
                  <div className="space-y-6 mt-4">
                    {Array.from({ length: formData.numberOfBlocks || 1 }, (_, i) => i + 1).map(blockNum => {
                      const blockError = hasError && (!formData.unitsPerBlock[blockNum] || formData.unitsPerBlock[blockNum] <= 0);
                      const totalUnits = formData.unitsPerBlock[blockNum] || 0;
                      return (
                        <div key={blockNum} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          {/* Block Name and Units Row */}
                          <div className="flex gap-4 items-start mb-4">
                            <div className="w-40">
                              <label className="block text-xs text-gray-500 mb-1">Block Name</label>
                              <input
                                type="text"
                                value={formData.blockNames[blockNum] || ''}
                                onChange={(e) => updateBlockName(blockNum, e.target.value)}
                                className={inputClass(false)}
                                placeholder={`Block ${blockNum}`}
                              />
                            </div>
                            <div className="w-28">
                              <label className="block text-xs text-gray-500 mb-1">Units <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                min="0"
                                value={totalUnits}
                                readOnly
                                className={`${inputClass(blockError)} bg-gray-100 cursor-not-allowed`}
                                placeholder="0"
                              />
                              <FieldError show={blockError} message="Add units below" />
                            </div>
                          </div>
                          
                          {/* Unit Types Row */}
                          <div className="grid grid-cols-5 gap-3">
                            {UNIT_TYPES.map(unitType => (
                              <div key={unitType.key}>
                                <label className="block text-xs text-gray-500 mb-1">{unitType.label}</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={getBlockUnitTypeValue(blockNum, unitType.key)}
                                  onChange={(e) => updateBlockUnitType(blockNum, unitType.key, e.target.value)}
                                  className={inputClass(false)}
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {formData.numberOfBlocks >= 1 && calculateTotalFlats() > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md inline-block">
                      <span className="text-sm text-blue-700">Total Flats: <strong>{calculateTotalFlats()}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Apartment Details Section */}
            {selectedEntryType === 'APT' && (
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800 mb-6">Apartment Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <label className="block text-sm text-gray-700">
                        Block Information
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="blockNA"
                          checked={formData.blockNA}
                          onChange={(e) => updateFormData('blockNA', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="blockNA" className="text-sm text-gray-600">Not Applicable</label>
                      </div>
                    </div>
                    {!formData.blockNA && (
                      <>
                        <input
                          type="text"
                          value={formData.blockInfo}
                          onChange={(e) => updateFormData('blockInfo', e.target.value)}
                          className={inputClass(hasError && !formData.blockNA && formData.blockInfo.trim() === '')}
                          placeholder="Block A, Tower 1, etc."
                        />
                        <FieldError show={hasError && !formData.blockNA && formData.blockInfo.trim() === ''} message="Block info required (or mark N/A)" />
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Number of Units <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.numberOfUnits}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed"
                      placeholder=""
                    />
                    <FieldError show={hasError && (!formData.numberOfUnits || formData.numberOfUnits <= 0)} message="Add unit types below" />
                  </div>
                </div>

                {/* Unit Types for Apartment */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Unit Types</label>
                  <div className="grid grid-cols-5 gap-4">
                    {UNIT_TYPES.map(unitType => (
                      <div key={unitType.key}>
                        <label className="block text-xs text-gray-500 mb-1">{unitType.label}</label>
                        <input
                          type="number"
                          min="0"
                          value={getBlockUnitTypeValue('apt', unitType.key)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setFormData(prev => {
                              const currentUnits = prev.blockUnitTypes['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                              const updatedUnits = { ...currentUnits, [unitType.key]: val };
                              const totalUnits = Object.values(updatedUnits).reduce((sum, v) => sum + v, 0);
                              return {
                                ...prev,
                                blockUnitTypes: { ...prev.blockUnitTypes, apt: updatedUnits },
                                numberOfUnits: totalUnits
                              };
                            });
                          }}
                          className={inputClass(false)}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Villa Details Section */}
            {selectedEntryType === 'VILLA' && (
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800 mb-6">Villa Details</h2>
                
                <div className="max-w-md">
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Villa Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.villaPlotNumber}
                    onChange={(e) => updateFormData('villaPlotNumber', e.target.value)}
                    className={inputClass(hasError && !formData.villaPlotNumber.trim())}
                    placeholder="Enter villa number"
                  />
                  <FieldError show={hasError && !formData.villaPlotNumber.trim()} message="Villa number is required" />
                </div>
              </div>
            )}

            {/* Flat Details Section */}
            {selectedEntryType === 'FLAT' && (
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800 mb-6">Flat Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Flat Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.villaPlotNumber}
                      onChange={(e) => updateFormData('villaPlotNumber', e.target.value)}
                      className={inputClass(hasError && !formData.villaPlotNumber.trim())}
                      placeholder="Enter flat number"
                    />
                    <FieldError show={hasError && !formData.villaPlotNumber.trim()} message="Flat number is required" />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <label className="block text-sm text-gray-700">
                        Block Number
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="flatBlockNA"
                          checked={formData.flatBlockNA}
                          onChange={(e) => updateFormData('flatBlockNA', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="flatBlockNA" className="text-sm text-gray-600">Not Applicable</label>
                      </div>
                    </div>
                    {!formData.flatBlockNA && (
                      <>
                        <input
                          type="text"
                          value={formData.flatBlockInfo}
                          onChange={(e) => updateFormData('flatBlockInfo', e.target.value)}
                          className={inputClass(hasError && !formData.flatBlockNA && formData.flatBlockInfo.trim() === '')}
                          placeholder="Block A, Tower 1, etc."
                        />
                        <FieldError show={hasError && !formData.flatBlockNA && formData.flatBlockInfo.trim() === ''} message="Block info required (or mark N/A)" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Plot Details Section */}
            {selectedEntryType === 'PLOT' && (
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-800 mb-6">Plot Details</h2>
                
                <div className="max-w-md">
                  <div className="flex items-center gap-3 mb-1.5">
                    <label className="block text-sm text-gray-700">
                      Plot Number
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="plotNA"
                        checked={formData.plotNA}
                        onChange={(e) => updateFormData('plotNA', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="plotNA" className="text-sm text-gray-600">Not Applicable</label>
                    </div>
                  </div>
                  {!formData.plotNA && (
                    <>
                      <input
                        type="text"
                        value={formData.villaPlotNumber}
                        onChange={(e) => updateFormData('villaPlotNumber', e.target.value)}
                        className={inputClass(hasError && !formData.plotNA && !formData.villaPlotNumber.trim())}
                        placeholder="Enter plot number"
                      />
                      <FieldError show={hasError && !formData.plotNA && !formData.villaPlotNumber.trim()} message="Plot number required (or mark N/A)" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Address Section */}
            <div className="p-8 border-b border-gray-200">
              <h2 className="text-xl font-medium text-gray-800 mb-6">Address</h2>
              
              <div className="space-y-5">
                {/* Collapsible Address Header */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAddressDetails(!showAddressDetails)}
                    className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all duration-200 ${
                      showAddressDetails 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-5 h-5 ${showAddressDetails ? 'text-blue-600' : 'text-gray-500'}`} />
                      <div className="text-left">
                        <span className={`font-medium ${showAddressDetails ? 'text-blue-700' : 'text-gray-700'}`}>
                          Street, City, State, Postal Code
                        </span>
                        <span className="text-red-500 ml-1">*</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {showAddressDetails ? 'Click to collapse' : 'Click to expand and enter details'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${
                      showAddressDetails ? 'rotate-90 text-blue-600' : 'text-gray-400'
                    }`} />
                  </button>

                  {/* Expanded Address Fields */}
                  {showAddressDetails && (
                    <div className="mt-4 p-5 bg-white border border-gray-200 rounded-lg space-y-5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAddressDetails(false)}
                          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          Collapse
                        </button>
                      </div>

                      {/* Street Address */}
                      <div>
                        <label className="block text-sm text-gray-700 mb-1.5">
                          Street Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => updateFormData('address', e.target.value)}
                          className={inputClass(hasError && !formData.address.trim())}
                          placeholder="Enter street address"
                        />
                        <FieldError show={hasError && !formData.address.trim()} message="Address is required" />
                      </div>

                      {/* City */}
                      <div className="max-w-sm">
                        <label className="block text-sm text-gray-700 mb-1.5">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => updateFormData('city', e.target.value)}
                          className={inputClass(hasError && !formData.city.trim())}
                          placeholder="City name"
                        />
                        <FieldError show={hasError && !formData.city.trim()} message="City is required" />
                      </div>

                      {/* State and Postal Code */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1.5">
                            State <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.state}
                            onChange={(e) => updateFormData('state', e.target.value)}
                            className={inputClass(hasError && !formData.state.trim())}
                          >
                            <option value="">Select State</option>
                            {INDIAN_STATES.map(state => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </select>
                          <FieldError show={hasError && !formData.state.trim()} message="State is required" />
                        </div>

                        <div>
                          <label className="block text-sm text-gray-700 mb-1.5">
                            Postal Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.postalCode}
                            onChange={(e) => updateFormData('postalCode', e.target.value)}
                            className={inputClass(hasError && !formData.postalCode.trim())}
                            placeholder="Postal code"
                          />
                          <FieldError show={hasError && !formData.postalCode.trim()} message="Postal code is required" />
                        </div>
                      </div>

                      {/* Landmark */}
                      <div>
                        <label className="block text-sm text-gray-700 mb-1.5">
                          Landmark Reference <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={formData.landmark}
                          onChange={(e) => updateFormData('landmark', e.target.value)}
                          className={inputClass(false)}
                          placeholder="Near Central Park, Behind Mall, etc."
                        />
                      </div>
                    </div>
                  )}

                  {/* Show validation error if address fields not filled */}
                  {hasError && !showAddressDetails && (!formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.postalCode.trim()) && (
                    <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Please expand and fill in the address details
                    </p>
                  )}
                </div>

                {/* GPS Location Capture */}
                <div className="pt-4">
                  <GPSLocationCapture
                    value={formData.mapLocation}
                    onChange={(loc) => {
                      updateFormData('mapLocation', loc);
                      // Auto-populate address fields from captured location
                      if (loc.address) {
                        const parts = loc.address.split(', ');
                        if (parts.length >= 3 && !formData.city) {
                          updateFormData('city', parts[Math.floor(parts.length / 2)] || '');
                        }
                      }
                    }}
                    savedBy={user?.name || user?.email || 'Coordinator'}
                    showShareOption={false}
                  />
                </div>
              </div>
            </div>

            {/* Additional Notes Section */}
            <div className="p-8">
              <h2 className="text-xl font-medium text-gray-800 mb-6">Additional Notes</h2>
              
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">
                  Notes <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => updateFormData('notes', e.target.value)}
                  rows={4}
                  className={inputClass(false)}
                  placeholder="Enter any additional notes or comments"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="p-8 pt-0 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Property Entry'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Add Division Modal */}
        {showAddDivisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Division</h3>
              <button onClick={() => setShowAddDivisionModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <input
              type="text"
              value={newDivision}
              onChange={(e) => setNewDivision(e.target.value)}
              placeholder="Enter division name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddDivisionModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newDivision.trim() && !divisions.includes(newDivision.trim())) {
                    addDivisionToStore(newDivision.trim()); // Persist to store
                    setDivisions(getDivisions()); // Refresh from store
                    updateFormData('division', newDivision.trim());
                    setNewDivision('');
                    setShowAddDivisionModal(false);
                  }
                }}
                disabled={!newDivision.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Division
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  return null;
};

export default CoordinatorCustomers;
