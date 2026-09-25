const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/', require('./auth'));
router.use('/activities', require('./activities'));
router.use('/activities/:id/attendance', require('./attendance'));
router.use('/activities/:id/comments', require('./comments'));
router.use('/users', require('./users'));

module.exports = router;
