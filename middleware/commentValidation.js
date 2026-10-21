const { body } = require('express-validator');

const commentValidation = [
  body('message')
    .isString()
    .withMessage('Comment message is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters'),
];

module.exports = {
  commentValidation,
};
