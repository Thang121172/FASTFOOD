const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/auth');

// Dev logic
router.get('/dev/last-otp', adminController.lastOtpDev);

// Admin logic
router.get('/admin/otp-metrics', requireAuth, adminController.otpMetrics);
router.post('/admin/otp-metrics/reset', requireAuth, adminController.resetOtpMetrics);
router.get('/admin/last-otp', requireAuth, adminController.lastOtpAdmin);
router.get('/admin/smtp-check', requireAuth, adminController.smtpCheck);

module.exports = router;
