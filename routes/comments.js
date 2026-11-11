// Stage 4: activity discussion (mounted at /activities/:id/comments)
const router = require('express').Router({ mergeParams: true });
const { param } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const { activityIdValidation } = require('../middleware/activityValidation');
const { commentValidation } = require('../middleware/commentValidation');
const {
  createReply,
  updateComment,
  deleteComment,
  getComments,
  createComment,
} = require('../controllers/commentController');

router.get('/', activityIdValidation, getComments);
router.post('/', requireAuth, activityIdValidation, commentValidation, createComment);

const commentIdValidation = param('commentId')
  .isInt({ min: 1, max: Number.MAX_SAFE_INTEGER })
  .withMessage('Invalid comment ID')
  .toInt();
router.put(
  '/:commentId',
  requireAuth,
  activityIdValidation,
  commentIdValidation,
  commentValidation,
  updateComment,
);
router.delete(
  '/:commentId',
  requireAuth,
  activityIdValidation,
  commentIdValidation,
  deleteComment,
);
router.post(
  '/:commentId/replies',
  requireAuth,
  activityIdValidation,
  commentIdValidation,
  commentValidation,
  createReply,
);
module.exports = router;
