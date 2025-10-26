import axios from 'axios';

// Geospatial API Services
export class GeospatialService {
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  private overpassBaseUrl = 'https://overpass-api.de/api/interpreter';

  // Geocoding - Convert address to coordinates
  async geocode(address: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'hu', // Hungary
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          display_name: result.display_name
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  // Reverse geocoding - Convert coordinates to address
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/reverse`, {
        params: {
          lat,
          lon: lng,
          format: 'json',
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      if (response.data && response.data.display_name) {
        return response.data.display_name;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  // Search for places using Overpass API
  async searchPlaces(query: string, lat: number, lng: number, radius: number = 1000): Promise<any[]> {
    try {
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"^(pharmacy|hospital|clinic|restaurant|cafe|bank|atm)$"](around:${radius},${lat},${lng});
          way["amenity"~"^(pharmacy|hospital|clinic|restaurant|cafe|bank|atm)$"](around:${radius},${lat},${lng});
          relation["amenity"~"^(pharmacy|hospital|clinic|restaurant|cafe|bank|atm)$"](around:${radius},${lat},${lng});
        );
        out center;
      `;

      const response = await axios.post(this.overpassBaseUrl, overpassQuery, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('Places search error:', error);
      return [];
    }
  }

  // Get specific place types
  async getPharmacies(lat: number, lng: number, radius: number = 1000): Promise<any[]> {
    try {
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="pharmacy"](around:${radius},${lat},${lng});
          way["amenity"="pharmacy"](around:${radius},${lat},${lng});
          relation["amenity"="pharmacy"](around:${radius},${lat},${lng});
        );
        out center;
      `;

      const response = await axios.post(this.overpassBaseUrl, overpassQuery, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('Pharmacies search error:', error);
      return [];
    }
  }

  async getRestaurants(lat: number, lng: number, radius: number = 1000): Promise<any[]> {
    try {
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"^(restaurant|cafe|fast_food)$"](around:${radius},${lat},${lng});
          way["amenity"~"^(restaurant|cafe|fast_food)$"](around:${radius},${lat},${lng});
          relation["amenity"~"^(restaurant|cafe|fast_food)$"](around:${radius},${lat},${lng});
        );
        out center;
      `;

      const response = await axios.post(this.overpassBaseUrl, overpassQuery, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('Restaurants search error:', error);
      return [];
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}

export const geospatialService = new GeospatialService();
