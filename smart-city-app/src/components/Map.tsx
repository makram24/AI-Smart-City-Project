"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom icons for different marker types with animations
const createCustomIcon = (color: string, size: number = 20) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color}; 
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      border: 2px solid white; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      cursor: pointer;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

const icons = {
  pharmacy: createCustomIcon('#10b981'), // green
  restaurant: createCustomIcon('#f59e0b'), // amber
  hospital: createCustomIcon('#ef4444'), // red
  bank: createCustomIcon('#3b82f6'), // blue
  metro: createCustomIcon('#dc2626'), // red
  bus: createCustomIcon('#2563eb'), // blue
  tram: createCustomIcon('#059669'), // green
  bike_station: createCustomIcon('#7c3aed'), // purple
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
    rating?: number;
    hours?: string;
    phone?: string;
    website?: string;
    image?: string;
  }>;
  route?: {
    polyline: number[][];
    distance: string;
    duration: string;
  };
  filters?: {
    categories: string[];
    maxDistance: number;
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

export default function Map({ center, zoom = 13, markers = [], route, filters }: MapProps) {
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

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Filter markers based on filters
  const filteredMarkers = markers.filter(marker => {
    if (filters?.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(marker.type || 'default')) {
        return false;
      }
    }
    
    if (filters?.maxDistance && userLocation) {
      const distance = calculateDistance(
        userLocation[0], userLocation[1],
        marker.position[0], marker.position[1]
      );
      if (distance > filters.maxDistance) {
        return false;
      }
    }
    
    return true;
  });

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
        
        {/* Clustered markers */}
        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          maxClusterRadius={50}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count < 10) size = 'small';
            else if (count < 100) size = 'medium';
            else size = 'large';
            
            return L.divIcon({
              html: `<div class="cluster-marker cluster-${size}">${count}</div>`,
              className: 'custom-cluster',
              iconSize: L.point(40, 40, true)
            });
          }}
        >
          {filteredMarkers.map((marker, index) => (
            <Marker key={index} position={marker.position} icon={getMarkerIcon(marker.type)}>
              <Popup maxWidth={300} minWidth={250}>
                <div className="popup-content">
                  {marker.image && (
                    <div className="popup-image mb-2">
                      <img 
                        src={marker.image} 
                        alt={marker.title}
                        className="w-full h-24 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="popup-header mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{marker.title}</h3>
                    {marker.rating && (
                      <div className="flex items-center mt-1">
                        <span className="text-yellow-500">★</span>
                        <span className="ml-1 text-sm text-gray-600">{marker.rating}/5</span>
                      </div>
                    )}
                  </div>
                  
                  {marker.description && (
                    <p className="text-sm text-gray-700 mb-2">{marker.description}</p>
                  )}
                  
                  <div className="popup-details space-y-1">
                    {marker.hours && (
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="font-medium">Hours:</span>
                        <span className="ml-1">{marker.hours}</span>
                      </div>
                    )}
                    {marker.phone && (
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="font-medium">Phone:</span>
                        <a href={`tel:${marker.phone}`} className="ml-1 text-blue-600 hover:underline">
                          {marker.phone}
                        </a>
                      </div>
                    )}
                    {marker.website && (
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="font-medium">Website:</span>
                        <a href={marker.website} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                          Visit
                        </a>
                      </div>
                    )}
                    {marker.type && (
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="font-medium">Type:</span>
                        <span className="ml-1 capitalize">{marker.type}</span>
                      </div>
                    )}
                  </div>
                  
                  {userLocation && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Distance: {calculateDistance(
                          userLocation[0], userLocation[1],
                          marker.position[0], marker.position[1]
                        ).toFixed(1)} km
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
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
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs">Bank</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs">Metro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-xs">Bus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
            <span className="text-xs">Tram</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-600"></div>
            <span className="text-xs">Bike Station</span>
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
