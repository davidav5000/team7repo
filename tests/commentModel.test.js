jest.mock('../models/db', () => ({
  query: jest.fn(),
}));

const db = require('../models/db');
const Comment = require('../models/comment');

describe('comment model database contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listByActivity returns comments with author usernames in chronological order', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          activityId: 9,
          authorId: 2,
          authorUsername: 'student',
          message: 'First',
        },
      ],
    });

    const comments = await Comment.listByActivity(9);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FROM comments c');
    expect(sql).toContain('JOIN users u');
    expect(sql).toContain('u.avatar_url AS "authorAvatarUrl"');
    expect(sql).not.toMatch(/contact|password_hash/);
    expect(sql).toContain('c.activity_id = $1');
    expect(sql).toContain('ORDER BY c.created_at ASC, c.id ASC');
    expect(params).toEqual([9]);
    expect(comments[0].authorUsername).toBe('student');
  });

  test('create inserts a parameterized comment and returns the author username', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 3,
          activityId: 9,
          authorId: 4,
          authorUsername: 'wolf',
          message: 'See you there.',
        },
      ],
    });

    const comment = await Comment.create({
      activityId: 9,
      authorId: 4,
      message: 'See you there.',
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO comments');
    expect(sql).toContain('u.avatar_url AS "authorAvatarUrl"');
    expect(sql).not.toMatch(/contact|password_hash/);
    expect(sql).toContain('JOIN users u');
    expect(params).toEqual([9, 4, 'See you there.']);
    expect(comment.authorUsername).toBe('wolf');
  });
});
