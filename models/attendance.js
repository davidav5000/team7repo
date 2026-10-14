const db = require('./db');

async function listByActivity(activityId) {
  const result = await db.query(
    `SELECT
       att.user_id AS "userId",
       u.username,
       att.updated_at AS "updatedAt"
     FROM attendance att
     JOIN users u ON u.id = att.user_id
     WHERE att.activity_id = $1
       AND att.status = 'going'
     ORDER BY lower(u.username) ASC, u.id ASC`,
    [activityId],
  );

  return result.rows;
}

async function setGoing(activityId, userId) {
  const result = await db.query(
    `INSERT INTO attendance (user_id, activity_id, status)
     VALUES ($1, $2, 'going')
     ON CONFLICT (user_id, activity_id)
     DO UPDATE SET
       status = 'going',
       updated_at = now()
     RETURNING
       user_id AS "userId",
       activity_id AS "activityId",
       status,
       updated_at AS "updatedAt"`,
    [userId, activityId],
  );

  return result.rows[0];
}

async function setWithdrawn(activityId, userId) {
  const result = await db.query(
    `UPDATE attendance
     SET
       status = 'withdrawn',
       updated_at = now()
     WHERE user_id = $1
       AND activity_id = $2
     RETURNING
       user_id AS "userId",
       activity_id AS "activityId",
       status,
       updated_at AS "updatedAt"`,
    [userId, activityId],
  );

  return result.rows[0] || null;
}

module.exports = {
  listByActivity,
  setGoing,
  setWithdrawn,
};
