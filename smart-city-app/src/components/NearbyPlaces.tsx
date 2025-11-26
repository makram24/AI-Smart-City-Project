"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, MapPin, Navigation } from "lucide-react";
import { apiService, Place } from "@/lib/api";

interface NearbyPlacesProps {
  userLocation: { lat: number; lng: number } | null;
  onRouteRequest?: (mode: 'walking' | 'cycling' | 'public_transport', destination: string) => void;
}

const categoryOrder = ['pharmacy', 'hospital', 'restaurant', 'cafe', 'bank', 'atm', 'clinic', 'fuel', 'parking', 'hotel'];
const categoryLabels: { [key: string]: string } = {
  pharmacy: 'Pharmacies',
  hospital: 'Hospitals',
  restaurant: 'Restaurants',
  cafe: 'Cafes',
  bank: 'Banks',
  atm: 'ATMs',
  clinic: 'Clinics',
  fuel: 'Gas Stations',
  parking: 'Parking',
  hotel: 'Hotels',
  place: 'Other Places'
};

export default function NearbyPlaces({ userLocation, onRouteRequest }: NearbyPlacesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLocation && isExpanded) {
      loadNearbyPlaces();
    }
  }, [userLocation, isExpanded]);

  const loadNearbyPlaces = async () => {
    if (!userLocation) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Use optimized endpoint to fetch all nearby places at once
      const allPlaces = await apiService.getNearbyPlaces(userLocation.lat, userLocation.lng, 1000);
      
      setPlaces(allPlaces);
      console.log(`📍 Loaded ${allPlaces.length} nearby places`);
    } catch (error) {
      console.error('Error loading nearby places:', error);
      setError('Failed to load nearby places');
    } finally {
      setLoading(false);
    }
  };

  // Group places by category
  const placesByCategory = places.reduce((acc, place) => {
    const category = place.type || 'place';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(place);
    return acc;
  }, {} as { [key: string]: Place[] });

  // Sort categories by predefined order
  const sortedCategories = Object.keys(placesByCategory).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">
            Nearby Places {places.length > 0 && `(${places.length})`}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading nearby places...</div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-red-500">{error}</div>
          ) : places.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No nearby places found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sortedCategories.map((category) => {
                const categoryPlaces = placesByCategory[category];
                return (
                  <div key={category} className="p-2">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide px-2">
                      {categoryLabels[category] || category}
                    </h4>
                    <div className="space-y-1">
                      {categoryPlaces.slice(0, 10).map((place) => {
                        const handlePlaceClick = () => {
                          if (onRouteRequest && place.position) {
                            // Convert position [lat, lng] to "lat,lng" string format
                            const destination = `${place.position[0]},${place.position[1]}`;
                            console.log(`🗺️ Requesting route to ${place.name} at ${destination}`);
                            onRouteRequest('walking', destination);
                          }
                        };
                        
                        return (
                          <div
                            key={place.id}
                            onClick={handlePlaceClick}
                            className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer transition-colors border border-transparent hover:border-blue-200 group"
                            title={`Click to get directions to ${place.name}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                  {place.name}
                                </div>
                                <Navigation className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              {place.description && (
                                <div className="text-xs text-gray-500 truncate">
                                  {place.description}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 ml-2 flex-shrink-0">
                              {place.distance}
                            </div>
                          </div>
                        );
                      })}
                      {categoryPlaces.length > 10 && (
                        <div className="text-xs text-gray-400 px-2 py-1">
                          +{categoryPlaces.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

