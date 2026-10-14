const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const { getMe } = require('../controllers/userController');
const { getMyActivities } = require('../controllers/userActivityController');

router.get('/me', requireAuth, getMe);
router.get('/me/activities', requireAuth, getMyActivities);

module.exports = router;
