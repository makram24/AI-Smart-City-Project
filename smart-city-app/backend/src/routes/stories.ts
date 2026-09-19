import { Router } from 'express';
import { storyService, StoryCard } from '../stories';
import { isWithinBudapest } from '../utils/geoValidation';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/stories', (req, res) => {
  try {
    const { category } = req.query;
    const stories = category
      ? storyService.getStoriesByCategory(category as StoryCard['category'])
      : storyService.getAllStories();

    res.json({
      stories,
      count: stories.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Stories list error:', error);
    res.status(500).json({
      error: 'Failed to fetch stories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/stories/:id', (req, res) => {
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
    logger.error('Story detail error:', error);
    res.status(500).json({
      error: 'Failed to fetch story',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/api/stories/near-route', (req, res) => {
  try {
    const { polyline, maxDistance = 500 } = req.body;

    if (!polyline || !Array.isArray(polyline) || polyline.length < 2) {
      return res.status(400).json({
        error: 'Invalid route polyline. Expected array of [lat, lng] coordinates.'
      });
    }

    // Validate coordinates are in Budapest
    const invalidCoords = polyline.some((coord: unknown) => {
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
    logger.error('Stories near route error:', error);
    res.status(500).json({
      error: 'Failed to find stories near route',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/stories/near-point', (req, res) => {
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
    logger.error('Stories near point error:', error);
    res.status(500).json({
      error: 'Failed to find stories near point',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
