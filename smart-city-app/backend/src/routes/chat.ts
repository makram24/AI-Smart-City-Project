import { Router } from 'express';
import { aiService } from '../services/ai';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

const chatRateLimitMax = parseInt(process.env.CHAT_RATE_LIMIT_MAX || '20', 10);

router.post(
  '/api/chat',
  rateLimit({ windowMs: 60_000, max: Number.isNaN(chatRateLimitMax) ? 20 : chatRateLimitMax }),
  async (req, res) => {
    const { message, userLocation } = req.body;

    if (typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message must be a non-empty string' });
    }

    // Set a longer timeout for chat requests (geocoding + routing can take time)
    req.setTimeout(30000); // 30 seconds

    try {
      const result = await aiService.processQuery(message, userLocation);

      const response = {
        id: Date.now().toString(),
        text: result.text,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        markers: result.markers,
        route: result.route,
        persona: result.persona,
        suggestions: result.suggestions
      };

      res.json(response);
    } catch (error) {
      logger.error('Chat error:', error);
      const isProd = process.env.NODE_ENV === 'production';
      res.status(500).json({
        error: 'Failed to process your request',
        message: isProd ? 'Internal server error' : (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }
);

export default router;
