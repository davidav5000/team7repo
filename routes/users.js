const router = require('express').Router({ mergeParams: true });
const express = require('express');
const { uploadAvatar } = require('../controllers/avatarUploadController');
const requireAuth = require('../middleware/requireAuth');
const { getMe, updateAvatar } = require('../controllers/userController');
const { avatarValidation } = require('../middleware/avatarValidation');
const { getMyActivities } = require('../controllers/userActivityController');

router.post(
  '/me/avatar/upload',
  requireAuth,
  express.raw({ type: 'image/jpeg', limit: '1mb' }),
  uploadAvatar,
);
router.get('/me', requireAuth, getMe);
router.put('/me/avatar', requireAuth, avatarValidation, updateAvatar);
router.get('/me/activities', requireAuth, getMyActivities);

module.exports = router;
