import { useState } from 'react';
import { 
  MapPin, 
  ExternalLink, 
  Eye, 
  Copy, 
  Check,
  Clock,
  User,
  Navigation,
  X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

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

const PropertyLocationDisplay = ({ 
  location, 
  propertyName = 'Property'
}) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!location?.lat || !location?.lng) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        <MapPin className="w-4 h-4" />
        <span>No GPS location saved for this property</span>
      </div>
    );
  }

  const lat = parseFloat(location.lat);
  const lng = parseFloat(location.lng);
  const googleMapsLink = location.googleMapsLink || `https://www.google.com/maps?q=${lat},${lng}`;

  // Copy location link
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(googleMapsLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open in Google Maps
  const handleOpenInMaps = () => {
    window.open(googleMapsLink, '_blank');
  };

  return (
    <>
      <div className="space-y-4">
        {/* Location Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          {/* Coordinates */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800">GPS Coordinates</p>
              <p className="text-xs font-mono text-gray-600 mt-0.5">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
              {location.address && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{location.address}</p>
              )}
            </div>
          </div>

          {/* Metadata */}
          {(location.savedBy || location.savedAt) && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4 pt-3 border-t border-blue-200">
              {location.savedBy && (
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{location.savedBy}</span>
                </div>
              )}
              {location.savedAt && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(location.savedAt).toLocaleString()}</span>
                </div>
              )}
              {location.accuracy && (
                <div className="flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>±{Math.round(location.accuracy)}m</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* View Location */}
            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">View</span> Location
            </button>

            {/* Open in Google Maps */}
            <button
              type="button"
              onClick={handleOpenInMaps}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open in</span> Maps
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{propertyName}</h3>
                  <p className="text-xs text-gray-500 font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMapModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Map */}
            <div style={{ height: '400px' }}>
              <MapContainer
                center={[lat, lng]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]} icon={customIcon} />
              </MapContainer>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleOpenInMaps}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Google Maps
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PropertyLocationDisplay;
