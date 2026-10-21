const { body } = require('express-validator');

const avatarValidation = [
  body('avatarUrl')
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('Avatar URL must be a string or null')
    .bail()
    .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
    .custom((value) => {
      if (value === null) return true;
      if (value.length > 2048 || !/^https:\/\//i.test(value) || /\s/.test(value)) {
        return false;
      }

      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    })
    .withMessage(
      'Avatar URL must be an HTTPS URL without credentials, at most 2048 characters',
    ),
];

module.exports = { avatarValidation };
