jest.mock('../models/db', () => ({
  query: jest.fn(),
}));

const db = require('../models/db');
const Attendance = require('../models/attendance');

describe('attendance model database contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listByActivity returns only users currently going', async () => {
    db.query.mockResolvedValue({
      rows: [{ userId: 2, username: 'student' }],
    });

    const attendees = await Attendance.listByActivity(9);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FROM attendance att');
    expect(sql).toContain('JOIN users u');
    expect(sql).toContain("att.status = 'going'");
    expect(sql).toContain('att.activity_id = $1');
    expect(params).toEqual([9]);
    expect(attendees).toEqual([{ userId: 2, username: 'student' }]);
  });

  test('setGoing upserts attendance without creating duplicate rows', async () => {
    db.query.mockResolvedValue({
      rows: [{ userId: 4, activityId: 9, status: 'going' }],
    });

    const attendance = await Attendance.setGoing(9, 4);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO attendance');
    expect(sql).toContain('ON CONFLICT (user_id, activity_id)');
    expect(sql).toContain("status = 'going'");
    expect(params).toEqual([4, 9]);
    expect(attendance.status).toBe('going');
  });

  test('setWithdrawn changes an existing attendance row to withdrawn', async () => {
    db.query.mockResolvedValue({
      rows: [{ userId: 4, activityId: 9, status: 'withdrawn' }],
    });

    const attendance = await Attendance.setWithdrawn(9, 4);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('UPDATE attendance');
    expect(sql).toContain("status = 'withdrawn'");
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain('activity_id = $2');
    expect(params).toEqual([4, 9]);
    expect(attendance.status).toBe('withdrawn');
  });
});
