"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, MapPin, Navigation, Landmark, Clock } from "lucide-react";
import { apiService, HistoricalPlace } from "@/lib/api";

interface HistoricalPlacesProps {
  userLocation: { lat: number; lng: number } | null;
  onRouteRequest?: (mode: 'walking' | 'cycling' | 'public_transport', destination: string) => void;
}

export default function HistoricalPlaces({ userLocation, onRouteRequest }: HistoricalPlacesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [places, setPlaces] = useState<HistoricalPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLocation && isExpanded) {
      loadHistoricalPlaces();
    }
  }, [userLocation, isExpanded]);

  const loadHistoricalPlaces = async () => {
    if (!userLocation) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedPlaces = await apiService.getHistoricalPlaces(userLocation.lat, userLocation.lng, 5000);
      
      // Sort by distance
      const sortedPlaces = fetchedPlaces.sort((a, b) => {
        const distA = parseFloat(a.distance.replace(' km', '')) || 999;
        const distB = parseFloat(b.distance.replace(' km', '')) || 999;
        return distA - distB;
      });
      
      setPlaces(sortedPlaces);
      console.log(`🏛️ Loaded ${sortedPlaces.length} historical places`);
    } catch (err) {
      console.error('Error loading historical places:', err);
      setError('Failed to load historical places');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm font-semibold text-gray-900 mb-3 hover:bg-white/50 -mx-2 px-2 py-1 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
            <Landmark className="w-4 h-4 text-white" />
          </div>
          <span>Historical Places ({places.length})</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-sm text-gray-500">Loading historical places...</div>
          ) : error ? (
            <div className="text-center text-sm text-red-500">{error}</div>
          ) : places.length === 0 ? (
            <div className="text-center text-sm text-gray-500">No historical places found.</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {places.slice(0, 20).map((place) => {
                const handlePlaceClick = () => {
                  if (onRouteRequest && place.position) {
                    const destination = `${place.position[0]},${place.position[1]}`;
                    console.log(`🗺️ Requesting route to ${place.name} at ${destination}`);
                    onRouteRequest('walking', destination);
                  }
                };
                
                return (
                  <div
                    key={place.id}
                    onClick={handlePlaceClick}
                    className="p-3 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all group"
                    title={`Click to get directions to ${place.name}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                        <Landmark className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900 group-hover:text-amber-700">
                            {place.name}
                          </h4>
                          <Navigation className="w-3 h-3 text-gray-400 group-hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                          {place.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {place.historicType && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                              {place.historicType}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {place.distance}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {places.length > 20 && (
                <div className="text-center text-xs text-gray-500 pt-2">
                  Showing 20 of {places.length} historical places
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

