import axios from 'axios';
import { InMemoryCache } from '../utils/cache';
import { isWithinBudapest, BUDAPEST_BOUNDS } from '../utils/geoValidation';
import { logger } from '../utils/logger';

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export interface OverpassPlace {
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

class GeospatialService {
  private nominatimBaseUrl = 'https://nominatim.openstreetmap.org';
  private overpassBaseUrl = 'https://overpass-api.de/api/interpreter';
  private geocodeCache = new InMemoryCache<string, unknown>(5 * 60 * 1000);
  private placesCache = new InMemoryCache<string, unknown[]>(2 * 60 * 1000);
  private reverseCache = new InMemoryCache<string, string>(10 * 60 * 1000);
  private historicalCache = new InMemoryCache<string, unknown[]>(5 * 60 * 1000);

  private buildCacheKey(prefix: string, ...values: Array<string | number>): string {
    return `${prefix}:${values.join(':').toLowerCase()}`;
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    try {
      const trimmed = address.trim();
      const cacheKey = this.buildCacheKey('geocode', trimmed);
      const cached = this.geocodeCache.get(cacheKey) as GeocodeResult | null;
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
            logger.error(`❌ Rejected geocoding result outside Budapest: [${lat}, ${lng}] for "${address}"`);
            return null;
          }
        }

        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        logger.debug(`📍 Geocoded "${address}" to: ${result.display_name}`);
        logger.debug(`   Coordinates: [${lat}, ${lng}]`);

        // Final validation - MUST be in Budapest area
        if (!isWithinBudapest(lat, lng)) {
          logger.error(`❌ Invalid coordinates for Budapest: [${lat}, ${lng}] - REJECTING`);
          return null;
        }

        const payload: GeocodeResult = {
          lat: lat,
          lng: lng,
          display_name: result.display_name
        };
        this.geocodeCache.set(cacheKey, payload);
        return payload;
      }
      return null;
    } catch (error) {
      logger.error('Geocoding error:', error);
      return null;
    }
  }

  async searchPlaces(query: string, lat: number, lng: number, radius: number = 1000): Promise<OverpassPlace[]> {
    try {
      // STRICT: Only allow searches within Budapest area
      if (!isWithinBudapest(lat, lng)) {
        logger.warn(`⚠️ Place search location [${lat}, ${lng}] is outside Budapest area - restricting to Budapest`);
        // Force search to Budapest center if location is outside
        [lat, lng] = [47.4979, 19.0402];
        logger.debug(`   Using Budapest center [${lat}, ${lng}] for search`);
      }

      const cacheKey = this.buildCacheKey('places', query, lat, lng, radius);
      const cached = this.placesCache.get(cacheKey);
      if (cached) {
        return cached as OverpassPlace[];
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
      const results = ((response.data.elements || []) as OverpassPlace[]).filter((place) => {
        const placeLat = place.lat || place.center?.lat;
        const placeLng = place.lon || place.center?.lon;

        if (!placeLat || !placeLng) return false;

        // Strict Budapest validation
        const isInBudapestBounds = isWithinBudapest(placeLat, placeLng);

        if (!isInBudapestBounds) {
          logger.warn(`⚠️ Filtered out place outside Budapest: [${placeLat}, ${placeLng}]`);
        }

        return isInBudapestBounds;
      });

      logger.debug(`📍 Found ${results.length} places in Budapest for "${query}"`);
      this.placesCache.set(cacheKey, results);
      return results;
    } catch (error) {
      logger.error('Places search error:', error);
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
      logger.error('Reverse geocoding error:', error);
      return null;
    }
  }

  async getPharmacies(lat: number, lng: number, radius: number = 1000): Promise<OverpassPlace[]> {
    try {
      const cacheKey = this.buildCacheKey('pharmacies', lat, lng, radius);
      const cached = this.placesCache.get(cacheKey);
      if (cached) {
        return cached as OverpassPlace[];
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

      const results = (response.data.elements || []) as OverpassPlace[];
      this.placesCache.set(cacheKey, results);
      return results;
    } catch (error) {
      logger.error('Pharmacies search error:', error);
      return [];
    }
  }

  async getRestaurants(lat: number, lng: number, radius: number = 1000): Promise<OverpassPlace[]> {
    try {
      const cacheKey = this.buildCacheKey('restaurants', lat, lng, radius);
      const cached = this.placesCache.get(cacheKey);
      if (cached) {
        return cached as OverpassPlace[];
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

      const results = (response.data.elements || []) as OverpassPlace[];
      this.placesCache.set(cacheKey, results);
      return results;
    } catch (error) {
      logger.error('Restaurants search error:', error);
      return [];
    }
  }

  async getHistoricalPlaces(lat: number, lng: number, radius: number = 5000): Promise<OverpassPlace[]> {
    try {
      const cacheKey = this.buildCacheKey('historical', lat, lng, radius);
      const cached = this.historicalCache.get(cacheKey);
      if (cached) {
        return cached as OverpassPlace[];
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

      const results = (response.data.elements || []) as OverpassPlace[];
      this.historicalCache.set(cacheKey, results);
      return results;
    } catch (error) {
      logger.error('Historical places search error:', error);
      return [];
    }
  }

  // Historical places descriptions for Budapest landmarks
  getHistoricalPlaceDescription(name: string, tags: Record<string, string> = {}): string {
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

export const geospatialService = new GeospatialService();
