const express = require('express');
const request = require('supertest');

jest.mock('../models/activity', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/attendance', () => ({
  listByActivity: jest.fn(),
  setGoing: jest.fn(),
  setWithdrawn: jest.fn(),
}));

const Activity = require('../models/activity');
const Attendance = require('../models/attendance');
const attendanceRouter = require('../routes/attendance');

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const userId = req.get('x-test-user-id');
    if (userId) req.session = { userId: Number(userId) };
    next();
  });

  app.use('/activities/:id/attendance', attendanceRouter);
  return app;
}

describe('attendance routes and controller', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('GET returns attendees and whether the current user is going', async () => {
    Activity.findById.mockResolvedValue({ id: 9 });
    Attendance.listByActivity.mockResolvedValue([
      { userId: 4, username: 'wolf' },
      { userId: 7, username: 'student' },
    ]);

    const res = await request(app)
      .get('/activities/9/attendance')
      .set('x-test-user-id', '4');

    expect(res.status).toBe(200);
    expect(res.body.attendance.goingCount).toBe(2);
    expect(res.body.attendance.currentUserGoing).toBe(true);
    expect(res.body.attendance.attendees).toHaveLength(2);
    expect(Attendance.listByActivity).toHaveBeenCalledWith(9);
  });

  test('GET works for a signed-out user', async () => {
    Activity.findById.mockResolvedValue({ id: 9 });
    Attendance.listByActivity.mockResolvedValue([
      { userId: 4, username: 'wolf' },
    ]);

    const res = await request(app).get('/activities/9/attendance');

    expect(res.status).toBe(200);
    expect(res.body.attendance.currentUserGoing).toBe(false);
  });

  test('GET returns 404 when the activity does not exist', async () => {
    Activity.findById.mockResolvedValue(null);

    const res = await request(app).get('/activities/999/attendance');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Activity not found' });
    expect(Attendance.listByActivity).not.toHaveBeenCalled();
  });

  test('POST requires authentication', async () => {
    const res = await request(app).post('/activities/9/attendance');

    expect(res.status).toBe(401);
    expect(Attendance.setGoing).not.toHaveBeenCalled();
  });

  test('POST marks the current user as going and returns the new state', async () => {
    Activity.findById.mockResolvedValue({ id: 9 });
    Attendance.setGoing.mockResolvedValue({
      userId: 4,
      activityId: 9,
      status: 'going',
    });
    Attendance.listByActivity.mockResolvedValue([
      { userId: 4, username: 'wolf' },
    ]);

    const res = await request(app)
      .post('/activities/9/attendance')
      .set('x-test-user-id', '4');

    expect(res.status).toBe(200);
    expect(Attendance.setGoing).toHaveBeenCalledWith(9, 4);
    expect(res.body.attendance.goingCount).toBe(1);
    expect(res.body.attendance.currentUserGoing).toBe(true);
  });

  test('DELETE withdraws the current user and is safe if they were not going', async () => {
    Activity.findById.mockResolvedValue({ id: 9 });
    Attendance.setWithdrawn.mockResolvedValue(null);
    Attendance.listByActivity.mockResolvedValue([]);

    const res = await request(app)
      .delete('/activities/9/attendance')
      .set('x-test-user-id', '4');

    expect(res.status).toBe(200);
    expect(Attendance.setWithdrawn).toHaveBeenCalledWith(9, 4);
    expect(res.body.attendance.goingCount).toBe(0);
    expect(res.body.attendance.currentUserGoing).toBe(false);
  });

  test('invalid activity IDs return 400 before querying the database', async () => {
    const res = await request(app).get('/activities/not-a-number/attendance');

    expect(res.status).toBe(400);
    expect(Activity.findById).not.toHaveBeenCalled();
    expect(Attendance.listByActivity).not.toHaveBeenCalled();
  });
});
