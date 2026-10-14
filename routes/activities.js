const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const {
  activityIdValidation,
  activityValidation,
} = require('../middleware/activityValidation');
const {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activityController');

// Mounted at /activities by routes/index.js.
router.get('/', listActivities);
router.post('/', requireAuth, activityValidation, createActivity);
router.get('/:id', activityIdValidation, getActivity);
router.put('/:id', requireAuth, activityIdValidation, activityValidation, updateActivity);
router.delete('/:id', requireAuth, activityIdValidation, deleteActivity);

module.exports = router;
