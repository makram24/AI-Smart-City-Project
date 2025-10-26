import axios from 'axios';

// Routing Service using OpenRouteService
export class RoutingService {
  private apiKey: string;
  private baseUrl = 'https://api.openrouteservice.org/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_ORS_API_KEY || '';
  }

  // Get walking route between two points
  async getWalkingRoute(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number
  ): Promise<{
    distance: number;
    duration: number;
    geometry: number[][];
    instructions: string[];
  } | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/directions/foot-walking/json`, {
        coordinates: [[startLng, startLat], [endLng, endLat]],
        format: 'geojson',
        instructions: true,
        instructions_format: 'text'
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.features && response.data.features.length > 0) {
        const route = response.data.features[0];
        const properties = route.properties;
        
        return {
          distance: properties.summary.distance,
          duration: properties.summary.duration,
          geometry: route.geometry.coordinates,
          instructions: properties.segments.flatMap((segment: any) => 
            segment.steps.map((step: any) => step.instruction)
          )
        };
      }
      return null;
    } catch (error) {
      console.error('Walking route error:', error);
      return null;
    }
  }

  // Get driving route between two points
  async getDrivingRoute(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number
  ): Promise<{
    distance: number;
    duration: number;
    geometry: number[][];
    instructions: string[];
  } | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/directions/driving-car/json`, {
        coordinates: [[startLng, startLat], [endLng, endLat]],
        format: 'geojson',
        instructions: true,
        instructions_format: 'text'
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.features && response.data.features.length > 0) {
        const route = response.data.features[0];
        const properties = route.properties;
        
        return {
          distance: properties.summary.distance,
          duration: properties.summary.duration,
          geometry: route.geometry.coordinates,
          instructions: properties.segments.flatMap((segment: any) => 
            segment.steps.map((step: any) => step.instruction)
          )
        };
      }
      return null;
    } catch (error) {
      console.error('Driving route error:', error);
      return null;
    }
  }

  // Get cycling route between two points
  async getCyclingRoute(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number
  ): Promise<{
    distance: number;
    duration: number;
    geometry: number[][];
    instructions: string[];
  } | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/directions/cycling-regular/json`, {
        coordinates: [[startLng, startLat], [endLng, endLat]],
        format: 'geojson',
        instructions: true,
        instructions_format: 'text'
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.features && response.data.features.length > 0) {
        const route = response.data.features[0];
        const properties = route.properties;
        
        return {
          distance: properties.summary.distance,
          duration: properties.summary.duration,
          geometry: route.geometry.coordinates,
          instructions: properties.segments.flatMap((segment: any) => 
            segment.steps.map((step: any) => step.instruction)
          )
        };
      }
      return null;
    } catch (error) {
      console.error('Cycling route error:', error);
      return null;
    }
  }

  // Get public transport route (if available)
  async getPublicTransportRoute(
    startLat: number, 
    startLng: number, 
    endLat: number, 
    endLng: number
  ): Promise<{
    distance: number;
    duration: number;
    geometry: number[][];
    instructions: string[];
    transfers: number;
  } | null> {
    try {
      // This would typically use a public transport API like BKK FUTÁR
      // For now, we'll return a mock response
      return {
        distance: 5000, // meters
        duration: 1800, // seconds
        geometry: [[startLng, startLat], [endLng, endLat]],
        instructions: [
          'Walk to nearest bus stop',
          'Take bus 15 to city center',
          'Transfer to tram 2',
          'Walk to destination'
        ],
        transfers: 1
      };
    } catch (error) {
      console.error('Public transport route error:', error);
      return null;
    }
  }

  // Format duration in human-readable format
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Format distance in human-readable format
  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }
}

export const routingService = new RoutingService();
