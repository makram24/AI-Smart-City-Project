import axios from 'axios';

export interface TransportStop {
  id: string;
  name: string;
  position: [number, number];
  type: 'bus' | 'tram' | 'metro' | 'trolley';
  routes: string[];
}

export interface TransportRoute {
  id: string;
  name: string;
  type: 'bus' | 'tram' | 'metro' | 'trolley';
  stops: TransportStop[];
  color?: string;
}

export interface ArrivalInfo {
  route: string;
  destination: string;
  arrivalTime: string;
  delay?: number;
  vehicleType: string;
}

export interface TransportRoutePlan {
  from: string;
  to: string;
  duration: number;
  transfers: number;
  steps: Array<{
    type: 'walk' | 'bus' | 'tram' | 'metro';
    route?: string;
    from: string;
    to: string;
    duration: number;
    distance?: number;
  }>;
}

export class PublicTransportService {
  private bkkApiUrl = 'https://futar.bkk.hu/api/query/v1/ws/otp/api/where';
  private userAgent = 'AI-Smart-City-App/1.0';

  // Get nearby transport stops
  async getNearbyStops(lat: number, lng: number, radius: number = 500): Promise<TransportStop[]> {
    try {
      // Mock data for Budapest transport stops
      const mockStops: TransportStop[] = [
        {
          id: 'stop_001',
          name: 'Deák Ferenc tér M',
          position: [47.4979, 19.0402],
          type: 'metro',
          routes: ['M1', 'M2', 'M3']
        },
        {
          id: 'stop_002',
          name: 'Vörösmarty tér M',
          position: [47.4969, 19.0412],
          type: 'metro',
          routes: ['M1']
        },
        {
          id: 'stop_003',
          name: 'Astoria M',
          position: [47.4949, 19.0592],
          type: 'metro',
          routes: ['M2']
        },
        {
          id: 'stop_004',
          name: 'Kálvin tér M',
          position: [47.4879, 19.0602],
          type: 'metro',
          routes: ['M3', 'M4']
        },
        {
          id: 'stop_005',
          name: 'Széll Kálmán tér M',
          position: [47.5079, 19.0202],
          type: 'metro',
          routes: ['M2']
        },
        {
          id: 'stop_006',
          name: 'Moszkva tér',
          position: [47.5179, 19.0102],
          type: 'bus',
          routes: ['5', '16', '116']
        },
        {
          id: 'stop_007',
          name: 'Margit híd, budai hídfő',
          position: [47.5179, 19.0402],
          type: 'tram',
          routes: ['4', '6']
        },
        {
          id: 'stop_008',
          name: 'Batthyány tér M+H',
          position: [47.5079, 19.0302],
          type: 'metro',
          routes: ['M2']
        }
      ];

      // Filter stops within radius
      const nearbyStops = mockStops.filter(stop => {
        const distance = this.calculateDistance(lat, lng, stop.position[0], stop.position[1]);
        return distance <= radius;
      });

      return nearbyStops;
    } catch (error) {
      console.error('Error fetching nearby stops:', error);
      return [];
    }
  }

  // Get real-time arrivals for a stop
  async getStopArrivals(stopId: string): Promise<ArrivalInfo[]> {
    try {
      // Mock real-time data
      const mockArrivals: ArrivalInfo[] = [
        {
          route: 'M2',
          destination: 'Örs vezér tere',
          arrivalTime: '2 min',
          delay: 0,
          vehicleType: 'metro'
        },
        {
          route: 'M2',
          destination: 'Déli pályaudvar',
          arrivalTime: '5 min',
          delay: 1,
          vehicleType: 'metro'
        },
        {
          route: '5',
          destination: 'Rákospalota, Kossuth utca',
          arrivalTime: '3 min',
          delay: 0,
          vehicleType: 'bus'
        },
        {
          route: '4',
          destination: 'Újpest-központ',
          arrivalTime: '7 min',
          delay: 2,
          vehicleType: 'tram'
        }
      ];

      return mockArrivals;
    } catch (error) {
      console.error('Error fetching stop arrivals:', error);
      return [];
    }
  }

  // Plan a journey using public transport
  async planJourney(from: [number, number], to: [number, number]): Promise<TransportRoutePlan | null> {
    try {
      // Mock journey planning
      const mockJourney: TransportRoutePlan = {
        from: 'Starting point',
        to: 'Destination',
        duration: 25, // minutes
        transfers: 1,
        steps: [
          {
            type: 'walk',
            from: 'Starting point',
            to: 'Deák Ferenc tér M',
            duration: 3,
            distance: 200
          },
          {
            type: 'metro',
            route: 'M2',
            from: 'Deák Ferenc tér M',
            to: 'Széll Kálmán tér M',
            duration: 8
          },
          {
            type: 'walk',
            from: 'Széll Kálmán tér M',
            to: 'Destination',
            duration: 5,
            distance: 400
          }
        ]
      };

      return mockJourney;
    } catch (error) {
      console.error('Error planning journey:', error);
      return null;
    }
  }

  // Get transport disruptions/alerts
  async getDisruptions(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    affectedRoutes: string[];
    startTime: string;
    endTime?: string;
  }>> {
    try {
      // Mock disruption data
      const mockDisruptions = [
        {
          id: 'disruption_001',
          title: 'M2 Metro Delay',
          description: 'Delays of up to 10 minutes due to signal problems',
          severity: 'medium' as const,
          affectedRoutes: ['M2'],
          startTime: '2024-01-01T08:00:00Z',
          endTime: '2024-01-01T12:00:00Z'
        },
        {
          id: 'disruption_002',
          title: 'Bus Route 5 Detour',
          description: 'Route 5 temporarily diverted due to road works',
          severity: 'low' as const,
          affectedRoutes: ['5'],
          startTime: '2024-01-01T06:00:00Z',
          endTime: '2024-01-01T18:00:00Z'
        }
      ];

      return mockDisruptions;
    } catch (error) {
      console.error('Error fetching disruptions:', error);
      return [];
    }
  }

  // Get transport routes by type
  async getRoutesByType(type: 'bus' | 'tram' | 'metro' | 'trolley'): Promise<TransportRoute[]> {
    try {
      const mockRoutes: TransportRoute[] = [
        {
          id: 'route_m2',
          name: 'M2 Metro',
          type: 'metro',
          color: '#D71E2B',
          stops: [
            { id: 'stop_001', name: 'Deák Ferenc tér M', position: [47.4979, 19.0402], type: 'metro', routes: ['M2'] },
            { id: 'stop_005', name: 'Széll Kálmán tér M', position: [47.5079, 19.0202], type: 'metro', routes: ['M2'] }
          ]
        },
        {
          id: 'route_5',
          name: 'Bus 5',
          type: 'bus',
          color: '#0066CC',
          stops: [
            { id: 'stop_006', name: 'Moszkva tér', position: [47.5179, 19.0102], type: 'bus', routes: ['5'] }
          ]
        },
        {
          id: 'route_4',
          name: 'Tram 4',
          type: 'tram',
          color: '#00AA44',
          stops: [
            { id: 'stop_007', name: 'Margit híd, budai hídfő', position: [47.5179, 19.0402], type: 'tram', routes: ['4'] }
          ]
        }
      ];

      return mockRoutes.filter(route => route.type === type);
    } catch (error) {
      console.error('Error fetching routes:', error);
      return [];
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

export const publicTransportService = new PublicTransportService();
