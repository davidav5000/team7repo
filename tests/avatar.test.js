const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../models/user', () => ({
  findByUsername: jest.fn(),
  findPublicById: jest.fn(),
  updateAvatar: jest.fn(),
}));

const User = require('../models/user');
const createApp = require('../app');

describe('profile avatar endpoints', () => {
  let app;
  let agent;
  let passwordHash;
  const avatarUrl = 'https://example.com/photo.jpg';

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('valid-password', 4);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
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
  });

  test('requires authentication', async () => {
    const res = await request(app).put('/users/me/avatar').send({ avatarUrl });
    expect(res.status).toBe(401);
    expect(User.updateAvatar).not.toHaveBeenCalled();
  });

  test.each([avatarUrl, null])(
    'saves or removes the session user avatar: %s',
    async (value) => {
      User.updateAvatar.mockResolvedValue({ avatarUrl: value });
      const res = await agent.put('/users/me/avatar').send({
        avatarUrl: value,
        userId: 7,
        id: 7,
        username: 'someone_else',
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ avatarUrl: value });
      expect(User.updateAvatar).toHaveBeenCalledWith(42, value);
    },
  );

  test('trims before saving and checking the length', async () => {
    const value = 'https://example.com/' + 'x'.repeat(2028);
    expect(value.length).toBe(2048);
    User.updateAvatar.mockResolvedValue({ avatarUrl: value });
    const res = await agent.put('/users/me/avatar').send({ avatarUrl: `  ${value}  ` });
    expect(res.status).toBe(200);
    expect(User.updateAvatar).toHaveBeenCalledWith(42, value);
  });

  test.each([
    undefined,
    '',
    '   ',
    123,
    false,
    [],
    {},
    'http://example.com/a.jpg',
    '//example.com/a.jpg',
    'data:image/png;base64,abc',
    'javascript:alert(1)',
    'https://',
    'https://user:pass@example.com/a.jpg',
    'https://user@example.com/a.jpg',
    'https://example.com/has space.jpg',
    'https://example.com/' + 'x'.repeat(2029),
  ])('rejects invalid avatar value %j', async (value) => {
    const res = await agent.put('/users/me/avatar').send({ avatarUrl: value });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid avatar data');
    expect(res.body.details[0].field).toBe('avatarUrl');
    expect(User.updateAvatar).not.toHaveBeenCalled();
  });

  test('returns 404 if the session user no longer exists', async () => {
    User.updateAvatar.mockResolvedValue(null);
    const res = await agent.put('/users/me/avatar').send({ avatarUrl });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });

  test.each([avatarUrl, null])('GET /users/me includes avatarUrl: %s', async (value) => {
    User.findPublicById.mockResolvedValue({
      id: 42,
      username: 'student',
      avatarUrl: value,
    });
    const res = await agent.get('/users/me');
    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe(value);
    expect(User.findPublicById).toHaveBeenCalledWith(42);
  });

  test('forwards unexpected database errors to the app handler', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      User.updateAvatar.mockRejectedValue(new Error('Database unavailable'));
      const res = await agent.put('/users/me/avatar').send({ avatarUrl });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Database unavailable' });
    } finally {
      log.mockRestore();
    }
  });
});
