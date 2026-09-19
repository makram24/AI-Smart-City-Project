import { Router } from 'express';
import { communityService } from '../community';
import { logger } from '../utils/logger';

const router = Router();

const ROUTE_TYPES = ['bus', 'tram', 'metro', 'trolley'] as const;
type RouteType = typeof ROUTE_TYPES[number];

function isRouteType(value: string): value is RouteType {
  return (ROUTE_TYPES as readonly string[]).includes(value);
}

// Community Confidence Signals - Submit feedback
router.post('/api/community/feedback', (req, res) => {
  try {
    const { routeId, routeType, sentiment, reliability, comment, userId } = req.body;

    if (!routeId || !routeType || !sentiment || !reliability) {
      return res.status(400).json({ error: 'Missing required fields: routeId, routeType, sentiment, reliability' });
    }

    if (!isRouteType(routeType)) {
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
    logger.error('Community feedback error:', error);
    res.status(500).json({
      error: 'Failed to submit feedback',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get confidence signals for a route
router.get('/api/community/confidence/:routeType/:routeId', (req, res) => {
  try {
    const { routeType, routeId } = req.params;

    if (!isRouteType(routeType)) {
      return res.status(400).json({ error: 'Invalid routeType' });
    }

    const confidence = communityService.getRouteConfidence(routeId, routeType);

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
    logger.error('Route confidence error:', error);
    res.status(500).json({
      error: 'Failed to get route confidence',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get confidence signals for multiple routes
router.post('/api/community/confidence/batch', (req, res) => {
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
    logger.error('Batch confidence error:', error);
    res.status(500).json({
      error: 'Failed to get batch confidence',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
