import { geospatialService, OverpassPlace } from './geospatial';
import { routingService } from '../routing';
import { openai } from './openaiClient';
import {
  PERSONA_LIST,
  PERSONA_REGISTRY,
  PersonaDefinition,
  PersonaKey,
  PersonaPayload
} from './personas';
import { logger } from '../utils/logger';

class AIService {
  async processQuery(message: string, userLocation?: { lat: number; lng: number }): Promise<{
    text: string;
    markers: unknown[];
    route?: unknown;
    persona?: PersonaPayload;
    suggestions?: string[];
  }> {
    const lowerMessage = message.toLowerCase();
    let personaContext = this.detectPersona(lowerMessage) || this.getPersonaById('local_concierge');
    const personaFallbackText = personaContext?.fallbackMessage || 'I can help you find places, get directions, check transport schedules, and discover what\'s happening in Budapest. Could you be more specific about what you need?';

    // Route/Directions queries - check for various route-related phrases
    if (lowerMessage.includes('route') || lowerMessage.includes('direction') ||
        lowerMessage.includes('way to') || lowerMessage.includes('how to get') ||
        lowerMessage.includes('best route') || lowerMessage.includes('show route') ||
        lowerMessage.includes('get to') || lowerMessage.includes('navigate to')) {
      if (!userLocation) {
        return this.applyPersona(personaContext, {
          text: 'I can help you with directions, but I need your location. Please allow location access.',
          markers: []
        });
      }

      // Extract destination from message
      const destination = this.extractDestination(message);
      if (destination) {
        const destinationPersona = this.hintPersonaForDestination(destination) || personaContext;
        const result = await this.getDirections('here', destination, userLocation);
        return this.applyPersona(destinationPersona, result);
      } else {
        return this.applyPersona(personaContext, {
          text: 'I can help you with directions! Please specify where you want to go (e.g., "route to Buda Castle" or "best route to the city center").',
          markers: []
        });
      }
    }

    // Service search queries
    const serviceTypes = ['pharmacy', 'pharmacies', 'restaurant', 'restaurants', 'cafe', 'cafes', 'food', 'bank', 'atm', 'hospital', 'clinic', 'gas', 'parking', 'hotel'];
    const foundService = serviceTypes.find(service => lowerMessage.includes(service));

    if (foundService) {
      if (!userLocation) {
        return this.applyPersona(this.getPersonaForService(foundService) || personaContext, {
          text: `I can help you find ${foundService}, but I need your location. Please allow location access to get accurate results.`,
          markers: []
        });
      }

      const servicePersona = this.getPersonaForService(foundService) || personaContext;
      const result = await this.searchServices(foundService, userLocation);
      return this.applyPersona(servicePersona, result);
    }

    // Location context queries
    if (lowerMessage.includes('near me') || lowerMessage.includes('around here') || lowerMessage.includes('what\'s nearby')) {
      if (!userLocation) {
        return this.applyPersona(personaContext, {
          text: 'I can help you find what\'s nearby, but I need your location. Please allow location access.',
          markers: []
        });
      }

      const result = await this.getLocationContext(userLocation);
      return this.applyPersona(personaContext, result);
    }

    // Specialized handling for Culture Curator - prioritize accurate historical/cultural answers
    if (personaContext?.id === 'culture_curator') {
      const cultureResult = await this.handleCultureCuratorQuery(message, userLocation);
      if (cultureResult) {
        return this.applyPersona(personaContext, cultureResult);
      }
    }

    // Use OpenAI if available for general queries
    if (openai) {
      try {
        // Enhanced system prompt for Culture Curator
        const systemPrompt = personaContext?.id === 'culture_curator'
          ? `You are a Culture Curator AI assistant specializing in Budapest's rich history, heritage, and cultural landmarks. You provide accurate, detailed, and engaging information about:

- Historical landmarks: Buda Castle (UNESCO World Heritage), Fisherman's Bastion, Matthias Church, Hungarian Parliament Building, Chain Bridge (first permanent bridge connecting Buda and Pest)
- Museums: Hungarian National Museum, Hungarian National Gallery, Museum of Fine Arts, House of Terror, Ludwig Museum
- Cultural sites: Great Market Hall (Nagy Vásárcsarnok), St. Stephen's Basilica, Heroes' Square (Hősök tere), Andrássy Avenue (UNESCO World Heritage)
- Historical context: Budapest was formed in 1873 by merging Buda, Pest, and Óbuda. The city has Roman origins (Aquincum), Ottoman influences, and Austro-Hungarian Empire heritage.
- Architectural styles: Gothic (Matthias Church), Neo-Gothic (Parliament), Art Nouveau (Gellért Bath), Baroque, and Modern
- Important dates: Chain Bridge (1849), Parliament (1902), Heroes' Square (1896 Millennium Monument)

Always provide accurate historical facts, architectural details, and cultural significance. If you're unsure about specific details, acknowledge it rather than guessing. Keep responses informative but engaging, around 100-200 words.`
          : "You are a helpful AI assistant for Budapest city services. You help users find places, get directions, and discover local information. Keep responses concise and helpful. Always mention that you can help with finding places, getting directions, and discovering local events.";

        const maxTokens = personaContext?.id === 'culture_curator' ? 300 : 150;
        const temperature = personaContext?.id === 'culture_curator' ? 0.5 : 0.7; // Lower temperature for more accurate answers

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: maxTokens,
          temperature: temperature
        });

        return this.applyPersona(personaContext, {
          text: completion.choices[0].message.content || 'I can help you with Budapest city services. What would you like to know?',
          markers: []
        });
      } catch (error) {
        logger.error('OpenAI error:', error);
      }
    }

    // Fallback responses
    if (lowerMessage.includes('budapest') || lowerMessage.includes('city')) {
      return this.applyPersona(personaContext, {
        text: personaFallbackText,
        markers: []
      });
    }

    return this.applyPersona(personaContext, {
      text: personaFallbackText,
      markers: []
    });
  }

  private extractDestination(message: string): string | null {
    const patterns = [
      /best route to (.+)/i,
      /route to (.+)/i,
      /directions to (.+)/i,
      /way to (.+)/i,
      /how to get to (.+)/i,
      /how do i get to (.+)/i,
      /go to (.+)/i,
      /navigate to (.+)/i,
      /show route to (.+)/i,
      /get to (.+)/i,
      /(.+) route/i,  // Catch "city center route" or "Buda Castle route"
      /route (.+)/i   // Catch "route city center" or "route Buda Castle"
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const destination = match[1].trim();
        // Filter out common stop words and route-related words
        const stopWords = ['the', 'a', 'an', 'to', 'from', 'best', 'show', 'me', 'please'];
        const words = destination.split(' ').filter(word => !stopWords.includes(word.toLowerCase()));
        if (words.length > 0) {
          return words.join(' ');
        }
        return destination;
      }
    }

    return null;
  }

  private async getDirections(from: string, to: string, userLocation: { lat: number; lng: number }): Promise<{
    text: string;
    markers: unknown[];
    route?: unknown;
  }> {
    try {
      // ALWAYS use user's current location as the start point
      // Ignore the 'from' parameter and always use userLocation
      const startLat = userLocation.lat;
      const startLng = userLocation.lng;

      logger.debug(`🗺️ Planning route from user's current location:`);
      logger.debug(`   Start (User Location): [${startLat}, ${startLng}]`);

      // Geocode the destination
      const toResult = await geospatialService.geocode(to);
      if (!toResult) {
        return {
          text: `I couldn't find the destination "${to}". Please provide a valid address or landmark.`,
          markers: []
        };
      }

      logger.debug(`   Destination: [${toResult.lat}, ${toResult.lng}] (${toResult.display_name})`);

      // Get real route using OpenRouteService - ALWAYS from user's current location
      const walkingRoute = await routingService.getWalkingRoute(
        [startLat, startLng], // Always user's current location
        [toResult.lat, toResult.lng]
      );

      if (walkingRoute) {
        const distance = routingService.formatDistance(walkingRoute.distance);
        const duration = routingService.formatDuration(walkingRoute.duration);
        const firstInstructions = walkingRoute.instructions.slice(0, 3).join(' → ');

        // Validate and format geometry - ensure [lat, lng] format
        const formattedGeometry = walkingRoute.geometry.map((coord: number[]) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            let lat = coord[0];
            let lng = coord[1];

            // Validate coordinates are reasonable for Budapest
            // Budapest: lat ~47.5, lng ~19.0
            // If coordinates seem swapped (lat < lng and lat < 30), swap them
            if (lat < lng && lat < 30 && lng > 40) {
              logger.warn(`⚠️ Swapping coordinates: [${lat}, ${lng}] -> [${lng}, ${lat}]`);
              [lat, lng] = [lng, lat];
            }

            // Final validation - coordinates should be in Hungary/Budapest area
            if (lat < 45 || lat > 49 || lng < 16 || lng > 23) {
              logger.error(`❌ Invalid coordinates for Budapest: [${lat}, ${lng}]`);
            }

            return [lat, lng]; // Return as [lat, lng]
          }
          return coord;
        });

        // Log first and last coordinates for debugging
        if (formattedGeometry.length > 0) {
          logger.debug(`✅ Route geometry: ${formattedGeometry.length} points`);
          logger.debug(`   First: [${formattedGeometry[0][0]}, ${formattedGeometry[0][1]}]`);
          logger.debug(`   Last: [${formattedGeometry[formattedGeometry.length - 1][0]}, ${formattedGeometry[formattedGeometry.length - 1][1]}]`);
        }

        // Validate destination coordinates before creating marker
        const destLat = toResult.lat;
        const destLng = toResult.lng;

        // Only add destination marker if coordinates are valid
        const markers: unknown[] = [];
        if (destLat >= 47.0 && destLat <= 48.0 && destLng >= 18.5 && destLng <= 19.5) {
          markers.push({
            position: [destLat, destLng], // [lat, lng] format
            title: toResult.display_name,
            description: 'Destination',
            type: 'destination'
          });
          logger.debug(`✅ Destination marker added: [${destLat}, ${destLng}]`);
        } else {
          logger.error(`❌ Destination coordinates invalid: [${destLat}, ${destLng}] - NOT adding marker`);
        }

        return {
          text: `Here's the best route to ${toResult.display_name}. Distance: ${distance}, Duration: ${duration}. ${firstInstructions}`,
          markers: markers, // Only valid markers
          route: {
            polyline: formattedGeometry.length > 0 ? formattedGeometry : walkingRoute.geometry,
            distance: distance,
            duration: duration,
            steps: walkingRoute.instructions.map((instruction, index) => ({
              instruction,
              distance: index < walkingRoute.instructions.length - 1 ? 'N/A' : distance,
              type: 'walking'
            })),
            mode: 'walking'
          }
        };
      }

      // Fallback to simple distance calculation if routing fails
      const distance = geospatialService.calculateDistance(
        startLat, startLng, // Always user's current location
        toResult.lat, toResult.lng
      );

      // Validate destination coordinates before creating marker
      const destLat = toResult.lat;
      const destLng = toResult.lng;

      // Only add destination marker if coordinates are valid
      const fallbackMarkers: unknown[] = [];
      if (destLat >= 47.0 && destLat <= 48.0 && destLng >= 18.5 && destLng <= 19.5) {
        fallbackMarkers.push({
          position: [destLat, destLng], // [lat, lng] format
          title: toResult.display_name,
          description: 'Destination',
          type: 'destination'
        });
        logger.debug(`✅ Fallback destination marker added: [${destLat}, ${destLng}]`);
      } else {
        logger.error(`❌ Fallback destination coordinates invalid: [${destLat}, ${destLng}] - NOT adding marker`);
      }

      return {
        text: `Here's your route to ${toResult.display_name}. It's about ${distance.toFixed(1)} km away.`,
        markers: fallbackMarkers, // Only valid markers
        route: {
          polyline: [[startLat, startLng], [toResult.lat, toResult.lng]], // Always start from user location
          distance: `${distance.toFixed(1)} km`,
          duration: `${Math.round(distance * 12)} min`,
          steps: [
            { instruction: 'Start from your current location', distance: 'N/A', type: 'walking' },
            { instruction: 'Follow the route', distance: 'N/A', type: 'walking' },
            { instruction: `Arrive at ${toResult.display_name}`, distance: distance.toFixed(1) + ' km', type: 'walking' }
          ],
          mode: 'walking'
        }
      };
    } catch (error) {
      logger.error('Directions error:', error);
      return {
        text: 'Sorry, I had trouble calculating directions. Please try again with different addresses.',
        markers: []
      };
    }
  }

  private async searchServices(serviceType: string, userLocation: { lat: number; lng: number }): Promise<{
    text: string;
    markers: unknown[];
  }> {
    try {
      const places = await geospatialService.searchPlaces(serviceType, userLocation.lat, userLocation.lng);

      if (places.length === 0) {
        return {
          text: `I couldn't find any ${serviceType} near your location. Try expanding your search area.`,
          markers: []
        };
      }

      const markers = places.slice(0, 5).map((place: OverpassPlace) => ({
        position: [place.lat || place.center?.lat, place.lon || place.center?.lon],
        title: place.tags?.name || serviceType,
        description: place.tags?.opening_hours || place.tags?.cuisine || 'No additional info',
        type: serviceType
      }));

      const nearest = places[0];
      const distance = geospatialService.calculateDistance(
        userLocation.lat,
        userLocation.lng,
        nearest.lat || nearest.center?.lat || 0,
        nearest.lon || nearest.center?.lon || 0
      );

      return {
        text: `I found ${places.length} ${serviceType} near you. The nearest is ${nearest.tags?.name || 'a place'} located ${distance.toFixed(1)} km away.`,
        markers
      };
    } catch (error) {
      logger.error('Service search error:', error);
      return {
        text: `Sorry, I had trouble finding ${serviceType} near you. Please try again.`,
        markers: []
      };
    }
  }

  private async getLocationContext(userLocation: { lat: number; lng: number }): Promise<{
    text: string;
    markers: unknown[];
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
      logger.error('Location context error:', error);
      return {
        text: 'I can see your location, but I had trouble getting additional context. What would you like to do?',
        markers: []
      };
    }
  }

  private async handleCultureCuratorQuery(message: string, userLocation?: { lat: number; lng: number }): Promise<{
    text: string;
    markers: unknown[];
  } | null> {
    const lowerMessage = message.toLowerCase();

    // Check for historical places queries
    const historicalKeywords = ['historical', 'history', 'heritage', 'landmark', 'monument', 'museum', 'castle', 'bastion', 'parliament', 'basilica', 'bridge'];
    const isHistoricalQuery = historicalKeywords.some(keyword => lowerMessage.includes(keyword));

    // If user asks about nearby historical places and has location
    if (userLocation && (lowerMessage.includes('near me') || lowerMessage.includes('nearby') || lowerMessage.includes('around here'))) {
      try {
        const historicalPlaces = await geospatialService.getHistoricalPlaces(userLocation.lat, userLocation.lng, 2000);

        if (historicalPlaces.length > 0) {
          const markers = historicalPlaces.slice(0, 5).map((place: OverpassPlace) => {
            const lat = place.lat || place.center?.lat;
            const lng = place.lon || place.center?.lon;
            const name = place.tags?.name || 'Historical Place';
            const description = geospatialService.getHistoricalPlaceDescription(name, place.tags || {});

            return {
              position: [lat, lng],
              title: name,
              description: description,
              type: place.tags?.historic || place.tags?.tourism || 'historical'
            };
          });

          const nearest = historicalPlaces[0];
          const nearestName = nearest.tags?.name || 'a historical site';
          const distance = userLocation ? geospatialService.calculateDistance(
            userLocation.lat,
            userLocation.lng,
            nearest.lat || nearest.center?.lat || 0,
            nearest.lon || nearest.center?.lon || 0
          ) : 0;

          return {
            text: `I found ${historicalPlaces.length} historical sites near you. The closest is ${nearestName}, ${distance.toFixed(1)} km away. ${geospatialService.getHistoricalPlaceDescription(nearestName, nearest.tags || {})} I've marked the most significant ones on the map.`,
            markers
          };
        }
      } catch (error) {
        logger.error('Historical places query error:', error);
      }
    }

    // Handle specific landmark queries with accurate information
    const landmarkInfo: { [key: string]: string } = {
      'buda castle': 'Buda Castle (Budavári Palota) is a UNESCO World Heritage Site and historic castle complex. Originally built in the 13th century, it served as the residence of Hungarian kings. The current Baroque palace dates from the 18th century, though it was heavily damaged in WWII and reconstructed. Today it houses the Hungarian National Gallery and Budapest History Museum. The castle district offers stunning views of the Danube and Pest side.',
      'fisherman\'s bastion': 'Fisherman\'s Bastion (Halászbástya) is a Neo-Romanesque terrace built between 1895-1902. Despite its name, it was never used for defense. It was designed by Frigyes Schulek as a viewing platform with seven towers representing the seven Magyar tribes that settled in Hungary. The bastion offers panoramic views of the Danube, Parliament, and Pest. It\'s located next to Matthias Church on Castle Hill.',
      'matthias church': 'Matthias Church (Mátyás-templom) is a Gothic church on Castle Hill, originally built in the 13th century. It was the site of coronations for Hungarian kings, including Franz Joseph I and Charles IV. The church features colorful Zsolnay ceramic tiles on its roof and houses the Ecclesiastical Art Museum. The church was restored by Frigyes Schulek in the late 19th century.',
      'parliament': 'The Hungarian Parliament Building (Országház) is a Neo-Gothic masterpiece completed in 1902. Designed by Imre Steindl, it\'s one of the largest parliament buildings in the world and a symbol of Budapest. The building features 691 rooms, 20 kilometers of corridors, and houses the Hungarian Crown Jewels. It stands on the Pest side of the Danube and is particularly beautiful when illuminated at night.',
      'chain bridge': 'The Chain Bridge (Széchenyi Lánchíd) was the first permanent bridge connecting Buda and Pest, completed in 1849. Designed by English engineer William Tierney Clark and built by Scottish engineer Adam Clark, it was a marvel of engineering at the time. The bridge was destroyed in WWII but rebuilt identically. It\'s named after Count István Széchenyi, who initiated its construction.',
      'st stephen\'s basilica': 'St. Stephen\'s Basilica (Szent István-bazilika) is the largest church in Budapest, completed in 1905. It\'s named after Hungary\'s first king, St. Stephen, whose mummified right hand (the Holy Right) is displayed in the reliquary. The church features Neo-Renaissance architecture and offers panoramic views from its dome. It can accommodate up to 8,500 people.',
      'heroes\' square': 'Heroes\' Square (Hősök tere) was built in 1896 to commemorate the 1000th anniversary of the Magyar conquest of Hungary. The centerpiece is the Millennium Monument with the Archangel Gabriel on top. The colonnades feature statues of Hungarian leaders. The square is flanked by the Museum of Fine Arts and the Palace of Art (Műcsarnok).',
      'great market hall': 'The Great Market Hall (Nagy Vásárcsarnok) is Budapest\'s largest and oldest indoor market, opened in 1897. Designed by Samu Pecz, it features beautiful ironwork and Zsolnay ceramic tiles. The ground floor sells fresh produce, meat, and Hungarian specialties like paprika and salami. The upper level has food stalls and souvenir shops. It\'s located at the Pest end of Liberty Bridge.',
      'andrássy avenue': 'Andrássy Avenue (Andrássy út) is a UNESCO World Heritage boulevard connecting City Park to the city center. Built in the 1870s, it\'s lined with elegant Neo-Renaissance mansions, luxury shops, and the Hungarian State Opera House. The avenue was named after Prime Minister Gyula Andrássy and is one of Budapest\'s most prestigious streets.',
      'gellért hill': 'Gellért Hill rises 235 meters above the Danube and offers panoramic views of Budapest. It\'s named after St. Gerard (Gellért), who was martyred here in the 11th century. The hill features the Liberty Statue (Szabadság-szobor), erected in 1947 to commemorate liberation from Nazi occupation. The Gellért Cave Church and the Citadella are also located here.'
    };

    for (const [landmark, info] of Object.entries(landmarkInfo)) {
      if (lowerMessage.includes(landmark)) {
        return {
          text: info,
          markers: []
        };
      }
    }

    // If it's a historical query but we don't have specific handling, return null to let OpenAI handle it
    if (isHistoricalQuery) {
      return null; // Let OpenAI with enhanced prompt handle it
    }

    return null;
  }

  private detectPersona(message: string): PersonaDefinition | null {
    if (!message || message.trim().length === 0) {
      return null;
    }

    let bestMatch: PersonaDefinition | null = null;
    let bestScore = 0;

    for (const persona of PERSONA_LIST) {
      if (persona.keywords.length === 0) continue;
      let score = 0;
      for (const keyword of persona.keywords) {
        if (message.includes(keyword)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = persona;
      }
    }

    return bestScore > 0 ? bestMatch : null;
  }

  private getPersonaById(id: PersonaKey): PersonaDefinition | null {
    return PERSONA_REGISTRY[id] || null;
  }

  private getPersonaForService(service: string): PersonaDefinition | null {
    const normalized = service.toLowerCase();
    if (['restaurant', 'restaurants', 'food', 'hotel'].includes(normalized)) {
      return this.getPersonaById('evening_compass');
    }
    // if (['pharmacy', 'pharmacies', 'bank', 'atm', 'hospital', 'clinic', 'gas', 'parking'].includes(normalized)) {
    //   return this.getPersonaById('daily_flow_optimizer');
    // }
    if (['cafe', 'cafes'].includes(normalized)) {
      return this.getPersonaById('culture_curator');
    }
    return null;
  }

  private hintPersonaForDestination(destination: string): PersonaDefinition | null {
    const lower = destination.toLowerCase();
    const cultureHints = ['castle', 'bastion', 'museum', 'gallery', 'parliament', 'basilica', 'market hall', 'heroes', 'liberty bridge'];
    const eveningHints = ['bar', 'pub', 'night', 'sunset', 'restaurant', 'danube'];
    const mobilityHints = ['bike', 'cycling', 'tram'];

    if (cultureHints.some(keyword => lower.includes(keyword))) {
      return this.getPersonaById('culture_curator');
    }
    if (eveningHints.some(keyword => lower.includes(keyword))) {
      return this.getPersonaById('evening_compass');
    }
    if (mobilityHints.some(keyword => lower.includes(keyword))) {
      return this.getPersonaById('mobility_hacker');
    }
    return null;
  }

  private applyPersona<T extends { text: string; markers: unknown[]; route?: unknown }>(
    persona: PersonaDefinition | null,
    response: T
  ): T & { persona?: PersonaPayload; suggestions?: string[] } {
    if (!persona) {
      return response;
    }
    const trimmedPrefix = persona.prefix ? `${persona.prefix} ` : '';
    const personaPayload: PersonaPayload = {
      id: persona.id,
      name: persona.label,
      tagline: persona.description,
      tone: persona.tone,
      recommendedPrompts: persona.suggestions,
      suggestedPlaybookId: persona.recommendedPlaybookId
    };
    const enriched: T & { persona?: PersonaPayload; suggestions?: string[] } = {
      ...response,
      text: `${trimmedPrefix}${response.text}`,
      persona: personaPayload,
      suggestions: persona.suggestions
    };
    return enriched;
  }
}

export const aiService = new AIService();
