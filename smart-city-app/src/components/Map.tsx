"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icons for different marker types
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const icons = {
  pharmacy: createCustomIcon('#10b981'), // green
  restaurant: createCustomIcon('#f59e0b'), // amber
  hospital: createCustomIcon('#ef4444'), // red
  bank: createCustomIcon('#3b82f6'), // blue
  default: createCustomIcon('#6b7280'), // gray
  destination: createCustomIcon('#8b5cf6'), // purple
  user: createCustomIcon('#06b6d4') // cyan
};

interface MapProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    title: string;
    description?: string;
    type?: string;
  }>;
  route?: {
    polyline: number[][];
    distance: string;
    duration: string;
  };
}

function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, map]);

  return null;
}

export default function Map({ center, zoom = 13, markers = [], route }: MapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([47.4979, 19.0402]); // Budapest coordinates
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Get user's current location
    if (isClient && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          if (!center) {
            setMapCenter([latitude, longitude]);
          }
        },
        (error) => {
          console.warn("Could not get user location:", error);
        }
      );
    }
  }, [center, isClient]);

  const finalCenter = center || mapCenter;

  // Get icon for marker type
  const getMarkerIcon = (type?: string) => {
    if (!type) return icons.default;
    return icons[type as keyof typeof icons] || icons.default;
  };

  // Convert polyline coordinates for Leaflet
  const routeCoordinates = route?.polyline?.map(coord => [coord[1], coord[0]] as [number, number]) || [];

  if (!isClient) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={finalCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={finalCenter} zoom={zoom} />
        
        {/* Route polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            color="#3b82f6"
            weight={4}
            opacity={0.8}
          />
        )}
        
        {/* User location marker */}
        {userLocation && (
          <Marker position={userLocation} icon={icons.user}>
            <Popup>
              <div className="text-center">
                <strong>Your Location</strong>
                <br />
                <small>Lat: {userLocation[0].toFixed(4)}, Lng: {userLocation[1].toFixed(4)}</small>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Additional markers */}
        {markers.map((marker, index) => (
          <Marker key={index} position={marker.position} icon={getMarkerIcon(marker.type)}>
            <Popup>
              <div className="text-center">
                <strong>{marker.title}</strong>
                {marker.description && (
                  <>
                    <br />
                    <small>{marker.description}</small>
                  </>
                )}
                {marker.type && (
                  <>
                    <br />
                    <span className="text-xs text-gray-500 capitalize">{marker.type}</span>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Map controls overlay */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-2">
        <div className="text-xs text-gray-600 mb-1">Legend:</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span className="text-xs">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs">Pharmacy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs">Restaurant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-xs">Destination</span>
          </div>
        </div>
      </div>

      {/* Route info overlay */}
      {route && (
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3">
          <div className="text-sm font-semibold mb-1">Route Information</div>
          <div className="text-xs text-gray-600">
            <div>Distance: {route.distance}</div>
            <div>Duration: {route.duration}</div>
          </div>
        </div>
      )}
    </div>
  );
}
