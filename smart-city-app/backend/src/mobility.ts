import axios from 'axios';

export interface BikeStation {
  id: string;
  name: string;
  position: [number, number];
  availableBikes: number;
  availableDocks: number;
  totalDocks: number;
  status: 'active' | 'inactive' | 'maintenance';
  lastUpdated: string;
}

export interface BikeRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: number[][];
  instructions: string[];
}

export interface BikeAvailability {
  stationId: string;
  stationName: string;
  availableBikes: number;
  availableDocks: number;
  distance: number; // meters from user
}

export class SharedMobilityService {
  private molBubiApiUrl = 'https://api.molbubi.hu/api/stations';
  private userAgent = 'AI-Smart-City-App/1.0';
  private useRealApi = process.env.MOL_BUBI_API_ENABLED === 'true' || false;

  // Get all bike stations
  async getAllBikeStations(): Promise<BikeStation[]> {
    // Try real API first if enabled
    if (this.useRealApi) {
      try {
        const realStations = await this.fetchRealBikeStations();
        if (realStations && realStations.length > 0) {
          return realStations;
        }
      } catch (error) {
        console.warn('MOL Bubi API failed, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    try {
      // Mock MOL Bubi data for Budapest
      const mockStations: BikeStation[] = [
        {
          id: 'station_001',
          name: 'Deák Ferenc tér',
          position: [47.4979, 19.0402],
          availableBikes: 8,
          availableDocks: 12,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_002',
          name: 'Vörösmarty tér',
          position: [47.4969, 19.0412],
          availableBikes: 15,
          availableDocks: 5,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_003',
          name: 'Astoria',
          position: [47.4949, 19.0592],
          availableBikes: 3,
          availableDocks: 17,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_004',
          name: 'Kálvin tér',
          position: [47.4879, 19.0602],
          availableBikes: 0,
          availableDocks: 20,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_005',
          name: 'Széll Kálmán tér',
          position: [47.5079, 19.0202],
          availableBikes: 12,
          availableDocks: 8,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_006',
          name: 'Margit híd',
          position: [47.5179, 19.0402],
          availableBikes: 6,
          availableDocks: 14,
          totalDocks: 20,
          status: 'maintenance',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_007',
          name: 'Batthyány tér',
          position: [47.5079, 19.0302],
          availableBikes: 18,
          availableDocks: 2,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'station_008',
          name: 'Moszkva tér',
          position: [47.5179, 19.0102],
          availableBikes: 4,
          availableDocks: 16,
          totalDocks: 20,
          status: 'active',
          lastUpdated: new Date().toISOString()
        }
      ];

      return mockStations;
    } catch (error) {
      console.error('Error fetching bike stations:', error);
      return [];
    }
  }

  // Fetch real bike stations from MOL Bubi API
  private async fetchRealBikeStations(): Promise<BikeStation[]> {
    try {
      const response = await axios.get(this.molBubiApiUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((station: any) => ({
          id: station.id || station.stationId || `station_${station.number}`,
          name: station.name || station.stationName || 'Unknown Station',
          position: [station.lat || station.latitude, station.lng || station.longitude],
          availableBikes: station.availableBikes || station.bikesAvailable || 0,
          availableDocks: station.availableDocks || station.docksAvailable || 0,
          totalDocks: station.totalDocks || station.capacity || 20,
          status: this.mapStationStatus(station.status || station.isActive),
          lastUpdated: station.lastUpdated || new Date().toISOString()
        }));
      } else if (response.data && response.data.stations) {
        // Handle nested response structure
        return response.data.stations.map((station: any) => ({
          id: station.id || station.stationId || `station_${station.number}`,
          name: station.name || station.stationName || 'Unknown Station',
          position: [station.lat || station.latitude, station.lng || station.longitude],
          availableBikes: station.availableBikes || station.bikesAvailable || 0,
          availableDocks: station.availableDocks || station.docksAvailable || 0,
          totalDocks: station.totalDocks || station.capacity || 20,
          status: this.mapStationStatus(station.status || station.isActive),
          lastUpdated: station.lastUpdated || new Date().toISOString()
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching real MOL Bubi stations:', error);
      throw error;
    }
  }

  // Map API status to our status type
  private mapStationStatus(status: any): 'active' | 'inactive' | 'maintenance' {
    if (typeof status === 'boolean') {
      return status ? 'active' : 'inactive';
    }
    const statusStr = String(status).toLowerCase();
    if (statusStr.includes('active') || statusStr === 'true' || statusStr === '1') {
      return 'active';
    }
    if (statusStr.includes('maintenance') || statusStr.includes('repair')) {
      return 'maintenance';
    }
    return 'inactive';
  }

  // Get nearby bike stations
  async getNearbyBikeStations(lat: number, lng: number, radius: number = 1000): Promise<BikeAvailability[]> {
    try {
      const allStations = await this.getAllBikeStations();
      
      const nearbyStations = allStations
        .filter(station => station.status === 'active')
        .map(station => {
          const distance = this.calculateDistance(lat, lng, station.position[0], station.position[1]);
          return {
            stationId: station.id,
            stationName: station.name,
            availableBikes: station.availableBikes,
            availableDocks: station.availableDocks,
            distance
          };
        })
        .filter(station => station.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      return nearbyStations;
    } catch (error) {
      console.error('Error fetching nearby bike stations:', error);
      return [];
    }
  }

  // Get bike route between two points
  async getBikeRoute(from: [number, number], to: [number, number]): Promise<BikeRoute | null> {
    // Try OpenRouteService if available
    const openRouteApiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (openRouteApiKey) {
      try {
        const realRoute = await this.fetchRealBikeRoute(from, to, openRouteApiKey);
        if (realRoute) {
          return realRoute;
        }
      } catch (error) {
        console.warn('OpenRouteService failed, falling back to simple calculation:', error);
      }
    }

    // Fallback to simple calculation
    try {
      const distance = this.calculateDistance(from[0], from[1], to[0], to[1]);
      const duration = Math.round(distance / 4); // Assume 4 m/s average bike speed

      // Mock route geometry (simplified straight line)
      const geometry = [
        [from[1], from[0]], // [lng, lat]
        [to[1], to[0]]
      ];

      const instructions = [
        'Start cycling from starting point',
        'Follow bike-friendly route',
        'Arrive at destination'
      ];

      return {
        distance,
        duration,
        geometry,
        instructions
      };
    } catch (error) {
      console.error('Error calculating bike route:', error);
      return null;
    }
  }

  // Fetch real bike route from OpenRouteService
  private async fetchRealBikeRoute(from: [number, number], to: [number, number], apiKey: string): Promise<BikeRoute | null> {
    try {
      const response = await axios.post(
        'https://api.openrouteservice.org/v2/directions/cycling-regular',
        {
          coordinates: [[from[1], from[0]], [to[1], to[0]]], // [lng, lat] format
          profile: 'cycling-regular',
          format: 'json'
        },
        {
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const geometry = route.geometry?.coordinates || [];
        const segments = route.segments || [];
        
        const instructions: string[] = [];
        segments.forEach((segment: any) => {
          segment.steps?.forEach((step: any) => {
            if (step.instruction) {
              instructions.push(step.instruction);
            }
          });
        });

        return {
          distance: Math.round(route.summary?.distance || 0),
          duration: Math.round(route.summary?.duration || 0),
          geometry: geometry.map((coord: number[]) => [coord[1], coord[0]]), // Convert to [lat, lng]
          instructions: instructions.length > 0 ? instructions : [
            'Start cycling from starting point',
            'Follow the route',
            'Arrive at destination'
          ]
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching real bike route:', error);
      throw error;
    }
  }

  // Get bike station status
  async getStationStatus(stationId: string): Promise<BikeStation | null> {
    try {
      const allStations = await this.getAllBikeStations();
      return allStations.find(station => station.id === stationId) || null;
    } catch (error) {
      console.error('Error fetching station status:', error);
      return null;
    }
  }

  // Get bike availability summary
  async getBikeAvailabilitySummary(): Promise<{
    totalStations: number;
    activeStations: number;
    totalBikes: number;
    availableBikes: number;
    totalDocks: number;
    availableDocks: number;
  }> {
    try {
      const allStations = await this.getAllBikeStations();
      
      const summary = allStations.reduce((acc, station) => {
        if (station.status === 'active') {
          acc.activeStations++;
          acc.totalBikes += station.availableBikes;
          acc.availableBikes += station.availableBikes;
          acc.totalDocks += station.totalDocks;
          acc.availableDocks += station.availableDocks;
        }
        acc.totalStations++;
        return acc;
      }, {
        totalStations: 0,
        activeStations: 0,
        totalBikes: 0,
        availableBikes: 0,
        totalDocks: 0,
        availableDocks: 0
      });

      return summary;
    } catch (error) {
      console.error('Error fetching bike availability summary:', error);
      return {
        totalStations: 0,
        activeStations: 0,
        totalBikes: 0,
        availableBikes: 0,
        totalDocks: 0,
        availableDocks: 0
      };
    }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
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
}

export const sharedMobilityService = new SharedMobilityService();
