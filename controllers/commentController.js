const { validationResult } = require('express-validator');
const Activity = require('../models/activity');
const Comment = require('../models/comment');

function validationFailure(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    error: 'Invalid comment data',
    details: errors.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    })),
  });
  return true;
}

async function getComments(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const comments = await Comment.listByActivity(req.params.id);
    return res.json({ comments });
  } catch (err) {
    return next(err);
  }
}

async function createComment(req, res, next) {
  if (validationFailure(req, res)) return;

  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const comment = await Comment.create({
      activityId: req.params.id,
      authorId: req.session.userId,
      message: req.body.message.trim(),
    });

    return res.status(201).json({ comment });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Activity not found' });
    }
    return next(err);
  }
}

module.exports = {
  getComments,
  createComment,
};
