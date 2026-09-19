import { Router } from 'express';
import { publicTransportService } from '../transport';
import { routingService } from '../routing';
import { normalizeCoordinate } from '../utils/geoValidation';
import { logger } from '../utils/logger';

const router = Router();

// Enhanced routes endpoint with multiple transport options
router.get('/api/routes', async (req, res) => {
  const { from, to, mode = 'walking' } = req.query;

  try {
    // Validate that 'from' parameter is provided (should be user's current location)
    if (!from) {
      return res.status(400).json({
        error: 'Start location (from) is required. Please provide your current location.'
      });
    }

    const parseCoordinateString = (value?: string | string[] | null): [number, number] | null => {
      if (!value) return null;
      const raw = value.toString().split(',').map(Number);
      if (raw.length !== 2 || raw.some((num) => Number.isNaN(num))) {
        return null;
      }
      const normalized = normalizeCoordinate([raw[0], raw[1]]);
      return normalized;
    };

    const fromCoords = parseCoordinateString(from as string);
    if (!fromCoords) {
      return res.status(400).json({ error: 'Invalid start location format. Expected: lat,lng within Budapest.' });
    }

    const toCoords = parseCoordinateString(to as string) || [47.5079, 19.0502];

    if (mode === 'public_transport') {
      // Public transport route
      const transportRoute = await publicTransportService.planJourney(
        fromCoords,
        toCoords
      );

      if (transportRoute) {
        // First pass: Get geometry for transport segments (so we can use them for walking segments)
        const stepsWithTransportGeometry = await Promise.all(
          transportRoute.steps.map(async (step) => {
            // For public transport segments without geometry, try to get route shape
            if ((step.type === 'bus' || step.type === 'tram' || step.type === 'metro') &&
                (!step.geometry || step.geometry.length === 0) && step.route) {
              try {
                const routeDetail = await publicTransportService.getRouteDetails(step.route);
                if (routeDetail?.shape && routeDetail.shape.length > 0) {
                  logger.debug(`✅ Using route shape for ${step.route}`);
                  return {
                    ...step,
                    geometry: routeDetail.shape
                  };
                }
              } catch {
                logger.warn(`⚠️ Could not fetch route shape for ${step.route}`);
              }
            }
            return step;
          })
        );

        // Second pass: Get proper walking routes for walking segments using OpenRouteService
        const processedSteps = await Promise.all(
          stepsWithTransportGeometry.map(async (step, index) => {
            // For walking segments, ALWAYS use OpenRouteService to get proper walking routes
            if (step.type === 'walk') {
              // Try to get coordinates from previous/next steps
              let stepFromCoords: [number, number] | null = null;
              let stepToCoords: [number, number] | null = null;

              // Try to get from coordinates from previous step or journey start
              if (index === 0) {
                stepFromCoords = fromCoords; // Use journey start
              } else {
                const prevStep = stepsWithTransportGeometry[index - 1];
                if (prevStep.geometry && prevStep.geometry.length > 0) {
                  const lastCoord = prevStep.geometry[prevStep.geometry.length - 1];
                  if (Array.isArray(lastCoord) && lastCoord.length >= 2) {
                    stepFromCoords = [lastCoord[0], lastCoord[1]];
                  }
                }
              }

              // Try to get to coordinates from next step or journey end
              if (index === stepsWithTransportGeometry.length - 1) {
                stepToCoords = toCoords; // Use journey end
              } else {
                const nextStep = stepsWithTransportGeometry[index + 1];
                if (nextStep.geometry && nextStep.geometry.length > 0) {
                  const firstCoord = nextStep.geometry[0];
                  if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
                    stepToCoords = [firstCoord[0], firstCoord[1]];
                  }
                }
              }

              // If we have both coordinates, get proper walking route
              if (stepFromCoords && stepToCoords) {
                try {
                  const walkingRoute = await routingService.getWalkingRoute(stepFromCoords, stepToCoords);
                  if (walkingRoute && walkingRoute.geometry && walkingRoute.geometry.length > 0) {
                    logger.debug(`✅ Got proper walking route for step ${index + 1} (${step.from} to ${step.to})`);
                    return {
                      ...step,
                      geometry: walkingRoute.geometry
                    };
                  }
                } catch (e) {
                  logger.warn(`⚠️ Failed to get walking route for step ${index + 1}:`, e);
                }
              }

              // If we can't get proper route, skip geometry (don't use straight lines through water!)
              logger.warn(`⚠️ Walking step "${step.from}" to "${step.to}" - no valid geometry, skipping`);
              return {
                ...step,
                geometry: undefined
              };
            }

            // Validate geometry coordinates are in Budapest (for all step types)
            if (step.geometry && step.geometry.length > 0) {
              const validGeometry = step.geometry.filter((coord: number[]) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const lat = coord[0];
                  const lng = coord[1];
                  // Validate coordinates are in Budapest
                  if (lat >= 47.0 && lat <= 48.0 && lng >= 18.5 && lng <= 19.5) {
                    return true;
                  }
                  // Try swapping if coordinates seem reversed
                  if (lng >= 47.0 && lng <= 48.0 && lat >= 18.5 && lat <= 19.5) {
                    logger.warn(`⚠️ Swapping coordinates: [${lat}, ${lng}] -> [${lng}, ${lat}]`);
                    coord[0] = lng;
                    coord[1] = lat;
                    return true;
                  }
                  return false;
                }
                return false;
              });

              if (validGeometry.length === 0) {
                logger.warn(`⚠️ Step geometry invalid - all coordinates outside Budapest`);
                return {
                  ...step,
                  geometry: undefined
                };
              }

              return {
                ...step,
                geometry: validGeometry
              };
            }

            return step;
          })
        );

        // Build combined geometry from valid step geometries
        const combinedGeometry: number[][] = [];
        processedSteps.forEach((step) => {
          if (step.geometry && step.geometry.length > 0) {
            if (combinedGeometry.length === 0) {
              combinedGeometry.push(...step.geometry);
            } else {
              // Skip first point if it's the same as last point
              const lastPoint = combinedGeometry[combinedGeometry.length - 1];
              const firstPoint = step.geometry[0];
              const isDuplicate = Math.abs(lastPoint[0] - firstPoint[0]) < 0.0001 &&
                                  Math.abs(lastPoint[1] - firstPoint[1]) < 0.0001;

              if (isDuplicate) {
                combinedGeometry.push(...step.geometry.slice(1));
              } else {
                combinedGeometry.push(...step.geometry);
              }
            }
          }
        });

        // If no valid geometry, use fallback walking route
        let finalGeometry = combinedGeometry.length > 0 ? combinedGeometry : undefined;
        if (!finalGeometry || finalGeometry.length === 0) {
          logger.warn('⚠️ No valid geometry from steps, using fallback walking route');
          const fallbackGeometry = await routingService.getWalkingRoute(
            fromCoords,
            toCoords
          );
          finalGeometry = fallbackGeometry?.geometry || [fromCoords, toCoords];
        }

        const distanceLabel = transportRoute.steps.reduce((sum, step) => sum + (step.distance || 0), 0) > 0
          ? routingService.formatDistance(transportRoute.steps.reduce((sum, step) => sum + (step.distance || 0), 0))
          : `${(transportRoute.duration * 0.4).toFixed(1)} km`;

        res.json({
          id: Date.now().toString(),
          mode: 'public_transport',
          from: from,
          to: to,
          distance: distanceLabel,
          duration: `${transportRoute.duration} minutes`,
          transfers: transportRoute.transfers,
          steps: processedSteps.map(step => ({
            instruction: `${step.type}: ${step.from} to ${step.to}`,
            distance: step.distance ? `${step.distance}m` : 'N/A',
            type: step.type,
            route: step.route,
            geometry: step.geometry // Include step geometry for segmented display
          })),
          polyline: finalGeometry // Combined geometry for full route
        });
      } else {
        res.status(404).json({ error: 'No public transport route found' });
      }
    } else if (mode === 'cycling') {
      // Cycling route using OpenRouteService or fallback
      logger.debug(`🚴 Cycling route: From user location [${fromCoords[0]}, ${fromCoords[1]}] to [${toCoords[0]}, ${toCoords[1]}]`);

      const cyclingRoute = await routingService.getCyclingRoute(
        [fromCoords[0], fromCoords[1]],
        [toCoords[0], toCoords[1]]
      );

      if (cyclingRoute) {
        // Ensure geometry is in [lat, lng] format for frontend
        const formattedGeometry = cyclingRoute.geometry.map((coord: number[]) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            // Check if we need to swap [lng, lat] to [lat, lng]
            if (coord[0] > coord[1] && coord[0] < 30 && coord[1] > 40) {
              return [coord[1], coord[0]];
            }
            return [coord[0], coord[1]];
          }
          return coord;
        });

        res.json({
          id: Date.now().toString(),
          mode: 'cycling',
          from: from,
          to: to,
          distance: routingService.formatDistance(cyclingRoute.distance),
          duration: routingService.formatDuration(cyclingRoute.duration),
          steps: cyclingRoute.instructions.map((instruction, index) => ({
            instruction,
            distance: index < cyclingRoute.instructions.length - 1 ? 'N/A' : routingService.formatDistance(cyclingRoute.distance),
            type: 'cycling'
          })),
          polyline: formattedGeometry.length > 0 ? formattedGeometry : cyclingRoute.geometry
        });
      } else {
        res.status(404).json({ error: 'No cycling route found' });
      }
    } else {
      // Walking route using OpenRouteService or fallback
      logger.debug(`🚶 Walking route: From user location [${fromCoords[0]}, ${fromCoords[1]}] to [${toCoords[0]}, ${toCoords[1]}]`);

      const walkingRoute = await routingService.getWalkingRoute(
        [fromCoords[0], fromCoords[1]],
        [toCoords[0], toCoords[1]]
      );

      if (walkingRoute) {
        // Ensure geometry is in [lat, lng] format for frontend
        const formattedGeometry = walkingRoute.geometry.map((coord: number[]) => {
          // If coordinate is [lng, lat], swap to [lat, lng]
          // OpenRouteService returns [lng, lat], but frontend expects [lat, lng]
          if (Array.isArray(coord) && coord.length >= 2) {
            // Check if we need to swap (lng is typically larger than lat for Budapest area)
            // Budapest lat ~47, lng ~19, so if first > second, it's likely [lng, lat]
            if (coord[0] > coord[1] && coord[0] < 30 && coord[1] > 40) {
              return [coord[1], coord[0]]; // Swap [lng, lat] to [lat, lng]
            }
            return [coord[0], coord[1]]; // Already [lat, lng]
          }
          return coord;
        });

        res.json({
          id: Date.now().toString(),
          mode: 'walking',
          from: from,
          to: to,
          distance: routingService.formatDistance(walkingRoute.distance),
          duration: routingService.formatDuration(walkingRoute.duration),
          steps: walkingRoute.instructions.map((instruction, index) => ({
            instruction,
            distance: index < walkingRoute.instructions.length - 1 ? 'N/A' : routingService.formatDistance(walkingRoute.distance),
            type: 'walking'
          })),
          polyline: formattedGeometry.length > 0 ? formattedGeometry : walkingRoute.geometry
        });
      } else {
        res.status(404).json({ error: 'No walking route found' });
      }
    }
  } catch (error) {
    logger.error('Route planning error:', error);
    res.status(500).json({
      error: 'Failed to plan route',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
