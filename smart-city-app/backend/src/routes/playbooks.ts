import { Router } from 'express';
import { neighborhoodPlaybookService } from '../playbooks';
import { isWithinBudapest } from '../utils/geoValidation';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/playbooks', (_req, res) => {
  const playbooks = neighborhoodPlaybookService.getSummaries();
  res.json({
    playbooks,
    count: playbooks.length,
    timestamp: new Date().toISOString()
  });
});

router.get('/api/playbooks/:id', async (req, res) => {
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
        logger.warn(`⚠️ Playbook personalization requested outside Budapest: [${userLat}, ${userLng}]`);
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
    logger.error('Playbook detail error:', error);
    res.status(500).json({
      error: 'Failed to load playbook',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
