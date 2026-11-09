jest.mock('../models/db', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}));

const db = require('../models/db');
const Avatar = require('../models/avatar');

describe('avatar model', () => {
  const userId = 42;
  const imageData = Buffer.from([0, 255, 128, 1]);
  const revision = '651dce05-ed17-4b96-92b0-b0cf64744f44';
  let client;

  beforeEach(() => {
    jest.resetAllMocks();
    client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: userId }] }),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValue(client);
  });

  test('retrieves bytes only for the requested user and revision', async () => {
    db.query.mockResolvedValue({ rows: [{ imageData, revision }] });
    expect(await Avatar.findByUserId(userId, revision)).toEqual({ imageData, revision });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('user_id = $1 AND revision = $2');
    expect(params).toEqual([userId, revision]);
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  test('returns null for a missing picture or stale revision', async () => {
    db.query.mockResolvedValue({ rows: [] });
    expect(await Avatar.findByUserId(userId, revision)).toBeNull();
  });

  test('replaces bytes and URL together on one connection', async () => {
    const result = await Avatar.replace(userId, imageData);
    const calls = client.query.mock.calls;
    expect(calls[0]).toEqual(['BEGIN']);
    expect(calls[1][0]).toContain('FOR UPDATE');
    expect(calls[1][1]).toEqual([userId]);
    expect(calls[2][0]).toContain('ON CONFLICT (user_id) DO UPDATE');
    const newRevision = calls[2][1][2];
    expect(newRevision).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(calls[2][1]).toEqual([userId, imageData, newRevision]);
    expect(calls[3]).toEqual([
      'UPDATE users SET avatar_url = $2 WHERE id = $1',
      [userId, `/users/${userId}/avatar?v=${newRevision}`],
    ]);
    expect(calls[4]).toEqual(['COMMIT']);
    expect(result).toEqual({ avatarUrl: `/users/${userId}/avatar?v=${newRevision}` });
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('each replacement generates a new revision', async () => {
    const first = await Avatar.replace(userId, imageData);
    const second = await Avatar.replace(userId, imageData);
    expect(first.avatarUrl).not.toBe(second.avatarUrl);
  });

  test('removes bytes and URL together, including users with only a legacy URL', async () => {
    expect(await Avatar.remove(userId)).toEqual({ avatarUrl: null });
    expect(client.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]],
      ['DELETE FROM user_avatars WHERE user_id = $1', [userId]],
      ['UPDATE users SET avatar_url = $2 WHERE id = $1', [userId, null]],
      ['COMMIT'],
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test.each(['replace', 'remove'])(
    '%s returns null for a missing user',
    async (method) => {
      client.query.mockResolvedValue({ rows: [] });
      expect(await Avatar[method](userId, imageData)).toBeNull();
      expect(client.query.mock.calls).toEqual([
        ['BEGIN'],
        ['SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]],
        ['ROLLBACK'],
      ]);
      expect(client.release).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    ['replace', 'INSERT INTO user_avatars'],
    ['replace', 'UPDATE users'],
    ['remove', 'DELETE FROM user_avatars'],
    ['remove', 'UPDATE users'],
    ['replace', 'COMMIT'],
  ])('%s rolls back on failure at %s', async (method, failingStatement) => {
    const error = new Error('Database unavailable');
    client.query.mockImplementation(async (sql) => {
      if (sql.includes(failingStatement)) throw error;
      return { rows: [{ id: userId }] };
    });
    await expect(Avatar[method](userId, imageData)).rejects.toBe(error);
    expect(client.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
    if (failingStatement !== 'COMMIT') {
      expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    }
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('discards a connection when rollback fails and preserves the original error', async () => {
    const error = new Error('Update failed');
    const rollbackError = new Error('Connection lost');
    client.query.mockImplementation(async (sql) => {
      if (sql.startsWith('UPDATE users')) throw error;
      if (sql === 'ROLLBACK') throw rollbackError;
      return { rows: [{ id: userId }] };
    });
    await expect(Avatar.replace(userId, imageData)).rejects.toBe(error);
    expect(client.release).toHaveBeenCalledWith(rollbackError);
  });

  test('propagates connection acquisition failures', async () => {
    const error = new Error('Pool unavailable');
    db.pool.connect.mockRejectedValue(error);
    await expect(Avatar.replace(userId, imageData)).rejects.toBe(error);
    expect(client.query).not.toHaveBeenCalled();
    expect(client.release).not.toHaveBeenCalled();
  });
});
