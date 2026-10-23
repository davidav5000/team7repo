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

  if (process.env.NODE_ENV === 'production') {
    // Required when HTTPS terminates at a reverse proxy so secure session
    // cookies are still issued for the original HTTPS request.
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  // Postgres-backed sessions when configured. Tests and local development
  // without DATABASE_URL fall back to the in-memory session store.
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

    const status = err.status || 500;
    const error =
      process.env.NODE_ENV === 'production' && status >= 500
        ? 'Server error'
        : err.message || 'Server error';

    res.status(status).json({ error });
  });

  return app;
}

module.exports = createApp;
