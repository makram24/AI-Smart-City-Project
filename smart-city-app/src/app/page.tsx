"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Chat from "@/components/Chat";
import TransportPanel from "@/components/TransportPanel";
import MapFilters from "@/components/MapFilters";
import { NeighborhoodPlaybooks } from "@/components/NeighborhoodPlaybooks";
import Moodboard from "@/components/Moodboard";
import StoryCardComponent from "@/components/StoryCard";
import RouteSafetyIndicator from "@/components/RouteSafetyIndicator";
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
  const [routeSafetyAnalysis, setRouteSafetyAnalysis] = useState<any>(null);
  const [constructionZones, setConstructionZones] = useState<any[]>([]);
  
  // Visibility states for all components
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isTransportPanelVisible, setIsTransportPanelVisible] = useState(true);
  const [isMapFiltersVisible, setIsMapFiltersVisible] = useState(true);
  const [isPlaybooksVisible, setIsPlaybooksVisible] = useState(true);

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
    if (!suggestion.action) {
      // If no action, just show the suggestion description in chat
      const infoMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `${suggestion.title}: ${suggestion.description}`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, infoMessage]);
      return;
    }

    if (suggestion.action.type === 'search' && suggestion.action.data?.query) {
      const query = suggestion.action.data.query.toLowerCase();
      
      // Special handling for museums and thermal baths - show on map immediately
      if (query.includes('museum') || query.includes('gallery') || query.includes('historical')) {
        await handleMuseumSearch();
        return;
      } else if (query.includes('thermal') || query.includes('bath') || query.includes('spa')) {
        await handleThermalBathSearch();
        return;
      }
      
      // For other searches, trigger a search query - this will automatically update chat and map
      handleSendMessage(suggestion.action.data.query);
    } else if (suggestion.action.type === 'route' && suggestion.action.data?.mode) {
      // For route suggestions, determine destination based on mode and context
      if (userLocation) {
        const mode = suggestion.action.data.mode;
        let destination = 'City Center';
        
        // Smart destination selection based on mode and suggestion context
        if (suggestion.id.includes('weather_hot') || suggestion.id.includes('weather_perfect')) {
          destination = mode === 'walking' ? 'City Park' : mode === 'cycling' ? 'Margaret Island' : 'Heroes Square';
        } else if (suggestion.id.includes('time_morning')) {
          destination = 'Great Market Hall';
        } else if (suggestion.id.includes('time_afternoon')) {
          destination = 'Buda Castle';
        } else if (suggestion.id.includes('time_evening')) {
          destination = 'Fisherman\'s Bastion';
        } else {
          // Default destinations
          const destinations: { [key: string]: string } = {
            walking: 'Buda Castle',
            cycling: 'City Park',
            public_transport: 'Parliament'
          };
          destination = destinations[mode] || 'City Center';
        }
        
        handleRouteRequest(mode as any, destination);
      } else {
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          text: 'I need your current location to plan a route. Please allow location access and try again.',
          sender: 'ai',
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } else if (suggestion.action.type === 'info') {
      // Handle info type - check if it's disruptions
      if (suggestion.action.data?.type === 'disruptions') {
        await handleTransportDisruptions();
      } else {
        // Show info in chat
        const infoMessage: ChatMessage = {
          id: Date.now().toString(),
          text: `${suggestion.title}\n\n${suggestion.description}`,
          sender: 'ai',
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA
        };
        setMessages(prev => [...prev, infoMessage]);
      }
    }
  };

  const handleWeatherClick = async () => {
    if (!apiConnected) {
      const warningMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Weather information needs the backend connection. Please reconnect and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, warningMessage]);
      return;
    }

    try {
      const weatherData = await apiService.getCurrentWeather();
      if (!weatherData) {
        throw new Error('Weather data not available');
      }

      const { weather, context } = weatherData;
      
      // Build weather message
      let weatherText = `🌤️ **Current Weather in Budapest**\n\n`;
      weatherText += `**Temperature:** ${weather.temperature}°C (feels like ${weather.feelsLike}°C)\n`;
      weatherText += `**Conditions:** ${weather.description}\n`;
      weatherText += `**Humidity:** ${weather.humidity}%\n\n`;

      if (context) {
        weatherText += `**Activity Recommendations:**\n`;
        weatherText += `• Walking: ${context.isGoodForWalking ? '✅ Great conditions' : '⚠️ Not ideal'}\n`;
        weatherText += `• Cycling: ${context.isGoodForCycling ? '✅ Great conditions' : '⚠️ Not ideal'}\n\n`;
        
        if (context.recommendations && context.recommendations.length > 0) {
          weatherText += `**Suggestions:**\n`;
          context.recommendations.forEach(rec => {
            weatherText += `• ${rec}\n`;
          });
        }
      }

      const weatherMessage: ChatMessage = {
        id: Date.now().toString(),
        text: weatherText,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };

      setMessages(prev => [...prev, weatherMessage]);

      // If weather is good for outdoor activities, show nearby parks/outdoor places
      if (context?.isGoodForWalking || context?.isGoodForCycling) {
        if (userLocation) {
          try {
            const places = await apiService.searchPlaces('park, outdoor, viewpoint', userLocation.lat, userLocation.lng, 2000);
            if (places.length > 0) {
              const markers: MapMarker[] = places.slice(0, 5).map(place => ({
                position: place.position,
                title: place.name,
                description: place.description,
                type: 'viewpoint' as any
              }));
              setMapMarkers(prev => [...prev, ...markers]);
            }
          } catch (error) {
            console.error('Failed to fetch outdoor places:', error);
          }
        }
      }
    } catch (error) {
      console.error('Weather click error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Sorry, I could not fetch weather information right now. Please try again in a bit.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleTransportDisruptions = async () => {
    if (!apiConnected) {
      const warningMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Transport information needs the backend connection. Please reconnect and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, warningMessage]);
      return;
    }

    try {
      const disruptions = await apiService.getTransportDisruptions();
      
      let disruptionText = `⚠️ **Transport Disruptions in Budapest**\n\n`;
      
      if (disruptions.length === 0) {
        disruptionText += '✅ No disruptions reported at the moment. All transport services are running normally.';
      } else {
        disruptionText += `There ${disruptions.length === 1 ? 'is' : 'are'} **${disruptions.length}** disruption${disruptions.length > 1 ? 's' : ''}:\n\n`;
        
        disruptions.slice(0, 5).forEach((disruption: any, index: number) => {
          disruptionText += `${index + 1}. `;
          if (disruption.line) {
            disruptionText += `**Line ${disruption.line}**: `;
          }
          if (disruption.type) {
            disruptionText += `${disruption.type} - `;
          }
          if (disruption.description) {
            disruptionText += disruption.description;
          } else if (disruption.message) {
            disruptionText += disruption.message;
          } else {
            disruptionText += 'Service disruption';
          }
          if (disruption.from && disruption.to) {
            disruptionText += ` (${disruption.from} → ${disruption.to})`;
          }
          disruptionText += '\n';
        });

        if (disruptions.length > 5) {
          disruptionText += `\n... and ${disruptions.length - 5} more disruption${disruptions.length - 5 > 1 ? 's' : ''}`;
        }
      }

      const disruptionMessage: ChatMessage = {
        id: Date.now().toString(),
        text: disruptionText,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };

      setMessages(prev => [...prev, disruptionMessage]);

      // Show nearby transport stops on map if location available
      if (userLocation) {
        try {
          const stops = await apiService.getTransportStops(userLocation.lat, userLocation.lng, 1000);
          if (stops.length > 0) {
            const markers: MapMarker[] = stops.slice(0, 10).map(stop => ({
              position: stop.position,
              title: stop.name,
              description: `Routes: ${stop.routes.join(', ')}`,
              type: stop.type
            }));
            setMapMarkers(prev => [...prev, ...markers]);
          }
        } catch (error) {
          console.error('Failed to fetch transport stops:', error);
        }
      }
    } catch (error) {
      console.error('Transport disruptions error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Sorry, I could not fetch transport disruption information right now. Please try again in a bit.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleMuseumSearch = async () => {
    if (!userLocation) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'I need your current location to find museums nearby. Please allow location access and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);
    try {
      // Search for museums
      const places = await apiService.searchPlaces('museum', userLocation.lat, userLocation.lng, 5000);
      
      if (places.length === 0) {
        const noResultsMessage: ChatMessage = {
          id: Date.now().toString(),
          text: 'I couldn\'t find any museums nearby. Try searching in a different area or expand your search radius.',
          sender: 'ai',
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA
        };
        setMessages(prev => [...prev, noResultsMessage]);
        setIsLoading(false);
        return;
      }

      // Create markers for museums
      const museumMarkers: MapMarker[] = places.map(place => ({
        position: place.position,
        title: place.name,
        description: place.description,
        type: 'landmark' as any
      }));

      // Update map markers
      setMapMarkers(prev => {
        // Remove old museum markers and add new ones
        const filtered = prev.filter(m => m.type !== 'landmark' || (!m.title.toLowerCase().includes('museum') && !m.title.toLowerCase().includes('gallery')));
        return [...filtered, ...museumMarkers];
      });

      // Create chat message
      const museumList = places.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${p.distance})`).join('\n');
      const museumMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `🏛️ **Museums & Galleries Found**\n\nI found ${places.length} museum${places.length > 1 ? 's' : ''} and gallery${places.length > 1 ? 'ies' : ''} nearby:\n\n${museumList}${places.length > 5 ? `\n\n... and ${places.length - 5} more` : ''}\n\nClick on any marker on the map to get directions!`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        markers: museumMarkers,
        persona: activePersona || DEFAULT_PERSONA
      };

      setMessages(prev => [...prev, museumMessage]);
    } catch (error) {
      console.error('Museum search error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Sorry, I could not search for museums right now. Please try again in a bit.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleThermalBathSearch = async () => {
    if (!userLocation) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'I need your current location to find thermal baths nearby. Please allow location access and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);
    try {
      // Search for thermal baths and spas
      const places = await apiService.searchPlaces('thermal', userLocation.lat, userLocation.lng, 5000);
      
      // Filter results to ensure only thermal baths/spas (exclude restaurants)
      const thermalBaths = places.filter(place => {
        const name = place.name?.toLowerCase() || '';
        const description = place.description?.toLowerCase() || '';
        const type = place.type?.toLowerCase() || '';
        
        // Include if it's a spa, thermal bath, or has relevant keywords
        const isThermalBath = 
          type === 'spa' ||
          type === 'leisure' ||
          name.includes('thermal') ||
          name.includes('bath') ||
          name.includes('fürdő') ||
          name.includes('spa') ||
          description.includes('thermal') ||
          description.includes('bath') ||
          description.includes('spa');
        
        // Exclude restaurants
        const isRestaurant = 
          type === 'restaurant' ||
          name.includes('restaurant') ||
          name.includes('étterem') ||
          description.includes('restaurant') ||
          description.includes('food') ||
          description.includes('cuisine');
        
        return isThermalBath && !isRestaurant;
      });
      
      if (thermalBaths.length === 0) {
        const noResultsMessage: ChatMessage = {
          id: Date.now().toString(),
          text: 'I couldn\'t find any thermal baths nearby. Try searching in a different area or expand your search radius.',
          sender: 'ai',
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA
        };
        setMessages(prev => [...prev, noResultsMessage]);
        setIsLoading(false);
        return;
      }

      // Create markers for thermal baths
      const bathMarkers: MapMarker[] = thermalBaths.map(place => ({
        position: place.position,
        title: place.name,
        description: place.description,
        type: 'thermal_bath' as any
      }));

      // Update map markers
      setMapMarkers(prev => {
        // Remove old thermal bath markers and add new ones
        const filtered = prev.filter(m => m.type !== 'thermal_bath' && m.type !== 'spa');
        return [...filtered, ...bathMarkers];
      });

      // Create chat message
      const bathList = thermalBaths.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${p.distance})`).join('\n');
      const bathMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `♨️ **Thermal Baths & Spas Found**\n\nI found ${thermalBaths.length} thermal bath${thermalBaths.length > 1 ? 's' : ''} and spa${thermalBaths.length > 1 ? 's' : ''} nearby:\n\n${bathList}${thermalBaths.length > 5 ? `\n\n... and ${thermalBaths.length - 5} more` : ''}\n\nClick on any marker on the map to get directions!`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        markers: bathMarkers,
        persona: activePersona || DEFAULT_PERSONA
      };

      setMessages(prev => [...prev, bathMessage]);
    } catch (error) {
      console.error('Thermal bath search error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'Sorry, I could not search for thermal baths right now. Please try again in a bit.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
          onMarkerClick={(position, title) => {
            if (userLocation) {
              const destination = `${position[0]},${position[1]}`;
              handleRouteRequest('walking', destination);
            }
          }}
        />
        {/* Route Safety Indicator */}
        {currentRoute && currentRoute.polyline && currentRoute.polyline.length >= 2 && (
          <RouteSafetyIndicator 
            routePolyline={currentRoute.polyline}
            onSafetyData={(analysis) => {
              setRouteSafetyAnalysis(analysis);
              // Add construction zone markers
              if (userLocation) {
                apiService.getConstructionZones(userLocation.lat, userLocation.lng, 1000).then(zones => {
                  const zoneMarkers = zones.map(zone => ({
                    position: zone.position,
                    title: 'Construction Zone',
                    description: zone.description,
                    type: 'default' as any
                  }));
                  setConstructionZones(zoneMarkers);
                  setMapMarkers(prev => {
                    const filtered = prev.filter(m => m.title !== 'Construction Zone');
                    return [...filtered, ...zoneMarkers];
                  });
                });
              }
            }}
          />
        )}
        {isMapFiltersVisible ? (
          <MapFilters 
            onFiltersChange={setMapFilters}
            userLocation={userLocation}
            onClose={() => setIsMapFiltersVisible(false)}
          />
        ) : (
          <button
            onClick={() => setIsMapFiltersVisible(true)}
            className="absolute top-4 left-4 z-20 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition"
            title="Show Map Filters"
          >
            <span className="text-xl">🔍</span>
          </button>
        )}
        {isPlaybooksVisible ? (
          <NeighborhoodPlaybooks 
            playbooks={playbooks}
            selectedId={selectedPlaybook?.id || null}
            loadingId={loadingPlaybookId}
            disabled={!apiConnected}
            onSelect={handlePlaybookSelect}
            onClose={() => setIsPlaybooksVisible(false)}
          />
        ) : (
          <button
            onClick={() => setIsPlaybooksVisible(true)}
            className="absolute bottom-6 left-4 z-20 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition"
            title="Show Neighborhood Playbooks"
          >
            <span className="text-xl">📖</span>
          </button>
        )}
        {apiConnected && (
          <Moodboard 
            userLocation={userLocation}
            onSuggestionAction={handleMoodboardSuggestion}
            onWeatherClick={handleWeatherClick}
            onTransportClick={handleTransportDisruptions}
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
      {isTransportPanelVisible ? (
        <div className="w-80 h-full">
          <TransportPanel 
            userLocation={userLocation}
            onRouteRequest={handleRouteRequest}
            onClose={() => setIsTransportPanelVisible(false)}
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
      ) : (
        <button
          onClick={() => setIsTransportPanelVisible(true)}
          className="absolute top-1/2 left-0 transform -translate-y-1/2 z-20 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition ml-2"
          title="Show Transport Panel"
        >
          <span className="text-xl">🚋</span>
        </button>
      )}
      
      {/* Chat Section - Right Side */}
      {isChatVisible ? (
        <div className="w-96 h-full relative flex flex-col">
          <div className="flex-1 min-h-0">
            <Chat 
              onSendMessage={handleSendMessage}
              messages={messages}
              isLoading={isLoading}
              persona={activePersona}
              onPersonaPrompt={handlePersonaPrompt}
              isPlaybookActive={!!selectedPlaybook}
              onClose={() => setIsChatVisible(false)}
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
      ) : (
        <button
          onClick={() => setIsChatVisible(true)}
          className="absolute top-1/2 right-0 transform -translate-y-1/2 z-20 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition mr-2"
          title="Show Chat"
        >
          <span className="text-xl">💬</span>
        </button>
      )}
    </div>
  );
}
