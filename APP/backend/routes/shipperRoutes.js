const express = require('express');
const router = express.Router();
const shipperController = require('../controllers/shipperController');
const { requireAuth } = require('../middlewares/auth');

router.get('/shipper/orders', requireAuth, shipperController.getShipperOrders);
router.post('/shipper/orders/:id/accept', requireAuth, shipperController.acceptOrder);
router.patch('/shipper/orders/:id', requireAuth, shipperController.updateOrderStatusStatus);
router.get('/shipper/orders/:id', requireAuth, shipperController.getShipperOrderDetail);
router.get('/shipper/revenue', requireAuth, shipperController.getShipperRevenue);
router.get('/shipper/profile', requireAuth, shipperController.getShipperProfile);
router.patch('/shipper/profile', requireAuth, shipperController.updateShipperProfile);
router.post('/shipper/location', requireAuth, shipperController.updateShipperLocation);
router.post('/shipper/orders/:id/report_issue', requireAuth, shipperController.reportIssue);

module.exports = router;
