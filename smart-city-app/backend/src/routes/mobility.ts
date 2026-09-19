import { Router } from 'express';
import { sharedMobilityService } from '../mobility';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/mobility/bikes', async (req, res) => {
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
    logger.error('Bike stations error:', error);
    res.status(500).json({
      error: 'Failed to fetch bike stations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/mobility/summary', async (_req, res) => {
  try {
    const summary = await sharedMobilityService.getBikeAvailabilitySummary();
    res.json({
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Bike summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch bike summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
