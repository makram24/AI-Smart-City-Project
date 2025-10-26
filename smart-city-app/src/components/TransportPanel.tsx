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
  Sun
} from "lucide-react";
import { apiService, TransportStop, BikeStation, WeatherData, WeatherContext } from "@/lib/api";

interface TransportPanelProps {
  userLocation: { lat: number; lng: number } | null;
  onRouteRequest: (mode: 'walking' | 'cycling' | 'public_transport', destination: string) => void;
}

export default function TransportPanel({ userLocation, onRouteRequest }: TransportPanelProps) {
  const [transportStops, setTransportStops] = useState<TransportStop[]>([]);
  const [bikeStations, setBikeStations] = useState<BikeStation[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherContext, setWeatherContext] = useState<WeatherContext | null>(null);
  const [destination, setDestination] = useState("");
  const [selectedMode, setSelectedMode] = useState<'walking' | 'cycling' | 'public_transport'>('walking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'walking': return <Footprints className="w-4 h-4" />;
      case 'cycling': return <Bike className="w-4 h-4" />;
      case 'public_transport': return <Bus className="w-4 h-4" />;
      default: return <Footprints className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Transport & Weather</h2>
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
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Plan Route</h3>
        
        {/* Mode Selection */}
        <div className="flex gap-2 mb-3">
          {(['walking', 'cycling', 'public_transport'] as const).map((mode) => (
            <Button
              key={mode}
              variant={selectedMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMode(mode)}
              className="flex items-center gap-1"
            >
              {getModeIcon(mode)}
              <span className="capitalize">{mode.replace('_', ' ')}</span>
            </Button>
          ))}
        </div>

        {/* Destination Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter destination..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleRouteRequest} disabled={!destination.trim()}>
            <MapPin className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Transport Stops */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Nearby Transport</h3>
          
          {error && (
            <div className="text-center text-sm text-red-500 mb-3">{error}</div>
          )}
          
          {/* Debug info */}
          <div className="text-xs text-gray-400 mb-2">
            Debug: Stops: {transportStops.length}, Bikes: {bikeStations.length}, Weather: {weather ? 'Yes' : 'No'}
          </div>
          
          {loading ? (
            <div className="text-center text-sm text-gray-500">Loading transport data...</div>
          ) : !userLocation ? (
            <div className="text-center text-sm text-gray-500">Location not available</div>
          ) : (
            <div className="space-y-3">
              {/* Metro Stops */}
              {transportStops.filter(stop => stop.type === 'metro').slice(0, 3).map((stop) => (
                <div key={stop.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                    <Train className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{stop.name}</div>
                    <div className="text-xs text-gray-500">
                      {stop.routes.join(', ')} • {stop.routes.length} lines
                    </div>
                  </div>
                </div>
              ))}

              {/* Bus Stops */}
              {transportStops.filter(stop => stop.type === 'bus').slice(0, 2).map((stop) => (
                <div key={stop.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bus className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{stop.name}</div>
                    <div className="text-xs text-gray-500">
                      {stop.routes.join(', ')} • {stop.routes.length} routes
                    </div>
                  </div>
                </div>
              ))}

              {/* Bike Stations */}
              {bikeStations.slice(0, 3).map((station) => (
                <div key={station.stationId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
                    <Bike className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{station.stationName}</div>
                    <div className="text-xs text-gray-500">
                      {station.availableBikes} bikes • {station.availableDocks} docks
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {Math.round(station.distance)}m
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
