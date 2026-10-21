const db = require('./db');

async function listByActivity(activityId) {
  const result = await db.query(
    `SELECT
       c.id,
       c.activity_id AS "activityId",
       c.author_id AS "authorId",
       u.username AS "authorUsername",
       u.avatar_url AS "authorAvatarUrl",
       c.message,
       c.created_at AS "createdAt"
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.activity_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [activityId],
  );

  return result.rows;
}

async function create({ activityId, authorId, message }) {
  const result = await db.query(
    `WITH inserted AS (
       INSERT INTO comments (activity_id, author_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, activity_id, author_id, message, created_at
     )
     SELECT
       inserted.id,
       inserted.activity_id AS "activityId",
       inserted.author_id AS "authorId",
       u.username AS "authorUsername",
       u.avatar_url AS "authorAvatarUrl",
       inserted.message,
       inserted.created_at AS "createdAt"
     FROM inserted
     JOIN users u ON u.id = inserted.author_id`,
    [activityId, authorId, message],
  );

  return result.rows[0];
}

module.exports = {
  listByActivity,
  create,
};
