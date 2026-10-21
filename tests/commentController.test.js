const express = require('express');
const request = require('supertest');

jest.mock('../models/activity', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/comment', () => ({
  listByActivity: jest.fn(),
  create: jest.fn(),
}));

const Activity = require('../models/activity');
const Comment = require('../models/comment');
const commentsRouter = require('../routes/comments');

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const userId = req.get('x-test-user-id');
    if (userId) req.session = { userId: Number(userId) };
    next();
  });

  app.use('/activities/:id/comments', commentsRouter);
  return app;
}

describe('comment routes and controller', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('GET returns comments for an activity', async () => {
    Activity.findById.mockResolvedValue({ id: 9 });
    Comment.listByActivity.mockResolvedValue([
      {
        id: 1,
        activityId: 9,
        authorId: 4,
        authorUsername: 'wolf',
        message: 'See you there.',
      },
    ]);

    const res = await request(app).get('/activities/9/comments');

    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].authorUsername).toBe('wolf');
    expect(Comment.listByActivity).toHaveBeenCalledWith(9);
  });

  test('GET returns 404 when the activity does not exist', async () => {
    Activity.findById.mockResolvedValue(null);

    const res = await request(app).get('/activities/999/comments');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Activity not found' });
    expect(Comment.listByActivity).not.toHaveBeenCalled();
  });

  test('POST requires authentication', async () => {
    const res = await request(app)
      .post('/activities/9/comments')
      .send({ message: 'Hello' });

    expect(res.status).toBe(401);
    expect(Comment.create).not.toHaveBeenCalled();
  });

  test('POST creates a trimmed comment for the current user', async () => {
    Activity.findById.mockResolvedValue({ id: 9 });
    Comment.create.mockResolvedValue({
      id: 3,
      activityId: 9,
      authorId: 4,
      authorUsername: 'wolf',
      message: 'See you there.',
    });

    const res = await request(app)
      .post('/activities/9/comments')
      .set('x-test-user-id', '4')
      .send({ message: '  See you there.  ' });

    expect(res.status).toBe(201);
    expect(Comment.create).toHaveBeenCalledWith({
      activityId: 9,
      authorId: 4,
      message: 'See you there.',
    });
    expect(res.body.comment.authorUsername).toBe('wolf');
  });

  test('POST rejects empty comments', async () => {
    const res = await request(app)
      .post('/activities/9/comments')
      .set('x-test-user-id', '4')
      .send({ message: '    ' });

    expect(res.status).toBe(400);
    expect(Activity.findById).not.toHaveBeenCalled();
    expect(Comment.create).not.toHaveBeenCalled();
  });

  test('POST rejects comments over 2000 characters', async () => {
    const res = await request(app)
      .post('/activities/9/comments')
      .set('x-test-user-id', '4')
      .send({ message: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(Comment.create).not.toHaveBeenCalled();
  });

  test('invalid activity IDs return 400 before querying the database', async () => {
    const res = await request(app).get('/activities/not-a-number/comments');

    expect(res.status).toBe(400);
    expect(Activity.findById).not.toHaveBeenCalled();
    expect(Comment.listByActivity).not.toHaveBeenCalled();
  });
});
