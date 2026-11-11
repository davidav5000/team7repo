const express = require('express');
const request = require('supertest');

jest.mock('../models/activity', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/comment', () => ({
  listByActivity: jest.fn(),
  create: jest.fn(),
  createReply: jest.fn(),
  updateOwned: jest.fn(),
  deleteOwned: jest.fn(),
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

  test.each(['https://example.com/wolf.jpg', null])(
    'GET returns comments with avatar %s',
    async (avatarUrl) => {
      Activity.findById.mockResolvedValue({ id: 9 });
      Comment.listByActivity.mockResolvedValue([
        {
          id: 1,
          activityId: 9,
          authorId: 4,
          authorUsername: 'wolf',
          authorAvatarUrl: avatarUrl,
          message: 'See you there.',
        },
      ]);

      const res = await request(app).get('/activities/9/comments');

      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].authorUsername).toBe('wolf');
      expect(res.body.comments[0].authorAvatarUrl).toBe(avatarUrl);
      expect(Comment.listByActivity).toHaveBeenCalledWith(9);
    },
  );

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

  test.each(['https://example.com/wolf.jpg', null])(
    'POST creates a comment with the session author avatar %s',
    async (avatarUrl) => {
      Activity.findById.mockResolvedValue({ id: 9 });
      Comment.create.mockResolvedValue({
        id: 3,
        activityId: 9,
        authorId: 4,
        authorUsername: 'wolf',
        authorAvatarUrl: avatarUrl,
        message: 'See you there.',
      });

      const res = await request(app)
        .post('/activities/9/comments')
        .set('x-test-user-id', '4')
        .send({
          message: '  See you there.  ',
          authorId: 99,
          authorUsername: 'imposter',
          authorAvatarUrl: 'https://example.com/imposter.jpg',
          avatarUrl: 'https://example.com/imposter.jpg',
        });

      expect(res.status).toBe(201);
      expect(Comment.create).toHaveBeenCalledWith({
        activityId: 9,
        authorId: 4,
        message: 'See you there.',
      });
      expect(res.body.comment.authorUsername).toBe('wolf');
      expect(res.body.comment.authorAvatarUrl).toBe(avatarUrl);
    },
  );

  test.each(['    ', undefined, null, 123, {}, []])(
    'POST rejects invalid message %j',
    async (message) => {
      const res = await request(app)
        .post('/activities/9/comments')
        .set('x-test-user-id', '4')
        .send({ message });

      expect(res.status).toBe(400);
      expect(Activity.findById).not.toHaveBeenCalled();
      expect(Comment.create).not.toHaveBeenCalled();
    },
  );

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

describe('editing and deleting own comments', () => {
  beforeEach(() => jest.resetAllMocks());
  test.each(['put', 'delete'])('%s requires login', async (method) => {
    const res = await request(createTestApp())[method]('/activities/9/comments/3')
      .send({ message: 'Updated' });
    expect(res.status).toBe(401);
    expect(Comment.updateOwned).not.toHaveBeenCalled();
    expect(Comment.deleteOwned).not.toHaveBeenCalled();
  });
  test('edits using the session author and activity, ignoring supplied ownership', async () => {
    Comment.updateOwned.mockResolvedValue({ id: 3, message: 'Updated' });
    const res = await request(createTestApp())
      .put('/activities/9/comments/3')
      .set('x-test-user-id', '4')
      .send({ message: '  Updated  ', authorId: 99 });
    expect(res.status).toBe(200);
    expect(Comment.updateOwned).toHaveBeenCalledWith({
      id: 3,
      activityId: 9,
      authorId: 4,
      message: 'Updated',
    });
  });
  test('deletes using the session author', async () => {
    Comment.deleteOwned.mockResolvedValue({ id: 3 });
    const res = await request(createTestApp())
      .delete('/activities/9/comments/3')
      .set('x-test-user-id', '4');
    expect(res.status).toBe(204);
    expect(Comment.deleteOwned).toHaveBeenCalledWith({
      id: 3,
      activityId: 9,
      authorId: 4,
    });
  });
  test.each(['put', 'delete'])(
    '%s rejects a missing or unowned comment',
    async (method) => {
      Comment.updateOwned.mockResolvedValue(null);
      Comment.deleteOwned.mockResolvedValue(null);
      const res = await request(createTestApp())[method]('/activities/9/comments/3')
        .set('x-test-user-id', '4')
        .send({ message: 'Updated' });
      expect(res.status).toBe(404);
    },
  );
  test.each(['', ' ', 'x'.repeat(2001), null])(
    'rejects invalid edits',
    async (message) => {
      const res = await request(createTestApp())
        .put('/activities/9/comments/3')
        .set('x-test-user-id', '4')
        .send({ message });
      expect(res.status).toBe(400);
      expect(Comment.updateOwned).not.toHaveBeenCalled();
    },
  );
  test.each(['put', 'delete'])('%s rejects invalid comment IDs', async (method) => {
    const res = await request(createTestApp())[method]('/activities/9/comments/nope')
      .set('x-test-user-id', '4')
      .send({ message: 'Updated' });
    expect(res.status).toBe(400);
    expect(Comment.updateOwned).not.toHaveBeenCalled();
    expect(Comment.deleteOwned).not.toHaveBeenCalled();
  });
});

describe('comment replies', () => {
  beforeEach(() => jest.resetAllMocks());
  const endpoint = '/activities/9/comments/3/replies';
  test('requires login', async () => {
    const res = await request(createTestApp()).post(endpoint).send({ message: 'Hello' });
    expect(res.status).toBe(401);
    expect(Comment.createReply).not.toHaveBeenCalled();
  });
  test('creates a reply using session ownership and the route parent', async () => {
    Comment.createReply.mockResolvedValue({ id: 5, parentId: 3, message: 'Hello' });
    const res = await request(createTestApp())
      .post(endpoint)
      .set('x-test-user-id', '4')
      .send({ message: '  Hello  ', authorId: 99, parentId: 20 });
    expect(res.status).toBe(201);
    expect(Comment.createReply).toHaveBeenCalledWith({
      activityId: 9,
      parentId: 3,
      authorId: 4,
      message: 'Hello',
    });
    expect(res.body.comment.parentId).toBe(3);
  });
  test('rejects missing parents, parents in another activity, and nested parents', async () => {
    Comment.createReply.mockResolvedValue(null);
    const res = await request(createTestApp())
      .post(endpoint)
      .set('x-test-user-id', '4')
      .send({ message: 'Hello' });
    expect(res.status).toBe(404);
  });
  test.each(['', ' ', null, 2, 'x'.repeat(2001)])(
    'rejects invalid reply text',
    async (message) => {
      const res = await request(createTestApp())
        .post(endpoint)
        .set('x-test-user-id', '4')
        .send({ message });
      expect(res.status).toBe(400);
      expect(Comment.createReply).not.toHaveBeenCalled();
    },
  );
  test('rejects invalid parent IDs', async () => {
    const res = await request(createTestApp())
      .post('/activities/9/comments/nope/replies')
      .set('x-test-user-id', '4')
      .send({ message: 'Hello' });
    expect(res.status).toBe(400);
    expect(Comment.createReply).not.toHaveBeenCalled();
  });
});
