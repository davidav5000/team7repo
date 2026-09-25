const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');

function createApp() {
  const app = express();

  app.use(helmet());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
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

  app.use(routes);

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
   
  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  });

  return app;
}

module.exports = createApp;
