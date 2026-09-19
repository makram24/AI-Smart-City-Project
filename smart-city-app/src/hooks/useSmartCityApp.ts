"use client";

import { useEffect, useState } from "react";
import {
  apiService,
  ChatMessage,
  ConstructionZone,
  CurrentRoute,
  MapMarker,
  MapRouteShape,
  MoodboardSuggestion,
  PersonaContext,
  PlaybookDetail,
  PlaybookSummary,
  RouteSafetyAnalysis,
  StoryCard,
  StoryTrigger,
  TransportDisruption,
  TravelMode,
  VehiclePosition,
} from "@/lib/api";
import { isWithinBudapest, normalizeCoordinate } from "@/lib/geoValidation";
import { addMockMarkers, getMockResponse } from "@/lib/mockChat";
import { logger } from "@/lib/logger";

export const DEFAULT_PERSONA: PersonaContext = {
  id: "local_concierge",
  name: "City Concierge",
  tagline: "Friendly guide for everyday Budapest plans.",
  tone: "balanced",
  recommendedPrompts: [
    "What is near me right now?",
    "Plan a scenic walk along the Danube",
    "Check tram arrivals around me",
  ],
};

const BUDAPEST_CENTER = { lat: 47.4979, lng: 19.0402 };

export function useSmartCityApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<CurrentRoute | null>(null);
  const [mapFilters, setMapFilters] = useState<{ categories: string[]; maxDistance: number }>({
    categories: [],
    maxDistance: 2,
  });
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookDetail | null>(null);
  const [loadingPlaybookId, setLoadingPlaybookId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaContext | null>(null);
  const [activeStory, setActiveStory] = useState<StoryCard | null>(null);
  const [storyTriggers, setStoryTriggers] = useState<StoryTrigger[]>([]);
  const [routeSafetyAnalysis, setRouteSafetyAnalysis] = useState<RouteSafetyAnalysis | null>(null);
  const [constructionZones, setConstructionZones] = useState<ConstructionZone[]>([]);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [routeShapes, setRouteShapes] = useState<MapRouteShape[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isTransportPanelVisible, setIsTransportPanelVisible] = useState(true);
  const [isMapFiltersVisible, setIsMapFiltersVisible] = useState(true);
  const [isPlaybooksVisible, setIsPlaybooksVisible] = useState(true);

  const sanitizeRoute = (route?: ChatMessage["route"] | null): CurrentRoute | null => {
    if (!route?.polyline) {
      return null;
    }

    const polyline = route.polyline
      .map((coord) => normalizeCoordinate(coord as [number, number]))
      .filter((coord): coord is [number, number] => !!coord);

    if (polyline.length === 0) {
      return null;
    }

    return { ...route, polyline };
  };

  useEffect(() => {
    const checkApi = async () => {
      try {
        setApiConnected(await apiService.healthCheck());
      } catch {
        setApiConnected(false);
      }
    };
    checkApi();
  }, []);

  useEffect(() => {
    if (!selectedStopId || !apiConnected) return;

    const updateVehicles = async () => {
      try {
        setVehicles(await apiService.getVehiclesForStop(selectedStopId));
      } catch (error) {
        logger.error("Failed to update vehicles:", error);
      }
    };

    updateVehicles();
    const interval = setInterval(updateVehicles, 30000);
    return () => clearInterval(interval);
  }, [selectedStopId, apiConnected]);

  useEffect(() => {
    if (!apiConnected) return;

    let isMounted = true;
    apiService.getPlaybooks()
      .then((list) => {
        if (isMounted) setPlaybooks(list);
      })
      .catch((error) => logger.error("Failed to fetch playbooks:", error));

    return () => {
      isMounted = false;
    };
  }, [apiConnected]);

  useEffect(() => {
    if (!apiConnected || !currentRoute?.polyline || currentRoute.polyline.length < 2) {
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
        const closestTrigger = triggers.find((t) => t.shouldShow);
        if (closestTrigger) {
          const story = await apiService.getStoryById(closestTrigger.storyId);
          if (story && isMounted) setActiveStory(story);
        }
      } catch (error) {
        logger.error("Failed to check stories near route:", error);
      }
    };

    checkStories();
    return () => {
      isMounted = false;
    };
  }, [currentRoute, apiConnected]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(BUDAPEST_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation(
          isWithinBudapest(latitude, longitude)
            ? { lat: latitude, lng: longitude }
            : BUDAPEST_CENTER
        );
      },
      () => setUserLocation(BUDAPEST_CENTER)
    );
  }, []);

  const handleSendMessage = async (messageText: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      text: "Let me help you with that...",
      sender: "ai",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, loadingMessage]);
    setIsLoading(true);

    try {
      const aiResponse = apiConnected
        ? await apiService.sendMessage(messageText, userLocation || undefined)
        : {
            id: (Date.now() + 2).toString(),
            text: getMockResponse(messageText),
            sender: "ai" as const,
            timestamp: new Date().toISOString(),
            markers: addMockMarkers(messageText),
            persona: activePersona || DEFAULT_PERSONA,
          };

      setMessages((prev) => prev.map((msg) => (msg.id === loadingMessage.id ? aiResponse : msg)));
      setActivePersona((prev) => aiResponse.persona || prev || DEFAULT_PERSONA);

      if (aiResponse.markers && aiResponse.markers.length > 0) {
        setMapMarkers(aiResponse.markers);
      }
      setCurrentRoute(sanitizeRoute(aiResponse.route));
    } catch (error) {
      logger.error("Error sending message:", error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 2).toString(),
        text: "Sorry, I'm having trouble processing your request. Please try again.",
        sender: "ai",
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA,
      };
      setMessages((prev) => prev.map((msg) => (msg.id === loadingMessage.id ? errorResponse : msg)));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaybookSelect = async (playbookId: string) => {
    if (!apiConnected) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Neighborhood playbooks need the backend connection. Please reconnect and try again.",
          sender: "ai",
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA,
        },
      ]);
      return;
    }

    setLoadingPlaybookId(playbookId);
    try {
      const detail = await apiService.getPlaybookById(playbookId, userLocation || undefined);
      if (!detail) throw new Error("Playbook not found");

      setSelectedPlaybook(detail);
      if (detail.markers?.length) setMapMarkers(detail.markers);
      setCurrentRoute(sanitizeRoute(detail.primaryRoute));

      const highlights = detail.highlightStops.slice(0, 3).map((stop) => `• ${stop}`).join(" ");
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 3).toString(),
          text: `${detail.narrative}${highlights ? ` Highlights: ${highlights}` : ""}`,
          sender: "ai",
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA,
        },
      ]);
    } catch (error) {
      logger.error("Playbook select error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 4).toString(),
          text: "Sorry, I could not load that playbook right now. Please try again in a bit.",
          sender: "ai",
          timestamp: new Date().toISOString(),
          persona: activePersona || DEFAULT_PERSONA,
        },
      ]);
    } finally {
      setLoadingPlaybookId(null);
    }
  };

  const pushAiMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text,
        sender: "ai",
        timestamp: new Date().toISOString(),
        persona: activePersona || DEFAULT_PERSONA,
      },
    ]);
  };

  const handleRouteRequest = async (mode: TravelMode, destination: string) => {
    if (!userLocation) {
      pushAiMessage("I need your current location to plan a route. Please allow location access and try again.");
      return;
    }

    setIsLoading(true);
    try {
      const startCoords = `${userLocation.lat},${userLocation.lng}`;
      let destinationCoords = destination;
      const coordPattern = /^-?\d+\.?\d*,-?\d+\.?\d*$/;

      if (!coordPattern.test(destination.trim())) {
        const geocodeResult = await apiService.geocode(destination);
        if (!geocodeResult) throw new Error(`Could not find location: ${destination}`);
        destinationCoords = `${geocodeResult.lat},${geocodeResult.lng}`;
      }

      const route = await apiService.getRoute(startCoords, destinationCoords, mode);
      if (!route) throw new Error("No route found");

      const formattedPolyline = (route.polyline || [])
        .map((coord) => (Array.isArray(coord) && coord.length >= 2 ? [coord[0], coord[1]] : coord))
        .filter((coord): coord is number[] => Array.isArray(coord) && coord.length >= 2);

      setCurrentRoute({
        polyline: formattedPolyline,
        distance: route.distance,
        duration: route.duration,
        mode,
        steps: route.steps?.map((step) => ({
          type: step.type,
          geometry: step.geometry,
          instruction: step.instruction,
        })),
      });

      const instructionsText = route.steps?.length
        ? route.steps.slice(0, 3).map((step) => step.instruction).join(" → ")
        : "Route calculated";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `Route planned: ${route.distance} in ${route.duration} by ${mode.replace("_", " ")}. ${instructionsText}`,
          sender: "ai",
          timestamp: new Date().toISOString(),
          route,
          persona: activePersona || DEFAULT_PERSONA,
        },
      ]);
    } catch (error) {
      logger.error("Route planning error:", error);
      pushAiMessage(`Sorry, I couldn't plan a route to "${destination}". Please check the address or try a different destination.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuseumSearch = async () => {
    if (!userLocation) {
      pushAiMessage("I need your current location to find museums nearby. Please allow location access and try again.");
      return;
    }

    setIsLoading(true);
    try {
      const places = await apiService.searchPlaces("museum", userLocation.lat, userLocation.lng, 5000);
      if (places.length === 0) {
        pushAiMessage("I couldn't find any museums nearby. Try searching in a different area or expand your search radius.");
        return;
      }

      const museumMarkers: MapMarker[] = places.map((place) => ({
        position: place.position,
        title: place.name,
        description: place.description,
        type: "landmark",
      }));

      setMapMarkers((prev) => {
        const filtered = prev.filter(
          (m) =>
            m.type !== "landmark" ||
            (!m.title.toLowerCase().includes("museum") && !m.title.toLowerCase().includes("gallery"))
        );
        return [...filtered, ...museumMarkers];
      });

      const museumList = places.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${p.distance})`).join("\n");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `Museums & galleries found\n\nI found ${places.length} nearby:\n\n${museumList}`,
          sender: "ai",
          timestamp: new Date().toISOString(),
          markers: museumMarkers,
          persona: activePersona || DEFAULT_PERSONA,
        },
      ]);
    } catch (error) {
      logger.error("Museum search error:", error);
      pushAiMessage("Sorry, I could not search for museums right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleThermalBathSearch = async () => {
    if (!userLocation) {
      pushAiMessage("I need your current location to find thermal baths nearby. Please allow location access and try again.");
      return;
    }

    setIsLoading(true);
    try {
      const places = await apiService.searchPlaces("thermal", userLocation.lat, userLocation.lng, 5000);
      const thermalBaths = places.filter((place) => {
        const name = place.name?.toLowerCase() || "";
        const description = place.description?.toLowerCase() || "";
        const type = place.type?.toLowerCase() || "";
        const isThermal =
          type === "spa" ||
          type === "leisure" ||
          name.includes("thermal") ||
          name.includes("bath") ||
          name.includes("fürdő") ||
          name.includes("spa") ||
          description.includes("thermal") ||
          description.includes("bath") ||
          description.includes("spa");
        const isRestaurant =
          type === "restaurant" ||
          name.includes("restaurant") ||
          description.includes("restaurant");
        return isThermal && !isRestaurant;
      });

      if (thermalBaths.length === 0) {
        pushAiMessage("I couldn't find any thermal baths nearby.");
        return;
      }

      const bathMarkers: MapMarker[] = thermalBaths.map((place) => ({
        position: place.position,
        title: place.name,
        description: place.description,
        type: "thermal_bath",
      }));

      setMapMarkers((prev) => [...prev.filter((m) => m.type !== "thermal_bath" && m.type !== "spa"), ...bathMarkers]);

      const bathList = thermalBaths.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${p.distance})`).join("\n");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `Thermal baths found\n\nI found ${thermalBaths.length} nearby:\n\n${bathList}`,
          sender: "ai",
          timestamp: new Date().toISOString(),
          markers: bathMarkers,
          persona: activePersona || DEFAULT_PERSONA,
        },
      ]);
    } catch (error) {
      logger.error("Thermal bath search error:", error);
      pushAiMessage("Sorry, I could not search for thermal baths right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeatherClick = async () => {
    if (!apiConnected) {
      pushAiMessage("Weather information needs the backend connection.");
      return;
    }

    try {
      const weatherData = await apiService.getCurrentWeather();
      if (!weatherData) throw new Error("Weather data not available");

      const { weather, context } = weatherData;
      let weatherText = `Current weather in Budapest\n\nTemperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)\nConditions: ${weather.description}\nHumidity: ${weather.humidity}%\n`;
      if (context) {
        weatherText += `\nWalking: ${context.isGoodForWalking ? "good" : "not ideal"}\nCycling: ${context.isGoodForCycling ? "good" : "not ideal"}\n`;
        if (context.recommendations?.length) {
          weatherText += `\n${context.recommendations.map((rec) => `• ${rec}`).join("\n")}`;
        }
      }
      pushAiMessage(weatherText);

      if ((context?.isGoodForWalking || context?.isGoodForCycling) && userLocation) {
        const places = await apiService.searchPlaces("park, outdoor, viewpoint", userLocation.lat, userLocation.lng, 2000);
        if (places.length > 0) {
          setMapMarkers((prev) => [
            ...prev,
            ...places.slice(0, 5).map((place) => ({
              position: place.position,
              title: place.name,
              description: place.description,
              type: "viewpoint" as const,
            })),
          ]);
        }
      }
    } catch (error) {
      logger.error("Weather click error:", error);
      pushAiMessage("Sorry, I could not fetch weather information right now.");
    }
  };

  const handleTransportDisruptions = async () => {
    if (!apiConnected) {
      pushAiMessage("Transport information needs the backend connection.");
      return;
    }

    try {
      const disruptions = (await apiService.getTransportDisruptions()) as TransportDisruption[];
      let disruptionText = "Transport disruptions in Budapest\n\n";
      if (disruptions.length === 0) {
        disruptionText += "No disruptions reported at the moment.";
      } else {
        disruptions.slice(0, 5).forEach((disruption, index) => {
          disruptionText += `${index + 1}. `;
          if (disruption.line) disruptionText += `Line ${disruption.line}: `;
          disruptionText += disruption.description || disruption.message || "Service disruption";
          disruptionText += "\n";
        });
      }
      pushAiMessage(disruptionText);

      if (userLocation) {
        const stops = await apiService.getTransportStops(userLocation.lat, userLocation.lng, 1000);
        if (stops.length > 0) {
          setMapMarkers((prev) => [
            ...prev,
            ...stops.slice(0, 10).map((stop) => ({
              position: stop.position,
              title: stop.name,
              description: `Routes: ${stop.routes.join(", ")}`,
              type: stop.type,
            })),
          ]);
        }
      }
    } catch (error) {
      logger.error("Transport disruptions error:", error);
      pushAiMessage("Sorry, I could not fetch transport disruption information right now.");
    }
  };

  const handleMoodboardSuggestion = async (suggestion: MoodboardSuggestion) => {
    if (!suggestion.action) {
      pushAiMessage(`${suggestion.title}: ${suggestion.description}`);
      return;
    }

    if (suggestion.action.type === "search" && suggestion.action.data?.query) {
      const query = suggestion.action.data.query.toLowerCase();
      if (query.includes("museum") || query.includes("gallery") || query.includes("historical")) {
        await handleMuseumSearch();
        return;
      }
      if (query.includes("thermal") || query.includes("bath") || query.includes("spa")) {
        await handleThermalBathSearch();
        return;
      }
      handleSendMessage(suggestion.action.data.query);
      return;
    }

    if (suggestion.action.type === "route" && suggestion.action.data?.mode) {
      if (!userLocation) {
        pushAiMessage("I need your current location to plan a route.");
        return;
      }
      const mode = suggestion.action.data.mode as TravelMode;
      const destinations: Record<string, string> = {
        walking: "Buda Castle",
        cycling: "City Park",
        public_transport: "Parliament",
      };
      handleRouteRequest(mode, destinations[mode] || "City Center");
      return;
    }

    if (suggestion.action.type === "info" && suggestion.action.data?.type === "disruptions") {
      await handleTransportDisruptions();
      return;
    }

    pushAiMessage(`${suggestion.title}\n\n${suggestion.description}`);
  };

  const handleTransportStopsChange = (
    stops: Array<{ position: [number, number]; name: string; type: string; routes: string[] }>
  ) => {
    const stopMarkers: MapMarker[] = stops.map((stop) => ({
      position: stop.position as [number, number],
      title: stop.name,
      description: `${stop.type.toUpperCase()} stop • Routes: ${stop.routes.join(", ")}`,
      type: stop.type as MapMarker["type"],
    }));
    setMapMarkers((prev) => [
      ...prev.filter((m) => !["bus", "tram", "metro", "trolley"].includes(m.type || "")),
      ...stopMarkers,
    ]);
  };

  const handleBikeStationsChange = (
    stations: Array<{
      position?: [number, number];
      lat?: number;
      lng?: number;
      stationName: string;
      availableBikes: number;
      availableDocks: number;
    }>
  ) => {
    const bikeMarkers: MapMarker[] = stations
      .filter((station) => station.position || (station.lat && station.lng))
      .map((station) => ({
        position: (station.position || [station.lat!, station.lng!]) as [number, number],
        title: station.stationName,
        description: `${station.availableBikes} bikes available • ${station.availableDocks} docks`,
        type: "bike_station",
      }));
    setMapMarkers((prev) => [...prev.filter((m) => m.type !== "bike_station"), ...bikeMarkers]);
  };

  const handleStopSelect = async (stopId: string) => {
    setSelectedStopId(stopId);
    try {
      setVehicles(await apiService.getVehiclesForStop(stopId));
    } catch (error) {
      logger.error("Failed to load vehicles:", error);
    }
  };

  const handleRouteSelect = async (routeId: string) => {
    try {
      const routeDetails = await apiService.getRouteDetails(routeId);
      const shape = routeDetails?.shape;
      if (shape && shape.length > 0) {
        const nextShape: MapRouteShape = {
          routeId: routeDetails.routeId,
          shape,
          color: routeDetails.color || "#3b82f6",
        };
        setRouteShapes((prev) => [...prev.filter((r) => r.routeId !== routeId), nextShape]);
      }
    } catch (error) {
      logger.error("Failed to load route details:", error);
    }
  };

  const handleSafetyData = (analysis: RouteSafetyAnalysis) => {
    setRouteSafetyAnalysis(analysis);
    if (currentRoute?.polyline?.length) {
      const midPoint = currentRoute.polyline[Math.floor(currentRoute.polyline.length / 2)];
      apiService.getConstructionZones(midPoint[0], midPoint[1], 1000).then(setConstructionZones);
    }
  };

  const showStoryOnMap = () => {
    if (!activeStory?.position) return;
    setMapMarkers((prev) => {
      if (prev.find((m) => m.title === activeStory.landmarkName)) return prev;
      return [
        ...prev,
        {
          position: activeStory.position,
          title: activeStory.landmarkName,
          description: activeStory.title,
          type: "historical",
        },
      ];
    });
  };

  return {
    messages,
    isLoading,
    mapMarkers,
    userLocation,
    apiConnected,
    currentRoute,
    mapFilters,
    setMapFilters,
    playbooks,
    selectedPlaybook,
    loadingPlaybookId,
    activePersona,
    activeStory,
    setActiveStory,
    storyTriggers,
    routeSafetyAnalysis,
    constructionZones,
    vehicles,
    routeShapes,
    isChatVisible,
    setIsChatVisible,
    isTransportPanelVisible,
    setIsTransportPanelVisible,
    isMapFiltersVisible,
    setIsMapFiltersVisible,
    isPlaybooksVisible,
    setIsPlaybooksVisible,
    handleSendMessage,
    handlePlaybookSelect,
    handlePlaybookPrompt: handleSendMessage,
    handlePersonaPrompt: handleSendMessage,
    handleMoodboardSuggestion,
    handleWeatherClick,
    handleTransportDisruptions,
    handleRouteRequest,
    handleTransportStopsChange,
    handleBikeStationsChange,
    handleStopSelect,
    handleRouteSelect,
    handleSafetyData,
    showStoryOnMap,
  };
}
