import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import OpenAI from 'openai';

// Load environment variables FIRST, before importing services that depend on them
dotenv.config();

// Import services after environment variables are loaded
import { publicTransportService } from './transport';
import { sharedMobilityService } from './mobility';
import { weatherService } from './weather';
import { routingService } from './routing';
import { neighborhoodPlaybookService } from './playbooks';
import { moodboardService } from './moodboard';
import { communityService, TransportFeedback, RouteConfidence } from './community';
import { safetyService, RouteSafetyAnalysis } from './safety';
import { storyService } from './stories';
import { isWithinBudapest, normalizeCoordinate, BUDAPEST_BOUNDS } from './utils/geoValidation';
import { InMemoryCache } from './utils/cache';

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
  private geocodeCache = new InMemoryCache<string, any>(5 * 60 * 1000);
  private placesCache = new InMemoryCache<string, any[]>(2 * 60 * 1000);
  private reverseCache = new InMemoryCache<string, string>(10 * 60 * 1000);
  private historicalCache = new InMemoryCache<string, any[]>(5 * 60 * 1000);

  private buildCacheKey(prefix: string, ...values: Array<string | number>): string {
    return `${prefix}:${values.join(':').toLowerCase()}`;
  }

  async geocode(address: string): Promise<any> {
    try {
      const trimmed = address.trim();
      const cacheKey = this.buildCacheKey('geocode', trimmed);
      const cached = this.geocodeCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // ALWAYS search in Budapest, Hungary context
      // First try with explicit Budapest context
      let response = await axios.get(`${this.nominatimBaseUrl}/search`, {
        params: {
          q: `${trimmed}, Budapest, Hungary`,
          format: 'json',
          limit: 10,
          countrycodes: 'hu',
          addressdetails: 1,
          viewbox: `${BUDAPEST_BOUNDS.lngMin},${BUDAPEST_BOUNDS.latMax},${BUDAPEST_BOUNDS.lngMax},${BUDAPEST_BOUNDS.latMin}`,
          bounded: 1
        },
        headers: {
          'User-Agent': 'AI-Smart-City-App/1.0'
        }
      });

      // If no results, try with wider Hungary search but still prioritize Budapest
      if (!response.data || response.data.length === 0) {
        response = await axios.get(`${this.nominatimBaseUrl}/search`, {
          params: {
            q: `${trimmed}, Hungary`,
            format: 'json',
            limit: 10,
            countrycodes: 'hu',
            addressdetails: 1
          },
          headers: {
            'User-Agent': 'AI-Smart-City-App/1.0'
          }
        });
      }

      if (response.data && response.data.length > 0) {
        // Find the best match - MUST be in Budapest/Hungary
        let result = null;
        for (const item of response.data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const displayName = (item.display_name || '').toLowerCase();
          
          // Validate coordinates are in Budapest area (strict check)
          const isInBuda = isWithinBudapest(lat, lng);
          const mentionsBudapest = displayName.includes('budapest') || displayName.includes('hungary');
          
          if (isInBuda || mentionsBudapest) {
            result = item;
            break;
          }
        }
        
        // If no Budapest result found, take first result but validate coordinates
        if (!result) {
          result = response.data[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          
          // Reject if clearly outside Budapest
          if (!isWithinBudapest(lat, lng)) {
            console.error(`❌ Rejected geocoding result outside Budapest: [${lat}, ${lng}] for "${address}"`);
            return null;
          }
        }

        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        console.log(`📍 Geocoded "${address}" to: ${result.display_name}`);
        console.log(`   Coordinates: [${lat}, ${lng}]`);
        
        // Final validation - MUST be in Budapest area
        if (!isWithinBudapest(lat, lng)) {
          console.error(`❌ Invalid coordinates for Budapest: [${lat}, ${lng}] - REJECTING`);
          return null;
        }

        const payload = {
          lat: lat,
          lng: lng,
          display_name: result.display_name
        };
        this.geocodeCache.set(cacheKey, payload);
        return payload;
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  async searchPlaces(query: string, lat: number, lng: number, radius: number = 1000): Promise<any[]> {
    try {
      // STRICT: Only allow searches within Budapest area
      if (!isWithinBudapest(lat, lng)) {
        console.warn(`⚠️ Place search location [${lat}, ${lng}] is outside Budapest area - restricting to Budapest`);
        // Force search to Budapest center if location is outside
        [lat, lng] = [47.4979, 19.0402];
        console.log(`   Using Budapest center [${lat}, ${lng}] for search`);
      }

      const cacheKey = this.buildCacheKey('places', query, lat, lng, radius);
      const cached = this.placesCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
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
        'clinic': 'clinic',
        'spa': 'spa',
        'thermal': 'spa',
        'thermal bath': 'spa',
        'thermal baths': 'spa',
        'wellness': 'spa',
        'museum': 'museum',
        'museums': 'museum',
        'gallery': 'museum',
        'galleries': 'museum'
      };

      // Check if query contains thermal bath keywords
      const queryLower = query.toLowerCase();
      let amenity = amenityMap[queryLower];
      
      // Handle multi-word queries
      if (!amenity) {
        if (queryLower.includes('thermal') || queryLower.includes('bath') || queryLower.includes('spa') || queryLower.includes('wellness')) {
          amenity = 'spa';
        } else if (queryLower.includes('museum') || queryLower.includes('gallery')) {
          amenity = 'museum';
        } else {
          amenity = 'restaurant'; // default
        }
      }
      
      // STRICT Budapest bounding box: [south, west, north, east]
      const budapestBbox = `${BUDAPEST_BOUNDS.latMin},${BUDAPEST_BOUNDS.lngMin},${BUDAPEST_BOUNDS.latMax},${BUDAPEST_BOUNDS.lngMax}`;
      
      // Use bounding box to STRICTLY restrict search to Budapest area only
      // For spa/thermal baths, also search by leisure=spa and tourism tags
      let overpassQuery = '';
      
      if (amenity === 'spa') {
        // Search for spas using multiple tags
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["leisure"="spa"](around:${radius},${lat},${lng})(${budapestBbox});
            way["leisure"="spa"](around:${radius},${lat},${lng})(${budapestBbox});
            relation["leisure"="spa"](around:${radius},${lat},${lng})(${budapestBbox});
            node["amenity"="spa"](around:${radius},${lat},${lng})(${budapestBbox});
            way["amenity"="spa"](around:${radius},${lat},${lng})(${budapestBbox});
            relation["amenity"="spa"](around:${radius},${lat},${lng})(${budapestBbox});
            node["tourism"="attraction"]["name"~"thermal|bath|fürdő",i](around:${radius},${lat},${lng})(${budapestBbox});
            way["tourism"="attraction"]["name"~"thermal|bath|fürdő",i](around:${radius},${lat},${lng})(${budapestBbox});
            relation["tourism"="attraction"]["name"~"thermal|bath|fürdő",i](around:${radius},${lat},${lng})(${budapestBbox});
          );
          out center;
        `;
      } else if (amenity === 'museum') {
        // Search for museums
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["tourism"="museum"](around:${radius},${lat},${lng})(${budapestBbox});
            way["tourism"="museum"](around:${radius},${lat},${lng})(${budapestBbox});
            relation["tourism"="museum"](around:${radius},${lat},${lng})(${budapestBbox});
            node["amenity"="arts_centre"](around:${radius},${lat},${lng})(${budapestBbox});
            way["amenity"="arts_centre"](around:${radius},${lat},${lng})(${budapestBbox});
            relation["amenity"="arts_centre"](around:${radius},${lat},${lng})(${budapestBbox});
          );
          out center;
        `;
      } else {
        // Default search for other amenities
        overpassQuery = `
          [out:json][timeout:25];
          (
            node["amenity"="${amenity}"](around:${radius},${lat},${lng})(${budapestBbox});
            way["amenity"="${amenity}"](around:${radius},${lat},${lng})(${budapestBbox});
            relation["amenity"="${amenity}"](around:${radius},${lat},${lng})(${budapestBbox});
          );
          out center;
        `;
      }

      const response = await axios.post(this.overpassBaseUrl, overpassQuery, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      // STRICT: Filter results to ensure they're within Budapest boundaries
      const results = (response.data.elements || []).filter((place: any) => {
        const placeLat = place.lat || place.center?.lat;
        const placeLng = place.lon || place.center?.lon;
        
        if (!placeLat || !placeLng) return false;
        
        // Strict Budapest validation
        const isInBudapestBounds = isWithinBudapest(placeLat, placeLng);
        
        if (!isInBudapestBounds) {
          console.warn(`⚠️ Filtered out place outside Budapest: [${placeLat}, ${placeLng}]`);
        }
        
        return isInBudapestBounds;
      });

      console.log(`📍 Found ${results.length} places in Budapest for "${query}"`);
      this.placesCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Places search error:', error);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const cacheKey = this.buildCacheKey('reverse', lat, lng);
      const cached = this.reverseCache.get(cacheKey);
      if (cached) {
        return cached;
      }

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
        this.reverseCache.set(cacheKey, response.data.display_name);
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
      const cacheKey = this.buildCacheKey('pharmacies', lat, lng, radius);
      const cached = this.placesCache.get(cacheKey);
      if (cached) {
        return cached;
      }

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

      const results = response.data.elements || [];
      this.placesCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Pharmacies search error:', error);
      return [];
    }
  }

  async getRestaurants(lat: number, lng: number, radius: number = 1000): Promise<any[]> {
    try {
      const cacheKey = this.buildCacheKey('restaurants', lat, lng, radius);
      const cached = this.placesCache.get(cacheKey);
      if (cached) {
        return cached;
      }

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

      const results = response.data.elements || [];
      this.placesCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Restaurants search error:', error);
      return [];
    }
  }

  async getHistoricalPlaces(lat: number, lng: number, radius: number = 5000): Promise<any[]> {
    try {
      const cacheKey = this.buildCacheKey('historical', lat, lng, radius);
      const cached = this.historicalCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Search for historical places, monuments, landmarks in Budapest
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["historic"](around:${radius},${lat},${lng});
          way["historic"](around:${radius},${lat},${lng});
          relation["historic"](around:${radius},${lat},${lng});
          node["tourism"="attraction"]["historic"](around:${radius},${lat},${lng});
          way["tourism"="attraction"]["historic"](around:${radius},${lat},${lng});
          node["tourism"="museum"](around:${radius},${lat},${lng});
          way["tourism"="museum"](around:${radius},${lat},${lng});
          node["tourism"="monument"](around:${radius},${lat},${lng});
          way["tourism"="monument"](around:${radius},${lat},${lng});
        );
        out center;
      `;

      const response = await axios.post(this.overpassBaseUrl, overpassQuery, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      const results = response.data.elements || [];
      this.historicalCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Historical places search error:', error);
      return [];
    }
  }

  // Historical places descriptions for Budapest landmarks
  getHistoricalPlaceDescription(name: string, tags: any): string {
    const nameLower = name.toLowerCase();
    const descriptions: { [key: string]: string } = {
      'buda castle': 'Medieval castle complex and historical palace district, UNESCO World Heritage Site. Former residence of Hungarian kings.',
      'budavári palota': 'Buda Castle Palace - Historic royal palace on Castle Hill, now housing museums and galleries.',
      'halászbástya': 'Fisherman\'s Bastion - Neo-Romanesque terrace with panoramic views of the Danube and Pest side.',
      'mátyás templom': 'Matthias Church - Gothic church on Castle Hill, coronation site of Hungarian kings.',
      'parliament': 'Hungarian Parliament Building - Neo-Gothic masterpiece on the Danube, one of Budapest\'s most iconic landmarks.',
      'széchenyi lánchíd': 'Chain Bridge - First permanent bridge connecting Buda and Pest, symbol of Budapest.',
      'heroes square': 'Hősök tere - Monumental square with statues of Hungarian leaders and the Millennium Monument.',
      'st stephen\'s basilica': 'St. Stephen\'s Basilica - Largest church in Budapest, named after Hungary\'s first king.',
      'gellért hill': 'Gellért Hill - Historic hill with citadel and Liberty Statue, offering panoramic city views.',
      'great synagogue': 'Dohány Street Synagogue - Largest synagogue in Europe, important Jewish heritage site.',
      'vajdahunyad castle': 'Vajdahunyad Castle - Architectural showcase in City Park, representing Hungarian building styles.',
      'opera house': 'Hungarian State Opera House - Neo-Renaissance opera house, one of Europe\'s finest.',
      'andrássy út': 'Andrássy Avenue - UNESCO World Heritage boulevard connecting City Park to the city center.',
      'gellért thermal bath': 'Gellért Thermal Bath - Historic Art Nouveau spa complex with thermal pools.',
      'széchenyi thermal bath': 'Széchenyi Thermal Bath - Largest thermal bath complex in Europe, Neo-Baroque architecture.',
      'national museum': 'Hungarian National Museum - Museum of Hungarian history, art, and archaeology.',
      'national gallery': 'Hungarian National Gallery - Art museum in Buda Castle, showcasing Hungarian art.',
      'house of terror': 'House of Terror - Museum documenting the fascist and communist regimes in Hungary.',
      'great market hall': 'Great Market Hall - Historic covered market, largest and oldest indoor market in Budapest.',
      'liberty bridge': 'Liberty Bridge - Green iron bridge connecting Buda and Pest, opened in 1896.',
      'elizabeth bridge': 'Elizabeth Bridge - Modern white bridge, named after Empress Elisabeth of Austria.',
      'petőfi bridge': 'Petőfi Bridge - Bridge named after Hungarian poet Sándor Petőfi.',
      'rákóczi bridge': 'Rákóczi Bridge - Modern bridge connecting the two sides of Budapest.',
      'castle hill': 'Castle Hill - Historic district with medieval streets, museums, and panoramic views.',
      'gellért cave': 'Gellért Hill Cave - Cave church and monastery in Gellért Hill.',
      'rudas bath': 'Rudas Thermal Bath - Historic Turkish bath from the 16th century.',
      'király bath': 'Király Thermal Bath - Ottoman-era thermal bath, one of the oldest in Budapest.',
      'memento park': 'Memento Park - Open-air museum with statues from Hungary\'s communist era.',
      'tomb of gül baba': 'Tomb of Gül Baba - Ottoman-era tomb and memorial, northernmost Islamic pilgrimage site.',
      'aquincum': 'Aquincum - Ruins of ancient Roman city, archaeological park and museum.',
      'buda hills': 'Buda Hills - Forested hills offering hiking trails and panoramic viewpoints.',
      'city park': 'Városliget - Large public park with museums, zoo, and recreational facilities.',
      'zoo': 'Budapest Zoo - One of the oldest zoos in the world, located in City Park.',
      'circus': 'Budapest Circus - Historic circus building in City Park.',
      'transport museum': 'Transport Museum - Museum showcasing the history of Hungarian transportation.',
      'military history museum': 'Military History Museum - Museum of Hungarian military history.',
      'ethnographic museum': 'Ethnographic Museum - Museum of Hungarian folk culture and traditions.',
      'museum of fine arts': 'Museum of Fine Arts - Art museum with European and Hungarian collections.',
      'ludwig museum': 'Ludwig Museum - Contemporary art museum in the Palace of Arts.',
      'palace of arts': 'Palace of Arts - Cultural center with concert hall and museums.',
      'hungarian state opera': 'Hungarian State Opera - Historic opera house on Andrássy Avenue.',
      'franz liszt academy': 'Franz Liszt Academy of Music - Music conservatory and concert hall.',
      'keleti railway station': 'Keleti Railway Station - Historic railway station, gateway to Eastern Europe.',
      'nyugati railway station': 'Nyugati Railway Station - Historic railway station designed by Eiffel Company.',
      'déli railway station': 'Déli Railway Station - Southern railway station in Buda.',
      'funicular': 'Buda Castle Funicular - Historic funicular railway to Castle Hill.',
      'cogwheel railway': 'Cogwheel Railway - Historic mountain railway in Buda Hills.',
      'children\'s railway': 'Children\'s Railway - Narrow-gauge railway operated by children in Buda Hills.',
      'tram line 2': 'Tram Line 2 - Scenic tram route along the Danube, UNESCO World Heritage.',
      'danube promenade': 'Danube Promenade - Riverside walkway with views of Buda Castle and Parliament.',
      'buda tunnel': 'Buda Tunnel - Historic tunnel under Castle Hill connecting to Chain Bridge.',
      'liberty statue': 'Liberty Statue - Monument on Gellért Hill commemorating liberation from Nazi occupation.',
      'millennium monument': 'Millennium Monument - Column and statues in Heroes\' Square commemorating 1000 years of Hungary.',
      'statue of liberty': 'Statue of Liberty - Monument on Gellért Hill, symbol of freedom.',
      'petőfi statue': 'Statue of Sándor Petőfi - Monument to the Hungarian poet and revolutionary.',
      'kossuth square': 'Kossuth Square - Square in front of Parliament, named after Lajos Kossuth.',
      'deák square': 'Deák Square - Central square and major transport hub in Budapest.',
      'vörösmarty square': 'Vörösmarty Square - Historic square in the heart of Pest, named after poet Mihály Vörösmarty.',
      'erzsébet square': 'Erzsébet Square - Square named after Empress Elisabeth, with modern architecture.',
      'fővám square': 'Fővám Square - Square near the Great Market Hall and university.',
      'astoria': 'Astoria - Historic intersection and square in the city center.',
      'blaha lujza square': 'Blaha Lujza Square - Major square and transport hub, named after actress Lujza Blaha.',
      'octogon': 'Oktogon - Octagonal square on Andrássy Avenue, major intersection.',
      'kodály körönd': 'Kodály Circle - Circular square on Andrássy Avenue, named after composer Zoltán Kodály.',
      'jászai mari square': 'Jászai Mari Square - Square near Margaret Bridge, named after actress Mari Jászai.',
      'moszkva square': 'Moszkva Square - Square in Buda, formerly named Moscow Square.',
      'széll kálmán square': 'Széll Kálmán Square - Major transport hub in Buda, named after politician Kálmán Széll.',
      'batthyány square': 'Batthyány Square - Square in Buda with market hall and Parliament view.',
      'clark ádám square': 'Clark Ádám Square - Square at the Buda end of Chain Bridge.',
      'roosevelt square': 'Roosevelt Square - Square at the Pest end of Chain Bridge.',
      'szabadság square': 'Szabadság Square - Liberty Square with monuments and embassies.',
      'március 15 square': 'March 15 Square - Square commemorating the 1848 Revolution.',
      'ferenciek square': 'Ferenciek Square - Square named after the Franciscan order.',
      'kalvin square': 'Kálvin Square - Square and major intersection, named after John Calvin.',
      'corvin square': 'Corvin Square - Square in the 8th district, named after King Matthias Corvinus.',
      'köztársaság square': 'Köztársaság Square - Republic Square with monuments and institutions.',
      'józsef nádor square': 'József Nádor Square - Square named after Archduke Joseph, Palatine of Hungary.',
      'béke square': 'Béke Square - Peace Square in the 9th district.',
      'móricz zsigmond square': 'Móricz Zsigmond Square - Square in Buda, named after writer Zsigmond Móricz.',
      'kosztolányi dezső square': 'Kosztolányi Dezső Square - Square named after writer Dezső Kosztolányi.',
      'bartók béla avenue': 'Bartók Béla Avenue - Avenue in Buda, named after composer Béla Bartók.',
      'rákóczi avenue': 'Rákóczi Avenue - Major avenue in Pest, named after Prince Francis II Rákóczi.',
      'újpest': 'Újpest - District in northern Pest, industrial and residential area.',
      'kőbánya': 'Kőbánya - District in eastern Pest, known for caves and breweries.',
      'pest': 'Pest - Eastern side of Budapest, flat and commercial center.',
      'buda': 'Buda - Western side of Budapest, hilly and historic, with Castle Hill.',
      'óbuda': 'Óbuda - Old Buda, historic district with Roman ruins and museums.',
      'lipótváros': 'Lipótváros - Leopold Town, historic district in Pest with government buildings.',
      'terézváros': 'Terézváros - Theresa Town, district with Andrássy Avenue and Opera House.',
      'erzsébetváros': 'Erzsébetváros - Elizabeth Town, historic Jewish quarter with Great Synagogue.',
      'józsefváros': 'Józsefváros - Joseph Town, district with museums and universities.',
      'ferencváros': 'Ferencváros - Francis Town, district with Great Market Hall and universities.',
      'belváros': 'Belváros - Inner City, historic center of Pest with shopping streets.',
      'várkerület': 'Várkerület - Castle District, historic area around Buda Castle.',
      'tabán': 'Tabán - Historic district in Buda, now a park area.',
      'rózsadomb': 'Rózsadomb - Rose Hill, upscale residential area in Buda.',
      'sváb hill': 'Sváb Hill - Hill in Buda with residential areas and parks.',
      'jános hill': 'János Hill - Highest point in Budapest, with lookout tower and hiking trails.',
      'normafa': 'Normafa - Popular recreational area in Buda Hills with views and hiking.',
      'hármashatár hill': 'Hármashatár Hill - Hill in Buda with hiking trails and viewpoints.',
      'sas hill': 'Sas Hill - Hill in Buda with nature reserve and hiking trails.',
      'naphegy': 'Naphegy - Sun Hill, residential area in Buda with historic buildings.',
      'óbuda island': 'Óbuda Island - Island in the Danube, recreational area with beaches.',
      'csepel island': 'Csepel Island - Large island in the Danube, industrial and residential area.',
      'háros island': 'Háros Island - Island in the Danube, recreational area.',
      'lágymányos': 'Lágymányos - District in southern Pest, university and residential area.',
      'újlipótváros': 'Újlipótváros - New Leopold Town, Art Nouveau district in Pest.',
      'angyalföld': 'Angyalföld - Angel Land, district in northern Pest.',
      'zugló': 'Zugló - District in eastern Pest, residential and green area.',
      'pesthidegkút': 'Pesthidegkút - District in northern Pest, residential area.',
      'római part': 'Római Part - Roman Beach, recreational area along the Danube.',
      'népliget': 'Népliget - People\'s Park, large park in Pest.',
      'városliget': 'Városliget - City Park, large park with museums, zoo, and recreational facilities.',
      'gellért hill cave': 'Gellért Hill Cave - Cave church and monastery in Gellért Hill.',
      'pálvölgyi cave': 'Pálvölgyi Cave - Show cave in Buda Hills, part of the cave system.',
      'szemlőhegyi cave': 'Szemlőhegyi Cave - Show cave in Buda Hills, part of the cave system.',
      'mátyásföld': 'Mátyásföld - District in eastern Pest, residential area.',
      'rákoskeresztúr': 'Rákoskeresztúr - District in eastern Pest, residential area.',
      'rákospalota': 'Rákospalota - District in eastern Pest, residential area.',
      'rákoshegy': 'Rákoshegy - District in eastern Pest, residential area.',
      'rákosmente': 'Rákosmente - District in eastern Pest, residential area.',
      'pestújhely': 'Pestújhely - District in northern Pest, residential area.',
      'kispest': 'Kispest - District in southern Pest, residential area.',
      'pestszentlőrinc': 'Pestszentlőrinc - District in southern Pest, residential area.',
      'pestszentimre': 'Pestszentimre - District in southern Pest, residential area.',
      'ráckeve': 'Ráckeve - Town south of Budapest, historic area.',
      'szentendre': 'Szentendre - Historic town north of Budapest, artists\' colony.',
      'esztergom': 'Esztergom - Historic town north of Budapest, former capital and archbishopric.',
      'visegrád': 'Visegrád - Historic town north of Budapest, royal residence and castle.',
      'budaörs': 'Budaörs - Town west of Budapest, residential and commercial area.',
      'törökbálint': 'Törökbálint - Town west of Budapest, residential area.',
      'érd': 'Érd - Town south of Budapest, residential and commercial area.',
      'gyál': 'Gyál - Town southeast of Budapest, residential area.',
      'vecsés': 'Vecsés - Town southeast of Budapest, near airport.',
      'dunakeszi': 'Dunakeszi - Town north of Budapest, residential area.',
      'gödöllő': 'Gödöllő - Town northeast of Budapest, with royal palace.',
      'csepel': 'Csepel - District and island, industrial and residential area.',
      'budafok': 'Budafok - District in southern Buda, known for wine cellars.',
      'nagytétény': 'Nagytétény - District in southern Buda, residential area.',
    };

    // Try to find matching description
    for (const [key, description] of Object.entries(descriptions)) {
      if (nameLower.includes(key.toLowerCase())) {
        return description;
      }
    }

    // Fallback descriptions based on tags
    if (tags.historic) {
      const historicType = tags.historic;
      switch (historicType) {
        case 'castle':
          return 'Historic castle, important architectural and cultural landmark in Budapest.';
        case 'monument':
          return 'Historic monument commemorating important events or figures in Hungarian history.';
        case 'memorial':
          return 'Memorial site honoring significant historical events or people.';
        case 'tower':
          return 'Historic tower, architectural landmark with historical significance.';
        case 'ruins':
          return 'Historic ruins, archaeological site preserving ancient structures.';
        case 'archaeological_site':
          return 'Archaeological site with remains from ancient times, important for understanding Budapest\'s history.';
        case 'tomb':
          return 'Historic tomb or burial site, significant cultural and historical monument.';
        case 'church':
          return 'Historic church, important religious and architectural landmark.';
        case 'chapel':
          return 'Historic chapel, small religious building with historical significance.';
        case 'monastery':
          return 'Historic monastery, religious and architectural landmark.';
        case 'synagogue':
          return 'Historic synagogue, important Jewish heritage site.';
        case 'mosque':
          return 'Historic mosque, important Islamic heritage site.';
        case 'palace':
          return 'Historic palace, former royal or noble residence with architectural significance.';
        case 'fort':
          return 'Historic fortification, military structure with defensive importance.';
        case 'city_gate':
          return 'Historic city gate, entrance to the medieval city.';
        case 'wall':
          return 'Historic city wall, defensive structure from medieval times.';
        case 'bridge':
          return 'Historic bridge, important infrastructure connecting Buda and Pest.';
        case 'building':
          return 'Historic building, architecturally significant structure from the past.';
        case 'house':
          return 'Historic house, former residence of important figures or typical of a historical period.';
        case 'museum':
          return 'Museum showcasing historical artifacts, art, or cultural heritage.';
        default:
          return `Historic ${historicType}, important cultural and historical landmark in Budapest.`;
      }
    }

    if (tags.tourism === 'museum') {
      return 'Museum displaying collections of historical, artistic, or cultural significance.';
    }

    if (tags.tourism === 'attraction') {
      return 'Tourist attraction, popular destination for visitors interested in Budapest\'s history and culture.';
    }

    if (tags.tourism === 'monument') {
      return 'Monument commemorating important historical events, figures, or achievements.';
    }

    // Default description
    return 'Historic landmark and cultural site in Budapest, significant for the city\'s heritage and history.';
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

type PersonaKey = 'culture_curator' | 'daily_flow_optimizer' | 'evening_compass' | 'mobility_hacker' | 'local_concierge';

interface PersonaDefinition {
  id: PersonaKey;
  label: string;
  keywords: string[];
  prefix: string;
  suggestions: string[];
  description: string;
  tone: string;
  recommendedPlaybookId?: string;
  fallbackMessage: string;
}

interface PersonaPayload {
  id: PersonaKey;
  name: string;
  tagline: string;
  tone: string;
  recommendedPrompts: string[];
  suggestedPlaybookId?: string;
}

const PERSONA_REGISTRY: Record<PersonaKey, PersonaDefinition> = {
  culture_curator: {
    id: 'culture_curator',
    label: 'Culture Curator',
    keywords: ['castle', 'museum', 'heritage', 'history', 'tour', 'bastion', 'parliament', 'gallery', 'market hall'],
    prefix: 'Culture Curator •',
    suggestions: [
      'Tell me a story about the place'
    ],
    description: 'Story-rich walks, heritage sites, and curated cafés.',
    tone: 'calm',
    recommendedPlaybookId: 'castle-district-heritage',
    fallbackMessage: 'Culture Curator ready. I can line up museums, castles, cafés, and narrated walks across Budapest.'
  },
  daily_flow_optimizer: {
    id: 'daily_flow_optimizer',
    label: 'Daily Flow Optimizer',
    keywords: ['commute', 'office', 'work', 'meeting', 'tram', 'metro', 'transfer', 'pharmacy', 'errand', 'bank'],
    prefix: 'Daily Flow •',
    suggestions: [
      'Show tram delays around me',
      'Find the nearest pharmacy',
      'Plan the fastest commute'
    ],
    description: 'Keeps errands, commutes, and essential stops efficient.',
    tone: 'practical',
    recommendedPlaybookId: 'grand-boulevard-commute',
    fallbackMessage: 'Daily Flow Optimizer online. Ask me for tram schedules, metro transfers, or fast multimodal commutes.'
  },
  evening_compass: {
    id: 'evening_compass',
    label: 'Evening Compass',
    keywords: ['evening', 'night', 'sunset', 'drinks', 'date', 'dinner', 'bar', 'restaurant'],
    prefix: 'Evening Compass •',
    suggestions: [
      'Find riverside bars with music',
      'Plan a golden-hour walk',
      'List late-night food spots'
    ],
    description: 'Golden-hour strolls, skyline views, and night routes.',
    tone: 'vibrant',
    recommendedPlaybookId: 'danube-evening-loop',
    fallbackMessage: 'Evening Compass tuned in. Want riverside walks, bars, or late-night transit tips?'
  },
  mobility_hacker: {
    id: 'mobility_hacker',
    label: 'Mobility Hacker',
    keywords: ['bike', 'bicycle', 'multimodal', 'mode mix', 'wizard', 'bubi', 'scooter'],
    prefix: 'Mobility Hacker •',
    suggestions: [
      'Suggest a bike + tram combo',
      'Find nearby MOL Bubi docks',
      'Compare cycling vs walking time'
    ],
    description: 'Blends cycling, bikeshare, and transit for smart combos.',
    tone: 'energizing',
    fallbackMessage: 'Mobility Hacker here. Ask for bike plus tram combos, MOL Bubi docks, or ways to shave minutes off your ride.'
  },
  local_concierge: {
    id: 'local_concierge',
    label: 'Local Concierge',
    keywords: [],
    prefix: 'City Concierge •',
    suggestions: [
      'Find what’s near me',
      'Plan a scenic walk',
      'Show weather-friendly plans'
    ],
    description: 'Friendly default guidance when intent is broad.',
    tone: 'balanced',
    fallbackMessage: 'City Concierge at your service. Ask me for nearby finds, scenic walks, or live transit context anywhere in Budapest.'
  }
};

const PERSONA_LIST = Object.values(PERSONA_REGISTRY);

// AI Service with specialized tools
class AIService {
  async processQuery(message: string, userLocation?: { lat: number; lng: number }): Promise<{
    text: string;
    markers: any[];
    route?: any;
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
        console.error('OpenAI error:', error);
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
    markers: any[];
    route?: any;
  }> {
    try {
      // ALWAYS use user's current location as the start point
      // Ignore the 'from' parameter and always use userLocation
      const startLat = userLocation.lat;
      const startLng = userLocation.lng;
      
      console.log(`🗺️ Planning route from user's current location:`);
      console.log(`   Start (User Location): [${startLat}, ${startLng}]`);
      
      // Geocode the destination
      const toResult = await geospatialService.geocode(to);
      if (!toResult) {
      return {
          text: `I couldn't find the destination "${to}". Please provide a valid address or landmark.`,
          markers: []
        };
      }

      console.log(`   Destination: [${toResult.lat}, ${toResult.lng}] (${toResult.display_name})`);

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
              console.warn(`⚠️ Swapping coordinates: [${lat}, ${lng}] -> [${lng}, ${lat}]`);
              [lat, lng] = [lng, lat];
            }
            
            // Final validation - coordinates should be in Hungary/Budapest area
            if (lat < 45 || lat > 49 || lng < 16 || lng > 23) {
              console.error(`❌ Invalid coordinates for Budapest: [${lat}, ${lng}]`);
            }
            
            return [lat, lng]; // Return as [lat, lng]
          }
          return coord;
        });

        // Log first and last coordinates for debugging
        if (formattedGeometry.length > 0) {
          console.log(`✅ Route geometry: ${formattedGeometry.length} points`);
          console.log(`   First: [${formattedGeometry[0][0]}, ${formattedGeometry[0][1]}]`);
          console.log(`   Last: [${formattedGeometry[formattedGeometry.length - 1][0]}, ${formattedGeometry[formattedGeometry.length - 1][1]}]`);
        }

        // Validate destination coordinates before creating marker
        const destLat = toResult.lat;
        const destLng = toResult.lng;
        
        // Only add destination marker if coordinates are valid
        const markers: any[] = [];
        if (destLat >= 47.0 && destLat <= 48.0 && destLng >= 18.5 && destLng <= 19.5) {
          markers.push({
            position: [destLat, destLng], // [lat, lng] format
            title: toResult.display_name,
            description: 'Destination',
            type: 'destination'
          });
          console.log(`✅ Destination marker added: [${destLat}, ${destLng}]`);
        } else {
          console.error(`❌ Destination coordinates invalid: [${destLat}, ${destLng}] - NOT adding marker`);
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
      const fallbackMarkers: any[] = [];
      if (destLat >= 47.0 && destLat <= 48.0 && destLng >= 18.5 && destLng <= 19.5) {
        fallbackMarkers.push({
          position: [destLat, destLng], // [lat, lng] format
          title: toResult.display_name,
          description: 'Destination',
          type: 'destination'
        });
        console.log(`✅ Fallback destination marker added: [${destLat}, ${destLng}]`);
      } else {
        console.error(`❌ Fallback destination coordinates invalid: [${destLat}, ${destLng}] - NOT adding marker`);
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

  private async handleCultureCuratorQuery(message: string, userLocation?: { lat: number; lng: number }): Promise<{
    text: string;
    markers: any[];
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
          const markers = historicalPlaces.slice(0, 5).map((place: any) => {
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
            nearest.lat || nearest.center?.lat,
            nearest.lon || nearest.center?.lon
          ) : 0;

          return {
            text: `I found ${historicalPlaces.length} historical sites near you. The closest is ${nearestName}, ${distance.toFixed(1)} km away. ${geospatialService.getHistoricalPlaceDescription(nearestName, nearest.tags || {})} I've marked the most significant ones on the map.`,
            markers
          };
        }
      } catch (error) {
        console.error('Historical places query error:', error);
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
    if (['pharmacy', 'pharmacies', 'bank', 'atm', 'hospital', 'clinic', 'gas', 'parking'].includes(normalized)) {
      return this.getPersonaById('daily_flow_optimizer');
    }
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

  private applyPersona<T extends { text: string; markers: any[]; route?: any }>(
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

const aiService = new AIService();

// Routes
app.get('/api/health', (req, res) => {
  const openRouteKey = process.env.OPENROUTESERVICE_API_KEY;
  res.json({ 
    status: 'OK', 
    message: 'AI Smart City Backend is running',
    timestamp: new Date().toISOString(),
    features: {
      geocoding: true,
      places: true,
      routes: true,
      ai: !!openai,
      publicTransport: true,
      sharedMobility: true,
      weather: true,
      multiModalRouting: true,
      realTimeUpdates: true,
      openRouteService: !!openRouteKey,
      openRouteServiceKeyLength: openRouteKey ? openRouteKey.length : 0,
      bkkApi: process.env.BKK_API_ENABLED === 'true',
      molBubiApi: process.env.MOL_BUBI_API_ENABLED === 'true'
    },
    version: '3.0.0',
    phase: 'Phase 3 - Advanced Features'
  });
});

// Neighborhood playbooks
app.get('/api/playbooks', (req, res) => {
  const playbooks = neighborhoodPlaybookService.getSummaries();
  res.json({
    playbooks,
    count: playbooks.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/playbooks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const playbook = neighborhoodPlaybookService.getPlaybookById(id);

    if (!playbook) {
      return res.status(404).json({ error: 'Playbook not found', id });
    }

    const userLat = req.query.userLat ? parseFloat(req.query.userLat as string) : undefined;
    const userLng = req.query.userLng ? parseFloat(req.query.userLng as string) : undefined;
    let primaryRoute = playbook.primaryRoute;

    if (
      typeof userLat === 'number' &&
      typeof userLng === 'number' &&
      !Number.isNaN(userLat) &&
      !Number.isNaN(userLng)
    ) {
      if (isWithinBudapest(userLat, userLng)) {
        primaryRoute = await neighborhoodPlaybookService.personalizeRoute(playbook, userLat, userLng);
      } else {
        console.warn(`⚠️ Playbook personalization requested outside Budapest: [${userLat}, ${userLng}]`);
      }
    }

    res.json({
      playbook: {
        ...playbook,
        primaryRoute
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Playbook detail error:', error);
    res.status(500).json({
      error: 'Failed to load playbook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enhanced chat endpoint with AI integration
app.post('/api/chat', async (req, res) => {
  const { message, userLocation } = req.body;
  
  // Set a longer timeout for chat requests (geocoding + routing can take time)
  req.setTimeout(30000); // 30 seconds
  
  try {
    const result = await aiService.processQuery(message, userLocation);
    
    const response = {
      id: Date.now().toString(),
      text: result.text,
      sender: 'ai',
      timestamp: new Date().toISOString(),
      markers: result.markers,
      route: result.route,
      persona: result.persona,
      suggestions: result.suggestions
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

// Real places search endpoint - STRICTLY limited to Budapest
app.get('/api/places/search', async (req, res) => {
  const { query, lat, lng, radius = 1000 } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const searchLat = parseFloat(lat as string);
    const searchLng = parseFloat(lng as string);
    
    // STRICT: Validate search location is in Budapest
    if (!isWithinBudapest(searchLat, searchLng)) {
      console.warn(`⚠️ Place search requested outside Budapest: [${searchLat}, ${searchLng}]`);
      // Use Budapest center instead
      const budapestCenter = { lat: 47.4979, lng: 19.0402 };
      console.log(`   Redirecting search to Budapest center: [${budapestCenter.lat}, ${budapestCenter.lng}]`);
      
      const places = await geospatialService.searchPlaces(
        query as string, 
        budapestCenter.lat, 
        budapestCenter.lng,
        parseInt(radius as string)
      );
      
      const formattedPlaces = places.map((place: any) => {
        const rawCoord: [number, number] | null = [
          place.lat || place.center?.lat,
          place.lon || place.center?.lon
        ];
        const coords = normalizeCoordinate(rawCoord as any);
        if (!coords) {
          return null;
        }

        return {
          id: place.id,
          name: place.tags?.name || 'Unknown Place',
          type: place.tags?.amenity || 'place',
          position: coords,
          description: place.tags?.opening_hours || place.tags?.cuisine || 'No additional info',
          distance: geospatialService.calculateDistance(
            budapestCenter.lat, 
            budapestCenter.lng,
            coords[0],
            coords[1]
          ).toFixed(1) + ' km'
        };
      }).filter((place: any) => place !== null);

      return res.json({
        places: formattedPlaces,
        query: query,
        location: budapestCenter,
        count: formattedPlaces.length,
        note: 'Search limited to Budapest area'
      });
    }

    const places = await geospatialService.searchPlaces(
      query as string, 
      searchLat, 
      searchLng,
      parseInt(radius as string)
    );

    const formattedPlaces = places.map((place: any) => {
      const rawCoord: [number, number] | null = [
        place.lat || place.center?.lat,
        place.lon || place.center?.lon
      ];
      const coords = normalizeCoordinate(rawCoord as any);
      if (!coords) {
        console.warn(`⚠️ Filtered out place outside Budapest:`, rawCoord);
        return null;
      }
      
      return {
        id: place.id,
        name: place.tags?.name || 'Unknown Place',
        type: place.tags?.amenity || 'place',
        position: coords,
        description: place.tags?.opening_hours || place.tags?.cuisine || 'No additional info',
        distance: geospatialService.calculateDistance(
          searchLat, 
          searchLng,
          coords[0],
          coords[1]
        ).toFixed(1) + ' km'
      };
    }).filter((place: any) => place !== null);

    res.json({
      places: formattedPlaces,
      query: query,
      location: { lat: searchLat, lng: searchLng },
      count: formattedPlaces.length,
      note: 'All results are limited to Budapest area'
    });
  } catch (error) {
    console.error('Places search error:', error);
    res.status(500).json({ 
      error: 'Failed to search places',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all nearby places grouped by category
app.get('/api/places/nearby', async (req, res) => {
  const { lat, lng, radius = 1000 } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const searchLat = parseFloat(lat as string);
    const searchLng = parseFloat(lng as string);
    
    // STRICT: Validate search location is in Budapest
    if (searchLat < 47.3 || searchLat > 47.7 || searchLng < 18.9 || searchLng > 19.4) {
      return res.status(400).json({ error: 'Location must be within Budapest area' });
    }

    // Fetch places for multiple categories
    const categories = ['pharmacy', 'hospital', 'restaurant', 'cafe', 'bank', 'atm', 'clinic'];
    const allPlaces: any[] = [];
    
    // Fetch places for each category in parallel
    await Promise.all(
      categories.map(async (category) => {
        try {
          const places = await geospatialService.searchPlaces(
            category,
            searchLat,
            searchLng,
            parseInt(radius as string)
          );
          
          const formattedPlaces = places.map((place: any) => {
            const placeLat = place.lat || place.center?.lat;
            const placeLng = place.lon || place.center?.lon;
            
            // STRICT: Final validation - ensure place is in Budapest
            if (!placeLat || !placeLng) {
              return null;
            }
            
            if (placeLat < 47.3 || placeLat > 47.7 || placeLng < 18.9 || placeLng > 19.4) {
              return null;
            }
            
            return {
              id: place.id,
              name: place.tags?.name || 'Unknown Place',
              type: place.tags?.amenity || category,
              position: [placeLat, placeLng],
              description: place.tags?.opening_hours || place.tags?.cuisine || 'No additional info',
              distance: geospatialService.calculateDistance(
                searchLat,
                searchLng,
                placeLat,
                placeLng
              ).toFixed(1) + ' km'
            };
          }).filter((place: any) => place !== null);
          
          allPlaces.push(...formattedPlaces);
        } catch (err) {
          console.warn(`Failed to fetch ${category} places:`, err);
        }
      })
    );
    
    // Sort by distance
    allPlaces.sort((a, b) => {
      const distA = parseFloat(a.distance.replace(' km', '')) || 999;
      const distB = parseFloat(b.distance.replace(' km', '')) || 999;
      return distA - distB;
    });

    res.json({
      places: allPlaces,
      location: { lat: searchLat, lng: searchLng },
      count: allPlaces.length,
      categories: categories
    });
  } catch (error) {
    console.error('Nearby places error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch nearby places',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Historical places endpoint
app.get('/api/places/historical', async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const searchLat = parseFloat(lat as string);
    const searchLng = parseFloat(lng as string);
    
    // STRICT: Validate search location is in Budapest
    if (searchLat < 47.3 || searchLat > 47.7 || searchLng < 18.9 || searchLng > 19.4) {
      console.warn(`⚠️ Historical places search requested outside Budapest: [${searchLat}, ${searchLng}]`);
      const budapestCenter = { lat: 47.4979, lng: 19.0402 };
      
      const places = await geospatialService.getHistoricalPlaces(
        budapestCenter.lat, 
        budapestCenter.lng,
        parseInt(radius as string)
      );
      
      const formattedPlaces = places.map((place: any) => {
        const placeLat = place.lat || place.center?.lat;
        const placeLng = place.lon || place.center?.lon;
        
        if (!placeLat || !placeLng) return null;
        
        if (placeLat < 47.3 || placeLat > 47.7 || placeLng < 18.9 || placeLng > 19.4) {
          return null;
        }
        
        const name = place.tags?.name || 'Unknown Historical Place';
        const description = geospatialService.getHistoricalPlaceDescription(name, place.tags || {});
        
        return {
          id: place.id,
          name: name,
          type: place.tags?.historic || place.tags?.tourism || 'historical',
          position: [placeLat, placeLng],
          description: description,
          distance: geospatialService.calculateDistance(
            budapestCenter.lat, 
            budapestCenter.lng,
            placeLat,
            placeLng
          ).toFixed(1) + ' km',
          historicType: place.tags?.historic,
          tourismType: place.tags?.tourism
        };
      }).filter((place: any) => place !== null);

      return res.json({
        places: formattedPlaces,
        location: budapestCenter,
        count: formattedPlaces.length,
        note: 'Search limited to Budapest area'
      });
    }

    const places = await geospatialService.getHistoricalPlaces(
      searchLat, 
      searchLng,
      parseInt(radius as string)
    );

    const formattedPlaces = places.map((place: any) => {
      const placeLat = place.lat || place.center?.lat;
      const placeLng = place.lon || place.center?.lon;
      
      if (!placeLat || !placeLng) return null;
      
      if (placeLat < 47.3 || placeLat > 47.7 || placeLng < 18.9 || placeLng > 19.4) {
        return null;
      }
      
      const name = place.tags?.name || 'Unknown Historical Place';
      const description = geospatialService.getHistoricalPlaceDescription(name, place.tags || {});
      
      return {
        id: place.id,
        name: name,
        type: place.tags?.historic || place.tags?.tourism || 'historical',
        position: [placeLat, placeLng],
        description: description,
        distance: geospatialService.calculateDistance(
          searchLat, 
          searchLng,
          placeLat,
          placeLng
        ).toFixed(1) + ' km',
        historicType: place.tags?.historic,
        tourismType: place.tags?.tourism
      };
    }).filter((place: any) => place !== null);

    res.json({
      places: formattedPlaces,
      location: { lat: searchLat, lng: searchLng },
      count: formattedPlaces.length,
      note: 'All results are limited to Budapest area'
    });
  } catch (error) {
    console.error('Historical places error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch historical places',
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

// Enhanced routes endpoint with multiple transport options
app.get('/api/routes', async (req, res) => {
  const { from, to, mode = 'walking' } = req.query;
  
  try {
    // Validate that 'from' parameter is provided (should be user's current location)
    if (!from) {
      return res.status(400).json({ 
        error: 'Start location (from) is required. Please provide your current location.' 
      });
    }
    
    const parseCoordinateString = (value?: string | string[] | null): [number, number] | null => {
      if (!value) return null;
      const raw = value.toString().split(',').map(Number);
      if (raw.length !== 2 || raw.some((num) => Number.isNaN(num))) {
        return null;
      }
      const normalized = normalizeCoordinate([raw[0], raw[1]]);
      return normalized;
    };

    const fromCoords = parseCoordinateString(from as string);
    if (!fromCoords) {
      return res.status(400).json({ error: 'Invalid start location format. Expected: lat,lng within Budapest.' });
    }

    const toCoords = parseCoordinateString(to as string) || [47.5079, 19.0502];

    if (mode === 'public_transport') {
      // Public transport route
      const transportRoute = await publicTransportService.planJourney(
        fromCoords,
        toCoords
      );
      
      if (transportRoute) {
        // First pass: Get geometry for transport segments (so we can use them for walking segments)
        const stepsWithTransportGeometry = await Promise.all(
          transportRoute.steps.map(async (step) => {
            // For public transport segments without geometry, try to get route shape
            if ((step.type === 'bus' || step.type === 'tram' || step.type === 'metro') && 
                (!step.geometry || step.geometry.length === 0) && step.route) {
              try {
                const routeDetail = await publicTransportService.getRouteDetails(step.route);
                if (routeDetail?.shape && routeDetail.shape.length > 0) {
                  console.log(`✅ Using route shape for ${step.route}`);
                  return {
                    ...step,
                    geometry: routeDetail.shape
                  };
                }
              } catch (e) {
                console.warn(`⚠️ Could not fetch route shape for ${step.route}`);
              }
            }
            return step;
          })
        );
        
        // Second pass: Get proper walking routes for walking segments using OpenRouteService
        const processedSteps = await Promise.all(
          stepsWithTransportGeometry.map(async (step, index) => {
            // For walking segments, ALWAYS use OpenRouteService to get proper walking routes
            if (step.type === 'walk') {
              // Try to get coordinates from previous/next steps
              let stepFromCoords: [number, number] | null = null;
              let stepToCoords: [number, number] | null = null;
              
              // Try to get from coordinates from previous step or journey start
              if (index === 0) {
                stepFromCoords = fromCoords; // Use journey start
              } else {
                const prevStep = stepsWithTransportGeometry[index - 1];
                if (prevStep.geometry && prevStep.geometry.length > 0) {
                  const lastCoord = prevStep.geometry[prevStep.geometry.length - 1];
                  if (Array.isArray(lastCoord) && lastCoord.length >= 2) {
                    stepFromCoords = [lastCoord[0], lastCoord[1]];
                  }
                }
              }
              
              // Try to get to coordinates from next step or journey end
              if (index === stepsWithTransportGeometry.length - 1) {
                stepToCoords = toCoords; // Use journey end
              } else {
                const nextStep = stepsWithTransportGeometry[index + 1];
                if (nextStep.geometry && nextStep.geometry.length > 0) {
                  const firstCoord = nextStep.geometry[0];
                  if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
                    stepToCoords = [firstCoord[0], firstCoord[1]];
                  }
                }
              }
              
              // If we have both coordinates, get proper walking route
              if (stepFromCoords && stepToCoords) {
                try {
                  const walkingRoute = await routingService.getWalkingRoute(stepFromCoords, stepToCoords);
                  if (walkingRoute && walkingRoute.geometry && walkingRoute.geometry.length > 0) {
                    console.log(`✅ Got proper walking route for step ${index + 1} (${step.from} to ${step.to})`);
                    return {
                      ...step,
                      geometry: walkingRoute.geometry
                    };
                  }
                } catch (e) {
                  console.warn(`⚠️ Failed to get walking route for step ${index + 1}:`, e);
                }
              }
              
              // If we can't get proper route, skip geometry (don't use straight lines through water!)
              console.warn(`⚠️ Walking step "${step.from}" to "${step.to}" - no valid geometry, skipping`);
              return {
                ...step,
                geometry: undefined
              };
            }
            
            // Validate geometry coordinates are in Budapest (for all step types)
            if (step.geometry && step.geometry.length > 0) {
              const validGeometry = step.geometry.filter((coord: number[]) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const lat = coord[0];
                  const lng = coord[1];
                  // Validate coordinates are in Budapest
                  if (lat >= 47.0 && lat <= 48.0 && lng >= 18.5 && lng <= 19.5) {
                    return true;
                  }
                  // Try swapping if coordinates seem reversed
                  if (lng >= 47.0 && lng <= 48.0 && lat >= 18.5 && lat <= 19.5) {
                    console.warn(`⚠️ Swapping coordinates: [${lat}, ${lng}] -> [${lng}, ${lat}]`);
                    coord[0] = lng;
                    coord[1] = lat;
                    return true;
                  }
                  return false;
                }
                return false;
              });
              
              if (validGeometry.length === 0) {
                console.warn(`⚠️ Step geometry invalid - all coordinates outside Budapest`);
                return {
                  ...step,
                  geometry: undefined
                };
              }
              
              return {
                ...step,
                geometry: validGeometry
              };
            }
            
            return step;
          })
        );
        
        // Build combined geometry from valid step geometries
        const combinedGeometry: number[][] = [];
        processedSteps.forEach((step) => {
          if (step.geometry && step.geometry.length > 0) {
            if (combinedGeometry.length === 0) {
              combinedGeometry.push(...step.geometry);
            } else {
              // Skip first point if it's the same as last point
              const lastPoint = combinedGeometry[combinedGeometry.length - 1];
              const firstPoint = step.geometry[0];
              const isDuplicate = Math.abs(lastPoint[0] - firstPoint[0]) < 0.0001 && 
                                  Math.abs(lastPoint[1] - firstPoint[1]) < 0.0001;
              
              if (isDuplicate) {
                combinedGeometry.push(...step.geometry.slice(1));
              } else {
                combinedGeometry.push(...step.geometry);
              }
            }
          }
        });
        
        // If no valid geometry, use fallback walking route
        let finalGeometry = combinedGeometry.length > 0 ? combinedGeometry : undefined;
        if (!finalGeometry || finalGeometry.length === 0) {
          console.warn('⚠️ No valid geometry from steps, using fallback walking route');
          const fallbackGeometry = await routingService.getWalkingRoute(
            fromCoords,
            toCoords
          );
          finalGeometry = fallbackGeometry?.geometry || [fromCoords, toCoords];
        }
        
        const distanceLabel = transportRoute.steps.reduce((sum, step) => sum + (step.distance || 0), 0) > 0
          ? routingService.formatDistance(transportRoute.steps.reduce((sum, step) => sum + (step.distance || 0), 0))
          : `${(transportRoute.duration * 0.4).toFixed(1)} km`;

        res.json({
          id: Date.now().toString(),
          mode: 'public_transport',
          from: from,
          to: to,
          distance: distanceLabel,
          duration: `${transportRoute.duration} minutes`,
          transfers: transportRoute.transfers,
          steps: processedSteps.map(step => ({
            instruction: `${step.type}: ${step.from} to ${step.to}`,
            distance: step.distance ? `${step.distance}m` : 'N/A',
            type: step.type,
            route: step.route,
            geometry: step.geometry // Include step geometry for segmented display
          })),
          polyline: finalGeometry // Combined geometry for full route
        });
      } else {
        res.status(404).json({ error: 'No public transport route found' });
      }
    } else if (mode === 'cycling') {
      // Cycling route using OpenRouteService or fallback
      console.log(`🚴 Cycling route: From user location [${fromCoords[0]}, ${fromCoords[1]}] to [${toCoords[0]}, ${toCoords[1]}]`);
      
      const cyclingRoute = await routingService.getCyclingRoute(
        [fromCoords[0], fromCoords[1]],
        [toCoords[0], toCoords[1]]
      );
      
      if (cyclingRoute) {
        // Ensure geometry is in [lat, lng] format for frontend
        const formattedGeometry = cyclingRoute.geometry.map((coord: number[]) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            // Check if we need to swap [lng, lat] to [lat, lng]
            if (coord[0] > coord[1] && coord[0] < 30 && coord[1] > 40) {
              return [coord[1], coord[0]];
            }
            return [coord[0], coord[1]];
          }
          return coord;
        });

        res.json({
          id: Date.now().toString(),
          mode: 'cycling',
          from: from,
          to: to,
          distance: routingService.formatDistance(cyclingRoute.distance),
          duration: routingService.formatDuration(cyclingRoute.duration),
          steps: cyclingRoute.instructions.map((instruction, index) => ({
            instruction,
            distance: index < cyclingRoute.instructions.length - 1 ? 'N/A' : routingService.formatDistance(cyclingRoute.distance),
            type: 'cycling'
          })),
          polyline: formattedGeometry.length > 0 ? formattedGeometry : cyclingRoute.geometry
        });
      } else {
        res.status(404).json({ error: 'No cycling route found' });
      }
    } else {
      // Walking route using OpenRouteService or fallback
      console.log(`🚶 Walking route: From user location [${fromCoords[0]}, ${fromCoords[1]}] to [${toCoords[0]}, ${toCoords[1]}]`);
      
      const walkingRoute = await routingService.getWalkingRoute(
        [fromCoords[0], fromCoords[1]],
        [toCoords[0], toCoords[1]]
      );
      
      if (walkingRoute) {
        // Ensure geometry is in [lat, lng] format for frontend
        const formattedGeometry = walkingRoute.geometry.map((coord: number[]) => {
          // If coordinate is [lng, lat], swap to [lat, lng]
          // OpenRouteService returns [lng, lat], but frontend expects [lat, lng]
          if (Array.isArray(coord) && coord.length >= 2) {
            // Check if we need to swap (lng is typically larger than lat for Budapest area)
            // Budapest lat ~47, lng ~19, so if first > second, it's likely [lng, lat]
            if (coord[0] > coord[1] && coord[0] < 30 && coord[1] > 40) {
              return [coord[1], coord[0]]; // Swap [lng, lat] to [lat, lng]
            }
            return [coord[0], coord[1]]; // Already [lat, lng]
          }
          return coord;
        });

        res.json({
          id: Date.now().toString(),
          mode: 'walking',
          from: from,
          to: to,
          distance: routingService.formatDistance(walkingRoute.distance),
          duration: routingService.formatDuration(walkingRoute.duration),
          steps: walkingRoute.instructions.map((instruction, index) => ({
            instruction,
            distance: index < walkingRoute.instructions.length - 1 ? 'N/A' : routingService.formatDistance(walkingRoute.distance),
            type: 'walking'
          })),
          polyline: formattedGeometry.length > 0 ? formattedGeometry : walkingRoute.geometry
        });
      } else {
        res.status(404).json({ error: 'No walking route found' });
      }
    }
  } catch (error) {
    console.error('Route planning error:', error);
    res.status(500).json({ 
      error: 'Failed to plan route',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Public transport endpoints
app.get('/api/transport/stops', async (req, res) => {
  const { lat, lng, radius = 500 } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const stops = await publicTransportService.getNearbyStops(
      parseFloat(lat as string),
      parseFloat(lng as string),
      parseInt(radius as string)
    );

    res.json({
      stops,
      count: stops.length,
      location: { lat, lng },
      radius: parseInt(radius as string)
    });
  } catch (error) {
    console.error('Transport stops error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transport stops',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/transport/arrivals/:stopId', async (req, res) => {
  const { stopId } = req.params;
  
  try {
    const arrivals = await publicTransportService.getStopArrivals(stopId);
    res.json({
      stopId,
      arrivals,
      count: arrivals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Transport arrivals error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch arrivals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test BKK API endpoint
app.get('/api/transport/test-bkk', async (req, res) => {
  try {
    const { lat = 47.4979, lng = 19.0402, radius = 500 } = req.query;
    
    const testLat = parseFloat(lat as string);
    const testLng = parseFloat(lng as string);
    const testRadius = parseInt(radius as string);

    // Check configuration
    const config = {
      apiEnabled: process.env.BKK_API_ENABLED === 'true',
      hasApiKey: !!process.env.BKK_API_KEY,
      apiKeyLength: process.env.BKK_API_KEY?.length || 0,
      apiBaseUrl: 'https://go.bkk.hu/api/query/v1/ws/otp/api/where'
    };

    const results: any = {
      config,
      testLocation: { lat: testLat, lng: testLng, radius: testRadius },
      timestamp: new Date().toISOString()
    };

    // Test 1: Check if API is enabled
    if (!config.apiEnabled) {
      results.status = 'disabled';
      results.message = 'BKK API is disabled. Set BKK_API_ENABLED=true to enable.';
      results.recommendation = 'Add BKK_API_ENABLED=true to your .env file';
      return res.json(results);
    }

    // Test 2: Check if API key exists
    if (!config.hasApiKey) {
      results.status = 'no_key';
      results.message = 'BKK API key is missing.';
      results.recommendation = 'Add BKK_API_KEY=your_key_here to your .env file';
      return res.json(results);
    }

    // Test 3: Try to fetch real stops
    try {
      const stops = await publicTransportService.getNearbyStops(testLat, testLng, testRadius);
      
      results.status = 'success';
      results.message = 'BKK API is working correctly!';
      results.stopsFound = stops.length;
      results.sampleStops = stops.slice(0, 3).map((stop: any) => ({
        name: stop.name,
        type: stop.type,
        routes: stop.routes,
        position: stop.position
      }));
      results.allStops = stops.map((stop: any) => ({
        id: stop.id,
        name: stop.name,
        type: stop.type,
        routes: stop.routes
      }));

      // Test 4: Try to get arrivals for first stop (if available)
      if (stops.length > 0) {
        try {
          const arrivals = await publicTransportService.getStopArrivals(stops[0].id);
          results.arrivalsTest = {
            stopId: stops[0].id,
            stopName: stops[0].name,
            arrivalsFound: arrivals.length,
            sampleArrivals: arrivals.slice(0, 3)
          };
        } catch (arrivalError: any) {
          results.arrivalsTest = {
            error: arrivalError.message,
            note: 'Arrivals test failed, but stops retrieval works'
          };
        }
      }

    } catch (apiError: any) {
      results.status = 'api_error';
      results.message = 'BKK API call failed';
      results.error = {
        message: apiError.message,
        code: apiError.code,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        responseData: apiError.response?.data
      };
      
      if (apiError.response?.status === 401 || apiError.response?.status === 403) {
        results.recommendation = 'API key may be invalid or not activated. BKK requires 2 days for activation.';
      } else if (apiError.response?.status === 429) {
        results.recommendation = 'Rate limit exceeded. Please wait before trying again.';
      } else {
        results.recommendation = 'Check your API key and network connection.';
      }
    }

    res.json(results);
  } catch (error) {
    console.error('BKK API test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test endpoint error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/transport/disruptions', async (req, res) => {
  try {
    const disruptions = await publicTransportService.getDisruptions();
    res.json({
      disruptions,
      count: disruptions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Transport disruptions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch disruptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get vehicles for a stop
app.get('/api/transport/vehicles/:stopId', async (req, res) => {
  try {
    const { stopId } = req.params;
    const vehicles = await publicTransportService.getVehiclesForStop(stopId);
    res.json({
      vehicles,
      count: vehicles.length,
      stopId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Transport vehicles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch vehicles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get route details
app.get('/api/transport/route/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const routeDetails = await publicTransportService.getRouteDetails(routeId);
    
    if (!routeDetails) {
      return res.status(404).json({ 
        error: 'Route not found',
        routeId 
      });
    }

    res.json({
      route: routeDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Route details error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch route details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get trip information
app.get('/api/transport/trip/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const tripInfo = await publicTransportService.getTripInfo(tripId);
    
    if (!tripInfo) {
      return res.status(404).json({ 
        error: 'Trip not found',
        tripId 
      });
    }

    res.json({
      trip: tripInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Trip info error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trip information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Shared mobility endpoints
app.get('/api/mobility/bikes', async (req, res) => {
  const { lat, lng, radius = 1000 } = req.query;
  
  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const bikeStations = await sharedMobilityService.getNearbyBikeStations(
      parseFloat(lat as string),
      parseFloat(lng as string),
      parseInt(radius as string)
    );

    res.json({
      stations: bikeStations,
      count: bikeStations.length,
      location: { lat, lng },
      radius: parseInt(radius as string)
    });
  } catch (error) {
    console.error('Bike stations error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bike stations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/mobility/summary', async (req, res) => {
  try {
    const summary = await sharedMobilityService.getBikeAvailabilitySummary();
    res.json({
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Bike summary error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bike summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Weather endpoints
app.get('/api/weather/current', async (req, res) => {
  try {
    const weather = await weatherService.getCurrentWeather();
    if (weather) {
      const context = weatherService.getWeatherContext(weather);
      res.json({
        weather,
        context,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
  } catch (error) {
    console.error('Weather error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/weather/forecast', async (req, res) => {
  try {
    const forecast = await weatherService.getWeatherForecast();
    res.json({
      forecast,
      count: forecast.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Weather forecast error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather forecast',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/weather/alerts', async (req, res) => {
  try {
    const alerts = await weatherService.getWeatherAlerts();
    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Weather alerts error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Dynamic City Moodboard endpoint
app.get('/api/moodboard', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const userLocation = lat && lng 
      ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
      : undefined;

    if (userLocation && !isWithinBudapest(userLocation.lat, userLocation.lng)) {
      console.warn(`⚠️ Moodboard requested outside Budapest: [${userLocation.lat}, ${userLocation.lng}]`);
      // Still generate moodboard but without location-specific features
      const moodboard = await moodboardService.generateMoodboard();
      return res.json({
        moodboard,
        timestamp: new Date().toISOString(),
        note: 'Location outside Budapest - general suggestions only'
      });
    }

    const moodboard = await moodboardService.generateMoodboard(userLocation);
    res.json({
      moodboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Moodboard error:', error);
    res.status(500).json({ 
      error: 'Failed to generate moodboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Augmented Map Stories endpoints
app.get('/api/stories', (req, res) => {
  try {
    const { category } = req.query;
    const stories = category
      ? storyService.getStoriesByCategory(category as any)
      : storyService.getAllStories();
    
    res.json({
      stories,
      count: stories.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stories list error:', error);
    res.status(500).json({
      error: 'Failed to fetch stories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/stories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const story = storyService.getStoryById(id);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found', id });
    }
    
    res.json({
      story,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Story detail error:', error);
    res.status(500).json({
      error: 'Failed to fetch story',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/stories/near-route', (req, res) => {
  try {
    const { polyline, maxDistance = 500 } = req.body;
    
    if (!polyline || !Array.isArray(polyline) || polyline.length < 2) {
      return res.status(400).json({
        error: 'Invalid route polyline. Expected array of [lat, lng] coordinates.'
      });
    }

    // Validate coordinates are in Budapest
    const invalidCoords = polyline.some((coord: any) => {
      if (!Array.isArray(coord) || coord.length < 2) return true;
      const [lat, lng] = coord;
      return !isWithinBudapest(lat, lng);
    });

    if (invalidCoords) {
      return res.status(400).json({
        error: 'Route coordinates must be within Budapest area'
      });
    }

    const triggers = storyService.getStoriesNearRoute(polyline, maxDistance);
    
    res.json({
      triggers,
      count: triggers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stories near route error:', error);
    res.status(500).json({
      error: 'Failed to find stories near route',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/stories/near-point', (req, res) => {
  try {
    const { lat, lng, radius = 1000 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const pointLat = parseFloat(lat as string);
    const pointLng = parseFloat(lng as string);
    
    if (!isWithinBudapest(pointLat, pointLng)) {
      return res.status(400).json({ error: 'Point must be within Budapest area' });
    }

    const stories = storyService.getStoriesNearPoint(
      [pointLat, pointLng],
      parseInt(radius as string)
    );
    
    res.json({
      stories,
      count: stories.length,
      location: { lat: pointLat, lng: pointLng },
      radius: parseInt(radius as string),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stories near point error:', error);
    res.status(500).json({
      error: 'Failed to find stories near point',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// Phase 5: Community & Safety Network
// ============================================

// Community Confidence Signals - Submit feedback
app.post('/api/community/feedback', (req, res) => {
  try {
    const { routeId, routeType, sentiment, reliability, comment, userId } = req.body;

    if (!routeId || !routeType || !sentiment || !reliability) {
      return res.status(400).json({ error: 'Missing required fields: routeId, routeType, sentiment, reliability' });
    }

    if (!['bus', 'tram', 'metro', 'trolley'].includes(routeType)) {
      return res.status(400).json({ error: 'Invalid routeType. Must be: bus, tram, metro, or trolley' });
    }

    if (!['positive', 'neutral', 'negative'].includes(sentiment)) {
      return res.status(400).json({ error: 'Invalid sentiment. Must be: positive, neutral, or negative' });
    }

    if (reliability < 1 || reliability > 5) {
      return res.status(400).json({ error: 'Reliability must be between 1 and 5' });
    }

    const feedback = communityService.submitFeedback({
      routeId,
      routeType,
      sentiment,
      reliability,
      comment,
      userId
    });

    res.json({
      feedback,
      message: 'Feedback submitted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Community feedback error:', error);
    res.status(500).json({
      error: 'Failed to submit feedback',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get confidence signals for a route
app.get('/api/community/confidence/:routeType/:routeId', (req, res) => {
  try {
    const { routeType, routeId } = req.params;

    if (!['bus', 'tram', 'metro', 'trolley'].includes(routeType)) {
      return res.status(400).json({ error: 'Invalid routeType' });
    }

    const confidence = communityService.getRouteConfidence(routeId, routeType as any);

    if (!confidence) {
      return res.status(404).json({ 
        error: 'No confidence data available for this route',
        routeId,
        routeType
      });
    }

    res.json({
      confidence,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Route confidence error:', error);
    res.status(500).json({
      error: 'Failed to get route confidence',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get confidence signals for multiple routes
app.post('/api/community/confidence/batch', (req, res) => {
  try {
    const { routes } = req.body;

    if (!Array.isArray(routes) || routes.length === 0) {
      return res.status(400).json({ error: 'routes must be a non-empty array' });
    }

    const confidences = communityService.getMultipleRouteConfidences(routes);

    res.json({
      confidences,
      count: confidences.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Batch confidence error:', error);
    res.status(500).json({
      error: 'Failed to get batch confidence',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Safety Analysis - Analyze route safety
app.post('/api/safety/analyze-route', (req, res) => {
  try {
    const { polyline } = req.body;

    if (!polyline || !Array.isArray(polyline) || polyline.length < 2) {
      return res.status(400).json({ error: 'polyline must be an array with at least 2 points' });
    }

    // Validate all coordinates are in Budapest
    const allValid = polyline.every((point: any) => {
      if (!Array.isArray(point) || point.length < 2) return false;
      const [lat, lng] = point;
      return isWithinBudapest(lat, lng);
    });

    if (!allValid) {
      return res.status(400).json({ error: 'All route points must be within Budapest area' });
    }

    const analysis = safetyService.analyzeRouteSafety(polyline);

    res.json({
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Route safety analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze route safety',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get construction zones near a point
app.get('/api/safety/construction-zones', (req, res) => {
  try {
    const { lat, lng, radius = 500 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const pointLat = parseFloat(lat as string);
    const pointLng = parseFloat(lng as string);

    if (!isWithinBudapest(pointLat, pointLng)) {
      return res.status(400).json({ error: 'Point must be within Budapest area' });
    }

    const zones = safetyService.getConstructionZonesNearPoint(
      pointLat,
      pointLng,
      parseInt(radius as string)
    );

    res.json({
      zones,
      count: zones.length,
      location: { lat: pointLat, lng: pointLng },
      radius: parseInt(radius as string),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Construction zones error:', error);
    res.status(500).json({
      error: 'Failed to get construction zones',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
  console.log(`\n📋 API Status:`);
  console.log(`   OpenRouteService: ${process.env.OPENROUTESERVICE_API_KEY ? '✅ Key loaded' : '❌ No key'}`);
  console.log(`   BKK API: ${process.env.BKK_API_ENABLED === 'true' ? '✅ Enabled' : '⚠️ Disabled'}`);
  console.log(`   MOL Bubi: ${process.env.MOL_BUBI_API_ENABLED === 'true' ? '✅ Enabled' : '⚠️ Disabled'}`);
  if (process.env.OPENROUTESERVICE_API_KEY) {
    console.log(`   💡 OpenRouteService key length: ${process.env.OPENROUTESERVICE_API_KEY.length} chars`);
  }
});