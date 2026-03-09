const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { requireAuth } = require('../middlewares/auth');

router.post('/reviews', requireAuth, reviewController.createReview);

module.exports = router;
