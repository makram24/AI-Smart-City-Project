"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Bus, 
  Train, 
  Bike, 
  Footprints, 
  MapPin, 
  Clock, 
  AlertTriangle,
  Cloud,
  CloudRain,
  Sun,
  ChevronDown,
  ChevronUp,
  Navigation
} from "lucide-react";
import { apiService, TransportStop, BikeStation, WeatherData, WeatherContext, RouteConfidence } from "@/lib/api";
import NearbyPlaces from "./NearbyPlaces";
import HistoricalPlaces from "./HistoricalPlaces";
import TransportFeedback from "./TransportFeedback";

interface TransportPanelProps {
  userLocation: { lat: number; lng: number } | null;
  onRouteRequest: (mode: 'walking' | 'cycling' | 'public_transport', destination: string) => void;
  onTransportStopsChange?: (stops: TransportStop[]) => void;
  onBikeStationsChange?: (stations: BikeStation[]) => void;
  onClose?: () => void;
}

export default function TransportPanel({ userLocation, onRouteRequest, onTransportStopsChange, onBikeStationsChange, onClose }: TransportPanelProps) {
  const [transportStops, setTransportStops] = useState<TransportStop[]>([]);
  const [bikeStations, setBikeStations] = useState<BikeStation[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherContext, setWeatherContext] = useState<WeatherContext | null>(null);
  const [destination, setDestination] = useState("");
  const [selectedMode, setSelectedMode] = useState<'walking' | 'cycling' | 'public_transport'>('walking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransportExpanded, setIsTransportExpanded] = useState(true);
  const [isRoutePlanningExpanded, setIsRoutePlanningExpanded] = useState(true);
  const [selectedFeedbackRoute, setSelectedFeedbackRoute] = useState<{ routeId: string; routeType: 'bus' | 'tram' | 'metro' | 'trolley'; routeName: string } | null>(null);
  const [routeConfidences, setRouteConfidences] = useState<Map<string, RouteConfidence>>(new Map());

  useEffect(() => {
    if (userLocation) {
      loadTransportData();
      loadWeatherData();
    }
  }, [userLocation]);

  const loadTransportData = async () => {
    if (!userLocation) return;
    
    setLoading(true);
    try {
      console.log('Loading transport data for location:', userLocation);
      const [stops, bikes] = await Promise.all([
        apiService.getTransportStops(userLocation.lat, userLocation.lng, 500),
        apiService.getBikeStations(userLocation.lat, userLocation.lng, 1000)
      ]);
      
      console.log('Transport stops loaded:', stops);
      console.log('Bike stations loaded:', bikes);
      
      setTransportStops(stops);
      setBikeStations(bikes);
      
      // Notify parent component about transport stops and bike stations
      if (onTransportStopsChange) {
        onTransportStopsChange(stops);
      }
      if (onBikeStationsChange) {
        onBikeStationsChange(bikes);
      }
    } catch (error) {
      console.error('Error loading transport data:', error);
      setError('Failed to load transport data');
    } finally {
      setLoading(false);
    }
  };

  const loadWeatherData = async () => {
    try {
      console.log('Loading weather data...');
      const weatherData = await apiService.getCurrentWeather();
      console.log('Weather data loaded:', weatherData);
      if (weatherData) {
        setWeather(weatherData.weather);
        setWeatherContext(weatherData.context);
      }
    } catch (error) {
      console.error('Error loading weather data:', error);
      setError('Failed to load weather data');
    }
  };

  const handleRouteRequest = () => {
    if (destination.trim()) {
      onRouteRequest(selectedMode, destination.trim());
    }
  };

  const getWeatherIcon = (description: string) => {
    if (description.includes('rain')) return <CloudRain className="w-4 h-4 text-blue-500" />;
    if (description.includes('cloud')) return <Cloud className="w-4 h-4 text-gray-500" />;
    return <Sun className="w-4 h-4 text-yellow-500" />;
  };

  const getModeIcon = (mode: string, size: number = 16) => {
    const sizeClass = size === 18 ? "w-[18px] h-[18px]" : "w-4 h-4";
    switch (mode) {
      case 'walking': return <Footprints className={sizeClass} />;
      case 'cycling': return <Bike className={sizeClass} />;
      case 'public_transport': return <Bus className={sizeClass} />;
      default: return <Footprints className={sizeClass} />;
    }
  };

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Transport & Weather</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition"
            title="Close Transport Panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Weather Section */}
      {weather && weatherContext && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getWeatherIcon(weather.description)}
              <span className="text-sm font-medium">{weather.temperature}°C</span>
            </div>
            <span className="text-xs text-gray-500 capitalize">{weather.description}</span>
          </div>
          
          {weatherContext.recommendations.length > 0 && (
            <div className="mt-2">
              {weatherContext.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-gray-600 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Route Planning */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <button
          onClick={() => setIsRoutePlanningExpanded(!isRoutePlanningExpanded)}
          className="w-full flex items-center justify-between mb-3 hover:bg-white/50 -mx-2 px-2 py-1 rounded transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Plan Route</h3>
          </div>
          {isRoutePlanningExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </button>
        
        {isRoutePlanningExpanded && (
          <div className="space-y-4">
            {/* Mode Selection */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Transport Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {(['walking', 'cycling', 'public_transport'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`
                      flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all
                      ${selectedMode === mode 
                        ? 'border-blue-600 bg-blue-600 text-white shadow-md' 
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                      }
                    `}
                  >
                    <div className={selectedMode === mode ? 'text-white' : 'text-gray-600'}>
                      {getModeIcon(mode, selectedMode === mode ? 18 : 16)}
                    </div>
                    <span className="text-xs font-medium capitalize">
                      {mode.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Input */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Destination</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Enter destination address..."
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && destination.trim()) {
                        handleRouteRequest();
                      }
                    }}
                    className="pl-10 pr-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                  />
                </div>
                <Button 
                  onClick={handleRouteRequest} 
                  disabled={!destination.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Navigation className="w-4 h-4 mr-1.5" />
                  Go
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transport Stops */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={() => setIsTransportExpanded(!isTransportExpanded)}
            className="w-full flex items-center justify-between mb-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
          >
            <h3 className="text-sm font-medium text-gray-900">Nearby Transport</h3>
            {isTransportExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          {error && (
            <div className="text-center text-sm text-red-500 mb-3">{error}</div>
          )}
          
          {/* Debug info */}
          <div className="text-xs text-gray-400 mb-2">
            Debug: Stops: {transportStops.length}, Bikes: {bikeStations.length}, Weather: {weather ? 'Yes' : 'No'}
          </div>
          
          {isTransportExpanded && (
            <>
              {loading ? (
                <div className="text-center text-sm text-gray-500">Loading transport data...</div>
              ) : !userLocation ? (
                <div className="text-center text-sm text-gray-500">Location not available</div>
              ) : (
                <div className="space-y-3">
              {/* Metro Stops */}
              {transportStops.filter(stop => stop.type === 'metro').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Metro Stations</h4>
                  {transportStops.filter(stop => stop.type === 'metro').slice(0, 5).map((stop) => {
                    const handleStopClick = () => {
                      if (onRouteRequest && stop.position) {
                        const destination = `${stop.position[0]},${stop.position[1]}`;
                        console.log(`🗺️ Requesting route to ${stop.name} at ${destination}`);
                        onRouteRequest('walking', destination);
                      }
                    };
                    
                    return (
                      <div 
                        key={stop.id} 
                        onClick={handleStopClick}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2 hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-200 group"
                        title={`Click to get directions to ${stop.name}`}
                      >
                        <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                          <Train className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium group-hover:text-blue-600">{stop.name}</div>
                            <Navigation className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-xs text-gray-500">
                            {stop.routes.join(', ')} • {stop.routes.length} {stop.routes.length === 1 ? 'line' : 'lines'}
                          </div>
                          {/* Route Confidence Indicators */}
                          <div className="flex items-center gap-2 mt-1">
                            {stop.routes.slice(0, 2).map((routeId) => {
                              const confidence = routeConfidences.get(`${stop.type}_${routeId}`);
                              if (!confidence) return null;
                              return (
                                <button
                                  key={routeId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFeedbackRoute({
                                      routeId,
                                      routeType: stop.type,
                                      routeName: `${stop.type.toUpperCase()} ${routeId}`
                                    });
                                  }}
                                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    confidence.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                    confidence.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}
                                  title={`${confidence.sentiment} • ${confidence.averageReliability}/5 reliability • ${confidence.feedbackCount} reviews`}
                                >
                                  <span>{routeId}</span>
                                  <span className="text-[9px]">
                                    {confidence.sentiment === 'positive' ? '👍' :
                                     confidence.sentiment === 'negative' ? '👎' : '➖'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tram Stops */}
              {transportStops.filter(stop => stop.type === 'tram').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Tram Stops</h4>
                  {transportStops.filter(stop => stop.type === 'tram').slice(0, 5).map((stop) => {
                    const handleStopClick = () => {
                      if (onRouteRequest && stop.position) {
                        const destination = `${stop.position[0]},${stop.position[1]}`;
                        console.log(`🗺️ Requesting route to ${stop.name} at ${destination}`);
                        onRouteRequest('walking', destination);
                      }
                    };
                    
                    return (
                      <div 
                        key={stop.id} 
                        onClick={handleStopClick}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2 hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-200 group"
                        title={`Click to get directions to ${stop.name}`}
                      >
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                          <Train className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium group-hover:text-blue-600">{stop.name}</div>
                            <Navigation className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-xs text-gray-500">
                            {stop.routes.join(', ')} • {stop.routes.length} {stop.routes.length === 1 ? 'line' : 'lines'}
                          </div>
                          {/* Route Confidence Indicators */}
                          <div className="flex items-center gap-2 mt-1">
                            {stop.routes.slice(0, 2).map((routeId) => {
                              const confidence = routeConfidences.get(`${stop.type}_${routeId}`);
                              if (!confidence) return null;
                              return (
                                <button
                                  key={routeId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFeedbackRoute({
                                      routeId,
                                      routeType: stop.type,
                                      routeName: `${stop.type.toUpperCase()} ${routeId}`
                                    });
                                  }}
                                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    confidence.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                    confidence.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}
                                  title={`${confidence.sentiment} • ${confidence.averageReliability}/5 reliability • ${confidence.feedbackCount} reviews`}
                                >
                                  <span>{routeId}</span>
                                  <span className="text-[9px]">
                                    {confidence.sentiment === 'positive' ? '👍' :
                                     confidence.sentiment === 'negative' ? '👎' : '➖'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bus Stops */}
              {transportStops.filter(stop => stop.type === 'bus').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Bus Stops</h4>
                  {transportStops.filter(stop => stop.type === 'bus').slice(0, 5).map((stop) => {
                    const handleStopClick = () => {
                      if (onRouteRequest && stop.position) {
                        const destination = `${stop.position[0]},${stop.position[1]}`;
                        console.log(`🗺️ Requesting route to ${stop.name} at ${destination}`);
                        onRouteRequest('walking', destination);
                      }
                    };
                    
                    return (
                      <div 
                        key={stop.id} 
                        onClick={handleStopClick}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2 hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-200 group"
                        title={`Click to get directions to ${stop.name}`}
                      >
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <Bus className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium group-hover:text-blue-600">{stop.name}</div>
                            <Navigation className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-xs text-gray-500">
                            {stop.routes.join(', ')} • {stop.routes.length} {stop.routes.length === 1 ? 'route' : 'routes'}
                          </div>
                          {/* Route Confidence Indicators */}
                          <div className="flex items-center gap-2 mt-1">
                            {stop.routes.slice(0, 2).map((routeId) => {
                              const confidence = routeConfidences.get(`${stop.type}_${routeId}`);
                              if (!confidence) return null;
                              return (
                                <button
                                  key={routeId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFeedbackRoute({
                                      routeId,
                                      routeType: stop.type,
                                      routeName: `${stop.type.toUpperCase()} ${routeId}`
                                    });
                                  }}
                                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    confidence.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                    confidence.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}
                                  title={`${confidence.sentiment} • ${confidence.averageReliability}/5 reliability • ${confidence.feedbackCount} reviews`}
                                >
                                  <span>{routeId}</span>
                                  <span className="text-[9px]">
                                    {confidence.sentiment === 'positive' ? '👍' :
                                     confidence.sentiment === 'negative' ? '👎' : '➖'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bike Stations */}
              {bikeStations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Bike Stations</h4>
                  {bikeStations.slice(0, 5).map((station) => {
                    const handleStationClick = () => {
                      if (onRouteRequest) {
                        // Try position first, then lat/lng, then fallback
                        let destination: string | null = null;
                        if (station.position) {
                          destination = `${station.position[0]},${station.position[1]}`;
                        } else if (station.lat !== undefined && station.lng !== undefined) {
                          destination = `${station.lat},${station.lng}`;
                        }
                        
                        if (destination) {
                          console.log(`🗺️ Requesting route to ${station.stationName} at ${destination}`);
                          onRouteRequest('walking', destination);
                        } else {
                          console.warn(`No coordinates available for bike station ${station.stationName}`);
                        }
                      }
                    };
                    
                    return (
                      <div 
                        key={station.stationId} 
                        onClick={handleStationClick}
                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg mb-2 hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-200 group"
                        title={`Click to get directions to ${station.stationName}`}
                      >
                        <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
                          <Bike className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium group-hover:text-blue-600">{station.stationName}</div>
                            <Navigation className="w-3 h-3 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-xs text-gray-500">
                            {station.availableBikes} bikes • {station.availableDocks} docks
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {Math.round(station.distance)}m
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Nearby Places List */}
        <NearbyPlaces 
          userLocation={userLocation} 
          onRouteRequest={onRouteRequest}
        />
        
        {/* Historical Places List */}
        <HistoricalPlaces 
          userLocation={userLocation} 
          onRouteRequest={onRouteRequest}
        />
      </div>

      {/* Transport Feedback Modal */}
      {selectedFeedbackRoute && (
        <TransportFeedback
          routeId={selectedFeedbackRoute.routeId}
          routeType={selectedFeedbackRoute.routeType}
          routeName={selectedFeedbackRoute.routeName}
          onClose={() => setSelectedFeedbackRoute(null)}
          onFeedbackSubmitted={() => {
            loadRouteConfidences();
          }}
        />
      )}
    </div>
  );
}
