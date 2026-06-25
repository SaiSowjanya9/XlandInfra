import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Navigation, Loader2, AlertCircle, MapPinned, Check } from 'lucide-react';

// Google Maps API Key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Load Google Maps script dynamically
let googleMapsPromise = null;
const loadGoogleMaps = () => {
  if (googleMapsPromise) return googleMapsPromise;
  
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('Google Maps API key not configured'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    
    window.initGoogleMaps = () => {
      resolve(window.google.maps);
      delete window.initGoogleMaps;
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps'));
      googleMapsPromise = null;
    };
    
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

// Parse address components from Google Geocoder response
const parseAddressComponents = (results) => {
  const components = results[0]?.address_components || [];
  const getComponent = (types) => {
    const comp = components.find(c => types.some(t => c.types.includes(t)));
    return comp?.long_name || '';
  };
  
  return {
    addressLine1: [
      getComponent(['street_number']),
      getComponent(['route'])
    ].filter(Boolean).join(' ') || getComponent(['sublocality_level_1', 'sublocality', 'neighborhood']),
    city: getComponent(['locality', 'administrative_area_level_2']),
    state: getComponent(['administrative_area_level_1']),
    postalCode: getComponent(['postal_code']),
    country: getComponent(['country'])
  };
};

const LocationPicker = ({ value, onChange, onAddressComponentsChange }) => {
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState('');
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Initialize Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        setMapsLoaded(true);
        autocompleteServiceRef.current = new maps.places.AutocompleteService();
        geocoderRef.current = new maps.Geocoder();
      })
      .catch((err) => {
        console.error('Google Maps load error:', err);
        setMapsError(err.message || 'Failed to load Google Maps');
      });
  }, []);

  // Initialize map when container is ready
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const maps = window.google.maps;
    const defaultCenter = value?.lat && value?.lng 
      ? { lat: value.lat, lng: value.lng }
      : { lat: 17.385, lng: 78.4867 }; // Hyderabad default

    mapInstanceRef.current = new maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: value?.lat ? 16 : 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
      ]
    });

    placesServiceRef.current = new maps.places.PlacesService(mapInstanceRef.current);

    // Add click listener
    mapInstanceRef.current.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      reverseGeocode(lat, lng);
    });

    // Add initial marker if value exists
    if (value?.lat && value?.lng) {
      markerRef.current = new maps.Marker({
        position: { lat: value.lat, lng: value.lng },
        map: mapInstanceRef.current,
        animation: maps.Animation.DROP
      });
    }
  }, [mapsLoaded]);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!geocoderRef.current) return;

    try {
      const results = await new Promise((resolve, reject) => {
        geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results[0]) {
            resolve(results);
          } else {
            reject(new Error('Geocoding failed'));
          }
        });
      });

      const address = results[0].formatted_address;
      setSearchQuery(address);
      setShowResults(false);
      
      // Update marker
      const maps = window.google.maps;
      if (markerRef.current) {
        markerRef.current.setPosition({ lat, lng });
      } else {
        markerRef.current = new maps.Marker({
          position: { lat, lng },
          map: mapInstanceRef.current,
          animation: maps.Animation.DROP
        });
      }
      
      mapInstanceRef.current?.panTo({ lat, lng });
      
      onChange({ lat, lng, address });
      
      // Parse and send address components
      const components = parseAddressComponents(results);
      onAddressComponentsChange?.(components);
      
    } catch (err) {
      console.error('Reverse geocode error:', err);
      const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      onChange({ lat, lng, address: fallbackAddress });
    }
  }, [onChange, onAddressComponentsChange]);

  // Debounced search using Google Places Autocomplete
  useEffect(() => {
    if (!autocompleteServiceRef.current || searchQuery.trim().length < 3) {
      setPredictions([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearching(true);
      
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: searchQuery,
          componentRestrictions: { country: 'in' }, // Restrict to India
          types: ['geocode', 'establishment']
        },
        (results, status) => {
          setSearching(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setShowResults(true);
          } else {
            setPredictions([]);
            setShowResults(false);
          }
        }
      );
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Select a prediction
  const selectPrediction = (prediction) => {
    if (!placesServiceRef.current) return;

    setSearching(true);
    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ['geometry', 'formatted_address', 'address_components'] },
      (place, status) => {
        setSearching(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address;
          
          setSearchQuery(address);
          setShowResults(false);
          setPredictions([]);
          
          // Update marker
          const maps = window.google.maps;
          if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
          } else {
            markerRef.current = new maps.Marker({
              position: { lat, lng },
              map: mapInstanceRef.current,
              animation: maps.Animation.DROP
            });
          }
          
          mapInstanceRef.current?.panTo({ lat, lng });
          mapInstanceRef.current?.setZoom(16);
          
          onChange({ lat, lng, address });
          
          // Parse address components
          const components = {
            addressLine1: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
          };
          
          place.address_components?.forEach(comp => {
            if (comp.types.includes('street_number') || comp.types.includes('route')) {
              components.addressLine1 += (components.addressLine1 ? ' ' : '') + comp.long_name;
            }
            if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
              if (!components.addressLine1) components.addressLine1 = comp.long_name;
            }
            if (comp.types.includes('locality')) {
              components.city = comp.long_name;
            }
            if (comp.types.includes('administrative_area_level_1')) {
              components.state = comp.long_name;
            }
            if (comp.types.includes('postal_code')) {
              components.postalCode = comp.long_name;
            }
            if (comp.types.includes('country')) {
              components.country = comp.long_name;
            }
          });
          
          onAddressComponentsChange?.(components);
        }
      }
    );
  };

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
        await reverseGeocode(lat, lng);
        mapInstanceRef.current?.setZoom(16);
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

  // Show error if Maps API not configured
  if (mapsError) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Location <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Google Maps API not configured</p>
            <p className="text-xs mt-1">Please add VITE_GOOGLE_MAPS_API_KEY to your environment variables.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Location <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={handleGetLiveLocation}
          disabled={gettingLocation || !mapsLoaded}
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
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => predictions.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 focus:outline-none"
            placeholder="Search for an address, city, or landmark..."
            disabled={!mapsLoaded}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results Dropdown - Google Places Predictions */}
        {showResults && predictions.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                onMouseDown={() => selectPrediction(prediction)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{prediction.structured_formatting?.main_text}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {prediction.structured_formatting?.secondary_text}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <img 
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" 
                alt="Powered by Google" 
                className="h-3"
              />
            </div>
          </div>
        )}
      </div>

      {/* Google Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '320px' }}>
        {!mapsLoaded ? (
          <div className="h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading Google Maps...</p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        )}
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
