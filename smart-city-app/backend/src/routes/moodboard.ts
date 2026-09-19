import { Router } from 'express';
import { moodboardService } from '../moodboard';
import { isWithinBudapest } from '../utils/geoValidation';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/moodboard', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const userLocation = lat && lng
      ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
      : undefined;

    if (userLocation && !isWithinBudapest(userLocation.lat, userLocation.lng)) {
      logger.warn(`⚠️ Moodboard requested outside Budapest: [${userLocation.lat}, ${userLocation.lng}]`);
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
    logger.error('Moodboard error:', error);
    res.status(500).json({
      error: 'Failed to generate moodboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
