// Verifies DATABASE_URL works: `npm run db:check`
require('dotenv').config();
const { pool } = require('../models/db');

pool
  .query('SELECT current_database() AS db, version()')
  .then(({ rows }) => {
    console.log(`Connected to "${rows[0].db}"\n${rows[0].version}`);
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
