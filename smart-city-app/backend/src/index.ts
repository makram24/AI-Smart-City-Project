import dotenv from 'dotenv';

// Load environment variables FIRST, before importing services that depend on them
dotenv.config();

import { createApp } from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`🚀 Backend server running on port ${PORT}`);
  logger.info(`📡 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`🗺️  Geospatial services enabled`);
  logger.info(`🤖 AI services: ${process.env.OPENAI_API_KEY ? 'OpenAI enabled' : 'Rule-based responses'}`);
  logger.info(`OpenRouteService: ${process.env.OPENROUTESERVICE_API_KEY ? 'enabled' : 'disabled'}`);
  logger.info(`BKK API: ${process.env.BKK_API_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
  logger.info(`MOL Bubi: ${process.env.MOL_BUBI_API_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
});
