const { body } = require('express-validator');

const usernameRules = body('username')
  .isString()
  .withMessage('Username is required')
  .trim()
  .isLength({ min: 3, max: 32 })
  .withMessage('Username must be between 3 and 32 characters')
  .matches(/^[A-Za-z0-9_.-]+$/)
  .withMessage('Username may contain letters, numbers, underscores, periods, and hyphens only');

const passwordRules = body('password')
  .isString()
  .withMessage('Password is required')
  .isLength({ min: 8, max: 72 })
  .withMessage('Password must be between 8 and 72 characters');

const registerValidation = [
  body('name')
    .isString()
    .withMessage('Name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  usernameRules,
  body('contactInfo')
    .isString()
    .withMessage('Contact information is required')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Contact information must be between 3 and 255 characters'),
  passwordRules,
];

const loginValidation = [usernameRules, body('password').isString().withMessage('Password is required')];

module.exports = {
  registerValidation,
  loginValidation,
};
