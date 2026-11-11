// Private local development database; never connects to the team's shared database.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const data = path.join(root, '.local-postgres');
const envPath = path.join(root, '.env');
const candidates = [
  process.env.POSTGRES_BIN,
  '/Library/PostgreSQL/18/bin',
  '/opt/homebrew/opt/postgresql@18/bin',
  '/opt/homebrew/opt/postgresql@17/bin',
  '/Applications/Postgres.app/Contents/Versions/latest/bin',
].filter(Boolean);
const bin = candidates.find((dir) => fs.existsSync(path.join(dir, 'pg_ctl')));

function run(command, args, options = {}) {
  const result = spawnSync(path.join(bin, command), args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return result.stdout;
}

async function main() {
  if (!bin)
    throw new Error('PostgreSQL tools not found. Set POSTGRES_BIN to their directory.');
  if (process.argv.includes('--stop')) {
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log('Local project database stopped. Saved data is retained.');
    return;
  }

  const dotenv = require('dotenv');
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const config = dotenv.parse(existing);
  const localUrlPrefix = 'postgres://team7_local:';
  if (
    config.DATABASE_URL &&
    !config.DATABASE_URL.includes('YOUR_PASSWORD') &&
    !config.DATABASE_URL.startsWith(localUrlPrefix)
  ) {
    throw new Error(
      'An existing DATABASE_URL is configured. Use npm run db:check and npm run db:init with that database instead.',
    );
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== config.DATABASE_URL) {
    throw new Error(
      'Unset the shell DATABASE_URL before setting up the private local database.',
    );
  }

  fs.mkdirSync(data, { recursive: true, mode: 0o700 });
  const password = config.DATABASE_URL?.startsWith(localUrlPrefix)
    ? new URL(config.DATABASE_URL).password
    : crypto.randomBytes(24).toString('hex');
  const url = `${localUrlPrefix}${password}@127.0.0.1:55432/team7_local`;
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'team7-db-'));
    const passwordFile = path.join(temporary, 'init-password');
    fs.writeFileSync(passwordFile, password, { mode: 0o600 });
    try {
      run('initdb', [
        '-D',
        data,
        '-U',
        'team7_local',
        '--auth=scram-sha-256',
        '--pwfile',
        passwordFile,
      ]);
    } finally {
      fs.unlinkSync(passwordFile);
      fs.rmdirSync(temporary);
    }
  }

  const settings = {
    PORT: config.PORT || '3000',
    NODE_ENV: config.NODE_ENV || 'development',
    SESSION_SECRET:
      config.SESSION_SECRET && config.SESSION_SECRET !== 'change-me'
        ? config.SESSION_SECRET
        : crypto.randomBytes(32).toString('hex'),
    DATABASE_URL: url,
  };
  let updated = existing;
  for (const [key, value] of Object.entries(settings)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    updated = pattern.test(updated)
      ? updated.replace(pattern, `${key}=${value}`)
      : `${updated}${updated.endsWith('\n') || !updated ? '' : '\n'}${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, updated, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);

  const status = spawnSync(path.join(bin, 'pg_ctl'), ['-D', data, 'status']);
  if (status.status !== 0) {
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      path.join(data, 'server.log'),
      '-o',
      "-h 127.0.0.1 -p 55432 -c unix_socket_directories=''",
      '-w',
      'start',
    ]);
  }

  const { Client } = require('pg');
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const result = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = 'team7_local'",
    );
    if (!result.rowCount) await admin.query('CREATE DATABASE team7_local');
  } finally {
    await admin.end();
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
  console.log('Local database ready on port 55432. Start the app with npm start.');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
