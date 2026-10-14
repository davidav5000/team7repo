const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const mapsRouter = require('./routes/maps');

function createApp() {
  const app = express();

  app.use(helmet());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  // Postgres-backed sessions; tests (and setups without a DB) fall back to the memory store
  const store =
    process.env.DATABASE_URL && process.env.NODE_ENV !== 'test'
      ? new PgSession({ pool: require('./models/db').pool, createTableIfMissing: true })
      : undefined;

  app.use(
    session({
      store,
      secret: process.env.SESSION_SECRET || 'dev-only-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api/maps', mapsRouter());
  app.use(routes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  });

  return app;
}

module.exports = createApp;
