const { validationResult } = require('express-validator');
const Activity = require('../models/activity');
const Attendance = require('../models/attendance');

function validationFailure(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    error: 'Invalid activity ID',
    details: errors.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    })),
  });
  return true;
}

function attendanceResponse(attendees, userId) {
  const currentUserGoing = Boolean(
    userId &&
      attendees.some(
        (attendee) => Number(attendee.userId) === Number(userId),
      ),
  );

  return {
    goingCount: attendees.length,
    currentUserGoing,
    attendees,
  };
}

async function ensureActivityExists(activityId) {
  return Activity.findById(activityId);
}

async function getAttendance(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await ensureActivityExists(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const attendees = await Attendance.listByActivity(req.params.id);
    return res.json({
      attendance: attendanceResponse(attendees, req.session?.userId),
    });
  } catch (err) {
    return next(err);
  }
}

async function joinActivity(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await ensureActivityExists(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await Attendance.setGoing(req.params.id, req.session.userId);
    const attendees = await Attendance.listByActivity(req.params.id);

    return res.json({
      attendance: attendanceResponse(attendees, req.session.userId),
    });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Activity not found' });
    }
    return next(err);
  }
}

async function withdrawFromActivity(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await ensureActivityExists(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await Attendance.setWithdrawn(req.params.id, req.session.userId);
    const attendees = await Attendance.listByActivity(req.params.id);

    return res.json({
      attendance: attendanceResponse(attendees, req.session.userId),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAttendance,
  joinActivity,
  withdrawFromActivity,
};
