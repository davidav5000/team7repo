const UserActivity = require('../models/userActivity');

async function getMyActivities(req, res, next) {
  try {
    const [hosting, going] = await Promise.all([
      UserActivity.listHostedByUser(req.session.userId),
      UserActivity.listGoingByUser(req.session.userId),
    ]);

    return res.json({
      hosting,
      going,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMyActivities,
};
