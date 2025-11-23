import axios from 'axios';

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  geometry: number[][]; // [lat, lng] coordinates
  instructions: string[];
}

export class RoutingService {
  private openRouteApiKey: string;
  private baseUrl = 'https://api.openrouteservice.org/v2';
  private useRealApi: boolean;

  constructor() {
    this.openRouteApiKey = process.env.OPENROUTESERVICE_API_KEY || '';
    this.useRealApi = !!this.openRouteApiKey;
  }

  // Get walking route between two points
  async getWalkingRoute(from: [number, number], to: [number, number]): Promise<RouteResult | null> {
    if (this.useRealApi) {
      try {
        return await this.fetchRealRoute(from, to, 'foot-walking');
      } catch (error) {
        console.warn('OpenRouteService walking route failed, using fallback:', error);
      }
    }

    // Fallback to simple calculation
    return this.getSimpleRoute(from, to, 1.4); // 1.4 m/s average walking speed
  }

  // Get cycling route between two points
  async getCyclingRoute(from: [number, number], to: [number, number]): Promise<RouteResult | null> {
    if (this.useRealApi) {
      try {
        return await this.fetchRealRoute(from, to, 'cycling-regular');
      } catch (error) {
        console.warn('OpenRouteService cycling route failed, using fallback:', error);
      }
    }

    // Fallback to simple calculation
    return this.getSimpleRoute(from, to, 4.0); // 4 m/s average cycling speed
  }

  // Get driving route between two points
  async getDrivingRoute(from: [number, number], to: [number, number]): Promise<RouteResult | null> {
    if (this.useRealApi) {
      try {
        return await this.fetchRealRoute(from, to, 'driving-car');
      } catch (error) {
        console.warn('OpenRouteService driving route failed, using fallback:', error);
      }
    }

    // Fallback to simple calculation
    return this.getSimpleRoute(from, to, 13.9); // ~50 km/h average city speed
  }

  // Fetch real route from OpenRouteService
  private async fetchRealRoute(
    from: [number, number],
    to: [number, number],
    profile: 'foot-walking' | 'cycling-regular' | 'driving-car'
  ): Promise<RouteResult | null> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/directions/${profile}`,
        {
          coordinates: [[from[1], from[0]], [to[1], to[0]]], // [lng, lat] format
          format: 'json',
          instructions: true,
          instructions_format: 'text'
        },
        {
          headers: {
            'Authorization': this.openRouteApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const segments = route.segments || [];
        
        const instructions: string[] = [];
        segments.forEach((segment: any) => {
          if (segment.steps) {
            segment.steps.forEach((step: any) => {
              if (step.instruction) {
                instructions.push(step.instruction);
              }
            });
          }
        });

        // Extract geometry from route
        const geometry: number[][] = [];
        if (route.geometry) {
          // Decode polyline if needed, or use coordinates directly
          if (Array.isArray(route.geometry.coordinates)) {
            route.geometry.coordinates.forEach((coord: number[]) => {
              geometry.push([coord[1], coord[0]]); // Convert [lng, lat] to [lat, lng]
            });
          }
        } else {
          // Fallback: simple line between points
          geometry.push(from, to);
        }

        return {
          distance: Math.round(route.summary?.distance || 0),
          duration: Math.round(route.summary?.duration || 0),
          geometry: geometry.length > 0 ? geometry : [from, to],
          instructions: instructions.length > 0 ? instructions : [
            'Start from origin',
            'Follow the route',
            'Arrive at destination'
          ]
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching ${profile} route from OpenRouteService:`, error);
      throw error;
    }
  }

  // Simple route calculation (fallback)
  private getSimpleRoute(from: [number, number], to: [number, number], speed: number): RouteResult {
    const distance = this.calculateDistance(from[0], from[1], to[0], to[1]);
    const duration = Math.round(distance / speed);

    return {
      distance: Math.round(distance),
      duration,
      geometry: [from, to],
      instructions: [
        'Start from origin',
        'Follow the route',
        'Arrive at destination'
      ]
    };
  }

  // Calculate distance using Haversine formula
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Return in meters
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Format duration in human-readable format
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
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

