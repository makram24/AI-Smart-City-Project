"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Chat from "@/components/Chat";
import TransportPanel from "@/components/TransportPanel";
import MapFilters from "@/components/MapFilters";
import { NeighborhoodPlaybooks } from "@/components/NeighborhoodPlaybooks";
import Moodboard from "@/components/Moodboard";
import StoryCardComponent from "@/components/StoryCard";
import { apiService, ChatMessage, MapMarker, PlaybookSummary, PlaybookDetail, PersonaContext, MoodboardSuggestion, StoryCard, StoryTrigger } from "@/lib/api";
import { isWithinBudapest, normalizeCoordinate } from "@/lib/geoValidation";

// Dynamically import Map to avoid SSR issues
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  )
});

const DEFAULT_PERSONA: PersonaContext = {
  id: "local_concierge",
  name: "City Concierge",
  tagline: "Friendly guide for everyday Budapest plans.",
  tone: "balanced",
  recommendedPrompts: [
    "What is near me right now?",
    "Plan a scenic walk along the Danube",
    "Check tram arrivals around me"
  ]
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<{
    polyline: number[][];
    distance: string;
    duration: string;
  } | null>(null);
  const [mapFilters, setMapFilters] = useState<{
    categories: string[];
    maxDistance: number;
  }>({
    categories: [],
    maxDistance: 2
  });
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookDetail | null>(null);
  const [loadingPlaybookId, setLoadingPlaybookId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaContext | null>(null);
  const [activeStory, setActiveStory] = useState<StoryCard | null>(null);
  const [storyTriggers, setStoryTriggers] = useState<StoryTrigger[]>([]);

  const sanitizeRoute = (route?: ChatMessage["route"] | null) => {
    if (!route || !route.polyline) {
      return null;
    }

    const polyline = route.polyline
      .map((coord) => normalizeCoordinate(coord as [number, number]))
      .filter((coord): coord is [number, number] => !!coord);

    if (polyline.length === 0) {
      return null;
    }

    return {
      ...route,
      polyline
    };
  };

  // Check API connection on mount
  useEffect(() => {
    const checkApi = async () => {
      const connected = await apiService.healthCheck();
      setApiConnected(connected);
      if (!connected) {
        console.warn('Backend API not connected. Using mock responses.');
      }
    };
    checkApi();
  }, []);

  useEffect(() => {
    if (!apiConnected) {
      return;
    }

    let isMounted = true;
    const loadPlaybooks = async () => {
      try {
        const list = await apiService.getPlaybooks();
        if (isMounted) {
          setPlaybooks(list);
        }
      } catch (error) {
        console.error('Failed to fetch playbooks:', error);
      }
    };

    loadPlaybooks();

    return () => {
      isMounted = false;
    };
  }, [apiConnected]);

  // Check for stories near route when route changes
  useEffect(() => {
    if (!apiConnected || !currentRoute || !currentRoute.polyline || currentRoute.polyline.length < 2) {
      setStoryTriggers([]);
      setActiveStory(null);
      return;
    }

    let isMounted = true;
    const checkStories = async () => {
      try {
        const triggers = await apiService.getStoriesNearRoute(currentRoute.polyline, 500);
        if (!isMounted) return;
        
        setStoryTriggers(triggers);

        // Auto-show the closest story if it should be shown
        const closestTrigger = triggers.find(t => t.shouldShow);
        if (closestTrigger) {
          const story = await apiService.getStoryById(closestTrigger.storyId);
          if (story && isMounted) {
            setActiveStory(story);
          }
        }
      } catch (error) {
        console.error('Failed to check stories near route:', error);
      }
    };

    checkStories();

    return () => {
      isMounted = false;
    };
  }, [currentRoute, apiConnected]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          
          console.log(`📍 Raw geolocation: latitude=${latitude}, longitude=${longitude}`);
          
          // Validate coordinates are in Budapest
          if (isWithinBudapest(latitude, longitude)) {
            setUserLocation({ lat: latitude, lng: longitude });
            console.log(`✅ User location set: lat=${latitude}, lng=${longitude}`);
            console.log(`   Will pass to Map as center: [${latitude}, ${longitude}] (lat, lng for Leaflet)`);
          } else {
            console.error(`❌ User location outside Budapest: lat=${latitude}, lng=${longitude} - Using Budapest center`);
            setUserLocation({ lat: 47.4979, lng: 19.0402 });
          }
        },
        (error) => {
          console.warn("Could not get user location:", error);
          setUserLocation({ lat: 47.4979, lng: 19.0402 });
        }
      );
    }
  }, []);

  const handleSendMessage = async (messageText: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Add loading AI message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      text: "Let me help you with that...",
      sender: "ai",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, loadingMessage]);
    setIsLoading(true);

    try {
      // Use real API if connected, otherwise fallback to mock
      let aiResponse: ChatMessage;
      
      if (apiConnected) {
        aiResponse = await apiService.sendMessage(messageText, userLocation || undefined);
      } else {
        // Fallback to mock response
        aiResponse = {
          id: (Date.now() + 2).toString(),
          text: getMockResponse(messageText),
          sender: "ai",
          timestamp: new Date().toISOString(),
          markers: addMockMarkers(messageText),
          persona: activePersona || DEFAULT_PERSONA
        };
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id ? aiResponse : msg
      ));

      setActivePersona(prev => aiResponse.persona || prev || DEFAULT_PERSONA);

      // Update map markers if provided
      if (aiResponse.markers && aiResponse.markers.length > 0) {
        setMapMarkers(aiResponse.markers);
      }

      const formattedRoute = sanitizeRoute(aiResponse.route);
      setCurrentRoute(formattedRoute);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 2).toString(),
        text: "Sorry, I'm having trouble processing your request. Please try again.",
        sender: "ai",
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id ? errorResponse : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const getMockResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes("pharmacy") || lowerQuery.includes("pharmacies")) {
      return "I found 3 pharmacies near your location. They are marked on the map with green markers. The closest one is Budapest Pharmacy on Váci Street, open until 8 PM.";
    } else if (lowerQuery.includes("restaurant") || lowerQuery.includes("food")) {
      return "Here are some great restaurants nearby! I've marked them on the map. For traditional Hungarian cuisine, try Café Central. For quick bites, there's a McDonald's just around the corner.";
    } else if (lowerQuery.includes("route") || lowerQuery.includes("direction") || lowerQuery.includes("way")) {
      return "I've calculated the best route for you! The path is highlighted on the map. It should take about 15 minutes by foot or 8 minutes by public transport.";
    } else if (lowerQuery.includes("budapest") || lowerQuery.includes("city")) {
      return "Welcome to Budapest! I can help you find places, get directions, check public transport schedules, and discover local events. What would you like to know?";
    } else {
      return "I understand you're looking for information about Budapest. I can help you find places, get directions, check transport schedules, and more. Could you be more specific about what you need?";
    }
  };

  const addMockMarkers = (query: string): MapMarker[] => {
    const lowerQuery = query.toLowerCase();
    let newMarkers: MapMarker[] = [];

    if (lowerQuery.includes("pharmacy") || lowerQuery.includes("pharmacies")) {
      newMarkers = [
        {
          position: [47.4979, 19.0402],
          title: "Budapest Pharmacy",
          description: "Open until 8 PM",
          type: "pharmacy",
          rating: 4.2,
          hours: "Mon-Fri: 8:00-20:00",
          phone: "+36 1 234 5678",
          image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=200&fit=crop"
        },
        {
          position: [47.5079, 19.0502],
          title: "City Center Pharmacy",
          description: "24/7 Emergency service",
          type: "pharmacy",
          rating: 4.5,
          hours: "24/7",
          phone: "+36 1 234 5679",
          image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=200&fit=crop"
        },
        {
          position: [47.4879, 19.0302],
          title: "District VII Pharmacy",
          description: "Open until 6 PM",
          type: "pharmacy",
          rating: 3.8,
          hours: "Mon-Fri: 9:00-18:00",
          phone: "+36 1 234 5680"
        }
      ];
    } else if (lowerQuery.includes("restaurant") || lowerQuery.includes("food")) {
      newMarkers = [
        {
          position: [47.4979, 19.0402],
          title: "Café Central",
          description: "Traditional Hungarian cuisine",
          type: "restaurant",
          rating: 4.7,
          hours: "Mon-Sun: 10:00-22:00",
          phone: "+36 1 234 5681",
          website: "https://cafecentral.hu",
          image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=200&fit=crop"
        },
        {
          position: [47.5079, 19.0502],
          title: "McDonald's",
          description: "Fast food, open 24/7",
          type: "restaurant",
          rating: 3.5,
          hours: "24/7",
          phone: "+36 1 234 5682",
          website: "https://mcdonalds.hu",
          image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=300&h=200&fit=crop"
        },
        {
          position: [47.4879, 19.0302],
          title: "Buda Castle Restaurant",
          description: "Fine dining with city views",
          type: "restaurant",
          rating: 4.9,
          hours: "Tue-Sun: 18:00-23:00",
          phone: "+36 1 234 5683",
          website: "https://budacastle.hu",
          image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&h=200&fit=crop"
        }
      ];
    }

    return newMarkers;
  };

  const handlePlaybookSelect = async (playbookId: string) => {
    if (!apiConnected) {
      const warningMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Neighborhood playbooks need the backend connection. Please reconnect and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, warningMessage]);
      return;
    }

    setLoadingPlaybookId(playbookId);
    try {
      const detail = await apiService.getPlaybookById(playbookId, userLocation || undefined);
      if (!detail) {
        throw new Error('Playbook not found');
      }

      setSelectedPlaybook(detail);

      if (detail.markers && detail.markers.length > 0) {
        setMapMarkers(detail.markers);
      }

      const formattedRoute = sanitizeRoute(detail.primaryRoute);
      setCurrentRoute(formattedRoute);

      const highlights = detail.highlightStops
        .slice(0, 3)
        .map(stop => `• ${stop}`)
        .join(' ');

      const narrativeMessage: ChatMessage = {
        id: (Date.now() + 3).toString(),
        text: `${detail.narrative}${highlights ? ` Highlights: ${highlights}` : ''}`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };

      setMessages(prev => [...prev, narrativeMessage]);
    } catch (error) {
      console.error('Playbook select error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 4).toString(),
        text: 'Sorry, I could not load that playbook right now. Please try again in a bit.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoadingPlaybookId(null);
    }
  };

  const handlePlaybookPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handlePersonaPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleMoodboardSuggestion = async (suggestion: MoodboardSuggestion) => {
    if (!suggestion.action) return;

    if (suggestion.action.type === 'search' && suggestion.action.data?.query) {
      // Trigger a search query
      handleSendMessage(suggestion.action.data.query);
    } else if (suggestion.action.type === 'route' && suggestion.action.data?.mode) {
      // For route suggestions, we'd need a destination - could prompt user or use a default
      if (userLocation) {
        // Example: suggest a route to a popular destination based on mode
        const destinations: { [key: string]: string } = {
          walking: 'Buda Castle',
          cycling: 'City Park',
          public_transport: 'Parliament'
        };
        const destination = destinations[suggestion.action.data.mode] || 'City Center';
        handleRouteRequest(suggestion.action.data.mode as any, destination);
      }
    } else if (suggestion.action.type === 'info') {
      // Show info in chat
      const infoMessage: ChatMessage = {
        id: Date.now().toString(),
        text: suggestion.description,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, infoMessage]);
    }
  };

  const handleRouteRequest = async (mode: 'walking' | 'cycling' | 'public_transport', destination: string) => {
    if (!userLocation) {
      console.warn('User location not available for route planning');
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'I need your current location to plan a route. Please allow location access and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);
    try {
      // ALWAYS use user's current location as the start point
      const startCoords = `${userLocation.lat},${userLocation.lng}`;
      console.log(`🗺️ Planning route from user's current location: ${startCoords}`);
      
      // Check if destination is coordinates or an address
      let destinationCoords = destination;
      const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;
      
      if (!coordPattern.test(destination.trim())) {
        // It's an address, need to geocode it
        console.log(`Geocoding destination: ${destination}`);
        const geocodeResult = await apiService.geocode(destination);
        if (geocodeResult) {
          destinationCoords = `${geocodeResult.lat},${geocodeResult.lng}`;
          console.log(`Geocoded to: ${destinationCoords} (${geocodeResult.display_name})`);
        } else {
          throw new Error(`Could not find location: ${destination}`);
        }
      }

      // ALWAYS use user's current location as start point
      const route = await apiService.getRoute(
        startCoords, // Always user's current location
        destinationCoords,
        mode
      );

      if (route) {
        // Ensure polyline is in correct format [lat, lng][]
        const formattedPolyline = route.polyline?.map((coord: any) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            return [coord[0], coord[1]]; // Keep as [lat, lng]
          }
          return coord;
        }) || [];

        setCurrentRoute({
          polyline: formattedPolyline,
          distance: route.distance,
          duration: route.duration
        });

        // Add route message with instructions
        const instructionsText = route.steps && route.steps.length > 0
          ? route.steps.slice(0, 3).map((step: any) => step.instruction).join(' → ')
          : 'Route calculated';

        const routeMessage: ChatMessage = {
          id: Date.now().toString(),
          text: `Route planned: ${route.distance} in ${route.duration} by ${mode.replace('_', ' ')}. ${instructionsText}`,
          sender: 'ai',
          timestamp: new Date().toISOString(),
          route: route,
          persona: activePersona || DEFAULT_PERSONA
        };
        setMessages(prev => [...prev, routeMessage]);
      } else {
        throw new Error('No route found');
      }
    } catch (error) {
      console.error('Route planning error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `Sorry, I couldn't plan a route to "${destination}". Please check the address or try a different destination.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Map Section - Left Side */}
      <div className="flex-1 h-full relative">
        <Map 
          center={userLocation ? [userLocation.lat, userLocation.lng] : [47.4979, 19.0402]} // Leaflet format: [lat, lng]
          zoom={13}
          markers={mapMarkers}
          route={currentRoute || undefined}
          filters={mapFilters}
        />
        <MapFilters 
          onFiltersChange={setMapFilters}
          userLocation={userLocation}
        />
        <NeighborhoodPlaybooks 
          playbooks={playbooks}
          selectedId={selectedPlaybook?.id || null}
          loadingId={loadingPlaybookId}
          disabled={!apiConnected}
          onSelect={handlePlaybookSelect}
        />
        {apiConnected && (
          <Moodboard 
            userLocation={userLocation}
            onSuggestionAction={handleMoodboardSuggestion}
          />
        )}
        {activeStory && (
          <StoryCardComponent
            story={activeStory}
            onClose={() => setActiveStory(null)}
            onNavigate={() => {
              // Center map on story location
              if (activeStory.position) {
                // The Map component will handle this via center prop if we update userLocation
                // For now, we can add a marker or just close and let user explore
                setMapMarkers(prev => {
                  const existing = prev.find(m => m.title === activeStory.landmarkName);
                  if (existing) return prev;
                  return [...prev, {
                    position: activeStory.position,
                    title: activeStory.landmarkName,
                    description: activeStory.title,
                    type: 'historical' as any
                  }];
                });
              }
            }}
          />
        )}
      </div>
      
      {/* Transport Panel - Middle */}
      <div className="w-80 h-full">
        <TransportPanel 
          userLocation={userLocation}
          onRouteRequest={handleRouteRequest}
          onTransportStopsChange={(stops) => {
            // Convert transport stops to map markers
            const stopMarkers = stops.map(stop => ({
              position: stop.position as [number, number], // [lat, lng] format
              title: stop.name,
              description: `${stop.type.toUpperCase()} stop • Routes: ${stop.routes.join(', ')}`,
              type: stop.type // 'bus', 'tram', 'metro', or 'trolley'
            }));
            
            // Log metro and tram stations specifically
            const metroStops = stopMarkers.filter(m => m.type === 'metro');
            const tramStops = stopMarkers.filter(m => m.type === 'tram');
            console.log(`🚇 Metro stations: ${metroStops.length}`, metroStops);
            console.log(`🚋 Tram stations: ${tramStops.length}`, tramStops);
            
            setMapMarkers(prev => {
              // Remove old transport stop markers and add new ones
              const filtered = prev.filter(m => !['bus', 'tram', 'metro', 'trolley'].includes(m.type || ''));
              return [...filtered, ...stopMarkers];
            });
          }}
          onBikeStationsChange={(stations) => {
            // Convert bike stations to map markers
            const bikeMarkers = stations
              .filter(station => station.position || (station.lat && station.lng))
              .map(station => ({
                position: (station.position || [station.lat!, station.lng!]) as [number, number], // [lat, lng] format
                title: station.stationName,
                description: `${station.availableBikes} bikes available • ${station.availableDocks} docks`,
                type: 'bike_station'
              }));
            setMapMarkers(prev => {
              // Remove old bike station markers and add new ones
              const filtered = prev.filter(m => m.type !== 'bike_station');
              return [...filtered, ...bikeMarkers];
            });
          }}
        />
      </div>
      
      {/* Chat Section - Right Side */}
      <div className="w-96 h-full relative flex flex-col">
        <div className="flex-1 min-h-0">
          <Chat 
            onSendMessage={handleSendMessage}
            messages={messages}
            isLoading={isLoading}
            persona={activePersona}
            onPersonaPrompt={handlePersonaPrompt}
            isPlaybookActive={!!selectedPlaybook}
          />
        </div>
        {selectedPlaybook && (
          <div className="border-t border-border bg-white p-4 space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-blue-500 font-semibold">
                {selectedPlaybook.persona}
              </p>
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedPlaybook.title}
              </h3>
              <p className="text-xs text-gray-500">
                {selectedPlaybook.mood}
              </p>
            </div>
            <div className="space-y-1">
              {selectedPlaybook.highlightStops.slice(0, 3).map((stop) => (
                <p key={stop} className="text-xs text-gray-600">
                  • {stop}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedPlaybook.recommendedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePlaybookPrompt(prompt)}
                  className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* API Status Indicator */}
        <div className="absolute bottom-2 right-2">
          <div className={`w-3 h-3 rounded-full ${apiConnected ? 'bg-green-500' : 'bg-yellow-500'}`} 
               title={apiConnected ? 'Backend connected' : 'Using mock data'} />
        </div>
      </div>
    </div>
  );
}
