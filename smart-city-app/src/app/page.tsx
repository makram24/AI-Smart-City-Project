"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Chat from "@/components/Chat";
import TransportPanel from "@/components/TransportPanel";
import MapFilters from "@/components/MapFilters";
import { apiService, ChatMessage, MapMarker } from "@/lib/api";

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

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.warn("Could not get user location:", error);
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
          markers: addMockMarkers(messageText)
        };
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id ? aiResponse : msg
      ));

      // Update map markers if provided
      if (aiResponse.markers && aiResponse.markers.length > 0) {
        setMapMarkers(aiResponse.markers);
      }

      // Update route if provided - ensure it's properly formatted
      if (aiResponse.route) {
        console.log('🗺️ Route received from AI:', {
          hasPolyline: !!aiResponse.route.polyline,
          polylineLength: aiResponse.route.polyline?.length || 0,
          distance: aiResponse.route.distance,
          duration: aiResponse.route.duration
        });
        
        // Log first few coordinates to debug
        if (aiResponse.route.polyline && aiResponse.route.polyline.length > 0) {
          console.log('   First coordinate:', aiResponse.route.polyline[0]);
          console.log('   Last coordinate:', aiResponse.route.polyline[aiResponse.route.polyline.length - 1]);
        }
        
        // Ensure polyline is in correct format [lat, lng][]
        const formattedPolyline = aiResponse.route.polyline?.map((coord: any) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            let lat = coord[0];
            let lng = coord[1];
            
            // Validate coordinates are in Budapest
            if (lat < 47.0 || lat > 48.0 || lng < 18.5 || lng > 19.5) {
              console.warn(`⚠️ Invalid coordinate in route: [${lat}, ${lng}]`);
              // Try swapping
              if (lng >= 47.0 && lng <= 48.0 && lat >= 18.5 && lat <= 19.5) {
                console.warn(`   Swapping: [${lng}, ${lat}]`);
                [lat, lng] = [lng, lat];
              }
            }
            
            return [lat, lng]; // Return as [lat, lng] for frontend
          }
          return coord;
        }).filter((coord: number[]) => {
          // Filter out invalid coordinates
          if (Array.isArray(coord) && coord.length >= 2) {
            const lat = coord[0];
            const lng = coord[1];
            return lat >= 47.0 && lat <= 48.0 && lng >= 18.5 && lng <= 19.5;
          }
          return false;
        }) || [];
        
        const formattedRoute = {
          ...aiResponse.route,
          polyline: formattedPolyline
        };
        
        console.log('✅ Route formatted:', {
          originalLength: aiResponse.route.polyline?.length || 0,
          formattedLength: formattedPolyline.length,
          firstCoord: formattedPolyline[0],
          lastCoord: formattedPolyline[formattedPolyline.length - 1]
        });
        
        setCurrentRoute(formattedRoute);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 2).toString(),
        text: "Sorry, I'm having trouble processing your request. Please try again.",
        sender: "ai",
        timestamp: new Date().toISOString(),
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

  const handleRouteRequest = async (mode: 'walking' | 'cycling' | 'public_transport', destination: string) => {
    if (!userLocation) {
      console.warn('User location not available for route planning');
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: 'I need your current location to plan a route. Please allow location access and try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
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
          route: route
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
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Map Section - Left Side */}
      <div className="flex-1 h-full">
        <Map 
          center={userLocation ? [userLocation.lat, userLocation.lng] : [47.4979, 19.0402]} // Budapest coordinates
          zoom={13}
          markers={mapMarkers}
          route={currentRoute || undefined}
          filters={mapFilters}
        />
        <MapFilters 
          onFiltersChange={setMapFilters}
          userLocation={userLocation}
        />
      </div>
      
      {/* Transport Panel - Middle */}
      <div className="w-80 h-full">
        <TransportPanel 
          userLocation={userLocation}
          onRouteRequest={handleRouteRequest}
        />
      </div>
      
      {/* Chat Section - Right Side */}
      <div className="w-96 h-full">
        <Chat 
          onSendMessage={handleSendMessage}
          messages={messages}
          isLoading={isLoading}
        />
        
        {/* API Status Indicator */}
        <div className="absolute bottom-2 right-2">
          <div className={`w-3 h-3 rounded-full ${apiConnected ? 'bg-green-500' : 'bg-yellow-500'}`} 
               title={apiConnected ? 'Backend connected' : 'Using mock data'} />
        </div>
      </div>
    </div>
  );
}
