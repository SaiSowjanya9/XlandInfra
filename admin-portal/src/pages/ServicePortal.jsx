import { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Home, 
  TreePine,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  MapPin,
  FileText,
  Users,
  Layers,
  Grid3X3,
  Lock,
  Briefcase,
  Truck,
  Map,
  AlertCircle,
  Search,
  Navigation,
  Loader2,
  MapPinned,
  Globe,
  Building,
  Hash
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { saveProperty } from '../utils/propertyStore';

// Fix Leaflet default marker icon (broken in bundlers like Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Division options (A through K)
const DIVISIONS = [
  'Division A',
  'Division B',
  'Division C',
  'Division D',
  'Division E',
  'Division F',
  'Division G',
  'Division H',
  'Division I',
  'Division J',
  'Division K'
];

// Property Type options
const PROPERTY_TYPES = {
  GC: ['Gated Community'],
  APT: ['Apartment'],
  VILLA: ['Villa'],
  PLOT: ['Plot']
};

// Entry type configuration
const ENTRY_TYPES = [
  { 
    id: 'GC', 
    name: 'Gated Community', 
    icon: Building2, 
    color: 'bg-blue-500',
    description: 'For gated communities with multiple blocks and units'
  },
  { 
    id: 'APT', 
    name: 'Apartment', 
    icon: Home, 
    color: 'bg-green-500',
    description: 'For apartment buildings with optional block info'
  },
  { 
    id: 'VILLA', 
    name: 'Villas', 
    icon: TreePine, 
    color: 'bg-amber-500',
    description: 'For individual villa properties'
  },
  { 
    id: 'PLOT', 
    name: 'Plots', 
    icon: Map, 
    color: 'bg-rose-500',
    description: 'For residential or commercial plot numbers'
  }
];

// Step configurations for each entry type
const STEPS_CONFIG = {
  GC: [
    { id: 1, title: 'Zone Selection', icon: MapPin },
    { id: 2, title: 'Area Name', icon: FileText },
    { id: 3, title: 'Division', icon: Grid3X3 },
    { id: 4, title: 'Property Type', icon: Building2 },
    { id: 5, title: 'Community Name', icon: Home },
    { id: 6, title: 'Association / Client Details', icon: Users },
    { id: 7, title: 'Number of Blocks', icon: Layers },
    { id: 8, title: 'Units per Block', icon: Grid3X3 },
    { id: 9, title: 'Address & Location', icon: MapPin },
    { id: 10, title: 'Notes', icon: FileText }
  ],
  APT: [
    { id: 1, title: 'Zone Selection', icon: MapPin },
    { id: 2, title: 'Area Name', icon: FileText },
    { id: 3, title: 'Division', icon: Grid3X3 },
    { id: 4, title: 'Property Type', icon: Building2 },
    { id: 5, title: 'Community Name', icon: Home },
    { id: 6, title: 'Association / Client Details', icon: Users },
    { id: 7, title: 'Block Information', icon: Layers },
    { id: 8, title: 'Number of Units', icon: Grid3X3 },
    { id: 9, title: 'Address & Location', icon: MapPin },
    { id: 10, title: 'Notes', icon: FileText }
  ],
  VILLA: [
    { id: 1, title: 'Zone Selection', icon: MapPin },
    { id: 2, title: 'Area Name', icon: FileText },
    { id: 3, title: 'Division', icon: Grid3X3 },
    { id: 4, title: 'Property Type', icon: Building2 },
    { id: 5, title: 'Community Name', icon: Home },
    { id: 6, title: 'Association / Client Details', icon: Users },
    { id: 7, title: 'Villa Number', icon: Home },
    { id: 8, title: 'Address & Location', icon: MapPin },
    { id: 9, title: 'Notes', icon: FileText }
  ],
  PLOT: [
    { id: 1, title: 'Zone Selection', icon: MapPin },
    { id: 2, title: 'Area Name', icon: FileText },
    { id: 3, title: 'Division', icon: Grid3X3 },
    { id: 4, title: 'Property Type', icon: Building2 },
    { id: 5, title: 'Community Name', icon: Home },
    { id: 6, title: 'Association / Client Details', icon: Users },
    { id: 7, title: 'Plot Number', icon: Map },
    { id: 8, title: 'Address & Location', icon: MapPin },
    { id: 9, title: 'Notes', icon: FileText }
  ]
};

// Category options (middle layer)
const CATEGORIES = [
  {
    id: 'residential',
    name: 'Residential',
    icon: Home,
    color: 'bg-emerald-500',
    description: 'Residential properties including gated communities, apartments, and villas',
    locked: false
  },
  {
    id: 'commercial',
    name: 'Commercial',
    icon: Briefcase,
    color: 'bg-blue-500',
    description: 'Commercial properties and office spaces',
    locked: true
  },
  {
    id: 'vendor',
    name: 'Vendor',
    icon: Truck,
    color: 'bg-purple-500',
    description: 'Vendor and service provider onboarding',
    locked: true
  }
];

// Country codes with flag emojis
const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
  { code: '+65', flag: '🇸🇬', label: 'Singapore' },
  { code: '+81', flag: '🇯🇵', label: 'Japan' },
  { code: '+86', flag: '🇨🇳', label: 'China' },
  { code: '+49', flag: '🇩🇪', label: 'Germany' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
];

// Map sub-components (must be children of MapContainer)
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const data = await res.json();
        const addr = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onLocationSelect({ lat, lng, address: addr });
      } catch {
        onLocationSelect({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
      }
    }
  });
  return null;
};

const FlyToLocation = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, { duration: 1.2 });
    }
  }, [position?.[0], position?.[1]]);
  return null;
};

// Interactive map location picker with debounced autocomplete and live location
const MapLocationPicker = ({ value, onChange }) => {
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Debounced autocomplete: fires search after 400ms of inactivity
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
        );
        const data = await res.json();
        setSearchResults(data);
        setShowResults(data.length > 0);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearchQuery(result.display_name);
    setShowResults(false);
    setSearchResults([]);
    onChange({ lat, lng, address: result.display_name });
  };

  const handleMapClick = (location) => {
    setSearchQuery(location.address);
    setShowResults(false);
    onChange(location);
  };

  // Live location functionality using browser Geolocation API
  const handleGetLiveLocation = async () => {
    setLocationError('');
    setGettingLocation(true);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        // Update map marker position
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          const addr = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setSearchQuery(addr);
          onChange({ lat, lng, address: addr });
        } catch {
          onChange({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
        }
        setGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setLocationError(errorMessage);
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const markerPosition = value?.lat && value?.lng ? [value.lat, value.lng] : null;
  const mapCenter = markerPosition || [20.5937, 78.9629];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Location on Map <span className="text-red-500">*</span>
        </label>
        {/* Live Location Button */}
        <button
          type="button"
          onClick={handleGetLiveLocation}
          disabled={gettingLocation}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gettingLocation ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Getting Location...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Use Live Location
            </>
          )}
        </button>
      </div>

      {/* Location Error */}
      {locationError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {locationError}
        </div>
      )}

      {/* Search bar with autocomplete */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-500 focus:outline-none"
            placeholder="Start typing an address, city, or place..."
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectResult(result)}
                className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 leading-snug truncate">{result.display_name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {parseFloat(result.lat).toFixed(4)}, {parseFloat(result.lon).toFixed(4)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '320px' }}>
        <MapContainer
          center={mapCenter}
          zoom={markerPosition ? 16 : 5}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markerPosition && <Marker position={markerPosition} />}
          <MapClickHandler onLocationSelect={handleMapClick} />
          <FlyToLocation position={markerPosition} />
        </MapContainer>
      </div>

      {/* Pinned location info */}
      {value?.address && (
        <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-xl">
          <MapPinned className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-700">Pinned Location</p>
            <p className="text-xs text-green-600 mt-0.5 break-words">{value.address}</p>
            {value.lat && (
              <p className="text-[10px] text-green-500 mt-0.5 font-mono">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Click "Use Live Location" to automatically pin your current location, search for an address, or click directly on the map.
      </p>
    </div>
  );
};

const Onboarding = ({ admin }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedEntryType, setSelectedEntryType] = useState(null);
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
    blockInfo: '',
    blockNA: false,
    numberOfUnits: '',
    villaPlotNumber: '',
    // Address fields
    address: '',
    addressLine1: '',
    aptSuiteUnit: '',
    aptSuiteNA: false,
    city: '',
    state: '',
    postalCode: '',
    landmark: '',
    mapLocation: { lat: null, lng: null, address: '' },
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [createdProperty, setCreatedProperty] = useState(null);
  const formRef = useRef(null);

  const steps = selectedEntryType ? STEPS_CONFIG[selectedEntryType] : [];
  const totalSteps = steps.length;

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const updateUnitsForBlock = (blockNum, units) => {
    setFormData(prev => ({
      ...prev,
      unitsPerBlock: { ...prev.unitsPerBlock, [blockNum]: units }
    }));
  };

  const calculateTotalFlats = () => {
    return Object.values(formData.unitsPerBlock).reduce((sum, units) => sum + (parseInt(units) || 0), 0);
  };

  const updateBlockName = (blockNum, name) => {
    setFormData(prev => ({
      ...prev,
      blockNames: { ...prev.blockNames, [blockNum]: name }
    }));
  };

  const getBlockLabel = (blockNum) => {
    return formData.blockNames[blockNum] || `Block ${blockNum}`;
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone) => /^\d{10}$/.test(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    
    if (!isFormValid()) {
      // Scroll to first error
      const firstError = document.querySelector('.border-red-400');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    try {
      const property = await saveProperty(formData, selectedEntryType, selectedCategory);
      if (property) {
        setCreatedProperty(property);
        setSubmitted(true);
      } else {
        alert('Failed to save property. Please check the server connection and try again.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  
  const handleReset = () => {
    setSelectedCategory(null);
    setSelectedEntryType(null);
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
      blockInfo: '',
      blockNA: false,
      numberOfUnits: '',
      villaPlotNumber: '',
      address: '',
      addressLine1: '',
      aptSuiteUnit: '',
      aptSuiteNA: false,
      city: '',
      state: '',
      postalCode: '',
      landmark: '',
      mapLocation: { lat: null, lng: null, address: '' },
      notes: ''
    });
    setSubmitted(false);
    setAttemptedSubmit(false);
  };

  const isFormValid = () => {
    // Basic required fields
    if (!formData.zone.trim()) return false;
    if (!formData.areaName.trim()) return false;
    if (!formData.division) return false;
    if (!formData.propertyType) return false;
    if (!formData.communityName.trim()) return false;
    
    // Association contacts validation
    if (!formData.associationContacts.every(c => c.name.trim() !== '' && isValidEmail(c.email) && isValidPhone(c.phone))) return false;
    
    // Entry type specific validation
    if (selectedEntryType === 'GC') {
      if (formData.numberOfBlocks < 1) return false;
      for (let i = 1; i <= formData.numberOfBlocks; i++) {
        if (!formData.unitsPerBlock[i] || formData.unitsPerBlock[i] <= 0) return false;
      }
    }
    if (selectedEntryType === 'APT') {
      if (!formData.blockNA && formData.blockInfo.trim() === '') return false;
      if (!formData.numberOfUnits || formData.numberOfUnits <= 0) return false;
    }
    if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') {
      if (!formData.villaPlotNumber.trim()) return false;
    }
    
    // Address validation - mandatory fields
    if (!formData.address.trim()) return false;
    if (!formData.aptSuiteNA && !formData.aptSuiteUnit.trim()) return false;
    if (!formData.city.trim()) return false;
    if (!formData.state.trim()) return false;
    if (!formData.postalCode.trim()) return false;
    
    return true;
  };

  // Category Selection Screen (first layer)
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
            <p className="text-gray-600 mt-1">Property & Vendor Onboarding Module</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Category</h2>
          <p className="text-gray-600 mb-8">Choose the onboarding category to proceed</p>

          <div className="grid md:grid-cols-3 gap-6">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => !category.locked && setSelectedCategory(category.id)}
                  disabled={category.locked}
                  className={`group relative p-6 bg-white border-2 rounded-xl transition-all duration-200 text-left ${
                    category.locked
                      ? 'border-gray-200 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 hover:border-primary-500 hover:shadow-lg'
                  }`}
                >
                  {category.locked && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
                      <Lock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-medium text-gray-500">Coming Soon</span>
                    </div>
                  )}
                  <div className={`w-14 h-14 ${category.color} rounded-xl flex items-center justify-center mb-4 ${
                    category.locked ? '' : 'group-hover:scale-110'
                  } transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h3>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Entry Type Selection Screen (second layer - shown after Residential is selected)
  if (!selectedEntryType) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
            <p className="text-gray-600 mt-1">Property & Vendor Onboarding Module</p>
          </div>
          <button
            onClick={() => setSelectedCategory(null)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← Back to Categories
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Select Entry Type</h2>
          <p className="text-gray-600 mb-8">Choose the type of property data you want to enter</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ENTRY_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedEntryType(type.id)}
                  className="group p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:shadow-lg transition-all duration-200 text-left"
                >
                  <div className={`w-14 h-14 ${type.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{type.name}</h3>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Success Screen
  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
            <p className="text-gray-600 mt-1">Property & Vendor Onboarding Module</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Success Banner */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-10 text-center text-white">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Property Onboarded Successfully!</h2>
            <p className="text-green-100">
              Your {ENTRY_TYPES.find(t => t.id === selectedEntryType)?.name} entry has been created and added to Properties.
            </p>
          </div>

          {/* Property ID Card */}
          {createdProperty && (
            <div className="px-8 py-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Property ID</p>
                  <p className="text-xl font-bold text-gray-900 font-mono tracking-wider">{createdProperty.propertyId}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Type</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedEntryType === 'GC' ? 'bg-blue-100 text-blue-700' :
                    selectedEntryType === 'APT' ? 'bg-green-100 text-green-700' :
                    selectedEntryType === 'VILLA' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {ENTRY_TYPES.find(t => t.id === selectedEntryType)?.name}
                  </span>
                </div>
              </div>

              {/* Quick summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Community</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{createdProperty.name}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Zone</p>
                  <p className="text-sm font-semibold text-gray-800">{createdProperty.zone}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Division</p>
                  <p className="text-sm font-semibold text-gray-800">{createdProperty.division}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-medium">Total Units</p>
                  <p className="text-sm font-semibold text-gray-800">{createdProperty.totalUnits}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
            >
              Add Another Entry
            </button>
            <a
              href="/employee/properties"
              className="w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm text-center"
            >
              View in Properties
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Helper: error styling for inputs - Clean simple style
  const inputClass = (hasError) =>
    `w-full px-3 py-2.5 border rounded-md transition-colors focus:ring-1 focus:outline-none text-sm ${
      hasError
        ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
    }`;

  const selectClass = (hasError) =>
    `w-full px-3 py-2.5 border rounded-md transition-colors focus:ring-1 focus:outline-none appearance-none bg-white text-sm ${
      hasError
        ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
    }`;

  const FieldError = ({ show, message }) =>
    show ? (
      <p className="text-xs text-red-500 mt-1">{message}</p>
    ) : null;

  // Render single form with all steps as seamless sections
  const renderSingleForm = () => {
    const hasError = attemptedSubmit && !isFormValid();
    
    return (
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
              <input
                type="text"
                value={formData.zone}
                onChange={(e) => updateFormData('zone', e.target.value)}
                className={inputClass(hasError && !formData.zone.trim())}
                placeholder="Enter zone name"
              />
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
                placeholder="Enter area name"
              />
              <FieldError show={hasError && !formData.areaName.trim()} message="Area name is required" />
            </div>

            {/* Division */}
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">
                Division <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.division}
                  onChange={(e) => updateFormData('division', e.target.value)}
                  className={selectClass(hasError && !formData.division)}
                >
                  <option value="">Select a division</option>
                  {DIVISIONS.map(division => (
                    <option key={division} value={division}>{division}</option>
                  ))}
                </select>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
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
            const emailEmpty = hasError && contact.email.trim() === '';
            const emailInvalid = hasError && contact.email.trim() !== '' && !isValidEmail(contact.email);
            const emailError = emailEmpty || emailInvalid;
            const phoneEmpty = hasError && contact.phone.trim() === '';
            const phoneInvalid = hasError && contact.phone.trim() !== '' && !isValidPhone(contact.phone);
            const phoneError = phoneEmpty || phoneInvalid;
            
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
                    <FieldError show={emailEmpty} message="Email is required" />
                    <FieldError show={emailInvalid} message="Please enter a valid email" />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 max-w-md">
                      <select
                        value={contact.countryCode || '+91'}
                        onChange={(e) => updateAssociationContact(index, 'countryCode', e.target.value)}
                        className="w-24 flex-shrink-0 px-2 py-2.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-200 focus:border-blue-400 focus:outline-none bg-white"
                      >
                        {COUNTRY_CODES.map(cc => (
                          <option key={cc.code} value={cc.code}>
                            {cc.flag} {cc.code}
                          </option>
                        ))}
                      </select>
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
                    <FieldError show={phoneEmpty} message="Phone number is required" />
                    <FieldError show={phoneInvalid} message="Phone number must be exactly 10 digits" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Entry Type Specific Section */}
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
                  value={formData.numberOfBlocks}
                  onChange={(e) => updateFormData('numberOfBlocks', parseInt(e.target.value) || 1)}
                  className={inputClass(hasError && formData.numberOfBlocks < 1)}
                  placeholder="Enter number of blocks"
                />
                <FieldError show={hasError && formData.numberOfBlocks < 1} message="Number of blocks is required" />
              </div>

              {/* Units per Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {Array.from({ length: formData.numberOfBlocks }, (_, i) => i + 1).map(blockNum => {
                  const blockError = hasError && (!formData.unitsPerBlock[blockNum] || formData.unitsPerBlock[blockNum] <= 0);
                  return (
                    <div key={blockNum} className="flex gap-3">
                      <div className="w-32">
                        <label className="block text-xs text-gray-500 mb-1">Block Name</label>
                        <input
                          type="text"
                          value={formData.blockNames[blockNum] || ''}
                          onChange={(e) => updateBlockName(blockNum, e.target.value)}
                          className={inputClass(false)}
                          placeholder={`Block ${blockNum}`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Units <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min="1"
                          value={formData.unitsPerBlock[blockNum] || ''}
                          onChange={(e) => updateUnitsForBlock(blockNum, e.target.value)}
                          className={inputClass(blockError)}
                          placeholder="No. of units"
                        />
                        <FieldError show={blockError} message="Required" />
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

        {selectedEntryType === 'APT' && (
          <div className="p-8 border-b border-gray-200">
            <h2 className="text-xl font-medium text-gray-800 mb-6">Apartment Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">
                  Block Information
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    id="blockNA"
                    checked={formData.blockNA}
                    onChange={(e) => updateFormData('blockNA', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="blockNA" className="text-sm text-gray-600">Not Applicable</label>
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
                  onChange={(e) => updateFormData('numberOfUnits', e.target.value)}
                  className={inputClass(hasError && (!formData.numberOfUnits || formData.numberOfUnits <= 0))}
                  placeholder="Total number of units"
                />
                <FieldError show={hasError && (!formData.numberOfUnits || formData.numberOfUnits <= 0)} message="Number of units is required" />
              </div>
            </div>
          </div>
        )}

        {(selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') && (
          <div className="p-8 border-b border-gray-200">
            <h2 className="text-xl font-medium text-gray-800 mb-6">
              {selectedEntryType === 'VILLA' ? 'Villa Details' : 'Plot Details'}
            </h2>
            
            <div className="max-w-md">
              <label className="block text-sm text-gray-700 mb-1.5">
                {selectedEntryType === 'VILLA' ? 'Villa Number' : 'Plot Number'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.villaPlotNumber}
                onChange={(e) => updateFormData('villaPlotNumber', e.target.value)}
                className={inputClass(hasError && !formData.villaPlotNumber.trim())}
                placeholder={`Enter ${selectedEntryType === 'VILLA' ? 'villa' : 'plot'} number`}
              />
              <FieldError show={hasError && !formData.villaPlotNumber.trim()} message={`${selectedEntryType === 'VILLA' ? 'Villa' : 'Plot'} number is required`} />
            </div>
          </div>
        )}

        {/* Address Section */}
        <div className="p-8 border-b border-gray-200">
          <h2 className="text-xl font-medium text-gray-800 mb-6">Address</h2>
          
          <div className="space-y-5">
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

            {/* Apt/Suite */}
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">
                Apt/Suite
              </label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="aptSuiteNA"
                  checked={formData.aptSuiteNA}
                  onChange={(e) => updateFormData('aptSuiteNA', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="aptSuiteNA" className="text-sm text-gray-600">Not Applicable</label>
              </div>
              {!formData.aptSuiteNA && (
                <input
                  type="text"
                  value={formData.aptSuiteUnit}
                  onChange={(e) => updateFormData('aptSuiteUnit', e.target.value)}
                  className={inputClass(hasError && !formData.aptSuiteNA && !formData.aptSuiteUnit.trim())}
                  placeholder="Apt 4B, Suite 100, Unit 5"
                />
              )}
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

            {/* State/Province and ZIP/Postal Code side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">
                  State/Province <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => updateFormData('state', e.target.value)}
                  className={inputClass(hasError && !formData.state.trim())}
                  placeholder="State name"
                />
                <FieldError show={hasError && !formData.state.trim()} message="State is required" />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1.5">
                  ZIP/Postal Code <span className="text-red-500">*</span>
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

            {/* Landmark (Optional) */}
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">
                Landmark <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) => updateFormData('landmark', e.target.value)}
                className={inputClass(false)}
                placeholder="Near Central Park, Behind Mall, etc."
              />
            </div>

            {/* Map Location Picker */}
            <div className="pt-4">
              <MapLocationPicker
                value={formData.mapLocation}
                onChange={(loc) => updateFormData('mapLocation', loc)}
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
    );
  };

  const entryTypeInfo = ENTRY_TYPES.find(t => t.id === selectedEntryType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Property Onboarding</h1>
          <p className="text-gray-500 text-sm mt-1">
            {entryTypeInfo?.name} • Complete all required fields
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md transition-colors text-sm"
        >
          ← Back
        </button>
      </div>

      {/* Single Form Container */}
      <div className="max-w-3xl">
        {renderSingleForm()}
      </div>
    </div>
  );
};

export default Onboarding;
