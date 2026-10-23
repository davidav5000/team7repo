jest.mock('../models/db', () => ({
  query: jest.fn(),
}));

const db = require('../models/db');
const Activity = require('../models/activity');

describe('activity model database contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('list returns activities ordered by start time', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });

    const activities = await Activity.list();

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FROM activities a');
    expect(sql).toContain('JOIN users u');
    expect(sql).toContain('LEFT JOIN attendance att');
    expect(sql).toContain('ORDER BY a.starts_at ASC');
    expect(params).toEqual([]);
    expect(activities).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('list applies parameterized search filters', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await Activity.list({
      q: 'study',
      location: 'library',
      from: '2026-10-23',
      to: '2026-10-31',
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('a.title ILIKE $1');
    expect(sql).toContain('a.location ILIKE $2');
    expect(sql).toContain('a.starts_at >= $3::date');
    expect(sql).toContain("a.starts_at < ($4::date + INTERVAL '1 day')");
    expect(params).toEqual(['%study%', '%library%', '2026-10-23', '2026-10-31']);
  });

  test('findById uses a parameterized activity ID', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 7, creatorId: 3, creatorUsername: 'student' }],
    });

    const activity = await Activity.findById(7);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('WHERE a.id = $1');
    expect(params).toEqual([7]);
    expect(activity.id).toBe(7);
  });

  test('create inserts into the activities schema with parameterized values', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 11, creatorId: 3, title: 'Robotics Club' }],
    });

    await Activity.create({
      creatorId: 3,
      title: 'Robotics Club',
      startsAt: '2026-10-20T18:00:00-06:00',
      location: 'STC 101',
      description: 'Build robots.',
      latitude: 43.826,
      longitude: -111.789,
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO activities');
    expect(sql).toContain('creator_id');
    expect(sql).toContain('starts_at');
    expect(params).toEqual([
      3,
      'Robotics Club',
      '2026-10-20T18:00:00-06:00',
      'STC 101',
      'Build robots.',
      43.826,
      -111.789,
    ]);
  });

  test('update changes editable fields and refreshes updated_at', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 11, title: 'Updated' }] });

    await Activity.update(11, {
      title: 'Updated',
      startsAt: '2026-10-21T18:00:00-06:00',
      location: 'STC 102',
      description: 'Updated description.',
      latitude: null,
      longitude: null,
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('UPDATE activities');
    expect(sql).toContain('updated_at = now()');
    expect(sql).toContain('WHERE id = $1');
    expect(params).toEqual([
      11,
      'Updated',
      '2026-10-21T18:00:00-06:00',
      'STC 102',
      'Updated description.',
      null,
      null,
    ]);
  });

  test('deleteById deletes only the requested activity', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 11 }] });

    const deleted = await Activity.deleteById(11);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('DELETE FROM activities');
    expect(sql).toContain('WHERE id = $1');
    expect(params).toEqual([11]);
    expect(deleted).toEqual({ id: 11 });
  });
});
