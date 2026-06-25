import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Loader2, 
  AlertCircle, 
  Check, 
  ExternalLink,
  Share2,
  Clock,
  User,
  Copy,
  CheckCircle
} from 'lucide-react';

const GPSLocationCapture = ({ 
  value, 
  onChange, 
  savedBy = null,
  showShareOption = false,
  onShare = null 
}) => {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate Google Maps URL
  const getGoogleMapsUrl = (lat, lng) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // Capture current GPS location
  const handleCaptureLocation = () => {
    setError('');
    setCapturing(true);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setCapturing(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const googleMapsLink = getGoogleMapsUrl(lat, lng);
        const savedAt = new Date().toISOString();

        // Try to get address from reverse geocoding (Nominatim - free)
        let address = '';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await response.json();
          address = data.display_name || '';
        } catch (e) {
          console.error('Reverse geocoding failed:', e);
        }

        onChange({
          lat,
          lng,
          accuracy,
          address,
          googleMapsLink,
          savedAt,
          savedBy: savedBy || 'Unknown'
        });

        setCapturing(false);
      },
      (err) => {
        let errorMessage = 'Unable to get your location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        setError(errorMessage);
        setCapturing(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Copy location link to clipboard
  const handleCopyLink = async () => {
    if (value?.googleMapsLink) {
      await navigator.clipboard.writeText(value.googleMapsLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Open in Google Maps
  const handleOpenInMaps = () => {
    if (value?.googleMapsLink) {
      window.open(value.googleMapsLink, '_blank');
    }
  };

  // Share location (WhatsApp style)
  const handleShareLocation = () => {
    if (onShare && value?.googleMapsLink) {
      onShare(value);
    } else if (navigator.share && value?.googleMapsLink) {
      navigator.share({
        title: 'Property Location',
        text: `Property Location: ${value.address || 'View on Google Maps'}`,
        url: value.googleMapsLink
      }).catch(() => {});
    }
  };

  const hasLocation = value?.lat && value?.lng;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Property Location <span className="text-red-500">*</span>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Capture Button */}
      <button
        type="button"
        onClick={handleCaptureLocation}
        disabled={capturing}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-base font-medium hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {capturing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Capturing Location...
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            {hasLocation ? 'Update Current Location' : 'Save Current Location'}
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Click the button above to capture your device's GPS coordinates
      </p>

      {/* Location Captured Info */}
      {hasLocation && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
          {/* Success Header */}
          <div className="flex items-center gap-2 text-gray-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Location Captured Successfully</span>
          </div>

          {/* Location Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Latitude</p>
              <p className="font-mono font-medium text-gray-800">{value.lat?.toFixed(6)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Longitude</p>
              <p className="font-mono font-medium text-gray-800">{value.lng?.toFixed(6)}</p>
            </div>
          </div>

          {/* Address (if captured) */}
          {value.address && (
            <div className="bg-white rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Approximate Address</p>
              <p className="text-sm text-gray-800">{value.address}</p>
            </div>
          )}

          {/* Google Maps Link */}
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Google Maps Link</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono text-blue-600 truncate flex-1">{value.googleMapsLink}</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {value.savedBy && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>Saved by: {value.savedBy}</span>
              </div>
            )}
            {value.savedAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(value.savedAt).toLocaleString()}</span>
              </div>
            )}
            {value.accuracy && (
              <div className="flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" />
                <span>Accuracy: ±{Math.round(value.accuracy)}m</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleOpenInMaps}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Google Maps
            </button>
            {showShareOption && (
              <button
                type="button"
                onClick={handleShareLocation}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GPSLocationCapture;
