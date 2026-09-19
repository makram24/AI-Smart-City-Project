import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

const app = createApp();

describe('createApp', () => {
  it('GET /api/health returns 200 with boolean feature flags and no key lengths', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(typeof res.body.features.openRouteService).toBe('boolean');
    expect(res.body.features).not.toHaveProperty('openRouteServiceKeyLength');
  });

  it('POST /api/chat without message returns 400', async () => {
    const res = await request(app).post('/api/chat').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/transport/test-bkk returns 404', async () => {
    const res = await request(app).get('/api/transport/test-bkk');
    expect(res.status).toBe(404);
  });
});
