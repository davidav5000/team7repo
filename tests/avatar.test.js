const request = require('supertest');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

jest.mock('../models/user', () => ({
  findByUsername: jest.fn(),
  findPublicById: jest.fn(),
}));
jest.mock('../models/avatar', () => ({
  replace: jest.fn(),
  remove: jest.fn(),
  findByUserId: jest.fn(),
}));

const User = require('../models/user');
const Avatar = require('../models/avatar');
const createApp = require('../app');

describe('profile avatar endpoints', () => {
  let app;
  let agent;
  let passwordHash;
  let png;
  let webp;
  let errorLog;
  const revision = '651dce05-ed17-4b96-92b0-b0cf64744f44';
  const avatarUrl = `/users/42/avatar?v=${revision}`;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('valid-password', 4);
    png = await sharp({
      create: { width: 10, height: 20, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    webp = await sharp(png).resize(256, 256).webp().toBuffer();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    app = createApp();
    User.findByUsername.mockResolvedValue({
      id: 42,
      username: 'student',
      password_hash: passwordHash,
    });
    agent = request.agent(app);
    const login = await agent
      .post('/login')
      .send({ username: 'student', password: 'valid-password' });
    expect(login.status).toBe(200);
    Avatar.replace.mockResolvedValue({ avatarUrl });
    Avatar.remove.mockResolvedValue({ avatarUrl: null });
    Avatar.findByUserId.mockResolvedValue({ imageData: webp, revision });
  });

  afterEach(() => errorLog.mockRestore());

  test('authenticates before parsing or processing the upload', async () => {
    const res = await request(app)
      .put('/users/me/avatar')
      .set('Content-Type', 'multipart/form-data')
      .send('malformed');
    expect(res.status).toBe(401);
    expect(Avatar.replace).not.toHaveBeenCalled();
  });

  test('requires authentication to remove a picture', async () => {
    expect((await request(app).delete('/users/me/avatar')).status).toBe(401);
    expect(Avatar.remove).not.toHaveBeenCalled();
  });

  test('uploads processed WebP for the session user, ignoring query ownership claims', async () => {
    const res = await agent
      .put('/users/me/avatar?userId=7')
      .attach('avatar', png, 'a.png');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avatarUrl });
    expect(Avatar.replace).toHaveBeenCalledTimes(1);
    const [id, image] = Avatar.replace.mock.calls[0];
    expect(id).toBe(42);
    expect(await sharp(image).metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
  });

  test('removes only the session user picture', async () => {
    const res = await agent.delete('/users/me/avatar').send({ userId: 7 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ avatarUrl: null });
    expect(Avatar.remove).toHaveBeenCalledWith(42);
  });

  test.each(['https://example.com/a.jpg', null])(
    'rejects old JSON URL updates: %s',
    async (value) => {
      const res = await agent.put('/users/me/avatar').send({ avatarUrl: value });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(Avatar.replace).not.toHaveBeenCalled();
    },
  );

  test('rejects spoofed image bytes without calling the model', async () => {
    const res = await agent
      .put('/users/me/avatar')
      .attach('avatar', Buffer.from('invalid'), 'a.png');
    expect(res.status).toBe(400);
    expect(Avatar.replace).not.toHaveBeenCalled();
  });

  test('rejects ownership fields in the multipart body', async () => {
    const res = await agent
      .put('/users/me/avatar')
      .field('userId', '7')
      .attach('avatar', png, 'a.png');
    expect(res.status).toBe(400);
    expect(Avatar.replace).not.toHaveBeenCalled();
  });

  test.each(['put', 'delete'])(
    '%s returns 404 if the session user no longer exists',
    async (method) => {
      Avatar.replace.mockResolvedValue(null);
      Avatar.remove.mockResolvedValue(null);
      const req = agent[method]('/users/me/avatar');
      const res = await (method === 'put' ? req.attach('avatar', png, 'a.png') : req);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
    },
  );

  test('publicly serves matching image bytes with revalidation headers', async () => {
    const res = await request(app).get(avatarUrl);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toBe('public, no-cache');
    expect(res.headers.etag).toBe(`"${revision}"`);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body).toEqual(webp);
    expect(Avatar.findByUserId).toHaveBeenCalledWith(42, revision);
  });

  test('returns 304 for a matching ETag after confirming the image still exists', async () => {
    const res = await request(app).get(avatarUrl).set('If-None-Match', `"${revision}"`);
    expect(res.status).toBe(304);
    expect(Avatar.findByUserId).toHaveBeenCalledWith(42, revision);
  });

  test('returns JSON 404 for a missing picture or stale revision even with a matching ETag', async () => {
    Avatar.findByUserId.mockResolvedValue(null);
    const res = await request(app).get(avatarUrl).set('If-None-Match', `"${revision}"`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Picture not found' });
  });

  test.each([
    '/users/0/avatar',
    '/users/-1/avatar',
    '/users/not-a-user/avatar',
    '/users/2147483648/avatar',
    '/users/1.5/avatar',
  ])('rejects invalid user ID: %s', async (path) => {
    const res = await request(app).get(`${path}?v=${revision}`);
    expect(res.status).toBe(404);
    expect(Avatar.findByUserId).not.toHaveBeenCalled();
  });

  test.each(['', '?v=invalid', '?v=', `?v=${revision}&v=${revision}`, '?v[]=invalid'])(
    'rejects invalid revision query: %s',
    async (query) => {
      const res = await request(app).get(`/users/42/avatar${query}`);
      expect(res.status).toBe(404);
      expect(Avatar.findByUserId).not.toHaveBeenCalled();
    },
  );

  test.each([avatarUrl, 'https://example.com/old.jpg', null])(
    'GET /users/me preserves avatarUrl: %s',
    async (value) => {
      User.findPublicById.mockResolvedValue({
        id: 42,
        username: 'student',
        avatarUrl: value,
      });
      const res = await agent.get('/users/me');
      expect(res.status).toBe(200);
      expect(res.body.user.avatarUrl).toBe(value);
    },
  );

  test.each(['put', 'delete', 'get'])(
    '%s forwards database failures to the app error handler',
    async (method) => {
      const error = new Error('Database unavailable');
      Avatar.replace.mockRejectedValue(error);
      Avatar.remove.mockRejectedValue(error);
      Avatar.findByUserId.mockRejectedValue(error);
      const req = agent[method](method === 'get' ? avatarUrl : '/users/me/avatar');
      const res = await (method === 'put' ? req.attach('avatar', png, 'a.png') : req);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Database unavailable' });
      expect(errorLog).toHaveBeenCalledWith(error);
    },
  );
});
