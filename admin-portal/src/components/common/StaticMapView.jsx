import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { ExternalLink } from 'lucide-react';

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

const StaticMapView = ({ lat, lng, height = 200 }) => {
  if (!lat || !lng) return null;
  
  const position = [parseFloat(lat), parseFloat(lng)];
  
  return (
    <>
      {/* OpenStreetMap with Leaflet */}
      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: `${height}px` }}>
        <MapContainer
          center={position}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={false}
          dragging={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={customIcon} />
        </MapContainer>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-500 font-mono">
          {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}
        </p>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in Maps
        </a>
      </div>
    </>
  );
};

export default StaticMapView;
