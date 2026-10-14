const db = require('./db');

async function list() {
  const result = await db.query(
    `SELECT
       a.id,
       a.creator_id AS "creatorId",
       u.username AS "creatorUsername",
       a.title,
       a.starts_at AS "startsAt",
       a.location,
       a.description,
       a.latitude,
       a.longitude,
       a.created_at AS "createdAt",
       a.updated_at AS "updatedAt",
       COUNT(att.user_id) FILTER (WHERE att.status = 'going')::INTEGER AS "goingCount"
     FROM activities a
     JOIN users u ON u.id = a.creator_id
     LEFT JOIN attendance att ON att.activity_id = a.id
     GROUP BY a.id, u.username
     ORDER BY a.starts_at ASC, a.id ASC`,
  );

  return result.rows;
}

async function findById(id) {
  const result = await db.query(
    `SELECT
       a.id,
       a.creator_id AS "creatorId",
       u.username AS "creatorUsername",
       a.title,
       a.starts_at AS "startsAt",
       a.location,
       a.description,
       a.latitude,
       a.longitude,
       a.created_at AS "createdAt",
       a.updated_at AS "updatedAt",
       COUNT(att.user_id) FILTER (WHERE att.status = 'going')::INTEGER AS "goingCount"
     FROM activities a
     JOIN users u ON u.id = a.creator_id
     LEFT JOIN attendance att ON att.activity_id = a.id
     WHERE a.id = $1
     GROUP BY a.id, u.username
     LIMIT 1`,
    [id],
  );

  return result.rows[0] || null;
}

async function create({
  creatorId,
  title,
  startsAt,
  location,
  description,
  latitude,
  longitude,
}) {
  const result = await db.query(
    `INSERT INTO activities (
       creator_id,
       title,
       starts_at,
       location,
       description,
       latitude,
       longitude
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id,
       creator_id AS "creatorId",
       title,
       starts_at AS "startsAt",
       location,
       description,
       latitude,
       longitude,
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [creatorId, title, startsAt, location, description, latitude, longitude],
  );

  return result.rows[0];
}

async function update(
  id,
  { title, startsAt, location, description, latitude, longitude },
) {
  const result = await db.query(
    `UPDATE activities
     SET
       title = $2,
       starts_at = $3,
       location = $4,
       description = $5,
       latitude = $6,
       longitude = $7,
       updated_at = now()
     WHERE id = $1
     RETURNING
       id,
       creator_id AS "creatorId",
       title,
       starts_at AS "startsAt",
       location,
       description,
       latitude,
       longitude,
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [id, title, startsAt, location, description, latitude, longitude],
  );

  return result.rows[0] || null;
}

async function deleteById(id) {
  const result = await db.query(
    `DELETE FROM activities
     WHERE id = $1
     RETURNING id`,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = {
  list,
  findById,
  create,
  update,
  deleteById,
};
