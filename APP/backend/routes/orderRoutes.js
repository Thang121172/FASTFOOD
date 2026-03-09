const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middlewares/auth');

router.post('/orders', requireAuth, orderController.createOrder);
router.get('/orders/:id', requireAuth, orderController.getOrderDetail);
router.get('/customer/orders', requireAuth, orderController.getCustomerOrders);
router.get('/customer/recent-orders', requireAuth, orderController.getRecentOrders);
router.post('/orders/:id/cancel', requireAuth, orderController.cancelOrder);

module.exports = router;
