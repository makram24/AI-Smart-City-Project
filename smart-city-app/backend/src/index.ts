import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI (optional for Phase 2)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Middleware
app.use(cors());
app.use(express.json());

// Geospatial Services
class GeospatialService {
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  private overpassBaseUrl = 'https://overpass-api.de/api/interpreter';

  async geocode(address: string): Promise<any> {
    try {
      const response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'hu',
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

  async searchPlaces(query: string, lat: number, lng: number, radius: number = 1000): Promise<any[]> {
    try {
      const amenityMap: { [key: string]: string } = {
        'pharmacy': 'pharmacy',
        'pharmacies': 'pharmacy',
        'restaurant': 'restaurant',
        'restaurants': 'restaurant',
        'cafe': 'cafe',
        'cafes': 'cafe',
        'food': 'restaurant',
        'bank': 'bank',
        'atm': 'atm',
        'hospital': 'hospital',
        'clinic': 'clinic'
      };

      const amenity = amenityMap[query.toLowerCase()] || 'restaurant';
      
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"="${amenity}"](around:${radius},${lat},${lng});
          way["amenity"="${amenity}"](around:${radius},${lat},${lng});
          relation["amenity"="${amenity}"](around:${radius},${lat},${lng});
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

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
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

const geospatialService = new GeospatialService();

// AI Service with specialized tools
class AIService {
  async processQuery(message: string, userLocation?: { lat: number; lng: number }): Promise<{
    text: string;
    markers: any[];
    route?: any;
  }> {
    const lowerMessage = message.toLowerCase();

    // Route/Directions queries
    if (lowerMessage.includes('route') || lowerMessage.includes('direction') || lowerMessage.includes('way to') || lowerMessage.includes('how to get')) {
      if (!userLocation) {
        return {
          text: 'I can help you with directions, but I need your location. Please allow location access.',
          markers: []
        };
      }

      // Extract destination from message
      const destination = this.extractDestination(message);
      if (destination) {
        const result = await this.getDirections('here', destination, userLocation);
        return result;
      } else {
        return {
          text: 'I can help you with directions! Please specify where you want to go (e.g., "route to Buda Castle" or "directions to the city center").',
          markers: []
        };
      }
    }

    // Service search queries
    const serviceTypes = ['pharmacy', 'pharmacies', 'restaurant', 'restaurants', 'cafe', 'cafes', 'food', 'bank', 'atm', 'hospital', 'clinic', 'gas', 'parking', 'hotel'];
    const foundService = serviceTypes.find(service => lowerMessage.includes(service));
    
    if (foundService) {
      if (!userLocation) {
        return {
          text: `I can help you find ${foundService}, but I need your location. Please allow location access to get accurate results.`,
          markers: []
        };
      }

      const result = await this.searchServices(foundService, userLocation);
      return result;
    }

    // Location context queries
    if (lowerMessage.includes('near me') || lowerMessage.includes('around here') || lowerMessage.includes('what\'s nearby')) {
      if (!userLocation) {
        return {
          text: 'I can help you find what\'s nearby, but I need your location. Please allow location access.',
          markers: []
        };
      }

      const result = await this.getLocationContext(userLocation);
      return result;
    }

    // Use OpenAI if available for general queries
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant for Budapest city services. You help users find places, get directions, and discover local information. Keep responses concise and helpful. Always mention that you can help with finding places, getting directions, and discovering local events."
            },
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        });

        return {
          text: completion.choices[0].message.content || 'I can help you with Budapest city services. What would you like to know?',
          markers: []
        };
      } catch (error) {
        console.error('OpenAI error:', error);
      }
    }

    // Fallback responses
    if (lowerMessage.includes('budapest') || lowerMessage.includes('city')) {
      return {
        text: 'Welcome to Budapest! I can help you find places, get directions, check public transport schedules, and discover local events. What would you like to know?',
        markers: []
      };
    }

    return {
      text: 'I can help you find places, get directions, check transport schedules, and discover what\'s happening in Budapest. Could you be more specific about what you need?',
      markers: []
    };
  }

  private extractDestination(message: string): string | null {
    const patterns = [
      /route to (.+)/i,
      /directions to (.+)/i,
      /way to (.+)/i,
      /how to get to (.+)/i,
      /go to (.+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private async getDirections(from: string, to: string, userLocation: { lat: number; lng: number }): Promise<{
    text: string;
    markers: any[];
    route?: any;
  }> {
    try {
      // Geocode the destination
      const toResult = await geospatialService.geocode(to);
      if (!toResult) {
        return {
          text: `I couldn't find the destination "${to}". Please provide a valid address or landmark.`,
          markers: []
        };
      }

      // Mock route for now (will be enhanced in Phase 3)
      const distance = geospatialService.calculateDistance(
        userLocation.lat, userLocation.lng,
        toResult.lat, toResult.lng
      );

      return {
        text: `Here's your route to ${toResult.display_name}. It's about ${distance.toFixed(1)} km away. I'll add real routing in Phase 3!`,
        markers: [{
          position: [toResult.lat, toResult.lng],
          title: toResult.display_name,
          description: 'Destination',
          type: 'destination'
        }]
      };
    } catch (error) {
      console.error('Directions error:', error);
      return {
        text: 'Sorry, I had trouble calculating directions. Please try again with different addresses.',
        markers: []
      };
    }
  }

  private async searchServices(serviceType: string, userLocation: { lat: number; lng: number }): Promise<{
    text: string;
    markers: any[];
  }> {
    try {
      const places = await geospatialService.searchPlaces(serviceType, userLocation.lat, userLocation.lng);
      
      if (places.length === 0) {
        return {
          text: `I couldn't find any ${serviceType} near your location. Try expanding your search area.`,
          markers: []
        };
      }

      const markers = places.slice(0, 5).map((place: any) => ({
        position: [place.lat || place.center?.lat, place.lon || place.center?.lon],
        title: place.tags?.name || serviceType,
        description: place.tags?.opening_hours || place.tags?.cuisine || 'No additional info',
        type: serviceType
      }));

      const nearest = places[0];
      const distance = geospatialService.calculateDistance(
        userLocation.lat, 
        userLocation.lng,
        nearest.lat || nearest.center?.lat,
        nearest.lon || nearest.center?.lon
      );

      return {
        text: `I found ${places.length} ${serviceType} near you. The nearest is ${nearest.tags?.name || 'a place'} located ${distance.toFixed(1)} km away.`,
        markers
      };
    } catch (error) {
      console.error('Service search error:', error);
      return {
        text: `Sorry, I had trouble finding ${serviceType} near you. Please try again.`,
        markers: []
      };
    }
  }

  private async getLocationContext(userLocation: { lat: number; lng: number }): Promise<{
    text: string;
    markers: any[];
  }> {
    try {
      // Get reverse geocoding
      const address = await geospatialService.reverseGeocode(userLocation.lat, userLocation.lng);
      
      // Find nearby services
      const pharmacies = await geospatialService.getPharmacies(userLocation.lat, userLocation.lng, 500);
      const restaurants = await geospatialService.getRestaurants(userLocation.lat, userLocation.lng, 500);

      const context = [];
      if (address) context.push(`You're currently at ${address}`);
      if (pharmacies.length > 0) context.push(`${pharmacies.length} pharmacies nearby`);
      if (restaurants.length > 0) context.push(`${restaurants.length} restaurants nearby`);

      return {
        text: context.join('. ') + '. What would you like to do?',
        markers: []
      };
    } catch (error) {
      console.error('Location context error:', error);
      return {
        text: 'I can see your location, but I had trouble getting additional context. What would you like to do?',
        markers: []
      };
    }
  }
}

const aiService = new AIService();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AI Smart City Backend is running',
    timestamp: new Date().toISOString(),
    features: {
      openai: !!openai,
      geospatial: true
    }
  });
});

// Enhanced chat endpoint with AI integration
app.post('/api/chat', async (req, res) => {
  const { message, userLocation } = req.body;
  
  try {
    const result = await aiService.processQuery(message, userLocation);
    
    const response = {
      id: Date.now().toString(),
      text: result.text,
      sender: 'ai',
      timestamp: new Date().toISOString(),
      markers: result.markers,
      route: result.route
    };

    res.json(response);
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ 
        error: 'Failed to process your request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
});

// Real places search endpoint
app.get('/api/places/search', async (req, res) => {
  const { query, lat, lng, radius = 1000 } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const places = await geospatialService.searchPlaces(
      query as string, 
      parseFloat(lat as string), 
      parseFloat(lng as string),
      parseInt(radius as string)
    );

    const formattedPlaces = places.map((place: any) => ({
      id: place.id,
      name: place.tags?.name || 'Unknown Place',
      type: place.tags?.amenity || 'place',
      position: [place.lat || place.center?.lat, place.lon || place.center?.lon],
      description: place.tags?.opening_hours || place.tags?.cuisine || 'No additional info',
      distance: geospatialService.calculateDistance(
        parseFloat(lat as string), 
        parseFloat(lng as string),
        place.lat || place.center?.lat,
        place.lon || place.center?.lon
      ).toFixed(1) + ' km'
    }));

    res.json({
      places: formattedPlaces,
      query: query,
      location: { lat, lng },
      count: formattedPlaces.length
    });
  } catch (error) {
    console.error('Places search error:', error);
    res.status(500).json({ 
      error: 'Failed to search places',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Geocoding endpoint
app.get('/api/geocode', async (req, res) => {
  const { address } = req.query;
  
  try {
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const result = await geospatialService.geocode(address as string);
    
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ 
      error: 'Failed to geocode address',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mock routes endpoint (will be enhanced in Phase 3)
app.get('/api/routes', (req, res) => {
  const { from, to } = req.query;
  
  const mockRoute = {
    id: Date.now().toString(),
    from: from,
    to: to,
    distance: '2.5 km',
    duration: '15 minutes',
    steps: [
      { instruction: 'Head north on Váci Street', distance: '500m' },
      { instruction: 'Turn right onto Kossuth Lajos Street', distance: '800m' },
      { instruction: 'Continue straight to destination', distance: '1.2km' }
    ],
    polyline: [
      [47.4979, 19.0402],
      [47.5079, 19.0502],
      [47.5179, 19.0602]
    ]
  };
  
  res.json(mockRoute);
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗺️  Geospatial services enabled`);
  console.log(`🤖 AI services: ${openai ? 'OpenAI enabled' : 'Rule-based responses'}`);
});