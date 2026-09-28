const { Pool } = require('pg');

// Single shared pool. Connects lazily on first query.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => console.error('Unexpected idle pg client error', err));

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
