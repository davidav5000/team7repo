const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const { getMe, updateAvatar } = require('../controllers/userController');
const { avatarValidation } = require('../middleware/avatarValidation');
const { getMyActivities } = require('../controllers/userActivityController');

router.get('/me', requireAuth, getMe);
router.put('/me/avatar', requireAuth, avatarValidation, updateAvatar);
router.get('/me/activities', requireAuth, getMyActivities);

module.exports = router;
