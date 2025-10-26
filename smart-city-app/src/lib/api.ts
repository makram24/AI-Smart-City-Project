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
}

export interface MapMarker {
  position: [number, number];
  title: string;
  description?: string;
  type?: string;
}

export interface RouteData {
  distance: string;
  duration: string;
  steps: Array<{ instruction: string; distance: string }>;
  polyline: number[][];
}

export interface Place {
  id: number;
  name: string;
  type: string;
  position: [number, number];
  description: string;
  distance: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

class ApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
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
  async getRoute(from: string, to: string): Promise<RouteData> {
    try {
      const response = await this.api.get('/api/routes', {
        params: { from, to }
      });
      return response.data;
    } catch (error) {
      console.error('Routes API error:', error);
      throw error;
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
