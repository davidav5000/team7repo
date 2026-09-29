const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../models/user', () => ({
  findByUsername: jest.fn(),
  create: jest.fn(),
  findPublicById: jest.fn(),
}));

const User = require('../models/user');
const createApp = require('../app');

describe('authentication', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  test('POST /register hashes the password and creates a user', async () => {
    User.findByUsername.mockResolvedValue(null);
    User.create.mockImplementation(async ({ name, username, contactInfo, passwordHash }) => ({
      id: 1,
      name,
      username,
      contact_info: contactInfo,
      _passwordHashForTest: passwordHash,
    }));

    const res = await request(app).post('/register').send({
      name: 'Test Student',
      username: 'TestUser',
      contactInfo: 'test@example.com',
      password: 'correct-horse-battery',
    });

    expect(res.status).toBe(201);
    expect(User.create).toHaveBeenCalledTimes(1);

    const createArgs = User.create.mock.calls[0][0];
    expect(createArgs.username).toBe('testuser');
    expect(createArgs.passwordHash).not.toBe('correct-horse-battery');
    expect(await bcrypt.compare('correct-horse-battery', createArgs.passwordHash)).toBe(true);
  });

  test('POST /register rejects a duplicate username', async () => {
    User.findByUsername.mockResolvedValue({ id: 1 });

    const res = await request(app).post('/register').send({
      name: 'Test Student',
      username: 'existing',
      contactInfo: 'test@example.com',
      password: 'correct-horse-battery',
    });

    expect(res.status).toBe(409);
    expect(User.create).not.toHaveBeenCalled();
  });

  test('POST /login creates an authenticated session', async () => {
    const passwordHash = await bcrypt.hash('valid-password', 4);
    User.findByUsername.mockResolvedValue({
      id: 42,
      name: 'Test Student',
      username: 'student',
      contact_info: 'test@example.com',
      password_hash: passwordHash,
    });

    const agent = request.agent(app);
    const login = await agent.post('/login').send({ username: 'Student', password: 'valid-password' });

    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(42);

    User.findPublicById.mockResolvedValue({
      id: 42,
      name: 'Test Student',
      username: 'student',
      contact_info: 'test@example.com',
    });

    const me = await agent.get('/users/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('student');
  });

  test('POST /login uses a generic error for invalid credentials', async () => {
    User.findByUsername.mockResolvedValue(null);

    const res = await request(app).post('/login').send({
      username: 'missing-user',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid username or password' });
  });

  test('GET /users/me requires authentication', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  test('POST /logout destroys the session', async () => {
    const passwordHash = await bcrypt.hash('valid-password', 4);
    User.findByUsername.mockResolvedValue({
      id: 7,
      name: 'Test Student',
      username: 'student',
      contact_info: 'test@example.com',
      password_hash: passwordHash,
    });

    const agent = request.agent(app);
    await agent.post('/login').send({ username: 'student', password: 'valid-password' });

    const logout = await agent.post('/logout');
    expect(logout.status).toBe(204);

    const me = await agent.get('/users/me');
    expect(me.status).toBe(401);
  });
});
