const express = require('express');
const request = require('supertest');

jest.mock('../models/activity', () => ({
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deleteById: jest.fn(),
}));

const Activity = require('../models/activity');
const requireAuth = require('../middleware/requireAuth');
const {
  activityIdValidation,
  activityValidation,
} = require('../middleware/activityValidation');
const {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activityController');

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const userId = req.get('x-test-user-id');
    if (userId) req.session = { userId: Number(userId) };
    next();
  });

  app.get('/activities', listActivities);
  app.get('/activities/:id', activityIdValidation, getActivity);
  app.post('/activities', requireAuth, activityValidation, createActivity);
  app.put(
    '/activities/:id',
    requireAuth,
    activityIdValidation,
    activityValidation,
    updateActivity,
  );
  app.delete(
    '/activities/:id',
    requireAuth,
    activityIdValidation,
    deleteActivity,
  );

  return app;
}

const validActivity = {
  title: 'Robotics Club',
  startsAt: '2026-10-20T18:00:00-06:00',
  location: 'STC 101',
  description: 'Build robots.',
  latitude: 43.826,
  longitude: -111.789,
};

describe('activity controller', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('GET /activities returns the feed', async () => {
    Activity.list.mockResolvedValue([
      {
        id: 1,
        creatorId: 3,
        creatorUsername: 'student',
        title: 'Robotics Club',
        goingCount: 4,
      },
    ]);

    const res = await request(app).get('/activities');

    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(1);
    expect(Activity.list).toHaveBeenCalledTimes(1);
  });

  test('GET /activities/:id returns 404 when the activity does not exist', async () => {
    Activity.findById.mockResolvedValue(null);

    const res = await request(app).get('/activities/999');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Activity not found' });
  });

  test('POST /activities requires authentication', async () => {
    const res = await request(app).post('/activities').send(validActivity);

    expect(res.status).toBe(401);
    expect(Activity.create).not.toHaveBeenCalled();
  });

  test('POST /activities creates an activity owned by the session user', async () => {
    Activity.create.mockResolvedValue({
      id: 12,
      creatorId: 42,
      ...validActivity,
    });

    const res = await request(app)
      .post('/activities')
      .set('x-test-user-id', '42')
      .send(validActivity);

    expect(res.status).toBe(201);
    expect(Activity.create).toHaveBeenCalledWith({
      creatorId: 42,
      ...validActivity,
    });
    expect(res.body.activity.goingCount).toBe(0);
  });

  test('POST /activities accepts an activity without coordinates', async () => {
    const withoutCoordinates = {
      title: 'Study Group',
      startsAt: '2026-10-21T19:00:00-06:00',
      location: 'Library',
      description: 'Study together.',
    };

    Activity.create.mockResolvedValue({
      id: 13,
      creatorId: 42,
      ...withoutCoordinates,
      latitude: null,
      longitude: null,
    });

    const res = await request(app)
      .post('/activities')
      .set('x-test-user-id', '42')
      .send(withoutCoordinates);

    expect(res.status).toBe(201);
    expect(Activity.create).toHaveBeenCalledWith({
      creatorId: 42,
      ...withoutCoordinates,
      latitude: null,
      longitude: null,
    });
  });

  test('POST /activities rejects only one coordinate', async () => {
    const body = { ...validActivity };
    delete body.longitude;

    const res = await request(app)
      .post('/activities')
      .set('x-test-user-id', '42')
      .send(body);

    expect(res.status).toBe(400);
    expect(Activity.create).not.toHaveBeenCalled();
  });

  test('PUT /activities/:id rejects a non-owner', async () => {
    Activity.findById.mockResolvedValue({
      id: 12,
      creatorId: 7,
      creatorUsername: 'owner',
      goingCount: 2,
    });

    const res = await request(app)
      .put('/activities/12')
      .set('x-test-user-id', '42')
      .send(validActivity);

    expect(res.status).toBe(403);
    expect(Activity.update).not.toHaveBeenCalled();
  });

  test('PUT /activities/:id updates an activity for its creator', async () => {
    Activity.findById.mockResolvedValue({
      id: 12,
      creatorId: 42,
      creatorUsername: 'student',
      goingCount: 2,
    });
    Activity.update.mockResolvedValue({
      id: 12,
      creatorId: 42,
      ...validActivity,
    });

    const res = await request(app)
      .put('/activities/12')
      .set('x-test-user-id', '42')
      .send(validActivity);

    expect(res.status).toBe(200);
    expect(Activity.update).toHaveBeenCalledWith(12, validActivity);
    expect(res.body.activity.creatorUsername).toBe('student');
    expect(res.body.activity.goingCount).toBe(2);
  });

  test('DELETE /activities/:id rejects a non-owner', async () => {
    Activity.findById.mockResolvedValue({
      id: 12,
      creatorId: 7,
    });

    const res = await request(app)
      .delete('/activities/12')
      .set('x-test-user-id', '42');

    expect(res.status).toBe(403);
    expect(Activity.deleteById).not.toHaveBeenCalled();
  });

  test('DELETE /activities/:id removes an activity for its creator', async () => {
    Activity.findById.mockResolvedValue({
      id: 12,
      creatorId: 42,
    });
    Activity.deleteById.mockResolvedValue({ id: 12 });

    const res = await request(app)
      .delete('/activities/12')
      .set('x-test-user-id', '42');

    expect(res.status).toBe(204);
    expect(Activity.deleteById).toHaveBeenCalledWith(12);
  });

  test('invalid activity IDs return 400 before hitting the model', async () => {
    const res = await request(app).get('/activities/not-a-number');

    expect(res.status).toBe(400);
    expect(Activity.findById).not.toHaveBeenCalled();
  });
});
