const User = require('../models/user');
const Avatar = require('../models/avatar');
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
  try {
    const avatar = await Avatar.replace(req.session.userId, req.avatarImage);
    if (!avatar) return res.status(404).json({ error: 'User not found' });
    return res.json(avatar);
  } catch (err) {
    return next(err);
  }
}

async function removeAvatar(req, res, next) {
  try {
    const avatar = await Avatar.remove(req.session.userId);
    if (!avatar) return res.status(404).json({ error: 'User not found' });
    return res.json(avatar);
  } catch (err) {
    return next(err);
  }
}

async function getAvatar(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(404).json({ error: 'Picture not found' });
  }

  try {
    const avatar = await Avatar.findByUserId(Number(req.params.id), req.query.v);
    if (!avatar) return res.status(404).json({ error: 'Picture not found' });
    res.set('Cache-Control', 'public, no-cache');
    res.set('ETag', `"${avatar.revision}"`);
    return res.type('webp').send(avatar.imageData);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMe, updateAvatar, removeAvatar, getAvatar };
