// Stage 4: activity discussion (mounted at /activities/:id/comments)
const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const { activityIdValidation } = require('../middleware/activityValidation');
const { commentValidation } = require('../middleware/commentValidation');
const {
  getComments,
  createComment,
} = require('../controllers/commentController');

router.get('/', activityIdValidation, getComments);
router.post(
  '/',
  requireAuth,
  activityIdValidation,
  commentValidation,
  createComment,
);

module.exports = router;
