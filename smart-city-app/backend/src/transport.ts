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
  private bkkApiBaseUrl = 'https://go.bkk.hu/api/query/v1/ws/otp/api/where';
  private bkkGtfsRtBaseUrl = 'https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full';
  private userAgent = 'AI-Smart-City-App/1.0';
  private useRealApi = process.env.BKK_API_ENABLED === 'true' || false;
  private apiKey = process.env.BKK_API_KEY || '';

  // Get nearby transport stops
  async getNearbyStops(lat: number, lng: number, radius: number = 500): Promise<TransportStop[]> {
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const realStops = await this.fetchRealNearbyStops(lat, lng, radius);
        if (realStops && realStops.length > 0) {
          console.log(`✅ BKK API active! Retrieved ${realStops.length} real stops`);
          return realStops;
        }
      } catch (error: any) {
        // Log detailed error for debugging
        if (error.response) {
          console.warn(`⚠️ BKK API error (${error.response.status}): ${error.response.statusText}`);
          if (error.response.status === 401 || error.response.status === 403) {
            console.info('💡 API key may not be activated yet. BKK requires 2 days for activation.');
          }
        } else {
          console.warn('⚠️ BKK API failed, falling back to mock data:', error.message);
        }
      }
    } else if (this.apiKey && !this.useRealApi) {
      console.info('💡 BKK API key found but API is disabled. Set BKK_API_ENABLED=true to use real data.');
    }

    // Fallback to mock data
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

  // Fetch real nearby stops from BKK FUTÁR API
  private async fetchRealNearbyStops(lat: number, lng: number, radius: number): Promise<TransportStop[]> {
    try {
      // BKK FUTÁR API endpoint for stops near location
      // API key must be passed as query parameter 'key'
      const response = await axios.get(`${this.bkkApiBaseUrl}/stops-for-location`, {
        params: {
          lat,
          lon: lng,
          radius: radius,
          key: this.apiKey // API key as query parameter
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      // BKK FUTÁR API response structure
      if (response.data && response.data.data && response.data.data.list) {
        return response.data.data.list.map((stop: any) => ({
          id: stop.id || stop.stopId || `stop_${stop.code}`,
          name: stop.name || stop.stopName || 'Unknown Stop',
          position: [
            stop.lat || stop.coordinates?.lat || stop.latitude,
            stop.lon || stop.coordinates?.lon || stop.longitude
          ],
          type: this.mapStopType(stop.routeType || stop.type || stop.stopType),
          routes: stop.routes ? stop.routes.map((r: any) => r.shortName || r.name || r.routeShortName) : []
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching real BKK stops:', error);
      throw error;
    }
  }

  // Map BKK stop type to our type
  private mapStopType(bkkType: string | number): 'bus' | 'tram' | 'metro' | 'trolley' {
    const typeMap: { [key: string]: 'bus' | 'tram' | 'metro' | 'trolley' } = {
      '0': 'tram',
      '1': 'metro',
      '3': 'bus',
      '11': 'trolley',
      'tram': 'tram',
      'metro': 'metro',
      'bus': 'bus',
      'trolley': 'trolley'
    };
    return typeMap[String(bkkType)] || 'bus';
  }

  // Get real-time arrivals for a stop
  async getStopArrivals(stopId: string): Promise<ArrivalInfo[]> {
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const realArrivals = await this.fetchRealArrivals(stopId);
        if (realArrivals && realArrivals.length > 0) {
          console.log(`✅ BKK API active! Retrieved ${realArrivals.length} real arrivals for stop ${stopId}`);
          return realArrivals;
        }
      } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.info('💡 BKK API key not yet activated (2-day activation period)');
        } else {
          console.warn('⚠️ BKK arrivals API failed, falling back to mock data:', error.message);
        }
      }
    }

    // Fallback to mock data
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

  // Fetch real arrivals from BKK FUTÁR API
  private async fetchRealArrivals(stopId: string): Promise<ArrivalInfo[]> {
    try {
      // Clean stop ID (remove 'stop_' prefix if present)
      const cleanStopId = stopId.replace('stop_', '');
      
      // BKK FUTÁR API endpoint for arrivals and departures
      const response = await axios.get(`${this.bkkApiBaseUrl}/arrivals-and-departures-for-stop`, {
        params: {
          stopId: cleanStopId,
          key: this.apiKey, // API key as query parameter
          minutesBefore: 0,
          minutesAfter: 30
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      if (response.data && response.data.data && response.data.data.entry) {
        const arrivals = response.data.data.entry.arrivalsAndDepartures || [];
        return arrivals.map((arrival: any) => {
          const route = arrival.routeShortName || arrival.routeId || 'Unknown';
          const predictedTime = arrival.predictedArrivalTime || arrival.scheduledArrivalTime;
          const scheduledTime = arrival.scheduledArrivalTime;
          const delay = predictedTime && scheduledTime ? Math.round((predictedTime - scheduledTime) / 1000 / 60) : 0;
          const minutesUntil = predictedTime ? Math.round((predictedTime - Date.now()) / 1000 / 60) : 0;

          return {
            route: route,
            destination: arrival.tripHeadsign || arrival.headsign || 'Unknown',
            arrivalTime: minutesUntil > 0 ? `${minutesUntil} min` : 'Arriving',
            delay: delay > 0 ? delay : undefined,
            vehicleType: this.mapStopType(arrival.routeType || arrival.route?.type)
          };
        }).slice(0, 10); // Limit to 10 arrivals
      }
      return [];
    } catch (error) {
      console.error('Error fetching real BKK arrivals:', error);
      throw error;
    }
  }

  // Plan a journey using public transport
  async planJourney(from: [number, number], to: [number, number]): Promise<TransportRoutePlan | null> {
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const realJourney = await this.fetchRealJourney(from, to);
        if (realJourney) {
          return realJourney;
        }
      } catch (error) {
        console.warn('BKK journey planning API failed, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
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

  // Fetch real journey plan from BKK FUTÁR API
  private async fetchRealJourney(from: [number, number], to: [number, number]): Promise<TransportRoutePlan | null> {
    try {
      // BKK FUTÁR API endpoint for trip planning
      const response = await axios.get(`${this.bkkApiBaseUrl}/plan-trip`, {
        params: {
          fromPlace: `${from[0]},${from[1]}`,
          toPlace: `${to[0]},${to[1]}`,
          key: this.apiKey, // API key as query parameter
          mode: 'TRANSIT,WALK',
          arriveBy: false,
          numItineraries: 1
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.data && response.data.data.plan) {
        const plan = response.data.data.plan;
        const itinerary = plan.itineraries?.[0];
        
        if (itinerary) {
          const steps = itinerary.legs.map((leg: any) => ({
            type: leg.mode === 'WALK' ? 'walk' : leg.mode.toLowerCase(),
            route: leg.route?.shortName || leg.route?.longName,
            from: leg.from?.name || 'Unknown',
            to: leg.to?.name || 'Unknown',
            duration: Math.round(leg.duration / 60), // Convert seconds to minutes
            distance: leg.distance ? Math.round(leg.distance) : undefined
          }));

          return {
            from: itinerary.legs[0]?.from?.name || 'Starting point',
            to: itinerary.legs[itinerary.legs.length - 1]?.to?.name || 'Destination',
            duration: Math.round(itinerary.duration / 60),
            transfers: itinerary.transfers || 0,
            steps
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching real BKK journey:', error);
      throw error;
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
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const realAlerts = await this.fetchRealAlerts();
        if (realAlerts && realAlerts.length > 0) {
          return realAlerts;
        }
      } catch (error) {
        console.warn('BKK alerts API failed, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
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

  // Fetch real alerts from BKK GTFS-realtime API
  private async fetchRealAlerts(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    affectedRoutes: string[];
    startTime: string;
    endTime?: string;
  }>> {
    try {
      // BKK GTFS-realtime Alerts endpoint (text format for easier parsing)
      const response = await axios.get(`${this.bkkGtfsRtBaseUrl}/Alerts.txt`, {
        params: {
          key: this.apiKey
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/plain'
        },
        timeout: 5000
      });

      // Parse GTFS-realtime alerts
      // Note: This is a simplified parser - full GTFS-realtime uses Protocol Buffers
      // For production, consider using a GTFS-realtime library
      const alerts: Array<{
        id: string;
        title: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        affectedRoutes: string[];
        startTime: string;
        endTime?: string;
      }> = [];

      // If response is text format, try to parse it
      if (typeof response.data === 'string') {
        // Simple parsing - in production, use proper GTFS-realtime parser
        // For now, return empty array and fall back to mock
        console.log('GTFS-realtime text format received, parsing...');
      }

      // If response is JSON (some endpoints might return JSON)
      if (response.data && Array.isArray(response.data.entity)) {
        response.data.entity.forEach((entity: any) => {
          if (entity.alert) {
            const alert = entity.alert;
            alerts.push({
              id: entity.id || `alert_${Date.now()}`,
              title: alert.headerText?.translation?.[0]?.text || 'Transport Alert',
              description: alert.descriptionText?.translation?.[0]?.text || '',
              severity: this.mapAlertSeverity(alert.severityLevel),
              affectedRoutes: alert.informedEntity?.map((e: any) => e.routeId).filter(Boolean) || [],
              startTime: alert.activePeriod?.[0]?.start ? new Date(alert.activePeriod[0].start * 1000).toISOString() : new Date().toISOString(),
              endTime: alert.activePeriod?.[0]?.end ? new Date(alert.activePeriod[0].end * 1000).toISOString() : undefined
            });
          }
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error fetching real BKK alerts:', error);
      throw error;
    }
  }

  // Map GTFS-realtime severity to our severity type
  private mapAlertSeverity(severity: number): 'low' | 'medium' | 'high' {
    // GTFS-realtime severity levels: 1=INFO, 2=WARNING, 3=SEVERE
    if (severity === 3) return 'high';
    if (severity === 2) return 'medium';
    return 'low';
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
