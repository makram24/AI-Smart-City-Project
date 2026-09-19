import dotenv from 'dotenv';

// Load environment variables FIRST, before importing services that depend on them
dotenv.config();

import express from 'express';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import chatRouter from './routes/chat';
import placesRouter from './routes/places';
import routingRouter from './routes/routing';
import transportRouter from './routes/transport';
import mobilityRouter from './routes/mobility';
import weatherRouter from './routes/weather';
import playbooksRouter from './routes/playbooks';
import storiesRouter from './routes/stories';
import communityRouter from './routes/community';
import safetyRouter from './routes/safety';
import moodboardRouter from './routes/moodboard';

export function createApp(): express.Application {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json({ limit: '200kb' }));

  app.use(healthRouter);
  app.use(chatRouter);
  app.use(placesRouter);
  app.use(routingRouter);
  app.use(transportRouter);
  app.use(mobilityRouter);
  app.use(weatherRouter);
  app.use(playbooksRouter);
  app.use(storiesRouter);
  app.use(communityRouter);
  app.use(safetyRouter);
  app.use(moodboardRouter);

  app.use(errorHandler);
  app.use('*', notFoundHandler);

  return app;
}
