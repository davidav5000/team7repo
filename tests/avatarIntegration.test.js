// Opt-in live PostgreSQL tests. All tables live in pg_temp and changes roll back.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const request = require('supertest');
const bcrypt = require('bcryptjs');

let mockClient;
jest.mock('../models/db', () => ({
  query: (sql, params) => mockClient.query(sql, params),
}));

const createApp = require('../app');
const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
const describeDatabase = process.env.AVATAR_TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('avatar PostgreSQL integration', () => {
  beforeAll(async () => {
    mockClient = new Client({
      connectionString: process.env.AVATAR_TEST_DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await mockClient.connect();
  });

  beforeEach(async () => {
    await mockClient.query('BEGIN');
    // Creating a temp table initializes pg_temp before the schema is applied.
    await mockClient.query('CREATE TEMP TABLE avatar_test_bootstrap (id INTEGER)');
    await mockClient.query('SET LOCAL search_path TO pg_temp');
  });

  afterEach(async () => {
    await mockClient.query('ROLLBACK');
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

    const avatarUrl = 'https://example.com/alice.jpg';
    const updated = await aliceAgent
      .put('/users/me/avatar')
      .send({ avatarUrl, userId: bob.id });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({ avatarUrl });
    const me = await aliceAgent.get('/users/me');
    expect(me.body.user.avatarUrl).toBe(avatarUrl);
    const bobProfile = await bobAgent.get('/users/me');
    expect(bobProfile.body.user.avatarUrl).toBeNull();

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

    const removed = await aliceAgent.put('/users/me/avatar').send({ avatarUrl: null });
    expect(removed.status).toBe(200);
    const afterRemoval = await request(app).get(commentsUrl);
    expect(
      afterRemoval.body.comments.every((comment) => comment.authorAvatarUrl === null),
    ).toBe(true);
  });
});
