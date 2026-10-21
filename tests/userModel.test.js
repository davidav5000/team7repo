jest.mock('../models/db', () => ({
  query: jest.fn(),
}));

const db = require('../models/db');
const User = require('../models/user');

describe('user model database contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findByUsername reads contact and exposes contact_info', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          name: 'Test Student',
          username: 'student',
          contact_info: 'test@example.com',
          password_hash: 'hash',
        },
      ],
    });

    const user = await User.findByUsername('student');

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('contact AS contact_info');
    expect(sql).toContain('lower(username) = lower($1)');
    expect(params).toEqual(['student']);
    expect(user.contact_info).toBe('test@example.com');
  });

  test('create writes contact and aliases it for the API', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 2,
          name: 'New Student',
          username: 'new_student',
          contact_info: 'new@example.com',
        },
      ],
    });

    const user = await User.create({
      name: 'New Student',
      username: 'new_student',
      contactInfo: 'new@example.com',
      passwordHash: 'hashed-password',
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO users (name, username, contact, password_hash)');
    expect(sql).toContain('contact AS contact_info');
    expect(params).toEqual([
      'New Student',
      'new_student',
      'new@example.com',
      'hashed-password',
    ]);
    expect(user.contact_info).toBe('new@example.com');
  });

  test('findPublicById does not select password_hash', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          id: 3,
          name: 'Public Student',
          username: 'public_student',
          contact_info: 'public@example.com',
        },
      ],
    });

    await User.findPublicById(3);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('contact AS contact_info');
    expect(sql).not.toContain('password_hash');
    expect(sql).toContain('avatar_url AS "avatarUrl"');
    expect(params).toEqual([3]);
  });
  test.each(['https://example.com/photo.jpg', null])(
    'updateAvatar writes only the requested account: %s',
    async (avatarUrl) => {
      db.query.mockResolvedValue({ rows: [{ avatarUrl }] });
      expect(await User.updateAvatar(42, avatarUrl)).toEqual({ avatarUrl });
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('UPDATE users');
      expect(sql).toContain('SET avatar_url = $2');
      expect(sql).toContain('WHERE id = $1');
      expect(params).toEqual([42, avatarUrl]);
      expect(sql).not.toContain('contact');
      expect(sql).not.toContain('password_hash');
    },
  );

  test('updateAvatar returns null for a missing account', async () => {
    db.query.mockResolvedValue({ rows: [] });
    expect(await User.updateAvatar(999, null)).toBeNull();
  });
});
