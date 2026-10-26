const User = require('../models/user');
const { validationResult } = require('express-validator');

async function getMe(req, res, next) {
  try {
    const user = await User.findPublicById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

async function updateAvatar(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Invalid avatar data',
      details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }

  try {
    const avatar = await User.updateAvatar(req.session.userId, req.body.avatarUrl);
    if (!avatar) return res.status(404).json({ error: 'User not found' });
    return res.json({ avatarUrl: avatar.avatarUrl });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMe, updateAvatar };
