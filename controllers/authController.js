const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const User = require('../models/user');

const bcryptRounds = Number.parseInt(
  process.env.BCRYPT_ROUNDS || (process.env.NODE_ENV === 'test' ? '4' : '12'),
  10,
);

function validationFailure(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    error: 'Invalid account data',
    details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
  });
  return true;
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

async function register(req, res, next) {
  if (validationFailure(req, res)) return;

  const name = req.body.name.trim();
  const username = req.body.username.trim().toLowerCase();
  const contactInfo = req.body.contactInfo.trim();

  try {
    if (await User.findByUsername(username)) {
      return res.status(409).json({ error: 'Username is already in use' });
    }

    const passwordHash = await bcrypt.hash(req.body.password, bcryptRounds);
    const user = await User.create({ name, username, contactInfo, passwordHash });

    return res.status(201).json({ user });
  } catch (err) {
    // PostgreSQL unique_violation: handle the race where another registration
    // claims the username after our initial availability check.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username is already in use' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  if (validationFailure(req, res)) return;

  const username = req.body.username.trim().toLowerCase();

  try {
    const user = await User.findByUsername(username);
    const validPassword = user
      ? await bcrypt.compare(req.body.password, user.password_hash)
      : false;

    // Keep the response intentionally generic so it does not reveal whether
    // a particular username exists.
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Rotate the session ID on login to prevent session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        contact_info: user.contact_info,
      },
    });
  } catch (err) {
    return next(err);
  }
}

function logout(req, res, next) {
  if (!req.session) return res.status(204).end();

  return req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    return res.status(204).end();
  });
}

module.exports = {
  register,
  login,
  logout,
};
