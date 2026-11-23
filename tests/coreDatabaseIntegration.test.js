// Opt-in real PostgreSQL tests. Never use the application's DATABASE_URL.
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

let mockClient;
jest.mock('../models/db', () => ({
  query: (sql, params) => mockClient.query(sql, params),
}));

const User = require('../models/user');
const Activity = require('../models/activity');
const Attendance = require('../models/attendance');
const Comment = require('../models/comment');
const execFileAsync = promisify(execFile);
const projectRoot = path.join(__dirname, '..');
const schemaSql = fs.readFileSync(path.join(projectRoot, 'db/schema.sql'), 'utf8');
const testDatabaseUrl = process.env.CORE_TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;

function parseExplicitUrl(value, variable) {
  let url;
  try {
    url = new URL(value);
    decodeURIComponent(url.pathname);
  } catch {
    throw new Error(`${variable} must be a valid PostgreSQL URL.`);
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    [
      'host',
      'hostaddr',
      'port',
      'database',
      'dbname',
      'connectionString',
      'service',
    ].some((key) => url.searchParams.has(key))
  ) {
    throw new Error(`${variable} must have an explicit host without target overrides.`);
  }
  return url;
}

function safeTestUrl() {
  const url = parseExplicitUrl(testDatabaseUrl, 'CORE_TEST_DATABASE_URL');
  if (!decodeURIComponent(url.pathname).endsWith('_test')) {
    throw new Error(
      'CORE_TEST_DATABASE_URL must name a dedicated database ending _test.',
    );
  }
  if (process.env.DATABASE_URL) {
    const applicationUrl = parseExplicitUrl(process.env.DATABASE_URL, 'DATABASE_URL');
    if (
      url.hostname === applicationUrl.hostname &&
      (url.port || '5432') === (applicationUrl.port || '5432') &&
      decodeURIComponent(url.pathname) === decodeURIComponent(applicationUrl.pathname)
    ) {
      throw new Error('CORE_TEST_DATABASE_URL must differ from DATABASE_URL.');
    }
  }
  return url;
}

describeDatabase('core PostgreSQL integration', () => {
  let schemaName;
  let schemaCreated;
  let connectionString;
  let passwordHash;

  beforeAll(async () => {
    connectionString = safeTestUrl().toString();
    passwordHash = await bcrypt.hash('integration-test-password', 4);
  });

  beforeEach(async () => {
    // Only internally generated identifiers are interpolated; fixture values use $n.
    schemaName = `core_test_${randomUUID().replaceAll('-', '')}`;
    schemaCreated = false;
    const url = new URL(connectionString);
    // Override any URL options so public/application schemas cannot be searched.
    url.searchParams.set('options', `-c search_path=${schemaName}`);
    mockClient = new Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
    });
    await mockClient.connect();
    await mockClient.query(`CREATE SCHEMA ${schemaName}`);
    schemaCreated = true;
  });

  afterEach(async () => {
    if (!mockClient) return;
    try {
      if (schemaCreated) await mockClient.query(`DROP SCHEMA ${schemaName} CASCADE`);
    } finally {
      await mockClient.end();
      mockClient = undefined;
    }
  });

  async function initialize() {
    await mockClient.query(schemaSql);
  }

  function createUser(username = 'student') {
    return User.create({ name: 'Test Student', username, passwordHash });
  }

  function createActivity(creatorId, coordinates = {}) {
    return Activity.create({
      creatorId,
      title: 'Campus games',
      startsAt: '2030-01-15T18:00:00Z',
      location: 'Student center',
      description: 'Bring a board game.',
      ...coordinates,
    });
  }

  async function runInitializer() {
    const url = new URL(connectionString);
    url.searchParams.set('options', `-c search_path=${schemaName}`);
    // Invoke the same npm lifecycle command on Windows and POSIX without a shell.
    // npm_execpath is provided by the outer `npm test` invocation.
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('Run these tests through npm test.');
    try {
      await execFileAsync(process.execPath, [npmCli, 'run', 'db:init'], {
        cwd: projectRoot,
        env: {
          ...process.env,
          DATABASE_URL: url.toString(),
          NODE_ENV: 'test',
          PGOPTIONS: `-c search_path=${schemaName}`,
        },
        timeout: 15000,
      });
    } catch {
      // Child-process errors contain its environment/arguments; keep credentials private.
      throw new Error('npm run db:init failed in the isolated test schema.');
    }
  }

  test('npm run db:init initializes a fresh schema and safely preserves data on rerun', async () => {
    expect((await mockClient.query('SELECT current_schema() AS name')).rows[0].name).toBe(
      schemaName,
    );
    expect(
      (
        await mockClient.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', [
          schemaName,
        ])
      ).rows,
    ).toEqual([]);
    await runInitializer();
    const tables = await mockClient.query(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
      [schemaName],
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      'activities',
      'attendance',
      'comments',
      'user_avatars',
      'users',
    ]);
    const user = await createUser();
    const activity = await createActivity(user.id);
    await Attendance.setGoing(activity.id, user.id);
    const comment = await Comment.create({
      activityId: activity.id,
      authorId: user.id,
      message: 'Keep this comment.',
    });
    const before = await Activity.findById(activity.id);
    await runInitializer();
    expect(await User.findByUsername('STUDENT')).toMatchObject({ id: user.id });
    expect(await Activity.findById(activity.id)).toEqual(before);
    expect(await Attendance.listByActivity(activity.id)).toHaveLength(1);
    expect(await Comment.listByActivity(activity.id)).toEqual([
      expect.objectContaining({ id: comment.id, message: 'Keep this comment.' }),
    ]);
  }, 40000);

  describe('core relationships and model persistence', () => {
    beforeEach(initialize);

    test('usernames are unique regardless of case', async () => {
      const user = await createUser('Corbin');
      await expect(createUser('corbin')).rejects.toMatchObject({ code: '23505' });
      expect(await User.findByUsername('CORBIN')).toMatchObject({ id: user.id });
      expect((await mockClient.query('SELECT id FROM users')).rows).toEqual([
        { id: user.id },
      ]);
    });

    test.each([
      ['neither', null, null],
      ['both', 43.82, -111.79],
      ['zero coordinates', 0, 0],
    ])('accepts %s coordinates', async (_label, latitude, longitude) => {
      const user = await createUser();
      const activity = await createActivity(user.id, { latitude, longitude });
      expect(await Activity.findById(activity.id)).toMatchObject({ latitude, longitude });
    });

    test.each([
      ['latitude only', 43.82, null],
      ['longitude only', null, -111.79],
    ])('rejects %s', async (_label, latitude, longitude) => {
      const user = await createUser();
      await expect(
        createActivity(user.id, { latitude, longitude }),
      ).rejects.toMatchObject({
        code: '23514',
      });
      expect(await Activity.list()).toEqual([]);
    });

    test('deleting an activity cascades attendance and comments while preserving another activity', async () => {
      const user = await createUser();
      const activity = await createActivity(user.id);
      const other = await createActivity(user.id);
      for (const event of [activity, other]) {
        await Attendance.setGoing(event.id, user.id);
        await Comment.create({
          activityId: event.id,
          authorId: user.id,
          message: 'Hello',
        });
      }
      await Activity.deleteById(activity.id);
      expect(await Activity.findById(activity.id)).toBeNull();
      // Query raw tables too: model JOINs must not hide orphaned rows.
      expect((await mockClient.query('SELECT activity_id FROM attendance')).rows).toEqual(
        [{ activity_id: other.id }],
      );
      expect((await mockClient.query('SELECT activity_id FROM comments')).rows).toEqual([
        { activity_id: other.id },
      ]);
      expect(await Activity.findById(other.id)).toMatchObject({ id: other.id });
    });

    test('deleting a user cascades owned content and interactions without orphaning or deleting unrelated data', async () => {
      const owner = await createUser('owner');
      const other = await createUser('other');
      const ownedActivity = await createActivity(owner.id);
      const otherActivity = await createActivity(other.id);
      for (const event of [ownedActivity, otherActivity]) {
        for (const user of [owner, other]) {
          await Attendance.setGoing(event.id, user.id);
          await Comment.create({
            activityId: event.id,
            authorId: user.id,
            message: 'Hello',
          });
        }
      }
      await mockClient.query('DELETE FROM users WHERE id = $1', [owner.id]);
      expect((await mockClient.query('SELECT id FROM users')).rows).toEqual([
        { id: other.id },
      ]);
      expect(
        (await mockClient.query('SELECT id, creator_id FROM activities')).rows,
      ).toEqual([{ id: otherActivity.id, creator_id: other.id }]);
      expect(
        (await mockClient.query('SELECT user_id, activity_id FROM attendance')).rows,
      ).toEqual([{ user_id: other.id, activity_id: otherActivity.id }]);
      expect(
        (await mockClient.query('SELECT author_id, activity_id FROM comments')).rows,
      ).toEqual([{ author_id: other.id, activity_id: otherActivity.id }]);
    });

    test('persists a create-user -> create-activity -> attend -> comment -> read flow', async () => {
      const user = await createUser();
      const activity = await createActivity(user.id);
      await Attendance.setGoing(activity.id, user.id);
      await Attendance.setGoing(activity.id, user.id);
      const comment = await Comment.create({
        activityId: activity.id,
        authorId: user.id,
        message: 'See you there!',
      });
      expect(await User.findByUsername('student')).toMatchObject({ id: user.id });
      expect(await Activity.findById(activity.id)).toMatchObject({
        creatorId: user.id,
        creatorUsername: 'student',
        title: 'Campus games',
        goingCount: 1,
      });
      expect(await Activity.list()).toEqual([
        expect.objectContaining({ id: activity.id, goingCount: 1 }),
      ]);
      expect(await Attendance.listByActivity(activity.id)).toEqual([
        expect.objectContaining({ userId: user.id, username: 'student' }),
      ]);
      expect((await mockClient.query('SELECT user_id FROM attendance')).rows).toEqual([
        { user_id: user.id },
      ]);
      expect(await Comment.listByActivity(activity.id)).toEqual([
        expect.objectContaining({
          id: comment.id,
          activityId: activity.id,
          authorId: user.id,
          authorUsername: 'student',
          message: 'See you there!',
        }),
      ]);
    });
  });
});
