import { geospatialService } from './geospatial';
import { routingService } from './routing';

export interface ToolResult {
  text: string;
  markers?: Array<{
    position: [number, number];
    title: string;
    description?: string;
    type?: string;
  }>;
  route?: {
    distance: string;
    duration: string;
    steps: Array<{ instruction: string; distance: string }>;
    polyline: number[][];
  };
}

export class AITools {
  // Find places tool
  async findPlaces(query: string, userLocation: { lat: number; lng: number }): Promise<ToolResult> {
    try {
      const places = await geospatialService.searchPlaces(query, userLocation.lat, userLocation.lng);
      
      if (places.length === 0) {
        return {
          text: `I couldn't find any ${query} near your location. Try expanding your search area or check a different type of place.`
        };
      }

      const markers = places.slice(0, 5).map((place: any) => ({
        position: [place.lat || place.center?.lat, place.lon || place.center?.lon] as [number, number],
        title: place.tags?.name || 'Place',
        description: this.getPlaceDescription(place),
        type: place.tags?.amenity || 'place'
      }));

      const nearest = places[0];
      const distance = geospatialService.calculateDistance(
        userLocation.lat, 
        userLocation.lng,
        nearest.lat || nearest.center?.lat,
        nearest.lon || nearest.center?.lon
      );

      return {
        text: `I found ${places.length} ${query} near you. The nearest is ${nearest.tags?.name || 'a place'} located ${distance.toFixed(1)} km away. Check the map for all locations!`,
        markers
      };
    } catch (error) {
      console.error('Find places error:', error);
      return {
        text: `Sorry, I had trouble finding ${query} near you. Please try again.`
      };
    }
  }

  // Get directions tool
  async getDirections(from: string, to: string, userLocation?: { lat: number; lng: number }): Promise<ToolResult> {
    try {
      // If "from" is not specified, use user location
      let fromCoords: [number, number];
      if (from.toLowerCase().includes('here') || from.toLowerCase().includes('me') || !from) {
        if (!userLocation) {
          return {
            text: 'I need your location to calculate directions. Please allow location access.'
          };
        }
        fromCoords = [userLocation.lat, userLocation.lng];
      } else {
        // Geocode the "from" address
        const fromResult = await geospatialService.geocode(from);
        if (!fromResult) {
          return {
            text: `I couldn't find the starting location "${from}". Please provide a valid address or landmark.`
          };
        }
        fromCoords = [fromResult.lat, fromResult.lng];
      }

      // Geocode the destination
      const toResult = await geospatialService.geocode(to);
      if (!toResult) {
        return {
          text: `I couldn't find the destination "${to}". Please provide a valid address or landmark.`
        };
      }

      // Get walking route
      const route = await routingService.getWalkingRoute(
        fromCoords[0], fromCoords[1],
        toResult.lat, toResult.lng
      );

      if (!route) {
        return {
          text: `I couldn't calculate a route from ${from} to ${to}. Please check the addresses and try again.`
        };
      }

      return {
        text: `Here's your route to ${toResult.display_name}. It's ${routingService.formatDistance(route.distance)} and should take about ${routingService.formatDuration(route.duration)}.`,
        route: {
          distance: routingService.formatDistance(route.distance),
          duration: routingService.formatDuration(route.duration),
          steps: route.instructions.map((instruction, index) => ({
            instruction,
            distance: `${Math.floor(Math.random() * 500 + 100)}m` // Mock distance for now
          })),
          polyline: route.geometry
        }
      };
    } catch (error) {
      console.error('Directions error:', error);
      return {
        text: 'Sorry, I had trouble calculating directions. Please try again with different addresses.'
      };
    }
  }

  // Get current location context
  async getLocationContext(userLocation: { lat: number; lng: number }): Promise<ToolResult> {
    try {
      // Get reverse geocoding
      const address = await geospatialService.reverseGeocode(userLocation.lat, userLocation.lng);
      
      // Find nearby services
      const pharmacies = await geospatialService.getPharmacies(userLocation.lat, userLocation.lng, 500);
      const restaurants = await geospatialService.getRestaurants(userLocation.lat, userLocation.lng, 500);

      const context = [];
      if (address) context.push(`You're currently at ${address}`);
      if (pharmacies.length > 0) context.push(`${pharmacies.length} pharmacies nearby`);
      if (restaurants.length > 0) context.push(`${restaurants.length} restaurants nearby`);

      return {
        text: context.join('. ') + '. What would you like to do?',
        markers: []
      };
    } catch (error) {
      console.error('Location context error:', error);
      return {
        text: 'I can see your location, but I had trouble getting additional context. What would you like to do?'
      };
    }
  }

  // Search for specific services
  async searchServices(serviceType: string, userLocation: { lat: number; lng: number }): Promise<ToolResult> {
    const serviceMap: { [key: string]: string } = {
      'pharmacy': 'pharmacy',
      'pharmacies': 'pharmacy',
      'restaurant': 'restaurant',
      'restaurants': 'restaurant',
      'cafe': 'cafe',
      'cafes': 'cafe',
      'food': 'restaurant',
      'bank': 'bank',
      'atm': 'atm',
      'hospital': 'hospital',
      'clinic': 'clinic',
      'gas': 'fuel',
      'gas station': 'fuel',
      'parking': 'parking',
      'hotel': 'hotel',
      'hotels': 'hotel'
    };

    const amenity = serviceMap[serviceType.toLowerCase()] || 'restaurant';
    
    try {
      const places = await geospatialService.searchPlaces(amenity, userLocation.lat, userLocation.lng);
      
      if (places.length === 0) {
        return {
          text: `I couldn't find any ${serviceType} near your location. Try expanding your search area.`
        };
      }

      const markers = places.slice(0, 8).map((place: any) => ({
        position: [place.lat || place.center?.lat, place.lon || place.center?.lon] as [number, number],
        title: place.tags?.name || serviceType,
        description: this.getPlaceDescription(place),
        type: amenity
      }));

      const nearest = places[0];
      const distance = geospatialService.calculateDistance(
        userLocation.lat, 
        userLocation.lng,
        nearest.lat || nearest.center?.lat,
        nearest.lon || nearest.center?.lon
      );

      return {
        text: `I found ${places.length} ${serviceType} near you. The nearest is ${nearest.tags?.name || 'a place'} located ${distance.toFixed(1)} km away.`,
        markers
      };
    } catch (error) {
      console.error('Service search error:', error);
      return {
        text: `Sorry, I had trouble finding ${serviceType} near you. Please try again.`
      };
    }
  }

  private getPlaceDescription(place: any): string {
    const tags = place.tags || {};
    const descriptions = [];
    
    if (tags.opening_hours) descriptions.push(`Hours: ${tags.opening_hours}`);
    if (tags.cuisine) descriptions.push(`Cuisine: ${tags.cuisine}`);
    if (tags.phone) descriptions.push(`Phone: ${tags.phone}`);
    if (tags.website) descriptions.push(`Website: ${tags.website}`);
    
    return descriptions.length > 0 ? descriptions.join(' • ') : 'No additional info';
  }
}

export const aiTools = new AITools();
