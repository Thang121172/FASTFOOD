const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { requireAuth } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

router.post('/upload/image', requireAuth, upload.single('image'), uploadController.uploadImage);

module.exports = router;
