const router = require('express').Router({ mergeParams: true });
const { registerValidation, loginValidation } = require('../middleware/authValidation');
const { register, login, logout } = require('../controllers/authController');

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', logout);

module.exports = router;
