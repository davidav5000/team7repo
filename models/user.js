const db = require('./db');

async function findByUsername(username) {
  const result = await db.query(
    `SELECT id, name, username, contact AS contact_info, password_hash
     FROM users
     WHERE lower(username) = lower($1)
     LIMIT 1`,
    [username],
  );

  return result.rows[0] || null;
}

async function create({ name, username, contactInfo, passwordHash }) {
  const result = await db.query(
    `INSERT INTO users (name, username, contact, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, username, contact AS contact_info`,
    [name, username, contactInfo, passwordHash],
  );

  return result.rows[0];
}

async function findPublicById(id) {
  const result = await db.query(
    `SELECT id, name, username, contact AS contact_info, avatar_url AS "avatarUrl"
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );

  return result.rows[0] || null;
}

async function updateAvatar(id, avatarUrl) {
  const result = await db.query(
    `UPDATE users
     SET avatar_url = $2
     WHERE id = $1
     RETURNING avatar_url AS "avatarUrl"`,
    [id, avatarUrl],
  );

  return result.rows[0] || null;
}

module.exports = {
  findByUsername,
  create,
  findPublicById,
  updateAvatar,
};
