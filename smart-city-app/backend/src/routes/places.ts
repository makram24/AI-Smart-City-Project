import { Router } from 'express';
import { geospatialService, OverpassPlace } from '../services/geospatial';
import { isWithinBudapest, normalizeCoordinate } from '../utils/geoValidation';
import { logger } from '../utils/logger';

const router = Router();

function formatPlace(
  place: OverpassPlace,
  searchLat: number,
  searchLng: number,
  extra?: Record<string, unknown>
) {
  const rawCoord: [number, number] | null = [
    place.lat || place.center?.lat || 0,
    place.lon || place.center?.lon || 0
  ];
  const coords = normalizeCoordinate(rawCoord);
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
      searchLat,
      searchLng,
      coords[0],
      coords[1]
    ).toFixed(1) + ' km',
    ...extra
  };
}

// Real places search endpoint - STRICTLY limited to Budapest
router.get('/api/places/search', async (req, res) => {
  const { query, lat, lng, radius = 1000 } = req.query;

  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const searchLat = parseFloat(lat as string);
    const searchLng = parseFloat(lng as string);

    // STRICT: Validate search location is in Budapest
    if (!isWithinBudapest(searchLat, searchLng)) {
      logger.warn(`⚠️ Place search requested outside Budapest: [${searchLat}, ${searchLng}]`);
      // Use Budapest center instead
      const budapestCenter = { lat: 47.4979, lng: 19.0402 };
      logger.debug(`   Redirecting search to Budapest center: [${budapestCenter.lat}, ${budapestCenter.lng}]`);

      const places = await geospatialService.searchPlaces(
        query as string,
        budapestCenter.lat,
        budapestCenter.lng,
        parseInt(radius as string)
      );

      const formattedPlaces = places.map((place) => formatPlace(place, budapestCenter.lat, budapestCenter.lng)).filter((place) => place !== null);

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

    const formattedPlaces = places.map((place) => {
      const formatted = formatPlace(place, searchLat, searchLng);
      if (!formatted) {
        logger.warn(`⚠️ Filtered out place outside Budapest:`, [place.lat || place.center?.lat, place.lon || place.center?.lon]);
      }
      return formatted;
    }).filter((place) => place !== null);

    res.json({
      places: formattedPlaces,
      query: query,
      location: { lat: searchLat, lng: searchLng },
      count: formattedPlaces.length,
      note: 'All results are limited to Budapest area'
    });
  } catch (error) {
    logger.error('Places search error:', error);
    res.status(500).json({
      error: 'Failed to search places',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all nearby places grouped by category
router.get('/api/places/nearby', async (req, res) => {
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
    const allPlaces: Array<Record<string, unknown>> = [];

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

          const formattedPlaces = places.map((place) => {
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
          }).filter((place) => place !== null);

          allPlaces.push(...formattedPlaces as Array<Record<string, unknown>>);
        } catch (err) {
          logger.warn(`Failed to fetch ${category} places:`, err);
        }
      })
    );

    // Sort by distance
    allPlaces.sort((a, b) => {
      const distA = parseFloat(String(a.distance).replace(' km', '')) || 999;
      const distB = parseFloat(String(b.distance).replace(' km', '')) || 999;
      return distA - distB;
    });

    res.json({
      places: allPlaces,
      location: { lat: searchLat, lng: searchLng },
      count: allPlaces.length,
      categories: categories
    });
  } catch (error) {
    logger.error('Nearby places error:', error);
    res.status(500).json({
      error: 'Failed to fetch nearby places',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Historical places endpoint
router.get('/api/places/historical', async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query;

  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const searchLat = parseFloat(lat as string);
    const searchLng = parseFloat(lng as string);

    const formatHistorical = (place: OverpassPlace, originLat: number, originLng: number) => {
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
          originLat,
          originLng,
          placeLat,
          placeLng
        ).toFixed(1) + ' km',
        historicType: place.tags?.historic,
        tourismType: place.tags?.tourism
      };
    };

    // STRICT: Validate search location is in Budapest
    if (searchLat < 47.3 || searchLat > 47.7 || searchLng < 18.9 || searchLng > 19.4) {
      logger.warn(`⚠️ Historical places search requested outside Budapest: [${searchLat}, ${searchLng}]`);
      const budapestCenter = { lat: 47.4979, lng: 19.0402 };

      const places = await geospatialService.getHistoricalPlaces(
        budapestCenter.lat,
        budapestCenter.lng,
        parseInt(radius as string)
      );

      const formattedPlaces = places.map((place) => formatHistorical(place, budapestCenter.lat, budapestCenter.lng)).filter((place) => place !== null);

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

    const formattedPlaces = places.map((place) => formatHistorical(place, searchLat, searchLng)).filter((place) => place !== null);

    res.json({
      places: formattedPlaces,
      location: { lat: searchLat, lng: searchLng },
      count: formattedPlaces.length,
      note: 'All results are limited to Budapest area'
    });
  } catch (error) {
    logger.error('Historical places error:', error);
    res.status(500).json({
      error: 'Failed to fetch historical places',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Geocoding endpoint
router.get('/api/geocode', async (req, res) => {
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
    logger.error('Geocoding error:', error);
    res.status(500).json({
      error: 'Failed to geocode address',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
