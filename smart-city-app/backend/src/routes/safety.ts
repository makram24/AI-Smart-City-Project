import { Router } from 'express';
import { safetyService } from '../safety';
import { isWithinBudapest } from '../utils/geoValidation';
import { logger } from '../utils/logger';

const router = Router();

// Safety Analysis - Analyze route safety
router.post('/api/safety/analyze-route', (req, res) => {
  try {
    const { polyline } = req.body;

    if (!polyline || !Array.isArray(polyline) || polyline.length < 2) {
      return res.status(400).json({ error: 'polyline must be an array with at least 2 points' });
    }

    // Validate all coordinates are in Budapest
    const allValid = polyline.every((point: unknown) => {
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
    logger.error('Route safety analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze route safety',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get construction zones near a point
router.get('/api/safety/construction-zones', (req, res) => {
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
    logger.error('Construction zones error:', error);
    res.status(500).json({
      error: 'Failed to get construction zones',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
