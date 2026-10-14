const { body, param } = require('express-validator');

const activityIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Activity ID must be a positive integer')
    .toInt(),
];

const activityValidation = [
  body('title')
    .isString()
    .withMessage('Title is required')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Title must be between 1 and 120 characters'),
  body('startsAt')
    .isString()
    .withMessage('Start date and time are required')
    .isISO8601()
    .withMessage('Start date and time must be a valid ISO 8601 value'),
  body('location')
    .isString()
    .withMessage('Location is required')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Location must be between 1 and 200 characters'),
  body('description')
    .isString()
    .withMessage('Description is required')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  body('latitude').custom((value, { req }) => {
    const longitude = req.body.longitude;
    const hasLatitude = value !== undefined && value !== null && value !== '';
    const hasLongitude =
      longitude !== undefined && longitude !== null && longitude !== '';

    if (hasLatitude !== hasLongitude) {
      throw new Error('Latitude and longitude must be provided together');
    }

    if (hasLatitude) {
      const latitude = Number(value);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new Error('Latitude must be between -90 and 90');
      }
    }

    return true;
  }),
  body('longitude').custom((value) => {
    if (value === undefined || value === null || value === '') return true;

    const longitude = Number(value);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    return true;
  }),
];

module.exports = {
  activityIdValidation,
  activityValidation,
};
