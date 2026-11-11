const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const {
  getMe,
  updateAvatar,
  removeAvatar,
  getAvatar,
} = require('../controllers/userController');
const { avatarReadValidation } = require('../middleware/avatarValidation');
const avatarUpload = require('../middleware/avatarUpload');
const { getMyActivities } = require('../controllers/userActivityController');

router.get('/me', requireAuth, getMe);
router.put('/me/avatar', requireAuth, avatarUpload, updateAvatar);
router.delete('/me/avatar', requireAuth, removeAvatar);
router.get('/me/activities', requireAuth, getMyActivities);
router.get('/:id/avatar', avatarReadValidation, getAvatar);

module.exports = router;
