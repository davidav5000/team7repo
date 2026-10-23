const { body, param, query } = require('express-validator');

const searchValidation = [
  query('q')
    .optional()
    .isString()
    .withMessage('Search text must be a string')
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search text must be 100 characters or fewer'),
  query('location')
    .optional()
    .isString()
    .withMessage('Location must be a string')
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must be 200 characters or fewer'),
  query('from')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('From must be a date in YYYY-MM-DD format')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('From must be a valid date'),
  query('to')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('To must be a date in YYYY-MM-DD format')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('To must be a valid date')
    .custom((value, { req }) => {
      if (req.query.from && value < req.query.from) {
        throw new Error('To must be on or after from');
      }
      return true;
    }),
];

const activityIdValidation = [
  param('id')
    .isInt({ min: 1, max: 2147483647 })
    .withMessage('Activity ID must be a positive PostgreSQL integer')
    .toInt(),
];

const activityValidation = [
  body('title')
    .isString()
    .withMessage('Title is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Title must be between 1 and 120 characters'),
  body('startsAt')
    .isString()
    .withMessage('Start date and time are required')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('Start date and time must be a valid ISO 8601 value')
    .bail()
    .custom((value) => value.includes('T') && Number.isFinite(Date.parse(value)))
    .withMessage('Start date and time must include a valid time'),
  body('location')
    .isString()
    .withMessage('Location is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Location must be between 1 and 200 characters'),
  body('description')
    .isString()
    .withMessage('Description is required')
    .bail()
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
      if (
        !isCoordinate(value) ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error('Latitude must be between -90 and 90');
      }
    }

    return true;
  }),
  body('longitude').custom((value) => {
    if (value === undefined || value === null || value === '') return true;

    const longitude = Number(value);
    if (
      !isCoordinate(value) ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error('Longitude must be between -180 and 180');
    }

    return true;
  }),
];

function isCoordinate(value) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
}

module.exports = {
  searchValidation,
  activityIdValidation,
  activityValidation,
};
