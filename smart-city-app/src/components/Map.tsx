"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Icon mappings for different marker types
const iconMap: { [key: string]: string } = {
  pharmacy: '💊',
  restaurant: '🍽️',
  hospital: '🏥',
  bank: '🏦',
  metro: '🚇',
  bus: '🚌',
  tram: '🚋',
  bike_station: '🚲',
  playbook: '📖',
  highlight: '⭐',
  historical: '🏛️',
  landmark: '📍',
  viewpoint: '👁️',
  thermal_bath: '♨️',
  spa: '♨️',
  default: '📍',
  destination: '🎯',
  user: '👤'
};

// Custom icons for different marker types with icons
const createCustomIcon = (type: string, color: string, size: number = 28) => {
  const icon = iconMap[type] || iconMap.default;
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
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${size * 0.6}px;
      line-height: 1;
    ">${icon}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

const icons = {
  pharmacy: createCustomIcon('pharmacy', '#10b981'), // green
  restaurant: createCustomIcon('restaurant', '#f59e0b'), // amber
  hospital: createCustomIcon('hospital', '#ef4444'), // red
  bank: createCustomIcon('bank', '#3b82f6'), // blue
  metro: createCustomIcon('metro', '#dc2626'), // red
  bus: createCustomIcon('bus', '#2563eb'), // blue
  tram: createCustomIcon('tram', '#059669'), // green
  bike_station: createCustomIcon('bike_station', '#7c3aed'), // purple
  playbook: createCustomIcon('playbook', '#0ea5e9'), // sky
  highlight: createCustomIcon('highlight', '#ec4899'), // pink
  historical: createCustomIcon('historical', '#9333ea'), // violet
  landmark: createCustomIcon('landmark', '#f97316'), // orange
  viewpoint: createCustomIcon('viewpoint', '#22d3ee'), // teal
  thermal_bath: createCustomIcon('thermal_bath', '#f97316', 32), // warm orange, larger
  spa: createCustomIcon('spa', '#f97316', 32), // warm orange, larger
  default: createCustomIcon('default', '#6b7280'), // gray
  destination: createCustomIcon('destination', '#8b5cf6'), // purple
  user: createCustomIcon('user', '#06b6d4') // cyan
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
  safetyAnalysis?: {
    segments: Array<{
      id: string;
      start: [number, number];
      end: [number, number];
      safetyLevel: 'safe' | 'moderate' | 'caution' | 'unsafe';
      factors: {
        lighting: 'well-lit' | 'moderate' | 'poor';
        construction?: boolean;
        accessibility?: 'accessible' | 'limited' | 'not-accessible';
        crimeRisk?: 'low' | 'medium' | 'high';
        pedestrianFriendly?: boolean;
      };
      description?: string;
    }>;
    overallSafety: 'safe' | 'moderate' | 'caution' | 'unsafe';
    safetyScore: number;
    warnings: string[];
    recommendations: string[];
  };
  constructionZones?: Array<{
    id: string;
    position: [number, number];
    radius: number;
    description: string;
  }>;
  filters?: {
    categories: string[];
    maxDistance: number;
  };
  onMarkerClick?: (position: [number, number], title: string) => void;
}

function MapController({ center, zoom, routeCoordinates }: { 
  center?: [number, number]; 
  zoom?: number;
  routeCoordinates?: [number, number][];
}) {
  const map = useMap();
  
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      // Fit map to show entire route
      try {
        const bounds = L.latLngBounds(routeCoordinates);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (e) {
        // Fallback to center if bounds calculation fails
        if (center) {
          map.setView(center, zoom || 13);
        }
      }
    } else if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, map, routeCoordinates]);

  return null;
}

export default function Map({ center, zoom = 13, markers = [], route, safetyAnalysis, constructionZones = [], filters, onMarkerClick }: MapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([47.4979, 19.0402]); // Budapest coordinates [lat, lng]
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Get user's current location (only if center is not provided from parent)
    // The parent (page.tsx) should handle user location and pass it as center prop
    if (isClient && !center && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Validate coordinates are in Budapest
          if (latitude >= 47.0 && latitude <= 48.0 && longitude >= 18.5 && longitude <= 19.5) {
            // Leaflet uses [lat, lng] format
            setUserLocation([latitude, longitude]);
            setMapCenter([latitude, longitude]);
            console.log(`✅ User location set in Map component: [${latitude}, ${longitude}] (lat, lng)`);
          } else {
            console.error(`❌ User location outside Budapest: [${latitude}, ${longitude}] - Using Budapest center`);
            // Fallback to Budapest center if location is invalid
            const budapestCenter: [number, number] = [47.4979, 19.0402]; // [lat, lng]
            setUserLocation(budapestCenter);
            setMapCenter(budapestCenter);
          }
        },
        (error) => {
          console.warn("Could not get user location:", error);
          // Fallback to Budapest center
          const budapestCenter: [number, number] = [47.4979, 19.0402]; // [lat, lng]
          setUserLocation(budapestCenter);
          setMapCenter(budapestCenter);
        }
      );
    } else if (center) {
      // If center is provided from parent, use it and extract user location from it
      // Center is in [lat, lng] format for Leaflet
      setMapCenter(center);
      setUserLocation(center); // Use center as user location for marker display
      console.log(`✅ Using center from parent: [${center[0]}, ${center[1]}] (lat, lng)`);
      console.log(`   This means: Latitude = ${center[0]}, Longitude = ${center[1]}`);
      console.log(`   Marker will be positioned at: [${center[0]}, ${center[1]}] (Leaflet format: [lat, lng])`);
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

  // Convert polyline coordinates for Leaflet FIRST (before filteredMarkers uses it)
  // Route prop receives [lat, lng] format from backend, Leaflet also uses [lat, lng]
  const routeCoordinates = useMemo(() => {
    if (!route?.polyline || !Array.isArray(route.polyline)) {
      return [];
    }
    
    console.log(`🗺️ Converting ${route.polyline.length} route coordinates for map display`);
    console.log(`   Raw first coordinate: [${route.polyline[0]?.[0]}, ${route.polyline[0]?.[1]}]`);
    
    const converted = route.polyline.map((coord: number[], index: number) => {
      if (Array.isArray(coord) && coord.length >= 2) {
        // Route prop should have [lat, lng] format from backend
        let lat = typeof coord[0] === 'number' ? coord[0] : parseFloat(coord[0]);
        let lng = typeof coord[1] === 'number' ? coord[1] : parseFloat(coord[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          console.error(`❌ Coordinate ${index} is non-numeric:`, coord);
          return null;
        }
        
        // STRICT validation - coordinates MUST be in Budapest
        // If coordinates are clearly outside Budapest, try swapping
        const isLikelySwapped = (lat < 47.0 || lat > 48.0) && (lng >= 47.0 && lng <= 48.0);
        const isValid = lat >= 47.0 && lat <= 48.0 && lng >= 18.5 && lng <= 19.5;
        
        if (!isValid && isLikelySwapped) {
          console.warn(`⚠️ Coordinate ${index} appears swapped: [${lat}, ${lng}] -> [${lng}, ${lat}]`);
          [lat, lng] = [lng, lat];
        }
        
        // Final validation - REJECT if still not in Budapest
        if (lat < 47.0 || lat > 48.0 || lng < 18.5 || lng > 19.5) {
          console.error(`❌ Coordinate ${index} outside Budapest: [${lat}, ${lng}] - REJECTING`);
          return null;
        }
        
        // Leaflet uses [lat, lng] format - already correct from backend
        return [lat, lng] as [number, number];
      }
      console.error(`❌ Invalid coordinate format at index ${index}:`, coord);
      return null;
    }).filter((coord): coord is [number, number] => {
      // Filter out nulls and validate one more time
      if (!coord) return false;
      const lat = coord[0];
      const lng = coord[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.error(`❌ Filtered coordinate not numeric:`, coord);
        return false;
      }
      const isValid = lat >= 47.0 && lat <= 48.0 && lng >= 18.5 && lng <= 19.5;
      if (!isValid) {
        console.error(`❌ Filtered coordinate still invalid: [${lat}, ${lng}] (lat, lng)`);
      }
      return isValid;
    });
    
    if (converted.length > 0) {
      console.log(`✅ Converted ${converted.length} valid coordinates (filtered ${route.polyline.length - converted.length} invalid)`);
      console.log(`   First: [${converted[0][0]}, ${converted[0][1]}] (lat, lng)`);
      console.log(`   Last: [${converted[converted.length - 1][0]}, ${converted[converted.length - 1][1]}] (lat, lng)`);
    } else {
      console.warn(`⚠️ Route polyline skipped: unable to convert any of the ${route.polyline.length} provided coordinates.`, route.polyline);
    }
    
    return converted;
  }, [route?.polyline]);

  // Filter markers based on filters AND validate coordinates (after routeCoordinates is defined)
  const filteredMarkers = markers.filter(marker => {
    // STRICT: First validate marker is in Budapest
    const lat = marker.position[0];
    const lng = marker.position[1];
    
    if (lat < 47.0 || lat > 48.0 || lng < 18.5 || lng > 19.5) {
      console.warn(`⚠️ Filtering out marker outside Budapest: [${lat}, ${lng}] - ${marker.title}`);
      return false;
    }
    
    // Don't show markers that are duplicates of route start/end
    if (routeCoordinates.length > 0) {
      const startCoord = routeCoordinates[0];
      const endCoord = routeCoordinates[routeCoordinates.length - 1];
      // routeCoordinates use [lat, lng], markers also use [lat, lng]
      const startLat = startCoord[0];
      const startLng = startCoord[1];
      const endLat = endCoord[0];
      const endLng = endCoord[1];
      
      // Check if marker is too close to route start or end (within 50 meters)
      const isNearStart = Math.abs(lat - startLat) < 0.0005 && Math.abs(lng - startLng) < 0.0005;
      const isNearEnd = Math.abs(lat - endLat) < 0.0005 && Math.abs(lng - endLng) < 0.0005;
      
      if (isNearStart || isNearEnd) {
        console.log(`⚠️ Filtering out duplicate marker near route ${isNearStart ? 'start' : 'end'}: ${marker.title}`);
        return false;
      }
    }
    
    // Apply category filters
    if (filters?.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(marker.type || 'default')) {
        return false;
      }
    }
    
    // Apply distance filters
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
    const icon = icons[type as keyof typeof icons];
    if (icon) {
      // Log icon selection for metro and tram
      if (type === 'metro' || type === 'tram') {
        console.log(`📍 Using ${type} icon for marker`);
      }
      return icon;
    }
    console.warn(`⚠️ Unknown marker type: ${type}, using default icon`);
    return icons.default;
  };

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
        
        <MapController center={finalCenter} zoom={zoom} routeCoordinates={routeCoordinates} />
        
        {/* Construction Zones */}
        {constructionZones.map((zone) => (
          <Circle
            key={zone.id}
            center={zone.position}
            radius={zone.radius}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#fbbf24',
              fillOpacity: 0.2,
              weight: 2,
              dashArray: '10, 5'
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong className="text-amber-900">⚠️ Construction Zone</strong>
                <p className="text-xs text-gray-600 mt-1">{zone.description}</p>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Route polyline with safety visualization */}
        {routeCoordinates.length > 0 && (
          <>
            {safetyAnalysis && safetyAnalysis.segments.length > 0 ? (
              // Render safety-colored segments
              safetyAnalysis.segments.map((segment) => {
                const segmentCoords: [number, number][] = [segment.start, segment.end];
                const getSafetyColor = (level: string) => {
                  switch (level) {
                    case 'safe': return '#10b981'; // green
                    case 'moderate': return '#3b82f6'; // blue
                    case 'caution': return '#f59e0b'; // amber
                    case 'unsafe': return '#ef4444'; // red
                    default: return '#6b7280'; // gray
                  }
                };
                const getSafetyWeight = (level: string) => {
                  return level === 'unsafe' || level === 'caution' ? 7 : 5;
                };
                
                return (
                  <Polyline
                    key={segment.id}
                    positions={segmentCoords}
                    color={getSafetyColor(segment.safetyLevel)}
                    weight={getSafetyWeight(segment.safetyLevel)}
                    opacity={0.85}
                    smoothFactor={1}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className={`font-semibold mb-1 ${
                          segment.safetyLevel === 'safe' ? 'text-green-700' :
                          segment.safetyLevel === 'moderate' ? 'text-blue-700' :
                          segment.safetyLevel === 'caution' ? 'text-amber-700' :
                          'text-red-700'
                        }`}>
                          {segment.safetyLevel === 'safe' ? '✅ Safe' :
                           segment.safetyLevel === 'moderate' ? 'ℹ️ Moderate' :
                           segment.safetyLevel === 'caution' ? '⚠️ Caution' :
                           '🚨 Unsafe'}
                        </div>
                        {segment.description && (
                          <p className="text-xs text-gray-600 mb-2">{segment.description}</p>
                        )}
                        <div className="text-xs space-y-1">
                          {segment.factors.lighting && (
                            <div className="flex items-center gap-1">
                              <span>💡</span>
                              <span className="capitalize">{segment.factors.lighting.replace('-', ' ')}</span>
                            </div>
                          )}
                          {segment.factors.construction && (
                            <div className="flex items-center gap-1 text-amber-600">
                              <span>🚧</span>
                              <span>Construction zone</span>
                            </div>
                          )}
                          {segment.factors.accessibility && (
                            <div className="flex items-center gap-1">
                              <span>♿</span>
                              <span className="capitalize">{segment.factors.accessibility.replace('-', ' ')}</span>
                            </div>
                          )}
                          {segment.factors.crimeRisk && (
                            <div className="flex items-center gap-1">
                              <span>🛡️</span>
                              <span className="capitalize">{segment.factors.crimeRisk} crime risk</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })
            ) : (
              // Default route polyline if no safety analysis
              <Polyline
                positions={routeCoordinates}
                color="#3b82f6"
                weight={5}
                opacity={0.8}
                smoothFactor={1}
              />
            )}
            {/* Start marker - ONLY if coordinate is valid and in Budapest */}
            {routeCoordinates.length > 0 && (() => {
              const startCoord = routeCoordinates[0];
              // Validate start coordinate is in Budapest (Leaflet format: [lat, lng])
              const startLat = startCoord[0];
              const startLng = startCoord[1];
              
              // STRICT validation - must be in Budapest
              if (startLat >= 47.0 && startLat <= 48.0 && startLng >= 18.5 && startLng <= 19.5) {
                console.log(`✅ Route start marker: [${startLat}, ${startLng}] (valid)`);
                return (
                  <Marker key="route-start" position={startCoord} icon={icons.user}>
                    <Popup>
                      <div className="text-center">
                        <strong>Route Start</strong>
                        <br />
                        <small>Your location</small>
                      </div>
                    </Popup>
                  </Marker>
                );
              } else {
                console.error(`❌ Route start coordinate invalid: [${startLat}, ${startLng}] - NOT displaying marker`);
                return null;
              }
            })()}
            {/* End marker - ONLY if coordinate is valid and in Budapest */}
            {routeCoordinates.length > 1 && (() => {
              const endCoord = routeCoordinates[routeCoordinates.length - 1];
              // Validate end coordinate is in Budapest (Leaflet format: [lat, lng])
              const endLat = endCoord[0];
              const endLng = endCoord[1];
              
              // STRICT validation - must be in Budapest
              if (endLat >= 47.0 && endLat <= 48.0 && endLng >= 18.5 && endLng <= 19.5) {
                console.log(`✅ Route end marker: [${endLat}, ${endLng}] (valid)`);
                return (
                  <Marker key="route-end" position={endCoord} icon={icons.destination}>
                    <Popup>
                      <div className="text-center">
                        <strong>Destination</strong>
                        <br />
                        <small>{route?.distance || 'N/A'} • {route?.duration || 'N/A'}</small>
                      </div>
                    </Popup>
                  </Marker>
                );
              } else {
                console.error(`❌ Route end coordinate invalid: [${endLat}, ${endLng}] - NOT displaying marker`);
                return null;
              }
            })()}
          </>
        )}
        
        {/* User location marker - only show if no route (to avoid duplicate with route start) */}
        {userLocation && routeCoordinates.length === 0 && (() => {
          // userLocation is in [lat, lng] format for Leaflet (from center prop)
          const lat = userLocation[0]; // First element is latitude
          const lng = userLocation[1]; // Second element is longitude
          
          console.log(`📍 User location marker - Raw array: [${userLocation[0]}, ${userLocation[1]}]`);
          console.log(`   Interpreted as: Latitude=${lat}, Longitude=${lng}`);
          
          // Validate user location is in Budapest
          if (lat >= 47.0 && lat <= 48.0 && lng >= 18.5 && lng <= 19.5) {
            // userLocation is already in [lat, lng] format, use it directly
            console.log(`✅ Displaying marker at position: [${lat}, ${lng}] (Leaflet [lat, lng] format)`);
            console.log(`   This is: Latitude ${lat.toFixed(7)}, Longitude ${lng.toFixed(7)}`);
            
            return (
              <Marker position={userLocation} icon={icons.user}>
                <Popup>
                  <div className="text-center">
                    <strong>Your Location</strong>
                    <br />
                    <small>Latitude: {lat.toFixed(7)}</small>
                    <br />
                    <small>Longitude: {lng.toFixed(7)}</small>
                  </div>
                </Popup>
              </Marker>
            );
          } else {
            console.error(`❌ User location invalid: Lat: ${lat}, Lng: ${lng} - Not displaying marker`);
          }
          return null;
        })()}
        
        
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
          {filteredMarkers.map((marker, index) => {
            const icon = getMarkerIcon(marker.type);
            // Log metro and tram markers specifically
            if (marker.type === 'metro' || marker.type === 'tram') {
              console.log(`📍 Displaying ${marker.type} marker: ${marker.title} at [${marker.position[0]}, ${marker.position[1]}]`);
            }
            return (
              <Marker key={index} position={marker.position} icon={icon}>
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
                      <div className="text-xs text-gray-500 mb-2">
                        Distance: {calculateDistance(
                          userLocation[0], userLocation[1],
                          marker.position[0], marker.position[1]
                        ).toFixed(1)} km
                      </div>
                      {onMarkerClick && (
                        <button
                          onClick={() => onMarkerClick(marker.position, marker.title)}
                          className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          Get Directions
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
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
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs">Thermal Bath</span>
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
