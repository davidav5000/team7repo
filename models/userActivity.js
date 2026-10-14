const db = require('./db');

async function listHostedByUser(userId) {
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
     WHERE a.creator_id = $1
     GROUP BY a.id, u.username
     ORDER BY a.starts_at ASC, a.id ASC`,
    [userId],
  );

  return result.rows;
}

async function listGoingByUser(userId) {
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
     JOIN attendance mine
       ON mine.activity_id = a.id
      AND mine.user_id = $1
      AND mine.status = 'going'
     LEFT JOIN attendance att ON att.activity_id = a.id
     GROUP BY a.id, u.username
     ORDER BY a.starts_at ASC, a.id ASC`,
    [userId],
  );

  return result.rows;
}

module.exports = {
  listHostedByUser,
  listGoingByUser,
};
