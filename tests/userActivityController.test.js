const express = require('express');
const request = require('supertest');

jest.mock('../models/userActivity', () => ({
  listHostedByUser: jest.fn(),
  listGoingByUser: jest.fn(),
}));

const UserActivity = require('../models/userActivity');
const usersRouter = require('../routes/users');

function createTestApp() {
  const app = express();

  app.use((req, res, next) => {
    const userId = req.get('x-test-user-id');
    if (userId) req.session = { userId: Number(userId) };
    next();
  });

  app.use('/users', usersRouter);
  return app;
}

describe('GET /users/me/activities', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/users/me/activities');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
    expect(UserActivity.listHostedByUser).not.toHaveBeenCalled();
    expect(UserActivity.listGoingByUser).not.toHaveBeenCalled();
  });

  test('returns hosted and attending activities for the session user', async () => {
    UserActivity.listHostedByUser.mockResolvedValue([
      {
        id: 1,
        creatorId: 42,
        creatorUsername: 'student',
        title: 'Robotics Club',
        goingCount: 3,
      },
    ]);
    UserActivity.listGoingByUser.mockResolvedValue([
      {
        id: 2,
        creatorId: 7,
        creatorUsername: 'host',
        title: 'Board Game Night',
        goingCount: 5,
      },
    ]);

    const res = await request(app)
      .get('/users/me/activities')
      .set('x-test-user-id', '42');

    expect(res.status).toBe(200);
    expect(UserActivity.listHostedByUser).toHaveBeenCalledWith(42);
    expect(UserActivity.listGoingByUser).toHaveBeenCalledWith(42);
    expect(res.body).toEqual({
      hosting: [
        {
          id: 1,
          creatorId: 42,
          creatorUsername: 'student',
          title: 'Robotics Club',
          goingCount: 3,
        },
      ],
      going: [
        {
          id: 2,
          creatorId: 7,
          creatorUsername: 'host',
          title: 'Board Game Night',
          goingCount: 5,
        },
      ],
    });
  });

  test('returns empty arrays when the user has no activities', async () => {
    UserActivity.listHostedByUser.mockResolvedValue([]);
    UserActivity.listGoingByUser.mockResolvedValue([]);

    const res = await request(app)
      .get('/users/me/activities')
      .set('x-test-user-id', '42');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      hosting: [],
      going: [],
    });
  });

  test('passes database failures to the application error handler', async () => {
    const appWithErrorHandler = createTestApp();
    appWithErrorHandler.use((err, req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    UserActivity.listHostedByUser.mockRejectedValue(
      new Error('Database unavailable'),
    );
    UserActivity.listGoingByUser.mockResolvedValue([]);

    const res = await request(appWithErrorHandler)
      .get('/users/me/activities')
      .set('x-test-user-id', '42');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database unavailable' });
  });
});
