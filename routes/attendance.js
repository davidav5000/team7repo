// Stage 4: join/withdraw (mounted at /activities/:id/attendance)
const router = require('express').Router({ mergeParams: true });
const requireAuth = require('../middleware/requireAuth');
const { activityIdValidation } = require('../middleware/activityValidation');
const {
  getAttendance,
  joinActivity,
  withdrawFromActivity,
} = require('../controllers/attendanceController');

router.get('/', activityIdValidation, getAttendance);
router.post('/', requireAuth, activityIdValidation, joinActivity);
router.delete('/', requireAuth, activityIdValidation, withdrawFromActivity);

module.exports = router;
