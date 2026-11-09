// Opt-in live PostgreSQL tests. Tables live only in pg_temp and are discarded.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

let mockClient;
jest.mock('../models/db', () => ({
  query: (sql, params) => mockClient.query(sql, params),
  pool: {
    connect: async () => ({
      query: (sql, params) => mockClient.query(sql, params),
      release: () => {},
    }),
  },
}));

const createApp = require('../app');
const Avatar = require('../models/avatar');
const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
const describeDatabase = process.env.AVATAR_TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('avatar model PostgreSQL transactions', () => {
  let userId;
  const imageData = Buffer.from([0, 255, 128, 1]);

  beforeAll(async () => {
    mockClient = new Client({
      connectionString: process.env.AVATAR_TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await mockClient.connect();
  });

  beforeEach(async () => {
    // Session-local temporary tables let model methods use real BEGIN/COMMIT.
    await mockClient.query('CREATE TEMP TABLE avatar_test_bootstrap (id INTEGER)');
    await mockClient.query('SET search_path TO pg_temp');
    await mockClient.query(schema);
    const users = await mockClient.query(
      `INSERT INTO users (name, username, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Student', 'student', 'test-hash'],
    );
    userId = users.rows[0].id;
  });

  afterEach(async () => {
    await mockClient.query('ROLLBACK');
    await mockClient.query('DISCARD TEMP');
  });

  afterAll(async () => {
    await mockClient.end();
  });

  test('saves, replaces, retrieves by revision, and removes a picture', async () => {
    const first = await Avatar.replace(userId, imageData);
    const revision = new URL(first.avatarUrl, 'https://example.com').searchParams.get(
      'v',
    );
    expect(await Avatar.findByUserId(userId, revision)).toEqual({ imageData, revision });
    expect((await mockClient.query('SELECT avatar_url FROM users')).rows).toEqual([
      { avatar_url: first.avatarUrl },
    ]);

    const second = await Avatar.replace(userId, Buffer.from([2, 3]));
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
    expect(await Avatar.findByUserId(userId, revision)).toBeNull();
    const pictures = await mockClient.query('SELECT image_data FROM user_avatars');
    expect(pictures.rows).toEqual([{ image_data: Buffer.from([2, 3]) }]);

    expect(await Avatar.remove(userId)).toEqual({ avatarUrl: null });
    expect((await mockClient.query('SELECT * FROM user_avatars')).rows).toEqual([]);
    expect((await mockClient.query('SELECT avatar_url FROM users')).rows).toEqual([
      { avatar_url: null },
    ]);
  });

  test.each(['replace', 'remove'])(
    '%s restores the previous bytes and URL when the URL update fails',
    async (method) => {
      const oldUrl = 'https://example.com/old.jpg';
      const revision = '651dce05-ed17-4b96-92b0-b0cf64744f44';
      await mockClient.query('UPDATE users SET avatar_url = $2 WHERE id = $1', [
        userId,
        oldUrl,
      ]);
      await mockClient.query(
        'INSERT INTO user_avatars (user_id, image_data, revision) VALUES ($1, $2, $3)',
        [userId, imageData, revision],
      );
      // Force the second write to fail after the bytes have changed or been deleted.
      await mockClient.query(
        `ALTER TABLE users ADD CONSTRAINT test_avatar_url
         CHECK (avatar_url IS NOT NULL AND avatar_url LIKE 'https://%')`,
      );

      await expect(Avatar[method](userId, Buffer.from([9]))).rejects.toMatchObject({
        code: '23514',
      });
      expect(await Avatar.findByUserId(userId, revision)).toEqual({
        imageData,
        revision,
      });
      expect((await mockClient.query('SELECT avatar_url FROM users')).rows).toEqual([
        { avatar_url: oldUrl },
      ]);
    },
  );
});

describeDatabase('avatar PostgreSQL integration', () => {
  beforeAll(async () => {
    mockClient = new Client({
      connectionString: process.env.AVATAR_TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await mockClient.connect();
  });

  beforeEach(async () => {
    // Creating a temp table initializes pg_temp before the schema is applied.
    await mockClient.query('CREATE TEMP TABLE avatar_test_bootstrap (id INTEGER)');
    await mockClient.query('SET search_path TO pg_temp');
  });

  afterEach(async () => {
    await mockClient.query('ROLLBACK');
    await mockClient.query('DISCARD TEMP');
  });

  afterAll(async () => {
    await mockClient.end();
  });

  test('initializes a fresh schema twice with nullable avatar URLs', async () => {
    await mockClient.query(schema);
    await mockClient.query(schema);
    const result = await mockClient.query(
      `INSERT INTO users (name, username, password_hash)
       VALUES ($1, $2, $3) RETURNING avatar_url`,
      ['Student', 'student', 'test-hash'],
    );
    expect(result.rows).toEqual([{ avatar_url: null }]);
  });

  test('upgrades an existing users table twice without losing its data', async () => {
    await mockClient.query(`CREATE TABLE users (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(30) NOT NULL,
      contact VARCHAR(255),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await mockClient.query(
      `INSERT INTO users (name, username, contact, password_hash)
       VALUES ($1, $2, $3, $4)`,
      ['Existing Student', 'existing', 'private@example.com', 'existing-hash'],
    );
    await mockClient.query(schema);
    await mockClient.query(schema);
    const result = await mockClient.query(
      'SELECT username, contact, password_hash, avatar_url FROM users',
    );
    expect(result.rows).toEqual([
      {
        username: 'existing',
        contact: 'private@example.com',
        password_hash: 'existing-hash',
        avatar_url: null,
      },
    ]);
  });

  test('preserves existing URL pictures when adding upload storage', async () => {
    await mockClient.query(schema);
    const avatarUrl = 'https://example.com/existing.jpg';
    await mockClient.query(
      `INSERT INTO users (name, username, password_hash, avatar_url)
       VALUES ($1, $2, $3, $4)`,
      ['Existing Student', 'existing', 'test-hash', avatarUrl],
    );
    await mockClient.query('DROP TABLE user_avatars');

    await mockClient.query(schema);
    await mockClient.query(schema);

    const users = await mockClient.query('SELECT avatar_url FROM users');
    expect(users.rows).toEqual([{ avatar_url: avatarUrl }]);
    const avatars = await mockClient.query('SELECT * FROM user_avatars');
    expect(avatars.rows).toEqual([]);
  });

  test('round-trips binary picture data and deletes it with its user', async () => {
    await mockClient.query(schema);
    const users = await mockClient.query(
      `INSERT INTO users (name, username, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Student', 'student', 'test-hash'],
    );
    const userId = users.rows[0].id;
    // Arbitrary bytes exercise BYTEA storage; image validation belongs to processing.
    const imageData = Buffer.from([0, 255, 128, 1]);
    const revision = '651dce05-ed17-4b96-92b0-b0cf64744f44';
    await mockClient.query(
      `INSERT INTO user_avatars (user_id, image_data, revision)
       VALUES ($1, $2, $3)`,
      [userId, imageData, revision],
    );
    // Re-running setup must preserve stored pictures too.
    await mockClient.query(schema);
    const avatars = await mockClient.query(
      'SELECT user_id, image_data, revision FROM user_avatars WHERE user_id = $1',
      [userId],
    );
    expect(avatars.rows).toEqual([{ user_id: userId, image_data: imageData, revision }]);

    await mockClient.query('DELETE FROM users WHERE id = $1', [userId]);
    expect((await mockClient.query('SELECT * FROM user_avatars')).rows).toEqual([]);
  });

  test.each([
    ['duplicate user', '23505'],
    ['missing user', '23503'],
    ['empty image', '23514'],
    ['null image', '23502'],
    ['null revision', '23502'],
    ['invalid revision', '22P02'],
  ])('rejects %s in upload storage', async (scenario, code) => {
    await mockClient.query(schema);
    const users = await mockClient.query(
      `INSERT INTO users (name, username, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Student', 'student', 'test-hash'],
    );
    const userId = users.rows[0].id;
    const revision = '651dce05-ed17-4b96-92b0-b0cf64744f44';
    const insert = `INSERT INTO user_avatars (user_id, image_data, revision)
                    VALUES ($1, $2, $3)`;
    if (scenario === 'duplicate user') {
      await mockClient.query(insert, [userId, Buffer.from([1]), revision]);
    }
    await expect(
      mockClient.query(insert, [
        scenario === 'missing user' ? userId + 1 : userId,
        scenario === 'null image'
          ? null
          : Buffer.from(scenario === 'empty image' ? [] : [1]),
        scenario === 'null revision'
          ? null
          : scenario === 'invalid revision'
            ? 'invalid'
            : revision,
      ]),
    ).rejects.toMatchObject({ code });
  });

  test('comments use current account pictures and avatar updates cannot affect another account', async () => {
    await mockClient.query(schema);
    const passwordHash = await bcrypt.hash('valid-password', 4);
    const users = await mockClient.query(
      `INSERT INTO users (name, username, contact, password_hash)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $4) RETURNING id`,
      [
        'Alice',
        'alice',
        'alice@example.com',
        passwordHash,
        'Bob',
        'bob',
        'bob@example.com',
      ],
    );
    const [alice, bob] = users.rows;
    const event = await mockClient.query(
      `INSERT INTO activities (creator_id, title, starts_at, location, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [alice.id, 'Games', '2026-10-20T18:00:00Z', 'Campus', 'Play games.'],
    );
    const commentsUrl = `/activities/${event.rows[0].id}/comments`;
    const app = createApp();
    const aliceAgent = request.agent(app);
    const bobAgent = request.agent(app);
    for (const [agent, username] of [
      [aliceAgent, 'alice'],
      [bobAgent, 'bob'],
    ]) {
      const login = await agent
        .post('/login')
        .send({ username, password: 'valid-password' });
      expect(login.status).toBe(200);
    }

    const posted = await aliceAgent.post(commentsUrl).send({
      message: ' Hello ',
      authorId: bob.id,
      authorUsername: 'bob',
      authorAvatarUrl: 'https://example.com/spoof.jpg',
    });
    expect(posted.status).toBe(201);
    expect(posted.body.comment).toMatchObject({
      authorId: alice.id,
      authorUsername: 'alice',
      authorAvatarUrl: null,
      message: 'Hello',
    });

    const png = await sharp({
      create: { width: 10, height: 20, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const updated = await aliceAgent
      .put(`/users/me/avatar?userId=${bob.id}`)
      .attach('avatar', png, 'alice.png');
    expect(updated.status).toBe(200);
    const { avatarUrl } = updated.body;
    expect(avatarUrl).toMatch(new RegExp(`^/users/${alice.id}/avatar\\?v=`));
    const image = await request(app).get(avatarUrl);
    expect(image.status).toBe(200);
    expect(await sharp(image.body).metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
    const me = await aliceAgent.get('/users/me');
    expect(me.body.user.avatarUrl).toBe(avatarUrl);
    const bobProfile = await bobAgent.get('/users/me');
    expect(bobProfile.body.user.avatarUrl).toBeNull();

    const invalid = await aliceAgent
      .put('/users/me/avatar')
      .attach('avatar', Buffer.from('invalid picture'), 'broken.png');
    expect(invalid.status).toBe(400);
    expect((await aliceAgent.get('/users/me')).body.user.avatarUrl).toBe(avatarUrl);
    expect((await request(app).get(avatarUrl)).body).toEqual(image.body);

    const second = await aliceAgent
      .post(commentsUrl)
      .send({ message: 'Another comment' });
    expect(second.status).toBe(201);
    expect(second.body.comment.authorAvatarUrl).toBe(avatarUrl);
    const listed = await request(app).get(commentsUrl);
    expect(listed.status).toBe(200);
    expect(listed.body.comments.map((comment) => comment.message)).toEqual([
      'Hello',
      'Another comment',
    ]);
    for (const comment of listed.body.comments) {
      expect(comment.authorAvatarUrl).toBe(avatarUrl);
      expect(comment).not.toHaveProperty('contact');
      expect(comment).not.toHaveProperty('contact_info');
      expect(comment).not.toHaveProperty('password_hash');
    }

    const replaced = await aliceAgent
      .put('/users/me/avatar')
      .attach('avatar', png, 'new.png');
    expect(replaced.status).toBe(200);
    expect(replaced.body.avatarUrl).not.toBe(avatarUrl);
    expect((await request(app).get(avatarUrl)).status).toBe(404);
    expect((await request(app).get(commentsUrl)).body.comments[0].authorAvatarUrl).toBe(
      replaced.body.avatarUrl,
    );

    const removed = await aliceAgent.delete('/users/me/avatar');
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ avatarUrl: null });
    expect((await request(app).get(replaced.body.avatarUrl)).status).toBe(404);
    const afterRemoval = await request(app).get(commentsUrl);
    expect(
      afterRemoval.body.comments.every((comment) => comment.authorAvatarUrl === null),
    ).toBe(true);
  });
});
