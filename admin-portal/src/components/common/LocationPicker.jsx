import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Navigation, Loader2, AlertCircle, MapPinned, Check, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map click events
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to fly to a location
const FlyToLocation = ({ position, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom || 16, { duration: 1 });
    }
  }, [position, zoom, map]);
  return null;
};

// Nominatim API for geocoding (free, no API key needed)
const searchAddress = async (query) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=8&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    return await response.json();
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
};

// Reverse geocode using Nominatim
const reverseGeocodeNominatim = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    return await response.json();
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
};

// Parse address components from Nominatim response
const parseNominatimAddress = (data) => {
  const addr = data?.address || {};
  return {
    addressLine1: [addr.road, addr.house_number, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') || addr.amenity || '',
    city: addr.city || addr.town || addr.village || addr.county || '',
    state: addr.state || '',
    postalCode: addr.postcode || '',
    country: addr.country || 'India'
  };
};

const LocationPicker = ({ value, onChange, onAddressComponentsChange }) => {
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mapPosition, setMapPosition] = useState(
    value?.lat && value?.lng 
      ? [value.lat, value.lng] 
      : [17.385, 78.4867] // Hyderabad default
  );
  const [markerPosition, setMarkerPosition] = useState(
    value?.lat && value?.lng ? [value.lat, value.lng] : null
  );
  const [flyTo, setFlyTo] = useState(null);
  
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search using Nominatim
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setPredictions([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddress(searchQuery);
      setPredictions(results);
      setShowResults(results.length > 0);
      setSearching(false);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle map click
  const handleMapClick = useCallback(async (lat, lng) => {
    setMarkerPosition([lat, lng]);
    setLocationError('');
    
    const result = await reverseGeocodeNominatim(lat, lng);
    if (result) {
      const address = result.display_name;
      setSearchQuery(address);
      setShowResults(false);
      onChange({ lat, lng, address });
      
      const components = parseNominatimAddress(result);
      onAddressComponentsChange?.(components);
    } else {
      const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      onChange({ lat, lng, address: fallbackAddress });
    }
  }, [onChange, onAddressComponentsChange]);

  // Select a prediction
  const selectPrediction = useCallback((prediction) => {
    const lat = parseFloat(prediction.lat);
    const lng = parseFloat(prediction.lon);
    const address = prediction.display_name;
    
    setSearchQuery(address);
    setShowResults(false);
    setPredictions([]);
    setMarkerPosition([lat, lng]);
    setFlyTo([lat, lng]);
    
    onChange({ lat, lng, address });
    
    const components = parseNominatimAddress(prediction);
    onAddressComponentsChange?.(components);
  }, [onChange, onAddressComponentsChange]);

  // Get live location
  const handleGetLiveLocation = () => {
    setLocationError('');
    setGettingLocation(true);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setMarkerPosition([lat, lng]);
        setFlyTo([lat, lng]);
        
        const result = await reverseGeocodeNominatim(lat, lng);
        if (result) {
          const address = result.display_name;
          setSearchQuery(address);
          onChange({ lat, lng, address });
          
          const components = parseNominatimAddress(result);
          onAddressComponentsChange?.(components);
        } else {
          const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          onChange({ lat, lng, address: fallbackAddress });
        }
        
        setGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in browser settings.';
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

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setPredictions([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Location <span className="text-red-500">*</span>
        </label>
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

      {locationError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {locationError}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => predictions.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
            placeholder="Search for an address, city, or landmark..."
          />
          {searching ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
          ) : searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && predictions.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {predictions.map((prediction, index) => (
              <button
                key={prediction.place_id || index}
                type="button"
                onMouseDown={() => selectPrediction(prediction)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">
                      {prediction.display_name?.split(',').slice(0, 2).join(', ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {prediction.display_name?.split(',').slice(2).join(', ')}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">Powered by OpenStreetMap</p>
            </div>
          </div>
        )}
      </div>

      {/* OpenStreetMap with Leaflet */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '320px' }}>
        <MapContainer
          center={mapPosition}
          zoom={value?.lat ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          {flyTo && <FlyToLocation position={flyTo} zoom={16} />}
          {markerPosition && (
            <Marker position={markerPosition} icon={customIcon} />
          )}
        </MapContainer>
      </div>

      {/* Selected Location Info */}
      {value?.address && (
        <div className="flex items-start gap-2.5 p-3 bg-green-50 border border-green-200 rounded-xl">
          <MapPinned className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-green-700">Selected Location</p>
              <Check className="w-3.5 h-3.5 text-green-600" />
            </div>
            <p className="text-xs text-green-600 mt-0.5 break-words">{value.address}</p>
            {value.lat && value.lng && (
              <p className="text-[10px] text-green-500 mt-0.5 font-mono">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Search for an address, click on the map, or use your live location. Click to place marker.
      </p>
    </div>
  );
};

export default LocationPicker;
