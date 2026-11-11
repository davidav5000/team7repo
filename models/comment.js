const db = require('./db');

async function listByActivity(activityId) {
  const result = await db.query(
    `SELECT
       c.id,
       c.activity_id AS "activityId",
       c.author_id AS "authorId",
       u.username AS "authorUsername",
       u.avatar_url AS "authorAvatarUrl",
       c.parent_id AS "parentId",
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

async function updateOwned({ id, activityId, authorId, message }) {
  const result = await db.query(
    `UPDATE comments SET message = $4
     WHERE id = $1 AND activity_id = $2 AND author_id = $3
     RETURNING id, message`,
    [id, activityId, authorId, message],
  );
  return result.rows[0] || null;
}

async function deleteOwned({ id, activityId, authorId }) {
  const result = await db.query(
    `DELETE FROM comments WHERE id = $1 AND activity_id = $2 AND author_id = $3 RETURNING id`,
    [id, activityId, authorId],
  );
  return result.rows[0] || null;
}

async function createReply({ activityId, authorId, message, parentId }) {
  const result = await db.query(
    `INSERT INTO comments (activity_id, author_id, message, parent_id)
     SELECT $1, $2, $3, id FROM comments
     WHERE id = $4 AND activity_id = $1 AND parent_id IS NULL
     RETURNING id, activity_id AS "activityId", author_id AS "authorId", message, parent_id AS "parentId", created_at AS "createdAt"`,
    [activityId, authorId, message, parentId],
  );
  return result.rows[0] || null;
}

module.exports = { createReply, updateOwned, deleteOwned, listByActivity, create };
