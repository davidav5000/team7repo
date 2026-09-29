const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const { getMe } = require('../controllers/userController');

router.get('/me', requireAuth, getMe);

module.exports = router;
