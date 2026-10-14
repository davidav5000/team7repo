jest.mock('../models/db', () => ({
  query: jest.fn(),
}));

const db = require('../models/db');
const UserActivity = require('../models/userActivity');

describe('user activity model database contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listHostedByUser returns activities created by the requested user', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 5,
          creatorId: 42,
          creatorUsername: 'student',
          title: 'Robotics Club',
          goingCount: 3,
        },
      ],
    });

    const activities = await UserActivity.listHostedByUser(42);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FROM activities a');
    expect(sql).toContain('WHERE a.creator_id = $1');
    expect(sql).toContain('ORDER BY a.starts_at ASC');
    expect(sql).toContain('"goingCount"');
    expect(params).toEqual([42]);
    expect(activities[0].creatorId).toBe(42);
  });

  test('listGoingByUser returns only activities where the user is currently going', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 8,
          creatorId: 7,
          creatorUsername: 'host',
          title: 'Board Game Night',
          goingCount: 5,
        },
      ],
    });

    const activities = await UserActivity.listGoingByUser(42);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('JOIN attendance mine');
    expect(sql).toContain('mine.user_id = $1');
    expect(sql).toContain("mine.status = 'going'");
    expect(sql).toContain('ORDER BY a.starts_at ASC');
    expect(params).toEqual([42]);
    expect(activities[0].id).toBe(8);
  });
});
