// Stage 3: feed, create, view, edit, delete
const router = require('express').Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const requireAuth = require('../middleware/requireAuth');
const db = require('../db');

router.post('/posts', requireAuth, async (req, res) => {
    // Logic to create a new post
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { title, date, location, description, longitude, latitude } = req.body;
        if (!title || !date || !location || !description || !longitude || !latitude) {
            return res.status(400).send('Missing required fields');
        }
        const result = await db.query(
            'INSERT INTO posts (creator_id, title, starts_at, location, description, longitude, latitude) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [req.user.id, title, date, location, description, longitude, latitude]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).send('Invalid post data');
    }
});

router.get('/posts/:postId', requireAuth, async (req, res) => {
    // Logic to view a specific post
    try {
    } catch (error) {
        res.status(400).send('Invalid post ID');
    }
  res.send(`Viewing post with ID: ${req.params.postId}`);
});

router.put('/posts/:postId', requireAuth, async (req, res) => {
    // Logic to edit a specific post
  res.send(`Editing post with ID: ${req.params.postId}`);
});

router.delete('/posts/:postId', requireAuth, (req, res) => {
    // Logic to delete a specific post
  res.send(`Deleting post with ID: ${req.params.postId}`);
});

module.exports = router;
