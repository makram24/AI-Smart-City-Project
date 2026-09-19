import { Router } from 'express';
import { weatherService } from '../weather';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/weather/current', async (_req, res) => {
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
    logger.error('Weather error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/weather/forecast', async (_req, res) => {
  try {
    const forecast = await weatherService.getWeatherForecast();
    res.json({
      forecast,
      count: forecast.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Weather forecast error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather forecast',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/weather/alerts', async (_req, res) => {
  try {
    const alerts = await weatherService.getWeatherAlerts();
    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Weather alerts error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
