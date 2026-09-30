const db = require('./db');

async function findByUsername(username) {
  const result = await db.query(
    `SELECT id, name, username, contact_info, password_hash
     FROM users
     WHERE username = $1
     LIMIT 1`,
    [username],
  );

  return result.rows[0] || null;
}

async function create({ name, username, contactInfo, passwordHash }) {
  const result = await db.query(
    `INSERT INTO users (name, username, contact_info, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, username, contact_info`,
    [name, username, contactInfo, passwordHash],
  );

  return result.rows[0];
}

async function findPublicById(id) {
  const result = await db.query(
    `SELECT id, name, username, contact_info
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = {
  findByUsername,
  create,
  findPublicById,
};
