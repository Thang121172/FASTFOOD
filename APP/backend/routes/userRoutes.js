const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middlewares/auth');

router.get('/profile', requireAuth, userController.getCurrentUser);
router.put('/profile', requireAuth, userController.updateProfile);

module.exports = router;
