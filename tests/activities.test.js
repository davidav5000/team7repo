const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../models/db', () => ({ query: jest.fn() }));
jest.mock('../models/user', () => ({
  findByUsername: jest.fn(),
  create: jest.fn(),
  findPublicById: jest.fn(),
}));

const db = require('../models/db');
const User = require('../models/user');
const createApp = require('../app');

const input = {
  title: 'Board Game Night',
  startsAt: '2026-10-20T18:00:00-06:00',
  location: 'Student Union',
  description: 'Bring your favorite game.',
};
const activity = {
  id: 12,
  creatorId: 42,
  creatorUsername: 'student',
  ...input,
  latitude: null,
  longitude: null,
  goingCount: 2,
};

describe('activity routes through the application', () => {
  let app;
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('valid-password', 4);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    app = createApp();
    User.findByUsername.mockResolvedValue({
      id: 42,
      username: 'student',
      password_hash: passwordHash,
    });
  });

  async function login() {
    const agent = request.agent(app);
    const res = await agent.post('/login').send({
      username: 'student',
      password: 'valid-password',
    });
    expect(res.status).toBe(200);
    return agent;
  }

  test('GET /activities returns the public feed, including an empty feed', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [activity] })
      .mockResolvedValueOnce({ rows: [] });
    const feed = await request(app).get('/activities');
    expect(feed.status).toBe(200);
    expect(feed.body).toEqual({ activities: [activity] });
    const empty = await request(app).get('/activities');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ activities: [] });
  });

  test('GET /activities/:id returns a public activity', async () => {
    db.query.mockResolvedValue({ rows: [activity] });
    const res = await request(app).get('/activities/12');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ activity });
    expect(db.query.mock.calls[0][1]).toEqual([12]);
  });

  test.each(['post', 'put', 'delete'])(
    '%s requires a logged-in session',
    async (method) => {
      const path = method === 'post' ? '/activities' : '/activities/12';
      const res = await request(app)[method](path).send(input);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  test('POST uses the session owner, trims text, and stores absent coordinates as NULL', async () => {
    const agent = await login();
    db.query.mockResolvedValue({ rows: [activity] });
    const res = await agent.post('/activities').send({
      ...input,
      title: ' Board Game Night ',
      creatorId: 7,
      creator_id: 7,
      user: { id: 7 },
    });
    expect(res.status).toBe(201);
    expect(res.body.activity.creatorId).toBe(42);
    expect(res.body.activity.goingCount).toBe(0);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO activities');
    expect(params).toEqual([
      42,
      input.title,
      input.startsAt,
      input.location,
      input.description,
      null,
      null,
    ]);
  });

  test('POST accepts the existing HTML form with blank optional coordinates', async () => {
    const agent = await login();
    db.query.mockResolvedValue({ rows: [activity] });
    const res = await agent
      .post('/activities')
      .type('form')
      .send({
        ...input,
        startsAt: '2026-10-20T18:00',
        latitude: '',
        longitude: '',
      });
    expect(res.status).toBe(201);
    expect(db.query.mock.calls[0][1]).toEqual([
      42,
      input.title,
      '2026-10-20T18:00',
      input.location,
      input.description,
      null,
      null,
    ]);
  });

  test('POST accepts zero coordinates and numeric form strings', async () => {
    const agent = await login();
    db.query.mockResolvedValue({ rows: [{ ...activity, latitude: 0, longitude: 0 }] });
    const res = await agent.post('/activities').send({
      ...input,
      latitude: '0',
      longitude: 0,
    });
    expect(res.status).toBe(201);
    expect(db.query.mock.calls[0][1].slice(-2)).toEqual([0, 0]);
  });

  test.each([
    ['missing title', { title: undefined }],
    ['blank title', { title: '   ' }],
    ['long title', { title: 'x'.repeat(121) }],
    ['non-string title', { title: {} }],
    ['blank location', { location: ' ' }],
    ['long location', { location: 'x'.repeat(201) }],
    ['blank description', { description: ' ' }],
    ['missing startsAt', { startsAt: undefined, date: input.startsAt }],
    ['invalid date', { startsAt: 'tomorrow' }],
    ['impossible date', { startsAt: '2026-02-30T18:00:00Z' }],
    ['date without time', { startsAt: '2026-10-20' }],
    ['latitude alone', { latitude: 10 }],
    ['longitude alone', { longitude: 10 }],
    ['latitude outside range', { latitude: 91, longitude: 0 }],
    ['longitude outside range', { latitude: 0, longitude: -181 }],
    ['non-numeric coordinates', { latitude: 'abc', longitude: 0 }],
    ['boolean coordinates', { latitude: true, longitude: false }],
    ['array coordinates', { latitude: [], longitude: [] }],
    ['whitespace coordinates', { latitude: ' ', longitude: ' ' }],
  ])('POST rejects %s before querying PostgreSQL', async (_label, fields) => {
    const agent = await login();
    const res = await agent.post('/activities').send({ ...input, ...fields });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid activity data');
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each(['0', '-1', '1.5', 'abc', '2147483648'])(
    'GET rejects invalid ID %s',
    async (id) => {
      const res = await request(app).get(`/activities/${id}`);
      expect(res.status).toBe(400);
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  test.each(['get', 'put', 'delete'])(
    '%s returns 404 for a missing activity',
    async (method) => {
      const agent = await login();
      db.query.mockResolvedValue({ rows: [] });
      const res = await agent[method]('/activities/12').send(input);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Activity not found' });
      expect(db.query).toHaveBeenCalledTimes(1);
    },
  );

  test.each(['put', 'delete'])("%s refuses another user's activity", async (method) => {
    const agent = await login();
    db.query.mockResolvedValue({ rows: [{ ...activity, creatorId: 7 }] });
    const res = await agent[method]('/activities/12').send(input);
    expect(res.status).toBe(403);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test("PUT updates the owner's activity and clears omitted coordinates", async () => {
    const agent = await login();
    db.query.mockResolvedValueOnce({ rows: [activity] }).mockResolvedValueOnce({
      rows: [{ ...activity, title: 'Updated title' }],
    });
    const res = await agent
      .put('/activities/12')
      .send({ ...input, title: 'Updated title' });
    expect(res.status).toBe(200);
    expect(res.body.activity.title).toBe('Updated title');
    expect(res.body.activity.creatorUsername).toBe('student');
    expect(res.body.activity.goingCount).toBe(2);
    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toContain('UPDATE activities');
    expect(sql).toContain('updated_at = now()');
    expect(params).toEqual([
      12,
      'Updated title',
      input.startsAt,
      input.location,
      input.description,
      null,
      null,
    ]);
  });

  test('PUT validates the replacement fields before querying PostgreSQL', async () => {
    const agent = await login();
    const res = await agent.put('/activities/12').send({ ...input, startsAt: 'bad' });
    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("DELETE removes the owner's activity and returns no content", async () => {
    const agent = await login();
    db.query
      .mockResolvedValueOnce({ rows: [activity] })
      .mockResolvedValueOnce({ rows: [{ id: 12 }] });
    const res = await agent.delete('/activities/12');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(db.query.mock.calls[1][0]).toContain('DELETE FROM activities');
    expect(db.query.mock.calls[1][1]).toEqual([12]);
  });

  test.each(['put', 'delete'])(
    '%s returns 404 if the row disappears during the request',
    async (method) => {
      const agent = await login();
      db.query
        .mockResolvedValueOnce({ rows: [activity] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await agent[method]('/activities/12').send(input);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Activity not found' });
    },
  );

  test('database failures reach the application JSON error handler', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      db.query.mockRejectedValue(new Error('Database unavailable'));
      const res = await request(app).get('/activities');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Database unavailable' });
    } finally {
      log.mockRestore();
    }
  });
});
