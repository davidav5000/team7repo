const { param, query } = require('express-validator');

const avatarReadValidation = [
  param('id').isInt({ min: 1, max: 2147483647 }),
  query('v').isString().bail().isUUID(4),
];

module.exports = { avatarReadValidation };
