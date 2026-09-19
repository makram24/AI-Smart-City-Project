import { Router } from 'express';
import { openai } from '../services/openaiClient';

const router = Router();

router.get('/api/health', (_req, res) => {
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
      openRouteService: !!process.env.OPENROUTESERVICE_API_KEY,
      bkkApi: process.env.BKK_API_ENABLED === 'true',
      molBubiApi: process.env.MOL_BUBI_API_ENABLED === 'true'
    },
    version: '3.0.0'
  });
});

export default router;
