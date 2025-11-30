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

export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  routeShortName?: string;
  tripId?: string;
  position: [number, number];
  bearing?: number;
  speed?: number;
  licensePlate?: string;
  wheelchairAccessible?: boolean;
  lastUpdate?: string;
}

export interface RouteDetail {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: 'bus' | 'tram' | 'metro' | 'trolley';
  color?: string;
  textColor?: string;
  description?: string;
  agencyId?: string;
  stops?: Array<{
    stopId: string;
    stopName: string;
    position: [number, number];
    sequence: number;
  }>;
  shape?: Array<[number, number]>;
}

export interface TripInfo {
  tripId: string;
  routeId: string;
  routeShortName: string;
  tripHeadsign: string;
  directionId?: number;
  serviceId?: string;
  shapeId?: string;
  stops: Array<{
    stopId: string;
    stopName: string;
    position: [number, number];
    arrivalTime?: string;
    departureTime?: string;
    stopSequence: number;
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
      // Mock data for Budapest transport stops (expanded coverage)
      const mockStops: TransportStop[] = [
        // City Center / Pest Side
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
        // Buda Side
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
        },
        // Northern Budapest (closer to user location)
        {
          id: 'stop_009',
          name: 'Árpád híd M',
          position: [47.5340, 19.0550],
          type: 'metro',
          routes: ['M3']
        },
        {
          id: 'stop_010',
          name: 'Újpest-központ M',
          position: [47.5500, 19.0800],
          type: 'metro',
          routes: ['M3']
        },
        {
          id: 'stop_011',
          name: 'Újpest-városkapu M',
          position: [47.5450, 19.0700],
          type: 'metro',
          routes: ['M3']
        },
        {
          id: 'stop_012',
          name: 'Gyöngyösi utca M',
          position: [47.5400, 19.0600],
          type: 'metro',
          routes: ['M3']
        },
        {
          id: 'stop_013',
          name: 'Forgách utca M',
          position: [47.5350, 19.0500],
          type: 'metro',
          routes: ['M3']
        },
        {
          id: 'stop_014',
          name: 'Rákospalota-Újpest',
          position: [47.5550, 19.0900],
          type: 'bus',
          routes: ['30', '230', '270']
        },
        {
          id: 'stop_015',
          name: 'Szent István út',
          position: [47.5480, 19.0450],
          type: 'bus',
          routes: ['15', '115', '914']
        },
        // Additional central locations
        {
          id: 'stop_016',
          name: 'Nyugati pályaudvar M',
          position: [47.5100, 19.0570],
          type: 'metro',
          routes: ['M3']
        },
        {
          id: 'stop_017',
          name: 'Oktogon M',
          position: [47.5050, 19.0600],
          type: 'metro',
          routes: ['M1']
        },
        {
          id: 'stop_018',
          name: 'Kodály körönd M',
          position: [47.5120, 19.0650],
          type: 'metro',
          routes: ['M1']
        },
        {
          id: 'stop_019',
          name: 'Bajza utca M',
          position: [47.5150, 19.0700],
          type: 'metro',
          routes: ['M1']
        },
        {
          id: 'stop_020',
          name: 'Hősök tere M',
          position: [47.5150, 19.0780],
          type: 'metro',
          routes: ['M1']
        }
      ];

      // Filter stops within radius
      const nearbyStops = mockStops.filter(stop => {
        const distance = this.calculateDistance(lat, lng, stop.position[0], stop.position[1]);
        return distance <= radius;
      });
      
      // Ensure all stops have routes (fallback for any missing routes)
      const stopsWithRoutes = nearbyStops.map(stop => {
        if (!stop.routes || stop.routes.length === 0) {
          // Assign default routes based on type
          let defaultRoutes: string[] = [];
          if (stop.type === 'bus') {
            defaultRoutes = ['5', '16', '116'];
          } else if (stop.type === 'tram') {
            defaultRoutes = ['4', '6'];
          } else if (stop.type === 'metro') {
            defaultRoutes = ['M2', 'M3'];
          }
          console.log(`📍 Adding default routes to ${stop.name}: ${defaultRoutes.join(', ')}`);
          return { ...stop, routes: defaultRoutes };
        }
        return stop;
      });

      console.log(`📍 Returning ${stopsWithRoutes.length} mock stops (${stopsWithRoutes.filter(s => s.type === 'bus').length} bus, ${stopsWithRoutes.filter(s => s.type === 'tram').length} tram, ${stopsWithRoutes.filter(s => s.type === 'metro').length} metro)`);
      return stopsWithRoutes;
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

      // Enhanced response logging for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 BKK API Response Structure:', JSON.stringify(response.data, null, 2).substring(0, 500));
      }

      // BKK FUTÁR API response structure - try multiple possible structures
      let stopsList: any[] = [];
      
      if (response.data?.data?.list) {
        stopsList = response.data.data.list;
      } else if (response.data?.data?.stops) {
        stopsList = response.data.data.stops;
      } else if (Array.isArray(response.data?.data)) {
        stopsList = response.data.data;
      } else if (Array.isArray(response.data)) {
        stopsList = response.data;
      }

      if (stopsList && stopsList.length > 0) {
        return stopsList.map((stop: any) => {
          // Extract position with multiple fallbacks
          const lat = stop.lat ?? stop.latitude ?? stop.coordinates?.lat ?? stop.location?.lat ?? stop.position?.[0];
          const lon = stop.lon ?? stop.longitude ?? stop.coordinates?.lon ?? stop.location?.lon ?? stop.position?.[1];
          
          // Validate position
          if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
            console.warn('⚠️ Invalid stop position, skipping:', stop);
            return null;
          }

          // Extract routes from multiple possible API response structures
          let routes: string[] = [];
          
          // Try different possible route structures from BKK API
          if (stop.routes && Array.isArray(stop.routes)) {
            routes = stop.routes.map((r: any) => 
              r.shortName || r.name || r.routeShortName || r.route_short_name || r.routeId || r.route_id || String(r)
            ).filter(Boolean);
          } else if (stop.routeIds && Array.isArray(stop.routeIds)) {
            routes = stop.routeIds.map((id: any) => String(id));
          } else if (stop.route_ids && Array.isArray(stop.route_ids)) {
            routes = stop.route_ids.map((id: any) => String(id));
          } else if (stop.routeShortNames && Array.isArray(stop.routeShortNames)) {
            routes = stop.routeShortNames.map((name: any) => String(name));
          } else if (stop.route_short_names && Array.isArray(stop.route_short_names)) {
            routes = stop.route_short_names.map((name: any) => String(name));
          } else if (stop.patterns && Array.isArray(stop.patterns)) {
            // Extract routes from patterns
            routes = stop.patterns
              .map((pattern: any) => pattern.route?.shortName || pattern.route?.short_name || pattern.routeId || pattern.route_id)
              .filter(Boolean)
              .map((r: any) => String(r));
          }
          
          // If still no routes, try to get from stopTimes or arrivals
          if (routes.length === 0 && stop.stopTimes && Array.isArray(stop.stopTimes)) {
            routes = stop.stopTimes
              .map((st: any) => st.route?.shortName || st.routeShortName || st.route?.short_name || st.routeId)
              .filter(Boolean)
              .map((r: any) => String(r));
          }
          
          // Remove duplicates
          routes = [...new Set(routes)];
          
          // If routes are still empty, try to fetch from arrivals (async, but we'll do it for first few stops only)
          // For now, we'll add a fallback based on stop type if routes are missing
          if (routes.length === 0) {
            // Log if routes are missing for debugging
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ No routes found for stop: ${stop.name || stop.stopName || 'Unknown'}`, {
                stopKeys: Object.keys(stop),
                hasRoutes: !!stop.routes,
                hasRouteIds: !!stop.routeIds,
                hasPatterns: !!stop.patterns
              });
            }
            
            // Fallback: Assign default routes based on stop type and location
            // This is a temporary solution until we can properly fetch routes from API
            const stopType = this.mapStopType(stop.routeType || stop.type || stop.stopType || stop.route_type);
            if (stopType === 'bus') {
              // Common bus routes in Budapest - assign based on area
              if (lat > 47.5) {
                routes = ['30', '230', '270']; // Northern Budapest
              } else {
                routes = ['5', '16', '116']; // Central Budapest
              }
            } else if (stopType === 'tram') {
              routes = ['4', '6']; // Common tram routes
            } else if (stopType === 'metro') {
              // Determine metro line based on location
              if (lat > 47.5 && lng > 19.05) {
                routes = ['M3']; // Northern/Eastern
              } else if (lat < 47.5) {
                routes = ['M2', 'M3']; // Southern
              } else {
                routes = ['M1', 'M2', 'M3']; // Central
              }
            }
            
            if (routes.length > 0) {
              console.log(`📍 Assigned fallback routes for ${stop.name || 'Unknown'}: ${routes.join(', ')}`);
            }
          }

          return {
            id: stop.id || stop.stopId || stop.stop_id || `stop_${stop.code || stop.stopCode || Date.now()}`,
            name: stop.name || stop.stopName || stop.stop_name || 'Unknown Stop',
            position: [lat, lon],
            type: this.mapStopType(stop.routeType || stop.type || stop.stopType || stop.route_type),
            routes: routes
          };
        }).filter((stop): stop is TransportStop => stop !== null);
      }
      
      console.warn('⚠️ BKK API returned empty or unexpected response structure');
      return [];
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error('❌ BKK API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('❌ BKK API Network Error - No response received');
      } else {
        console.error('❌ BKK API Error:', error.message);
      }
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
      const cleanStopId = stopId.replace(/^stop_/, '');
      
      // Try multiple parameter name variations
      const tryParams = [
        { stopId: cleanStopId },
        { stop_id: cleanStopId },
        { id: cleanStopId }
      ];

      let response: any = null;
      let lastError: any = null;

      // Try each parameter variation
      for (const params of tryParams) {
        try {
          response = await axios.get(`${this.bkkApiBaseUrl}/arrivals-and-departures-for-stop`, {
            params: {
              ...params,
              key: this.apiKey,
              minutesBefore: 0,
              minutesAfter: 30
            },
            headers: {
              'User-Agent': this.userAgent,
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          // If we got a successful response, break
          if (response.status === 200) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          // Continue to next parameter variation
          continue;
        }
      }

      if (!response || response.status !== 200) {
        throw lastError || new Error('Failed to fetch arrivals with any parameter variation');
      }

      // Enhanced response logging
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 BKK Arrivals Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
      }

      // Try multiple response structures
      let arrivals: any[] = [];
      
      if (response.data?.data?.entry?.arrivalsAndDepartures) {
        arrivals = response.data.data.entry.arrivalsAndDepartures;
      } else if (response.data?.data?.arrivalsAndDepartures) {
        arrivals = response.data.data.arrivalsAndDepartures;
      } else if (response.data?.arrivalsAndDepartures) {
        arrivals = response.data.arrivalsAndDepartures;
      } else if (Array.isArray(response.data?.data)) {
        arrivals = response.data.data;
      } else if (Array.isArray(response.data)) {
        arrivals = response.data;
      }

      if (arrivals && arrivals.length > 0) {
        return arrivals.map((arrival: any) => {
          const route = arrival.routeShortName || arrival.route_short_name || arrival.routeId || arrival.route?.shortName || 'Unknown';
          
          // Handle timestamp - check if it's in seconds or milliseconds
          const predictedTimeRaw = arrival.predictedArrivalTime || arrival.predicted_arrival_time || arrival.predictedTime;
          const scheduledTimeRaw = arrival.scheduledArrivalTime || arrival.scheduled_arrival_time || arrival.scheduledTime;
          
          // Convert to milliseconds if needed (check if timestamp is in seconds)
          const isPredictedSeconds = predictedTimeRaw && predictedTimeRaw < 10000000000;
          const isScheduledSeconds = scheduledTimeRaw && scheduledTimeRaw < 10000000000;
          
          const predictedTime = predictedTimeRaw ? (isPredictedSeconds ? predictedTimeRaw * 1000 : predictedTimeRaw) : null;
          const scheduledTime = scheduledTimeRaw ? (isScheduledSeconds ? scheduledTimeRaw * 1000 : scheduledTimeRaw) : null;
          
          const now = Date.now();
          const delay = predictedTime && scheduledTime ? Math.round((predictedTime - scheduledTime) / 1000 / 60) : 0;
          const minutesUntil = predictedTime ? Math.round((predictedTime - now) / 1000 / 60) : null;

          return {
            route: route,
            destination: arrival.tripHeadsign || arrival.trip_headsign || arrival.headsign || arrival.destination || 'Unknown',
            arrivalTime: minutesUntil !== null && minutesUntil > 0 ? `${minutesUntil} min` : minutesUntil === 0 ? 'Arriving' : 'Unknown',
            delay: delay > 0 ? delay : undefined,
            vehicleType: this.mapStopType(arrival.routeType || arrival.route_type || arrival.route?.type)
          };
        }).slice(0, 10); // Limit to 10 arrivals
      }
      
      console.warn('⚠️ BKK Arrivals API returned empty or unexpected response structure');
      return [];
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error('❌ BKK Arrivals API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('❌ BKK Arrivals API Network Error - No response received');
      } else {
        console.error('❌ BKK Arrivals API Error:', error.message);
      }
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
      // Try multiple coordinate formats
      const coordinateFormats = [
        { fromPlace: `${from[0]},${from[1]}`, toPlace: `${to[0]},${to[1]}` }, // lat,lng
        { fromPlace: `${from[1]},${from[0]}`, toPlace: `${to[1]},${to[0]}` }, // lng,lat
        { fromPlace: `${from[0]};${from[1]}`, toPlace: `${to[0]};${to[1]}` }, // lat;lng
      ];

      let response: any = null;
      let lastError: any = null;

      // Try each coordinate format
      for (const format of coordinateFormats) {
        try {
          response = await axios.get(`${this.bkkApiBaseUrl}/plan-trip`, {
            params: {
              ...format,
              key: this.apiKey,
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
          
          if (response.status === 200) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }

      if (!response || response.status !== 200) {
        throw lastError || new Error('Failed to fetch journey with any coordinate format');
      }

      // Enhanced response logging
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 BKK Journey Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
      }

      // Try multiple response structures
      let plan: any = null;
      if (response.data?.data?.plan) {
        plan = response.data.data.plan;
      } else if (response.data?.plan) {
        plan = response.data.plan;
      } else if (response.data?.data) {
        plan = response.data.data;
      }

      if (plan) {
        const itinerary = plan.itineraries?.[0] || plan.itinerary?.[0] || plan;
        
        if (itinerary && itinerary.legs) {
          const steps = itinerary.legs.map((leg: any) => {
            // Handle duration - check if in seconds or milliseconds
            const durationRaw = leg.duration || 0;
            const durationSeconds = durationRaw < 10000 ? durationRaw : Math.round(durationRaw / 1000);
            
            return {
              type: leg.mode === 'WALK' ? 'walk' : (leg.mode || 'unknown').toLowerCase(),
              route: leg.route?.shortName || leg.route?.short_name || leg.route?.longName || leg.route?.long_name || leg.routeName || undefined,
              from: leg.from?.name || leg.fromName || leg.from?.stopName || 'Unknown',
              to: leg.to?.name || leg.toName || leg.to?.stopName || 'Unknown',
              duration: Math.round(durationSeconds / 60), // Convert to minutes
              distance: leg.distance ? Math.round(leg.distance) : undefined
            };
          });

          // Handle total duration
          const totalDurationRaw = itinerary.duration || 0;
          const totalDurationSeconds = totalDurationRaw < 10000 ? totalDurationRaw : Math.round(totalDurationRaw / 1000);

          return {
            from: itinerary.legs[0]?.from?.name || itinerary.legs[0]?.fromName || 'Starting point',
            to: itinerary.legs[itinerary.legs.length - 1]?.to?.name || itinerary.legs[itinerary.legs.length - 1]?.toName || 'Destination',
            duration: Math.round(totalDurationSeconds / 60),
            transfers: itinerary.transfers || itinerary.numberOfTransfers || 0,
            steps
          };
        }
      }
      
      console.warn('⚠️ BKK Journey API returned empty or unexpected response structure');
      return null;
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error('❌ BKK Journey API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('❌ BKK Journey API Network Error - No response received');
      } else {
        console.error('❌ BKK Journey API Error:', error.message);
      }
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
      // Try both text and JSON formats
      const endpoints = [
        { url: `${this.bkkGtfsRtBaseUrl}/Alerts.txt`, accept: 'text/plain' },
        { url: `${this.bkkGtfsRtBaseUrl}/Alerts`, accept: 'application/json' },
        { url: `${this.bkkApiBaseUrl}/alerts`, accept: 'application/json' }
      ];

      let response: any = null;
      let lastError: any = null;

      // Try each endpoint
      for (const endpoint of endpoints) {
        try {
          response = await axios.get(endpoint.url, {
            params: {
              key: this.apiKey
            },
            headers: {
              'User-Agent': this.userAgent,
              'Accept': endpoint.accept
            },
            timeout: 5000
          });
          
          if (response.status === 200) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }

      if (!response || response.status !== 200) {
        throw lastError || new Error('Failed to fetch alerts from any endpoint');
      }

      const alerts: Array<{
        id: string;
        title: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        affectedRoutes: string[];
        startTime: string;
        endTime?: string;
      }> = [];

      // Enhanced response logging
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 BKK Alerts Response Type:', typeof response.data);
        if (typeof response.data === 'string') {
          console.log('🔍 BKK Alerts Text (first 500 chars):', response.data.substring(0, 500));
        } else {
          console.log('🔍 BKK Alerts JSON:', JSON.stringify(response.data, null, 2).substring(0, 500));
        }
      }

      // Parse text format (simplified - full GTFS-realtime uses Protocol Buffers)
      if (typeof response.data === 'string') {
        // Try to extract basic information from text format
        // This is a simplified parser - for production, use a proper GTFS-realtime library
        const lines = response.data.split('\n');
        let currentAlert: any = null;
        
        for (const line of lines) {
          if (line.includes('header_text') || line.includes('title')) {
            const match = line.match(/["']([^"']+)["']/);
            if (match && !currentAlert) {
              currentAlert = { title: match[1], description: '', severity: 'low' as const };
            }
          } else if (line.includes('description') && currentAlert) {
            const match = line.match(/["']([^"']+)["']/);
            if (match) {
              currentAlert.description = match[1];
            }
          } else if (line.includes('severity') && currentAlert) {
            const severityMatch = line.match(/\d+/);
            if (severityMatch) {
              currentAlert.severity = this.mapAlertSeverity(parseInt(severityMatch[0]));
            }
          }
        }
        
        // If we found any alerts in text format, add them
        if (currentAlert) {
          alerts.push({
            id: `alert_${Date.now()}`,
            title: currentAlert.title || 'Transport Alert',
            description: currentAlert.description || '',
            severity: currentAlert.severity,
            affectedRoutes: [],
            startTime: new Date().toISOString()
          });
        }
      }

      // Parse JSON format (GTFS-realtime JSON or custom format)
      if (response.data && typeof response.data === 'object') {
        // Try GTFS-realtime structure
        if (Array.isArray(response.data.entity)) {
          response.data.entity.forEach((entity: any) => {
            if (entity.alert) {
              const alert = entity.alert;
              const headerText = alert.headerText?.translation?.[0]?.text || 
                                alert.headerText?.text || 
                                alert.title || 
                                'Transport Alert';
              const descriptionText = alert.descriptionText?.translation?.[0]?.text || 
                                     alert.descriptionText?.text || 
                                     alert.description || 
                                     '';
              
              // Handle timestamp - check if seconds or milliseconds
              const startRaw = alert.activePeriod?.[0]?.start;
              const endRaw = alert.activePeriod?.[0]?.end;
              const isStartSeconds = startRaw && startRaw < 10000000000;
              const isEndSeconds = endRaw && endRaw < 10000000000;
              
              alerts.push({
                id: entity.id || `alert_${Date.now()}_${Math.random()}`,
                title: headerText,
                description: descriptionText,
                severity: this.mapAlertSeverity(alert.severityLevel || alert.severity || 1),
                affectedRoutes: alert.informedEntity?.map((e: any) => e.routeId || e.route_id).filter(Boolean) || [],
                startTime: startRaw ? new Date((isStartSeconds ? startRaw * 1000 : startRaw)).toISOString() : new Date().toISOString(),
                endTime: endRaw ? new Date((isEndSeconds ? endRaw * 1000 : endRaw)).toISOString() : undefined
              });
            }
          });
        } 
        // Try alternative JSON structure
        else if (Array.isArray(response.data)) {
          response.data.forEach((alert: any) => {
            alerts.push({
              id: alert.id || `alert_${Date.now()}_${Math.random()}`,
              title: alert.title || alert.header || 'Transport Alert',
              description: alert.description || alert.message || '',
              severity: this.mapAlertSeverity(alert.severity || alert.severityLevel || 1),
              affectedRoutes: alert.affectedRoutes || alert.routes || [],
              startTime: alert.startTime || alert.start || new Date().toISOString(),
              endTime: alert.endTime || alert.end
            });
          });
        }
        // Try nested structure
        else if (response.data.alerts || response.data.data) {
          const alertsData = response.data.alerts || response.data.data || [];
          alertsData.forEach((alert: any) => {
            alerts.push({
              id: alert.id || `alert_${Date.now()}_${Math.random()}`,
              title: alert.title || alert.header || 'Transport Alert',
              description: alert.description || alert.message || '',
              severity: this.mapAlertSeverity(alert.severity || alert.severityLevel || 1),
              affectedRoutes: alert.affectedRoutes || alert.routes || [],
              startTime: alert.startTime || alert.start || new Date().toISOString(),
              endTime: alert.endTime || alert.end
            });
          });
        }
      }

      return alerts;
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error('❌ BKK Alerts API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('❌ BKK Alerts API Network Error - No response received');
      } else {
        console.error('❌ BKK Alerts API Error:', error.message);
      }
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

  // Get vehicles for a specific stop
  async getVehiclesForStop(stopId: string): Promise<VehiclePosition[]> {
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const realVehicles = await this.fetchRealVehiclesForStop(stopId);
        if (realVehicles && realVehicles.length > 0) {
          console.log(`✅ BKK API active! Retrieved ${realVehicles.length} vehicles for stop ${stopId}`);
          return realVehicles;
        }
      } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.info('💡 BKK API key not yet activated (2-day activation period)');
        } else {
          console.warn('⚠️ BKK vehicles API failed, falling back to mock data:', error.message);
        }
      }
    }

    // Fallback to mock data
    return this.getMockVehiclesForStop(stopId);
  }

  // Fetch real vehicles from BKK FUTÁR API
  private async fetchRealVehiclesForStop(stopId: string): Promise<VehiclePosition[]> {
    try {
      const cleanStopId = stopId.replace(/^stop_/, '');
      
      const response = await axios.get(`${this.bkkApiBaseUrl}/vehicles-for-stop`, {
        params: {
          stopId: cleanStopId,
          key: this.apiKey
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 BKK Vehicles Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
      }

      // Try multiple response structures
      let vehiclesList: any[] = [];
      
      if (response.data?.data?.list) {
        vehiclesList = response.data.data.list;
      } else if (response.data?.data?.vehicles) {
        vehiclesList = response.data.data.vehicles;
      } else if (Array.isArray(response.data?.data)) {
        vehiclesList = response.data.data;
      } else if (Array.isArray(response.data)) {
        vehiclesList = response.data;
      }

      if (vehiclesList && vehiclesList.length > 0) {
        return vehiclesList.map((vehicle: any) => {
          const lat = vehicle.lat ?? vehicle.latitude ?? vehicle.location?.lat ?? vehicle.position?.[0];
          const lon = vehicle.lon ?? vehicle.longitude ?? vehicle.location?.lon ?? vehicle.position?.[1];
          
          if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
            return null;
          }

          return {
            vehicleId: vehicle.vehicleId || vehicle.vehicle_id || vehicle.id || `vehicle_${Date.now()}`,
            routeId: vehicle.routeId || vehicle.route_id || vehicle.route?.id || 'Unknown',
            routeShortName: vehicle.routeShortName || vehicle.route_short_name || vehicle.route?.shortName,
            tripId: vehicle.tripId || vehicle.trip_id || vehicle.trip?.id,
            position: [lat, lon],
            bearing: vehicle.bearing !== undefined ? parseFloat(vehicle.bearing) : undefined,
            speed: vehicle.speed !== undefined ? parseFloat(vehicle.speed) : undefined,
            licensePlate: vehicle.licensePlate || vehicle.license_plate || vehicle.plate,
            wheelchairAccessible: vehicle.wheelchairAccessible || vehicle.wheelchair_accessible || false,
            lastUpdate: vehicle.lastUpdate || vehicle.last_update || new Date().toISOString()
          };
        }).filter((v): v is VehiclePosition => v !== null);
      }

      return [];
    } catch (error: any) {
      if (error.response) {
        console.error('❌ BKK Vehicles API Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  // Mock vehicles for testing
  private getMockVehiclesForStop(stopId: string): VehiclePosition[] {
    const mockVehicles: VehiclePosition[] = [
      {
        vehicleId: `vehicle_${stopId}_1`,
        routeId: 'M2',
        routeShortName: 'M2',
        position: [47.4980, 19.0403],
        bearing: 90,
        speed: 35,
        wheelchairAccessible: true,
        lastUpdate: new Date().toISOString()
      },
      {
        vehicleId: `vehicle_${stopId}_2`,
        routeId: '5',
        routeShortName: '5',
        position: [47.4978, 19.0401],
        bearing: 180,
        speed: 25,
        wheelchairAccessible: true,
        lastUpdate: new Date().toISOString()
      }
    ];
    return mockVehicles;
  }

  // Get route details including shape and stops
  async getRouteDetails(routeId: string): Promise<RouteDetail | null> {
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const routeDetail = await this.fetchRealRouteDetails(routeId);
        if (routeDetail) {
          console.log(`✅ BKK API active! Retrieved route details for ${routeId}`);
          return routeDetail;
        }
      } catch (error: any) {
        console.warn('⚠️ BKK route details API failed, falling back to mock data:', error.message);
      }
    }

    // Fallback to mock data
    return this.getMockRouteDetails(routeId);
  }

  // Fetch real route details from BKK FUTÁR API
  private async fetchRealRouteDetails(routeId: string): Promise<RouteDetail | null> {
    try {
      const response = await axios.get(`${this.bkkApiBaseUrl}/route`, {
        params: {
          routeId: routeId,
          key: this.apiKey
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 BKK Route Details Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
      }

      const routeData = response.data?.data?.entry || response.data?.data || response.data;
      
      if (!routeData) {
        return null;
      }

      const route: RouteDetail = {
        routeId: routeData.id || routeData.routeId || routeId,
        routeShortName: routeData.shortName || routeData.routeShortName || routeData.short_name || routeId,
        routeLongName: routeData.longName || routeData.routeLongName || routeData.long_name || routeId,
        routeType: this.mapStopType(routeData.type || routeData.routeType || routeData.route_type),
        color: routeData.color,
        textColor: routeData.textColor || routeData.text_color,
        description: routeData.description,
        agencyId: routeData.agencyId || routeData.agency_id
      };

      // Get route shape if available
      if (routeData.shapeId || routeData.shape_id) {
        try {
          const shapeResponse = await axios.get(`${this.bkkApiBaseUrl}/shape`, {
            params: {
              shapeId: routeData.shapeId || routeData.shape_id,
              key: this.apiKey
            },
            headers: {
              'User-Agent': this.userAgent,
              'Accept': 'application/json'
            },
            timeout: 5000
          });

          const shapeData = shapeResponse.data?.data?.entry || shapeResponse.data?.data || shapeResponse.data;
          if (shapeData?.points && Array.isArray(shapeData.points)) {
            route.shape = shapeData.points.map((point: any) => [
              parseFloat(point.lat || point.latitude),
              parseFloat(point.lon || point.longitude)
            ]).filter((coord: any) => !isNaN(coord[0]) && !isNaN(coord[1]));
          }
        } catch (shapeError) {
          console.warn('⚠️ Failed to fetch route shape:', shapeError);
        }
      }

      // Get stops for route if available
      if (routeData.stops && Array.isArray(routeData.stops)) {
        route.stops = routeData.stops.map((stop: any, index: number) => ({
          stopId: stop.id || stop.stopId || stop.stop_id,
          stopName: stop.name || stop.stopName || stop.stop_name,
          position: [
            parseFloat(stop.lat || stop.latitude),
            parseFloat(stop.lon || stop.longitude)
          ],
          sequence: index
        })).filter((stop: any) => stop.stopId && !isNaN(stop.position[0]) && !isNaN(stop.position[1]));
      }

      return route;
    } catch (error: any) {
      if (error.response) {
        console.error('❌ BKK Route Details API Error:', {
          status: error.response.status,
          statusText: error.response.statusText
        });
      }
      throw error;
    }
  }

  // Mock route details
  private getMockRouteDetails(routeId: string): RouteDetail | null {
    const routeType = routeId.startsWith('M') ? 'metro' : 
                     ['4', '6', '14', '47', '49'].includes(routeId) ? 'tram' : 'bus';
    
    return {
      routeId: routeId,
      routeShortName: routeId,
      routeLongName: `Route ${routeId}`,
      routeType: routeType,
      color: routeType === 'metro' ? '#dc2626' : routeType === 'tram' ? '#059669' : '#2563eb',
      description: `Mock route details for ${routeId}`
    };
  }

  // Get trip information
  async getTripInfo(tripId: string): Promise<TripInfo | null> {
    // Try real API first if enabled
    if (this.useRealApi && this.apiKey) {
      try {
        const tripInfo = await this.fetchRealTripInfo(tripId);
        if (tripInfo) {
          console.log(`✅ BKK API active! Retrieved trip info for ${tripId}`);
          return tripInfo;
        }
      } catch (error: any) {
        console.warn('⚠️ BKK trip info API failed, falling back to mock data:', error.message);
      }
    }

    // Fallback to mock data
    return this.getMockTripInfo(tripId);
  }

  // Fetch real trip info from BKK FUTÁR API
  private async fetchRealTripInfo(tripId: string): Promise<TripInfo | null> {
    try {
      const response = await axios.get(`${this.bkkApiBaseUrl}/trip-details`, {
        params: {
          tripId: tripId,
          key: this.apiKey
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      const tripData = response.data?.data?.entry || response.data?.data || response.data;
      
      if (!tripData) {
        return null;
      }

      const trip: TripInfo = {
        tripId: tripData.id || tripData.tripId || tripId,
        routeId: tripData.routeId || tripData.route_id || tripData.route?.id || 'Unknown',
        routeShortName: tripData.routeShortName || tripData.route_short_name || tripData.route?.shortName || 'Unknown',
        tripHeadsign: tripData.tripHeadsign || tripData.trip_headsign || tripData.headsign || 'Unknown',
        directionId: tripData.directionId || tripData.direction_id,
        serviceId: tripData.serviceId || tripData.service_id,
        shapeId: tripData.shapeId || tripData.shape_id,
        stops: []
      };

      // Extract stops from trip
      if (tripData.stopTimes && Array.isArray(tripData.stopTimes)) {
        trip.stops = tripData.stopTimes.map((stopTime: any, index: number) => ({
          stopId: stopTime.stopId || stopTime.stop_id || stopTime.stop?.id,
          stopName: stopTime.stopName || stopTime.stop_name || stopTime.stop?.name || 'Unknown',
          position: stopTime.stop?.lat && stopTime.stop?.lon ? 
            [parseFloat(stopTime.stop.lat), parseFloat(stopTime.stop.lon)] :
            [0, 0],
          arrivalTime: stopTime.arrivalTime || stopTime.arrival_time,
          departureTime: stopTime.departureTime || stopTime.departure_time,
          stopSequence: stopTime.stopSequence || stopTime.stop_sequence || index
        })).filter((stop: any) => stop.stopId);
      }

      return trip;
    } catch (error: any) {
      if (error.response) {
        console.error('❌ BKK Trip Info API Error:', {
          status: error.response.status,
          statusText: error.response.statusText
        });
      }
      throw error;
    }
  }

  // Mock trip info
  private getMockTripInfo(tripId: string): TripInfo | null {
    return {
      tripId: tripId,
      routeId: 'M2',
      routeShortName: 'M2',
      tripHeadsign: 'Örs vezér tere',
      stops: [
        {
          stopId: 'stop_001',
          stopName: 'Deák Ferenc tér M',
          position: [47.4979, 19.0402],
          stopSequence: 0
        },
        {
          stopId: 'stop_002',
          stopName: 'Astoria',
          position: [47.4949, 19.0592],
          stopSequence: 1
        }
      ]
    };
  }
}

// Export new interfaces
export interface VehiclePosition {
  vehicleId: string;
  routeId: string;
  routeShortName?: string;
  tripId?: string;
  position: [number, number];
  bearing?: number;
  speed?: number;
  licensePlate?: string;
  wheelchairAccessible?: boolean;
  lastUpdate?: string;
}

export interface RouteDetail {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeType: 'bus' | 'tram' | 'metro' | 'trolley';
  color?: string;
  textColor?: string;
  description?: string;
  agencyId?: string;
  stops?: Array<{
    stopId: string;
    stopName: string;
    position: [number, number];
    sequence: number;
  }>;
  shape?: Array<[number, number]>;
}

export interface TripInfo {
  tripId: string;
  routeId: string;
  routeShortName: string;
  tripHeadsign: string;
  directionId?: number;
  serviceId?: string;
  shapeId?: string;
  stops: Array<{
    stopId: string;
    stopName: string;
    position: [number, number];
    arrivalTime?: string;
    departureTime?: string;
    stopSequence: number;
  }>;
}

export const publicTransportService = new PublicTransportService();
