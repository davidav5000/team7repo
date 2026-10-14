const { validationResult } = require('express-validator');
const Activity = require('../models/activity');

function validationFailure(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    error: 'Invalid activity data',
    details: errors.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    })),
  });
  return true;
}

function activityFields(body) {
  const hasCoordinates =
    body.latitude !== undefined &&
    body.latitude !== null &&
    body.latitude !== '';

  return {
    title: body.title.trim(),
    startsAt: body.startsAt,
    location: body.location.trim(),
    description: body.description.trim(),
    latitude: hasCoordinates ? Number(body.latitude) : null,
    longitude: hasCoordinates ? Number(body.longitude) : null,
  };
}

async function listActivities(req, res, next) {
  try {
    const activities = await Activity.list();
    return res.json({ activities });
  } catch (err) {
    return next(err);
  }
}

async function getActivity(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    return res.json({ activity });
  } catch (err) {
    return next(err);
  }
}

async function createActivity(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await Activity.create({
      creatorId: req.session.userId,
      ...activityFields(req.body),
    });

    return res.status(201).json({
      activity: {
        ...activity,
        goingCount: 0,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateActivity(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const existing = await Activity.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (Number(existing.creatorId) !== Number(req.session.userId)) {
      return res.status(403).json({
        error: 'Only the activity creator can modify this activity',
      });
    }

    const activity = await Activity.update(
      req.params.id,
      activityFields(req.body),
    );

    return res.json({
      activity: {
        ...activity,
        creatorUsername: existing.creatorUsername,
        goingCount: existing.goingCount,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteActivity(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const existing = await Activity.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (Number(existing.creatorId) !== Number(req.session.userId)) {
      return res.status(403).json({
        error: 'Only the activity creator can modify this activity',
      });
    }

    await Activity.deleteById(req.params.id);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
};
