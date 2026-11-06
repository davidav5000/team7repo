const { randomUUID } = require('node:crypto');
const db = require('./db');

async function findByUserId(userId, revision) {
  const result = await db.query(
    `SELECT image_data AS "imageData", revision
     FROM user_avatars
     WHERE user_id = $1 AND revision = $2`,
    [userId, revision],
  );
  return result.rows[0] || null;
}

// All statements in a transaction must use the same checked-out connection.
async function changePicture(userId, picture) {
  const client = await db.pool.connect();
  let releaseError;
  try {
    await client.query('BEGIN');
    // Serialize save/remove operations for this user, even before an avatar exists.
    const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
      userId,
    ]);
    if (!user.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }

    let avatarUrl = null;
    if (picture) {
      await client.query(
        `INSERT INTO user_avatars (user_id, image_data, revision)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET image_data = EXCLUDED.image_data, revision = EXCLUDED.revision`,
        [userId, picture.imageData, picture.revision],
      );
      avatarUrl = `/users/${userId}/avatar?v=${picture.revision}`;
    } else {
      await client.query('DELETE FROM user_avatars WHERE user_id = $1', [userId]);
    }

    await client.query('UPDATE users SET avatar_url = $2 WHERE id = $1', [
      userId,
      avatarUrl,
    ]);
    await client.query('COMMIT');
    return { avatarUrl };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Discard a broken connection without masking the original failure.
      releaseError = rollbackError;
    }
    throw err;
  } finally {
    client.release(releaseError);
  }
}

// Receives validated, processed WebP bytes from the upload service.
async function replace(userId, imageData) {
  return changePicture(userId, { imageData, revision: randomUUID() });
}

async function remove(userId) {
  return changePicture(userId, null);
}

module.exports = { findByUserId, replace, remove };
