const request = require('supertest');
const createApp = require('../app');

describe('foundation', () => {
  const app = createApp();

  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('unknown route 404s', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
