import { useState, useEffect } from 'react';
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
  Search
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

// Division options
const DIVISIONS = ['Division A', 'Division B', 'Division C', 'Division D'];

// Property Type options
const PROPERTY_TYPES = {
  GC: ['Gated Community - Residential', 'Gated Community - Commercial', 'Gated Community - Mixed'],
  APT: ['Apartment - High Rise', 'Apartment - Mid Rise', 'Apartment - Low Rise'],
  VILLA: ['Villa - Independent', 'Villa - Gated Community'],
  PLOT: ['Plot - Residential', 'Plot - Commercial']
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

// Interactive map location picker with debounced autocomplete
const MapLocationPicker = ({ value, onChange }) => {
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

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

  const markerPosition = value?.lat && value?.lng ? [value.lat, value.lng] : null;
  const mapCenter = markerPosition || [20.5937, 78.9629];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Location on Map <span className="text-red-500">*</span>
      </label>

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
          <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
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

      <p className="text-[11px] text-gray-400">Start typing to see suggestions, or click directly on the map to pin a location.</p>
    </div>
  );
};

const Onboarding = ({ admin }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
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
    address: '',
    landmark: '',
    mapLocation: { lat: null, lng: null, address: '' },
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [createdProperty, setCreatedProperty] = useState(null);

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

  const handleNext = () => {
    if (!isStepValid()) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setAttemptedNext(false);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
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
    setCurrentStep(1);
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
      landmark: '',
      mapLocation: { lat: null, lng: null, address: '' },
      notes: ''
    });
    setSubmitted(false);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: return formData.zone.trim() !== '';
      case 2: return formData.areaName.trim() !== '';
      case 3: return formData.division !== '';
      case 4: return formData.propertyType !== '';
      case 5: return formData.communityName.trim() !== '';
      case 6: return formData.associationContacts.every(c => c.name.trim() !== '' && isValidEmail(c.email) && isValidPhone(c.phone));
      case 7:
        if (selectedEntryType === 'GC') return formData.numberOfBlocks >= 1;
        if (selectedEntryType === 'APT') return formData.blockNA || formData.blockInfo.trim() !== '';
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') return formData.villaPlotNumber.trim() !== '';
        return true;
      case 8:
        if (selectedEntryType === 'GC') {
          for (let i = 1; i <= formData.numberOfBlocks; i++) {
            if (!formData.unitsPerBlock[i] || formData.unitsPerBlock[i] <= 0) return false;
          }
          return true;
        }
        if (selectedEntryType === 'APT') return formData.numberOfUnits > 0;
        return formData.address.trim() !== '';
      case 9:
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') return true;
        return formData.address.trim() !== '';
      case 10: return true;
      default: return true;
    }
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

  // Helper: error styling for inputs
  const inputClass = (hasError) =>
    `w-full px-4 py-3 border rounded-lg transition-colors focus:ring-2 focus:outline-none ${
      hasError
        ? 'border-red-400 focus:ring-red-200 focus:border-red-500 bg-red-50/30'
        : 'border-gray-300 focus:ring-primary-200 focus:border-primary-500'
    }`;

  const selectClass = (hasError) =>
    `w-full px-4 py-3 border rounded-lg transition-colors focus:ring-2 focus:outline-none appearance-none bg-white ${
      hasError
        ? 'border-red-400 focus:ring-red-200 focus:border-red-500 bg-red-50/30'
        : 'border-gray-300 focus:ring-primary-200 focus:border-primary-500'
    }`;

  const FieldError = ({ show, message }) =>
    show ? (
      <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {message}
      </p>
    ) : null;

  // Render step content based on entry type and current step
  const renderStepContent = () => {
    // Common steps 1-6 for all entry types
    switch (currentStep) {
      case 1: {
        const hasError = attemptedNext && formData.zone.trim() === '';
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Zone <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.zone}
              onChange={(e) => updateFormData('zone', e.target.value)}
              className={inputClass(hasError)}
              placeholder="Enter zone name"
            />
            <FieldError show={hasError} message="Zone is required" />
          </div>
        );
      }

      case 2: {
        const hasError = attemptedNext && formData.areaName.trim() === '';
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Area Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.areaName}
              onChange={(e) => updateFormData('areaName', e.target.value)}
              className={inputClass(hasError)}
              placeholder="Enter area name"
            />
            <FieldError show={hasError} message="Area name is required" />
          </div>
        );
      }

      case 3: {
        const hasError = attemptedNext && formData.division === '';
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Division <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={formData.division}
                onChange={(e) => updateFormData('division', e.target.value)}
                className={selectClass(hasError)}
              >
                <option value="">Select a division</option>
                {DIVISIONS.map(division => (
                  <option key={division} value={division}>{division}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
            </div>
            <FieldError show={hasError} message="Please select a division" />
          </div>
        );
      }

      case 4: {
        const hasError = attemptedNext && formData.propertyType === '';
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Property Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={formData.propertyType}
                onChange={(e) => updateFormData('propertyType', e.target.value)}
                className={selectClass(hasError)}
              >
                <option value="">Select a property type</option>
                {PROPERTY_TYPES[selectedEntryType]?.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
            </div>
            <FieldError show={hasError} message="Please select a property type" />
          </div>
        );
      }

      case 5: {
        const hasError = attemptedNext && formData.communityName.trim() === '';
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Community Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.communityName}
              onChange={(e) => updateFormData('communityName', e.target.value)}
              className={inputClass(hasError)}
              placeholder="Enter community name"
            />
            <FieldError show={hasError} message="Community name is required" />
          </div>
        );
      }

      case 6: {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Association / Client Details <span className="text-red-500">*</span>
              </label>
              <button
                onClick={addAssociationContact}
                className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>

            {formData.associationContacts.map((contact, index) => {
              const nameError = attemptedNext && contact.name.trim() === '';
              const emailEmpty = attemptedNext && contact.email.trim() === '';
              const emailInvalid = attemptedNext && contact.email.trim() !== '' && !isValidEmail(contact.email);
              const emailError = emailEmpty || emailInvalid;
              const phoneEmpty = attemptedNext && contact.phone.trim() === '';
              const phoneInvalid = attemptedNext && contact.phone.trim() !== '' && !isValidPhone(contact.phone);
              const phoneError = phoneEmpty || phoneInvalid;
              return (
                <div key={index} className="p-5 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Contact {index + 1}</span>
                    {formData.associationContacts.length > 1 && (
                      <button
                        onClick={() => removeAssociationContact(index)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => updateAssociationContact(index, 'name', e.target.value)}
                      className={inputClass(nameError).replace('px-4 py-3', 'px-3 py-2')}
                      placeholder="Contact name"
                    />
                    <FieldError show={nameError} message="Name is required" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateAssociationContact(index, 'email', e.target.value)}
                        className={inputClass(emailError).replace('px-4 py-3', 'px-3 py-2')}
                        placeholder="example@email.com"
                      />
                      <FieldError show={emailEmpty} message="Email is required" />
                      <FieldError show={emailInvalid} message="Please enter a valid email (e.g. name@domain.com)" />
                    </div>
                    {/* Phone with country code */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={contact.countryCode || '+91'}
                          onChange={(e) => updateAssociationContact(index, 'countryCode', e.target.value)}
                          className="w-[7.5rem] flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-500 focus:outline-none bg-white"
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
                          className={`flex-1 ${inputClass(phoneError).replace('px-4 py-3', 'px-3 py-2')}`}
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
        );
      }

      case 7:
        // Different for each entry type
        if (selectedEntryType === 'GC') {
          const hasError = attemptedNext && formData.numberOfBlocks < 1;
          return (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Number of Blocks <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.numberOfBlocks}
                onChange={(e) => updateFormData('numberOfBlocks', parseInt(e.target.value) || 1)}
                className={inputClass(hasError)}
                placeholder="Enter number of blocks"
              />
              <FieldError show={hasError} message="Number of blocks is required" />
              <p className="text-xs text-gray-400">
                You will enter the number of units for each block in the next step.
              </p>
            </div>
          );
        }
        if (selectedEntryType === 'APT') {
          const hasError = attemptedNext && !formData.blockNA && formData.blockInfo.trim() === '';
          return (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Block Information <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="blockNA"
                  checked={formData.blockNA}
                  onChange={(e) => updateFormData('blockNA', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="blockNA" className="text-sm text-gray-700">Not Applicable (N/A)</label>
              </div>
              {!formData.blockNA && (
                <>
                  <input
                    type="text"
                    value={formData.blockInfo}
                    onChange={(e) => updateFormData('blockInfo', e.target.value)}
                    className={inputClass(hasError)}
                    placeholder="Enter block name/number (e.g., Block A, Tower 1)"
                  />
                  <FieldError show={hasError} message="Block information is required (or mark as N/A)" />
                </>
              )}
            </div>
          );
        }
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') {
          const label = selectedEntryType === 'VILLA' ? 'Villa Number' : 'Plot Number';
          const hasError = attemptedNext && formData.villaPlotNumber.trim() === '';
          return (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {label} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.villaPlotNumber}
                onChange={(e) => updateFormData('villaPlotNumber', e.target.value)}
                className={inputClass(hasError)}
                placeholder={`Enter ${label.toLowerCase()}`}
              />
              <FieldError show={hasError} message={`${label} is required`} />
            </div>
          );
        }
        return null;

      case 8:
        // Different for each entry type
        if (selectedEntryType === 'GC') {
          const hasBlockErrors = attemptedNext;
          return (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Units per Block <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mt-1">You can rename each block and enter the number of units.</p>
              </div>

              <div className="space-y-3">
                {Array.from({ length: formData.numberOfBlocks }, (_, i) => i + 1).map(blockNum => {
                  const blockError = hasBlockErrors && (!formData.unitsPerBlock[blockNum] || formData.unitsPerBlock[blockNum] <= 0);
                  return (
                    <div key={blockNum} className={`p-4 rounded-xl border transition-colors ${
                      blockError ? 'bg-red-50/50 border-red-200' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        {/* Editable block name */}
                        <div className="flex-shrink-0 w-40">
                          <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">Block Name</label>
                          <input
                            type="text"
                            value={formData.blockNames[blockNum] || ''}
                            onChange={(e) => updateBlockName(blockNum, e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-200 focus:border-primary-500 focus:outline-none bg-white"
                            placeholder={`Block ${blockNum}`}
                          />
                        </div>
                        {/* Units input */}
                        <div className="flex-1">
                          <label className="block text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wider">No. of Units <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            min="1"
                            value={formData.unitsPerBlock[blockNum] || ''}
                            onChange={(e) => updateUnitsForBlock(blockNum, e.target.value)}
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:outline-none ${
                              blockError ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-primary-200'
                            }`}
                            placeholder={`Units for ${getBlockLabel(blockNum)}`}
                          />
                        </div>
                      </div>
                      {blockError && (
                        <p className="flex items-center gap-1 text-[11px] text-red-500 mt-2">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          Enter units for {getBlockLabel(blockNum)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {formData.numberOfBlocks >= 1 && calculateTotalFlats() > 0 && (
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary-700">Total Flats</span>
                    <span className="text-2xl font-bold text-primary-700">{calculateTotalFlats()}</span>
                  </div>
                </div>
              )}
            </div>
          );
        }
        if (selectedEntryType === 'APT') {
          const hasError = attemptedNext && (!formData.numberOfUnits || formData.numberOfUnits <= 0);
          return (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Number of Units <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.numberOfUnits}
                onChange={(e) => updateFormData('numberOfUnits', e.target.value)}
                className={inputClass(hasError)}
                placeholder="Enter total number of units"
              />
              <FieldError show={hasError} message="Number of units is required" />
            </div>
          );
        }
        // VILLA/PLOT - this is Address step (step 8)
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') {
          const hasError = attemptedNext && formData.address.trim() === '';
          return (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Address / Landmark <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => updateFormData('address', e.target.value)}
                  rows={3}
                  className={inputClass(hasError)}
                  placeholder="Enter complete address with landmark"
                />
                <FieldError show={hasError} message="Address is required" />
              </div>
              <MapLocationPicker
                value={formData.mapLocation}
                onChange={(loc) => updateFormData('mapLocation', loc)}
              />
            </div>
          );
        }
        return null;

      case 9:
        // For GC and APT this is Address step, for VILLA this is Notes
        if (selectedEntryType === 'GC' || selectedEntryType === 'APT') {
          const hasError = attemptedNext && formData.address.trim() === '';
          return (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Address / Landmark <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => updateFormData('address', e.target.value)}
                  rows={3}
                  className={inputClass(hasError)}
                  placeholder="Enter complete address with landmark"
                />
                <FieldError show={hasError} message="Address is required" />
              </div>
              <MapLocationPicker
                value={formData.mapLocation}
                onChange={(loc) => updateFormData('mapLocation', loc)}
              />
            </div>
          );
        }
        // VILLA/PLOT - Notes step
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') {
          return (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Notes <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateFormData('notes', e.target.value)}
                rows={5}
                className={inputClass(false)}
                placeholder="Enter any additional notes or comments"
              />
            </div>
          );
        }
        return null;

      case 10:
        // Notes step for GC and APT
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Notes <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              rows={5}
              className={inputClass(false)}
              placeholder="Enter any additional notes or comments"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepConfig = steps[currentStep - 1];
  const StepIcon = currentStepConfig?.icon;
  const entryTypeInfo = ENTRY_TYPES.find(t => t.id === selectedEntryType);

  // Get preview value for completed steps
  const getStepPreview = (stepId) => {
    switch (stepId) {
      case 1: return formData.zone || null;
      case 2: return formData.areaName || null;
      case 3: return formData.division || null;
      case 4: return formData.propertyType || null;
      case 5: return formData.communityName || null;
      case 6: {
        const filled = formData.associationContacts.filter(c => c.name.trim());
        return filled.length > 0 ? `${filled.length} contact${filled.length > 1 ? 's' : ''}` : null;
      }
      case 7:
        if (selectedEntryType === 'GC') return formData.numberOfBlocks ? `${formData.numberOfBlocks} block(s)` : null;
        if (selectedEntryType === 'APT') return formData.blockNA ? 'N/A' : formData.blockInfo || null;
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') return formData.villaPlotNumber || null;
        return null;
      case 8:
        if (selectedEntryType === 'GC') {
          const total = calculateTotalFlats();
          return total > 0 ? `${total} total flats` : null;
        }
        if (selectedEntryType === 'APT') return formData.numberOfUnits ? `${formData.numberOfUnits} units` : null;
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') {
          if (formData.mapLocation?.address) return 'Location pinned';
          return formData.address ? 'Address added' : null;
        }
        return null;
      case 9:
        if (selectedEntryType === 'GC' || selectedEntryType === 'APT') {
          if (formData.mapLocation?.address) return 'Location pinned';
          return formData.address ? 'Address added' : null;
        }
        if (selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') return formData.notes ? 'Notes added' : null;
        return null;
      case 10: return formData.notes ? 'Notes added' : null;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
            <p className="text-gray-600 mt-1">Property & Vendor Onboarding Module</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${entryTypeInfo?.color} text-white text-sm`}>
            {entryTypeInfo && <entryTypeInfo.icon className="w-3.5 h-3.5" />}
            <span className="font-medium">{entryTypeInfo?.name}</span>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
        >
          ← Back
        </button>
      </div>

      {/* Main Layout: Vertical Sidebar + Content */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left: Vertical Timeline Sidebar */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 lg:sticky lg:top-8">
            {/* Header with progress */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Steps</h3>
              <span className="text-xs font-semibold text-white bg-primary-600 px-2.5 py-0.5 rounded-full">
                {currentStep} / {totalSteps}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1 bg-gray-100 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>

            {/* Vertical Timeline */}
            <div className="relative">
              {steps.map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                const isLast = index === steps.length - 1;
                const preview = isCompleted ? getStepPreview(step.id) : null;

                return (
                  <div key={step.id} className="relative flex gap-3">
                    {/* Timeline line + circle */}
                    <div className="flex flex-col items-center">
                      {/* Circle */}
                      <button
                        onClick={() => { if (isCompleted) { setAttemptedNext(false); setCurrentStep(step.id); } }}
                        className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300 ${
                          isActive
                            ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-sm'
                            : isCompleted
                              ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                      </button>
                      {/* Connecting line */}
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[20px] transition-colors duration-300 ${
                          isCompleted ? 'bg-green-300' : isActive ? 'bg-primary-200' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-5 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                      <button
                        onClick={() => { if (isCompleted) { setAttemptedNext(false); setCurrentStep(step.id); } }}
                        className={`text-left block w-full ${isCompleted ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className={`text-sm leading-tight block ${
                          isActive
                            ? 'text-primary-700 font-semibold'
                            : isCompleted
                              ? 'text-gray-800 font-medium'
                              : 'text-gray-400 font-normal'
                        }`}>
                          {step.title}
                        </span>
                        {preview && (
                          <span className="text-[11px] text-green-600 mt-0.5 block truncate font-medium">
                            {preview}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[11px] text-primary-400 mt-0.5 block">In progress...</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Form Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Step Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  {StepIcon && <StepIcon className="w-5 h-5 text-primary-600" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-primary-600 uppercase tracking-wider">Step {currentStep} of {totalSteps}</p>
                  <h2 className="text-lg font-semibold text-gray-900">{currentStepConfig?.title}</h2>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="px-8 py-8">
              {renderStepContent()}
            </div>

            {/* Navigation Footer */}
            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  currentStep === 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {currentStep < totalSteps ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-200"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 shadow-sm shadow-green-200 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Submit Entry
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Summary Panel */}
          {(formData.zone || formData.areaName || formData.division || formData.communityName) && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Entry Summary</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                {formData.zone && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Zone:</span>
                    <span className="font-medium text-gray-700">{formData.zone}</span>
                  </div>
                )}
                {formData.areaName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Area:</span>
                    <span className="font-medium text-gray-700">{formData.areaName}</span>
                  </div>
                )}
                {formData.division && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Division:</span>
                    <span className="font-medium text-gray-700">{formData.division}</span>
                  </div>
                )}
                {formData.propertyType && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Type:</span>
                    <span className="font-medium text-gray-700">{formData.propertyType}</span>
                  </div>
                )}
                {formData.communityName && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Community:</span>
                    <span className="font-medium text-gray-700">{formData.communityName}</span>
                  </div>
                )}
                {selectedEntryType === 'GC' && formData.numberOfBlocks > 0 && currentStep > 7 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Blocks:</span>
                    <span className="font-medium text-gray-700">{formData.numberOfBlocks}</span>
                  </div>
                )}
                {selectedEntryType === 'GC' && calculateTotalFlats() > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-full">
                    <span className="text-primary-400">Total Flats:</span>
                    <span className="font-semibold text-primary-700">{calculateTotalFlats()}</span>
                  </div>
                )}
                {selectedEntryType === 'APT' && formData.numberOfUnits && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">Units:</span>
                    <span className="font-medium text-gray-700">{formData.numberOfUnits}</span>
                  </div>
                )}
                {(selectedEntryType === 'VILLA' || selectedEntryType === 'PLOT') && formData.villaPlotNumber && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <span className="text-gray-400">{selectedEntryType === 'VILLA' ? 'Villa' : 'Plot'} #:</span>
                    <span className="font-medium text-gray-700">{formData.villaPlotNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
