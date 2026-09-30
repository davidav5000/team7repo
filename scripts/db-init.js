// Creates tables from db/schema.sql: `npm run db:init`
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../models/db');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

async function main() {
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Run all statements in one transaction so a failure leaves nothing half-created.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Applied ${path.relative(process.cwd(), schemaPath)}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('DB init failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
