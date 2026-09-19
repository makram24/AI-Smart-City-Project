import { Router } from 'express';
import { publicTransportService } from '../transport';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/transport/stops', async (req, res) => {
  const { lat, lng, radius = 500 } = req.query;

  try {
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const stops = await publicTransportService.getNearbyStops(
      parseFloat(lat as string),
      parseFloat(lng as string),
      parseInt(radius as string)
    );

    res.json({
      stops,
      count: stops.length,
      location: { lat, lng },
      radius: parseInt(radius as string)
    });
  } catch (error) {
    logger.error('Transport stops error:', error);
    res.status(500).json({
      error: 'Failed to fetch transport stops',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/transport/arrivals/:stopId', async (req, res) => {
  const { stopId } = req.params;

  try {
    const arrivals = await publicTransportService.getStopArrivals(stopId);
    res.json({
      stopId,
      arrivals,
      count: arrivals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transport arrivals error:', error);
    res.status(500).json({
      error: 'Failed to fetch arrivals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/transport/disruptions', async (req, res) => {
  try {
    const disruptions = await publicTransportService.getDisruptions();
    res.json({
      disruptions,
      count: disruptions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transport disruptions error:', error);
    res.status(500).json({
      error: 'Failed to fetch disruptions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get vehicles for a stop
router.get('/api/transport/vehicles/:stopId', async (req, res) => {
  try {
    const { stopId } = req.params;
    const vehicles = await publicTransportService.getVehiclesForStop(stopId);
    res.json({
      vehicles,
      count: vehicles.length,
      stopId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Transport vehicles error:', error);
    res.status(500).json({
      error: 'Failed to fetch vehicles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get route details
router.get('/api/transport/route/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const routeDetails = await publicTransportService.getRouteDetails(routeId);

    if (!routeDetails) {
      return res.status(404).json({
        error: 'Route not found',
        routeId
      });
    }

    res.json({
      route: routeDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Route details error:', error);
    res.status(500).json({
      error: 'Failed to fetch route details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get trip information
router.get('/api/transport/trip/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const tripInfo = await publicTransportService.getTripInfo(tripId);

    if (!tripInfo) {
      return res.status(404).json({
        error: 'Trip not found',
        tripId
      });
    }

    res.json({
      trip: tripInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Trip info error:', error);
    res.status(500).json({
      error: 'Failed to fetch trip information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
