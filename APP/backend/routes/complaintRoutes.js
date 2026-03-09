const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { requireAuth } = require('../middlewares/auth');

router.post('/complaints', requireAuth, complaintController.createComplaint);
router.get('/complaints', requireAuth, complaintController.getComplaints);
router.post('/complaints/:id/respond', requireAuth, complaintController.respondComplaint);

module.exports = router;
