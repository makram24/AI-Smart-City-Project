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
      console.log(`   Key length: ${this.openRouteApiKey.length} characters`);
    } else {
      console.info('💡 OpenRouteService API key not found - using fallback routes');
      console.info('   Add OPENROUTESERVICE_API_KEY to .env file to enable real routing');
      if (process.env.NODE_ENV === 'development') {
        console.info(`   Debug: process.env.OPENROUTESERVICE_API_KEY = ${process.env.OPENROUTESERVICE_API_KEY ? 'exists' : 'undefined'}`);
      }
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
      console.log(`   From: [${from[0]}, ${from[1]}] To: [${to[0]}, ${to[1]}]`);
      
      // OpenRouteService API v2 - try Authorization header first
      let response: any = null;
      let lastError: any = null;
      
      // Try Authorization header method (preferred for v2)
      try {
        response = await axios.post(
          `${this.baseUrl}/directions/${profile}`,
          {
            coordinates: [[from[1], from[0]], [to[1], to[0]]], // [lng, lat] format
            format: 'json',
            instructions: true,
            instructions_format: 'text',
            geometry: true
          },
          {
            headers: {
              'Authorization': this.openRouteApiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
            },
            timeout: 15000
          }
        );
        
        if (response.status === 200) {
          console.log(`✅ OpenRouteService API call successful (Authorization header)`);
        }
      } catch (err: any) {
        lastError = err;
        // If Authorization header fails, try with API key as query parameter
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.warn('⚠️ Authorization header failed, trying query parameter method...');
          try {
            response = await axios.post(
              `${this.baseUrl}/directions/${profile}?api_key=${encodeURIComponent(this.openRouteApiKey)}`,
              {
                coordinates: [[from[1], from[0]], [to[1], to[0]]],
                format: 'json',
                instructions: true,
                instructions_format: 'text',
                geometry: true
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                timeout: 15000
              }
            );
            console.log(`✅ OpenRouteService API call successful (query parameter)`);
          } catch (err2: any) {
            lastError = err2;
            throw err2;
          }
        } else {
          throw err;
        }
      }

      if (!response || response.status !== 200) {
        throw lastError || new Error('Failed to fetch route from OpenRouteService');
      }

      console.log(`📡 OpenRouteService response status: ${response.status}`);

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const segments = route.segments || [];
        
        console.log(`✅ OpenRouteService returned ${segments.length} segments`);
        
        // Enhanced logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 Route summary: ${route.summary?.distance}m, ${route.summary?.duration}s`);
          console.log(`📊 Geometry type: ${route.geometry?.type || 'unknown'}`);
        }
        
        // Extract turn-by-turn instructions
        const instructions: string[] = [];
        segments.forEach((segment: any) => {
          if (segment.steps && Array.isArray(segment.steps)) {
            segment.steps.forEach((step: any) => {
              if (step.instruction) {
                instructions.push(step.instruction);
              }
            });
          }
        });

        // Extract geometry from route - handle multiple formats
        const geometry: number[][] = [];
        
        if (route.geometry) {
          // Format 1: GeoJSON LineString with coordinates
          if (route.geometry.type === 'LineString' && Array.isArray(route.geometry.coordinates)) {
            route.geometry.coordinates.forEach((coord: number[]) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                // OpenRouteService returns [lng, lat], convert to [lat, lng] for frontend
                geometry.push([coord[1], coord[0]]);
              }
            });
          }
          // Format 2: Direct coordinates array (GeoJSON format)
          else if (Array.isArray(route.geometry.coordinates)) {
            route.geometry.coordinates.forEach((coord: number[]) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                // OpenRouteService returns [lng, lat], convert to [lat, lng]
                geometry.push([coord[1], coord[0]]);
              }
            });
          }
          // Format 3: Encoded polyline string
          else if (typeof route.geometry === 'string') {
            try {
              const decoded = this.decodePolyline(route.geometry);
              geometry.push(...decoded);
            } catch (e) {
              console.warn('⚠️ Failed to decode polyline, using fallback');
            }
          }
        }
        
        // Alternative: Try to extract from segments if geometry not available
        if (geometry.length === 0 && segments.length > 0) {
          segments.forEach((segment: any) => {
            // Try to get coordinates from segment steps
            if (segment.steps && Array.isArray(segment.steps)) {
              segment.steps.forEach((step: any) => {
                if (step.location && Array.isArray(step.location) && step.location.length >= 2) {
                  // step.location might be [lng, lat] or [lat, lng], check and convert
                  const lat = step.location[1] || step.location[0];
                  const lng = step.location[0] || step.location[1];
                  if (typeof lat === 'number' && typeof lng === 'number') {
                    geometry.push([lat, lng]);
                  }
                }
              });
            }
            // Try way_points if available
            if (segment.way_points && Array.isArray(segment.way_points)) {
              // Waypoints are indices, we'd need the full geometry to use them
            }
          });
        }

        // Remove duplicates and ensure minimum 2 points
        const uniqueGeometry = geometry.filter((coord, index, self) => 
          index === self.findIndex(c => c[0] === coord[0] && c[1] === coord[1])
        );

        // Final fallback: use start and end points
        if (uniqueGeometry.length < 2) {
          uniqueGeometry.length = 0; // Clear if insufficient
          uniqueGeometry.push(from, to);
          console.warn('⚠️ No geometry extracted, using start/end points only');
        }

        // Ensure we have at least start and end points
        if (uniqueGeometry.length > 0) {
          // Ensure first point is start and last is end
          const firstPoint = uniqueGeometry[0];
          const lastPoint = uniqueGeometry[uniqueGeometry.length - 1];
          const startDist = Math.abs(firstPoint[0] - from[0]) + Math.abs(firstPoint[1] - from[1]);
          const endDist = Math.abs(lastPoint[0] - to[0]) + Math.abs(lastPoint[1] - to[1]);
          
          if (startDist > 0.01) {
            uniqueGeometry.unshift(from);
          }
          if (endDist > 0.01) {
            uniqueGeometry.push(to);
          }
        }

        return {
          distance: Math.round(route.summary?.distance || 0),
          duration: Math.round(route.summary?.duration || 0),
          geometry: uniqueGeometry.length > 0 ? uniqueGeometry : [from, to],
          instructions: instructions.length > 0 ? instructions : [
            `Start from origin (${from[0].toFixed(4)}, ${from[1].toFixed(4)})`,
            `Follow the route`,
            `Arrive at destination (${to[0].toFixed(4)}, ${to[1].toFixed(4)})`
          ]
        };
      }
      
      console.warn('⚠️ OpenRouteService returned no routes');
      return null;
    } catch (error: any) {
      console.error(`❌ Error fetching ${profile} route from OpenRouteService:`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Status Text: ${error.response.statusText}`);
        console.error(`   Response:`, JSON.stringify(error.response.data, null, 2).substring(0, 500));
        if (error.response.status === 401 || error.response.status === 403) {
          console.error('   ⚠️ Authentication failed - check API key format and validity');
          console.error('   💡 Make sure API key is correct and not expired');
        } else if (error.response.status === 400) {
          console.error('   ⚠️ Bad request - check coordinates format');
        }
      } else if (error.request) {
        console.error('   Network error - no response received');
        console.error('   Check internet connection and OpenRouteService API status');
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

  // Decode Google polyline format (used by OpenRouteService)
  private decodePolyline(encoded: string): number[][] {
    const coordinates: number[][] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coordinates.push([lat * 1e-5, lng * 1e-5]); // Convert to [lat, lng]
    }

    return coordinates;
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

