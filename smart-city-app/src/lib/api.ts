import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  markers?: MapMarker[];
  route?: RouteData;
  isLoading?: boolean;
  persona?: PersonaContext;
}

export interface MapMarker {
  position: [number, number];
  title: string;
  description?: string;
  type?:
    | 'pharmacy'
    | 'restaurant'
    | 'bank'
    | 'metro'
    | 'bus'
    | 'tram'
    | 'bike_station'
    | 'playbook'
    | 'highlight'
    | 'historical'
    | 'landmark'
    | 'viewpoint';
  icon?: string;
  rating?: number;
  hours?: string;
  phone?: string;
  website?: string;
  image?: string;
}

export interface RouteData {
  distance: string;
  duration: string;
  steps: Array<{ instruction: string; distance: string; type?: string; route?: string }>;
  polyline: number[][];
  mode?: 'walking' | 'cycling' | 'public_transport';
}

export interface Place {
  id: number;
  name: string;
  type: string;
  position: [number, number];
  description: string;
  distance: string;
}

export interface HistoricalPlace {
  id: string | number;
  name: string;
  type?: string;
  position?: [number, number];
  description?: string;
  distance?: string;
  historicType?: string;
  tourismType?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export interface TransportStop {
  id: string;
  name: string;
  position: [number, number];
  type: 'bus' | 'tram' | 'metro' | 'trolley';
  routes: string[];
}

export interface BikeStation {
  stationId: string;
  stationName: string;
  availableBikes: number;
  availableDocks: number;
  distance: number;
  lat?: number;
  lng?: number;
  position?: [number, number];
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
}

export interface WeatherContext {
  isGoodForCycling: boolean;
  isGoodForWalking: boolean;
  recommendations: string[];
}

export interface PersonaContext {
  id: string;
  name: string;
  tagline: string;
  tone: string;
  recommendedPrompts: string[];
  suggestedPlaybookId?: string;
}

export interface PlaybookSummary {
  id: string;
  title: string;
  persona: string;
  tagline: string;
  durationLabel: string;
  distanceLabel: string;
  focusArea: string;
  heroImage: string;
  tags: string[];
  bestFor: string[];
}

export interface PlaybookDetail extends PlaybookSummary {
  narrative: string;
  mood: string;
  recommendedPrompts: string[];
  highlightStops: string[];
  insights: string[];
  markers: MapMarker[];
  primaryRoute: RouteData;
}

export interface MoodboardSuggestion {
  id: string;
  type: 'weather' | 'transport' | 'activity' | 'safety' | 'event';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  icon: string;
  action?: {
    label: string;
    type: 'route' | 'search' | 'info';
    data?: any;
  };
  timestamp: string;
}

export interface MoodboardContext {
  weather: any;
  weatherContext: {
    isGoodForCycling: boolean;
    isGoodForWalking: boolean;
    recommendations: string[];
  } | null;
  transportStatus: {
    hasDisruptions: boolean;
    disruptionCount: number;
    nearbyStops: number;
  };
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  suggestions: MoodboardSuggestion[];
}

export interface StoryCard {
  id: string;
  landmarkId: string;
  landmarkName: string;
  position: [number, number];
  title: string;
  narrative: string;
  audioUrl?: string;
  imageUrl?: string;
  duration: number;
  category: 'history' | 'architecture' | 'culture' | 'legend' | 'event';
  triggerDistance: number;
  tags: string[];
}

export interface StoryTrigger {
  storyId: string;
  landmarkName: string;
  position: [number, number];
  distance: number;
  shouldShow: boolean;
}

class ApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased to 30 seconds for complex operations (geocoding + routing)
  });

  // Chat API
  async sendMessage(message: string, userLocation?: { lat: number; lng: number }): Promise<ChatMessage> {
    try {
      const response = await this.api.post('/api/chat', {
        message,
        userLocation
      });
      return response.data;
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }

  // Places search API
  async searchPlaces(query: string, lat: number, lng: number, radius: number = 1000): Promise<Place[]> {
    try {
      const response = await this.api.get('/api/places/search', {
        params: { query, lat, lng, radius }
      });
      return response.data.places || [];
    } catch (error) {
      console.error('Places search API error:', error);
      throw error;
    }
  }

  // Get all nearby places (all categories at once)
  async getNearbyPlaces(lat: number, lng: number, radius: number = 1000): Promise<Place[]> {
    try {
      const response = await this.api.get('/api/places/nearby', {
        params: { lat, lng, radius }
      });
      return response.data.places || [];
    } catch (error) {
      console.error('Nearby places API error:', error);
      throw error;
    }
  }

  // Get historical places
  async getHistoricalPlaces(lat: number, lng: number, radius: number = 5000): Promise<HistoricalPlace[]> {
    try {
      const response = await this.api.get('/api/places/historical', {
        params: { lat, lng, radius }
      });
      return response.data.places || [];
    } catch (error) {
      console.error('Historical places API error:', error);
      throw error;
    }
  }

  // Geocoding API
  async geocode(address: string): Promise<GeocodeResult | null> {
    try {
      const response = await this.api.get('/api/geocode', {
        params: { address }
      });
      return response.data;
    } catch (error) {
      console.error('Geocoding API error:', error);
      return null;
    }
  }

  // Routes API
  async getRoute(from: string, to: string, mode: 'walking' | 'cycling' | 'public_transport' = 'walking'): Promise<RouteData> {
    try {
      const response = await this.api.get('/api/routes', {
        params: { from, to, mode }
      });
      return response.data;
    } catch (error) {
      console.error('Routes API error:', error);
      throw error;
    }
  }

  // Public transport API
  async getTransportStops(lat: number, lng: number, radius: number = 500): Promise<TransportStop[]> {
    try {
      const response = await this.api.get('/api/transport/stops', {
        params: { lat, lng, radius }
      });
      return response.data.stops || [];
    } catch (error) {
      console.error('Transport stops API error:', error);
      return [];
    }
  }

  async getStopArrivals(stopId: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/api/transport/arrivals/${stopId}`);
      return response.data.arrivals || [];
    } catch (error) {
      console.error('Stop arrivals API error:', error);
      return [];
    }
  }

  async getTransportDisruptions(): Promise<any[]> {
    try {
      const response = await this.api.get('/api/transport/disruptions');
      return response.data.disruptions || [];
    } catch (error) {
      console.error('Transport disruptions API error:', error);
      return [];
    }
  }

  // Shared mobility API
  async getBikeStations(lat: number, lng: number, radius: number = 1000): Promise<BikeStation[]> {
    try {
      const response = await this.api.get('/api/mobility/bikes', {
        params: { lat, lng, radius }
      });
      return response.data.stations || [];
    } catch (error) {
      console.error('Bike stations API error:', error);
      return [];
    }
  }

  async getBikeSummary(): Promise<any> {
    try {
      const response = await this.api.get('/api/mobility/summary');
      return response.data.summary;
    } catch (error) {
      console.error('Bike summary API error:', error);
      return null;
    }
  }

  // Weather API
  async getCurrentWeather(): Promise<{ weather: WeatherData; context: WeatherContext } | null> {
    try {
      const response = await this.api.get('/api/weather/current');
      return response.data;
    } catch (error) {
      console.error('Weather API error:', error);
      return null;
    }
  }

  async getWeatherForecast(): Promise<any[]> {
    try {
      const response = await this.api.get('/api/weather/forecast');
      return response.data.forecast || [];
    } catch (error) {
      console.error('Weather forecast API error:', error);
      return [];
    }
  }

  async getWeatherAlerts(): Promise<any[]> {
    try {
      const response = await this.api.get('/api/weather/alerts');
      return response.data.alerts || [];
    } catch (error) {
      console.error('Weather alerts API error:', error);
      return [];
    }
  }

  // Playbooks API
  async getPlaybooks(): Promise<PlaybookSummary[]> {
    try {
      const response = await this.api.get('/api/playbooks');
      return response.data.playbooks || [];
    } catch (error) {
      console.error('Playbooks API error:', error);
      return [];
    }
  }

  async getPlaybookById(
    id: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<PlaybookDetail | null> {
    try {
      const response = await this.api.get(`/api/playbooks/${id}`, {
        params: userLocation
          ? { userLat: userLocation.lat, userLng: userLocation.lng }
          : undefined
      });
      return response.data.playbook || null;
    } catch (error) {
      console.error(`Playbook detail API error (${id}):`, error);
      return null;
    }
  }

  // Moodboard API
  async getMoodboard(userLocation?: { lat: number; lng: number }): Promise<MoodboardContext | null> {
    try {
      const response = await this.api.get('/api/moodboard', {
        params: userLocation
          ? { lat: userLocation.lat, lng: userLocation.lng }
          : undefined
      });
      return response.data.moodboard || null;
    } catch (error) {
      console.error('Moodboard API error:', error);
      return null;
    }
  }

  // Stories API
  async getStories(category?: string): Promise<StoryCard[]> {
    try {
      const response = await this.api.get('/api/stories', {
        params: category ? { category } : undefined
      });
      return response.data.stories || [];
    } catch (error) {
      console.error('Stories API error:', error);
      return [];
    }
  }

  async getStoryById(id: string): Promise<StoryCard | null> {
    try {
      const response = await this.api.get(`/api/stories/${id}`);
      return response.data.story || null;
    } catch (error) {
      console.error(`Story detail API error (${id}):`, error);
      return null;
    }
  }

  async getStoriesNearRoute(
    polyline: number[][],
    maxDistance: number = 500
  ): Promise<StoryTrigger[]> {
    try {
      const response = await this.api.post('/api/stories/near-route', {
        polyline,
        maxDistance
      });
      return response.data.triggers || [];
    } catch (error) {
      console.error('Stories near route API error:', error);
      return [];
    }
  }

  async getStoriesNearPoint(
    lat: number,
    lng: number,
    radius: number = 1000
  ): Promise<StoryCard[]> {
    try {
      const response = await this.api.get('/api/stories/near-point', {
        params: { lat, lng, radius }
      });
      return response.data.stories || [];
    } catch (error) {
      console.error('Stories near point API error:', error);
      return [];
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export const apiService = new ApiService();
