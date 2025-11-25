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
    
    if (this.useRealApi) {
      console.log('✅ OpenRouteService API key found - real routing enabled');
    } else {
      console.info('💡 OpenRouteService API key not found - using fallback routes');
      console.info('   Add OPENROUTESERVICE_API_KEY to .env file to enable real routing');
    }
  }

  // Get walking route between two points
  async getWalkingRoute(from: [number, number], to: [number, number]): Promise<RouteResult | null> {
    if (this.useRealApi) {
      try {
        const route = await this.fetchRealRoute(from, to, 'foot-walking');
        if (route) {
          console.log('✅ OpenRouteService: Retrieved real walking route');
          return route;
        }
      } catch (error: any) {
        console.warn('⚠️ OpenRouteService walking route failed:', error.message || error);
        if (error.response) {
          console.warn(`   Status: ${error.response.status}, Message: ${error.response.statusText}`);
        }
      }
    }

    // Fallback to simple calculation
    console.info('💡 Using fallback route calculation (add OPENROUTESERVICE_API_KEY to .env for real routes)');
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
      console.log(`🔍 Attempting OpenRouteService API call for ${profile}...`);
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
            'Content-Type': 'application/json',
            'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
          },
          timeout: 10000
        }
      );

      console.log(`📡 OpenRouteService response status: ${response.status}`);

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const segments = route.segments || [];
        
        console.log(`✅ OpenRouteService returned ${segments.length} segments`);
        
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
    } catch (error: any) {
      console.error(`❌ Error fetching ${profile} route from OpenRouteService:`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Status Text: ${error.response.statusText}`);
        console.error(`   Response:`, error.response.data);
        if (error.response.status === 401 || error.response.status === 403) {
          console.error('   ⚠️ Authentication failed - check API key');
        }
      } else if (error.request) {
        console.error('   Network error - no response received');
      } else {
        console.error('   Error:', error.message);
      }
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

