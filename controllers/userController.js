const User = require('../models/user');

async function getMe(req, res, next) {
  try {
    const user = await User.findPublicById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMe };
