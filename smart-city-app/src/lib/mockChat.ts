import { MapMarker } from "@/lib/api";

export function getMockResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("pharmacy") || lowerQuery.includes("pharmacies")) {
    return "I found 3 pharmacies near your location. They are marked on the map with green markers. The closest one is Budapest Pharmacy on Váci Street, open until 8 PM.";
  }
  if (lowerQuery.includes("restaurant") || lowerQuery.includes("food")) {
    return "Here are some great restaurants nearby! I've marked them on the map. For traditional Hungarian cuisine, try Café Central.";
  }
  if (lowerQuery.includes("route") || lowerQuery.includes("direction") || lowerQuery.includes("way")) {
    return "I've calculated the best route for you! The path is highlighted on the map. It should take about 15 minutes by foot or 8 minutes by public transport.";
  }
  if (lowerQuery.includes("budapest") || lowerQuery.includes("city")) {
    return "Welcome to Budapest! I can help you find places, get directions, check public transport schedules, and discover local events. What would you like to know?";
  }
  return "I understand you're looking for information about Budapest. I can help you find places, get directions, check transport schedules, and more. Could you be more specific about what you need?";
}

export function addMockMarkers(query: string): MapMarker[] {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("pharmacy") || lowerQuery.includes("pharmacies")) {
    return [
      {
        position: [47.4979, 19.0402],
        title: "Budapest Pharmacy",
        description: "Open until 8 PM",
        type: "pharmacy",
        rating: 4.2,
        hours: "Mon-Fri: 8:00-20:00",
      },
      {
        position: [47.5079, 19.0502],
        title: "City Center Pharmacy",
        description: "24/7 Emergency service",
        type: "pharmacy",
        rating: 4.5,
        hours: "24/7",
      },
    ];
  }

  if (lowerQuery.includes("restaurant") || lowerQuery.includes("food")) {
    return [
      {
        position: [47.4979, 19.0402],
        title: "Café Central",
        description: "Traditional Hungarian cuisine",
        type: "restaurant",
        rating: 4.7,
        hours: "Mon-Sun: 10:00-22:00",
      },
    ];
  }

  return [];
}
